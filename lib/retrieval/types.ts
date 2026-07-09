export type RetrievalMethod = "sparse" | "dense" | "hybrid"

export interface RetrievedEvidenceItem {
  id: string
  type: string
  category: string
  content: string
  score: number
  sparseScore?: number
  denseScore?: number
  fusionScore?: number
}

export interface RetrievalResult {
  evidence: RetrievedEvidenceItem[]
  retrievalTimeMs: number
  embeddingTimeMs: number | null
  method: RetrievalMethod
  sparseScores?: number[]
  denseScores?: number[]
  fusionScores?: number[]
  fusionMethod?: string
}

export interface RetrievalOptions {
  limit?: number
  fusionMethod?: "rrf" | "weighted_sum"
  rrf_k?: number
  sparseWeight?: number
  denseWeight?: number
}
