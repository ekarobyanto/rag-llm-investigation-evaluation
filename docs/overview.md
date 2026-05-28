# Project Overview: Investigation Decision Support System

**Goal:** Compare RAG vs non-RAG LLM for criminal investigation decision support. Measure hallucination reduction, contextual consistency, recommendation accuracy.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 |
| Styling | Tailwind CSS |
| Language | TypeScript |
| Backend | Next.js API Routes |
| Database | PostgreSQL + pgvector |
| ORM | Prisma |
| LLM Provider | OpenAI API |

---

## Data Model

| Table | Purpose |
|---|---|
| `cases` | 3 investigation cases |
| `suspects` | 4-5 per case |
| `evidence` | 20-30 docs/case, vector-embedded |
| `investigation_sessions` | per-run game state |
| `investigation_logs` | player actions |
| `ai_interaction_logs` | full LLM I/O + metrics |

**Missing from schema (spec requires):** `case_ground_truth` table — needed for automatic correctness scoring.

---

## Core Flow

### 1. Session Setup
```
Player selects case (GET /api/cases)
  → returns case + suspects + evidence list

Player toggles RAG ON/OFF → POST /api/sessions
  → creates InvestigationSession { caseId, ragEnabled }
  → returns sessionId
```

### 2. AI Interaction (POST /api/ai/interact)
```
Input: { sessionId, caseId, prompt, ragEnabled }
  │
  ├─ RAG OFF ──────────────────────────────────────────┐
  │                                                     │
  └─ RAG ON                                             │
       │                                                │
       ├─ generateEmbedding(prompt)                     │
       │    └─ OpenAI text-embedding-3-small            │
       │                                                │
       ├─ pgvector similarity search                    │
       │    └─ SELECT id, type, content                 │
       │         FROM evidence                          │
       │         WHERE case_id = ?                      │
       │         ORDER BY embedding <=> queryVec        │
       │         LIMIT 5                                │
       │                                                │
       ├─ fetch last 5 AIInteractionLogs (session)      │
       │    └─ investigation history context            │
       │                                                │
       └─ build prompt with evidence + history ─────────┤
                                                        │
                                               OpenAI gpt-4o
                                                        │
                                               AI response text
                                                        │
                                          log to AIInteractionLog:
                                            userPrompt, aiResponse,
                                            retrievedContext,
                                            ragEnabled,
                                            retrievalTimeMs,
                                            llmResponseTimeMs,
                                            totalResponseTimeMs,
                                            promptTokens,
                                            completionTokens,
                                            totalTokens
                                                        │
                                          return to client:
                                            { response, logId,
                                              timings, tokens }
```

### 3. Gameplay Loop
```
Inspect evidence
  → Review suspects
    → Ask AI assistant (interaction above)
      → Player forms deduction
        → Submit conclusion
```

---

## What's Implemented

- DB schema + migrations + seed
- `lib/rag.ts` — retrieval + AI response generation
- `lib/embedding.ts` — OpenAI embeddings
- API routes: `/api/cases`, `/api/sessions`, `/api/ai/interact`
- UI components: `CaseSelection`, `InvestigationDashboard`

---

## Known Gaps vs Spec

See `docs/spec-additions.md` for full v2 spec.

### Schema gaps
1. `case_ground_truth` table missing — blocks automatic correctness scoring
2. `evidence` missing `category` + `difficulty_weight` columns
3. `ai_interaction_logs` missing: `retrieved_evidence_ids`, `retrieval_scores`, `retrieval_success`, `structured_recommendation`, `prompt_template_version`, `estimated_cost`

### Logic gaps
4. `retrieveRelevantEvidence` raw SQL missing parameter bindings — **bug** (query references `$1/$2/$3` but values not passed)
5. No structured recommendation output — spec requires JSON `{ action_type, target, reason }` alongside text response
6. No retrieval evaluation — precision/recall/top-K accuracy not computed
7. No automatic correctness scoring against ground truth
8. No contradiction resolution metric
