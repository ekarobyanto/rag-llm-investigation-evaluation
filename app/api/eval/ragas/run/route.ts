import { NextResponse } from "next/server"
import { spawn } from "child_process"
import { join } from "path"
import { setActiveEvaluationStatus } from "@/lib/eval"
import { runNativeRagasEvaluation } from "@/lib/ragas"

export const maxDuration = 300

interface RunRagasBody {
  limit?: number
  method?: "sparse" | "dense" | "hybrid" | "all"
  difficulty?: "easy" | "medium" | "hard" | "all"
  force?: boolean
  scenarioId?: string
  logIds?: string[]
  engine?: "native" | "python"
}

export async function POST(req: Request) {
  try {
    const body: RunRagasBody = await req.json().catch(() => ({}))

    // If python engine explicitly requested and not in Docker runner
    if (body.engine === "python" || process.env.USE_PYTHON_RAGAS === "true") {
      try {
        const scriptPath = join(process.cwd(), "eval-pipeline", "run_ragas.py")
        const args = [scriptPath]
        if (body.limit && body.limit > 0) {
          args.push("--limit", String(body.limit))
        }
        if (body.method && body.method !== "all") {
          args.push("--method", body.method)
        }
        if (body.difficulty && body.difficulty !== "all") {
          args.push("--difficulty", body.difficulty)
        }
        if (body.scenarioId) {
          args.push("--scenario-id", body.scenarioId)
        }
        if (body.force) {
          args.push("--force")
        }

        return await new Promise<NextResponse>((resolve) => {
          const child = spawn("python", args, {
            cwd: process.cwd(),
            env: { ...process.env },
          })

          globalThis.__ragasChildProcess = child
          setActiveEvaluationStatus({
            isRunning: true,
            label: "Running Python RAGAS evaluation pipeline...",
            startedAt: Date.now(),
            type: "ragas",
          })

          let stdout = ""
          let stderr = ""

          child.stdout.on("data", (chunk) => {
            stdout += chunk.toString()
          })

          child.stderr.on("data", (chunk) => {
            stderr += chunk.toString()
          })

          child.on("close", (code) => {
            globalThis.__ragasChildProcess = undefined
            setActiveEvaluationStatus({ isRunning: false })

            if (code === 0) {
              resolve(
                NextResponse.json({
                  success: true,
                  message: "Python RAGAS evaluation completed successfully.",
                  output: stdout,
                  engine: "python",
                })
              )
            } else {
              resolve(
                NextResponse.json(
                  {
                    success: false,
                    error: `run_ragas.py exited with code ${code}`,
                    stderr,
                    stdout,
                  },
                  { status: 500 }
                )
              )
            }
          })

          child.on("error", async (err) => {
            globalThis.__ragasChildProcess = undefined
            console.warn(
              "Python spawn failed (likely running in container without python). Falling back to Native TypeScript Evaluator:",
              err.message
            )
            // Fallback to Native TS evaluator
            const fallbackRes = await runNativeRagasEvaluation(body)
            resolve(NextResponse.json({ ...fallbackRes, engine: "native-fallback" }))
          })
        })
      } catch (pythonErr: any) {
        console.warn("Failed to initialize python runner. Falling back to Native TS Evaluator:", pythonErr)
      }
    }

    // Default primary engine: Native TypeScript with OpenAI Judge & Prisma
    const result = await runNativeRagasEvaluation({
      limit: body.limit,
      method: body.method,
      difficulty: body.difficulty,
      force: body.force,
      scenarioId: body.scenarioId,
      logIds: body.logIds,
    })

    return NextResponse.json({
      ...result,
      engine: "native",
    })
  } catch (err: any) {
    console.error("Ragas evaluation route error:", err)
    return NextResponse.json(
      { success: false, error: err.message || String(err) },
      { status: 500 }
    )
  }
}
