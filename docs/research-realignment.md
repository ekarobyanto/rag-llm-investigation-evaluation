# Research realignment handoff

## Scope and source history

The active experiment compares PostgreSQL full-text search (Sparse), embedding cosine similarity (Dense), and equal-weight reciprocal rank fusion (Hybrid) on the same 30 Indonesian investigation questions. It measures evidence relevance, generated answer quality, and latency. The player still examines evidence and submits a suspect with reasoning; the deduction endpoint and its `isCorrect` comparison are unchanged.

Implementation started from PR #5's merge commit `0bb122e` on `fix/audited-ragas-scenarios`, containing the ID v3 dataset commit `0a9e4ead738585f5ab32247595bd642438c8997f`. The repository's default branch is **master**. Its `e6e1adf` head was reconciled in merge commit `075ecff`; that adds the standalone diagnostic scorer from PR #4. Local audit edits in the original worktree were not included or overwritten.

The 150 ordered evidence records, 30 question identities, answers, labels, and contradiction pairs match PR #5 exactly. Only v3 `expectedActions` and `optimal_next_actions` were removed. Older instruments and result artifacts retain their original content.

| Artifact | SHA-256 |
|---|---|
| `eval-scenarios/scenario-v3.id.json` | `b9473d2bf5f27ba1f31af8fe2fff11acdebf545a6b321b019bae83c9daf7c42e` |
| `cases-input/id-ID/case-1.v3.json` | `5640913e9dd316bbaf7febd6915829ae715fcd207f9dcefe9b1640b244f88c6c` |

The two active JSON files use enforced LF line endings through `.gitattributes` so checkout line-ending conversion does not change their recorded hashes. Dataset identity is `scenario filename:scenario SHA-256:corpus SHA-256`. The application computes it from file bytes, so even a formatting change creates a new identity. Existing historical records have null run/dataset identities and cannot enter current aggregates.

## Implementation map

| Paths | Behavior |
|---|---|
| `lib/rag.ts`, `app/api/ai/interact/route.ts` | One Indonesian evidence-grounded prompt, version `id-v3-evidence-v2`; no action taxonomy, recommendation block, parsing, or action score. Provider failures and blank answers fail explicitly. |
| `lib/retrieval/`, `lib/research.ts` | Fixed ten contexts, deterministic ties, equal-weight RRF with constant 60, and Precision/Recall/Hit at 5 and 10. Retrieval errors propagate, including a failed Hybrid arm. |
| `lib/eval.ts`, `scripts/run-experiment.ts` | Immutable dataset/configuration within a run ID, explicit repetition, unique successful observation key, reference snapshot, status, timestamps, failure reason, and retry lineage. Resume skips existing successes. |
| `prisma/schema.prisma`, new migration | Nullable historical action fields and additive dataset, question, run, attempt, metric, and evaluator metadata. Existing scores and scenario links survive. |
| `prisma/seed.ts`, `scripts/validate-scenarios.mjs` | Default to ID v3; validate ordered database evidence against the source; load versioned scenarios without deleting prior scenarios. Legacy action fields remain accepted. `--force` is disabled. |
| `eval-pipeline/run_ragas.py`, `lib/ragas.ts` | Canonical RAGAS 0.2.15 scoring. Both application and CLI use the Python implementation, with no alternate judge fallback or Answer Relevancy monkeypatch. |
| `app/eval/page.tsx`, eval APIs, `eval-pipeline/export_results.py` | Current run/dataset filtering, six retrieval measures, four RAGAS measures, three times, missing-score denominators, repetition summaries, and failed attempts. The former action-based composite and preset winning narratives were retired. |
| `eval-pipeline/ragas_investigasi.py` | Explicitly secondary diagnostic JSON output, separate from primary database scores and exports. |
| `scripts/research.test.ts`, `scripts/test-research-db.ts`, `eval-pipeline/test_pipeline.py` | Offline ranking/generation/gameplay fixtures, PostgreSQL migration/seed/persistence checks, and judge failure/validation checks. |

First-party response consumers were searched and updated together. The active interaction/results/scenario contracts no longer expose action recommendations or `correctnessScore`. External clients must migrate to answer text, retrieval metrics, and saved run identity. Historical nullable database columns remain. The retrospective score-explanation API returns 410, and the results deletion API returns 405 to retain research records.

## Frozen experimental settings

- All three methods receive the same question, corpus, model settings, prompt, and up to ten evidence contexts. Gold labels, references, difficulty, case solution, and prior gameplay answers never enter retrieval configuration or the generator prompt.
- Defaults actually sent: `gpt-4o-mini`, temperature `0.2`, `max_completion_tokens=1000`. Set `OPENAI_MODEL` before starting a run; changing configuration requires a new run ID. Request settings and a configuration hash are saved. Provider automatic retries are disabled for generation and retrieval embeddings; explicit attempts retain lineage.
- Sparse uses PostgreSQL `simple` text search, `ts_rank_cd`, a conjunction query, then an OR fallback only on zero conjunction results. The existing English stopword filter used to construct the OR query is frozen as `conjunction-then-zero-hit-or-english-stopwords-v1`. `simple` deliberately avoids English stemming of Indonesian text; it is not an Indonesian stemmer. Index trigger and queries use the same configuration.
- Dense uses `text-embedding-3-small`, 1536 dimensions, cosine distance. Corpus embeddings are prepared before timing questions. Missing embeddings reject Dense/Hybrid execution.
- Standalone Sparse/Dense return up to ten candidates. Hybrid requests 30 from each arm, sums `1/(60+rank)` for one-based ranks in lists containing each document, then returns ten unique contexts. No agreement bonus or asymmetric weights remain. Scores tie-break by evidence ID. Candidate depth differs from the number of contexts sent to the model and is recorded in the manifest.
- Generation and evaluation use full stored evidence text in the same order, with no previous 500-character truncation. Exact context strings and IDs are persisted; the evaluator does not reconstruct them from mutable evidence.
- Precision@K uses K as its denominator, including short results. Recall uses the distinct per-question gold set. Hit is binary per question; aggregate labels are Hit Rate@K. Empty successful retrieval is zero; missing gold or retrieval errors are failures.
- RAGAS uses `ragas==0.2.15`, judge `gpt-4o-mini` at temperature 0, and relevancy embeddings `text-embedding-3-small` at 1536 dimensions. Install the pinned requirements. Metric exceptions, NaNs, and out-of-range values are saved as missing scores with failure status, never converted to zero. Each metric mean has its own valid denominator. Retrying the judge uses saved answers/contexts/reference snapshots and does not regenerate the answer.

## Timing and reporting

All recorded durations are integer milliseconds. Retrieval starts at the retriever entry and includes query embedding for Dense/Hybrid, database queries, and fusion. Hybrid arms run concurrently, so retrieval is elapsed wall time rather than the sum of arm times. Generation measures the completion request. Total response time measures the generation function from before retrieval until answer processing/metric calculation finishes; it excludes scenario/session loading and persistence. RAGAS runs later and is outside all three measures. Failed attempts separately record elapsed attempt time.

A complete generation experiment has **270 unique successful observations**: 30 questions ? 3 methods ? 3 repetitions. Repetitions share the same questions. Failures are retained separately; a successful retry replaces no historical row. The canonical export reports mean and sample standard deviation across repetition means, with the individual repetition means and metric denominators. Three repetitions are not 90 independent questions per method. Do not claim a winner from incomplete or unmatched subsets; check all 270 generation observations and each judge metric's coverage.

## Apply the migration to an existing database

1. Take a normal PostgreSQL backup and record the current application revision and migration status. Do not run seed or reset on the populated research database to apply this change.
2. Configure `DATABASE_URL` for that database. Run:

   ```bash
   npm ci
   npx prisma generate
   npx prisma migrate status
   npx prisma migrate deploy
   ```

3. Migration `20261122000000_research_realignment` relaxes the two action-field constraints, adds nullable metadata and indexes, and rebuilds the full-text vectors/trigger with `simple`. It does not delete or reseed cases, evidence, scenarios, logs, or scores. Rebuilding vectors can take a database write lock; run during an idle period.
4. Keep historical results in place. Create a **separate empty database** for the final ID v3 experiment. The loader rejects a database whose ordered evidence differs from the frozen source.

Rollback: stop experiment/scoring processes, retain a backup/export of new runs, and revert the application change if needed. Keep this additive migration and its nullable historical columns in place; do not drop new metadata or delete new observations merely to roll back code. The old application expects required action fields, so do not run it against new action-free v3 scenarios; use the original historical database/copy. A full database restoration is appropriate only on a separate copy or after separately preserving every post-backup observation. Re-enabling CI/CD is independent of application rollback and should remain paused until the VPS is replaced.

## Prepare a fresh experiment database

Use PostgreSQL with pgvector installed. Set environment variables in the shell or `.env` for CLI tools (`.env.local` alone is Next-specific). Example PowerShell variables:

```powershell
$env:DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:5432/research_id_v3?schema=public'
$env:EVAL_SCENARIO_FILE='scenario-v3.id.json'
$env:OPENAI_MODEL='gpt-4o-mini'
npx prisma migrate deploy
npm run seed
npm run eval:validate
```

Plain seed is offline and does not create embeddings, even if an API key exists. It preserves an existing matching corpus and prior scenario versions. A partial seed must be recovered in its disposable experiment database; never use `--force` on research data.

Install the Python scorer in an isolated environment:

```powershell
python -m venv .venv-ragas
.venv-ragas/Scripts/python.exe -m pip install -r eval-pipeline/requirements.txt
$env:PYTHON=(Resolve-Path .venv-ragas/Scripts/python.exe).Path
```

Python 3.11 is recommended. Python 3.13.3 was used for the local pinned-import smoke test. The Node-only production Docker image includes the scoring files but does not bundle Python and the judge dependencies. Run offline scoring on a suitably configured host, or install the environment before using the dashboard's scoring button. Missing Python/dependencies produces an explicit failure; there is no alternate native evaluator.

## Approved paid execution, later

These commands were **not executed** during implementation. Set `OPENAI_API_KEY` in the execution environment only when approved.

```powershell
npm run embed:corpus -- --execute
$runId=[guid]::NewGuid().ToString()
npm run experiment -- --execute --run-id $runId --runs 3
$datasetVersion=(npx tsx -e "import {datasetManifest} from './lib/research'; console.log(datasetManifest().datasetVersion)").Trim()
& $env:PYTHON eval-pipeline/run_ragas.py --run-id $runId --dataset-version $datasetVersion
& $env:PYTHON eval-pipeline/export_results.py --run-id $runId --dataset-version $datasetVersion --output "eval-pipeline/results/$runId"
```

Save the run ID, code revision (`git rev-parse HEAD`), model identifiers, manifest, Python dependency freeze, and exports together. Rerun the experiment with the **same** run ID/settings to retry only missing/failed generation observations; successful identities are skipped. Judge reruns retry failed/missing evaluations; `--force` deliberately re-scores successful evaluations. Use a new run ID after changing model, prompt, corpus, labels, or configuration. The dashboard exposes the same run/repetition/scoring operations, and CSV download contains only the selected dataset/run.

## Offline verification and example

The following checks passed locally on Windows, Node 23.7.0, Python 3.13.3, and PostgreSQL 17.2:

| Command/check | Result |
|---|---|
| `npm run eval:validate` | 30 v3 scenarios valid; 150 unique evidence records |
| `npm run test:scenarios` | 7 tests pass, including legacy instruments |
| `npm run test:research` | 7 tests pass: cutoffs, duplicates, empty/missing gold, RRF ties, Q13 prompt/contexts, provider failure/retry, export, failed Hybrid arm, correct/incorrect player deduction |
| `python -m unittest discover -s eval-pipeline -p test_pipeline.py -v` | 6 tests pass: references, ordered inputs, failure/NaN handling, denominators, diagnostic exclusion, Prisma schema selector |
| `python -m py_compile eval-pipeline/run_ragas.py eval-pipeline/export_results.py eval-pipeline/ragas_investigasi.py` | Pass |
| `npx prisma generate`, `npm run typecheck`, `npm run build` | Pass |
| Canonical scorer construction with a dummy key and pinned dependencies | Pass; no provider calls |
| `npx tsx scripts/test-research-db.ts --without-pgvector` | Pass: populated migration preserves prior values/links/scores; fresh action-free seed; legacy fixture retention; idempotent reload; FTS configuration; persisted Q13 through canonical Python with a fixture judge |
| Parsed JSON comparison with PR #5 | Exact preservation except the two retired action fields |
| `git diff --check` | Pass |

For the database integration script, set `RESEARCH_TEST_DATABASE_URL` to a **disposable local cluster**, for example `postgresql://research_fixture@127.0.0.1:55439/postgres`, owned by `research_fixture`. It creates databases named `research_fixture_*` and never targets a research database. Set `RESEARCH_TEST_PYTHON` to the Python environment containing the pinned dependencies. Without `--without-pgvector`, use a cluster with pgvector installed.

**Verification limit:** Docker's daemon was unavailable and local PostgreSQL lacked pgvector. The test substituted TEXT for the old baseline's embedding column, then executed the new migration verbatim. It verifies relational migration, seed, FTS, and persistence behavior, not live Dense/pgvector search or a fresh `prisma migrate deploy` against pgvector. Paid embeddings, generation, judge calls, and the 270-observation experiment remain unexecuted. No thesis/decision-document alignment beyond the supplied PRD was independently verified.

[Q13 example JSON](research-fixtures/q13-example.json) and [example CSV row](research-fixtures/observations.csv) are **synthetic fixtures**, not research measurements. The fixture answer, 0.75 judge scores, and 2/1/3 ms times are injected. Its three gold hits yield Precision@5=0.60, Recall@5=1, Hit@5=1, Precision@10=0.30, Recall@10=1, Hit@10=1. The generator sees only its question and retrieved evidence; the reference is attached separately for offline evaluation. Reproduce its report without any service:

```powershell
$fixture=Get-Content docs/research-fixtures/q13-example.json -Raw | ConvertFrom-Json
python eval-pipeline/export_results.py --run-id offline-example-only --dataset-version $fixture[0].datasetVersion --input docs/research-fixtures/q13-example.json --output .agents/q13-export
```

## CI/CD pause

The VPS subscription expired. `.github/workflows/deploy.yml` is archived as `.github/workflows/deploy.yml.disabled`; GitHub Actions does not discover that extension. Merging this revision to master therefore removes the combined build/publish/deploy workflow, including manual dispatch. No other workflow YAML exists in this revision. No server connection or deployment is part of this handoff.

The local GitHub CLI returned 401, so the separate Actions UI disable switch could not be changed through that CLI. Repository-level removal is delivered by this merge; it requires no secret deletion or access changes. To restore CI/CD after provisioning a replacement server, review/update its host configuration, rename the archived file back to `.yml`, and deliberately re-enable the workflow in GitHub if it was also disabled there.
