import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const { caseId, retrievalMethod = "dense" } = await request.json()

    const validMethods = ["sparse", "dense", "hybrid"]
    if (!validMethods.includes(retrievalMethod)) {
      return NextResponse.json(
        { error: `Invalid retrieval method. Must be one of: ${validMethods.join(", ")}` },
        { status: 400 }
      )
    }

    const session = await prisma.investigationSession.create({
      data: {
        caseId,
        retrievalMethod,
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
