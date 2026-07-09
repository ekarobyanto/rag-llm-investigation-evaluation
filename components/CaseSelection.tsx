"use client"

import { useState } from "react"
import type { RetrievalMethod } from "@/lib/retrieval/types"

interface Case {
  id: string
  title: string
  description: string
  suspects: any[]
  evidence: any[]
}

interface CaseSelectionProps {
  cases: Case[]
  onSelectCase: (caseData: Case, method: RetrievalMethod) => void
}

const RETRIEVAL_METHODS: Array<{
  value: RetrievalMethod
  label: string
  description: string
  color: string
}> = [
  {
    value: "sparse",
    label: "Sparse (BM25)",
    description: "Keyword-based retrieval. Fast, no embedding API call.",
    color: "text-amber-700",
  },
  {
    value: "dense",
    label: "Dense (Vector)",
    description: "Semantic similarity via embeddings. Best for meaning.",
    color: "text-blue-700",
  },
  {
    value: "hybrid",
    label: "Hybrid (RRF)",
    description: "Combines Sparse + Dense with Reciprocal Rank Fusion.",
    color: "text-purple-700",
  },
]

export default function CaseSelection({ cases, onSelectCase }: CaseSelectionProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [retrievalMethod, setRetrievalMethod] = useState<RetrievalMethod>("dense")

  const handleStart = () => {
    if (selectedCaseId) {
      const caseData = cases.find((c) => c.id === selectedCaseId)
      if (caseData) {
        onSelectCase(caseData, retrievalMethod)
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
            <h3 className="font-semibold text-gray-800 mb-4">Retrieval Method</h3>
            <div className="space-y-3">
              {RETRIEVAL_METHODS.map((method) => (
                <label key={method.value} className="flex items-start cursor-pointer">
                  <input
                    type="radio"
                    checked={retrievalMethod === method.value}
                    onChange={() => setRetrievalMethod(method.value)}
                    className="w-4 h-4 mt-0.5 text-blue-600"
                  />
                  <span className="ml-3">
                    <span className={`font-semibold ${method.color}`}>{method.label}</span>
                    <span className="block text-sm text-gray-500">{method.description}</span>
                  </span>
                </label>
              ))}
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
