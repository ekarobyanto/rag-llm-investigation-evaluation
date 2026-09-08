"use client"

import { parseForensicMetadata } from "@/lib/forensic-parser"
import { soundFx } from "@/lib/audio"
import { Pin, X, Clock, ShieldAlert, Sparkles, Building2, User, MessageSquare, AlertTriangle } from "lucide-react"
import type { EvidenceItem } from "./EvidenceBoard"

interface EvidenceDetailModalProps {
  evidence: EvidenceItem | null
  isPinned: boolean
  allSuspectNames: string[]
  onClose: () => void
  onTogglePin: (evidenceId: string) => void
  onAskConsultant: (prompt: string) => void
}

export default function EvidenceDetailModal({
  evidence,
  isPinned,
  allSuspectNames,
  onClose,
  onTogglePin,
  onAskConsultant,
}: EvidenceDetailModalProps) {
  if (!evidence) return null

  const metadata = parseForensicMetadata(
    evidence.id,
    evidence.type,
    evidence.content,
    evidence.difficultyWeight,
    allSuspectNames
  )

  const handleAskAboutClue = () => {
    soundFx.playClick()
    const prompt = `Analyze Exhibit ${metadata.exhibitId} (${evidence.type.replace(/_/g, " ")}): "${evidence.content}". How does this connect to suspect alibis or the breach exfiltration timeline?`
    onAskConsultant(prompt)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none">
      <div className="relative w-full max-w-2xl bg-[#f4ede2] text-[#26211c] border-4 border-[#3e342a] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Manila Tab / File Header */}
        <div className="bg-[#241e17] px-6 py-4 border-b border-[#44382c] text-[#f5efe6] flex items-center justify-between flex-none">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#382b20] border border-[#5a4634] flex items-center justify-center text-[#c99a5e] font-mono font-bold text-xs">
              EV
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-[#3d2f23] text-[#c99a5e] border border-[#524131]">
                  Official Case Exhibit
                </span>
                <span className="text-xs font-mono font-bold text-[#f5efe6]">
                  {metadata.exhibitId}
                </span>
              </div>
              <h2 className="text-sm font-serif font-bold text-[#b8a994] capitalize mt-0.5">
                {evidence.type.replace(/_/g, " ")} Dossier
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundFx.playPin()
                onTogglePin(evidence.id)
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono font-bold transition border ${
                isPinned
                  ? "bg-[#dc2626] text-white border-[#ef4444]"
                  : "bg-[#2e261f] text-[#d6c7b2] border-[#4a3d31] hover:bg-[#3d3328]"
              }`}
              title={isPinned ? "Unpin clue" : "Pin clue to corkboard"}
            >
              <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-current" : ""}`} />
              <span>{isPinned ? "Pinned to Board" : "Pin to Board"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded text-[#8a7a68] hover:text-white hover:bg-[#382d23] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Breach Window Alert Banner */}
        {metadata.isBreachWindow && (
          <div className="bg-[#7f1d1d] text-[#fef2f2] px-6 py-2 border-b border-[#991b1b] flex items-center gap-2 text-xs font-mono font-bold flex-none">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#fca5a5]" />
            <span>CRITICAL BREACH WINDOW EVENT (02:00 – 05:00 EXFILTRATION TIMELINE)</span>
          </div>
        )}

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
          {/* Forensic Metadata Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#e8dece] border border-[#d1c2ab] rounded-lg p-3.5 text-xs font-mono">
            <div>
              <span className="text-[10px] text-[#786a58] uppercase font-bold block mb-0.5">
                Timestamp / Chronology
              </span>
              <div className="flex items-center gap-1.5 font-bold text-[#26211c]">
                <Clock className="w-3.5 h-3.5 text-[#854d0e]" />
                <span>{metadata.timeString ?? "Timestamp Unrecorded"}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[#786a58] uppercase font-bold block mb-0.5">
                Chain of Custody
              </span>
              <div className="flex items-center gap-1.5 font-bold text-[#26211c]">
                <Building2 className="w-3.5 h-3.5 text-[#854d0e]" />
                <span className="truncate">{metadata.sourceDepartment}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[#786a58] uppercase font-bold block mb-0.5">
                Significance Tier
              </span>
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-3.5 h-3.5 text-[#dc2626]" />
                <span className={metadata.isBreachWindow ? "text-[#dc2626]" : "text-[#854d0e]"}>
                  {metadata.significanceTier}
                </span>
              </div>
            </div>
          </div>

          {/* Full Evidence Transcript */}
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase tracking-wider text-[#786a58] font-bold">
              Official Evidence Log & Deposition Transcript
            </div>
            <div className="p-4 rounded-lg bg-[#fbf7ef] border border-[#d9ccb6] font-serif text-sm text-[#1c1917] leading-relaxed shadow-inner">
              &ldquo;{evidence.content}&rdquo;
            </div>
          </div>

          {/* Mentioned Suspects Badge Strip */}
          {metadata.mentionedSuspects.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-[#786a58] font-bold">
                Persons of Interest Referenced in this Record
              </div>
              <div className="flex flex-wrap gap-2">
                {metadata.mentionedSuspects.map((name) => (
                  <span
                    key={name}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#2e261f] text-[#f5efe6] text-xs font-serif font-bold border border-[#4a3d31] shadow-sm"
                  >
                    <User className="w-3 h-3 text-[#c99a5e]" />
                    <span>{name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-[#e4d8c4] px-6 py-4 border-t border-[#cbbca4] flex flex-wrap items-center justify-between gap-3 flex-none">
          <span className="text-xs font-mono text-[#786a58]">
            Database Record ID: <span className="text-[#26211c] font-bold">{evidence.id}</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAskAboutClue}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-[#2a221a] hover:bg-[#382d23] text-[#f5efe6] font-mono text-xs font-bold border border-[#4a3d31] transition shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#c99a5e]" />
              <span>Ask AI Consultant About This Clue</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded bg-[#d6c7b2] hover:bg-[#c9b9a2] text-[#26211c] font-mono text-xs font-bold transition"
            >
              Close Dossier
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
