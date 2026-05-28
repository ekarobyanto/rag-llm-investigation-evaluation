import { NextResponse } from "next/server"
import { runAllScenarios, runScenario } from "@/lib/eval"

export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const { scenarioId, mode } = body as {
      scenarioId?: string
      mode?: "ON" | "OFF" | "BOTH"
    }

    if (scenarioId) {
      const targetMode = mode ?? "BOTH"
      const results = []
      if (targetMode === "OFF" || targetMode === "BOTH") {
        results.push(await runScenario(scenarioId, false))
      }
      if (targetMode === "ON" || targetMode === "BOTH") {
        results.push(await runScenario(scenarioId, true))
      }
      return NextResponse.json({ results })
    }

    const summary = await runAllScenarios([mode ?? "BOTH"])
    return NextResponse.json(summary)
  } catch (error) {
    console.error("Eval run failed:", error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
