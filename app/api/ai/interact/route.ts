import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { generateAIResponse } from "@/lib/rag"

export async function POST(request: Request) {
  try {
    const { sessionId, caseId, prompt, ragEnabled } = await request.json()

    const result = await generateAIResponse(prompt, caseId, sessionId, ragEnabled)

    const log = await prisma.aIInteractionLog.create({
      data: {
        sessionId,
        caseId,
        userPrompt: prompt,
        aiResponse: result.response,
        retrievedContext: result.context || null,
        retrievedEvidenceIds: result.retrieval.retrievedEvidenceIds,
        retrievalScores: result.retrieval.retrievalScores,
        retrievalSuccess: result.retrieval.retrievalSuccess,
        retrievalPrecision: result.retrieval.retrievalPrecision,
        retrievalRecall: result.retrieval.retrievalRecall,
        topKAccuracy: result.retrieval.topKAccuracy,
        structuredRecommendation: result.structuredRecommendation
          ? JSON.parse(JSON.stringify(result.structuredRecommendation))
          : undefined,
        ragEnabled,
        retrievalTimeMs: result.timings.retrievalTimeMs,
        llmResponseTimeMs: result.timings.llmResponseTimeMs,
        totalResponseTimeMs: result.timings.totalResponseTimeMs,
        promptTokens: result.tokens.prompt,
        completionTokens: result.tokens.completion,
        totalTokens: result.tokens.total,
        estimatedCost: result.estimatedCost,
        correctnessScore: result.correctnessScore,
        promptTemplateVersion: "v1",
      },
    })

    return NextResponse.json({
      response: result.response,
      structuredRecommendation: result.structuredRecommendation,
      logId: log.id,
      timings: result.timings,
      tokens: result.tokens,
      estimatedCost: result.estimatedCost,
      correctnessScore: result.correctnessScore,
    })
  } catch (error) {
    console.error("Error in AI interaction:", error)
    return NextResponse.json(
      { error: "Failed to get AI response" },
      { status: 500 }
    )
  }
}
