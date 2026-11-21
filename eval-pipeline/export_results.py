"""Export a single dataset/run. Failed attempts never enter successful means."""
import argparse
import csv
import json
import math
import statistics
from pathlib import Path

SCORE_COLUMNS = ["precisionAt5", "recallAt5", "hitRateAt5", "precisionAt10", "recallAt10", "hitRateAt10",
                 "retrievalTimeMs", "llmResponseTimeMs", "totalResponseTimeMs",
                 "contextPrecision", "contextRecall", "faithfulness", "answerRelevance"]


def export_row(log):
    metrics = log.get("retrievalMetrics") or {}
    judge = log.get("ragasEvaluation") or {}
    primary = judge.get("evaluatorVersion") == "ragas-0.2.15"
    row = {key: log.get(key) for key in ("id", "datasetVersion", "runId", "scenarioId", "repetition", "attempt", "retryOf",
        "retrievalMethod", "status", "failureReason", "createdAt", "finishedAt", "promptTemplateVersion",
        "userPrompt", "aiResponse", "referenceAnswerSnapshot", "retrievalTimeMs", "llmResponseTimeMs", "totalResponseTimeMs")}
    for cutoff in (5, 10):
        at = metrics.get(f"at{cutoff}") or {}
        row[f"precisionAt{cutoff}"] = at.get("precision")
        row[f"recallAt{cutoff}"] = at.get("recall")
        row[f"hitRateAt{cutoff}"] = at.get("hit")
    row["returnedCount"] = (metrics.get("at10") or {}).get("returnedCount")
    for key in ("contextPrecision", "contextRecall", "faithfulness", "answerRelevance"):
        row[key] = judge.get(key) if primary else None
    for key in ("retrievedEvidenceIds", "retrievedContextsList", "modelSettings", "runManifest"):
        row[key] = json.dumps(log.get(key), ensure_ascii=False)
    row["judgeStatus"] = judge.get("status") if primary else None
    row["judgeMetricStatus"] = json.dumps(judge.get("metricStatus") if primary else None, ensure_ascii=False)
    return row


def valid(values):
    return [v for v in values if isinstance(v, (int, float)) and math.isfinite(v)]


def summarize(rows):
    result = []
    for method in ("sparse", "dense", "hybrid"):
        attempts = [r for r in rows if r["retrievalMethod"] == method]
        successful = [r for r in attempts if r["status"] == "succeeded"]
        summary = {"method": method, "successful": len(successful), "failedAttempts": sum(r["status"] == "failed" for r in attempts),
                   "incompleteAttempts": sum(r["status"] == "started" for r in attempts)}
        for column in SCORE_COLUMNS:
            values = valid([r[column] for r in successful])
            repetition_means = []
            for repetition in (1, 2, 3):
                group = valid([r[column] for r in successful if r["repetition"] == repetition])
                if group:
                    repetition_means.append(statistics.mean(group))
            summary[column] = {"mean": statistics.mean(values) if values else None, "n": len(values),
                "repetitionMeans": repetition_means,
                "repetitionStdDev": statistics.stdev(repetition_means) if len(repetition_means) > 1 else None}
        result.append(summary)
    return result


def write_report(logs, output):
    rows = [export_row(log) for log in logs]
    if not rows:
        raise ValueError("No observations for selected dataset/run")
    identities = {(r["datasetVersion"], r["runId"]) for r in rows}
    if len(identities) != 1 or any(not x for pair in identities for x in pair):
        raise ValueError("Export requires exactly one explicit dataset/run identity")
    successes = [r for r in rows if r["status"] == "succeeded"]
    keys = [(r["scenarioId"], r["retrievalMethod"], r["repetition"]) for r in successes]
    if len(set(keys)) != len(keys):
        raise ValueError("Duplicate successful observation identity")
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    with (output / "observations.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    report = summarize(rows)
    (output / "summary.json").write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
    lines = ["# Retrieval experiment", "", f"Dataset/run: {next(iter(identities))}", "",
        "Precision@5, Recall@5, Hit Rate@5, Precision@10, Recall@10, Hit Rate@10 use frozen per-question labels.",
        "RAGAS scores use the canonical evaluator only. Missing scores stay absent; n is the valid metric denominator.",
        "Repetition standard deviation is calculated over at most three means, each from the same 30 questions.",
        "", "| Method | Successful | Failed attempts | Incomplete attempts |", "|---|---:|---:|---:|"]
    lines += [f"| {s['method']} | {s['successful']} | {s['failedAttempts']} | {s['incompleteAttempts']} |" for s in report]
    for column in SCORE_COLUMNS:
        lines += ["", f"## {column}", "", "| Method | Mean | n | Repetition means | Repetition SD |", "|---|---:|---:|---|---:|"]
        for s in report:
            v = s[column]
            lines.append(f"| {s['method']} | {v['mean']} | {v['n']} | {v['repetitionMeans']} | {v['repetitionStdDev']} |")
    (output / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--dataset-version", required=True)
    parser.add_argument("--input", help="Saved JSON observations for offline verification")
    parser.add_argument("--output", default="eval-pipeline/results/current")
    args = parser.parse_args()
    if args.input:
        logs = json.loads(Path(args.input).read_text(encoding="utf-8"))
    else:
        from dotenv import load_dotenv
        import os
        import psycopg2
        from psycopg2.extras import RealDictCursor
        load_dotenv()
        from run_ragas import connect_database
        with connect_database(os.environ["DATABASE_URL"]) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""SELECT l.*, row_to_json(r) AS "ragasEvaluation" FROM ai_interaction_logs l
                  LEFT JOIN ragas_evaluations r ON r."logId" = l.id
                  WHERE l."runId" = %s AND l."datasetVersion" = %s ORDER BY l."createdAt", l.id""", [args.run_id, args.dataset_version])
                logs = json.loads(json.dumps(list(cur.fetchall()), default=str))
    logs = [l for l in logs if l.get("runId") == args.run_id and l.get("datasetVersion") == args.dataset_version]
    print(json.dumps(write_report(logs, args.output), indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
