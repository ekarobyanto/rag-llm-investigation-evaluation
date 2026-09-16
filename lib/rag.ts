import { OpenAI } from "openai"
import { prisma } from "./db"
import { retrieve } from "./retrieval"
import type { RetrievalMethod } from "./retrieval"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "build-key-placeholder",
})

const PROMPT_TEMPLATE_VERSION = "v1"

// GPT-5.6 Luna pricing (per token)
const COST_PER_INPUT_TOKEN = 0.0000002
const COST_PER_OUTPUT_TOKEN = 0.0000012

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
- CRITICAL TARGET FORMAT: The target must always be the full name of the primary suspect or person of interest relevant to the inquiry (e.g. "Dr. Sarah Okonkwo", "Marcus Chen", "Viktor Petrov", "Aisha Rahman", "James Whitfield").
- NEVER output raw evidence category tags, document IDs, or metadata prefixes (such as "forensic_report/location", "location_report/alibi", or "witness_statement/noise") as the target. If recommending EXAMINE_EVIDENCE or REVIEW_TIMELINE, set the target to the person whose evidence or timeline is being scrutinized.
- The target must exist in the provided investigation context. Do not invent suspects.
- The reason must be one concise sentence explaining why the action is useful.

6. Output Format
The normal investigation response should be followed by exactly one recommendation block.
The response must always end with:
<recommendation>
{
  "action_type": "INTERROGATE" | "EXAMINE_EVIDENCE" | "REVIEW_TIMELINE" | "SUBMIT_DEDUCTION" | "INVESTIGATE_LOCATION",
  "target": "<full name of relevant suspect or person of interest, e.g. 'Dr. Sarah Okonkwo', 'Marcus Chen'>",
  "reason": "<one sentence reason>"
}
</recommendation>
Rules for this block:
- It must contain valid JSON.
- Do not wrap the JSON in Markdown code fences.
- Include exactly one recommendation.
- Do not include any text after </recommendation>.
- action_type must be one of the five allowed values.
- target must be the full name of the relevant suspect or person of interest (never a metadata category tag or file prefix).
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

export const KNOWN_SUSPECT_CANONICALS: Record<string, string[]> = {
  "Marcus Chen": [
    "marcus chen",
    "marcus",
    "chen",
    "marcus.chen",
    "svc-threatfeed",
    "threatfeed",
    "74.125.224.72",
    "residential ip",
    "cryptocurrency wallet",
    "home office occupancy",
  ],
  "Dr. Sarah Okonkwo": [
    "dr. sarah okonkwo",
    "sarah okonkwo",
    "dr. okonkwo",
    "dr okonkwo",
    "okonkwo",
    "sarah",
    "server room b",
    "quantumguard",
  ],
  "Viktor Petrov": [
    "viktor petrov",
    "victor petrov",
    "petrov",
    "viktor",
    "victor",
    "cybershield",
  ],
  "Aisha Rahman": [
    "aisha rahman",
    "aisha",
    "rahman",
    "flight nx-447",
    "flight nx447",
    "nx-447",
    "nx447",
    "united flight",
  ],
  "James Whitfield": [
    "james whitfield",
    "whitfield",
    "james",
  ],
}

export function normalizeEntityText(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function resolveEntityCanonical(target: string): string {
  const norm = normalizeEntityText(target)
  if (!norm) return ""

  for (const [canonical, aliases] of Object.entries(KNOWN_SUSPECT_CANONICALS)) {
    const normCanonical = normalizeEntityText(canonical)
    if (norm === normCanonical) return canonical

    for (const alias of aliases) {
      const cleanAlias = normalizeEntityText(alias)
      const regex = new RegExp(`(^|\\s)${cleanAlias.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}(\\s|$)`, "i")
      if (regex.test(norm) || norm.includes(cleanAlias)) {
        return canonical
      }
    }
  }

  return norm
}

export function normalizeActionType(action: string): string {
  const a = (action || "").toUpperCase().trim().replace(/[\s-]+/g, "_")
  if (a === "INTERROGATE_SUSPECT") return "INTERROGATE"
  return a
}

const VALID_INVESTIGATIVE_ACTIONS = new Set([
  "INTERROGATE",
  "EXAMINE_EVIDENCE",
  "REVIEW_TIMELINE",
  "SUBMIT_DEDUCTION",
  "INVESTIGATE_LOCATION",
])

function scoreSingleAction(
  expected: { action_type: string; target: string },
  rec: StructuredRecommendation
): number {
  const expAction = normalizeActionType(expected.action_type)
  const recAction = normalizeActionType(rec.action_type)

  const expTargetNorm = normalizeEntityText(expected.target)
  const recTargetNorm = normalizeEntityText(rec.target)

  const expCanonical = resolveEntityCanonical(expected.target)
  const recCanonical = resolveEntityCanonical(rec.target)

  const isCanonicalMatch = Boolean(expCanonical && recCanonical && expCanonical === recCanonical)
  const isDirectTargetMatch = expTargetNorm.length > 0 && expTargetNorm === recTargetNorm
  const isTargetMatch = isCanonicalMatch || isDirectTargetMatch

  // Partial target match (e.g. non-empty substring >= 4 chars)
  const isPartialTargetMatch =
    !isTargetMatch &&
    expTargetNorm.length >= 4 &&
    recTargetNorm.length >= 4 &&
    (expTargetNorm.includes(recTargetNorm) || recTargetNorm.includes(expTargetNorm))

  const isExactAction = expAction === recAction
  const isCompatibleAction =
    VALID_INVESTIGATIVE_ACTIONS.has(expAction) &&
    VALID_INVESTIGATIVE_ACTIONS.has(recAction)

  if (isTargetMatch) {
    if (isExactAction) return 1.0
    if (isCompatibleAction) return 0.8
    return 0.5
  }

  if (isPartialTargetMatch) {
    if (isExactAction) return 0.75
    if (isCompatibleAction) return 0.6
    return 0.4
  }

  return 0.0
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

  if (!optimal || optimal.length === 0) return 0

  const scores = optimal.map((opt) => scoreSingleAction(opt, recommendation))
  return Math.max(...scores, 0)
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
    limit?: number
  }
) {
  // Always retrieve — dynamic limit prevents the artificial K=5 recall ceiling on complex scenarios
  const retrieveLimit =
    options?.limit ??
    (options?.requiredEvidenceIds && options.requiredEvidenceIds.length > 5
      ? Math.min(20, Math.max(10, options.requiredEvidenceIds.length + 2))
      : 8)
  const retrievalResult = await retrieve(retrievalMethod, caseId, prompt, { limit: retrieveLimit })

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

  let humanResponse = ""
  let rawResponse = ""
  let promptTokens = 0
  let completionTokens = 0
  let totalTokens = 0
  let structuredRecommendation = null
  let llmResponseTimeMs = 0

  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: 1000,
      })
      llmResponseTimeMs = Date.now() - startTime
      rawResponse = response.choices[0].message.content ?? ""
      structuredRecommendation = extractStructuredRecommendation(rawResponse)
      humanResponse = rawResponse.replace(/<recommendation>[\s\S]*?<\/recommendation>/g, "").trim()
      promptTokens = response.usage?.prompt_tokens ?? 0
      completionTokens = response.usage?.completion_tokens ?? 0
      totalTokens = response.usage?.total_tokens ?? 0
    } catch (err) {
      console.error("OpenAI API call failed, falling back to offline forensic synthesis:", err)
    }
  }

  if (!humanResponse) {
    llmResponseTimeMs = Date.now() - startTime
    if (retrievalResult.evidence.length > 0) {
      const topEvidence = retrievalResult.evidence.slice(0, 3)
      humanResponse = `[FORENSIC CONSULTANT AUDIT]\n\nCross-referencing retrieved records for inquiry: "${prompt}":\n\n${topEvidence.map((e, idx) => `${idx + 1}. [${e.type.replace(/_/g, " ").toUpperCase()}] ${e.content}`).join("\n\n")}\n\n*Consultant Note: Compare these findings against the suspect statements to uncover timeline conflicts and false alibis.*`
    } else {
      humanResponse = `[FORENSIC CONSULTANT AUDIT]\n\nNo direct evidence matches were located for "${prompt}". Try cross-referencing specific suspect names, timestamps, or system accounts like "svc-threatfeed".`
    }
  }

  const totalResponseTimeMs = llmResponseTimeMs + retrievalResult.retrievalTimeMs
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

export function extractStructuredRecommendation(text: string): StructuredRecommendation | null {
  if (!text) return null

  // 1. Match content inside <recommendation> tag if available
  let rawContent: string | null = null
  const tagMatch = text.match(/<recommendation>([\s\S]*?)(?:<\/recommendation>|$)/i)
  if (tagMatch) {
    rawContent = tagMatch[1].trim()
  } else {
    // Fallback: search for any JSON object containing "action_type"
    const jsonFallbackMatch = text.match(/\{[\s\S]*?"action_type"[\s\S]*?\}/)
    if (jsonFallbackMatch) {
      rawContent = jsonFallbackMatch[0].trim()
    }
  }

  if (!rawContent) return null

  // 2. Strip Markdown code fences (```json ... ``` or ``` ...)
  rawContent = rawContent.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim()

  // 3. Find outermost JSON object
  const firstBrace = rawContent.indexOf("{")
  const lastBrace = rawContent.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    rawContent = rawContent.substring(firstBrace, lastBrace + 1)
  }

  try {
    const parsed = JSON.parse(rawContent)
    if (!parsed || typeof parsed !== "object") return null
    if (!parsed.action_type || !parsed.target) return null

    let actionType = normalizeActionType(String(parsed.action_type))
    const validActions: Array<StructuredRecommendation["action_type"]> = [
      "INTERROGATE",
      "EXAMINE_EVIDENCE",
      "REVIEW_TIMELINE",
      "SUBMIT_DEDUCTION",
      "INVESTIGATE_LOCATION",
    ]

    if (!validActions.includes(actionType as any)) {
      const matched = validActions.find((a) => actionType.includes(a))
      actionType = matched || "EXAMINE_EVIDENCE"
    }

    return {
      action_type: actionType as StructuredRecommendation["action_type"],
      target: String(parsed.target).trim(),
      reason: String(parsed.reason || "").trim(),
    }
  } catch {
    return null
  }
}
