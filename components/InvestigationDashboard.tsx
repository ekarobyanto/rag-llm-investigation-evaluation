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

const predefinedPrompts = [
  "Summarize Current Evidence",
  "Identify Contradictions",
  "Suggest Next Investigation",
  "Most Suspicious Suspect",
  "Explain Timeline Conflict",
]

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
          time: data.timings.totalResponseTimeMs,
        },
      ])
    } catch (error) {
      console.error("Failed to get AI response:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{caseData.title}</h1>
            <p className="text-sm text-gray-500">
              Mode: {ragEnabled ? "RAG Enabled" : "RAG Disabled"}
            </p>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 transition"
          >
            Back to Cases
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-4 gap-6">
        {/* Sidebar - Evidence & Suspects */}
        <div className="col-span-1 space-y-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-gray-900 mb-3">Evidence</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {caseData.evidence.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedEvidence(e.id)}
                  className={`w-full text-left p-2 rounded text-sm transition ${
                    selectedEvidence === e.id
                      ? "bg-blue-100 border border-blue-300"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  <div className="font-semibold text-gray-800">{e.type}</div>
                  <div className="text-gray-600 truncate">{e.content}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-gray-900 mb-3">Suspects</h2>
            <div className="space-y-2">
              {caseData.suspects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSuspect(s.id)}
                  className={`w-full text-left p-2 rounded text-sm transition ${
                    selectedSuspect === s.id
                      ? "bg-red-100 border border-red-300"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  <div className="font-semibold text-gray-800">{s.name}</div>
                  <div className="text-gray-600 text-xs">{s.profile}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Panel */}
        <div className="col-span-2 bg-white rounded-lg shadow p-6">
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

          <div className="space-y-3 max-h-64 overflow-y-auto mb-6">
            {responses.map((r, idx) => (
              <div key={idx} className="p-4 bg-gray-50 border border-gray-200 rounded">
                <div className="text-sm font-semibold text-gray-900">
                  Q: {r.prompt}
                </div>
                <div className="text-sm text-gray-700 mt-2">{r.response}</div>
                <div className="text-xs text-gray-500 mt-2">
                  Response time: {r.time}ms
                </div>
              </div>
            ))}
          </div>

          {responses.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              Ask the AI assistant to begin investigation
            </p>
          )}
        </div>

        {/* Right Panel - AI Assistant */}
        <div className="col-span-1 bg-white rounded-lg shadow p-4">
          <h2 className="font-bold text-gray-900 mb-4">AI Assistant</h2>

          <div className="space-y-2 mb-6">
            {predefinedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handlePredefinedPrompt(prompt)}
                disabled={loading}
                className="w-full text-left p-2 text-sm bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">
              Custom Question
            </h3>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Ask a question..."
              className="w-full p-2 border border-gray-300 rounded text-sm mb-2 min-h-20"
            />
            <button
              onClick={handleCustomPrompt}
              disabled={loading || !customPrompt.trim()}
              className="w-full bg-blue-600 text-white py-2 rounded text-sm hover:bg-blue-700 transition disabled:bg-gray-400"
            >
              {loading ? "Thinking..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
