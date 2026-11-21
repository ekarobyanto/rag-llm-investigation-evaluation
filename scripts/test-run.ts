import { seedScenarios, runScenario } from "../lib/eval";
import { prisma } from "../lib/db";
import { datasetManifest } from "../lib/research";

async function testRun() {
  if (!process.argv.includes("--execute")) throw new Error("Paid smoke run requires --execute; use npm run test:research for offline fixtures");
  console.log("Seeding scenarios...");
  await seedScenarios();
  
  const scenario = await prisma.evaluationScenario.findFirst({ where: { datasetVersion: datasetManifest().datasetVersion } });
  if (!scenario) {
    console.log("No scenario found.");
    return;
  }
  
  console.log(`Running scenario: ${scenario.id}`);
  const start = Date.now();
  const res = await runScenario(scenario.id, "dense");
  console.log(`Completed in ${Date.now() - start}ms`);
  console.log("Result:", JSON.stringify(res, null, 2));
}

testRun().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect());
