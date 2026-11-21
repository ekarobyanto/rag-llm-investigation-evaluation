import { NextResponse } from "next/server"
import { aggregateMetrics, aggregateRagasMetrics, selectedScope } from "@/lib/eval"
// Descriptive metrics only: no invented causal explanation or unvalidated winning composite.
export async function GET(request: Request) {
  try {
    const scope = await selectedScope(new URL(request.url).searchParams.get("runId") || undefined)
    const [retrieval, ragas] = await Promise.all([aggregateMetrics(scope.runId), aggregateRagasMetrics(scope.runId)])
    const successful = retrieval.reduce((n, m) => n + m.count, 0)
    return NextResponse.json({ scope, available: successful > 0, successful, expected: 270,
      complete: retrieval.every(m => m.count === 90 && m.repetitions.every(r => r.count === 30)), retrieval, ragas })
  } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 500 }) }
}
export const POST = GET
