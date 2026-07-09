import { prisma } from "@/lib/db"
import { generateEmbedding } from "@/lib/embedding"
import type { RetrievalResult, RetrievalOptions, RetrievedEvidenceItem } from "./types"

interface DenseRow {
  id: string
  type: string
  category: string
  content: string
  similarity: number
}

export async function denseRetrieve(
  caseId: string,
  query: string,
  options?: RetrievalOptions
): Promise<RetrievalResult> {
  const limit = options?.limit ?? 5
  const startTime = Date.now()

  try {
    const embeddingStart = Date.now()
    const queryEmbedding = await generateEmbedding(query)
    const embeddingTimeMs = Date.now() - embeddingStart
    const embeddingStr = JSON.stringify(queryEmbedding)

    const results = await prisma.$queryRaw<DenseRow[]>`
      SELECT id, type, category,
        LEFT(content, 500) AS content,
        1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM evidence
      WHERE case_id = ${caseId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `

    const evidence: RetrievedEvidenceItem[] = (results ?? []).map((r) => ({
      id: r.id,
      type: r.type,
      category: r.category,
      content: r.content,
      score: Number(r.similarity),
      denseScore: Number(r.similarity),
    }))

    return {
      evidence,
      retrievalTimeMs: Date.now() - startTime,
      embeddingTimeMs,
      method: "dense",
      denseScores: evidence.map((e) => e.denseScore!),
    }
  } catch (error) {
    console.error("Dense retrieval error:", error)
    return {
      evidence: [],
      retrievalTimeMs: Date.now() - startTime,
      embeddingTimeMs: null,
      method: "dense",
    }
  }
}
