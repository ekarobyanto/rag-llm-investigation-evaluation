"use client"

import { useEffect, useState, useMemo } from "react"
import {
  Activity,
  Play,
  RotateCw,
  Trash2,
  Cpu,
  Database,
  Sparkles,
  Clock,
  Coins,
  Target,
  Search,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Layers,
  BarChart3,
  Server,
  SlidersHorizontal,
} from "lucide-react"

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

const METHOD_THEMES: Record<
  string,
  { label: string; text: string; bg: string; border: string; bar: string; badge: string }
> = {
  sparse: {
    label: "Sparse (BM25)",
    text: "text-[#ff9900]",
    bg: "bg-[#ff9900]/10",
    border: "border-[#ff9900]/30",
    bar: "bg-[#ff9900]",
    badge: "bg-[#332200] text-[#ff9900] border border-[#ff9900]/40",
  },
  dense: {
    label: "Dense (HNSW)",
    text: "text-[#5794f2]",
    bg: "bg-[#5794f2]/10",
    border: "border-[#5794f2]/30",
    bar: "bg-[#5794f2]",
    badge: "bg-[#112240] text-[#5794f2] border border-[#5794f2]/40",
  },
  hybrid: {
    label: "Hybrid (RRF)",
    text: "text-[#b877d9]",
    bg: "bg-[#b877d9]/10",
    border: "border-[#b877d9]/30",
    bar: "bg-[#b877d9]",
    badge: "bg-[#271536] text-[#b877d9] border border-[#b877d9]/40",
  },
}

export default function EvalPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [aggregate, setAggregate] = useState<AggregateRow[]>([])
  const [recent, setRecent] = useState<RecentLog[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [searchFilter, setSearchFilter] = useState("")
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)

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
    setBusy("Seeding scenario benchmark dataset from JSON...")
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
    const label = methods.length === 3 ? "All 3 Engines (Sparse, Dense, Hybrid)" : methods.join(", ")
    setBusy(`Running benchmark pipeline (${label})...`)
    try {
      const res = await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ methods }),
      })
      const data = await res.json()
      if (data.error) {
        setMessage(`Benchmark Error: ${data.error}`)
      } else {
        setMessage(
          `Completed ${data.results?.length ?? 0} evaluation runs in ${(
            data.totalDurationMs / 1000
          ).toFixed(1)}s. Total Cost: $${data.totalCost?.toFixed(4)}`
        )
      }
      await loadAll()
    } finally {
      setBusy(null)
    }
  }

  const runOne = async (scenarioId: string) => {
    setBusy("Executing single scenario across all 3 methods...")
    try {
      await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, methods: ["sparse", "dense", "hybrid"] }),
      })
      setMessage("Scenario benchmark run complete.")
      await loadAll()
    } finally {
      setBusy(null)
    }
  }

  const clearResults = async () => {
    if (!confirm("Are you sure you want to flush all evaluation interaction telemetry logs?")) return
    setBusy("Flushing evaluation telemetry logs...")
    try {
      await fetch("/api/eval/results", { method: "DELETE" })
      setMessage("Telemetry database cleared.")
      await loadAll()
    } finally {
      setBusy(null)
    }
  }

  const fmt = (n: number, digits = 3) => (Number.isFinite(n) ? n.toFixed(digits) : "—")
  const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—")

  // High-level KPI aggregates
  const globalStats = useMemo(() => {
    if (aggregate.length === 0) return null
    const totalRuns = aggregate.reduce((acc, a) => acc + a.count, 0)
    if (totalRuns === 0) return null

    const avgPrec = aggregate.reduce((acc, a) => acc + a.avgPrecision * a.count, 0) / totalRuns
    const avgRec = aggregate.reduce((acc, a) => acc + a.avgRecall * a.count, 0) / totalRuns
    const avgLat = aggregate.reduce((acc, a) => acc + a.avgResponseTimeMs * a.count, 0) / totalRuns
    const totalCost = aggregate.reduce((acc, a) => acc + a.totalCost, 0)
    const avgAcc = aggregate.reduce((acc, a) => acc + a.topKAccuracyRate * a.count, 0) / totalRuns

    return { totalRuns, avgPrec, avgRec, avgLat, totalCost, avgAcc }
  }, [aggregate])

  // Filtered recent logs
  const filteredRecent = useMemo(() => {
    return recent.filter((r) => {
      if (methodFilter !== "all" && r.retrievalMethod !== methodFilter) return false
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase()
        return (
          r.userPrompt.toLowerCase().includes(q) ||
          r.retrievalMethod.toLowerCase().includes(q) ||
          (r.scenario?.case.title.toLowerCase().includes(q) ?? false) ||
          (r.scenario?.difficulty.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  }, [recent, methodFilter, searchFilter])

  return (
    <div className="min-h-screen bg-[#0b0c0e] text-[#d8d9da] font-sans select-none pb-12">
      {/* Top Grafana Navigation & Telemetry Bar */}
      <header className="bg-[#141619] border-b border-[#22252b] px-6 py-3 shadow-md sticky top-0 z-30">
        <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1f2328] hover:bg-[#2b3036] text-[#c7d0d9] text-xs font-mono border border-[#333842] transition"
              title="Return to Investigation Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Investigation App</span>
            </a>

            <div className="h-5 w-px bg-[#262930]" />

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#1f2328] border border-[#ff9900]/40 flex items-center justify-center text-[#ff9900]">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-[#1f2328] text-[#ff9900] border border-[#ff9900]/30 font-bold">
                    RAG BENCHMARK DASHBOARD
                  </span>
                  <span className="text-xs text-[#8e9297] font-mono">
                    Node: <span className="text-[#d8d9da]">PostgreSQL (pgvector 1536)</span>
                  </span>
                </div>
                <h1 className="text-base font-bold text-white tracking-tight leading-tight font-mono">
                  Observability & Evaluation Console
                </h1>
              </div>
            </div>
          </div>

          {/* Status Telemetry */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 bg-[#181b1f] border border-[#262930] px-3 py-1.5 rounded">
              <div
                className={`w-2 h-2 rounded-full ${
                  busy ? "bg-[#ff9900] animate-ping" : "bg-[#73bf69]"
                }`}
              />
              <span className="text-[#8e9297] uppercase">System State:</span>
              <span className={`font-bold ${busy ? "text-[#ff9900]" : "text-[#73bf69]"}`}>
                {busy ? "RUNNING PIPELINE" : "STANDBY // HEALTHY"}
              </span>
            </div>

            <button
              onClick={loadAll}
              disabled={busy !== null}
              className="p-1.5 rounded bg-[#1f2328] border border-[#2b3036] text-[#c7d0d9] hover:text-white transition"
              title="Refresh telemetry"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard Container */}
      <div className="max-w-[1920px] mx-auto px-6 pt-6 space-y-6">
        {/* Grafana Action Control Strip */}
        <div className="bg-[#141619] border border-[#22252b] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={seedScenarios}
              disabled={busy !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#202328] hover:bg-[#2b3038] text-[#c7d0d9] hover:text-white text-xs font-mono font-semibold border border-[#333842] transition disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5 text-[#5794f2]" />
              <span>Seed Scenarios (JSON)</span>
            </button>

            <div className="h-5 w-px bg-[#262930] mx-1" />

            <button
              onClick={() => runMethods(["sparse", "dense", "hybrid"])}
              disabled={busy !== null || scenarios.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#73bf69] hover:bg-[#86d97a] text-[#0b0c0e] text-xs font-mono font-bold transition disabled:opacity-50 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run All (3 Methods)</span>
            </button>

            <button
              onClick={() => runMethods(["sparse"])}
              disabled={busy !== null || scenarios.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2a1c0d] hover:bg-[#3d2914] text-[#ff9900] text-xs font-mono font-semibold border border-[#ff9900]/40 transition disabled:opacity-50"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff9900]" />
              <span>Sparse Only</span>
            </button>

            <button
              onClick={() => runMethods(["dense"])}
              disabled={busy !== null || scenarios.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#101d33] hover:bg-[#182c4d] text-[#5794f2] text-xs font-mono font-semibold border border-[#5794f2]/40 transition disabled:opacity-50"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#5794f2]" />
              <span>Dense Only</span>
            </button>

            <button
              onClick={() => runMethods(["hybrid"])}
              disabled={busy !== null || scenarios.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#241330] hover:bg-[#371d4a] text-[#b877d9] text-xs font-mono font-semibold border border-[#b877d9]/40 transition disabled:opacity-50"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#b877d9]" />
              <span>Hybrid Only</span>
            </button>
          </div>

          <button
            onClick={clearResults}
            disabled={busy !== null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2e1518] hover:bg-[#3d1a1f] text-[#f2495c] text-xs font-mono border border-[#f2495c]/30 transition disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>

        {/* Status / Alert Banner */}
        {busy && (
          <div className="bg-[#241c0e] border border-[#ff9900]/40 text-[#ff9900] px-4 py-2.5 rounded-lg text-xs font-mono flex items-center gap-2 animate-pulse">
            <Activity className="w-4 h-4 shrink-0" />
            <span>{busy}</span>
          </div>
        )}
        {message && !busy && (
          <div className="bg-[#122238] border border-[#5794f2]/40 text-[#5794f2] px-4 py-2.5 rounded-lg text-xs font-mono flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="text-[#8e9297] hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Row 1: High-Level Stat Panels (Grafana Big Numbers) */}
        {globalStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 space-y-1 relative overflow-hidden">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#8e9297] flex items-center justify-between">
                <span>Total Benchmark Executions</span>
                <Server className="w-3.5 h-3.5 text-[#5794f2]" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {globalStats.totalRuns}
              </div>
              <div className="text-[11px] font-mono text-[#8e9297]">Across all engines</div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#5794f2]" />
            </div>

            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 space-y-1 relative overflow-hidden">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#8e9297] flex items-center justify-between">
                <span>Avg Precision</span>
                <Target className="w-3.5 h-3.5 text-[#73bf69]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#73bf69]">
                {pct(globalStats.avgPrec)}
              </div>
              <div className="text-[11px] font-mono text-[#8e9297]">Retrieved accuracy</div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#73bf69]" />
            </div>

            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 space-y-1 relative overflow-hidden">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#8e9297] flex items-center justify-between">
                <span>Avg Recall</span>
                <BarChart3 className="w-3.5 h-3.5 text-[#5794f2]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#5794f2]">
                {pct(globalStats.avgRec)}
              </div>
              <div className="text-[11px] font-mono text-[#8e9297]">Ground truth coverage</div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#5794f2]" />
            </div>

            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 space-y-1 relative overflow-hidden">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#8e9297] flex items-center justify-between">
                <span>Avg End-to-End Latency</span>
                <Clock className="w-3.5 h-3.5 text-[#fade2a]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#fade2a]">
                {fmt(globalStats.avgLat, 0)}
                <span className="text-sm font-normal text-[#8e9297]">ms</span>
              </div>
              <div className="text-[11px] font-mono text-[#8e9297]">Retrieval + LLM synthesis</div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#fade2a]" />
            </div>

            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 space-y-1 relative overflow-hidden">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#8e9297] flex items-center justify-between">
                <span>Total LLM Cost</span>
                <Coins className="w-3.5 h-3.5 text-[#b877d9]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#b877d9]">
                ${fmt(globalStats.totalCost, 4)}
              </div>
              <div className="text-[11px] font-mono text-[#8e9297]">Cumulative token usage</div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#b877d9]" />
            </div>
          </div>
        )}

        {/* Row 2: Method Comparison Panels (Sparse vs Dense vs Hybrid) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {["sparse", "dense", "hybrid"].map((methodKey) => {
            const row = aggregate.find((a) => a.retrievalMethod === methodKey)
            const theme = METHOD_THEMES[methodKey]
            const count = row?.count ?? 0
            const precision = row ? row.avgPrecision : 0
            const recall = row ? row.avgRecall : 0
            const latency = row ? row.avgResponseTimeMs : 0
            const accuracy = row ? row.topKAccuracyRate : 0

            return (
              <div
                key={methodKey}
                className="bg-[#141619] border border-[#22252b] rounded-lg p-5 space-y-4 shadow-md relative overflow-hidden flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#22252b] pb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${theme.bar}`} />
                      <h3 className={`font-mono font-bold text-sm ${theme.text}`}>
                        {theme.label}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-[#8e9297] px-2 py-0.5 rounded bg-[#181b1f] border border-[#262930]">
                      N = {count} Runs
                    </span>
                  </div>

                  {/* Visual Progress / Metrics breakdown */}
                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[#8e9297]">Precision Rate</span>
                        <span className="font-bold text-white">{pct(precision)}</span>
                      </div>
                      <div className="w-full bg-[#1e2228] h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${theme.bar} transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, precision * 100))}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[#8e9297]">Recall Coverage</span>
                        <span className="font-bold text-white">{pct(recall)}</span>
                      </div>
                      <div className="w-full bg-[#1e2228] h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${theme.bar} opacity-80 transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, recall * 100))}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e2228] text-[11px]">
                      <div>
                        <span className="text-[#8e9297] block">Top-K Accuracy</span>
                        <span className="text-white font-bold">{pct(accuracy)}</span>
                      </div>
                      <div>
                        <span className="text-[#8e9297] block">Avg Latency</span>
                        <span className="text-white font-bold">{fmt(latency, 0)}ms</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => runMethods([methodKey])}
                  disabled={busy !== null || scenarios.length === 0}
                  className={`w-full mt-3 py-1.5 rounded text-xs font-mono font-semibold border transition text-center ${theme.badge} hover:brightness-125 disabled:opacity-40`}
                >
                  Trigger {theme.label} Benchmark
                </button>
              </div>
            )
          })}
        </div>

        {/* Row 3: Comparative Aggregate Matrix (Grafana Table View) */}
        <section className="bg-[#141619] border border-[#22252b] rounded-lg shadow-md overflow-hidden">
          <div className="px-5 py-3.5 bg-[#181b1f] border-b border-[#22252b] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#5794f2]" />
              <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-white">
                Engine Comparison Matrix // Benchmark Telemetry
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#8e9297]">
              Ground-Truth Verified
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#111217] text-[#8e9297] uppercase text-[10px] tracking-wider border-b border-[#22252b]">
                <tr>
                  <th className="px-4 py-2.5">Engine Method</th>
                  <th className="px-4 py-2.5">Samples (N)</th>
                  <th className="px-4 py-2.5">Precision</th>
                  <th className="px-4 py-2.5">Recall</th>
                  <th className="px-4 py-2.5">Top-K Acc</th>
                  <th className="px-4 py-2.5">Avg Time</th>
                  <th className="px-4 py-2.5">Avg Tokens</th>
                  <th className="px-4 py-2.5">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2228]">
                {aggregate.length === 0 || aggregate.every((a) => a.count === 0) ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[#8e9297]">
                      No benchmark telemetry records found. Click &quot;Run All (3 Methods)&quot; above to generate comparative metrics.
                    </td>
                  </tr>
                ) : (
                  aggregate.map((a) => {
                    const theme = METHOD_THEMES[a.retrievalMethod]
                    return (
                      <tr key={a.retrievalMethod} className="hover:bg-[#181b1f] transition">
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              theme?.badge ?? "bg-gray-800 text-gray-300"
                            }`}
                          >
                            {theme?.label ?? a.retrievalMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white font-semibold">{a.count}</td>
                        <td className="px-4 py-3 text-[#73bf69] font-bold">
                          {pct(a.avgPrecision)}
                        </td>
                        <td className="px-4 py-3 text-[#5794f2] font-bold">{pct(a.avgRecall)}</td>
                        <td className="px-4 py-3 text-white">{pct(a.topKAccuracyRate)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              a.avgResponseTimeMs < 500
                                ? "bg-[#14532d]/40 text-[#4ade80]"
                                : a.avgResponseTimeMs < 1500
                                ? "bg-[#78350f]/40 text-[#fbbf24]"
                                : "bg-[#7f1d1d]/40 text-[#f87171]"
                            }`}
                          >
                            {fmt(a.avgResponseTimeMs, 0)}ms
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#8e9297]">{fmt(a.avgTokens, 0)}</td>
                        <td className="px-4 py-3 text-[#b877d9] font-bold">
                          ${fmt(a.totalCost, 4)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Row 4: Scenarios Catalog */}
        <section className="bg-[#141619] border border-[#22252b] rounded-lg shadow-md overflow-hidden">
          <div className="px-5 py-3.5 bg-[#181b1f] border-b border-[#22252b] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#ff9900]" />
              <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-white">
                Benchmark Scenario Scenarios ({scenarios.length} Loaded)
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#8e9297]">
              Source: <code>eval-scenarios/*.json</code>
            </span>
          </div>

          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#111217] text-[#8e9297] uppercase text-[10px] tracking-wider border-b border-[#22252b] sticky top-0">
                <tr>
                  <th className="px-4 py-2.5">Target Case</th>
                  <th className="px-4 py-2.5">Difficulty</th>
                  <th className="px-4 py-2.5">Test Prompt Inquiry</th>
                  <th className="px-4 py-2.5 text-right">Quick Run</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2228]">
                {scenarios.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-[#8e9297]">
                      No scenarios seeded. Click &quot;Seed Scenarios (JSON)&quot; to load ground-truth evaluation prompts.
                    </td>
                  </tr>
                ) : (
                  scenarios.map((s) => (
                    <tr key={s.id} className="hover:bg-[#181b1f] transition">
                      <td className="px-4 py-2.5 font-semibold text-white truncate max-w-xs">
                        {s.case.title}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            s.difficulty === "easy"
                              ? "bg-[#14532d]/40 text-[#4ade80] border border-[#22c55e]/30"
                              : s.difficulty === "medium"
                              ? "bg-[#78350f]/40 text-[#fbbf24] border border-[#f59e0b]/30"
                              : "bg-[#7f1d1d]/40 text-[#f87171] border border-[#ef4444]/30"
                          }`}
                        >
                          {s.difficulty}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#c7d0d9] max-w-lg truncate">
                        {s.prompt}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => runOne(s.id)}
                          disabled={busy !== null}
                          className="px-2.5 py-1 rounded bg-[#202328] hover:bg-[#2b3038] text-[#5794f2] hover:text-white border border-[#333842] text-[11px] font-mono transition disabled:opacity-50"
                        >
                          Run All 3
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Row 5: Recent Telemetry Stream (Grafana Log Table) */}
        <section className="bg-[#141619] border border-[#22252b] rounded-lg shadow-md overflow-hidden">
          <div className="px-5 py-3.5 bg-[#181b1f] border-b border-[#22252b] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#73bf69]" />
              <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-white">
                Execution Log Stream ({filteredRecent.length} / {recent.length})
              </h2>
            </div>

            {/* Filter controls */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#8e9297]" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter logs..."
                  className="bg-[#111217] border border-[#262930] rounded pl-8 pr-2.5 py-1 text-xs font-mono text-white placeholder-[#8e9297] focus:outline-none focus:border-[#5794f2]"
                />
              </div>

              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="bg-[#111217] border border-[#262930] rounded px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-[#5794f2]"
              >
                <option value="all">All Methods</option>
                <option value="sparse">Sparse Only</option>
                <option value="dense">Dense Only</option>
                <option value="hybrid">Hybrid Only</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#111217] text-[#8e9297] uppercase text-[10px] tracking-wider border-b border-[#22252b] sticky top-0">
                <tr>
                  <th className="px-4 py-2.5">Timestamp</th>
                  <th className="px-4 py-2.5">Engine</th>
                  <th className="px-4 py-2.5">Prompt</th>
                  <th className="px-4 py-2.5">Correctness</th>
                  <th className="px-4 py-2.5">Precision</th>
                  <th className="px-4 py-2.5">Recall</th>
                  <th className="px-4 py-2.5">Top-K</th>
                  <th className="px-4 py-2.5">Latency</th>
                  <th className="px-4 py-2.5">Tokens</th>
                  <th className="px-4 py-2.5">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2228]">
                {filteredRecent.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-[#8e9297]">
                      No telemetry logs match current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRecent.map((r) => {
                    const theme = METHOD_THEMES[r.retrievalMethod]
                    const isExpanded = expandedLogId === r.id
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setExpandedLogId(isExpanded ? null : r.id)}
                        className="hover:bg-[#181b1f] cursor-pointer transition"
                      >
                        <td className="px-4 py-2.5 text-[#8e9297] whitespace-nowrap text-[11px]">
                          {new Date(r.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              theme?.badge ?? "bg-gray-800 text-gray-300"
                            }`}
                          >
                            {theme?.label ?? r.retrievalMethod}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-white max-w-xs truncate">
                          {r.userPrompt}
                        </td>
                        <td className="px-4 py-2.5">
                          {r.correctnessScore === null ? (
                            <span className="text-[#8e9297]">—</span>
                          ) : r.correctnessScore === 1 ? (
                            <span className="text-[#73bf69] font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>PASS</span>
                            </span>
                          ) : (
                            <span className="text-[#f2495c] font-bold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>FAIL</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[#73bf69] font-semibold">
                          {r.retrievalPrecision !== null ? pct(r.retrievalPrecision) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-[#5794f2] font-semibold">
                          {r.retrievalRecall !== null ? pct(r.retrievalRecall) : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {r.topKAccuracy === null ? (
                            <span className="text-[#8e9297]">—</span>
                          ) : r.topKAccuracy ? (
                            <span className="text-[#73bf69]">TRUE</span>
                          ) : (
                            <span className="text-[#f2495c]">FALSE</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[#fade2a]">
                          {r.totalResponseTimeMs}ms
                        </td>
                        <td className="px-4 py-2.5 text-[#8e9297]">{r.totalTokens}</td>
                        <td className="px-4 py-2.5 text-[#b877d9]">
                          ${r.estimatedCost?.toFixed(4) ?? "—"}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
