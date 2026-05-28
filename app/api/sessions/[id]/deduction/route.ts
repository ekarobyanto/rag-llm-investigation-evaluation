import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params
    const { suspectId, reasoning } = await request.json()

    if (!suspectId || typeof suspectId !== "string") {
      return NextResponse.json({ error: "suspectId required" }, { status: 400 })
    }

    const session = await prisma.investigationSession.findUnique({
      where: { id: sessionId },
      include: {
        case: {
          include: {
            groundTruth: true,
            suspects: true,
          },
        },
        deduction: true,
      },
    })

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    if (session.deduction) {
      return NextResponse.json(
        { error: "Deduction already submitted for this session" },
        { status: 409 }
      )
    }

    const groundTruth = session.case.groundTruth
    if (!groundTruth) {
      return NextResponse.json(
        { error: "Case has no ground truth — cannot score deduction" },
        { status: 500 }
      )
    }

    const isCorrect = suspectId === groundTruth.correctSuspectId
    const correctSuspect = session.case.suspects.find(
      (s) => s.id === groundTruth.correctSuspectId
    )
    const chosenSuspect = session.case.suspects.find((s) => s.id === suspectId)

    if (!chosenSuspect) {
      return NextResponse.json(
        { error: "Chosen suspect does not belong to this case" },
        { status: 400 }
      )
    }

    const deduction = await prisma.deduction.create({
      data: {
        sessionId,
        suspectId,
        reasoning: reasoning ?? "",
        isCorrect,
        correctSuspectId: groundTruth.correctSuspectId,
      },
    })

    return NextResponse.json({
      deductionId: deduction.id,
      isCorrect,
      chosenSuspect: { id: chosenSuspect.id, name: chosenSuspect.name },
      correctSuspect: correctSuspect
        ? { id: correctSuspect.id, name: correctSuspect.name }
        : null,
      contradictionPairs: groundTruth.contradictionPairs,
      relevantEvidenceIds: groundTruth.relevantEvidenceIds,
    })
  } catch (error) {
    console.error("Error submitting deduction:", error)
    return NextResponse.json(
      { error: "Failed to submit deduction" },
      { status: 500 }
    )
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params

    const deduction = await prisma.deduction.findUnique({
      where: { sessionId },
    })

    if (!deduction) {
      return NextResponse.json({ deduction: null })
    }

    return NextResponse.json({ deduction })
  } catch (error) {
    console.error("Error fetching deduction:", error)
    return NextResponse.json(
      { error: "Failed to fetch deduction" },
      { status: 500 }
    )
  }
}
