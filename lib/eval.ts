import { prisma } from "./db"
import { generateAIResponse } from "./rag"
import { readdirSync, readFileSync } from "fs"
import { join } from "path"

export interface ScenarioInputFile {
  caseTitle: string
  prompt: string
  difficulty: "easy" | "medium" | "hard"
  requiredEvidenceIndices: number[]
  expectedActions: Array<{ action_type: string; target: string }>
  expectedContradictions?: Array<{ evidence_index_a: number; evidence_index_b: number }>
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
  ragEnabled: boolean
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
  ragEnabled: boolean
): Promise<RunResult> {
  const scenario = await prisma.evaluationScenario.findUnique({
    where: { id: scenarioId },
    include: { case: true },
  })
  if (!scenario) throw new Error(`Scenario ${scenarioId} not found`)

  const session = await prisma.investigationSession.create({
    data: { caseId: scenario.caseId, ragEnabled },
  })

  const expectedActions = scenario.expectedActions as unknown as Array<{
    action_type: string
    target: string
  }>
  const requiredEvidenceIds = scenario.requiredEvidenceIds as unknown as string[]

  const result = await generateAIResponse(
    scenario.prompt,
    scenario.caseId,
    session.id,
    ragEnabled,
    {
      requiredEvidenceIds,
      expectedActions,
      temperature: 0.2,
    }
  )

  const log = await prisma.aIInteractionLog.create({
    data: {
      sessionId: session.id,
      caseId: scenario.caseId,
      scenarioId: scenario.id,
      userPrompt: scenario.prompt,
      aiResponse: result.response,
      retrievedContext: result.context || null,
      retrievedEvidenceIds: result.retrieval.retrievedEvidenceIds,
      retrievalScores: result.retrieval.retrievalScores,
      retrievalSuccess: result.retrieval.retrievalSuccess,
      retrievalPrecision: result.retrieval.retrievalPrecision,
      retrievalRecall: result.retrieval.retrievalRecall,
      topKAccuracy: result.retrieval.topKAccuracy,
      structuredRecommendation: result.structuredRecommendation
        ? JSON.parse(JSON.stringify(result.structuredRecommendation))
        : undefined,
      ragEnabled,
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

  return {
    scenarioId: scenario.id,
    ragEnabled,
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

export async function runAllScenarios(modes: Array<"ON" | "OFF" | "BOTH"> = ["BOTH"]): Promise<{
  results: RunResult[]
  totalCost: number
  totalDurationMs: number
}> {
  const scenarios = await prisma.evaluationScenario.findMany({
    orderBy: { createdAt: "asc" },
  })
  const results: RunResult[] = []
  const start = Date.now()

  const runOn = modes.includes("BOTH") || modes.includes("ON")
  const runOff = modes.includes("BOTH") || modes.includes("OFF")

  for (const s of scenarios) {
    if (runOff) {
      try {
        results.push(await runScenario(s.id, false))
      } catch (e) {
        console.error(`Scenario ${s.id} OFF failed:`, e)
      }
    }
    if (runOn) {
      try {
        results.push(await runScenario(s.id, true))
      } catch (e) {
        console.error(`Scenario ${s.id} ON failed:`, e)
      }
    }
  }

  const totalCost = results.reduce((acc, r) => acc + (r.estimatedCost ?? 0), 0)
  return { results, totalCost, totalDurationMs: Date.now() - start }
}

export interface AggregateMetrics {
  ragEnabled: boolean
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
  const groups: Array<{ ragEnabled: boolean }> = [{ ragEnabled: false }, { ragEnabled: true }]
  const out: AggregateMetrics[] = []

  for (const g of groups) {
    const logs = await prisma.aIInteractionLog.findMany({
      where: { ragEnabled: g.ragEnabled, scenarioId: { not: null } },
    })

    if (logs.length === 0) {
      out.push({
        ragEnabled: g.ragEnabled,
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
      ragEnabled: g.ragEnabled,
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
