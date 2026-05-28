import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { aggregateMetrics } from "@/lib/eval"

export async function GET() {
  try {
    const aggregate = await aggregateMetrics()
    const recent = await prisma.aIInteractionLog.findMany({
      where: { scenarioId: { not: null } },
      include: {
        scenario: { select: { prompt: true, difficulty: true, case: { select: { title: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
    return NextResponse.json({ aggregate, recent })
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
    return NextResponse.json({ deleted: true })
  } catch (error) {
    console.error("Failed to clear results:", error)
    return NextResponse.json({ error: "Failed to clear results" }, { status: 500 })
  }
}
