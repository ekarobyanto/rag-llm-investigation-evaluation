import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { datasetManifest } from "@/lib/research"
import { seedScenarios } from "@/lib/eval"

export async function GET() {
  try {
    const scenarios = await prisma.evaluationScenario.findMany({
      where: { datasetVersion: datasetManifest().datasetVersion },
      include: { case: { select: { title: true } } },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(scenarios.map(({ expectedActions, ...active }) => active))
  } catch (error) {
    console.error("Failed to list scenarios:", error)
    return NextResponse.json({ error: "Failed to list scenarios" }, { status: 500 })
  }
}

export async function POST() {
  try {
    const summary = await seedScenarios()
    return NextResponse.json(summary)
  } catch (error) {
    console.error("Failed to seed scenarios:", error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
