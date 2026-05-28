# Spec Additions (v2)

Extends the original spec with research-oriented evaluation components.

---

## Schema Changes Required

### `evidence` table — new columns

| Column | Type | Description |
|---|---|---|
| `category` | enum/string | `alibi`, `forensic`, `communication`, `financial`, `contradiction`, `motive`, `location` |
| `difficulty_weight` | float | reasoning importance (easy/medium/hard) |

### `ai_interaction_logs` table — new columns

| Column | Type | Description |
|---|---|---|
| `retrieved_evidence_ids` | string[] / JSON | IDs of retrieved evidence |
| `retrieval_scores` | float[] / JSON | similarity scores per retrieved item |
| `retrieval_success` | boolean | whether critical evidence was retrieved |
| `structured_recommendation` | JSON | `{ action_type, target, reason }` |
| `prompt_template_version` | string | prompt revision identifier |
| `estimated_cost` | float | estimated API cost |

### New table: `case_ground_truth`

| Column | Type | Description |
|---|---|---|
| `id` | string | PK |
| `case_id` | string | FK → cases |
| `correct_suspect_id` | string | actual culprit |
| `contradiction_pairs` | JSON | known contradiction mappings |
| `relevant_evidence_ids` | JSON | critical evidence IDs |
| `optimal_next_actions` | JSON | valid structured recommendations |

---

## New Evaluation Metrics

### Retrieval Metrics

| Metric | Description |
|---|---|
| Retrieval Precision | % retrieved evidence that is relevant |
| Retrieval Recall | % important evidence successfully retrieved |
| Top-K Accuracy | critical evidence appears in top-K results |
| Retrieval Failure Rate | % failed retrieval attempts |

### Reasoning Metrics

| Metric | Description |
|---|---|
| Contradiction Resolution Rate | AI correctly identifies + resolves contradictions |
| Recommendation Accuracy | structured output matches ground truth |
| Hallucination Rate | claims unsupported by retrieved evidence |

---

## Structured Recommendation Format

Every AI response MUST include structured output alongside human-readable text:

```json
{
  "action_type": "INTERROGATE",
  "target": "SUSPECT_4",
  "reason": "Timeline contradiction detected"
}
```

Evaluated automatically against `case_ground_truth.optimal_next_actions`.

---

## Evidence Difficulty Levels

| Level | Description | Expected RAG OFF | Expected RAG ON |
|---|---|---|---|
| Easy | single-document reasoning | similar | similar |
| Medium | two-document correlation | moderate degradation | better |
| Hard | multi-hop contradiction reasoning | significant degradation | strong improvement |

---

## Evidence Dependency Chains

Cases MUST define sequential evidence dependencies:

```
Evidence A → unlocks suspicion
Evidence B → reveals contradiction
Evidence C → confirms motive
```

Forces selective retrieval — full-context dumping insufficient.

---

## Optional Features

- **Prompt template versioning** — log `prompt_template_version` per interaction for reproducibility
- **Token cost estimation** — log `estimated_cost` for feasibility analysis
- **Internal evaluation dashboard** — retrieval inspector, RAG ON/OFF comparison, metrics summary
