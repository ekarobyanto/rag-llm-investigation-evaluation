import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const caseData = await prisma.case.findUnique({
      where: { id: params.id },
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
