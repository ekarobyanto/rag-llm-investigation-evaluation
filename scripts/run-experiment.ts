import "dotenv/config"
import { randomUUID } from "crypto"
import { seedScenarios, runAllScenarios, aggregateMetrics, cancelEvaluation } from "../lib/eval"
import { prisma } from "../lib/db"
import { datasetManifest } from "../lib/research"
process.on("SIGINT", cancelEvaluation)
async function main() {
  const args = process.argv.slice(2)
  const value = (name: string) => args[args.indexOf(name) + 1]
  if (!args.includes("--execute")) throw new Error("Paid experiment requires explicit --execute. Use npm run test:research for offline fixtures.")
  const runId = args.includes("--run-id") ? value("--run-id") : randomUUID()
  const runs = args.includes("--runs") ? Number(value("--runs")) : 3
  if (![1, 2, 3].includes(runs)) throw new Error("--runs must be 1, 2, or 3")
  console.log({ runId, ...datasetManifest(), repetitions: runs })
  await seedScenarios()
  let failed = 0
  for (let repetition = 1; repetition <= runs; repetition++) {
    const result = await runAllScenarios(["sparse", "dense", "hybrid"], undefined, { runId, repetition })
    failed += result.failedAttempts
    if (result.cancelled) throw new Error("Experiment cancelled")
  }
  console.log(JSON.stringify(await aggregateMetrics(runId), null, 2))
  if (failed) throw new Error(`${failed} attempts failed; inspect logs before reporting completeness`)
}
main().catch(e => { console.error(e.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
