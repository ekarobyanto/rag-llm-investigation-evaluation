# RAG + LLM Technical Flow

Internal pipeline for retrieval-augmented LLM responses. Covers embedding, vector retrieval, prompt construction, LLM invocation, response parsing, and evaluation.

---

## 1. Component Map

```
┌─────────────────────────────────────────────────────────────┐
│  app/api/ai/interact/route.ts        (HTTP entry)           │
│      └─ generateAIResponse()         (lib/rag.ts)           │
│             ├─ retrieveRelevantEvidence()                   │
│             │      └─ generateEmbedding()  (lib/embedding)  │
│             │      └─ pgvector similarity query             │
│             ├─ getInvestigationHistory()                    │
│             ├─ evaluateRetrieval()                          │
│             ├─ OpenAI chat.completions.create()             │
│             ├─ extractStructuredRecommendation()            │
│             └─ scoreRecommendation()                        │
│      └─ prisma.aIInteractionLog.create()  (persistence)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Embedding Generation

**Function:** `generateEmbedding(text: string) → number[]`
**Location:** `lib/embedding.ts`
**Model:** `text-embedding-3-small`
**Output dimensions:** 1536
**API:** `openai.embeddings.create({ model, input: text })`

Returns the raw float array. No normalization or post-processing.

Used in two places:
- **Seed time** — embed each evidence `content` once, store in `evidence.embedding`
- **Query time** — embed the player prompt on every Assisted Mode request

---

## 3. Vector Storage

**Column:** `evidence.embedding`
**Type:** `vector(1536)` (pgvector extension)
**Prisma representation:** `Unsupported("vector(1536)")` — not exposed in generated client
**Access pattern:** raw SQL only (`$queryRaw`, `$executeRaw`)

### Insert pattern

```ts
await prisma.evidence.create({ data: { ...fields } })
await prisma.$executeRaw`
  UPDATE evidence
  SET embedding = ${JSON.stringify(embedding)}::vector
  WHERE id = ${id}
`
```

Two-step because Unsupported columns cannot be set via `create()`.

---

## 4. Retrieval Flow

**Function:** `retrieveRelevantEvidence(caseId, query, limit=5)`
**Operator:** `<=>` — cosine distance (lower = more similar)
**Similarity score:** `1 - distance` (higher = more similar)

### SQL executed

```sql
SELECT id, type, category,
       LEFT(content, 500) AS content,
       1 - (embedding <=> $1::vector) AS similarity
FROM evidence
WHERE case_id = $2
  AND embedding IS NOT NULL
ORDER BY embedding <=> $1::vector
LIMIT $3
```

### Returns

```ts
{
  evidence: RetrievedEvidenceItem[],   // { id, type, category, content, similarity }
  retrievalTimeMs: number              // wall clock from generateEmbedding start to query finish
}
```

### Failure handling

- OpenAI embedding error → returns empty array, retrievalTimeMs still recorded
- DB error → caught, logged, empty array returned
- Empty result → downstream prompt has no evidence section but still completes

---

## 5. Investigation History Retrieval

**Function:** `getInvestigationHistory(sessionId, limit=5)`
**Source:** `ai_interaction_logs` table
**Order:** `createdAt DESC`
**Returns:** last N `{ prompt, response, timestamp }` for the session

Used only when RAG enabled. Provides conversational continuity within a session.

---

## 6. Prompt Construction

### System prompt (constant)

```
You are an expert criminal investigation assistant.

When responding, you MUST always end your response with a JSON block in
this exact format:
<recommendation>
{
  "action_type": "INTERROGATE" | "EXAMINE_EVIDENCE" | "REVIEW_TIMELINE"
               | "SUBMIT_DEDUCTION" | "INVESTIGATE_LOCATION",
  "target": "<suspect name or evidence ID>",
  "reason": "<one sentence reason>"
}
</recommendation>
```

### User prompt — Standard Mode (RAG OFF)

```
<player prompt verbatim>
```

### User prompt — Assisted Mode (RAG ON)

```
RELEVANT EVIDENCE:
- [<type>/<category>] <content excerpt>
- [<type>/<category>] <content excerpt>
... (up to top-K)

INVESTIGATION HISTORY:
Q: <prior prompt 1>
A: <prior response 1>

Q: <prior prompt 2>
A: <prior response 2>
... (up to last 5)

Player Question: <player prompt>
```

The retrieved context is stored verbatim in `ai_interaction_logs.retrievedContext` so the experiment is replayable.

---

## 7. LLM Invocation

**Provider:** OpenAI
**Model:** `gpt-4o`
**Parameters:**

| Param | Value |
|---|---|
| `temperature` | 0.7 |
| `max_tokens` | 1000 |
| `messages` | `[{role: "system", ...}, {role: "user", ...}]` |

**Timing measured:** `llmResponseTimeMs` = `Date.now()` immediately before the call to immediately after.

**Token accounting:** taken from `response.usage`:
- `prompt_tokens` → `promptTokens`
- `completion_tokens` → `completionTokens`
- `total_tokens` → `totalTokens`

---

## 8. Response Parsing

**Function:** `extractStructuredRecommendation(text) → StructuredRecommendation | null`

Regex: `/<recommendation>([\s\S]*?)<\/recommendation>/`

Behavior:
- No match → returns `null`, no correctness scoring performed
- Match but `JSON.parse` fails → returns `null`
- Match valid → typed `StructuredRecommendation` returned

The human-readable response is the raw LLM output **with the `<recommendation>...</recommendation>` block stripped out** before being returned to the client.

---

## 9. Retrieval Evaluation

**Function:** `evaluateRetrieval(caseId, retrievedIds) → { retrievalSuccess, precision }`

Looks up `case_ground_truth.relevantEvidenceIds`. Compares the set of retrieved evidence IDs against the set of authored-relevant evidence IDs.

| Metric | Definition |
|---|---|
| `retrievalSuccess` | `true` if at least one retrieved ID is in the ground-truth relevant set |
| `precision` | `hits / retrievedCount` |

Only `retrievalSuccess` is currently persisted on the log row. `precision` is returned but not yet logged (extension point).

If the case has no ground truth, both default to `false` / `0`.

---

## 10. Correctness Scoring

**Function:** `scoreRecommendation(caseId, recommendation) → number`

Looks up `case_ground_truth.optimalNextActions` (array of `{ action_type, target, reason }`). Returns:

- `1.0` if any optimal action matches both `action_type` AND `target` of the model's recommendation
- `0.0` otherwise

Stored in `ai_interaction_logs.correctnessScore`.

This is intentionally strict-match. A future extension can move to partial credit (action_type match only, or fuzzy target match).

---

## 11. Cost Tracking

**Computed at request time:**

```ts
estimatedCost = promptTokens * COST_PER_INPUT_TOKEN
              + completionTokens * COST_PER_OUTPUT_TOKEN
```

Constants in `lib/rag.ts`:

| Constant | Value | Source |
|---|---|---|
| `COST_PER_INPUT_TOKEN` | 0.0000025 | gpt-4o input rate |
| `COST_PER_OUTPUT_TOKEN` | 0.00001 | gpt-4o output rate |

Persisted in `ai_interaction_logs.estimatedCost`. Updates require editing the constants if model pricing changes.

---

## 12. Persistence (Per Interaction)

Every `POST /api/ai/interact` writes one row to `ai_interaction_logs` with:

| Field | Source |
|---|---|
| `sessionId`, `caseId` | request body |
| `userPrompt` | request body |
| `aiResponse` | LLM output (recommendation block stripped) |
| `retrievedContext` | full evidence + history string (Assisted Mode only) |
| `retrievedEvidenceIds` | JSON array of evidence IDs from retrieval |
| `retrievalScores` | JSON array of similarity scores (parallel to IDs) |
| `retrievalSuccess` | from `evaluateRetrieval` |
| `structuredRecommendation` | parsed JSON or null |
| `ragEnabled` | request body |
| `retrievalTimeMs` | from `retrieveRelevantEvidence` |
| `llmResponseTimeMs` | wall clock around OpenAI call |
| `totalResponseTimeMs` | retrieval + LLM |
| `promptTokens`, `completionTokens`, `totalTokens` | `response.usage` |
| `estimatedCost` | computed |
| `correctnessScore` | from `scoreRecommendation`, or null if no structured rec |
| `promptTemplateVersion` | constant `"v1"` |
| `createdAt` | auto |

`hallucinationDetected` and `hallucinationReason` exist but are not yet populated — reserved for an evaluator pass.

---

## 13. End-to-End Sequence (Assisted Mode)

```
HTTP POST /api/ai/interact
  body: { sessionId, caseId, prompt, ragEnabled: true }
        │
        ▼
generateAIResponse()
        │
        ├─ generateEmbedding(prompt)          [OpenAI embeddings API]
        ├─ pgvector similarity query          [Postgres]
        ├─ getInvestigationHistory()          [Postgres]
        ├─ evaluateRetrieval()                [Postgres]
        ├─ build prompt strings
        ├─ openai.chat.completions.create()   [OpenAI chat API]
        ├─ extractStructuredRecommendation()
        ├─ scoreRecommendation()              [Postgres]
        └─ compute estimatedCost
        │
        ▼
prisma.aIInteractionLog.create()              [Postgres]
        │
        ▼
HTTP 200 → { response, structuredRecommendation, logId, timings,
             tokens, estimatedCost, correctnessScore }
```

---

## 14. End-to-End Sequence (Standard Mode)

```
HTTP POST /api/ai/interact
  body: { sessionId, caseId, prompt, ragEnabled: false }
        │
        ▼
generateAIResponse()
        │
        ├─ (no embedding, no retrieval, no history)
        ├─ openai.chat.completions.create()
        ├─ extractStructuredRecommendation()
        ├─ scoreRecommendation()
        └─ compute estimatedCost
        │
        ▼
prisma.aIInteractionLog.create()
        │
        ▼
HTTP 200 → { response, structuredRecommendation, logId, timings,
             tokens, estimatedCost, correctnessScore }
```

Standard Mode log rows always have:
- `retrievalTimeMs = 0`
- `retrievedContext = null`
- `retrievedEvidenceIds = []`
- `retrievalScores = []`
- `retrievalSuccess = false`

This makes filtering by mode trivial in analysis queries.

---

## 15. Extension Points

| Extension | Where |
|---|---|
| Swap embedding model (e.g. Ollama nomic-embed-text 768d) | `lib/embedding.ts` + migration to change `vector(1536)` → `vector(768)` |
| Add HNSW index on `evidence.embedding` | New SQL migration: `CREATE INDEX ON evidence USING hnsw (embedding vector_cosine_ops)` |
| Log retrieval precision | Add column `retrievalPrecision Float?` to `AIInteractionLog`, populate from `evaluateRetrieval` |
| Hallucination detection | New evaluator function, populate `hallucinationDetected` + `hallucinationReason` |
| Prompt template versioning | Bump `PROMPT_TEMPLATE_VERSION` constant, rows tagged automatically |
| Streaming responses | Replace `chat.completions.create` with stream variant, accumulate before logging |

---

## 16. Flowcharts

### 16.1 Overall request lifecycle

```mermaid
flowchart TD
    A([POST /api/ai/interact]) --> B[parse body<br/>sessionId, caseId, prompt, ragEnabled]
    B --> C[generateAIResponse]
    C --> D{ragEnabled?}
    D -- false --> E[skip retrieval<br/>context = empty]
    D -- true --> F[Retrieval subflow]
    F --> G[build user prompt<br/>evidence + history + question]
    E --> H[user prompt = raw question]
    G --> I[OpenAI chat.completions.create<br/>gpt-4o]
    H --> I
    I --> J[extractStructuredRecommendation<br/>regex parse]
    J --> K{recommendation<br/>parsed?}
    K -- yes --> L[scoreRecommendation<br/>vs ground truth]
    K -- no --> M[correctnessScore = null]
    L --> N[compute estimatedCost]
    M --> N
    N --> O[prisma.aIInteractionLog.create]
    O --> P([HTTP 200<br/>response + metrics])
```

### 16.2 Retrieval subflow (Assisted Mode only)

```mermaid
flowchart TD
    A([Retrieval start<br/>caseId, query]) --> B[generateEmbedding<br/>OpenAI text-embedding-3-small]
    B --> C{embedding<br/>success?}
    C -- no --> D[return empty evidence<br/>retrievalTimeMs = elapsed]
    C -- yes --> E[pgvector cosine search<br/>ORDER BY embedding LIMIT 5]
    E --> F{rows<br/>returned?}
    F -- no --> G[evidence = empty array]
    F -- yes --> H[evidence = top-K rows<br/>with similarity scores]
    G --> I[getInvestigationHistory<br/>last 5 logs from session]
    H --> I
    I --> J[evaluateRetrieval<br/>vs case_ground_truth.relevantEvidenceIds]
    J --> K[retrievalSuccess = hits > 0]
    K --> L([return evidence + history + metrics])
    D --> L
```

### 16.3 Prompt construction branch

```mermaid
flowchart LR
    A([generateAIResponse]) --> B{ragEnabled}
    B -- true --> C[Assisted prompt]
    B -- false --> D[Standard prompt]

    C --> C1["systemPrompt = static investigation rules<br/>+ recommendation schema"]
    C --> C2["userPrompt =<br/>RELEVANT EVIDENCE: ...<br/>INVESTIGATION HISTORY: ...<br/>Player Question: prompt"]

    D --> D1["systemPrompt = static investigation rules<br/>+ recommendation schema"]
    D --> D2["userPrompt = prompt verbatim"]

    C1 --> E[OpenAI messages array]
    C2 --> E
    D1 --> E
    D2 --> E
```

### 16.4 Response parsing + scoring

```mermaid
flowchart TD
    A([LLM raw response]) --> B[regex match<br/>'recommendation' tags]
    B --> C{match<br/>found?}
    C -- no --> D[structuredRec = null<br/>humanResponse = full text]
    C -- yes --> E[JSON.parse inner text]
    E --> F{parse<br/>ok?}
    F -- no --> D
    F -- yes --> G[structuredRec = parsed object<br/>humanResponse = text minus block]
    G --> H[query case_ground_truth.optimalNextActions]
    H --> I{match action_type<br/>AND target?}
    I -- yes --> J[correctnessScore = 1.0]
    I -- no --> K[correctnessScore = 0.0]
    D --> L([return to logger])
    J --> L
    K --> L
```

### 16.5 Failure paths (resilience)

```mermaid
flowchart TD
    A([Request enters pipeline]) --> B{Embedding API down?}
    B -- yes --> B1[retrieval returns empty<br/>RAG degrades to no-context]
    B -- no --> C{pgvector query fails?}
    C -- yes --> C1[retrieval returns empty<br/>logged error]
    C -- no --> D{LLM API fails?}
    D -- yes --> D1[catch in route handler<br/>HTTP 500 returned<br/>NO log row written]
    D -- no --> E{LLM returns no<br/>recommendation block?}
    E -- yes --> E1[structuredRec = null<br/>correctnessScore = null<br/>log row still written]
    E -- no --> F{Recommendation JSON<br/>malformed?}
    F -- yes --> E1
    F -- no --> G{Ground truth missing<br/>for case?}
    G -- yes --> G1[retrievalSuccess = false<br/>correctnessScore = 0<br/>log row written]
    G -- no --> H([Full success path])
    B1 --> H
    C1 --> H
    E1 --> H
    G1 --> H
```

### 16.6 Data flow across persistence boundaries

```mermaid
flowchart LR
    subgraph Client
        U[Player UI]
    end

    subgraph Next.js API
        R[/api/ai/interact route/]
        G[generateAIResponse]
    end

    subgraph External
        OE[OpenAI Embeddings]
        OC[OpenAI Chat Completions]
    end

    subgraph Postgres
        EV[(evidence + vector)]
        GT[(case_ground_truth)]
        LOG[(ai_interaction_logs)]
        SES[(investigation_sessions)]
    end

    U -->|prompt + ragEnabled| R
    R --> G
    G -->|embed prompt| OE
    OE -->|1536-d vector| G
    G -->|similarity search| EV
    EV -->|top-K rows| G
    G -->|score check| GT
    GT -->|relevant IDs + optimal actions| G
    G -->|chat completion| OC
    OC -->|response + usage| G
    G -->|insert log row| LOG
    G -->|read history| LOG
    R -->|response + metrics| U
    SES -.session context.-> R
```
