import { OpenAI } from "openai"
import { prisma } from "./db"
import { generateEmbedding } from "./embedding"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const PROMPT_TEMPLATE_VERSION = "v1"

// GPT-4o pricing (per token)
const COST_PER_INPUT_TOKEN = 0.0000025
const COST_PER_OUTPUT_TOKEN = 0.00001

export interface StructuredRecommendation {
  action_type: "INTERROGATE" | "EXAMINE_EVIDENCE" | "REVIEW_TIMELINE" | "SUBMIT_DEDUCTION" | "INVESTIGATE_LOCATION"
  target: string
  reason: string
}

export interface RetrievedEvidenceItem {
  id: string
  type: string
  category: string
  content: string
  similarity: number
}

export async function retrieveRelevantEvidence(
  caseId: string,
  query: string,
  limit: number = 5
) {
  const startTime = Date.now()

  try {
    const queryEmbedding = await generateEmbedding(query)
    const embeddingStr = JSON.stringify(queryEmbedding)

    const results = await prisma.$queryRaw<RetrievedEvidenceItem[]>`
      SELECT id, type, category,
        LEFT(content, 500) as content,
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM evidence
      WHERE case_id = ${caseId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `

    return {
      evidence: results ?? [],
      retrievalTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    console.error("Evidence retrieval error:", error)
    return {
      evidence: [] as RetrievedEvidenceItem[],
      retrievalTimeMs: Date.now() - startTime,
    }
  }
}

export async function getInvestigationHistory(
  sessionId: string,
  limit: number = 5
) {
  const logs = await prisma.aIInteractionLog.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      userPrompt: true,
      aiResponse: true,
      createdAt: true,
    },
  })

  return logs.map((log) => ({
    prompt: log.userPrompt,
    response: log.aiResponse,
    timestamp: log.createdAt,
  }))
}

export async function evaluateRetrieval(
  caseId: string,
  retrievedIds: string[],
  requiredEvidenceIds?: string[]
): Promise<{
  retrievalSuccess: boolean
  precision: number
  recall: number
  topKAccuracy: boolean
}> {
  let relevantSet: Set<string>

  if (requiredEvidenceIds && requiredEvidenceIds.length > 0) {
    relevantSet = new Set(requiredEvidenceIds)
  } else {
    const groundTruth = await prisma.caseGroundTruth.findUnique({
      where: { caseId },
      select: { relevantEvidenceIds: true },
    })
    if (!groundTruth) {
      return { retrievalSuccess: false, precision: 0, recall: 0, topKAccuracy: false }
    }
    relevantSet = new Set(groundTruth.relevantEvidenceIds as string[])
  }

  const hits = retrievedIds.filter((id) => relevantSet.has(id)).length
  const precision = retrievedIds.length > 0 ? hits / retrievedIds.length : 0
  const recall = relevantSet.size > 0 ? hits / relevantSet.size : 0
  const retrievalSuccess = hits > 0
  const topKAccuracy = hits > 0

  return { retrievalSuccess, precision, recall, topKAccuracy }
}

export async function scoreRecommendation(
  caseId: string,
  recommendation: StructuredRecommendation,
  expectedActions?: Array<{ action_type: string; target: string }>
): Promise<number> {
  let optimal: Array<{ action_type: string; target: string }>

  if (expectedActions && expectedActions.length > 0) {
    optimal = expectedActions
  } else {
    const groundTruth = await prisma.caseGroundTruth.findUnique({
      where: { caseId },
      select: { optimalNextActions: true },
    })
    if (!groundTruth) return 0
    optimal = groundTruth.optimalNextActions as unknown as Array<{
      action_type: string
      target: string
    }>
  }

  const match = optimal.find(
    (a) =>
      a.action_type === recommendation.action_type &&
      a.target === recommendation.target
  )

  return match ? 1.0 : 0.0
}

export async function generateAIResponse(
  prompt: string,
  caseId: string,
  sessionId: string,
  ragEnabled: boolean,
  options?: {
    requiredEvidenceIds?: string[]
    expectedActions?: Array<{ action_type: string; target: string }>
    temperature?: number
  }
) {
  let retrievalTimeMs = 0
  let retrievedContext = ""
  let retrievedEvidenceIds: string[] = []
  let retrievalScores: number[] = []
  let retrievalSuccess = false
  let retrievalPrecision: number | null = null
  let retrievalRecall: number | null = null
  let topKAccuracy: boolean | null = null

  if (ragEnabled) {
    const { evidence, retrievalTimeMs: rtMs } = await retrieveRelevantEvidence(caseId, prompt, 5)
    retrievalTimeMs = rtMs
    retrievedEvidenceIds = evidence.map((e) => e.id)
    retrievalScores = evidence.map((e) => e.similarity)

    const evalResult = await evaluateRetrieval(
      caseId,
      retrievedEvidenceIds,
      options?.requiredEvidenceIds
    )
    retrievalSuccess = evalResult.retrievalSuccess
    retrievalPrecision = evalResult.precision
    retrievalRecall = evalResult.recall
    topKAccuracy = evalResult.topKAccuracy

    const history = await getInvestigationHistory(sessionId, 5)

    retrievedContext = `RELEVANT EVIDENCE:
${evidence.map((e) => `- [${e.type}/${e.category}] ${e.content}`).join("\n")}

INVESTIGATION HISTORY:
${history.map((h) => `Q: ${h.prompt}\nA: ${h.response}`).join("\n\n")}`
  }

  const systemPrompt = `You are an expert criminal investigation assistant.

When responding, you MUST always end your response with a JSON block in this exact format:
<recommendation>
{
  "action_type": "INTERROGATE" | "EXAMINE_EVIDENCE" | "REVIEW_TIMELINE" | "SUBMIT_DEDUCTION" | "INVESTIGATE_LOCATION",
  "target": "<suspect name or evidence ID>",
  "reason": "<one sentence reason>"
}
</recommendation>`

  const userPrompt = ragEnabled
    ? `${retrievedContext}\n\nPlayer Question: ${prompt}`
    : prompt

  const startTime = Date.now()

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: options?.temperature ?? 0.2,
    max_tokens: 1000,
  })

  const llmResponseTimeMs = Date.now() - startTime
  const totalResponseTimeMs = llmResponseTimeMs + retrievalTimeMs

  const rawResponse = response.choices[0].message.content ?? ""
  const structuredRecommendation = extractStructuredRecommendation(rawResponse)
  const humanResponse = rawResponse.replace(/<recommendation>[\s\S]*?<\/recommendation>/g, "").trim()

  const promptTokens = response.usage?.prompt_tokens ?? 0
  const completionTokens = response.usage?.completion_tokens ?? 0
  const totalTokens = response.usage?.total_tokens ?? 0
  const estimatedCost = promptTokens * COST_PER_INPUT_TOKEN + completionTokens * COST_PER_OUTPUT_TOKEN

  let correctnessScore: number | null = null
  if (structuredRecommendation) {
    correctnessScore = await scoreRecommendation(
      caseId,
      structuredRecommendation,
      options?.expectedActions
    )
  }

  return {
    response: humanResponse,
    structuredRecommendation,
    correctnessScore,
    tokens: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
    timings: { retrievalTimeMs, llmResponseTimeMs, totalResponseTimeMs },
    context: retrievedContext,
    retrieval: {
      retrievedEvidenceIds,
      retrievalScores,
      retrievalSuccess,
      retrievalPrecision,
      retrievalRecall,
      topKAccuracy,
    },
    estimatedCost,
  }
}

function extractStructuredRecommendation(text: string): StructuredRecommendation | null {
  const match = text.match(/<recommendation>([\s\S]*?)<\/recommendation>/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim()) as StructuredRecommendation
  } catch {
    return null
  }
}
