"use client"

import { useEffect, useState } from "react"

interface Scenario {
  id: string
  prompt: string
  difficulty: string
  case: { title: string }
}

interface AggregateRow {
  retrievalMethod: string
  count: number
  avgCorrectness: number
  avgPrecision: number
  avgRecall: number
  topKAccuracyRate: number
  avgResponseTimeMs: number
  avgTokens: number
  totalCost: number
}

interface RecentLog {
  id: string
  retrievalMethod: string
  userPrompt: string
  correctnessScore: number | null
  retrievalPrecision: number | null
  retrievalRecall: number | null
  topKAccuracy: boolean | null
  totalResponseTimeMs: number
  totalTokens: number
  estimatedCost: number | null
  createdAt: string
  scenario: { difficulty: string; case: { title: string } } | null
}

const METHOD_COLORS: Record<string, string> = {
  sparse: "bg-amber-100 text-amber-800",
  dense: "bg-blue-100 text-blue-800",
  hybrid: "bg-purple-100 text-purple-800",
}

const METHOD_LABELS: Record<string, string> = {
  sparse: "Sparse",
  dense: "Dense",
  hybrid: "Hybrid",
}

export default function EvalPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [aggregate, setAggregate] = useState<AggregateRow[]>([])
  const [recent, setRecent] = useState<RecentLog[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadAll = async () => {
    try {
      const [scRes, resRes] = await Promise.all([
        fetch("/api/eval/scenarios").then((r) => r.json()),
        fetch("/api/eval/results").then((r) => r.json()),
      ])
      setScenarios(Array.isArray(scRes) ? scRes : [])
      setAggregate(Array.isArray(resRes?.aggregate) ? resRes.aggregate : [])
      setRecent(Array.isArray(resRes?.recent) ? resRes.recent : [])
    } catch (err) {
      console.error("Failed to load eval data:", err)
      setScenarios([])
      setAggregate([])
      setRecent([])
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const seedScenarios = async () => {
    setBusy("Seeding scenarios...")
    try {
      const res = await fetch("/api/eval/scenarios", { method: "POST" })
      const data = await res.json()
      setMessage(`Seeded ${data.created}/${data.total} scenarios. Skipped: ${data.skipped}.`)
      await loadAll()
    } finally {
      setBusy(null)
    }
  }

  const runMethods = async (methods: string[]) => {
    const label = methods.length === 3 ? "All Methods" : methods.map((m) => METHOD_LABELS[m] ?? m).join(", ")
    setBusy(`Running all scenarios (${label})... this may take minutes`)
    try {
      const res = await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ methods }),
      })
      const data = await res.json()
      if (data.error) {
        setMessage(`Error: ${data.error}`)
      } else {
        setMessage(
          `Completed ${data.results?.length ?? 0} runs in ${(data.totalDurationMs / 1000).toFixed(
            1
          )}s. Cost: $${data.totalCost?.toFixed(4)}`
        )
      }
      await loadAll()
    } finally {
      setBusy(null)
    }
  }

  const runOne = async (scenarioId: string) => {
    setBusy("Running scenario (all methods)...")
    try {
      await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, methods: ["sparse", "dense", "hybrid"] }),
      })
      setMessage("Scenario done.")
      await loadAll()
    } finally {
      setBusy(null)
    }
  }

  const clearResults = async () => {
    if (!confirm("Delete all evaluation interaction logs?")) return
    setBusy("Clearing...")
    try {
      await fetch("/api/eval/results", { method: "DELETE" })
      setMessage("Cleared.")
      await loadAll()
    } finally {
      setBusy(null)
    }
  }

  const fmt = (n: number, digits = 3) => (Number.isFinite(n) ? n.toFixed(digits) : "—")
  const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—")

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Evaluation Console</h1>
            <p className="text-sm text-gray-500">
              Sparse vs Dense vs Hybrid — Comparative Evaluation
            </p>
          </div>
          <a
            href="/"
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition text-sm"
          >
            Back to App
          </a>
        </header>

        <div className="bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-2 items-center">
          <button
            onClick={seedScenarios}
            disabled={busy !== null}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            Seed Scenarios from JSON
          </button>
          <button
            onClick={() => runMethods(["sparse", "dense", "hybrid"])}
            disabled={busy !== null || scenarios.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition disabled:bg-gray-400"
          >
            Run All (3 Methods)
          </button>
          <button
            onClick={() => runMethods(["sparse"])}
            disabled={busy !== null || scenarios.length === 0}
            className="px-4 py-2 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 transition disabled:bg-gray-400"
          >
            Sparse Only
          </button>
          <button
            onClick={() => runMethods(["dense"])}
            disabled={busy !== null || scenarios.length === 0}
            className="px-4 py-2 bg-blue-700 text-white rounded text-sm hover:bg-blue-800 transition disabled:bg-gray-400"
          >
            Dense Only
          </button>
          <button
            onClick={() => runMethods(["hybrid"])}
            disabled={busy !== null || scenarios.length === 0}
            className="px-4 py-2 bg-purple-700 text-white rounded text-sm hover:bg-purple-800 transition disabled:bg-gray-400"
          >
            Hybrid Only
          </button>
          <button
            onClick={clearResults}
            disabled={busy !== null}
            className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition disabled:bg-gray-400 ml-auto"
          >
            Clear Eval Logs
          </button>
        </div>

        {busy && (
          <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-2 rounded mb-4 text-sm">
            {busy}
          </div>
        )}
        {message && (
          <div className="bg-blue-50 border border-blue-300 text-blue-800 px-4 py-2 rounded mb-4 text-sm">
            {message}
          </div>
        )}

        <section className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="font-bold text-gray-900 mb-3">Aggregate Metrics — Sparse vs Dense vs Hybrid</h2>
          {aggregate.length === 0 || aggregate.every((a) => a.count === 0) ? (
            <p className="text-sm text-gray-500">No evaluation runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-gray-500">
                    <th className="py-2 pr-4">Method</th>
                    <th className="py-2 pr-4">N</th>
                    <th className="py-2 pr-4">Correctness</th>
                    <th className="py-2 pr-4">Precision</th>
                    <th className="py-2 pr-4">Recall</th>
                    <th className="py-2 pr-4">Top-K Acc</th>
                    <th className="py-2 pr-4">Avg Time</th>
                    <th className="py-2 pr-4">Avg Tokens</th>
                    <th className="py-2 pr-4">Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregate.map((a) => (
                    <tr key={a.retrievalMethod} className="border-b">
                      <td className="py-2 pr-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${METHOD_COLORS[a.retrievalMethod] ?? "bg-gray-100 text-gray-800"}`}>
                          {METHOD_LABELS[a.retrievalMethod] ?? a.retrievalMethod}
                        </span>
                      </td>
                      <td className="py-2 pr-4">{a.count}</td>
                      <td className="py-2 pr-4">{pct(a.avgCorrectness)}</td>
                      <td className="py-2 pr-4">{pct(a.avgPrecision)}</td>
                      <td className="py-2 pr-4">{pct(a.avgRecall)}</td>
                      <td className="py-2 pr-4">{pct(a.topKAccuracyRate)}</td>
                      <td className="py-2 pr-4">{fmt(a.avgResponseTimeMs, 0)}ms</td>
                      <td className="py-2 pr-4">{fmt(a.avgTokens, 0)}</td>
                      <td className="py-2 pr-4">${fmt(a.totalCost, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="font-bold text-gray-900 mb-3">
            Scenarios ({scenarios.length})
          </h2>
          {scenarios.length === 0 ? (
            <p className="text-sm text-gray-500">
              No scenarios. Click &quot;Seed Scenarios from JSON&quot; to load from{" "}
              <code>eval-scenarios/</code>.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-gray-500">
                    <th className="py-2 pr-4">Case</th>
                    <th className="py-2 pr-4">Difficulty</th>
                    <th className="py-2 pr-4">Prompt</th>
                    <th className="py-2 pr-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="py-2 pr-4 max-w-xs truncate">{s.case.title}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            s.difficulty === "easy"
                              ? "bg-green-100 text-green-800"
                              : s.difficulty === "medium"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {s.difficulty}
                        </span>
                      </td>
                      <td className="py-2 pr-4 max-w-md">{s.prompt}</td>
                      <td className="py-2 pr-4">
                        <button
                          onClick={() => runOne(s.id)}
                          disabled={busy !== null}
                          className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs hover:bg-blue-200 transition disabled:opacity-50"
                        >
                          Run All Methods
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg shadow p-4">
          <h2 className="font-bold text-gray-900 mb-3">Recent Runs (last 100)</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500">No runs yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-gray-500">
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">Case</th>
                    <th className="py-2 pr-4">Method</th>
                    <th className="py-2 pr-4">Diff</th>
                    <th className="py-2 pr-4">Prompt</th>
                    <th className="py-2 pr-4">Correct</th>
                    <th className="py-2 pr-4">Prec</th>
                    <th className="py-2 pr-4">Recall</th>
                    <th className="py-2 pr-4">Top-K</th>
                    <th className="py-2 pr-4">Time</th>
                    <th className="py-2 pr-4">Tokens</th>
                    <th className="py-2 pr-4">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-b">
                      <td className="py-2 pr-4 text-xs">
                        {new Date(r.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2 pr-4 max-w-xs truncate text-xs">
                        {r.scenario?.case.title ?? "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            METHOD_COLORS[r.retrievalMethod] ?? "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {METHOD_LABELS[r.retrievalMethod] ?? r.retrievalMethod}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-xs">{r.scenario?.difficulty ?? "—"}</td>
                      <td className="py-2 pr-4 max-w-xs truncate text-xs">
                        {r.userPrompt}
                      </td>
                      <td className="py-2 pr-4">
                        {r.correctnessScore === null
                          ? "—"
                          : r.correctnessScore === 1
                          ? "✓"
                          : "✗"}
                      </td>
                      <td className="py-2 pr-4">{r.retrievalPrecision !== null ? pct(r.retrievalPrecision) : "—"}</td>
                      <td className="py-2 pr-4">{r.retrievalRecall !== null ? pct(r.retrievalRecall) : "—"}</td>
                      <td className="py-2 pr-4">
                        {r.topKAccuracy === null ? "—" : r.topKAccuracy ? "✓" : "✗"}
                      </td>
                      <td className="py-2 pr-4 text-xs">{r.totalResponseTimeMs}ms</td>
                      <td className="py-2 pr-4 text-xs">{r.totalTokens}</td>
                      <td className="py-2 pr-4 text-xs">
                        ${r.estimatedCost?.toFixed(4) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
