import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { aggregateMetrics, aggregateRagasMetrics, getActiveEvaluationStatus, selectedScope, publicLog } from "@/lib/eval"
export async function GET(request: Request) {
  try {
    const scope = await selectedScope(new URL(request.url).searchParams.get("runId") || undefined)
    const [aggregate, ragas, recent] = await Promise.all([
      aggregateMetrics(scope.runId), aggregateRagasMetrics(scope.runId),
      prisma.aIInteractionLog.findMany({ where: scope, include: {
        scenario: { select: { questionId: true, prompt: true, difficulty: true, referenceAnswer: true, case: { select: { title: true } } } },
        ragasEvaluation: true }, orderBy: { createdAt: "desc" } }),
    ])
    return NextResponse.json({ scope, aggregate, ragas, recent: recent.map(publicLog), status: getActiveEvaluationStatus() })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
export async function DELETE() {
  return NextResponse.json({ error: "Research results are retained. Select a new run ID to start another experiment." }, { status: 405 })
}
