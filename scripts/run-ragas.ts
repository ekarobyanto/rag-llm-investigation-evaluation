import { spawnSync } from "child_process"
const result = spawnSync(process.env.PYTHON || "python", ["eval-pipeline/run_ragas.py", ...process.argv.slice(2)], { stdio: "inherit", windowsHide: true })
process.exitCode = result.status ?? 1
