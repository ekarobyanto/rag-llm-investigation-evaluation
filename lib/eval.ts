import { prisma } from "./db"
import { generateAIResponse } from "./rag"
import type { RetrievalMethod } from "./retrieval"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"
import { broadcastWSEvent } from "./ws"

export interface ScenarioInputFile {
  caseTitle: string
  prompt: string
  difficulty: "easy" | "medium" | "hard"
  requiredEvidenceIndices: number[]
  expectedActions: Array<{ action_type: string; target: string }>
  expectedContradictions?: Array<{ evidence_index_a: number; evidence_index_b: number }>
  referenceAnswer?: string
  notes?: string
}

export interface ScenarioSeedSummary {
  total: number
  created: number
  skipped: number
  errors: string[]
}

export async function loadScenarioFiles(): Promise<ScenarioInputFile[]> {
  const dir = join(process.cwd(), "eval-scenarios")
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"))
  const out: ScenarioInputFile[] = []
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(dir, f), "utf8"))
    if (Array.isArray(raw)) out.push(...raw)
    else out.push(raw)
  }
  return out
}

export async function seedScenarios(): Promise<ScenarioSeedSummary> {
  const files = await loadScenarioFiles()
  const summary: ScenarioSeedSummary = { total: files.length, created: 0, skipped: 0, errors: [] }

  await prisma.evaluationScenario.deleteMany()

  for (const s of files) {
    try {
      const caseRow = await prisma.case.findFirst({
        where: { title: s.caseTitle },
        include: { evidence: { orderBy: { createdAt: "asc" } } },
      })
      if (!caseRow) {
        summary.skipped++
        summary.errors.push(`Case not found: ${s.caseTitle}`)
        continue
      }

      const requiredEvidenceIds = s.requiredEvidenceIndices
        .map((i) => caseRow.evidence[i]?.id)
        .filter(Boolean) as string[]

      const expectedContradictions = (s.expectedContradictions ?? []).map((c) => ({
        evidence_id_a: caseRow.evidence[c.evidence_index_a]?.id,
        evidence_id_b: caseRow.evidence[c.evidence_index_b]?.id,
      }))

      await prisma.evaluationScenario.create({
        data: {
          caseId: caseRow.id,
          prompt: s.prompt,
          difficulty: s.difficulty,
          requiredEvidenceIds,
          expectedActions: s.expectedActions as unknown as object[],
          expectedContradictions: expectedContradictions as unknown as object[],
          referenceAnswer: s.referenceAnswer,
          notes: s.notes,
        },
      })
      summary.created++
    } catch (e) {
      summary.skipped++
      summary.errors.push(`${s.caseTitle}: ${(e as Error).message}`)
    }
  }

  return summary
}

export interface RunResult {
  scenarioId: string
  retrievalMethod: RetrievalMethod
  logId: string
  correctnessScore: number | null
  retrievalPrecision: number | null
  retrievalRecall: number | null
  topKAccuracy: boolean | null
  retrievalSuccess: boolean
  totalResponseTimeMs: number
  totalTokens: number
  estimatedCost: number
}

export async function runScenario(
  scenarioId: string,
  retrievalMethod: RetrievalMethod,
  signal?: AbortSignal
): Promise<RunResult> {
  const isCancelled = () =>
    isEvaluationCancelled() ||
    Boolean(signal?.aborted) ||
    Boolean(globalThis.__evalAbortController?.signal?.aborted)

  if (isCancelled()) {
    throw new Error("Evaluation cancelled by user")
  }

  const scenario = await prisma.evaluationScenario.findUnique({
    where: { id: scenarioId },
    include: { case: true },
  })
  if (!scenario) throw new Error(`Scenario ${scenarioId} not found`)

  if (isCancelled()) {
    throw new Error("Evaluation cancelled by user")
  }

  const session = await prisma.investigationSession.create({
    data: { caseId: scenario.caseId, retrievalMethod },
  })

  const expectedActions = scenario.expectedActions as unknown as Array<{
    action_type: string
    target: string
  }>
  const requiredEvidenceIds = scenario.requiredEvidenceIds as unknown as string[]

  if (isCancelled()) {
    throw new Error("Evaluation cancelled by user")
  }

  const result = await generateAIResponse(
    scenario.prompt,
    scenario.caseId,
    session.id,
    retrievalMethod,
    {
      requiredEvidenceIds,
      expectedActions,
      temperature: 0.2,
    }
  )

  if (isCancelled()) {
    throw new Error("Evaluation cancelled by user")
  }

  const log = await prisma.aIInteractionLog.create({
    data: {
      sessionId: session.id,
      caseId: scenario.caseId,
      scenarioId: scenario.id,
      userPrompt: scenario.prompt,
      aiResponse: result.response,
      retrievedContext: result.context || null,
      retrievedContextsList: result.retrieval.retrievedContextsList,
      retrievedEvidenceIds: result.retrieval.retrievedEvidenceIds,
      retrievalScores: result.retrieval.retrievalScores,
      retrievalSuccess: result.retrieval.retrievalSuccess,
      retrievalPrecision: result.retrieval.retrievalPrecision,
      retrievalRecall: result.retrieval.retrievalRecall,
      topKAccuracy: result.retrieval.topKAccuracy,
      structuredRecommendation: result.structuredRecommendation
        ? JSON.parse(JSON.stringify(result.structuredRecommendation))
        : undefined,
      retrievalMethod,
      sparseScores: result.retrieval.sparseScores ?? undefined,
      denseScores: result.retrieval.denseScores ?? undefined,
      fusionScores: result.retrieval.fusionScores ?? undefined,
      fusionMethod: result.retrieval.fusionMethod ?? undefined,
      embeddingTimeMs: result.timings.embeddingTimeMs ?? undefined,
      retrievalTimeMs: result.timings.retrievalTimeMs,
      llmResponseTimeMs: result.timings.llmResponseTimeMs,
      totalResponseTimeMs: result.timings.totalResponseTimeMs,
      promptTokens: result.tokens.prompt,
      completionTokens: result.tokens.completion,
      totalTokens: result.tokens.total,
      estimatedCost: result.estimatedCost,
      correctnessScore: result.correctnessScore,
      promptTemplateVersion: "v1",
    },
  })

  // Broadcast live log event over WebSocket
  broadcastWSEvent({
    type: "LOG_CREATED",
    log: {
      ...log,
      scenario: {
        prompt: scenario.prompt,
        difficulty: scenario.difficulty,
        referenceAnswer: scenario.referenceAnswer,
        notes: scenario.notes,
        case: { title: scenario.case?.title || "Nexus Data Breach" },
      },
      ragasEvaluation: null,
    },
  })

  return {
    scenarioId: scenario.id,
    retrievalMethod,
    logId: log.id,
    correctnessScore: result.correctnessScore,
    retrievalPrecision: result.retrieval.retrievalPrecision,
    retrievalRecall: result.retrieval.retrievalRecall,
    topKAccuracy: result.retrieval.topKAccuracy,
    retrievalSuccess: result.retrieval.retrievalSuccess,
    totalResponseTimeMs: result.timings.totalResponseTimeMs,
    totalTokens: result.tokens.total,
    estimatedCost: result.estimatedCost,
  }
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
    limit?: number
    scenarioIds?: string[]
    difficulty?: string
    balanced?: boolean
  }
): Promise<{
  results: RunResult[]
  totalCost: number
  totalDurationMs: number
  cancelled?: boolean
}> {
  resetEvaluationCancel()
  let scenarios = await prisma.evaluationScenario.findMany({
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

  const results: RunResult[] = []
  const start = Date.now()
  let cancelled = false

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
      Boolean(globalThis.__evalAbortController?.signal?.aborted)

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
          const runRes = await runScenario(s.id, method)
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
          console.error(`Scenario ${s.id} ${method} failed:`, e)
        }
      }
    }

    const totalCost = results.reduce((acc, r) => acc + (r.estimatedCost ?? 0), 0)
    return { results, totalCost, totalDurationMs: Date.now() - start, cancelled }
  } finally {
    setActiveEvaluationStatus({ isRunning: false })
  }
}

export interface AggregateMetrics {
  retrievalMethod: RetrievalMethod
  count: number
  avgCorrectness: number
  avgPrecision: number
  avgRecall: number
  topKAccuracyRate: number
  avgResponseTimeMs: number
  avgTokens: number
  totalCost: number
}

export async function aggregateMetrics(): Promise<AggregateMetrics[]> {
  const out: AggregateMetrics[] = []

  for (const method of ALL_METHODS) {
    const logs = await prisma.aIInteractionLog.findMany({
      where: { retrievalMethod: method, scenarioId: { not: null } },
    })

    if (logs.length === 0) {
      out.push({
        retrievalMethod: method,
        count: 0,
        avgCorrectness: 0,
        avgPrecision: 0,
        avgRecall: 0,
        topKAccuracyRate: 0,
        avgResponseTimeMs: 0,
        avgTokens: 0,
        totalCost: 0,
      })
      continue
    }

    const sum = (arr: Array<number | null | undefined>) =>
      arr.reduce<number>((acc, v) => acc + (v ?? 0), 0)

    out.push({
      retrievalMethod: method,
      count: logs.length,
      avgCorrectness: sum(logs.map((l) => l.correctnessScore)) / logs.length,
      avgPrecision: sum(logs.map((l) => l.retrievalPrecision)) / logs.length,
      avgRecall: sum(logs.map((l) => l.retrievalRecall)) / logs.length,
      topKAccuracyRate:
        logs.filter((l) => l.topKAccuracy === true).length / logs.length,
      avgResponseTimeMs: sum(logs.map((l) => l.totalResponseTimeMs)) / logs.length,
      avgTokens: sum(logs.map((l) => l.totalTokens)) / logs.length,
      totalCost: sum(logs.map((l) => l.estimatedCost)),
    })
  }

  return out
}

export interface RagasAggregateMetrics {
  retrievalMethod: RetrievalMethod
  count: number
  avgFaithfulness: number
  avgAnswerRelevance: number
  avgContextPrecision: number
  avgContextRecall: number
  compositeScore: number
}

export interface RagasDifficultyMetrics {
  retrievalMethod: RetrievalMethod
  difficulty: string
  count: number
  avgFaithfulness: number
  avgAnswerRelevance: number
  avgContextPrecision: number
  avgContextRecall: number
  compositeScore: number
}

export async function aggregateRagasMetrics(): Promise<{
  overall: RagasAggregateMetrics[]
  byDifficulty: RagasDifficultyMetrics[]
}> {
  const overall: RagasAggregateMetrics[] = []
  const byDifficulty: RagasDifficultyMetrics[] = []

  const sum = (arr: Array<number | null | undefined>) =>
    arr.reduce<number>((acc, v) => acc + (v ?? 0), 0)

  const diffs = ["easy", "medium", "hard"]

  for (const method of ALL_METHODS) {
    const logs = await prisma.aIInteractionLog.findMany({
      where: {
        retrievalMethod: method,
        scenarioId: { not: null },
        ragasEvaluation: { isNot: null },
      },
      include: {
        ragasEvaluation: true,
        scenario: { select: { difficulty: true } },
      },
    })

    const count = logs.length
    if (count === 0) {
      overall.push({
        retrievalMethod: method,
        count: 0,
        avgFaithfulness: 0,
        avgAnswerRelevance: 0,
        avgContextPrecision: 0,
        avgContextRecall: 0,
        compositeScore: 0,
      })
    } else {
      const avgFaith = sum(logs.map((l) => l.ragasEvaluation?.faithfulness)) / count
      const avgAnsRel = sum(logs.map((l) => l.ragasEvaluation?.answerRelevance)) / count
      const avgCtxPrec = sum(logs.map((l) => l.ragasEvaluation?.contextPrecision)) / count
      const avgCtxRec = sum(logs.map((l) => l.ragasEvaluation?.contextRecall)) / count
      const composite = (avgFaith + avgAnsRel + avgCtxPrec + avgCtxRec) / 4

      overall.push({
        retrievalMethod: method,
        count,
        avgFaithfulness: avgFaith,
        avgAnswerRelevance: avgAnsRel,
        avgContextPrecision: avgCtxPrec,
        avgContextRecall: avgCtxRec,
        compositeScore: composite,
      })
    }

    for (const diff of diffs) {
      const diffLogs = logs.filter((l) => l.scenario?.difficulty === diff)
      const dCount = diffLogs.length
      if (dCount > 0) {
        const avgFaith = sum(diffLogs.map((l) => l.ragasEvaluation?.faithfulness)) / dCount
        const avgAnsRel = sum(diffLogs.map((l) => l.ragasEvaluation?.answerRelevance)) / dCount
        const avgCtxPrec = sum(diffLogs.map((l) => l.ragasEvaluation?.contextPrecision)) / dCount
        const avgCtxRec = sum(diffLogs.map((l) => l.ragasEvaluation?.contextRecall)) / dCount
        const composite = (avgFaith + avgAnsRel + avgCtxPrec + avgCtxRec) / 4
        byDifficulty.push({
          retrievalMethod: method,
          difficulty: diff,
          count: dCount,
          avgFaithfulness: avgFaith,
          avgAnswerRelevance: avgAnsRel,
          avgContextPrecision: avgCtxPrec,
          avgContextRecall: avgCtxRec,
          compositeScore: composite,
        })
      }
    }
  }

  return { overall, byDifficulty }
}

