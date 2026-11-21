"""Canonical offline RAGAS scorer. Never regenerates application answers.

The TypeScript bridge invokes this file. Imports of paid providers are lazy so
validation/fixture tests require only the Python standard library.
"""
import argparse
import importlib.metadata
import json
import math
import os
import sys

EVALUATOR_VERSION = "ragas-0.2.15"
JUDGE_MODEL = "gpt-4o-mini"
EMBEDDING_MODEL = "text-embedding-3-small"
METRICS = {"contextPrecision": "context_precision", "contextRecall": "context_recall",
           "faithfulness": "faithfulness", "answerRelevance": "answer_relevancy"}


def validate_log(log):
    scenario = log.get("question_id") or log.get("scenario_id") or log.get("log_id")
    reference = log.get("reference")
    if not isinstance(reference, str) or not reference.strip():
        raise ValueError(f"Scenario {scenario}: missing referenceAnswer")
    if not isinstance(log.get("contexts"), list) or not all(isinstance(c, str) for c in log["contexts"]):
        raise ValueError(f"Scenario {scenario}: ordered contexts must be a string list")
    for key in ("question", "answer"):
        if not isinstance(log.get(key), str) or not log[key].strip():
            raise ValueError(f"Scenario {scenario}: missing {key}")
    return {"question": log["question"], "answer": log["answer"],
            "contexts": log["contexts"], "ground_truth": reference}


def score_log(log, scorer):
    sample = validate_log(log)
    scores, statuses = {}, {}
    for column, metric in METRICS.items():
        try:
            value = float(scorer(sample, metric))
            if not math.isfinite(value) or not 0 <= value <= 1:
                raise ValueError("Non-finite or out-of-range score")
            scores[column] = value
            statuses[column] = {"status": "succeeded"}
        except Exception as error:
            scores[column] = None
            statuses[column] = {"status": "failed", "error": str(error)}
    return scores, statuses


def make_scorer():
    from datasets import Dataset
    from ragas import evaluate
    from ragas.metrics import context_precision, context_recall, faithfulness, answer_relevancy
    from ragas.llms import LangchainLLMWrapper
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from ragas.run_config import RunConfig
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    if importlib.metadata.version("ragas") != "0.2.15":
        raise RuntimeError("Install eval-pipeline/requirements.txt: canonical pipeline requires ragas==0.2.15")
    llm = LangchainLLMWrapper(ChatOpenAI(model=JUDGE_MODEL, temperature=0, max_retries=0))
    embeddings = LangchainEmbeddingsWrapper(OpenAIEmbeddings(model=EMBEDDING_MODEL, dimensions=1536, max_retries=0))
    metrics = {m.name: m for m in (context_precision, context_recall, faithfulness, answer_relevancy)}

    def score(sample, metric):
        result = evaluate(Dataset.from_list([sample]), metrics=[metrics[metric]], llm=llm, embeddings=embeddings,
                          run_config=RunConfig(max_retries=1, max_workers=1, timeout=180),
                          raise_exceptions=True, show_progress=False)
        return result.to_pandas().iloc[0][metric]
    return score


def database_connection_options(url):
    """Remove Prisma-only schema selector; retain the selected PostgreSQL search path."""
    from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
    parsed = urlsplit(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    schema = query.pop("schema", None)
    dsn = urlunsplit(parsed._replace(query=urlencode(query)))
    return dsn, schema


def connect_database(url):
    import psycopg2
    from psycopg2 import sql
    dsn, schema = database_connection_options(url)
    conn = psycopg2.connect(dsn)
    if schema:
        with conn.cursor() as cur:
            cur.execute(sql.SQL("SET search_path TO {}").format(sql.Identifier(schema)))
    return conn


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--dataset-version", required=True)
    parser.add_argument("--method", choices=["sparse", "dense", "hybrid"])
    parser.add_argument("--difficulty", choices=["easy", "medium", "hard"])
    parser.add_argument("--scenario-id")
    parser.add_argument("--log-ids")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main():
    args = arguments()
    from dotenv import load_dotenv
    import psycopg2
    from psycopg2.extras import RealDictCursor, Json
    load_dotenv()
    conditions = ['l."runId" = %s', 'l."datasetVersion" = %s', "l.status = 'succeeded'"]
    params = [args.run_id, args.dataset_version]
    for value, clause in [(args.method, 'l.retrieval_method = %s'),
                          (args.difficulty, 's.difficulty = %s'), (args.scenario_id, 'l."scenarioId" = %s')]:
        if value:
            conditions.append(clause)
            params.append(value)
    if args.log_ids:
        conditions.append("l.id = ANY(%s)")
        params.append(args.log_ids.split(","))
    if not args.force:
        conditions.append('(r.id IS NULL OR r."evaluatorVersion" IS DISTINCT FROM %s OR r.status IS DISTINCT FROM %s)')
        params.extend([EVALUATOR_VERSION, "succeeded"])
    query = f"""SELECT l.id AS log_id, l."scenarioId" AS scenario_id, s."questionId" AS question_id,
        l."userPrompt" AS question, l."aiResponse" AS answer, l."retrievedContextsList" AS contexts,
        l."referenceAnswerSnapshot" AS reference
        FROM ai_interaction_logs l JOIN evaluation_scenarios s ON s.id = l."scenarioId"
        LEFT JOIN ragas_evaluations r ON r."logId" = l.id
        WHERE {' AND '.join(conditions)} ORDER BY l."createdAt", l.id"""
    if args.limit:
        if args.limit < 1:
            raise ValueError("--limit must be positive")
        query += " LIMIT %s"
        params.append(args.limit)
    with connect_database(os.environ["DATABASE_URL"]) as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            logs = list(cur.fetchall())
        # Validate every reference before starting any judge calls.
        for log in logs:
            validate_log(log)
        if not logs:
            print("No unscored successful observations in the requested run/dataset.")
            return
        scorer = make_scorer()
        failed = 0
        for log in logs:
            scores, statuses = score_log(log, scorer)
            status = "succeeded" if all(v["status"] == "succeeded" for v in statuses.values()) else "failed"
            failed += status == "failed"
            # Save partial valid metrics with explicit denominators; absent scores remain SQL NULL.
            columns = list(METRICS)
            values = [scores[c] for c in columns]
            with conn.cursor() as cur:
                cur.execute(f"""INSERT INTO ragas_evaluations
                    (id, "logId", {', '.join(chr(34)+c+chr(34) for c in columns)}, "evaluatorVersion", "judgeModel", status, "metricStatus", "evaluatedAt")
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT ("logId") DO UPDATE SET
                    {', '.join(chr(34)+c+chr(34)+' = EXCLUDED.'+chr(34)+c+chr(34) for c in columns)},
                    "evaluatorVersion"=EXCLUDED."evaluatorVersion", "judgeModel"=EXCLUDED."judgeModel",
                    status=EXCLUDED.status, "metricStatus"=EXCLUDED."metricStatus", "evaluatedAt"=NOW()
                    """, ["ragas-" + log["log_id"], log["log_id"], *values, EVALUATOR_VERSION, JUDGE_MODEL, status,
                          Json({"metrics": statuses, "embeddingModel": EMBEDDING_MODEL, "temperature": 0,
                                "packages": {n: importlib.metadata.version(n) for n in ("ragas", "langchain-openai", "openai", "datasets")}})])
            conn.commit()
            print(json.dumps({"logId": log["log_id"], "status": status, "metrics": statuses}))
        if failed:
            raise RuntimeError(f"{failed} observations have judge failures; retry saved observations, never regenerate answers")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
