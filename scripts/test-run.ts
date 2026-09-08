import { seedScenarios, runScenario } from "../lib/eval";
import { prisma } from "../lib/db";

async function testRun() {
  console.log("Seeding scenarios...");
  await seedScenarios();
  
  const scenario = await prisma.evaluationScenario.findFirst();
  if (!scenario) {
    console.log("No scenario found.");
    return;
  }
  
  console.log(`Running scenario: ${scenario.id}`);
  const start = Date.now();
  const res = await runScenario(scenario.id, "sparse");
  console.log(`Completed in ${Date.now() - start}ms`);
  console.log(`Estimated cost: $${res.estimatedCost}`);
  console.log("Result:", JSON.stringify(res, null, 2));
}

testRun().catch(console.error).finally(() => process.exit(0));
