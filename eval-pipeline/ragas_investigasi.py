"""SECONDARY DIAGNOSTIC ONLY: score selected saved responses outside the primary report.

The canonical pipeline is run_ragas.py with pinned requirements.txt. This older
standalone script writes JSON only; do not import its scores into primary reports.

Python 3.11, in a fresh virtual environment:
  python -m pip install "ragas==0.2.15" "langchain-openai>=0.2.9,<0.3" psycopg2-binary
  python ragas_investigasi.py --input logs.json
  python ragas_investigasi.py --log-ids ids.txt --score --output scores.json

Without --score only inputs are validated. --input accepts a JSON array with
log_id, method, question, answer, contexts (ordered strings), ground_truth.
--log-ids reads those fields from PostgreSQL for one exact log ID per line.
Set DATABASE_URL for PostgreSQL and OPENAI_API_KEY for scoring.
"""
import argparse
import json
import math
import os
from importlib.metadata import version
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

JUDGE = "gpt-4o-mini"
EMBEDDING = "text-embedding-3-small"
METHODS = {"sparse", "dense", "hybrid"}


def read_logs(path):
    import psycopg2
    from psycopg2.extras import RealDictCursor

    ids = [line.strip() for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
    if not ids or len(set(ids)) != len(ids):
        raise ValueError("Expected a nonempty list of unique log IDs")
    url = urlsplit(os.environ["DATABASE_URL"])
    # Prisma's schema selector is not a libpq option. Resolve the same search path.
    options = dict(parse_qsl(url.query, keep_blank_values=True))
    schema = options.pop("schema", None)
    dsn = urlunsplit(url._replace(query=urlencode(options)))
    from contextlib import closing
    from psycopg2 import sql
    with closing(psycopg2.connect(dsn)) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        if schema:
            cur.execute(sql.SQL("SET LOCAL search_path TO {}").format(sql.Identifier(schema)))
        cur.execute("""
            SELECT l.id AS log_id, l.retrieval_method AS method,
                   l."scenarioId" AS scenario_id, c.title AS case_title,
                   l."userPrompt" AS question, l."aiResponse" AS answer,
                   l."retrievedContextsList" AS contexts, s."referenceAnswer" AS ground_truth
            FROM ai_interaction_logs l
            JOIN evaluation_scenarios s ON s.id = l."scenarioId"
            JOIN cases c ON c.id = s."caseId"
            WHERE l.id::text = ANY(%s)
        """, (ids,))
        by_id = {str(row["log_id"]): dict(row) for row in cur.fetchall()}
    missing = [key for key in ids if key not in by_id]
    if missing:
        raise ValueError(f"Missing logs or scenario references: {missing}")
    return [by_id[key] for key in ids]


def validate(rows):
    if not isinstance(rows, list) or not rows:
        raise ValueError("Expected a nonempty JSON array")
    seen = set()
    for i, row in enumerate(rows):
        if not isinstance(row, dict):
            raise ValueError(f"Row {i}: expected an object")
        for key in ("log_id", "method", "question", "answer", "ground_truth"):
            if not isinstance(row.get(key), str) or not row[key].strip():
                raise ValueError(f"Row {i}: missing or empty {key}")
        if row["log_id"] in seen or row["method"] not in METHODS:
            raise ValueError(f"Row {i}: duplicate log ID or unknown retrieval method")
        seen.add(row["log_id"])
        contexts = row.get("contexts")
        if not isinstance(contexts, list) or not all(isinstance(c, str) and c.strip() for c in contexts):
            raise ValueError(f"Row {i}: expected contexts as an ordered list of nonempty strings")


def score(rows):
    if version("ragas") != "0.2.15":
        raise ValueError("Install ragas==0.2.15 for this runner")
    from ragas import EvaluationDataset, evaluate
    from ragas.dataset_schema import SingleTurnSample
    from ragas.metrics import Faithfulness, ResponseRelevancy, LLMContextPrecisionWithReference, LLMContextRecall
    from ragas.llms import LangchainLLMWrapper
    from ragas.embeddings import LangchainEmbeddingsWrapper
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings

    metrics = [Faithfulness(), ResponseRelevancy(), LLMContextPrecisionWithReference(), LLMContextRecall()]
    samples = [SingleTurnSample(user_input=r["question"], response=r["answer"],
                                retrieved_contexts=r["contexts"], reference=r["ground_truth"])
               for r in rows]
    result = evaluate(
        dataset=EvaluationDataset(samples=samples), metrics=metrics,
        llm=LangchainLLMWrapper(ChatOpenAI(model=JUDGE, temperature=0)),
        embeddings=LangchainEmbeddingsWrapper(OpenAIEmbeddings(model=EMBEDDING)),
        raise_exceptions=True,
    )
    output = []
    for row, values in zip(rows, result.scores, strict=True):
        scores = {}
        for metric in metrics:
            value = float(values[metric.name])
            scores[metric.name] = value if math.isfinite(value) else None
        output.append({**row, "scores": scores})
    return {"evaluator_role": "secondary-diagnostic", "ragas_version": version("ragas"), "judge": JUDGE, "embedding": EMBEDDING, "rows": output}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--input", type=Path)
    source.add_argument("--log-ids", type=Path)
    parser.add_argument("--score", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.score != bool(args.output):
        parser.error("--score and --output must be used together")
    if args.output and (args.output.exists() or not args.output.parent.is_dir()):
        parser.error("Output must be a new file in an existing directory")
    rows = (json.loads(args.input.read_text(encoding="utf-8-sig"))
            if args.input else read_logs(args.log_ids))
    validate(rows)
    empty = sum(not row["contexts"] for row in rows)
    print(f"Validated {len(rows)} logs; {empty} with empty retrieval.")
    if args.score:
        payload = json.dumps(score(rows), ensure_ascii=False, indent=2, allow_nan=False)
        with args.output.open("x", encoding="utf-8") as out:
            out.write(payload + "\n")


if __name__ == "__main__":
    main()
