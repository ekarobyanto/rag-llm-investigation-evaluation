import { NextResponse } from "next/server"
export async function POST() {
  return NextResponse.json({ error: "Retrospective score explanations are retired. Use the canonical RAGAS metric results and saved inputs." }, { status: 410 })
}
