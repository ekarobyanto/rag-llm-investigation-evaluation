import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const { caseId, ragEnabled } = await request.json()

    const session = await prisma.investigationSession.create({
      data: {
        caseId,
        ragEnabled: ragEnabled || false,
      },
    })

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    console.error("Error creating session:", error)
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    )
  }
}
