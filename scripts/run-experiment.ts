import { seedScenarios, runAllScenarios, aggregateMetrics } from "../lib/eval";
import type { RetrievalMethod } from "../lib/retrieval";

async function main() {
  const args = process.argv.slice(2);
  let methods: RetrievalMethod[] = ["sparse", "dense", "hybrid"];
  let runs = 1;
  let skipSeed = false;

  // Simple CLI argument parsing
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--methods" && args[i + 1]) {
      methods = args[i + 1].split(",") as RetrievalMethod[];
      i++;
    } else if (args[i] === "--runs" && args[i + 1]) {
      runs = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--skip-seed") {
      skipSeed = true;
    }
  }

  console.log("==========================================");
  console.log("Starting experiment with configuration:");
  console.log(`- Methods: ${methods.join(", ")}`);
  console.log(`- Runs: ${runs}`);
  console.log(`- Skip Seed: ${skipSeed}`);
  console.log("==========================================\n");

  // 1. Seed evaluation scenarios
  if (!skipSeed) {
    console.log("Seeding scenarios from eval-scenarios/scenarios.json...");
    try {
      const summary = await seedScenarios();
      console.log(`✅ Seeded ${summary.created} scenarios. Skipped: ${summary.skipped}. Total: ${summary.total}`);
      if (summary.errors && summary.errors.length > 0) {
        console.warn("⚠️ Errors during seeding:");
        summary.errors.forEach((e) => console.warn(`  - ${e}`));
      }
    } catch (err) {
      console.error("❌ Failed to seed scenarios:", err);
      process.exit(1);
    }
  }

  let totalExperimentCost = 0;
  let totalExperimentDurationMs = 0;

  // 2. Run all scenarios
  for (let run = 1; run <= runs; run++) {
    console.log(`\n--- Run ${run}/${runs} ---`);
    console.log(`Running all scenarios for methods: ${methods.join(", ")}...`);
    try {
      // Uses the provided runAllScenarios which executes everything and collects results.
      const runResult = await runAllScenarios(methods);
      
      totalExperimentCost += runResult.totalCost;
      totalExperimentDurationMs += runResult.totalDurationMs;
      
      console.log(`✅ Run ${run} completed in ${runResult.totalDurationMs}ms`);
      console.log(`💰 Run ${run} estimated cost: $${runResult.totalCost.toFixed(5)}`);
    } catch (err) {
      console.error(`❌ Run ${run} failed:`, err);
    }
  }

  // 3. Aggregate and display metrics
  console.log("\nAggregating metrics...");
  try {
    const metrics = await aggregateMetrics();
    
    // 4. Print a formatted summary table to console
    console.log("\n=================== FINAL SUMMARY ===================");
    console.table(metrics);
    console.log("=====================================================");
    
    // Print total cost and total duration at the end
    console.log(`Total Experiment Duration: ${totalExperimentDurationMs} ms`);
    console.log(`Total Estimated Cost: $${totalExperimentCost.toFixed(5)}`);
  } catch (err) {
    console.error("❌ Failed to aggregate metrics:", err);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
