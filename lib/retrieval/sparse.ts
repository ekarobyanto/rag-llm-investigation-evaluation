import { prisma } from "@/lib/db"
import type { RetrievalResult, RetrievalOptions, RetrievedEvidenceItem } from "./types"

interface SparseRow {
  id: string
  type: string
  category: string
  content: string
  score: number
}

export async function sparseRetrieve(
  caseId: string,
  query: string,
  options?: RetrievalOptions
): Promise<RetrievalResult> {
  const limit = options?.limit ?? 5
  const startTime = Date.now()

  try {
    // Try plainto_tsquery first for standard keyword matching
    let results = await prisma.$queryRaw<SparseRow[]>`
      SELECT id, type, category,
        LEFT(content, 500) AS content,
        ts_rank_cd(search_vector, plainto_tsquery('english', ${query})) AS score
      FROM evidence
      WHERE case_id = ${caseId}
        AND search_vector IS NOT NULL
        AND search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY score DESC
      LIMIT ${limit}
    `

    // Fall back to websearch_to_tsquery for more flexible matching
    if (!results || results.length === 0) {
      results = await prisma.$queryRaw<SparseRow[]>`
        SELECT id, type, category,
          LEFT(content, 500) AS content,
          ts_rank_cd(search_vector, websearch_to_tsquery('english', ${query})) AS score
        FROM evidence
        WHERE case_id = ${caseId}
          AND search_vector IS NOT NULL
          AND search_vector @@ websearch_to_tsquery('english', ${query})
        ORDER BY score DESC
        LIMIT ${limit}
      `
    }

    const evidence: RetrievedEvidenceItem[] = (results ?? []).map((r) => ({
      id: r.id,
      type: r.type,
      category: r.category,
      content: r.content,
      score: Number(r.score),
      sparseScore: Number(r.score),
    }))

    return {
      evidence,
      retrievalTimeMs: Date.now() - startTime,
      embeddingTimeMs: null,
      method: "sparse",
      sparseScores: evidence.map((e) => e.sparseScore!),
    }
  } catch (error) {
    console.error("Sparse retrieval error:", error)
    return {
      evidence: [],
      retrievalTimeMs: Date.now() - startTime,
      embeddingTimeMs: null,
      method: "sparse",
    }
  }
}
