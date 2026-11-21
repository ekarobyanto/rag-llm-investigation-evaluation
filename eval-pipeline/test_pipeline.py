import json
import math
from pathlib import Path
import unittest
from run_ragas import validate_log, score_log, database_connection_options
from export_results import export_row, summarize

class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.log = {"scenario_id": "Q13", "question": "Pertanyaan", "answer": "Jawaban",
                    "contexts": ["Lobi 19.15", "Perjalanan 19.20"], "reference": "Acuan"}

    def test_preserves_ordered_application_inputs(self):
        calls = []
        def scorer(sample, metric):
            calls.append((sample, metric))
            return .75
        scores, statuses = score_log(self.log, scorer)
        self.assertEqual(len(calls), 4)
        for sample, metric in calls:
            self.assertEqual(sample["contexts"], self.log["contexts"])
            self.assertEqual(sample["ground_truth"], self.log["reference"])
        self.assertTrue(all(s["status"] == "succeeded" for s in statuses.values()))

    def test_blank_reference_fails_before_any_judge_call(self):
        for reference in (None, "", " "):
            self.log["reference"] = reference
            with self.assertRaisesRegex(ValueError, "Q13.*referenceAnswer"):
                score_log(self.log, lambda *_: self.fail("Judge must not run"))

    def test_nan_exception_and_out_of_range_stay_missing(self):
        for value in (math.nan, math.inf, -1, 2):
            scores, statuses = score_log(self.log, lambda *_: value)
            self.assertTrue(all(v is None for v in scores.values()))
            self.assertTrue(all(s["status"] == "failed" for s in statuses.values()))
        def unavailable(*_):
            raise RuntimeError("Provider failure")
        scores, statuses = score_log(self.log, unavailable)
        self.assertTrue(all(v is None for v in scores.values()))
        self.assertTrue(all("Provider failure" in s["error"] for s in statuses.values()))

    def test_partial_metrics_have_separate_denominators(self):
        row = export_row({"status": "succeeded", "retrievalMethod": "sparse", "repetition": 1,
            "ragasEvaluation": {"evaluatorVersion": "ragas-0.2.15", "faithfulness": .9}})
        summary = summarize([row])[0]
        self.assertEqual(summary["faithfulness"]["mean"], .9)
        self.assertEqual(summary["faithfulness"]["n"], 1)
        self.assertIsNone(summary["contextPrecision"]["mean"])
        self.assertEqual(summary["contextPrecision"]["n"], 0)
        row = export_row({"status": "succeeded", "retrievalMethod": "sparse", "repetition": 1,
            "ragasEvaluation": {"evaluatorVersion": "diagnostic", "faithfulness": 1}})
        self.assertIsNone(summarize([row])[0]["faithfulness"]["mean"])

    def test_prisma_schema_selector_is_not_sent_to_libpq(self):
        dsn, schema = database_connection_options("postgresql://fixture@127.0.0.1/db?schema=research&sslmode=prefer")
        self.assertEqual(schema, "research")
        self.assertNotIn("schema=", dsn)
        self.assertIn("sslmode=prefer", dsn)

    def test_all_thirty_v3_references(self):
        scenarios = json.loads((Path(__file__).parents[1] / "eval-scenarios/scenario-v3.id.json").read_text(encoding="utf-8"))
        for i, scenario in enumerate(scenarios):
            validate_log({**self.log, "scenario_id": f"Q{i+1}", "reference": scenario["referenceAnswer"]})

if __name__ == "__main__":
    unittest.main()
