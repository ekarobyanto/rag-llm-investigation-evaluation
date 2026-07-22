import { execSync, spawnSync } from "child_process";
import { join } from "path";
import { existsSync } from "fs";

function checkPythonDeps(): boolean {
  try {
    // Check if python can import ragas and datasets
    execSync("python -c \"import ragas, datasets\"", { stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

function main() {
  console.log("Checking Python dependencies (ragas, datasets)...");
  
  // 1. Check if Python dependencies are installed
  if (!checkPythonDeps()) {
    console.error("❌ Missing Python dependencies. Please install them by running:");
    console.error("pip install ragas datasets");
    process.exit(1);
  }
  console.log("✅ Dependencies verified.");

  const pipelineDir = join(process.cwd(), "eval-pipeline");
  const runRagasPath = join(pipelineDir, "run_ragas.py");
  const exportResultsPath = join(pipelineDir, "export_results.py");

  // Verify scripts exist
  if (!existsSync(runRagasPath)) {
    console.error(`❌ Could not find script at ${runRagasPath}`);
    process.exit(1);
  }
  if (!existsSync(exportResultsPath)) {
    console.error(`❌ Could not find script at ${exportResultsPath}`);
    process.exit(1);
  }

  // 2. Run eval-pipeline/run_ragas.py
  console.log(`\n🚀 Running ${runRagasPath} ...`);
  const runRes = spawnSync("python", [runRagasPath], { stdio: "inherit" });
  if (runRes.status !== 0) {
    console.error("❌ run_ragas.py failed with status", runRes.status);
    process.exit(1);
  }
  console.log("✅ run_ragas.py completed successfully.");

  // 3. Run eval-pipeline/export_results.py
  console.log(`\n🚀 Running ${exportResultsPath} ...`);
  const exportRes = spawnSync("python", [exportResultsPath], { stdio: "inherit" });
  if (exportRes.status !== 0) {
    console.error("❌ export_results.py failed with status", exportRes.status);
    process.exit(1);
  }
  console.log("✅ export_results.py completed successfully.");

  // 4. Print the exported file paths
  // The python script should ideally print this, but we'll also print a generic message
  console.log("\n🎉 Ragas evaluation and export completed successfully!");
  console.log("Check the eval-pipeline/ directory (or designated output folder) for the exported results.");
}

main();
