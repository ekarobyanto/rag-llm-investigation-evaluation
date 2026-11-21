import { createHash } from "crypto"
import { readFileSync } from "fs"
import { join } from "path"

export const PROMPT_VERSION = "id-v3-evidence-v2"
export const CONTEXT_LIMIT = 10
export const CANDIDATE_DEPTH = 30
export const FTS_CONFIG = "simple"
export const EMBEDDING_MODEL = "text-embedding-3-small"
export const PRIMARY_EVALUATOR = "ragas-0.2.15"
export const SCENARIO_FILE = process.env.EVAL_SCENARIO_FILE || "scenario-v3.id.json"
export function datasetManifest() {
  const caseFile = SCENARIO_FILE === "scenario-v3.id.json" ? "id-ID/case-1.v3.json" : "case-1.json"
  const hash = (dir: string, file: string) => createHash("sha256").update(readFileSync(join(process.cwd(), dir, file))).digest("hex")
  const scenarioHash = hash("eval-scenarios", SCENARIO_FILE)
  const corpusHash = hash("cases-input", caseFile)
  return { datasetVersion: `${SCENARIO_FILE}:${scenarioHash}:${corpusHash}`, scenarioHash, corpusHash, caseFile, scenarioFile: SCENARIO_FILE }
}
export function requireReference(value: unknown, scenario: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Scenario ${scenario}: missing referenceAnswer`)
  return value
}
export function retrievalMetrics(orderedIds: string[], goldIds: string[], k: number) {
  const gold = new Set(goldIds)
  if (!gold.size) throw new Error("Missing per-question gold evidence labels")
  const top = [...new Set(orderedIds)].slice(0, k)
  const hits = top.filter(id => gold.has(id)).length
  return { precision: hits / k, recall: hits / gold.size, hit: hits > 0 ? 1 : 0, returnedCount: top.length }
}
export function finiteMean(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null
}

export function generationSettings(temperature = 0.2) {
  return { model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature, max_completion_tokens: 1000 }
}
export function frozenRunConfig() {
  return { ...generationSettings(), promptVersion: PROMPT_VERSION, contextLimit: CONTEXT_LIMIT,
    hybridCandidateDepth: CANDIDATE_DEPTH, fusion: "equal-rrf-60", ftsConfig: FTS_CONFIG,
    sparseQueryPolicy: "conjunction-then-zero-hit-or-english-stopwords-v1", embeddingModel: EMBEDDING_MODEL,
    embeddingDimensions: 1536, contextPolicy: "full-evidence-text", historyPolicy: "none" }
}
