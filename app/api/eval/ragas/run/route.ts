import { NextResponse } from "next/server"
import { runNativeRagasEvaluation } from "@/lib/ragas"
export const maxDuration = 300
export async function POST(request: Request) {
  try { return NextResponse.json(await runNativeRagasEvaluation(await request.json())) }
  catch (error) { return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 }) }
}
