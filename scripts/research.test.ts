import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { generateAIResponse, SYSTEM_PROMPT, type GenerationDependencies } from "../lib/rag"
import { retrievalMetrics, datasetManifest, requireReference } from "../lib/research"
import { fuseRanks } from "../lib/retrieval/fusion"
import { hybridRetrieve } from "../lib/retrieval/hybrid"
import { prisma } from "../lib/db"
import { publicLog, runScenario, resetEvaluationCancel } from "../lib/eval"
import { POST as submitDeduction } from "../app/api/sessions/[id]/deduction/route"

const scenarios = JSON.parse(readFileSync("eval-scenarios/scenario-v3.id.json", "utf8"))
const corpus = JSON.parse(readFileSync("cases-input/id-ID/case-1.v3.json", "utf8")).nexus_data_breach
const question = scenarios[12]
const items = [61, 62, 64].map(i => ({ ...corpus.evidence[i], id: `E${i}`, score: 1 }))
const answer = "Viktor mengaku keluar pukul 17.00 dan menyetir pulang. Rekaman lobi menunjukkan 19.15; perjalanan ke bar dimulai 19.20 dan berakhir 19.40. Identitas pengguna VPN belum dapat ditentukan."
function mockedGeneration(capture: any[] = []): GenerationDependencies {
  return {
    retrieve: async (_method, _case, _question, options) => {
      capture.push({ options })
      return { evidence: items, retrievalTimeMs: 2, embeddingTimeMs: null, candidateDepth: 10, method: "sparse" }
    },
    complete: async request => {
      capture.push(request)
      return { id: "fixture", object: "chat.completion", created: 0, model: "fixture", choices: [{ index: 0,
        finish_reason: "stop", logprobs: null, message: { role: "assistant", content: answer, refusal: null } }] }
    },
  }
}

test("fixed denominators, duplicate IDs, short/empty retrieval and missing gold", () => {
  const ids = ["X", "A", "Y", "B", "Z", "C"]
  assert.deepEqual(retrievalMetrics(ids, ["A", "B", "C"], 5), { precision: .4, recall: 2/3, hit: 1, returnedCount: 5 })
  assert.deepEqual(retrievalMetrics(ids, ["A", "B", "C"], 10), { precision: .3, recall: 1, hit: 1, returnedCount: 6 })
  assert.equal(retrievalMetrics(["A", "A", "B"], ["A", "A", "B"], 5).precision, .4)
  assert.deepEqual(retrievalMetrics([], ["A"], 5), { precision: 0, recall: 0, hit: 0, returnedCount: 0 })
  assert.throws(() => retrievalMetrics([], [], 5), /gold/)
})

test("equal-weight RRF, absent-arm zero, unique ranks and deterministic ties", () => {
  const item = (id: string) => ({ id, type: "record", category: "fixture", content: id, score: 99 })
  const rows = fuseRanks([[item("B"), item("B"), item("A")], [item("A"), item("B"), item("C")]])
  assert.deepEqual(rows.map(r => r.id), ["A", "B", "C"])
  assert.equal(rows[0].score, 1/61 + 1/62)
  assert.equal(rows[2].score, 1/63)
  assert.deepEqual(fuseRanks([[item("B")], [item("A")]]).map(r => r.id), ["A", "B"])
})

test("Q13 reaches generation with ordered lobby/travel text and no recommendation contract", async () => {
  const capture: any[] = []
  const first = await generateAIResponse(question.prompt, "case", "session", "sparse", { requiredEvidenceIds: ["E61", "E62", "E64"] }, mockedGeneration(capture))
  const second = await generateAIResponse(question.prompt, "case", "session", "sparse", { requiredEvidenceIds: ["E61"] }, mockedGeneration(capture))
  assert.deepEqual(capture[0].options, { limit: 10 })
  assert.deepEqual(capture[2].options, { limit: 10 })
  assert.deepEqual(first.retrieval.retrievedEvidenceIds, second.retrieval.retrievedEvidenceIds)
  assert.deepEqual(capture[1], capture[3])
  assert.deepEqual(first.retrieval.retrievedContextsList, items.map(i => i.content))
  assert.match(capture[1].messages[1].content, /19\.15/)
  assert.match(capture[1].messages[1].content, /19\.20/)
  assert.doesNotMatch(JSON.stringify(capture[1]), /referenceAnswer|difficulty|correctSuspect|recommendation|INTERROGATE/)
  assert.match(SYSTEM_PROMPT, /bahasa Indonesia/)
  assert.doesNotMatch(JSON.stringify(first), /correctnessScore|structuredRecommendation/)
})

test("all references validate and blank/missing references identify their question", () => {
  scenarios.forEach((s: any, i: number) => requireReference(s.referenceAnswer, `Q${i + 1}`))
  assert.throws(() => requireReference(" ", "Q13"), /Q13.*missing referenceAnswer/)
  assert.throws(() => requireReference(undefined, "Q13"), /Q13/)
})

test("provider failure is persisted separately; retry lineage and duplicate successful observations", async () => {
  resetEvaluationCancel()
  const rows: any[] = []
  const manifest = datasetManifest()
  const scenario = { id: "Q13", questionId: "Q13", datasetVersion: manifest.datasetVersion, caseId: "case",
    ...question, requiredEvidenceIds: items.map(i => i.id) }
  const db: any = {
    evaluationScenario: { findUnique: async () => scenario },
    investigationSession: { create: async () => ({ id: "session" }) },
    aIInteractionLog: {
      findUnique: async ({ where }: any) => rows.find(r => r.observationKey === where.observationKey),
      findFirst: async () => rows[rows.length - 1],
      create: async ({ data }: any) => { const row = { ...data, id: `attempt-${rows.length + 1}` }; rows.push(row); return row },
      update: async ({ where, data }: any) => Object.assign(rows.find(r => r.id === where.id), data),
    },
  }
  const identity = { runId: "offline-fixture", repetition: 1 }
  await assert.rejects(runScenario("Q13", "sparse", undefined, identity, { db, generate: async () => { throw new Error("Provider unavailable") } }), /Provider unavailable/)
  assert.equal(rows[0].status, "failed")
  assert.equal(rows[0].observationKey, undefined)
  await runScenario("Q13", "sparse", undefined, identity, { db,
    generate: (prompt, caseId, sessionId, method, options) => generateAIResponse(prompt, caseId, sessionId, method, options, mockedGeneration()) })
  assert.equal(rows[1].status, "succeeded")
  assert.equal(rows[1].retryOf, rows[0].id)
  assert.equal(rows[1].attempt, 2)
  await assert.rejects(runScenario("Q13", "sparse", undefined, identity, { db, generate: generateAIResponse }), /already exists/)
  const originalModel = process.env.OPENAI_MODEL
  process.env.OPENAI_MODEL = "changed-model-fixture"
  try {
    await assert.rejects(runScenario("Q13", "sparse", undefined, { ...identity, repetition: 2 }, { db, generate: generateAIResponse }), /configuration\/dataset changed/)
  } finally {
    if (originalModel === undefined) delete process.env.OPENAI_MODEL
    else process.env.OPENAI_MODEL = originalModel
  }
  const output = publicLog({ ...rows[1], correctnessScore: 1, structuredRecommendation: { action: "historical" } })
  assert(!("correctnessScore" in output)); assert(!("structuredRecommendation" in output))
  // The real export entry point consumes the saved application contexts, not reconstructed evidence.
  const folder = mkdtempSync(join(tmpdir(), "research-export-"))
  try {
    const input = join(folder, "logs.json")
    writeFileSync(input, JSON.stringify(rows))
    const result = spawnSync("python", ["eval-pipeline/export_results.py", "--run-id", identity.runId,
      "--dataset-version", manifest.datasetVersion, "--input", input, "--output", folder], { encoding: "utf8", windowsHide: true })
    assert.equal(result.status, 0, result.stderr)
    const csv = readFileSync(join(folder, "observations.csv"), "utf8")
    const report = readFileSync(join(folder, "report.md"), "utf8")
    assert.doesNotMatch(csv + report, /correctnessScore|structuredRecommendation|expectedActions/)
    for (const metric of ["precisionAt5", "recallAt5", "hitRateAt5", "precisionAt10", "recallAt10", "hitRateAt10", "faithfulness", "answerRelevance", "contextPrecision", "contextRecall", "retrievalTimeMs", "llmResponseTimeMs", "totalResponseTimeMs"]) assert(report.includes(metric))
    const summary = JSON.parse(readFileSync(join(folder, "summary.json"), "utf8"))
    assert.equal(summary[0].successful, 1)
    assert.equal(summary[0].failedAttempts, 1)
    assert.equal(summary[0].faithfulness.n, 0)
    assert.equal(summary[0].precisionAt5.mean, .6)
  } finally { rmSync(folder, { recursive: true }) }
})

test("Hybrid rejects when one retrieval arm fails", async () => {
  await assert.rejects(hybridRetrieve("case", "fixture", undefined, {
    sparseRetrieve: async () => { throw new Error("Sparse retrieval failed") },
    denseRetrieve: async () => ({ method: "dense", evidence: items, retrievalTimeMs: 1, embeddingTimeMs: 1, candidateDepth: 30 }),
  }), /Sparse retrieval failed/)

})

test("player suspect deduction still reports both correct and incorrect submissions", async () => {
  const originalFind = prisma.investigationSession.findUnique
  const originalCreate = prisma.deduction.create
  ;(prisma.investigationSession as any).findUnique = async () => ({ id: "session", deduction: null,
    case: { groundTruth: { correctSuspectId: "correct", contradictionPairs: [], relevantEvidenceIds: [] }, suspects: [{ id: "correct", name: "Correct" }, { id: "other", name: "Other" }] } })
  ;(prisma.deduction as any).create = async ({ data }: any) => ({ ...data, id: "deduction" })
  try {
    for (const suspectId of ["correct", "other"]) {
      const result = await submitDeduction(new Request("http://localhost/api/sessions/session/deduction", { method: "POST", body: JSON.stringify({ suspectId, reasoning: "Fixture" }) }), { params: Promise.resolve({ id: "session" }) })
      assert.equal(result.status, 200)
      assert.equal((await result.json()).isCorrect, suspectId === "correct")
    }
  } finally {
    ;(prisma.investigationSession as any).findUnique = originalFind
    ;(prisma.deduction as any).create = originalCreate
  }
})
