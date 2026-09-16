import { prisma } from "@/lib/db"
import type { RetrievalResult, RetrievalOptions, RetrievedEvidenceItem } from "./types"

interface SparseRow {
  id: string
  type: string
  category: string
  content: string
  score: number
}

const STOPWORDS = new Set([
  "what", "when", "where", "which", "who", "whom", "whose", "why", "how",
  "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "having", "do", "does", "did", "doing",
  "a", "an", "the", "and", "but", "if", "or", "because", "as", "until",
  "while", "of", "at", "by", "for", "with", "about", "against", "between",
  "into", "through", "during", "before", "after", "above", "below", "to",
  "from", "up", "down", "in", "out", "on", "off", "over", "under", "again",
  "further", "then", "once", "here", "there", "all", "any", "both", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only",
  "own", "same", "so", "than", "too", "very", "can", "will", "just", "don",
  "should", "now", "it", "its"
])

function buildOrQuery(query: string): string {
  const tokens = query.match(/[a-zA-Z0-9_\-]+/g) || []
  const filtered = tokens.filter((t) => !STOPWORDS.has(t.toLowerCase()) && t.length > 1)
  const list = filtered.length > 0 ? filtered : tokens
  return list.join(" OR ")
}

export async function sparseRetrieve(
  caseId: string,
  query: string,
  options?: RetrievalOptions
): Promise<RetrievalResult> {
  const limit = options?.limit ?? 5
  const startTime = Date.now()

  try {
    // Try plainto_tsquery first for exact multi-token conjunction
    let results = await prisma.$queryRaw<SparseRow[]>`
      SELECT id, type, category,
        LEFT(content, 500) AS content,
        ts_rank_cd(search_vector, plainto_tsquery('english', ${query})) AS score
      FROM evidence
      WHERE "caseId" = ${caseId}
        AND search_vector IS NOT NULL
        AND search_vector @@ plainto_tsquery('english', ${query})
      ORDER BY score DESC
      LIMIT ${limit}
    `

    // Fall back to keyword-extracted disjunction (OR query) ranked by covering degree (ts_rank_cd)
    if (!results || results.length === 0) {
      const orQuery = buildOrQuery(query)
      if (orQuery) {
        results = await prisma.$queryRaw<SparseRow[]>`
          SELECT id, type, category,
            LEFT(content, 500) AS content,
            ts_rank_cd(search_vector, websearch_to_tsquery('english', ${orQuery})) AS score
          FROM evidence
          WHERE "caseId" = ${caseId}
            AND search_vector IS NOT NULL
            AND search_vector @@ websearch_to_tsquery('english', ${orQuery})
          ORDER BY score DESC
          LIMIT ${limit}
        `
      }
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
