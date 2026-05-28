# Technical Documentation

System architecture, stack, schema, routes, conventions, and setup for the Investigation Decision Support System.

For the AI pipeline itself see `docs/rag-llm-flow.md`.

---

## 1. Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 22.x |
| Framework | Next.js (App Router) | 15 |
| Language | TypeScript | 5.3 |
| UI | React | 19 |
| Styling | Tailwind CSS | 3.4 |
| Database | PostgreSQL | 16 |
| Vector Extension | pgvector | bundled (`pgvector/pgvector:pg16`) |
| ORM | Prisma | 5.22 |
| LLM Provider | OpenAI (`gpt-4o`) | API |
| Embeddings | OpenAI (`text-embedding-3-small`, 1536-d) | API |
| Container | Docker Compose | — |
| Script runner | tsx | 4.x |

---

## 2. Repository Layout

```
thesis/
├── app/                            Next.js App Router
│   ├── api/
│   │   ├── ai/interact/route.ts    POST — AI interaction endpoint
│   │   ├── cases/route.ts          GET  — list all cases
│   │   ├── cases/[id]/route.ts     GET  — single case detail
│   │   └── sessions/route.ts       POST — create session
│   ├── globals.css                 Tailwind base
│   ├── layout.tsx                  root layout
│   └── page.tsx                    entry — case picker + dashboard
├── components/
│   ├── CaseSelection.tsx           list + RAG toggle + start
│   └── InvestigationDashboard.tsx  workspace + AI chat panel
├── lib/
│   ├── case-data.ts                input case type + AI generation prompt
│   ├── db.ts                       Prisma singleton (HMR-safe)
│   ├── embedding.ts                OpenAI embedding wrapper
│   └── rag.ts                      retrieval + LLM orchestration
├── prisma/
│   ├── schema.prisma               full schema (see §4)
│   ├── migrations/                 SQL migration history
│   └── seed.ts                     reads cases-input/, populates DB
├── cases-input/                    case JSON files (see docs/create-cases.md)
├── docs/                           project documentation
├── .env                            DATABASE_URL, OPENAI_API_KEY
├── docker-compose.yaml             external service (Postgres) — at /home/ekarobyanto/Projects
└── package.json                    scripts + deps
```

---

## 3. Service Dependencies

### 3.1 PostgreSQL

- Image: `pgvector/pgvector:pg16` (replaces stock `postgres:16-alpine` so the vector extension is available)
- Compose file location: `/home/ekarobyanto/Projects/docker-compose.yaml` (parent dir)
- Service name: `psql` → container `projects-psql-1`
- Port: `5432` (host) → `5432` (container)
- Credentials: `admin` / `root`
- Default DB: `hk` (compose env), application DB: `thesis`
- Vector extension must be installed once via Prisma migration; the `extensions = [vector]` directive in `schema.prisma` plus `previewFeatures = ["postgresqlExtensions"]` handles it automatically on `prisma migrate dev`.

### 3.2 OpenAI API

- Used for embeddings AND chat completions
- Required at: seed time (embeddings) and runtime (every `/api/ai/interact` call)
- Key loaded from `OPENAI_API_KEY` in `.env`
- Without key: seed completes but evidence has NULL embeddings; runtime AI calls fail with `OpenAIError`

---

## 4. Database Schema

Prisma schema: `prisma/schema.prisma`. Tables (`@@map` names):

### 4.1 `cases`

| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid |
| title | text | |
| description | text | |
| createdAt, updatedAt | timestamp | |

Relations: 1→N `suspects`, 1→N `evidence`, 1→N `investigation_sessions`, 1→1 `case_ground_truth`

### 4.2 `suspects`

| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid |
| caseId | text FK → cases | cascade delete |
| name | text | |
| profile | text | |

### 4.3 `evidence`

| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid |
| caseId | text FK → cases | cascade delete |
| type | text | `witness_statement` / `forensic_report` / etc. |
| category | text | `alibi` / `forensic` / `communication` / `financial` / `motive` / `location` / `contradiction` / `noise` |
| difficultyWeight | float | 0.1–1.0 |
| content | text | |
| embedding | `vector(1536)` | NULLABLE — populated via raw SQL after insert |
| createdAt | timestamp | |

### 4.4 `case_ground_truth`

| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid |
| caseId | text FK → cases, UNIQUE | one ground truth per case |
| correctSuspectId | text FK → suspects | |
| contradictionPairs | jsonb | `[{ evidence_id_1, evidence_id_2, explanation }]` |
| relevantEvidenceIds | jsonb | `string[]` of evidence IDs |
| optimalNextActions | jsonb | `[{ action_type, target, reason }]` |

### 4.5 `investigation_sessions`

| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid |
| caseId | text FK → cases | cascade delete |
| ragEnabled | bool | locked at session creation |
| createdAt, updatedAt | timestamp | |

### 4.6 `investigation_logs`

| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid |
| sessionId | text FK → investigation_sessions | cascade delete |
| action | text | player action label |
| target | text? | evidence id, suspect name, etc. |
| createdAt | timestamp | |

### 4.7 `ai_interaction_logs`

The largest table. Logs one row per `/api/ai/interact` call. See `docs/rag-llm-flow.md` §12 for per-field semantics.

Indexed by `sessionId` via the FK. Add manual indexes if querying by `caseId`, `ragEnabled`, or `createdAt` becomes hot.

---

## 5. API Routes

All routes return JSON. No authentication.

### 5.1 `GET /api/cases`

Returns array of every case with nested suspects and evidence (minus embedding column — Prisma omits Unsupported types automatically).

Response shape:
```ts
Array<{
  id, title, description, createdAt, updatedAt,
  suspects: Array<{ id, name, profile, ... }>,
  evidence: Array<{ id, type, category, content, difficultyWeight, ... }>
}>
```

### 5.2 `GET /api/cases/[id]`

Single case detail. 404 if not found.

Next.js 15: `params` is a `Promise` — must be awaited.

### 5.3 `POST /api/sessions`

Body: `{ caseId: string, ragEnabled?: boolean }`
Creates an `InvestigationSession`. Returns the row (201).

### 5.4 `POST /api/ai/interact`

Body:
```ts
{
  sessionId: string
  caseId: string
  prompt: string
  ragEnabled: boolean
}
```

Response:
```ts
{
  response: string                       // human-readable (recommendation block stripped)
  structuredRecommendation: object | null
  logId: string
  timings: { retrievalTimeMs, llmResponseTimeMs, totalResponseTimeMs }
  tokens: { prompt, completion, total }
  estimatedCost: number
  correctnessScore: number | null
}
```

Full pipeline: `docs/rag-llm-flow.md`.

---

## 6. Environment Variables

Loaded from `.env` (Prisma's default) and `.env.local` (Next.js convention).

| Var | Required | Used by |
|---|---|---|
| `DATABASE_URL` | yes | Prisma CLI + runtime client |
| `OPENAI_API_KEY` | yes (for AI features) | `lib/embedding.ts`, `lib/rag.ts` |
| `NEXT_PUBLIC_API_URL` | optional | client-side fetches if absolute URL needed |

`.env` is gitignored. Do not commit credentials.

---

## 7. NPM Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next dev server (default port 3000) |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint (next config) |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Run `prisma migrate dev` |
| `npm run prisma:studio` | Open Prisma Studio UI |
| `npm run seed` | Run `tsx prisma/seed.ts` |

---

## 8. Setup (First Time)

```bash
# 1. Start Postgres with pgvector
cd /home/ekarobyanto/Projects
docker compose up -d psql

# 2. Install deps
cd thesis
npm install

# 3. Create .env (DATABASE_URL + OPENAI_API_KEY)
# Example DATABASE_URL: postgresql://admin:root@localhost:5432/thesis?schema=public

# 4. Create database (if not exists)
docker exec projects-psql-1 psql -U admin -d postgres -c "CREATE DATABASE thesis;"

# 5. Run migrations (creates schema + enables vector extension)
npx prisma migrate dev

# 6. Seed cases
npm run seed

# 7. Start dev server
npm run dev
```

---

## 9. Prisma + pgvector Conventions

The `embedding` field is declared `Unsupported("vector(1536)")` which means:

- It does NOT appear in generated Prisma types
- It cannot be set via `.create()` or `.update()` data objects
- All reads/writes use raw SQL: `$queryRaw`, `$executeRaw`

Standard patterns:

```ts
// Write
await prisma.evidence.create({ data: { /* non-vector fields */ } })
await prisma.$executeRaw`
  UPDATE evidence
  SET embedding = ${JSON.stringify(vector)}::vector
  WHERE id = ${id}
`

// Read with similarity
await prisma.$queryRaw<Row[]>`
  SELECT id, content,
         1 - (embedding <=> ${JSON.stringify(queryVec)}::vector) AS similarity
  FROM evidence
  WHERE case_id = ${caseId} AND embedding IS NOT NULL
  ORDER BY embedding <=> ${JSON.stringify(queryVec)}::vector
  LIMIT ${k}
`
```

Tagged-template substitution is parameterized — safe against SQL injection.

---

## 10. Migration Workflow

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate + apply migration
npx prisma migrate dev --name <descriptive_name>
# 3. Commit both schema.prisma AND prisma/migrations/<timestamp>_<name>/
```

If a migration fails partway:

```bash
# Mark the failed migration as rolled back, then retry
./node_modules/.bin/prisma migrate resolve --rolled-back <migration_name>
./node_modules/.bin/prisma migrate dev
```

If the schema drifts from the migration history, `prisma migrate dev` will prompt to reset. **Do not reset in production.** For local dev, accept the reset to realign.

---

## 11. Seed Pipeline

`prisma/seed.ts` flow:

1. Load all `*.json` from `cases-input/`
2. Each file may contain either a single case object OR a wrapper object whose values are cases (e.g., `{ case_1_medium: {...}, case_2_hard: {...} }`)
3. Wipe existing rows: `ai_interaction_logs` → `investigation_logs` → `investigation_sessions` → `case_ground_truth` → `evidence` → `suspects` → `cases`
4. For each case:
   - Insert `cases` row
   - Insert `suspects` rows; build `name → id` map
   - Insert `evidence` rows; collect ID array indexed by JSON position
   - For each evidence: generate embedding, UPDATE row with raw SQL (skipped if no `OPENAI_API_KEY`)
   - Translate `ground_truth` indices → IDs using the maps above
   - Insert `case_ground_truth` row

Re-running is idempotent (full wipe + repopulate).

Case JSON format: see `docs/create-cases.md`.

---

## 12. Frontend Architecture

App Router. Two stateful components driving the entire UI:

### 12.1 `app/page.tsx`

Top-level state machine: `case selection ↔ active investigation`. Holds the chosen case, current `sessionId`, and `ragEnabled` flag.

### 12.2 `components/CaseSelection.tsx`

Fetches `/api/cases`, renders list, owns RAG toggle, calls `/api/sessions` on start, hands off to dashboard.

### 12.3 `components/InvestigationDashboard.tsx`

The investigation workspace:

- Three columns: suspects / evidence / AI chat
- Predefined prompt buttons + free-text input
- Calls `/api/ai/interact` for every player query
- Maintains in-memory chat history (also persisted server-side via the log table)

No global state library. Local `useState` only — sufficient because each session is self-contained.

---

## 13. Logging + Observability

- Server-side errors: `console.error` in route handlers and `lib/rag.ts`
- LLM/retrieval errors: caught locally, graceful degradation (empty retrieval, null recommendation), still logged
- No structured logger or APM wired up — extension point if production traffic ever matters

Per-request structured data lives in `ai_interaction_logs`. Query directly for analysis:

```sql
-- Hallucination candidates (no retrieval but high-confidence wrong answer)
SELECT id, user_prompt, ai_response, correctness_score
FROM ai_interaction_logs
WHERE rag_enabled = false AND correctness_score = 0;

-- RAG ON vs OFF comparison on same case
SELECT rag_enabled, AVG(correctness_score), AVG(total_response_time_ms), AVG(total_tokens)
FROM ai_interaction_logs
WHERE case_id = '<case-id>'
GROUP BY rag_enabled;
```

---

## 14. Known Limitations + Tech Debt

| Item | Why it matters | Where to fix |
|---|---|---|
| No HNSW index on `evidence.embedding` | Linear scan grows with corpus | New SQL migration |
| `hallucinationDetected` never populated | Spec requires hallucination rate metric | Add evaluator pass after LLM response |
| `retrievalPrecision` returned but not persisted | Useful for retrieval evaluation | Add column + write in route handler |
| Strict-match correctness scoring | Doesn't reward partial-correct recommendations | Refactor `scoreRecommendation` |
| OpenAI hard dependency | Single-vendor lock-in, paid | Swap embedding to Ollama nomic; chat to local llama.cpp |
| No frontend tests | Manual QA only | Add Playwright if scope warrants |
| Pricing constants hard-coded | Drifts when model pricing changes | Move to env or central config |

---

## 15. Conventions

- **Casing:** Prisma models `PascalCase`, fields `camelCase`, table names `snake_case` via `@@map`, columns `camelCase` via Prisma default.
- **API routes:** always return JSON; errors return `{ error: string }` with appropriate status.
- **Async params (Next 15):** `params` is a `Promise` — always `await`.
- **Env loading in scripts:** call `dotenv/config` at top (Next.js auto-loads, scripts don't).
- **Vector serialization:** always `JSON.stringify(arr)` + `::vector` cast in raw SQL.

---

## 16. Related Documents

| Doc | Scope |
|---|---|
| `docs/business-flow.md` | Non-technical end-user / research framing |
| `docs/rag-llm-flow.md` | AI pipeline internals (retrieval, prompts, scoring) |
| `docs/create-cases.md` | Spec for AI-generated case JSON |
| `docs/spec-additions.md` | Schema + metric additions over the original spec |
| `docs/overview.md` | High-level summary + known gaps |
