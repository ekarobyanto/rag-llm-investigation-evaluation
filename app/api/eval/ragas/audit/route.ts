import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { OpenAI } from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "build-key-placeholder",
})

interface AuditRequestBody {
  logId?: string
  logIds?: string[]
  force?: boolean
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AuditRequestBody
    const logIds = body.logIds || (body.logId ? [body.logId] : [])

    if (logIds.length === 0) {
      return NextResponse.json(
        { error: "No logId or logIds provided for evaluation audit." },
        { status: 400 }
      )
    }

    const logs = await prisma.aIInteractionLog.findMany({
      where: {
        id: { in: logIds },
        ragasEvaluation: { isNot: null },
      },
      include: {
        scenario: {
          select: {
            prompt: true,
            difficulty: true,
            referenceAnswer: true,
            notes: true,
            case: { select: { title: true } },
          },
        },
        ragasEvaluation: true,
      },
      take: 20, // Guard batch size for latency
    })

    if (logs.length === 0) {
      return NextResponse.json(
        { error: "No matching evaluated logs found for the provided IDs." },
        { status: 404 }
      )
    }

    const updatedEvaluations = []

    for (const log of logs) {
      const e = log.ragasEvaluation
      if (!e) continue

      // Skip if already audited and not force
      if (
        !body.force &&
        e.faithfulnessReasoning &&
        e.answerRelevanceReasoning &&
        e.contextPrecisionReasoning &&
        e.contextRecallReasoning
      ) {
        updatedEvaluations.push(e)
        continue
      }

      const faithPct = ((e.faithfulness ?? 0) * 100).toFixed(1)
      const relPct = ((e.answerRelevance ?? 0) * 100).toFixed(1)
      const precPct = ((e.contextPrecision ?? 0) * 100).toFixed(1)
      const recPct = ((e.contextRecall ?? 0) * 100).toFixed(1)

      const promptMessage = `
You are an expert LLM-as-a-Judge and RAG Triad Auditor evaluating an investigative AI deduction.
Explain the exact analytical reasoning behind the awarded RAGAS benchmark scores for this execution.

=== SCENARIO INFO ===
Case Title: ${log.scenario?.case?.title ?? "Unknown Case"}
Difficulty Tier: ${log.scenario?.difficulty ?? "medium"}
Retrieval Engine: ${log.retrievalMethod}

=== INVESTIGATION INQUIRY ===
${log.userPrompt}

=== RETRIEVED CONTEXT CHUNKS GIVEN TO MODEL ===
${log.retrievedContext || (log.retrievedContextsList ? JSON.stringify(log.retrievedContextsList) : "None")}

=== GROUND TRUTH REFERENCE FACTS ===
${log.scenario?.referenceAnswer || log.scenario?.notes || "Not specified"}

=== GENERATED AI DEDUCTION ===
${log.aiResponse || "No response"}

=== RAGAS SCORES AWARDED ===
- Faithfulness: ${faithPct}% (${e.faithfulness ?? 0})
- Answer Relevance: ${relPct}% (${e.answerRelevance ?? 0})
- Context Precision: ${precPct}% (${e.contextPrecision ?? 0})
- Context Recall: ${recPct}% (${e.contextRecall ?? 0})

TASK:
Provide forensic, objective reasoning for EACH score. Your explanations must directly cite concrete evidence, suspects, or claims:
1. "faithfulnessReasoning": Detail which claims in the AI response were verified against the retrieved context, and point out any ungrounded assumptions, extrapolated alibis, or hallucinations. Explain why ${faithPct}% was awarded.
2. "answerRelevanceReasoning": Detail how directly and specifically the AI deduction answered the prompt inquiry. Did it identify the key targets or was it evasive, circular, or bogged down in irrelevant preamble? Explain why ${relPct}% was awarded.
3. "contextPrecisionReasoning": Evaluate the retrieval ranking signal-to-noise ratio. Did the search engine rank the critical smoking gun evidence chunk at the top (positions 1-2) or was it buried under irrelevant noise? Explain why ${precPct}% was awarded.
4. "contextRecallReasoning": Compare the retrieved context against the Ground Truth Reference facts. Explicitly enumerate which required clues were successfully retrieved and which were missed. Explain why ${recPct}% was awarded.
5. "critique": A sharp 2-3 sentence forensic synthesis of the retrieval engine's behavior (e.g. why BM25 missed synonyms or why dense vector failed on exact IDs) and actionable tuning guidance.

Format your output as strict JSON with exactly these keys:
{
  "faithfulnessReasoning": "...",
  "answerRelevanceReasoning": "...",
  "contextPrecisionReasoning": "...",
  "contextRecallReasoning": "...",
  "critique": "..."
}
`

      try {
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

        const rawContent = completion.choices[0]?.message?.content ?? "{}"
        const parsed = JSON.parse(rawContent)

        const updated = await prisma.ragasEvaluation.update({
          where: { logId: log.id },
          data: {
            faithfulnessReasoning: parsed.faithfulnessReasoning || "Score awarded based on context claim verification.",
            answerRelevanceReasoning: parsed.answerRelevanceReasoning || "Score awarded based on inquiry responsiveness.",
            contextPrecisionReasoning: parsed.contextPrecisionReasoning || "Score awarded based on chunk relevance ranking.",
            contextRecallReasoning: parsed.contextRecallReasoning || "Score awarded based on ground truth coverage.",
            critique: parsed.critique || null,
          },
        })

        updatedEvaluations.push(updated)
      } catch (err: any) {
        console.error(`Failed to audit log ${log.id}:`, err)
        updatedEvaluations.push(e)
      }
    }

    try {
      const { broadcastWSEvent } = await import("@/lib/ws")
      broadcastWSEvent({ type: "RAGAS_UPDATE", evaluations: updatedEvaluations })
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      auditedCount: updatedEvaluations.length,
      evaluations: updatedEvaluations,
    })
  } catch (error: any) {
    console.error("Audit API error:", error)
    return NextResponse.json(
      { error: "Failed to generate evaluation audit", detail: error.message },
      { status: 500 }
    )
  }
}
