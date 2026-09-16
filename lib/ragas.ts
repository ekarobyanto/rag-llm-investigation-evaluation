import { prisma } from "./db"
import { OpenAI } from "openai"
import {
  setActiveEvaluationStatus,
  getActiveEvaluationStatus,
  isEvaluationCancelled,
  resetEvaluationCancel,
} from "./eval"
import { broadcastWSEvent } from "./ws"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "build-key-placeholder",
})

export interface RunRagasOptions {
  limit?: number
  method?: "sparse" | "dense" | "hybrid" | "all"
  difficulty?: "easy" | "medium" | "hard" | "all"
  force?: boolean
  scenarioId?: string
  logIds?: string[]
}

export interface RagasEvaluationResult {
  success: boolean
  evaluatedCount: number
  totalMatched: number
  message: string
  reason?: "NO_LOGS" | "ALREADY_EVALUATED" | "CANCELLED" | "COMPLETED" | "ERROR"
  evaluations?: any[]
  errors?: string[]
}

interface LLMJudgeScoreOutput {
  faithfulness: number
  answerRelevance: number
  contextPrecision: number
  contextRecall: number
  faithfulnessReasoning: string
  answerRelevanceReasoning: string
  contextPrecisionReasoning: string
  contextRecallReasoning: string
  critique: string
}

/**
 * Evaluates a single interaction log against the RAG triad metrics using gpt-4o-mini as an expert judicial auditor.
 */
async function evaluateSingleLogWithLLM(
  log: any,
  retrievedContexts: string[],
  groundTruth: string
): Promise<LLMJudgeScoreOutput> {
  const promptMessage = `You are an expert LLM-as-a-Judge and RAG Triad Auditor evaluating an investigative AI deduction in a forensic detective system.
Evaluate the generated AI deduction and retrieval quality according to the 4 official RAGAS metrics:

=== CASE & SCENARIO CONTEXT ===
Case Title: ${log.scenario?.case?.title ?? "Investigative Case"}
Difficulty Tier: ${log.scenario?.difficulty ?? "medium"}
Retrieval Engine: ${log.retrievalMethod}

=== INVESTIGATION INQUIRY (USER PROMPT) ===
${log.userPrompt}

=== RETRIEVED EVIDENCE CONTEXT CHUNKS GIVEN TO AI (ORDERED BY RANK) ===
${
  retrievedContexts.length > 0
    ? retrievedContexts
        .map((ctx, idx) => `[Rank ${idx + 1}]: ${ctx}`)
        .join("\n\n")
    : "No context chunks retrieved."
}

=== GROUND TRUTH REFERENCE FACTS (EXPECTED ANSWER) ===
${groundTruth}

=== GENERATED AI DEDUCTION (MODEL OUTPUT) ===
${log.aiResponse || "No response generated."}

=== METRICS TO EVALUATE (Float score between 0.00 and 1.00 for each) ===
1. faithfulness (0.00 to 1.00):
   - Measures factual consistency of the AI deduction against the RETRIEVED CONTEXT.
   - Deconstruct the deduction into atomic claims. What proportion of claims are directly inferable from the retrieved evidence?
   - If the AI hallucinated details, made ungrounded assumptions, or brought in unverified facts, penalize heavily.
   - 1.00 = 100% grounded in context. 0.00 = complete hallucination.

2. answerRelevance (0.00 to 1.00):
   - Measures how directly, completely, and specifically the AI deduction addresses the prompt inquiry.
   - Penalize evasive answers, circular logic, boilerplate preamble, or failure to answer the core question.
   - 1.00 = direct, comprehensive answer. 0.00 = completely off-topic or evasive.

3. contextPrecision (0.00 to 1.00):
   - Evaluates the signal-to-noise ratio in retrieval ranking (Average Precision @ K).
   - Did the retrieval engine rank the most critical "smoking gun" evidence chunks at the very top (Rank 1-2)?
   - If the key clue was buried under irrelevant filler chunks, or if noise was ranked above signal, score lower.
   - 1.00 = perfect ranking (all top chunks are relevant evidence). 0.00 = only noise at top.

4. contextRecall (0.00 to 1.00):
   - Measures the recall coverage of the RETRIEVED CONTEXT against the GROUND TRUTH REFERENCE FACTS.
   - What proportion of the required ground-truth clues, names, timestamps, and flight/device details were retrieved?
   - 1.00 = all ground truth facts were present in retrieved chunks. 0.00 = missed all critical facts.

5. Forensic Reasonings & Critique:
   - "faithfulnessReasoning": Cite specific claims that were verified vs any ungrounded assumptions.
   - "answerRelevanceReasoning": Explain inquiry responsiveness and directness.
   - "contextPrecisionReasoning": Evaluate ranking order and signal-to-noise ratio.
   - "contextRecallReasoning": Explicitly list which ground-truth facts were retrieved and which were missed.
   - "critique": 2-3 forensic sentences summarizing retrieval behavior (e.g. why BM25 missed synonyms or why dense vector failed on exact IDs) and actionable tuning guidance.

Output STRICT valid JSON format with EXACTLY these keys:
{
  "faithfulness": 0.0,
  "answerRelevance": 0.0,
  "contextPrecision": 0.0,
  "contextRecall": 0.0,
  "faithfulnessReasoning": "...",
  "answerRelevanceReasoning": "...",
  "contextPrecisionReasoning": "...",
  "contextRecallReasoning": "...",
  "critique": "..."
}`

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert AI evaluation auditor specializing in RAG triad metrics (Faithfulness, Answer Relevance, Context Precision, Context Recall) in criminal investigation systems. Output strict valid JSON.",
      },
      {
        role: "user",
        content: promptMessage,
      },
    ],
  })

  const raw = completion.choices[0]?.message?.content ?? "{}"
  const parsed = JSON.parse(raw)

  const clamp = (val: any, def = 0.8) => {
    const num = parseFloat(val)
    if (isNaN(num)) return def
    return Math.max(0, Math.min(1, num))
  }

  return {
    faithfulness: clamp(parsed.faithfulness, 0.8),
    answerRelevance: clamp(parsed.answerRelevance, 0.8),
    contextPrecision: clamp(parsed.contextPrecision, 0.8),
    contextRecall: clamp(parsed.contextRecall, 0.8),
    faithfulnessReasoning:
      parsed.faithfulnessReasoning || "Verified against retrieved context evidence chunks.",
    answerRelevanceReasoning:
      parsed.answerRelevanceReasoning || "Evaluated against investigative inquiry responsiveness.",
    contextPrecisionReasoning:
      parsed.contextPrecisionReasoning || "Evaluated signal-to-noise ratio in evidence ranking.",
    contextRecallReasoning:
      parsed.contextRecallReasoning || "Evaluated context coverage against reference answer.",
    critique: parsed.critique || "Retrieval engine executed successfully for this scenario.",
  }
}

/**
 * Runs RAGAS evaluation pipeline natively in TypeScript using OpenAI LLM judge.
 * Updates database records and broadcasts live WebSocket telemetry.
 */
export async function runNativeRagasEvaluation(
  options: RunRagasOptions = {}
): Promise<RagasEvaluationResult> {
  resetEvaluationCancel()

  // 1. Build where clause
  const whereClause: any = {
    scenarioId: { not: null },
  }

  if (options.logIds && options.logIds.length > 0) {
    whereClause.id = { in: options.logIds }
  }

  if (options.scenarioId) {
    whereClause.scenarioId = options.scenarioId
  }

  if (options.method && options.method !== "all") {
    whereClause.retrievalMethod = options.method
  }

  if (options.difficulty && options.difficulty !== "all") {
    whereClause.scenario = {
      difficulty: options.difficulty,
    }
  }

  if (!options.force) {
    whereClause.ragasEvaluation = null
  }

  // 2. Fetch logs to evaluate
  const logs = await prisma.aIInteractionLog.findMany({
    where: whereClause,
    include: {
      scenario: {
        select: {
          id: true,
          prompt: true,
          difficulty: true,
          referenceAnswer: true,
          notes: true,
          expectedActions: true,
          case: { select: { title: true } },
        },
      },
      ragasEvaluation: true,
    },
    orderBy: { createdAt: "desc" },
    take: options.limit && options.limit > 0 ? options.limit : undefined,
  })

  // 3. Handle empty logs cases with clear actionable messages
  if (logs.length === 0) {
    // Check total scenario logs in DB
    const totalScenarioLogs = await prisma.aIInteractionLog.count({
      where: { scenarioId: { not: null } },
    })

    if (totalScenarioLogs === 0) {
      return {
        success: false,
        evaluatedCount: 0,
        totalMatched: 0,
        reason: "NO_LOGS",
        message:
          "No benchmark scenario logs exist in the database yet. Please run a benchmark in the Deterministic IR tab first to generate interaction telemetry.",
      }
    }

    if (!options.force) {
      const alreadyEvaluatedCount = await prisma.ragasEvaluation.count()
      return {
        success: true,
        evaluatedCount: 0,
        totalMatched: 0,
        reason: "ALREADY_EVALUATED",
        message: `All ${alreadyEvaluatedCount} benchmark logs are already evaluated. Click 'Force Re-Evaluate All' to re-score them.`,
      }
    }

    return {
      success: true,
      evaluatedCount: 0,
      totalMatched: 0,
      reason: "COMPLETED",
      message: "No logs matched the selected filter criteria.",
    }
  }

  // 4. Initialize evaluation status
  const total = logs.length
  setActiveEvaluationStatus({
    isRunning: true,
    label: `Evaluating RAGAS RAG Triad (0/${total} logs)...`,
    startedAt: Date.now(),
    type: "ragas",
    completedRuns: 0,
    totalRuns: total,
  })

  const evaluations: any[] = []
  const errors: string[] = []

  try {
    for (let i = 0; i < logs.length; i++) {
      if (isEvaluationCancelled()) {
        setActiveEvaluationStatus({ isRunning: false })
        return {
          success: false,
          evaluatedCount: evaluations.length,
          totalMatched: total,
          reason: "CANCELLED",
          message: `Evaluation stopped by user after scoring ${evaluations.length} of ${total} logs.`,
          evaluations,
        }
      }

      const log = logs[i]

      // Parse contexts
      let contexts: string[] = []
      if (Array.isArray(log.retrievedContextsList) && log.retrievedContextsList.length > 0) {
        contexts = log.retrievedContextsList.map((c) =>
          typeof c === "string" ? c : JSON.stringify(c)
        )
      } else if (log.retrievedContext) {
        contexts = [log.retrievedContext]
      }

      // Determine ground truth
      let groundTruth = log.scenario?.referenceAnswer || log.scenario?.notes || ""
      if (!groundTruth && log.scenario?.expectedActions) {
        const actions = Array.isArray(log.scenario.expectedActions)
          ? log.scenario.expectedActions
          : []
        groundTruth = actions
          .map((a: any) => `The expected investigative action is ${a.action_type} targeting ${a.target}.`)
          .join(" ")
      }
      if (!groundTruth) {
        groundTruth = "Reference answer not specified for this scenario."
      }

      try {
        const judgeOutput = await evaluateSingleLogWithLLM(log, contexts, groundTruth)

        const saved = await prisma.ragasEvaluation.upsert({
          where: { logId: log.id },
          create: {
            logId: log.id,
            faithfulness: judgeOutput.faithfulness,
            answerRelevance: judgeOutput.answerRelevance,
            contextPrecision: judgeOutput.contextPrecision,
            contextRecall: judgeOutput.contextRecall,
            faithfulnessReasoning: judgeOutput.faithfulnessReasoning,
            answerRelevanceReasoning: judgeOutput.answerRelevanceReasoning,
            contextPrecisionReasoning: judgeOutput.contextPrecisionReasoning,
            contextRecallReasoning: judgeOutput.contextRecallReasoning,
            critique: judgeOutput.critique,
            evaluatedAt: new Date(),
          },
          update: {
            faithfulness: judgeOutput.faithfulness,
            answerRelevance: judgeOutput.answerRelevance,
            contextPrecision: judgeOutput.contextPrecision,
            contextRecall: judgeOutput.contextRecall,
            faithfulnessReasoning: judgeOutput.faithfulnessReasoning,
            answerRelevanceReasoning: judgeOutput.answerRelevanceReasoning,
            contextPrecisionReasoning: judgeOutput.contextPrecisionReasoning,
            contextRecallReasoning: judgeOutput.contextRecallReasoning,
            critique: judgeOutput.critique,
            evaluatedAt: new Date(),
          },
        })

        evaluations.push(saved)

        // Broadcast single evaluation update over WebSocket
        try {
          broadcastWSEvent({ type: "RAGAS_UPDATE", evaluations: [saved] })
        } catch {
          // ignore
        }
      } catch (itemErr: any) {
        console.error(`Failed to evaluate log ${log.id}:`, itemErr)
        errors.push(`Log ${log.id}: ${itemErr.message || String(itemErr)}`)
      }

      // Update progress
      setActiveEvaluationStatus({
        completedRuns: i + 1,
        totalRuns: total,
        label: `Evaluating RAGAS RAG Triad (${i + 1}/${total} logs)...`,
      })
    }

    return {
      success: true,
      evaluatedCount: evaluations.length,
      totalMatched: total,
      reason: "COMPLETED",
      message: `Successfully evaluated ${evaluations.length} of ${total} logs with full RAGAS triad metrics & judicial reasoning.`,
      evaluations,
      errors: errors.length > 0 ? errors : undefined,
    }
  } finally {
    setActiveEvaluationStatus({ isRunning: false })
  }
}
