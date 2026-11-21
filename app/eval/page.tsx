"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

type Data = {
  scope: { runId: string; datasetVersion: string }
  aggregate: Array<Record<string, any>>
  ragas: { overall: Array<Record<string, any>> }
  recent: Array<Record<string, any>>
  status: { isRunning: boolean; label?: string }
}
const retrievalColumns = [
  ["precisionAt5", "Precision@5"], ["recallAt5", "Recall@5"], ["hitRateAt5", "Hit Rate@5"],
  ["precisionAt10", "Precision@10"], ["recallAt10", "Recall@10"], ["hitRateAt10", "Hit Rate@10"],
  ["returnedCount", "Returned count"], ["retrievalTimeMs", "Retrieval (ms)"],
  ["llmResponseTimeMs", "Generation (ms)"], ["totalResponseTimeMs", "Total (ms)"],
]
const judgeColumns = [["contextPrecision", "Context Precision"], ["contextRecall", "Context Recall"],
  ["faithfulness", "Faithfulness"], ["answerRelevance", "Answer Relevancy"]]
const format = (v: unknown) => typeof v === "number" ? v.toFixed(3) : "?"
export default function EvalPage() {
  const [data, setData] = useState<Data | null>(null)
  const [runId, setRunId] = useState("")
  const [selectedRun, setSelectedRun] = useState("")
  const [repetition, setRepetition] = useState(1)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  async function refresh(id = selectedRun) {
    const response = await fetch(`/api/eval/results${id ? `?runId=${encodeURIComponent(id)}` : ""}`)
    const result = await response.json()
    if (!response.ok) throw new Error(result.error)
    setData(result)
  }
  useEffect(() => {
    refresh().catch(e => setMessage(e.message))
    const timer = setInterval(() => refresh().catch(e => setMessage(e.message)), 5000)
    return () => clearInterval(timer)
    // The selected scope controls polling; edits to the run input do not change it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRun])
  async function action(path: string, body: object = {}) {
    setBusy(true); setMessage("")
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.message)
      setMessage(result.message || JSON.stringify(result))
      await refresh()
    } catch (e) { setMessage((e as Error).message) } finally { setBusy(false) }
  }
  function download() {
    if (!data) return
    const rows = data.recent.map(r => {
      const judge = r.ragasEvaluation?.evaluatorVersion === "ragas-0.2.15" ? r.ragasEvaluation : {}
      return { id: r.id, runId: r.runId, datasetVersion: r.datasetVersion, question: r.scenario?.questionId,
        method: r.retrievalMethod, repetition: r.repetition, attempt: r.attempt, retryOf: r.retryOf,
        status: r.status, failureReason: r.failureReason,
        precisionAt5: r.retrievalMetrics?.at5?.precision, recallAt5: r.retrievalMetrics?.at5?.recall, hitAt5: r.retrievalMetrics?.at5?.hit,
        precisionAt10: r.retrievalMetrics?.at10?.precision, recallAt10: r.retrievalMetrics?.at10?.recall, hitAt10: r.retrievalMetrics?.at10?.hit,
        returnedCount: r.retrievalMetrics?.at10?.returnedCount, retrievalTimeMs: r.retrievalTimeMs,
        llmResponseTimeMs: r.llmResponseTimeMs, totalResponseTimeMs: r.totalResponseTimeMs,
        contextPrecision: judge.contextPrecision, contextRecall: judge.contextRecall, faithfulness: judge.faithfulness,
        answerRelevance: judge.answerRelevance, modelSettings: JSON.stringify(r.modelSettings),
        evidenceIds: JSON.stringify(r.retrievedEvidenceIds), contexts: JSON.stringify(r.retrievedContextsList), answer: r.aiResponse }
    })
    if (!rows.length) return
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`
    const csv = [Object.keys(rows[0]).map(quote).join(","), ...rows.map(r => Object.values(r).map(quote).join(","))].join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const a = document.createElement("a"); a.href = url; a.download = "research-observations.csv"; a.click(); URL.revokeObjectURL(url)
  }
  const button = "rounded border border-slate-600 bg-slate-800 px-4 py-2 disabled:opacity-40 hover:bg-slate-700"
  return <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-6">
    <Link href="/" className="text-sky-300">? Investigation</Link>
    <header><h1 className="text-3xl font-semibold">Retrieval research</h1>
      <p className="text-slate-400 mt-2">Sparse ? Dense ? Hybrid ? the same 30 Indonesian questions, three repetitions.</p></header>
    <section className="rounded-xl border border-slate-700 p-5 space-y-3">
      <label className="block">Run identity <input aria-label="Run identity" value={runId} onChange={e => setRunId(e.target.value)} className="ml-3 bg-slate-900 border border-slate-600 p-2 rounded" placeholder="Enter or create a run ID" /></label>
      <div className="flex flex-wrap gap-3">
        <button className={button} onClick={() => { const id = crypto.randomUUID(); setRunId(id); setSelectedRun(id) }}>New run</button>
        <button className={button} onClick={() => setSelectedRun(runId)}>View run</button>
        <button className={button} disabled={busy} onClick={() => action("/api/eval/scenarios")}>Load v3 scenarios</button>
        <label>Repetition <select aria-label="Repetition" className="bg-slate-900 p-2" value={repetition} onChange={e => setRepetition(Number(e.target.value))}>{[1, 2, 3].map(n => <option key={n}>{n}</option>)}</select></label>
        <button className={button} disabled={busy || !runId.trim()} onClick={() => { setSelectedRun(runId); action("/api/eval/run", { runId, repetition }) }}>Run 30 ? 3 methods (paid)</button>
        <button className={button} disabled={busy || !runId.trim()} onClick={() => action("/api/eval/ragas/run", { runId })}>Score saved answers (paid)</button>
        <button className={button} onClick={() => action("/api/eval/stop")}>Stop</button>
        <button className={button} onClick={download}>Export CSV</button>
      </div>
      <p className="text-sm text-slate-400 break-all">Viewing: {data?.scope.runId} ? {data?.scope.datasetVersion}</p>
      <p className="text-sm">{data?.status.isRunning ? data.status.label : "Idle"}</p>
      {message && <pre role="status" className="whitespace-pre-wrap max-h-48 overflow-auto text-sm text-amber-200">{message}</pre>}
    </section>
    <section className="overflow-auto"><h2 className="text-xl mb-3">Retrieval and timing</h2>
      <p className="text-slate-400 mb-3">Successful observations only. Unfilled retrieval positions count as misses. Expected: 90 successes per method.</p>
      <table className="w-full text-sm text-left"><thead><tr>{["Method", "Successes", "Failed attempts", ...retrievalColumns.map(c => c[1])].map(c => <th className="p-3 border-b border-slate-700" key={c}>{c}</th>)}</tr></thead>
      <tbody>{data?.aggregate.map(row => <tr key={row.retrievalMethod}><td className="p-3">{row.retrievalMethod}</td><td>{row.count}</td><td>{row.failedAttempts}</td>{retrievalColumns.map(([key]) => <td className="p-3" key={key}>{format(row[key])}</td>)}</tr>)}</tbody></table>
    </section>
    <section className="overflow-auto"><h2 className="text-xl mb-3">RAGAS ? canonical evaluator</h2>
      <p className="text-slate-400 mb-3">Each cell shows mean (valid n). Missing judge scores are excluded and remain visible in attempt details.</p>
      <table className="w-full text-sm text-left"><thead><tr>{["Method", ...judgeColumns.map(c => c[1])].map(c => <th className="p-3 border-b border-slate-700" key={c}>{c}</th>)}</tr></thead>
      <tbody>{data?.ragas.overall.map(row => <tr key={row.retrievalMethod}><td className="p-3">{row.retrievalMethod}</td>{judgeColumns.map(([key]) => <td className="p-3" key={key}>{format(row[key])} ({row.denominators[key]})</td>)}</tr>)}</tbody></table>
    </section>
    <section><h2 className="text-xl mb-3">Repetition means</h2><pre className="text-sm overflow-auto rounded border border-slate-700 p-4">{JSON.stringify(data?.aggregate.map(r => ({ method: r.retrievalMethod, repetitions: r.repetitions })), null, 2)}</pre></section>
    <section><h2 className="text-xl mb-3">Observations and failed attempts</h2>
      {data?.recent.map(row => <details className="border-b border-slate-700 py-3" key={row.id}>
        <summary>{row.scenario?.questionId} ? {row.retrievalMethod} ? repetition {row.repetition} ? attempt {row.attempt} ? {row.status}</summary>
        <p className="mt-3">{row.userPrompt}</p><p className="text-amber-200">{row.failureReason}</p><p className="whitespace-pre-wrap my-3">{row.aiResponse}</p>
        <pre className="text-xs overflow-auto">{JSON.stringify({ evidenceIds: row.retrievedEvidenceIds, contexts: row.retrievedContextsList,
          metrics: row.retrievalMetrics, modelSettings: row.modelSettings, judge: row.ragasEvaluation }, null, 2)}</pre>
      </details>)}
    </section>
  </main>
}
