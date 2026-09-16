import { NextResponse } from "next/server"
import { cancelEvaluation } from "@/lib/eval"

export async function POST() {
  try {
    cancelEvaluation()
    return NextResponse.json({ success: true, message: "Evaluation cancellation signal dispatched." })
  } catch (error) {
    console.error("Failed to cancel evaluation:", error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return POST()
}
