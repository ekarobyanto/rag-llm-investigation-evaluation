import { OpenAI } from "openai"
import { prisma } from "./db"
import { generateEmbedding } from "./embedding"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function retrieveRelevantEvidence(
  caseId: string,
  query: string,
  limit: number = 5
) {
  const startTime = Date.now()

  try {
    const queryEmbedding = await generateEmbedding(query)

    const results = await prisma.$queryRaw<
      Array<{
        id: string
        type: string
        content: string
        similarity: number
      }>
    >`
      SELECT id, type, content,
        1 - (embedding <=> $1::vector) as similarity
      FROM evidence
      WHERE case_id = $2
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    ` as any

    return {
      evidence: results || [],
      retrievalTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    console.error("Evidence retrieval error:", error)
    return {
      evidence: [],
      retrievalTimeMs: Date.now() - startTime,
    }
  }
}

export async function getInvestigationHistory(
  sessionId: string,
  limit: number = 10
) {
  const logs = await prisma.aIInteractionLog.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  return logs.map((log) => ({
    prompt: log.userPrompt,
    response: log.aiResponse,
    timestamp: log.createdAt,
  }))
}

export async function generateAIResponse(
  prompt: string,
  caseId: string,
  sessionId: string,
  ragEnabled: boolean
) {
  let context = ""
  let retrievalTimeMs = 0
  let retrievedContext = ""

  if (ragEnabled) {
    const { evidence, retrievalTimeMs: rtMs } = await retrieveRelevantEvidence(
      caseId,
      prompt,
      5
    )
    retrievalTimeMs = rtMs

    const history = await getInvestigationHistory(sessionId, 5)

    context = `You are an AI investigation assistant helping solve criminal cases.

RELEVANT EVIDENCE:
${evidence.map((e) => `- [${e.type}] ${e.content}`).join("\n")}

INVESTIGATION HISTORY:
${history.map((h) => `Q: ${h.prompt}\nA: ${h.response}`).join("\n\n")}

Please provide a helpful analysis based on the above context.`

    retrievedContext = context
  }

  const fullPrompt = ragEnabled
    ? `${context}\n\nPlayer Question: ${prompt}`
    : prompt

  const startTime = Date.now()

  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "system",
        content: "You are an expert criminal investigation assistant.",
      },
      {
        role: "user",
        content: fullPrompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  })

  const llmResponseTimeMs = Date.now() - startTime
  const totalResponseTimeMs = llmResponseTimeMs + retrievalTimeMs

  return {
    response: response.choices[0].message.content || "",
    tokens: {
      prompt: response.usage?.prompt_tokens || 0,
      completion: response.usage?.completion_tokens || 0,
      total: response.usage?.total_tokens || 0,
    },
    timings: {
      retrievalTimeMs,
      llmResponseTimeMs,
      totalResponseTimeMs,
    },
    context: retrievedContext,
  }
}
