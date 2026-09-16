import { NextResponse } from "next/server"
import {
  runAllScenarios,
  runScenario,
  resetEvaluationCancel,
  cancelEvaluation,
  isEvaluationCancelled,
  setActiveEvaluationStatus,
} from "@/lib/eval"
import type { RetrievalMethod } from "@/lib/retrieval"

export const maxDuration = 300

const ALL_METHODS: RetrievalMethod[] = ["sparse", "dense", "hybrid"]
const VALID_METHODS = new Set(ALL_METHODS)

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      scenarioId,
      mode,
      methods: rawMethods,
      limit,
      scenarioIds,
      difficulty,
      balanced,
    } = body as {
      scenarioId?: string
      mode?: string // legacy compat — "ALL" runs all methods
      methods?: RetrievalMethod[] // explicit method list
      limit?: number
      scenarioIds?: string[]
      difficulty?: string
      balanced?: boolean
    }

    // Determine which methods to run
    let targetMethods: RetrievalMethod[]
    if (rawMethods && Array.isArray(rawMethods)) {
      targetMethods = rawMethods.filter((m) => VALID_METHODS.has(m))
      if (targetMethods.length === 0) targetMethods = ALL_METHODS
    } else if (mode && VALID_METHODS.has(mode as RetrievalMethod)) {
      targetMethods = [mode as RetrievalMethod]
    } else {
      targetMethods = ALL_METHODS
    }

    if (scenarioId) {
      resetEvaluationCancel()
      setActiveEvaluationStatus({
        isRunning: true,
        label: "Executing single scenario across all 3 methods...",
        startedAt: Date.now(),
        type: "single",
        completedRuns: 0,
        totalRuns: targetMethods.length,
      })

      const results = []
      let cancelled = false
      try {
        for (const method of targetMethods) {
          if (isEvaluationCancelled()) {
            cancelled = true
            break
          }
          try {
            results.push(await runScenario(scenarioId, method))
            setActiveEvaluationStatus({
              completedRuns: results.length,
              label: `Executing single scenario (${results.length}/${targetMethods.length})...`,
            })
          } catch (err: any) {
            if (isEvaluationCancelled()) {
              cancelled = true
              break
            }
            throw err
          }
        }
        return NextResponse.json({ results, cancelled })
      } finally {
        setActiveEvaluationStatus({ isRunning: false })
      }
    }

    const summary = await runAllScenarios(targetMethods, undefined, {
      limit: typeof limit === "number" && limit > 0 ? limit : undefined,
      scenarioIds: Array.isArray(scenarioIds) && scenarioIds.length > 0 ? scenarioIds : undefined,
      difficulty: typeof difficulty === "string" ? difficulty : undefined,
      balanced: Boolean(balanced),
    })
    return NextResponse.json(summary)
  } catch (error: any) {
    if (isEvaluationCancelled()) {
      return NextResponse.json({ results: [], cancelled: true, message: "Evaluation cancelled." })
    }
    console.error("Eval run failed:", error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
