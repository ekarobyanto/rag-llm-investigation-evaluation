import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await Promise.resolve(params)
    const id = resolvedParams?.id
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 })
    }
    const caseData = await prisma.case.findUnique({
      where: { id },
      include: {
        suspects: true,
        evidence: true,
      },
    })

    if (!caseData) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 })
    }

    return NextResponse.json(caseData)
  } catch (error) {
    console.error("Error fetching case:", error)
    return NextResponse.json(
      { error: "Failed to fetch case" },
      { status: 500 }
    )
  }
}
