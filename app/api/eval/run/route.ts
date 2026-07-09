import { NextResponse } from "next/server"
import { runAllScenarios, runScenario } from "@/lib/eval"
import type { RetrievalMethod } from "@/lib/retrieval"

export const maxDuration = 300

const ALL_METHODS: RetrievalMethod[] = ["sparse", "dense", "hybrid"]
const VALID_METHODS = new Set(ALL_METHODS)

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { scenarioId, mode, methods: rawMethods } = body as {
      scenarioId?: string
      mode?: string  // legacy compat — "ALL" runs all methods
      methods?: RetrievalMethod[]  // explicit method list
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
      const results = []
      for (const method of targetMethods) {
        results.push(await runScenario(scenarioId, method))
      }
      return NextResponse.json({ results })
    }

    const summary = await runAllScenarios(targetMethods)
    return NextResponse.json(summary)
  } catch (error) {
    console.error("Eval run failed:", error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
