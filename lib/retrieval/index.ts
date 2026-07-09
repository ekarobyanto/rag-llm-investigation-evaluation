import { sparseRetrieve } from "./sparse"
import { denseRetrieve } from "./dense"
import { hybridRetrieve } from "./hybrid"
import type { RetrievalMethod, RetrievalResult, RetrievalOptions } from "./types"

export type { RetrievalMethod, RetrievalResult, RetrievalOptions } from "./types"
export type { RetrievedEvidenceItem } from "./types"

export async function retrieve(
  method: RetrievalMethod,
  caseId: string,
  query: string,
  options?: RetrievalOptions
): Promise<RetrievalResult> {
  switch (method) {
    case "sparse":
      return sparseRetrieve(caseId, query, options)
    case "dense":
      return denseRetrieve(caseId, query, options)
    case "hybrid":
      return hybridRetrieve(caseId, query, options)
    default:
      throw new Error(`Unknown retrieval method: ${method}`)
  }
}
