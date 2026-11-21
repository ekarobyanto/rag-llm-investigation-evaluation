import { prisma } from "./db"
import { Prisma } from "@prisma/client"
import { generateAIResponse } from "./rag"
import type { RetrievalMethod } from "./retrieval"
import { readFileSync } from "fs"
import { join } from "path"
import { randomUUID, createHash } from "crypto"
import { broadcastWSEvent } from "./ws"
import { datasetManifest, SCENARIO_FILE, requireReference, finiteMean, PROMPT_VERSION, PRIMARY_EVALUATOR, CONTEXT_LIMIT, CANDIDATE_DEPTH, EMBEDDING_MODEL, FTS_CONFIG, frozenRunConfig, generationSettings } from "./research"
import { validateScenarios } from "../scripts/validate-scenarios.mjs"

export interface ScenarioInputFile {
  caseTitle: string
  prompt: string
  difficulty: "easy" | "medium" | "hard"
  requiredEvidenceIndices: number[]
  expectedActions?: Array<{ action_type: string; target: string }>
  expectedContradictions?: Array<{ evidence_index_a: number; evidence_index_b: number }>
  referenceAnswer?: string
  notes?: string
}
export interface ScenarioSeedSummary { total: number; created: number; skipped: number; errors: string[] }
export const EVAL_SCENARIO_FILE = SCENARIO_FILE
export async function loadScenarioFiles(): Promise<ScenarioInputFile[]> {
  return JSON.parse(readFileSync(join(process.cwd(), "eval-scenarios", SCENARIO_FILE), "utf8"))
}
export async function seedScenarios(): Promise<ScenarioSeedSummary> {
  const manifest = datasetManifest()
  const files = await loadScenarioFiles()
  const source = JSON.parse(readFileSync(join(process.cwd(), "cases-input", manifest.caseFile), "utf8"))
  validateScenarios(files, source)
  const summary: ScenarioSeedSummary = { total: files.length, created: 0, skipped: 0, errors: [] }
  for (const [index, s] of files.entries()) {
    const questionId = `Q${String(index + 1).padStart(2, "0")}`
    const id = createHash("sha256").update(`${manifest.datasetVersion}:${questionId}`).digest("hex")
    const cases = await prisma.case.findMany({ where: { title: s.caseTitle }, include: { evidence: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } })
    if (cases.length !== 1) throw new Error(`${questionId}: case title must resolve uniquely in database`)
    const caseRow = cases[0]
    const corpus = source.case ? source : Object.values(source).find((c: any) => c.case?.title === s.caseTitle) as any
    if (caseRow.evidence.length !== corpus.evidence.length || caseRow.evidence.some((e, i) => e.content !== corpus.evidence[i].content)) {
      throw new Error(`${questionId}: database corpus/order differs from the frozen dataset; use an isolated database`)
    }
    const existing = await prisma.evaluationScenario.findUnique({ where: { id } })
    if (existing) {
      const expectedIds = s.requiredEvidenceIndices.map(i => caseRow.evidence[i].id)
      const expectedPairs = (s.expectedContradictions ?? []).map(c => ({ evidence_id_a: caseRow.evidence[c.evidence_index_a].id, evidence_id_b: caseRow.evidence[c.evidence_index_b].id }))
      if (existing.prompt !== s.prompt || existing.referenceAnswer !== s.referenceAnswer ||
          JSON.stringify(existing.requiredEvidenceIds) !== JSON.stringify(expectedIds) ||
          JSON.stringify(existing.expectedContradictions) !== JSON.stringify(expectedPairs)) {
        throw new Error(`${questionId}: stored scenario differs from frozen labels/reference; use a new dataset identity`)
      }
      summary.skipped++; continue
    }
    await prisma.evaluationScenario.create({ data: {
      id, datasetVersion: manifest.datasetVersion, questionId, caseId: caseRow.id, prompt: s.prompt, difficulty: s.difficulty,
      requiredEvidenceIds: s.requiredEvidenceIndices.map(i => caseRow.evidence[i].id),
      expectedContradictions: (s.expectedContradictions ?? []).map(c => ({ evidence_id_a: caseRow.evidence[c.evidence_index_a].id, evidence_id_b: caseRow.evidence[c.evidence_index_b].id })),
      referenceAnswer: requireReference(s.referenceAnswer, questionId), notes: s.notes,
    } })
    summary.created++
  }
  return summary
}
export interface RunResult {
  scenarioId: string; retrievalMethod: RetrievalMethod; logId: string; runId: string
  retrievalMetrics: unknown; totalResponseTimeMs: number; totalTokens: number
}
export interface RunIdentity { runId: string; repetition: number }
export async function runScenario(scenarioId: string, retrievalMethod: RetrievalMethod, signal?: AbortSignal,
  identity: RunIdentity = { runId: randomUUID(), repetition: 1 },
  deps = { db: prisma, generate: generateAIResponse }): Promise<RunResult> {
  const checkCancelled = () => { if (isEvaluationCancelled() || signal?.aborted) throw new Error("Evaluation cancelled by user") }
  checkCancelled()
  if (!identity.runId.trim() || !Number.isInteger(identity.repetition) || identity.repetition < 1 || identity.repetition > 3) throw new Error("Invalid run identity/repetition")
  const manifest = datasetManifest()
  const scenario = await deps.db.evaluationScenario.findUnique({ where: { id: scenarioId } })
  if (!scenario || scenario.datasetVersion !== manifest.datasetVersion) throw new Error(`Scenario ${scenarioId} is not in the selected dataset`)
  const reference = requireReference(scenario.referenceAnswer, scenario.questionId || scenario.id)
  const gold = scenario.requiredEvidenceIds as string[]
  if (!Array.isArray(gold) || !gold.length) throw new Error(`Scenario ${scenarioId}: missing gold labels`)
  const key = `${identity.runId}:${manifest.datasetVersion}:${scenarioId}:${retrievalMethod}:${identity.repetition}`
  if (await deps.db.aIInteractionLog.findUnique({ where: { observationKey: key } })) throw new Error("Successful observation already exists; use a new run ID")
  const runConfig = frozenRunConfig()
  const runConfigHash = createHash("sha256").update(JSON.stringify(runConfig)).digest("hex")
  const existingRun = await deps.db.aIInteractionLog.findFirst({ where: { runId: identity.runId }, orderBy: { createdAt: "asc" } })
  if (existingRun && (existingRun.datasetVersion !== manifest.datasetVersion ||
      (existingRun.runManifest as any)?.runConfigHash !== runConfigHash)) throw new Error("Run configuration/dataset changed; use a new run ID")
  const previous = await deps.db.aIInteractionLog.findFirst({ where: { runId: identity.runId, scenarioId, retrievalMethod, repetition: identity.repetition }, orderBy: { createdAt: "desc" } })
  const session = await deps.db.investigationSession.create({ data: { caseId: scenario.caseId, retrievalMethod } })
  const log = await deps.db.aIInteractionLog.create({ data: {
    sessionId: session.id, caseId: scenario.caseId, scenarioId, retrievalMethod, userPrompt: scenario.prompt,
    aiResponse: "", llmResponseTimeMs: 0, totalResponseTimeMs: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0,
    datasetVersion: manifest.datasetVersion, runId: identity.runId, repetition: identity.repetition,
    attempt: (previous?.attempt ?? 0) + 1, retryOf: previous?.id, status: "started", referenceAnswerSnapshot: reference,
    promptTemplateVersion: PROMPT_VERSION, modelSettings: generationSettings(), runManifest: { ...manifest, runConfig, runConfigHash, candidateDepth: retrievalMethod === "hybrid" ? CANDIDATE_DEPTH : CONTEXT_LIMIT,
      embeddingModel: EMBEDDING_MODEL, embeddingDimensions: 1536, ftsConfig: FTS_CONFIG, contextPolicy: "full-evidence-text", historyPolicy: "none" },
  } })
  const start = performance.now()
  try {
    const result = await deps.generate(scenario.prompt, scenario.caseId, session.id, retrievalMethod, { requiredEvidenceIds: gold, temperature: 0.2 })
    checkCancelled()
    const saved = await deps.db.aIInteractionLog.update({ where: { id: log.id }, data: {
      status: "succeeded", observationKey: key, finishedAt: new Date(), aiResponse: result.response,
      retrievedContext: result.context, retrievedContextsList: result.retrieval.retrievedContextsList,
      retrievedEvidenceIds: result.retrieval.retrievedEvidenceIds, retrievalScores: result.retrieval.retrievalScores,
      retrievalMetrics: result.retrieval.metrics ?? Prisma.JsonNull, modelSettings: result.modelSettings,
      retrievalSuccess: true, sparseScores: result.retrieval.sparseScores, denseScores: result.retrieval.denseScores,
      fusionScores: result.retrieval.fusionScores, fusionMethod: result.retrieval.fusionMethod,
      embeddingTimeMs: result.timings.embeddingTimeMs, retrievalTimeMs: result.timings.retrievalTimeMs,
      llmResponseTimeMs: result.timings.llmResponseTimeMs, totalResponseTimeMs: result.timings.totalResponseTimeMs,
      promptTokens: result.tokens.prompt, completionTokens: result.tokens.completion, totalTokens: result.tokens.total,
    } })
    broadcastWSEvent({ type: "LOG_CREATED", log: publicLog(saved) })
    return { scenarioId, retrievalMethod, logId: log.id, runId: identity.runId, retrievalMetrics: result.retrieval.metrics,
      totalResponseTimeMs: result.timings.totalResponseTimeMs, totalTokens: result.tokens.total }
  } catch (error) {
    await deps.db.aIInteractionLog.update({ where: { id: log.id }, data: { status: "failed", finishedAt: new Date(),
      totalResponseTimeMs: Math.round(performance.now() - start), failureReason: error instanceof Error ? error.message : String(error) } })
    throw error
  }
}
/** Historical nullable columns stay in storage, but never enter current response contracts. */
export function publicLog<T extends object>(log: T) {
  const { correctnessScore, structuredRecommendation, retrievalPrecision, retrievalRecall, topKAccuracy, ...active } = log as T & Record<string, unknown>
  return active
}
export async function selectedScope(runId?: string) {
  const datasetVersion = datasetManifest().datasetVersion
  if (!runId) {
    const latest = await prisma.aIInteractionLog.findFirst({ where: { datasetVersion, runId: { not: null } }, orderBy: { createdAt: "desc" } })
    runId = latest?.runId || undefined
  }
  return { datasetVersion, runId: runId || "__no_current_run__" }
}
export interface EvaluationStatus {
  isRunning: boolean
  label?: string
  startedAt?: number
  type?: "benchmark" | "ragas" | "single"
  currentScenario?: number
  totalScenarios?: number
  completedRuns?: number
  totalRuns?: number
  activeMethods?: RetrievalMethod[]
}

const ALL_METHODS: RetrievalMethod[] = ["sparse", "dense", "hybrid"]

declare global {
  // eslint-disable-next-line no-var
  var __evalCancelRequested: boolean | undefined
  // eslint-disable-next-line no-var
  var __evalAbortController: AbortController | undefined
  // eslint-disable-next-line no-var
  var __evalActiveState: EvaluationStatus | undefined
  // eslint-disable-next-line no-var
  var __ragasChildProcess: any | undefined
}

export function setActiveEvaluationStatus(status: Partial<EvaluationStatus>): void {
  globalThis.__evalActiveState = {
    ...(globalThis.__evalActiveState ?? { isRunning: false }),
    ...status,
  }
  broadcastWSEvent({ type: "STATUS_UPDATE", status: globalThis.__evalActiveState })
}

export function getActiveEvaluationStatus(): EvaluationStatus {
  return globalThis.__evalActiveState ?? { isRunning: false }
}

export function cancelEvaluation(): void {
  globalThis.__evalCancelRequested = true
  if (globalThis.__evalAbortController) {
    try {
      globalThis.__evalAbortController.abort()
    } catch {
      // ignore
    }
  }
  if (globalThis.__ragasChildProcess) {
    try {
      globalThis.__ragasChildProcess.kill("SIGTERM")
      globalThis.__ragasChildProcess.kill("SIGINT")
    } catch {
      // ignore
    }
    globalThis.__ragasChildProcess = undefined
  }
  globalThis.__evalActiveState = { isRunning: false }
}

export function resetEvaluationCancel(): void {
  globalThis.__evalCancelRequested = false
  globalThis.__evalAbortController = new AbortController()
}

export function isEvaluationCancelled(): boolean {
  return Boolean(globalThis.__evalCancelRequested)
}

export function getEvaluationSignal(): AbortSignal | undefined {
  return globalThis.__evalAbortController?.signal
}

export async function runAllScenarios(
  methods: RetrievalMethod[] = ALL_METHODS,
  signal?: AbortSignal,
  options?: {
    runId?: string
    repetition?: number
    limit?: number
    scenarioIds?: string[]
    difficulty?: string
    balanced?: boolean
  }
): Promise<{
  results: RunResult[]
  totalDurationMs: number
  runId: string
  failedAttempts: number
  cancelled?: boolean
}> {
  resetEvaluationCancel()
  const runId = options?.runId || randomUUID()
  const manifest = datasetManifest()
  await seedScenarios() // Validates the complete frozen corpus, labels and references before generation.
  if (methods.some(m => m === "dense" || m === "hybrid")) {
    const coverage = await prisma.$queryRaw<Array<{ missing: bigint }>>`
      SELECT COUNT(*) AS missing FROM evidence e JOIN evaluation_scenarios s ON s."caseId" = e."caseId"
      WHERE s."datasetVersion" = ${manifest.datasetVersion} AND e.embedding IS NULL
    `
    if (Number(coverage[0]?.missing)) throw new Error("Dense/Hybrid requires complete precomputed corpus embeddings; run the explicitly approved embedding step first")
  }
  let scenarios = await prisma.evaluationScenario.findMany({
    where: { datasetVersion: manifest.datasetVersion },
    orderBy: { createdAt: "asc" },
  })

  // Apply batch filters if requested
  if (options?.scenarioIds && options.scenarioIds.length > 0) {
    const idSet = new Set(options.scenarioIds)
    scenarios = scenarios.filter((s) => idSet.has(s.id))
  } else if (options?.difficulty && options.difficulty !== "all") {
    scenarios = scenarios.filter((s) => s.difficulty === options.difficulty)
    if (options?.limit && options.limit > 0) {
      scenarios = scenarios.slice(0, options.limit)
    }
  } else if (options?.balanced && options?.limit && options.limit > 0) {
    // Pick an even distribution of easy, medium, hard
    const easy = scenarios.filter((s) => s.difficulty === "easy")
    const med = scenarios.filter((s) => s.difficulty === "medium")
    const hard = scenarios.filter((s) => s.difficulty === "hard")
    const perTier = Math.max(1, Math.floor(options.limit / 3))
    const selected = [
      ...easy.slice(0, perTier),
      ...med.slice(0, perTier),
      ...hard.slice(0, perTier),
    ]
    if (selected.length < options.limit) {
      const selectedIds = new Set(selected.map((s) => s.id))
      for (const s of scenarios) {
        if (!selectedIds.has(s.id)) {
          selected.push(s)
          if (selected.length >= options.limit) break
        }
      }
    }
    scenarios = selected.slice(0, options.limit)
  } else if (options?.limit && options.limit > 0) {
    scenarios = scenarios.slice(0, options.limit)
  }

  if (!scenarios.length) throw new Error("No scenarios in selected dataset/filter")
  const results: RunResult[] = []
  const start = Date.now()
  let cancelled = false
  let failedAttempts = 0

  const methodLabel = methods.length === 3 ? "All 3 Engines (Sparse, Dense, Hybrid)" : methods.join(", ")
  const isBatch = Boolean(options?.limit || options?.scenarioIds || (options?.difficulty && options.difficulty !== "all"))
  const runTypeLabel = isBatch ? `Batch Test (${scenarios.length} Scenarios)` : "Benchmark Pipeline"
  const totalRuns = scenarios.length * methods.length

  setActiveEvaluationStatus({
    isRunning: true,
    label: `Running ${runTypeLabel} (${methodLabel})...`,
    startedAt: start,
    type: "benchmark",
    currentScenario: 0,
    totalScenarios: scenarios.length,
    completedRuns: 0,
    totalRuns,
    activeMethods: methods,
  })

  try {
    const checkCancelled = () =>
      isEvaluationCancelled() ||
      Boolean(globalThis.__evalAbortController?.signal?.aborted) || Boolean(signal?.aborted)

    let scenarioIndex = 0
    for (const s of scenarios) {
      if (checkCancelled()) {
        cancelled = true
        break
      }
      scenarioIndex++
      for (const method of methods) {
        if (checkCancelled()) {
          cancelled = true
          break
        }
        try {
          const successful = await prisma.aIInteractionLog.findFirst({ where: { runId, datasetVersion: manifest.datasetVersion,
            scenarioId: s.id, retrievalMethod: method, repetition: options?.repetition ?? 1, status: "succeeded" } })
          if (successful) continue // Resume only missing/failed observations; never regenerate a success.
          const runRes = await runScenario(s.id, method, signal, { runId, repetition: options?.repetition ?? 1 })
          results.push(runRes)
          setActiveEvaluationStatus({
            currentScenario: scenarioIndex,
            completedRuns: results.length,
            label: `Running ${runTypeLabel} (${results.length}/${totalRuns} runs)...`,
          })
        } catch (e) {
          if (checkCancelled()) {
            cancelled = true
            break
          }
          failedAttempts++
          console.error(`Scenario ${s.id} ${method} failed:`, e)
        }
      }
    }

    return { results, totalDurationMs: Date.now() - start, runId, failedAttempts, cancelled }
  } finally {
    setActiveEvaluationStatus({ isRunning: false })
  }
}


export async function aggregateMetrics(runId?: string) {
  const scope = await selectedScope(runId)
  const logs = await prisma.aIInteractionLog.findMany({ where: { ...scope, status: "succeeded" } })
  const all = await prisma.aIInteractionLog.findMany({ where: scope })
  return ALL_METHODS.map(retrievalMethod => {
    const rows = logs.filter(l => l.retrievalMethod === retrievalMethod)
    const avg = (fn: (l: typeof rows[number]) => number | null | undefined) => finiteMean(rows.map(fn))
    const at = (k: string, name: string) => avg(l => (l.retrievalMetrics as any)?.[k]?.[name])
    const repetitions = [1, 2, 3].map(repetition => {
      const rr = rows.filter(l => l.repetition === repetition)
      return { repetition, count: rr.length, precisionAt5: finiteMean(rr.map(l => (l.retrievalMetrics as any)?.at5.precision)),
        recallAt10: finiteMean(rr.map(l => (l.retrievalMetrics as any)?.at10.recall)),
        totalResponseTimeMs: finiteMean(rr.map(l => l.totalResponseTimeMs)) }
    })
    return { ...scope, retrievalMethod, count: rows.length, failedAttempts: all.filter(l => l.retrievalMethod === retrievalMethod && l.status === "failed").length,
      precisionAt5: at("at5", "precision"), recallAt5: at("at5", "recall"), hitRateAt5: at("at5", "hit"),
      precisionAt10: at("at10", "precision"), recallAt10: at("at10", "recall"), hitRateAt10: at("at10", "hit"),
      returnedCount: at("at10", "returnedCount"), retrievalTimeMs: avg(l => l.retrievalTimeMs),
      llmResponseTimeMs: avg(l => l.llmResponseTimeMs), totalResponseTimeMs: avg(l => l.totalResponseTimeMs), repetitions }
  })
}
export async function aggregateRagasMetrics(runId?: string) {
  const scope = await selectedScope(runId)
  const logs = await prisma.aIInteractionLog.findMany({ where: { ...scope, status: "succeeded", ragasEvaluation: { is: { evaluatorVersion: PRIMARY_EVALUATOR } } },
    include: { ragasEvaluation: true, scenario: { select: { difficulty: true } } } })
  const summarize = (rows: typeof logs, retrievalMethod: RetrievalMethod) => {
    const metrics = ["faithfulness", "answerRelevance", "contextPrecision", "contextRecall"] as const
    const scores = Object.fromEntries(metrics.map(metric => [metric, finiteMean(rows.map(l => l.ragasEvaluation?.[metric]))]))
    const denominators = Object.fromEntries(metrics.map(metric => [metric, rows.filter(l => Number.isFinite(l.ragasEvaluation?.[metric]) && l.ragasEvaluation?.[metric] !== null).length]))
    return { retrievalMethod, count: rows.length, ...scores, denominators }
  }
  return { overall: ALL_METHODS.map(m => summarize(logs.filter(l => l.retrievalMethod === m), m)),
    byDifficulty: ALL_METHODS.flatMap(m => ["easy", "medium", "hard"].map(difficulty => ({ ...summarize(logs.filter(l => l.retrievalMethod === m && l.scenario?.difficulty === difficulty), m), difficulty }))) }
}
