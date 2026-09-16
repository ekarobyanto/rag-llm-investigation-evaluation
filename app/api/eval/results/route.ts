import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { aggregateMetrics, aggregateRagasMetrics, getActiveEvaluationStatus } from "@/lib/eval"

export async function GET() {
  try {
    const aggregate = await aggregateMetrics()
    const ragas = await aggregateRagasMetrics()
    const status = getActiveEvaluationStatus()
    const recent = await prisma.aIInteractionLog.findMany({
      where: { scenarioId: { not: null } },
      include: {
        scenario: {
          select: {
            prompt: true,
            difficulty: true,
            referenceAnswer: true,
            notes: true,
            case: { select: { title: true } },
          },
        },
        ragasEvaluation: true,
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    })
    return NextResponse.json({ aggregate, ragas, recent, status })
  } catch (error) {
    console.error("Failed to fetch results:", error)
    return NextResponse.json(
      { error: "Failed to fetch results", detail: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    await prisma.aIInteractionLog.deleteMany({ where: { scenarioId: { not: null } } })
    const { broadcastWSEvent } = await import("@/lib/ws")
    broadcastWSEvent({ type: "LOGS_CLEARED" })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error("Failed to clear results:", error)
    return NextResponse.json({ error: "Failed to clear results" }, { status: 500 })
  }
}
