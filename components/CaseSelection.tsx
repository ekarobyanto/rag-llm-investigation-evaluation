"use client"

import { useState } from "react"
import { FolderKanban, ShieldAlert, Cpu, Sparkles, Database, Search, ArrowRight } from "lucide-react"
import { soundFx } from "@/lib/audio"
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
  subtitle: string
  description: string
  accentColor: string
  borderColor: string
  icon: typeof Database
}> = [
  {
    value: "sparse",
    label: "BM25 Keyword Cross-Ref",
    subtitle: "Sparse Full-Text Search",
    description: "Fast lexical index scanning. Best for exact match keywords, IP addresses, and identifiers.",
    accentColor: "text-[#fbbf24]",
    borderColor: "border-[#f59e0b]",
    icon: Search,
  },
  {
    value: "dense",
    label: "Neural Vector Association",
    subtitle: "Dense HNSW Vector Embeddings",
    description: "Semantic embedding similarity. Discovers conceptual clues and indirect witness testimony connections.",
    accentColor: "text-[#38bdf8]",
    borderColor: "border-[#0284c7]",
    icon: Cpu,
  },
  {
    value: "hybrid",
    label: "Master Detective Fusion",
    subtitle: "Hybrid Reciprocal Rank Fusion (RRF)",
    description: "Combines sparse lexical search and dense neural vectors into a unified relevance score.",
    accentColor: "text-[#c084fc]",
    borderColor: "border-[#9333ea]",
    icon: Sparkles,
  },
]

export default function CaseSelection({ cases, onSelectCase }: CaseSelectionProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(
    cases.length > 0 ? cases[0].id : null
  )
  const [retrievalMethod, setRetrievalMethod] = useState<RetrievalMethod>("hybrid")

  const handleStart = () => {
    if (selectedCaseId) {
      const caseData = cases.find((c) => c.id === selectedCaseId)
      if (caseData) {
        soundFx.playStamp()
        onSelectCase(caseData, retrievalMethod)
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#14110e] bg-corkboard p-4 sm:p-8 flex items-center justify-center select-none text-[#e6dfd5]">
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Title Header */}
        <div className="text-center space-y-2 relative">
          <div className="flex items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2e1d1d] border border-[#7f1d1d] text-[#f87171] text-xs font-mono uppercase tracking-widest">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Cyber Intelligence & Crime Division</span>
            </div>
            <a
              href="/eval"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#221c15] hover:bg-[#332b22] border border-[#4d3d2e] text-[#c99a5e] hover:text-[#f5efe6] text-xs font-mono transition"
            >
              <span>Evaluation Lab</span>
              <span>&rarr;</span>
            </a>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#f5efe6] tracking-tight">
            The Detective&apos;s Case Files Archive
          </h1>
          <p className="text-xs sm:text-sm font-mono text-[#a89984] max-w-md mx-auto">
            Select an active docket, configure your investigative method, and piece together the clues on the corkboard.
          </p>
        </div>

        {/* Main Docket Board Container */}
        <div className="bg-[#1c1813] border-2 border-[#47392c] rounded-xl shadow-2xl p-6 sm:p-8 space-y-8">
          {/* Section 1: Active Cases */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#3b2f23] pb-2">
              <h2 className="text-sm font-serif font-bold text-[#c99a5e] tracking-wider uppercase flex items-center gap-2">
                <FolderKanban className="w-4 h-4" />
                <span>1. Select Active Case Docket</span>
              </h2>
              <span className="text-xs font-mono text-[#8a7a68]">
                {cases.length} Open {cases.length === 1 ? "Investigation" : "Investigations"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {cases.map((caseData) => {
                const isSelected = selectedCaseId === caseData.id
                return (
                  <div
                    key={caseData.id}
                    onClick={() => {
                      soundFx.playPaper()
                      setSelectedCaseId(caseData.id)
                    }}
                    className={`p-5 rounded-lg border cursor-pointer transition relative text-left ${
                      isSelected
                        ? "bg-[#2d2319] border-[#c99a5e] ring-1 ring-[#c99a5e] shadow-xl shadow-amber-950/20"
                        : "bg-[#211a14] border-[#382d22] hover:border-[#524131] hover:bg-[#261f18]"
                    }`}
                  >
                    {/* Confidential Stamp Graphic */}
                    <div className="absolute top-4 right-4 text-[10px] font-mono font-bold tracking-widest uppercase px-2 py-0.5 rounded border border-dashed border-[#ef4444] text-[#f87171] rotate-2 bg-[#7f1d1d]/10">
                      UNSOLVED DOCKET
                    </div>

                    <h3 className="text-base font-serif font-bold text-[#f5efe6] pr-32">
                      {caseData.title}
                    </h3>
                    <p className="text-xs font-serif text-[#b8a994] mt-2 leading-relaxed max-w-2xl line-clamp-2">
                      {caseData.description}
                    </p>

                    <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[#33271d] text-xs font-mono text-[#8a7a68]">
                      <span>
                        Suspects Under Watch: <strong className="text-[#e2d5c3]">{caseData.suspects.length}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Cataloged Clues: <strong className="text-[#e2d5c3]">{caseData.evidence.length}</strong>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section 2: Investigative Retrieval Method */}
          <div className="space-y-3">
            <div className="border-b border-[#3b2f23] pb-2">
              <h2 className="text-sm font-serif font-bold text-[#c99a5e] tracking-wider uppercase flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                <span>2. Choose Investigative Analysis Method</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {RETRIEVAL_METHODS.map((method) => {
                const isSelected = retrievalMethod === method.value
                const Icon = method.icon

                return (
                  <div
                    key={method.value}
                    onClick={() => {
                      soundFx.playClick()
                      setRetrievalMethod(method.value)
                    }}
                    className={`p-4 rounded-lg border cursor-pointer transition flex flex-col justify-between text-left relative ${
                      isSelected
                        ? `bg-[#2d2319] ${method.borderColor} ring-1 ${method.borderColor} shadow-md`
                        : "bg-[#211a14] border-[#382d22] hover:border-[#4d3d2e] hover:bg-[#251e18]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={`w-5 h-5 ${method.accentColor}`} />
                        <span className="text-[10px] font-mono uppercase text-[#8a7a68] px-1.5 py-0.5 rounded bg-[#181411]">
                          {method.value.toUpperCase()}
                        </span>
                      </div>
                      <div className="font-serif font-bold text-sm text-[#f5efe6]">{method.label}</div>
                      <div className="text-[10px] font-mono text-[#a89984] mb-2">{method.subtitle}</div>
                      <p className="text-[11px] font-serif text-[#b8a994] leading-relaxed">
                        {method.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-2 border-t border-[#33271d] flex items-center justify-between text-[11px] font-mono">
                      <span className={isSelected ? method.accentColor : "text-[#8a7a68]"}>
                        {isSelected ? "Active Method" : "Select"}
                      </span>
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          isSelected ? `${method.borderColor} bg-current` : "border-[#524131]"
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#1c1813]" />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Start Investigation Button */}
          <button
            onClick={handleStart}
            disabled={!selectedCaseId}
            className="w-full py-4 rounded-lg bg-[#8b1e1e] hover:bg-[#a52424] text-[#fef2f2] font-serif font-bold text-base shadow-xl shadow-red-950/40 border border-[#b91c1c] transition flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            <span>Open Case File & Begin Investigation</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
