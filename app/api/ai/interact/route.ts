import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { generateAIResponse } from "@/lib/rag"
import type { RetrievalMethod } from "@/lib/retrieval"
export async function POST(request: Request) {
  try {
    const { sessionId, caseId, prompt, retrievalMethod = "dense" } = await request.json()
    if (!["sparse", "dense", "hybrid"].includes(retrievalMethod) || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Valid prompt and retrieval method required" }, { status: 400 })
    }
    const result = await generateAIResponse(prompt, caseId, sessionId, retrievalMethod as RetrievalMethod)
    const log = await prisma.aIInteractionLog.create({ data: {
      sessionId, caseId, userPrompt: prompt, aiResponse: result.response, retrievedContext: result.context,
      retrievedContextsList: result.retrieval.retrievedContextsList, retrievedEvidenceIds: result.retrieval.retrievedEvidenceIds,
      retrievalScores: result.retrieval.retrievalScores, retrievalMethod, retrievalSuccess: true,
      sparseScores: result.retrieval.sparseScores, denseScores: result.retrieval.denseScores,
      fusionScores: result.retrieval.fusionScores, fusionMethod: result.retrieval.fusionMethod,
      embeddingTimeMs: result.timings.embeddingTimeMs, retrievalTimeMs: result.timings.retrievalTimeMs,
      llmResponseTimeMs: result.timings.llmResponseTimeMs, totalResponseTimeMs: result.timings.totalResponseTimeMs,
      promptTokens: result.tokens.prompt, completionTokens: result.tokens.completion, totalTokens: result.tokens.total,
      promptTemplateVersion: result.promptTemplateVersion, modelSettings: result.modelSettings,
    } })
    return NextResponse.json({ response: result.response, logId: log.id, timings: result.timings, tokens: result.tokens,
      context: result.context, retrievalMethod })
  } catch (error) {
    console.error("Error in AI interaction:", error)
    return NextResponse.json({ error: "Failed to get AI response" }, { status: 502 })
  }
}
