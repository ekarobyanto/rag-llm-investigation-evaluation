import { OpenAI } from "openai"
import { prisma } from "./db"
import { retrieve } from "./retrieval"
import type { RetrievalMethod } from "./retrieval"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const PROMPT_TEMPLATE_VERSION = "v1"

// GPT-4o pricing (per token)
const COST_PER_INPUT_TOKEN = 0.0000025
const COST_PER_OUTPUT_TOKEN = 0.00001

const SYSTEM_PROMPT = `1. Role
You are an AI assistant supporting a player in a digital criminal investigation game. You assist with analyzing evidence, suspects, timelines, locations, and relationships. You must not act as an autonomous investigator.

2. Evidence-Grounded Behavior
- Only use information contained in the provided case context, retrieved evidence, suspect information, and investigation history.
- Never invent evidence, suspects, events, locations, relationships, motives, or other facts.
- Do not introduce information from outside the provided case context.
- If evidence is insufficient, explicitly state that it is insufficient instead of guessing.

3. Reasoning
- Distinguish between:
  - FACT: directly supported by evidence.
  - INFERENCE: reasonably derived from multiple pieces of evidence.
  - UNCERTAINTY: information that cannot currently be established.
- When making an inference, explain which evidence supports it.
- Connect multiple pieces of evidence when the question requires multi-hop reasoning.
- Maintain consistency with the investigation timeline.
- If evidence conflicts, explicitly identify the conflict.

4. Investigation Behavior
- For suspect-related questions, analyze relevant evidence concerning the suspect.
- For evidence-related questions, explain the evidence and its relationship to other evidence.
- For timeline questions, reconstruct events only from supported information.
- When multiple pieces of evidence support the same conclusion, explain their relationship.
- Do not declare a suspect guilty unless the available evidence sufficiently supports the conclusion.

5. Recommendation Logic
At the end of every response, recommend exactly one next investigative action.
The allowed actions are:
- INTERROGATE: Use when questioning a suspect could resolve an important uncertainty, contradiction, or missing fact.
- EXAMINE_EVIDENCE: Use when a specific piece of evidence requires further analysis or is highly relevant to the current investigation.
- REVIEW_TIMELINE: Use when the sequence or timing of events is unclear, contradictory, or important for resolving the case.
- SUBMIT_DEDUCTION: Use when the available evidence provides sufficient support for a specific investigative conclusion.
- INVESTIGATE_LOCATION: Use when a specific location is strongly connected to an unresolved part of the investigation.

Recommendation rules:
- Recommend the most useful next investigative step.
- Do not recommend an action merely because it is available.
- Prefer actions that resolve the most important current uncertainty.
- The target must exist in the provided investigation context.
- Do not invent a suspect, evidence ID, or location.
- The reason must be one concise sentence explaining why the action is useful.

6. Output Format
The normal investigation response should be followed by exactly one recommendation block.
The response must always end with:
<recommendation>
{
  "action_type": "INTERROGATE" | "EXAMINE_EVIDENCE" | "REVIEW_TIMELINE" | "SUBMIT_DEDUCTION" | "INVESTIGATE_LOCATION",
  "target": "<suspect name, evidence ID, or location>",
  "reason": "<one sentence reason>"
}
</recommendation>
Rules for this block:
- It must contain valid JSON.
- Do not wrap the JSON in Markdown code fences.
- Include exactly one recommendation.
- Do not include any text after </recommendation>.
- action_type must be one of the five allowed values.
- target must correspond to an entity present in the provided investigation context.
- reason must be exactly one sentence.`

export interface StructuredRecommendation {
  action_type: "INTERROGATE" | "EXAMINE_EVIDENCE" | "REVIEW_TIMELINE" | "SUBMIT_DEDUCTION" | "INVESTIGATE_LOCATION"
  target: string
  reason: string
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
  retrievalMethod: RetrievalMethod,
  options?: {
    requiredEvidenceIds?: string[]
    expectedActions?: Array<{ action_type: string; target: string }>
    temperature?: number
  }
) {
  // Always retrieve — the method determines how
  const retrievalResult = await retrieve(retrievalMethod, caseId, prompt, { limit: 5 })

  const retrievedEvidenceIds = retrievalResult.evidence.map((e) => e.id)
  const retrievalScores = retrievalResult.evidence.map((e) => e.score)
  const retrievedContextsList = retrievalResult.evidence.map((e) => e.content)

  // Evaluate retrieval against ground truth
  const evalResult = await evaluateRetrieval(
    caseId,
    retrievedEvidenceIds,
    options?.requiredEvidenceIds
  )

  // Always fetch investigation history for context
  const history = await getInvestigationHistory(sessionId, 5)

  // Build augmented prompt with retrieved evidence and history
  const evidenceContext = retrievalResult.evidence.length > 0
    ? `RELEVANT EVIDENCE:\n${retrievalResult.evidence.map((e) => `- [${e.type}/${e.category}] ${e.content}`).join("\n")}`
    : "RELEVANT EVIDENCE:\n(No evidence retrieved)"

  const historyContext = history.length > 0
    ? `INVESTIGATION HISTORY:\n${history.map((h) => `Q: ${h.prompt}\nA: ${h.response}`).join("\n\n")}`
    : ""

  const retrievedContext = `${evidenceContext}\n\n${historyContext}`.trim()

  const userPrompt = `${retrievedContext}\n\nPlayer Question: ${prompt}`

  const startTime = Date.now()

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: options?.temperature ?? 0.2,
    max_completion_tokens: 1000,
  })

  const llmResponseTimeMs = Date.now() - startTime
  const totalResponseTimeMs = llmResponseTimeMs + retrievalResult.retrievalTimeMs

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
    timings: {
      embeddingTimeMs: retrievalResult.embeddingTimeMs,
      retrievalTimeMs: retrievalResult.retrievalTimeMs,
      llmResponseTimeMs,
      totalResponseTimeMs,
    },
    context: retrievedContext,
    retrieval: {
      retrievedEvidenceIds,
      retrievedContextsList,
      retrievalScores,
      retrievalSuccess: evalResult.retrievalSuccess,
      retrievalPrecision: evalResult.precision,
      retrievalRecall: evalResult.recall,
      topKAccuracy: evalResult.topKAccuracy,
      sparseScores: retrievalResult.sparseScores ?? null,
      denseScores: retrievalResult.denseScores ?? null,
      fusionScores: retrievalResult.fusionScores ?? null,
      fusionMethod: retrievalResult.fusionMethod ?? null,
    },
    retrievalMethod,
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
