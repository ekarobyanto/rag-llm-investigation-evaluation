import { spawn } from "child_process"
import { join } from "path"
import { selectedScope, setActiveEvaluationStatus } from "./eval"
export interface RunRagasOptions {
  runId?: string; limit?: number; method?: "sparse" | "dense" | "hybrid" | "all"
  difficulty?: "easy" | "medium" | "hard" | "all"; force?: boolean; scenarioId?: string; logIds?: string[]
}
export async function runNativeRagasEvaluation(options: RunRagasOptions = {}) {
  const scope = await selectedScope(options.runId)
  const args = [join(process.cwd(), "eval-pipeline/run_ragas.py"), "--run-id", scope.runId, "--dataset-version", scope.datasetVersion]
  if (options.limit) args.push("--limit", String(options.limit))
  if (options.method && options.method !== "all") args.push("--method", options.method)
  if (options.difficulty && options.difficulty !== "all") args.push("--difficulty", options.difficulty)
  if (options.scenarioId) args.push("--scenario-id", options.scenarioId)
  if (options.logIds?.length) args.push("--log-ids", options.logIds.join(","))
  if (options.force) args.push("--force")
  setActiveEvaluationStatus({ isRunning: true, type: "ragas", label: "Scoring saved answers with canonical RAGAS" })
  try {
    return await new Promise<{ success: boolean; message: string; engine: string }>((resolve, reject) => {
      const child = spawn(process.env.PYTHON || "python", args, { cwd: process.cwd(), env: process.env, windowsHide: true })
      globalThis.__ragasChildProcess = child
      let output = ""
      child.stdout.on("data", chunk => { output += chunk.toString() })
      child.stderr.on("data", chunk => { output += chunk.toString() })
      child.once("error", reject)
      child.once("close", code => code === 0 ? resolve({ success: true, message: output, engine: "ragas-0.2.15" }) : reject(new Error(`Canonical RAGAS failed (${code}): ${output}`)))
    })
  } finally { globalThis.__ragasChildProcess = undefined; setActiveEvaluationStatus({ isRunning: false }) }
}
