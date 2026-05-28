# Revised Final Specification Document

# Investigation Decision Support System Using Retrieval-Augmented Generation (RAG)

---

# 1. Project Overview

## Revised Thesis Title (Recommended)

# “Perancangan Sistem Pendukung Keputusan Investigasi Berbasis Large Language Model dengan Pendekatan Retrieval-Augmented Generation”

---

## Alternative Title

# “Implementasi Retrieval-Augmented Generation untuk Meningkatkan Konsistensi Kontekstual pada Sistem Asisten Investigasi Berbasis Large Language Model”

---

## Project Summary

This project is a web-based interactive investigation simulation system where players solve criminal investigation cases assisted by an LLM-powered investigation decision support system enhanced with Retrieval-Augmented Generation (RAG).

The primary purpose of the system is to evaluate:

* contextual reasoning quality,
* evidence-based investigative recommendations,
* hallucination reduction,
* and contextual consistency

within a controlled digital investigation environment.

The project focuses on:

# investigation reasoning and decision support

instead of:

* autonomous NPC behavior,
* agentic AI gameplay,
* or complex game AI systems.

---

# 2. Research Objectives

## Primary Objective

To evaluate the effectiveness of Retrieval-Augmented Generation (RAG) in improving contextual investigative reasoning and decision support quality in an LLM-based investigation assistant system.

---

## Research Questions

### RQ1

Does RAG improve the relevance and correctness of investigation recommendations?

### RQ2

Does RAG reduce hallucination in investigative reasoning?

### RQ3

Does retrieval of investigation history improve contextual consistency?

### RQ4

How does RAG affect:

* response time,
* token usage,
* and practical usability?

---

# 3. System Concept

## Core Concept

Player acts as an investigator.

The AI acts as:

# “Investigation Decision Support Assistant”

The AI:

* analyzes evidence,
* identifies contradictions,
* recommends investigation directions,
* explains inconsistencies,
* and assists reasoning processes.

The AI DOES NOT:

* autonomously solve cases,
* independently control gameplay,
* or act as a fully autonomous agent.

---

# 4. Design Philosophy

The application is:

# a controlled investigation reasoning simulation

designed to evaluate:

* selective retrieval,
* contextual memory,
* and evidence-based reasoning.

The project prioritizes:

* research clarity,
* measurable experimentation,
* and implementation feasibility.

---

# 5. Technical Stack

| Layer         | Technology         |
| ------------- | ------------------ |
| Framework     | Next.js            |
| Styling       | Tailwind CSS       |
| UI Components | shadcn/ui          |
| Language      | TypeScript         |
| Backend       | Next.js API Routes |
| Database      | PostgreSQL         |
| Vector Search | pgvector           |
| ORM           | Prisma             |
| LLM Provider  | OpenAI API         |

---

# 6. System Architecture

![Image](https://images.openai.com/static-rsc-4/kN4uYPZF2cw-Cc99ku7iIP5Rny0bTY9Glqt9dBgX2CSFoAs7Ejhs1Chqb47xRKLLyt9mSHlgQI8b2pguYePVmn_iwpFBonSgxpAuK8eSadyaG2BKupouayec0SDX628QXL8ME2i4OZCs-HPHv07x8Z7GJrXyxEtGyyaz8pGnV0Adwgb45-pxe5EI--MDT9VB?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/B1hGFKWciMRrHUNSxmY4DYCdP8iWqhjJ8xmSXhzWt7tt7tLNiLoEUWR0sky450hbvZ-7rwKZlUH73ibSmpxWzf6D1AnNMEmtLQjNtyR3uRx_rbrj_sL5FASAguwtET95ujsXlCOVJDo6Be3DyAKBvnfGY8NU20-xf9xHgTCaPS4P1z6ir0axzIA1FHcIsd8v?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/tID6Ap7Y02nipW6ntIYxWVnU1vX4GMJ0qEMDGvxNSFeWcdQdaqkrLbQxdfavOJJZG6k4R8FUDUpsE_Kf_Sztb6hkCgn-phxkjvan-NAEhZ-qsKWic3BpyI3cM28gj2TvpnuynXz6KCw8VCxRbdFaKVMdJXJg3FeIBevCfY-wAuT0o-QO6D2Sd3SDNro2pFD8?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/LHL1QRcgLWQd559biUG7c-m_LEjJwqv1rIxUGN84KpqfoQf13DtquT8ptsfynHwYqAj1i731P5u4906_FDXhBDkh-ceFk6LmIJFtSO1q6TEbrOveYoRE9ZsojWStQNxZBCP8ve9dik5vbtw7OdHpDkMZEPnpiEU_xbi-IUxdN7cUOhMecA_EDwymAUxFwzmY?purpose=fullsize)

```text id="9w3f0s"
Player Prompt
↓
RAG Mode Check
↓
IF RAG Enabled:
    Retrieve Relevant Evidence
    Retrieve Investigation History
↓
Prompt Construction
↓
OpenAI API
↓
AI Investigation Recommendation
↓
Automatic Evaluation
↓
Metrics Logging
```

---

# 7. Gameplay Design

## Gameplay Style

# Investigation Dashboard Simulation

The system uses:

* menu-driven interaction,
* guided investigation flow,
* and evidence-focused gameplay.

---

## Core Gameplay Loop

```text id="1n8v2m"
Inspect Evidence
↓
Review Reports
↓
Ask AI Assistant
↓
AI Retrieves Relevant Context
↓
AI Provides Recommendation
↓
Player Continues Investigation
↓
Submit Deduction
```

---

# 8. Interaction Design

## Interaction Model

# Structured Investigation Interaction

Primary interaction uses:

* selectable actions,
* guided prompts,
* evidence inspection,
* and contextual AI analysis.

---

## Main Actions

| Action              | Description                 |
| ------------------- | --------------------------- |
| Read Evidence       | inspect reports             |
| Interrogate Suspect | ask investigation questions |
| Review Timeline     | inspect chronology          |
| Ask AI Assistant    | request analysis            |
| Submit Deduction    | final conclusion            |

---

## Example Prompt Buttons

```text id="0xxy94"
[ Summarize Evidence ]
[ Identify Contradictions ]
[ Suggest Next Investigation ]
[ Explain Timeline Conflict ]
[ Most Relevant Evidence ]
```

---

# 9. Case Design

## Number of Cases

# 3 Investigation Cases

Each case contains:

* 4–5 suspects,
* 20–30 evidence documents,
* hidden contradictions,
* misleading information,
* irrelevant evidence,
* multi-step investigative dependencies.

---

# IMPORTANT REQUIREMENT

## Cases MUST Support Multi-Hop Reasoning

The cases MUST require:

* combining multiple evidence sources,
* correlating timelines,
* resolving contradictions,
* and contextual reasoning.

---

## Example Multi-Hop Reasoning

```text id="1r5j6n"
Witness Statement A
+
CCTV Record B
+
Financial Record C
↓
Inference:
Suspect lied about location.
```

---

# 10. Retrieval-Augmented Generation Design

## Retrieval Sources

### Evidence Database

Contains:

* forensic reports,
* witness statements,
* investigation notes,
* communication logs.

---

### Investigation History

Contains:

* previous AI responses,
* prior player deductions,
* investigation actions,
* discovered contradictions.

---

# IMPORTANT ARCHITECTURAL REQUIREMENT

Evidence and investigation history MUST be stored separately.

---

## Reason

To distinguish:

* immutable factual evidence
  from:
* dynamic investigation context/history.

This prevents:

* factual contamination,
* outdated reasoning reuse,
* and contextual ambiguity.

---

# 11. RAG Feature Toggle

# REQUIRED FEATURE

The system MUST support:

* RAG Enabled
* RAG Disabled

for experimental comparison.

---

## Purpose

Allows evaluation between:

* vanilla LLM,
* and retrieval-enhanced LLM.

---

## Example

| Mode    | Description                  |
| ------- | ---------------------------- |
| RAG OFF | plain LLM interaction        |
| RAG ON  | retrieval-enhanced reasoning |

---

# 12. Evaluation System

# Automatic Evaluation System

---

# IMPORTANT CHANGE

## Evaluation MUST Use Structured Ground Truth

The system MUST contain:

# predefined case solutions

for automatic scoring.

---

# 13. Ground Truth System

## New Core Table

# case_ground_truth

This table stores:

* actual culprit,
* known contradictions,
* optimal investigation paths,
* required evidence chains.

---

## Example Structure

| Field                 | Description              |
| --------------------- | ------------------------ |
| correct_suspect_id    | actual culprit           |
| contradiction_pairs   | known contradictions     |
| relevant_evidence_ids | critical evidence        |
| optimal_next_actions  | expected recommendations |

---

# 14. Decision Accuracy Evaluation

# IMPORTANT CHANGE

## Recommendations MUST Use Structured Output

AI recommendations should use structured formats.

---

## Example

```json id="lj5jv1"
{
  "action_type": "INTERROGATE",
  "target_suspect": "S4",
  "reason": "Timeline contradiction detected"
}
```

---

## Purpose

Allows:

* automatic validation,
* measurable correctness scoring,
* objective evaluation.

---

# 15. Primary Evaluation Metrics

| Metric                        | Purpose                         |
| ----------------------------- | ------------------------------- |
| Recommendation Accuracy       | recommendation validity         |
| Contradiction Resolution Rate | contradiction detection quality |
| Hallucination Rate            | unsupported claims              |
| Evidence Relevance Score      | retrieval usefulness            |

---

# 16. Secondary Evaluation Metrics

| Metric            | Purpose               |
| ----------------- | --------------------- |
| Response Time     | practical usability   |
| Token Usage       | operational overhead  |
| Retrieval Latency | retrieval performance |

---

# 17. Hallucination Definition

A response is considered hallucinated if:

* unsupported by evidence,
* references nonexistent facts,
* contradicts established ground truth.

---

# 18. Response Time Tracking

## Captured Metrics

| Field                  | Description            |
| ---------------------- | ---------------------- |
| retrieval_time_ms      | vector search duration |
| llm_response_time_ms   | OpenAI duration        |
| total_response_time_ms | full request duration  |

---

# 19. Token Usage Tracking

## Captured Metrics

| Field             | Description    |
| ----------------- | -------------- |
| prompt_tokens     | input tokens   |
| completion_tokens | output tokens  |
| total_tokens      | combined usage |

---

# 20. Experimental Design

## Experiment A

# Without RAG

```text id="6a2bx4"
Prompt
→ OpenAI
→ Recommendation
```

---

## Experiment B

# With RAG

```text id="s0m3ny"
Prompt
→ Selective Retrieval
→ Context Injection
→ OpenAI
→ Recommendation
```

---

# IMPORTANT REQUIREMENT

## Cases MUST exceed practical direct-context usage

The cases should contain:

* distracting evidence,
* irrelevant documents,
* and distributed information

to force:

# selective retrieval behavior

instead of:

# full-context dumping.

---

# 21. Database Design

# Core Tables

---

## cases

| Column      |
| ----------- |
| id          |
| title       |
| description |

---

## suspects

| Column  |
| ------- |
| id      |
| case_id |
| name    |
| profile |

---

## evidence

| Column    |
| --------- |
| id        |
| case_id   |
| type      |
| content   |
| embedding |

---

## investigation_history

| Column     |
| ---------- |
| id         |
| session_id |
| action     |
| context    |

---

## case_ground_truth

| Column                |
| --------------------- |
| id                    |
| case_id               |
| correct_suspect_id    |
| contradiction_pairs   |
| relevant_evidence_ids |
| optimal_next_actions  |

---

## ai_interaction_logs

| Column                    | Description              |
| ------------------------- | ------------------------ |
| id                        | primary key              |
| session_id                | gameplay session         |
| case_id                   | related case             |
| rag_enabled               | RAG mode                 |
| user_prompt               | player request           |
| retrieved_context         | retrieval result         |
| ai_response               | LLM output               |
| structured_recommendation | structured action output |
| retrieval_time_ms         | retrieval latency        |
| llm_response_time_ms      | LLM duration             |
| total_response_time_ms    | full request duration    |
| prompt_tokens             | input usage              |
| completion_tokens         | output usage             |
| total_tokens              | combined usage           |
| hallucination_detected    | evaluation flag          |
| correctness_score         | automatic evaluation     |
| created_at                | timestamp                |

---

# 22. User Interface Design

## Visual Style

# Minimal Professional Investigation Dashboard

---

## Main Layout

![Image](https://images.openai.com/static-rsc-4/OlAn0edvSV7qIKzCUs-Umt5_M5qIDq3iQ32SODwGu0HUO3gehVnnmTUlBlTMzm2t4PmXgJ8SOjYQMih7pRStnsudG1V826ADHBk7PqHe8BnVcFkq20I2PSwM0m_wVLGzDemHtoaaw09_tAMHXwsZAnGu2jo-WVsa7gXf9rwYufLHkktl1xU3Iv_20lJ3m5xy?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/M-wXjojqjJp2_2CwXygReebi_eEXInmQiiafdnKnsFSHKxq4VTx-p2nRifFcEhoHZk9dWUffqwxnfHEzp3pTK4cVwXkir8dccppXhF4hcXxxKgFbczp-70tlqXj8XXM9Wb3uZwRlIRAIhl1MU5LyB5j_pzypc6xWC_ofQhT_iZhwMhFO4Y59PTe3zoSDzG7L?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/Mmd5vW5sFlNfZ25Gp6drI9COT7BJrkQMz_z_12mtUdtvIrXoPa47qIQ769A9yfHCsRrtxkQiAGX5By0EFxoVfMVPJ11WAbCbcHPoi07RKS3cGtpA0JrEdHRR65gEuHsPdGGCj_ughuqy71FqNDfdrgY-JL0z1l-9jyywT_9aRiTjbmeBOPC5poZBQ7Y82YcJ?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/VXL6iF-K0fSssZ4w3ND8hcFXJcJDQT4nRZWE4euU0FHJxQPY7uSer80fQWaA1NMFirXTKsnpIOLstQ7HTRm3GnmejuBSS5Z_luMPLYJg8JPI1QXtgmDByu-R8Y-YvXAGpzSPPTJk6XgHPD0xSI--R-o_BIVoCVm5UNj6PrVu5lWG8ke8ezV9fHMS6ALPIqMB?purpose=fullsize)

| Section     | Content               |
| ----------- | --------------------- |
| Sidebar     | evidence & navigation |
| Main Panel  | investigation details |
| Right Panel | AI assistant          |
| Top Bar     | case information      |

---

# 23. Authentication

## MVP Decision

# No Authentication Required

Reason:

* no direct research contribution,
* reduces implementation complexity,
* single-session experimentation is sufficient.

---

# 24. Scope Restrictions

# STRICTLY AVOID

| Feature               | Reason                 |
| --------------------- | ---------------------- |
| Open-world gameplay   | unnecessary complexity |
| Autonomous AI agents  | out of scope           |
| Real-time gameplay    | difficult evaluation   |
| Multiplayer           | irrelevant to research |
| Voice interaction     | excessive complexity   |
| Procedural generation | scope explosion        |

---

# 25. Final MVP Scope

# Included Features

## Investigation Features

* 3 investigation cases
* evidence inspection
* suspect interrogation
* timeline review
* structured AI assistance

---

## AI Features

* RAG retrieval
* RAG ON/OFF mode
* investigation history retrieval
* contradiction analysis
* structured recommendations

---

## Evaluation Features

* automatic correctness scoring
* hallucination detection
* token usage tracking
* response time tracking
* retrieval logging
* recommendation validation

---

# 26. Final Research Contribution

This project contributes to:

# evaluating the effectiveness of Retrieval-Augmented Generation in improving contextual investigative reasoning and decision-support quality within a digital investigation simulation environment.
