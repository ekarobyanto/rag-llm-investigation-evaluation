import { OpenAI } from "openai"
import { prisma } from "./db"
import { retrieve } from "./retrieval"
import type { RetrievalMethod } from "./retrieval"
import { CONTEXT_LIMIT, PROMPT_VERSION, retrievalMetrics, generationSettings } from "./research"
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "build-key-placeholder", maxRetries: 0 })
export const SYSTEM_PROMPT = `Anda adalah asisten analisis bukti dalam permainan investigasi.
Jawab pertanyaan pemain dalam bahasa Indonesia hanya berdasarkan bukti yang disediakan.
Bedakan PENGAMATAN (fakta dalam bukti), INFERENSI (kesimpulan dengan alasan dan bukti pendukung),
dan KETIDAKPASTIAN (hal yang belum dapat ditentukan). Jangan menciptakan fakta atau menyatakan
seseorang bersalah tanpa bukti yang memadai. Jelaskan pertentangan antarcatatan bila relevan.
Jika bukti tidak cukup, nyatakan secara spesifik apa yang belum dapat ditentukan.`
export async function getInvestigationHistory(sessionId: string, limit = 5) {
  return prisma.aIInteractionLog.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" }, take: limit,
    select: { userPrompt: true, aiResponse: true } })
}
export interface GenerationDependencies {
  retrieve: typeof retrieve
  complete: (request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) => Promise<OpenAI.Chat.Completions.ChatCompletion>
}
const defaults: GenerationDependencies = { retrieve, complete: request => openai.chat.completions.create(request) }
export async function generateAIResponse(prompt: string, caseId: string, sessionId: string, retrievalMethod: RetrievalMethod,
  options?: { requiredEvidenceIds?: string[]; temperature?: number; limit?: number }, deps: GenerationDependencies = defaults) {
  if (options?.requiredEvidenceIds && !options.requiredEvidenceIds.length) throw new Error("Missing per-question gold evidence labels")
  const totalStart = performance.now()
  const retrievalResult = await deps.retrieve(retrievalMethod, caseId, prompt, { limit: CONTEXT_LIMIT })
  const evidence = [...new Map(retrievalResult.evidence.map(e => [e.id, e])).values()].slice(0, CONTEXT_LIMIT)
  const ids = evidence.map(e => e.id)
  const contexts = evidence.map(e => e.content)
  // Single-turn research questions never inherit another answer through gameplay history.
  const context = contexts.map((text, i) => `[${ids[i]}]\n${text}`).join("\n\n")
  const request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    ...generationSettings(options?.temperature),
    messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `BUKTI:\n${context || "Tidak ada bukti ditemukan."}\n\nPERTANYAAN:\n${prompt}` }],
  }
  const llmStart = performance.now()
  const completion = await deps.complete(request)
  const llmResponseTimeMs = Math.round(performance.now() - llmStart)
  const response = completion.choices[0]?.message.content?.trim()
  if (!response) throw new Error("Generator returned an empty answer")
  const metrics = options?.requiredEvidenceIds ? {
    at5: retrievalMetrics(ids, options.requiredEvidenceIds, 5), at10: retrievalMetrics(ids, options.requiredEvidenceIds, 10),
  } : null
  return { response, context, promptTemplateVersion: PROMPT_VERSION, modelSettings: {
      model: request.model, temperature: request.temperature, max_completion_tokens: request.max_completion_tokens,
    },
    tokens: { prompt: completion.usage?.prompt_tokens ?? 0, completion: completion.usage?.completion_tokens ?? 0, total: completion.usage?.total_tokens ?? 0 },
    timings: { retrievalTimeMs: retrievalResult.retrievalTimeMs, embeddingTimeMs: retrievalResult.embeddingTimeMs,
      llmResponseTimeMs, totalResponseTimeMs: Math.round(performance.now() - totalStart) },
    retrieval: { retrievedEvidenceIds: ids, retrievedContextsList: contexts, retrievalScores: evidence.map(e => e.score),
      metrics, returnedCount: ids.length, candidateDepth: retrievalResult.candidateDepth,
      sparseScores: retrievalResult.sparseScores, denseScores: retrievalResult.denseScores,
      fusionScores: retrievalResult.fusionScores, fusionMethod: retrievalResult.fusionMethod }, retrievalMethod }
}
