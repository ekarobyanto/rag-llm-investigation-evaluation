/** Isolated PostgreSQL migration/seed integration. No paid providers.
 * RESEARCH_TEST_DATABASE_URL must point at a disposable local cluster owned by research_fixture.
 * --without-pgvector substitutes TEXT only in the old baseline embedding column;
 * the new migration itself always runs verbatim. Dense search is not tested in that mode.
 */
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
const require = createRequire(import.meta.url)
const { Client } = require("pg")
async function main() {
  const connection = process.env.RESEARCH_TEST_DATABASE_URL
  if (!connection) throw new Error("RESEARCH_TEST_DATABASE_URL required; never use a research/production database")
  const url = new URL(connection)
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.username !== "research_fixture" || url.pathname !== "/postgres") throw new Error("Only the disposable local research_fixture cluster is permitted")
  const withoutVector = process.argv.includes("--without-pgvector")
  const migration = "20261122000000_research_realignment"
  const baseline = readdirSync("prisma/migrations").filter(n => /^\d/.test(n) && n < migration).sort()
  const admin = new Client({ connectionString: connection }); await admin.connect()
  const databases: string[] = []
  async function database(suffix: string) {
    const name = `research_fixture_${suffix}_${Date.now()}`
    await admin.query(`CREATE DATABASE "${name}"`); databases.push(name)
    const target = new URL(url); target.pathname = `/${name}`
    const db = new Client({ connectionString: target.toString() }); await db.connect()
    for (const name of baseline) {
      let sql = readFileSync(join("prisma/migrations", name, "migration.sql"), "utf8")
      if (withoutVector) sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "vector";', "").replace(/vector\(1536\)/g, "TEXT")
      await db.query(sql)
    }
    return { db, connection: target.toString() }
  }
  const historical = await database("historical")
  try {
    await historical.db.query(`
      INSERT INTO cases (id,title,description,"updatedAt") VALUES ('old-case','Historical','Preserve',NOW());
      INSERT INTO suspects (id,"caseId",name,profile) VALUES ('suspect','old-case','Suspect','Historical');
      INSERT INTO evidence (id,"caseId",type,content) VALUES ('evidence','old-case','record','Dokumen lama');
      INSERT INTO case_ground_truth (id,"caseId","correctSuspectId","contradictionPairs","relevantEvidenceIds","optimalNextActions")
        VALUES ('truth','old-case','suspect','[]','["evidence"]','[{"action_type":"EXAMINE_EVIDENCE"}]');
      INSERT INTO evaluation_scenarios (id,"caseId",prompt,difficulty,"requiredEvidenceIds","expectedActions","referenceAnswer")
        VALUES ('old-question','old-case','Legacy question','easy','["evidence"]','[{"action_type":"EXAMINE_EVIDENCE"}]','Legacy reference');
      INSERT INTO investigation_sessions (id,"caseId","updatedAt") VALUES ('session','old-case',NOW());
      INSERT INTO ai_interaction_logs (id,"sessionId","caseId","scenarioId","userPrompt","aiResponse","llmResponseTimeMs","totalResponseTimeMs","promptTokens","completionTokens","totalTokens","correctnessScore")
        VALUES ('old-log','session','old-case','old-question','Question','Answer',2,3,4,5,9,.75);
      INSERT INTO ragas_evaluations (id,"logId",faithfulness) VALUES ('old-judge','old-log',.875);
    `)
    const tables = ["cases", "case_ground_truth", "evaluation_scenarios", "ai_interaction_logs", "ragas_evaluations"]
    const before: Record<string, any[]> = {}
    for (const table of tables) before[table] = (await historical.db.query(`SELECT * FROM ${table}`)).rows
    await historical.db.query(readFileSync(join("prisma/migrations", migration, "migration.sql"), "utf8"))
    for (const table of tables) {
      const after = (await historical.db.query(`SELECT * FROM ${table}`)).rows
      assert.equal(after.length, before[table].length)
      for (const key of Object.keys(before[table][0])) assert.deepEqual(after[0][key], before[table][0][key], `${table}.${key} must survive`)
    }
    console.log("PASS populated PostgreSQL migration preserves historical rows, actions, links and scores")
  } finally { await historical.db.end() }
  const fresh = await database("fresh")
  try {
    await fresh.db.query(readFileSync(join("prisma/migrations", migration, "migration.sql"), "utf8"))
    const seeded = spawnSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env: { ...process.env, DATABASE_URL: fresh.connection,
      EVAL_SCENARIO_FILE: "scenario-v3.id.json", OPENAI_API_KEY: "" }, encoding: "utf8", windowsHide: true })
    assert.equal(seeded.status, 0, seeded.stderr + seeded.stdout)
    assert.equal((await fresh.db.query('SELECT COUNT(*)::int AS count FROM evidence')).rows[0].count, 150)
    assert.equal((await fresh.db.query('SELECT COUNT(*)::int AS count FROM evaluation_scenarios WHERE "expectedActions" IS NULL')).rows[0].count, 30)
    assert.equal((await fresh.db.query('SELECT COUNT(*)::int AS count FROM case_ground_truth WHERE "optimalNextActions" IS NULL')).rows[0].count, 1)
    const caseId = (await fresh.db.query('SELECT id FROM cases')).rows[0].id
    await fresh.db.query(`INSERT INTO evaluation_scenarios (id,"caseId",prompt,difficulty,"requiredEvidenceIds","expectedActions","referenceAnswer")
      VALUES ('legacy-fixture',$1,'Legacy fixture','easy','[]','[]','Reference')`, [caseId])
    const reseeded = spawnSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { env: { ...process.env, DATABASE_URL: fresh.connection,
      EVAL_SCENARIO_FILE: "scenario-v3.id.json", OPENAI_API_KEY: "" }, encoding: "utf8", windowsHide: true })
    assert.equal(reseeded.status, 0, reseeded.stderr + reseeded.stdout)
    assert.equal((await fresh.db.query('SELECT COUNT(*)::int AS count FROM evaluation_scenarios')).rows[0].count, 31)
    assert.equal((await fresh.db.query(`SELECT COUNT(*)::int AS count FROM evidence WHERE search_vector IS DISTINCT FROM to_tsvector('simple',content)`)).rows[0].count, 0)
    process.env.DATABASE_URL = fresh.connection
    const { seedScenarios, runScenario } = await import("../lib/eval")
    assert.equal((await seedScenarios()).created, 0)
    const { sparseRetrieve } = await import("../lib/retrieval/sparse")
    const retrieved = await sparseRetrieve(caseId, "Viktor lobi")
    assert(retrieved.evidence.length > 0)
    const { prisma } = await import("../lib/db")
    const scenario = await prisma.evaluationScenario.findFirstOrThrow({ where: { questionId: "Q13" } })
    const evidence = await prisma.evidence.findMany({ where: { caseId }, orderBy: { createdAt: "asc" } })
    const fixed = [61, 62, 64].map(i => ({ ...evidence[i], score: 1 }))
    const { generateAIResponse } = await import("../lib/rag")
    const result = await runScenario(scenario.id, "sparse", undefined, { runId: "db-fixture", repetition: 1 }, {
      db: prisma, generate: (prompt, caseId, sessionId, method, options) => generateAIResponse(prompt, caseId, sessionId, method, options, {
        retrieve: async () => ({ evidence: fixed, retrievalTimeMs: 2, embeddingTimeMs: null, candidateDepth: 10, method: "sparse" }),
        complete: async () => ({ id: "fixture", model: "fixture", object: "chat.completion", created: 0,
          choices: [{ index: 0, finish_reason: "stop", logprobs: null, message: { role: "assistant", content: "Catatan lobi pukul 19.15 dan perjalanan ke bar pukul 19.20 bertentangan dengan cerita pulang Viktor.", refusal: null } }] }),
      }),
    })
    const { datasetManifest } = await import("../lib/research")
    const python = process.env.RESEARCH_TEST_PYTHON || "python"
    // Invoke the real canonical query/persistence path with a fixture judge, never a provider.
    const judge = spawnSync(python, ["-c", `import os,sys; sys.path.insert(0,'eval-pipeline'); import run_ragas; run_ragas.make_scorer=lambda: (lambda sample,metric: 0.75); sys.argv=['run_ragas.py','--run-id','db-fixture','--dataset-version',${JSON.stringify(datasetManifest().datasetVersion)}]; run_ragas.main()`],
      { env: { ...process.env, DATABASE_URL: fresh.connection + "?schema=public", OPENAI_API_KEY: "" }, encoding: "utf8", windowsHide: true })
    assert.equal(judge.status, 0, judge.stderr + judge.stdout)
    const scored = await prisma.ragasEvaluation.findUniqueOrThrow({ where: { logId: result.logId } })
    assert.equal(scored.evaluatorVersion, "ragas-0.2.15")
    assert.equal(scored.contextRecall, .75)
    console.log("PASS persisted Q13 generation -> canonical Python query/judge fixture -> saved primary scores")
    await prisma.$disconnect()
    console.log("PASS fresh action-free v3 seed, legacy fixture, idempotent loading, FTS trigger/query")
  } finally { await fresh.db.end(); await admin.end() }
  console.log(withoutVector ? "LIMITATION: pgvector unavailable; baseline embedding column was TEXT. New migration ran verbatim; Dense/vector search not tested." : "PostgreSQL + pgvector migration integration passed")
}
main().catch(error => { console.error(error); process.exitCode = 1 })
