import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { generateAIResponse } from "@/lib/rag"

export async function POST(request: Request) {
  try {
    const { sessionId, caseId, prompt, ragEnabled } = await request.json()

    const response = await generateAIResponse(prompt, caseId, sessionId, ragEnabled)

    const log = await prisma.aIInteractionLog.create({
      data: {
        sessionId,
        caseId,
        userPrompt: prompt,
        aiResponse: response.response,
        retrievedContext: response.context,
        ragEnabled,
        retrievalTimeMs: response.timings.retrievalTimeMs,
        llmResponseTimeMs: response.timings.llmResponseTimeMs,
        totalResponseTimeMs: response.timings.totalResponseTimeMs,
        promptTokens: response.tokens.prompt,
        completionTokens: response.tokens.completion,
        totalTokens: response.tokens.total,
      },
    })

    return NextResponse.json({
      response: response.response,
      logId: log.id,
      timings: response.timings,
      tokens: response.tokens,
    })
  } catch (error) {
    console.error("Error in AI interaction:", error)
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    )
  }
}
