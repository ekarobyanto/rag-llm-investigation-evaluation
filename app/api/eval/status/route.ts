import { NextResponse } from "next/server"
import { getActiveEvaluationStatus } from "@/lib/eval"

export async function GET() {
  return NextResponse.json(getActiveEvaluationStatus())
}
