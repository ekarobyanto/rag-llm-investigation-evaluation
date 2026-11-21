import "dotenv/config"
import { prisma } from "../lib/db"
import { generateEmbedding } from "../lib/embedding"
import { seedScenarios } from "../lib/eval"
import { datasetManifest } from "../lib/research"
async function main() {
  if (!process.argv.includes("--execute")) throw new Error("Paid embeddings require explicit --execute")
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY required")
  await seedScenarios()
  const { datasetVersion } = datasetManifest()
  const rows = await prisma.$queryRaw<Array<{ id: string; content: string }>>`
    SELECT DISTINCT e.id, e.content FROM evidence e JOIN evaluation_scenarios s ON s."caseId" = e."caseId"
    WHERE s."datasetVersion" = ${datasetVersion} AND e.embedding IS NULL ORDER BY e.id
  `
  for (const [index, row] of rows.entries()) {
    const vector = await generateEmbedding(row.content)
    await prisma.$executeRaw`UPDATE evidence SET embedding = ${JSON.stringify(vector)}::vector WHERE id = ${row.id}`
    console.log(`Embedded ${index + 1}/${rows.length}: ${row.id}`)
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
