import { NextResponse } from "next/server"
import { spawn } from "child_process"
import { join } from "path"
import { setActiveEvaluationStatus } from "@/lib/eval"

export const maxDuration = 300

interface RunRagasBody {
  limit?: number
  method?: "sparse" | "dense" | "hybrid" | "all"
  difficulty?: "easy" | "medium" | "hard" | "all"
  force?: boolean
  scenarioId?: string
}

export async function POST(req: Request) {
  try {
    const body: RunRagasBody = await req.json().catch(() => ({}))
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
        label: "Running RAGAS evaluation pipeline with judge reasoning...",
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
              message: "RAGAS evaluation completed successfully.",
              output: stdout,
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

      child.on("error", (err) => {
        globalThis.__ragasChildProcess = undefined
        setActiveEvaluationStatus({ isRunning: false })

        resolve(
          NextResponse.json(
            {
              success: false,
              error: err.message || "Failed to start python process",
            },
            { status: 500 }
          )
        )
      })
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || String(err) },
      { status: 500 }
    )
  }
}
