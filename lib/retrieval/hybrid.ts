import { sparseRetrieve } from "./sparse"
import { denseRetrieve } from "./dense"
import { fuseRanks } from "./fusion"
import { CANDIDATE_DEPTH, CONTEXT_LIMIT } from "../research"
import type { RetrievalResult, RetrievalOptions } from "./types"
export async function hybridRetrieve(caseId: string, query: string, options?: RetrievalOptions, deps = { sparseRetrieve, denseRetrieve }): Promise<RetrievalResult> {
  const start = performance.now()
  // A failed arm rejects the whole attempt, rather than becoming a single-arm Hybrid run.
  const [sparse, dense] = await Promise.all([
    deps.sparseRetrieve(caseId, query, { limit: CANDIDATE_DEPTH }),
    deps.denseRetrieve(caseId, query, { limit: CANDIDATE_DEPTH }),
  ])
  const evidence = fuseRanks([sparse.evidence, dense.evidence], options?.limit ?? CONTEXT_LIMIT)
  return { evidence, method: "hybrid", retrievalTimeMs: Math.round(performance.now() - start),
    embeddingTimeMs: dense.embeddingTimeMs, candidateDepth: CANDIDATE_DEPTH,
    sparseScores: evidence.map(e => e.sparseScore ?? 0), denseScores: evidence.map(e => e.denseScore ?? 0),
    fusionScores: evidence.map(e => e.score), fusionMethod: "rrf" }
}
