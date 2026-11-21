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
  const limit = options?.limit ?? 10
  const startTime = Date.now()

  try {
    const coverage = await prisma.$queryRaw<Array<{ count: bigint; missing: bigint }>>`
      SELECT COUNT(*) AS count, COUNT(*) FILTER (WHERE embedding IS NULL) AS missing
      FROM evidence WHERE "caseId" = ${caseId}
    `
    if (!Number(coverage[0]?.count) || Number(coverage[0]?.missing)) {
      throw new Error("Case requires a complete precomputed embedding corpus")
    }
    const embeddingStart = Date.now()
    const queryEmbedding = await generateEmbedding(query)
    const embeddingTimeMs = Date.now() - embeddingStart
    const embeddingStr = JSON.stringify(queryEmbedding)

    const results = await prisma.$queryRaw<DenseRow[]>`
      SELECT id, type, category,
        content,
        1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM evidence
      WHERE "caseId" = ${caseId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector, id ASC
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
      candidateDepth: limit,
      denseScores: evidence.map((e) => e.denseScore!),
    }
  } catch (error) {
    throw new Error(`Dense retrieval failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}
