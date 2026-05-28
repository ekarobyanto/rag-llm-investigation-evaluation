"use client"

import { useState } from "react"

interface Case {
  id: string
  title: string
  description: string
  suspects: any[]
  evidence: any[]
}

interface CaseSelectionProps {
  cases: Case[]
  onSelectCase: (caseData: Case, rag: boolean) => void
}

export default function CaseSelection({ cases, onSelectCase }: CaseSelectionProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [ragMode, setRagMode] = useState(true)

  const handleStart = () => {
    if (selectedCaseId) {
      const caseData = cases.find((c) => c.id === selectedCaseId)
      if (caseData) {
        onSelectCase(caseData, ragMode)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Investigation System</h1>
          <p className="text-slate-300">Solve criminal cases with AI assistance</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Select a Case</h2>

          <div className="space-y-3 mb-8">
            {cases.map((caseData) => (
              <div
                key={caseData.id}
                onClick={() => setSelectedCaseId(caseData.id)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                  selectedCaseId === caseData.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <h3 className="font-semibold text-gray-800">{caseData.title}</h3>
                <p className="text-sm text-gray-600">{caseData.description}</p>
                <div className="text-xs text-gray-500 mt-2">
                  {caseData.suspects.length} suspects • {caseData.evidence.length} evidence
                </div>
              </div>
            ))}
          </div>

          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-4">AI Mode</h3>
            <div className="space-y-3">
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  checked={ragMode}
                  onChange={() => setRagMode(true)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-3 text-gray-700">
                  <strong>RAG Enabled</strong> - AI uses evidence retrieval
                </span>
              </label>
              <label className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  checked={!ragMode}
                  onChange={() => setRagMode(false)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="ml-3 text-gray-700">
                  <strong>RAG Disabled</strong> - Standard LLM without retrieval
                </span>
              </label>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!selectedCaseId}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            Start Investigation
          </button>
        </div>
      </div>
    </div>
  )
}
