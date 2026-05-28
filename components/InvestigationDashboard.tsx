"use client"

import { useState } from "react"

interface Case {
  id: string
  title: string
  description: string
  suspects: Array<{
    id: string
    name: string
    profile: string
  }>
  evidence: Array<{
    id: string
    type: string
    content: string
  }>
}

interface InvestigationDashboardProps {
  caseData: Case
  sessionId: string
  ragEnabled: boolean
  onBack: () => void
}

interface DeductionResult {
  isCorrect: boolean
  chosenSuspect: { id: string; name: string }
  correctSuspect: { id: string; name: string } | null
  contradictionPairs: unknown
  relevantEvidenceIds: string[]
}

const predefinedPrompts = [
  "Summarize Current Evidence",
  "Identify Contradictions",
  "Suggest Next Investigation",
  "Most Suspicious Suspect",
  "Explain Timeline Conflict",
]

interface TimelineEntry {
  evidenceId: string
  minutes: number
  display: string
  type: string
  content: string
}

function extractTimeMinutes(content: string): { minutes: number; display: string } | null {
  const ampm = content.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = parseInt(ampm[2], 10)
    const meridian = ampm[3].toUpperCase()
    if (meridian === "PM" && h !== 12) h += 12
    if (meridian === "AM" && h === 12) h = 0
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return { minutes: h * 60 + m, display: `${ampm[1]}:${ampm[2]} ${meridian}` }
    }
  }
  const h24 = content.match(/\b(\d{1,2}):(\d{2})\b/)
  if (h24) {
    const h = parseInt(h24[1], 10)
    const m = parseInt(h24[2], 10)
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      const pad = (n: number) => n.toString().padStart(2, "0")
      return { minutes: h * 60 + m, display: `${pad(h)}:${pad(m)}` }
    }
  }
  return null
}

function buildTimeline(evidence: Case["evidence"]): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  for (const e of evidence) {
    const parsed = extractTimeMinutes(e.content)
    if (parsed) {
      entries.push({
        evidenceId: e.id,
        minutes: parsed.minutes,
        display: parsed.display,
        type: e.type,
        content: e.content,
      })
    }
  }
  return entries.sort((a, b) => a.minutes - b.minutes)
}

export default function InvestigationDashboard({
  caseData,
  sessionId,
  ragEnabled,
  onBack,
}: InvestigationDashboardProps) {
  const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null)
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState("")
  const [responses, setResponses] = useState<
    Array<{ prompt: string; response: string; time: number }>
  >([])
  const [loading, setLoading] = useState(false)

  const timeline = buildTimeline(caseData.evidence)

  const [showDeductionModal, setShowDeductionModal] = useState(false)
  const [deductionSuspectId, setDeductionSuspectId] = useState<string>("")
  const [deductionReasoning, setDeductionReasoning] = useState("")
  const [submittingDeduction, setSubmittingDeduction] = useState(false)
  const [deductionResult, setDeductionResult] = useState<DeductionResult | null>(null)
  const [deductionError, setDeductionError] = useState<string | null>(null)

  const handlePredefinedPrompt = async (prompt: string) => {
    await sendPrompt(prompt)
  }

  const handleCustomPrompt = async () => {
    if (customPrompt.trim()) {
      await sendPrompt(customPrompt)
      setCustomPrompt("")
    }
  }

  const sendPrompt = async (prompt: string) => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          caseId: caseData.id,
          prompt,
          ragEnabled,
        }),
      })
      const data = await res.json()
      setResponses((prev) => [
        ...prev,
        {
          prompt,
          response: data.response,
          time: data.timings?.totalResponseTimeMs ?? 0,
        },
      ])
    } catch (error) {
      console.error("Failed to get AI response:", error)
    } finally {
      setLoading(false)
    }
  }

  const submitDeduction = async () => {
    if (!deductionSuspectId) {
      setDeductionError("Pick a suspect first")
      return
    }
    setSubmittingDeduction(true)
    setDeductionError(null)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/deduction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suspectId: deductionSuspectId,
          reasoning: deductionReasoning,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeductionError(data.error ?? "Failed to submit deduction")
      } else {
        setDeductionResult(data as DeductionResult)
      }
    } catch (error) {
      console.error("Failed to submit deduction:", error)
      setDeductionError("Network error")
    } finally {
      setSubmittingDeduction(false)
    }
  }

  const closeDeductionModal = () => {
    setShowDeductionModal(false)
    setDeductionSuspectId("")
    setDeductionReasoning("")
    setDeductionError(null)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="bg-white border-b border-gray-200 flex-none">
        <div className="px-6 py-3 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{caseData.title}</h1>
            <p className="text-xs text-gray-500">
              Mode: {ragEnabled ? "RAG Enabled" : "RAG Disabled"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeductionModal(true)}
              disabled={deductionResult !== null}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:bg-gray-400 text-sm"
            >
              {deductionResult ? "Deduction Submitted" : "Submit Deduction"}
            </button>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition text-sm"
            >
              Back to Cases
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden gap-3 p-3">
        <aside className="w-72 flex flex-col gap-3 overflow-hidden flex-none">
          <div className="bg-white rounded-lg shadow flex flex-col min-h-0 flex-1">
            <h2 className="font-bold text-gray-900 px-3 pt-3 pb-2 text-sm border-b">Evidence</h2>
            <div className="space-y-1 overflow-y-auto p-2 flex-1">
              {caseData.evidence.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedEvidence(e.id)}
                  className={`w-full text-left p-2 rounded text-xs transition ${
                    selectedEvidence === e.id
                      ? "bg-blue-100 border border-blue-300"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <div className="font-semibold text-gray-800">{e.type}</div>
                  <div className="text-gray-600 truncate">{e.content}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow flex flex-col min-h-0 flex-1">
            <h2 className="font-bold text-gray-900 px-3 pt-3 pb-2 text-sm border-b">Suspects</h2>
            <div className="space-y-1 overflow-y-auto p-2 flex-1">
              {caseData.suspects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSuspect(s.id)}
                  className={`w-full text-left p-2 rounded text-xs transition ${
                    selectedSuspect === s.id
                      ? "bg-red-100 border border-red-300"
                      : "bg-gray-50 hover:bg-gray-100"
                  }`}
                >
                  <div className="font-semibold text-gray-800">{s.name}</div>
                  <div className="text-gray-600">{s.profile}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow flex flex-col min-h-0 flex-1">
            <h2 className="font-bold text-gray-900 px-3 pt-3 pb-2 text-sm border-b">Timeline</h2>
            {timeline.length === 0 ? (
              <p className="text-xs text-gray-500 p-3">No timestamped evidence detected.</p>
            ) : (
              <div className="relative overflow-y-auto p-2 flex-1">
                <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-300" />
                <div className="space-y-2">
                  {timeline.map((t, idx) => (
                    <button
                      key={`${t.evidenceId}-${idx}`}
                      onClick={() => setSelectedEvidence(t.evidenceId)}
                      className={`relative w-full text-left pl-8 pr-2 py-2 rounded text-xs transition ${
                        selectedEvidence === t.evidenceId
                          ? "bg-purple-100 border border-purple-300"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <span className="absolute left-3 top-3 w-2.5 h-2.5 rounded-full bg-purple-500 border-2 border-white" />
                      <div className="text-xs font-mono font-bold text-purple-700">
                        {t.display}
                      </div>
                      <div className="text-xs text-gray-500">{t.type}</div>
                      <div className="text-xs text-gray-700 line-clamp-2">{t.content}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 bg-white rounded-lg shadow p-6 overflow-y-auto min-w-0">
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded">
            <h3 className="font-bold text-gray-900 mb-2">Case Briefing</h3>
            <p className="text-sm text-gray-700 leading-relaxed">{caseData.description}</p>
          </div>

          <h2 className="font-bold text-gray-900 mb-4">Investigation Notes</h2>

          {selectedEvidence && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
              <h3 className="font-semibold text-gray-900">Selected Evidence</h3>
              <p className="text-sm text-gray-700 mt-2">
                {caseData.evidence.find((e) => e.id === selectedEvidence)?.content}
              </p>
            </div>
          )}

          {selectedSuspect && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
              <h3 className="font-semibold text-gray-900">Selected Suspect</h3>
              <p className="text-sm text-gray-700 mt-2">
                {caseData.suspects.find((s) => s.id === selectedSuspect)?.profile}
              </p>
            </div>
          )}

          {deductionResult && (
            <div
              className={`mb-6 p-4 border-2 rounded ${
                deductionResult.isCorrect
                  ? "bg-green-50 border-green-400"
                  : "bg-red-50 border-red-400"
              }`}
            >
              <h3 className="font-bold text-lg text-gray-900">
                {deductionResult.isCorrect ? "Correct Deduction" : "Incorrect Deduction"}
              </h3>
              <p className="text-sm text-gray-700 mt-2">
                Your pick: <strong>{deductionResult.chosenSuspect.name}</strong>
              </p>
              {!deductionResult.isCorrect && deductionResult.correctSuspect && (
                <p className="text-sm text-gray-700 mt-1">
                  Actual culprit: <strong>{deductionResult.correctSuspect.name}</strong>
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 mb-6">
            {responses.map((r, idx) => (
              <div key={idx} className="p-4 bg-gray-50 border border-gray-200 rounded">
                <div className="text-sm font-semibold text-gray-900">
                  Q: {r.prompt}
                </div>
                <div className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{r.response}</div>
                <div className="text-xs text-gray-500 mt-2">
                  Response time: {r.time}ms
                </div>
              </div>
            ))}
          </div>

          {responses.length === 0 && (
            <p className="text-gray-500 text-center py-8 text-sm">
              Click evidence and suspects on the left to inspect. Ask the AI assistant when you need analysis. Submit your deduction when ready.
            </p>
          )}
        </main>

        <aside className="w-80 bg-white rounded-lg shadow flex flex-col flex-none overflow-hidden">
          <h2 className="font-bold text-gray-900 px-4 pt-4 pb-2 text-sm border-b">AI Assistant</h2>

          <div className="space-y-1 p-3 overflow-y-auto flex-1">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick prompts</div>
            {predefinedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handlePredefinedPrompt(prompt)}
                disabled={loading}
                className="w-full text-left p-2 text-xs bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="border-t p-3 flex-none">
            <h3 className="font-semibold text-gray-900 text-xs mb-2 uppercase tracking-wide">
              Custom Question
            </h3>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Ask a question..."
              className="w-full p-2 border border-gray-300 rounded text-sm mb-2 h-20 resize-none"
            />
            <button
              onClick={handleCustomPrompt}
              disabled={loading || !customPrompt.trim()}
              className="w-full bg-blue-600 text-white py-2 rounded text-sm hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>
        </aside>
      </div>

      {showDeductionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Submit Final Deduction</h2>

            {!deductionResult ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Name the suspect you believe is responsible and explain your reasoning.
                  This action is final and cannot be undone.
                </p>

                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Suspect
                </label>
                <div className="space-y-2 mb-4">
                  {caseData.suspects.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setDeductionSuspectId(s.id)}
                      className={`w-full text-left p-3 rounded border transition ${
                        deductionSuspectId === s.id
                          ? "bg-green-50 border-green-400"
                          : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <div className="font-semibold text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-600">{s.profile}</div>
                    </button>
                  ))}
                </div>

                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Reasoning
                </label>
                <textarea
                  value={deductionReasoning}
                  onChange={(e) => setDeductionReasoning(e.target.value)}
                  placeholder="Explain the evidence that led you to this conclusion..."
                  className="w-full p-2 border border-gray-300 rounded text-sm mb-4 min-h-32"
                />

                {deductionError && (
                  <p className="text-sm text-red-600 mb-3">{deductionError}</p>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={closeDeductionModal}
                    disabled={submittingDeduction}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitDeduction}
                    disabled={submittingDeduction || !deductionSuspectId}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:bg-gray-400"
                  >
                    {submittingDeduction ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  className={`p-4 border-2 rounded mb-4 ${
                    deductionResult.isCorrect
                      ? "bg-green-50 border-green-400"
                      : "bg-red-50 border-red-400"
                  }`}
                >
                  <h3 className="font-bold text-lg text-gray-900 mb-2">
                    {deductionResult.isCorrect ? "Correct" : "Incorrect"}
                  </h3>
                  <p className="text-sm text-gray-700">
                    Your pick: <strong>{deductionResult.chosenSuspect.name}</strong>
                  </p>
                  {!deductionResult.isCorrect && deductionResult.correctSuspect && (
                    <p className="text-sm text-gray-700 mt-1">
                      Actual culprit:{" "}
                      <strong>{deductionResult.correctSuspect.name}</strong>
                    </p>
                  )}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowDeductionModal(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
