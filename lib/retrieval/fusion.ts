import type { RetrievedEvidenceItem } from "./types"
/** Equal-weight RRF. A document absent from an arm contributes zero. */
export function fuseRanks(lists: RetrievedEvidenceItem[][], limit = 10): RetrievedEvidenceItem[] {
  const candidates = new Map<string, RetrievedEvidenceItem>()
  for (const list of lists) {
    const seen = new Set<string>()
    let rank = 0
    for (const item of list) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      rank++
      const prior = candidates.get(item.id)
      const fusionScore = (prior?.fusionScore ?? 0) + 1 / (60 + rank)
      candidates.set(item.id, { ...prior, ...item, score: fusionScore, fusionScore })
    }
  }
  return [...candidates.values()].sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, limit)
}
