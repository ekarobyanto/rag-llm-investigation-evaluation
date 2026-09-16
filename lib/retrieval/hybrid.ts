import { sparseRetrieve } from "./sparse"
import { denseRetrieve } from "./dense"
import type { RetrievalResult, RetrievalOptions, RetrievedEvidenceItem } from "./types"

interface FusionCandidate {
  item: RetrievedEvidenceItem
  sparseRank: number
  denseRank: number
  sparseScore: number
  denseScore: number
}

export async function hybridRetrieve(
  caseId: string,
  query: string,
  options?: RetrievalOptions
): Promise<RetrievalResult> {
  const limit = options?.limit ?? 5
  const overFetch = Math.max(limit * 3, 20)
  const fusionMethod = options?.fusionMethod ?? "rrf"
  const rrf_k = options?.rrf_k ?? 60
  const sparseWeight = options?.sparseWeight ?? 0.25
  const denseWeight = options?.denseWeight ?? 0.75
  const startTime = Date.now()

  try {
    // Run sparse and dense retrieval in parallel with over-fetching
    const [sparseResult, denseResult] = await Promise.all([
      sparseRetrieve(caseId, query, { limit: overFetch }),
      denseRetrieve(caseId, query, { limit: overFetch }),
    ])

    const embeddingTimeMs = denseResult.embeddingTimeMs

    // Build a map of all unique documents
    const candidateMap = new Map<string, FusionCandidate>()
    const unretrievedRank = 9999

    // Index sparse results
    sparseResult.evidence.forEach((item, idx) => {
      candidateMap.set(item.id, {
        item: { ...item },
        sparseRank: idx + 1,
        denseRank: unretrievedRank,
        sparseScore: item.sparseScore ?? 0,
        denseScore: 0,
      })
    })

    // Index dense results, merging with sparse if same doc found
    denseResult.evidence.forEach((item, idx) => {
      const existing = candidateMap.get(item.id)
      if (existing) {
        existing.denseRank = idx + 1
        existing.denseScore = item.denseScore ?? 0
        existing.item.denseScore = item.denseScore
      } else {
        candidateMap.set(item.id, {
          item: { ...item, sparseScore: 0 },
          sparseRank: unretrievedRank,
          denseRank: idx + 1,
          sparseScore: 0,
          denseScore: item.denseScore ?? 0,
        })
      }
    })

    // Compute fusion scores
    const candidates = Array.from(candidateMap.values())

    if (fusionMethod === "rrf") {
      // Weighted Reciprocal Rank Fusion:
      // Heavy weight (0.75) on Dense semantic embeddings to prevent noisy BM25 hits from displacing genuine clues.
      // Unretrieved items in an arm get 0 points from that arm rather than artificial penalty points.
      for (const c of candidates) {
        const denseTerm = c.denseRank <= overFetch ? denseWeight / (rrf_k + c.denseRank) : 0
        const sparseTerm = c.sparseRank <= overFetch ? sparseWeight / (rrf_k + c.sparseRank) : 0
        const agreementBonus = c.denseRank <= overFetch && c.sparseRank <= overFetch ? 0.003 : 0

        c.item.fusionScore = denseTerm + sparseTerm + agreementBonus
        c.item.score = c.item.fusionScore
        c.item.sparseScore = c.sparseScore
        c.item.denseScore = c.denseScore
      }
    } else {
      // Weighted sum with min-max normalization
      const maxSparse = Math.max(...candidates.map((c) => c.sparseScore), 1e-10)
      const maxDense = Math.max(...candidates.map((c) => c.denseScore), 1e-10)

      for (const c of candidates) {
        const normSparse = c.sparseScore / maxSparse
        const normDense = c.denseScore / maxDense
        c.item.fusionScore = sparseWeight * normSparse + denseWeight * normDense
        c.item.score = c.item.fusionScore
        c.item.sparseScore = c.sparseScore
        c.item.denseScore = c.denseScore
      }
    }

    // Sort by fusion score descending, take top K
    candidates.sort((a, b) => (b.item.fusionScore ?? 0) - (a.item.fusionScore ?? 0))
    const topK = candidates.slice(0, limit)
    const evidence = topK.map((c) => c.item)

    return {
      evidence,
      retrievalTimeMs: Date.now() - startTime,
      embeddingTimeMs,
      method: "hybrid",
      sparseScores: evidence.map((e) => e.sparseScore ?? 0),
      denseScores: evidence.map((e) => e.denseScore ?? 0),
      fusionScores: evidence.map((e) => e.fusionScore ?? 0),
      fusionMethod,
    }
  } catch (error) {
    console.error("Hybrid retrieval error:", error)
    return {
      evidence: [],
      retrievalTimeMs: Date.now() - startTime,
      embeddingTimeMs: null,
      method: "hybrid",
    }
  }
}
