"use client"

import { useState } from "react"
import confetti from "canvas-confetti"
import { AlertTriangle, Award, CheckCircle, XCircle, Pin, Scale, ShieldAlert, Sparkles, X } from "lucide-react"
import { soundFx } from "@/lib/audio"
import { sanitizeName, sanitizeProfile, type Suspect } from "./SuspectDossiers"
import type { EvidenceItem } from "./EvidenceBoard"

interface DeductionResult {
  isCorrect: boolean
  chosenSuspect: { id: string; name: string }
  correctSuspect: { id: string; name: string } | null
  contradictionPairs?: unknown
  relevantEvidenceIds?: string[]
}

interface AccusationTrialModalProps {
  isOpen: boolean
  suspects: Suspect[]
  pinnedEvidence: EvidenceItem[]
  sessionId: string
  existingResult: DeductionResult | null
  onClose: () => void
  onSuccess: (result: DeductionResult) => void
}

export default function AccusationTrialModal({
  isOpen,
  suspects,
  pinnedEvidence,
  sessionId,
  existingResult,
  onClose,
  onSuccess,
}: AccusationTrialModalProps) {
  const [selectedSuspectId, setSelectedSuspectId] = useState<string>("")
  const [selectedSmokingGuns, setSelectedSmokingGuns] = useState<string[]>([])
  const [reasoning, setReasoning] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DeductionResult | null>(existingResult)

  if (!isOpen) return null

  const handleToggleSmokingGun = (evidenceId: string) => {
    soundFx.playClick()
    setSelectedSmokingGuns((prev) =>
      prev.includes(evidenceId) ? prev.filter((id) => id !== evidenceId) : [...prev, evidenceId]
    )
  }

  const handleSubmitIndictment = async () => {
    if (!selectedSuspectId) {
      setError("You must select an accused suspect.")
      return
    }

    setSubmitting(true)
    setError(null)
    soundFx.playStamp()

    try {
      const res = await fetch(`/api/sessions/${sessionId}/deduction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suspectId: selectedSuspectId,
          reasoning: reasoning.trim() || "Indictment filed with attached evidence.",
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Failed to process indictment.")
      } else {
        const deduction = data as DeductionResult
        setResult(deduction)
        onSuccess(deduction)

        if (deduction.isCorrect) {
          soundFx.playVictory()
          // Fireworks confetti
          confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#c99a5e", "#ef4444", "#ffffff", "#22c55e"],
          })
        } else {
          soundFx.playStamp()
        }
      }
    } catch {
      setError("A connection error occurred while submitting the indictment.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#1c1813] border-2 border-[#574637] rounded-xl shadow-2xl text-[#e6dfd5] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-[#2a221a] px-6 py-4 border-b border-[#44372b] flex items-center justify-between flex-none">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-[#c99a5e]" />
            <div>
              <h2 className="text-lg font-serif font-bold text-[#f5efe6] tracking-wide">
                The Accusation Trial // Formal Indictment
              </h2>
              <p className="text-[11px] font-mono text-[#a89984]">
                Official Case Docket Closing Presentation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#8a7a68] hover:text-[#f5efe6] hover:bg-[#382d23] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1">
          {!result ? (
            <>
              {/* Step 1: Select Suspect */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-[#c99a5e] flex items-center gap-1.5">
                    <span>1. Name the Primary Perpetrator</span>
                    <span className="text-[#ef4444]">*</span>
                  </label>
                  <span className="text-[11px] font-mono text-[#8a7a68]">Select suspect</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {suspects.map((s) => {
                    const isSelected = selectedSuspectId === s.id
                    const cleanName = sanitizeName(s.name)
                    const cleanProfile = sanitizeProfile(s.profile)

                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => {
                          soundFx.playClick()
                          setSelectedSuspectId(s.id)
                        }}
                        className={`p-3 rounded-lg border text-left transition relative ${
                          isSelected
                            ? "bg-[#382b20] border-[#c99a5e] ring-1 ring-[#c99a5e]"
                            : "bg-[#241e17] border-[#3d3226] hover:border-[#5a4a39] hover:bg-[#2b241c]"
                        }`}
                      >
                        <div className="font-serif font-bold text-sm text-[#f5efe6]">{cleanName}</div>
                        <div className="text-[11px] font-mono text-[#c99a5e] mt-0.5 line-clamp-1">
                          {cleanProfile}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Step 2: Smoking Gun Evidence Attachments */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-[#c99a5e] flex items-center gap-1.5">
                    <Pin className="w-3.5 h-3.5 fill-[#ef4444] text-[#ef4444]" />
                    <span>2. Attach Key Smoking Gun Clues</span>
                  </label>
                  <span className="text-[11px] font-mono text-[#8a7a68]">
                    {selectedSmokingGuns.length} attached
                  </span>
                </div>

                {pinnedEvidence.length === 0 ? (
                  <div className="p-3.5 rounded bg-[#241e17] border border-[#3d3226] text-xs font-mono text-[#8a7a68] text-center">
                    No clues pinned to corkboard. You can still submit your indictment, or pin clues on the board first.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {pinnedEvidence.map((e) => {
                      const isAttached = selectedSmokingGuns.includes(e.id)
                      return (
                        <div
                          key={e.id}
                          onClick={() => handleToggleSmokingGun(e.id)}
                          className={`p-2.5 rounded border text-xs font-serif cursor-pointer transition flex items-start justify-between gap-3 ${
                            isAttached
                              ? "bg-[#33261a] border-[#c99a5e] text-[#f5efe6]"
                              : "bg-[#241e17] border-[#382d22] text-[#a89984] hover:bg-[#2c231a]"
                          }`}
                        >
                          <p className="line-clamp-2 leading-relaxed">{e.content}</p>
                          <span
                            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded shrink-0 border ${
                              isAttached
                                ? "bg-[#c99a5e] text-[#1c1813] font-bold border-[#e0b57c]"
                                : "bg-[#181411] text-[#8a7a68] border-[#382d22]"
                            }`}
                          >
                            {isAttached ? "Attached" : "Attach"}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Step 3: Deduction Rationale */}
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-[#c99a5e]">
                  3. Indictment Argument & Timeline Reconstruction
                </label>
                <textarea
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  placeholder="Detail the perpetrator's motive, the VPN access window, the conflicting alibi, and how the evidence pieces connect..."
                  rows={4}
                  className="w-full bg-[#181411] border border-[#42372c] rounded-md p-3 text-xs text-[#f5efe6] placeholder-[#8a7a68] font-mono focus:outline-none focus:border-[#c99a5e] resize-none"
                />
              </div>

              {error && (
                <div className="p-3 rounded bg-[#451a1a] border border-[#7f1d1d] text-xs font-mono text-[#fca5a5] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </>
          ) : (
            /* Verdict Screen */
            <div className="text-center py-6 space-y-6">
              {result.isCorrect ? (
                /* Correct Verdict */
                <div className="space-y-4">
                  <div className="inline-flex p-3 rounded-full bg-[#14532d]/40 border-2 border-[#22c55e] text-[#4ade80] mb-2">
                    <CheckCircle className="w-12 h-12" />
                  </div>

                  <div className="space-y-1">
                    <div className="inline-block px-4 py-1 rounded border-2 border-[#22c55e] text-[#4ade80] font-mono font-black text-sm tracking-widest uppercase bg-[#14532d]/30">
                      CASE CLOSED // CONVICTION SECURED
                    </div>
                    <h3 className="text-2xl font-serif font-bold text-[#f5efe6] pt-2">
                      Perpetrator Identified: {result.chosenSuspect.name}
                    </h3>
                  </div>

                  {/* Detective Performance Rating */}
                  <div className="p-4 rounded-xl bg-[#251e16] border border-[#524131] max-w-md mx-auto space-y-2 text-left">
                    <div className="flex items-center justify-between border-b border-[#3b2f23] pb-2">
                      <span className="text-xs font-mono text-[#a89984] uppercase tracking-wider">
                        Investigative Performance
                      </span>
                      <span className="flex items-center gap-1 font-mono font-bold text-[#c99a5e] text-sm">
                        <Sparkles className="w-4 h-4" />
                        <span>★★★ S-RANK CHIEF DETECTIVE</span>
                      </span>
                    </div>

                    <p className="text-xs font-serif text-[#d6c7b2] leading-relaxed pt-1">
                      Outstanding deduction. You pierced Marcus Chen&apos;s fabricated sleeping alibi using smart-home telemetry and ISP bandwidth audits, tracing the unauthorized <code>svc-threatfeed</code> exfiltration conclusively.
                    </p>
                  </div>
                </div>
              ) : (
                /* Incorrect Verdict */
                <div className="space-y-4">
                  <div className="inline-flex p-3 rounded-full bg-[#7f1d1d]/40 border-2 border-[#ef4444] text-[#f87171] mb-2">
                    <XCircle className="w-12 h-12" />
                  </div>

                  <div className="space-y-1">
                    <div className="inline-block px-4 py-1 rounded border-2 border-[#ef4444] text-[#f87171] font-mono font-black text-sm tracking-widest uppercase bg-[#7f1d1d]/30">
                      WRONGFUL INDICTMENT // CASE COLD
                    </div>
                    <h3 className="text-2xl font-serif font-bold text-[#f5efe6] pt-2">
                      Accused: {result.chosenSuspect.name}
                    </h3>
                  </div>

                  <div className="p-4 rounded-xl bg-[#251e16] border border-[#524131] max-w-md mx-auto space-y-2 text-left">
                    <div className="text-xs font-mono text-[#f87171] font-bold uppercase tracking-wider">
                      Forensic Audit Feedback
                    </div>
                    <p className="text-xs font-serif text-[#d6c7b2] leading-relaxed">
                      The evidence against {result.chosenSuspect.name} does not survive judicial scrutiny. {result.correctSuspect && (
                        <span>The true culprit was <strong>{result.correctSuspect.name}</strong>.</span>
                      )} Review the ISP data transfer logs and smart-home sensor records to identify where the contradiction occurred.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-[#241e18] px-6 py-4 border-t border-[#3b3127] flex items-center justify-end gap-3 flex-none">
          {!result ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded bg-[#2e261f] text-[#d6c7b2] text-xs font-mono border border-[#44372a] hover:bg-[#382e25] transition"
              >
                Return to Board
              </button>
              <button
                type="button"
                onClick={handleSubmitIndictment}
                disabled={submitting || !selectedSuspectId}
                className="flex items-center gap-2 px-5 py-2 rounded bg-[#8b1e1e] hover:bg-[#a52424] text-[#fef2f2] font-serif font-bold text-xs border border-[#b91c1c] shadow-lg shadow-red-950/40 transition disabled:opacity-50"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{submitting ? "Deliberating Verdict..." : "Deliver Indictment"}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded bg-[#c99a5e] text-[#1c1813] font-serif font-bold text-xs hover:bg-[#e0b57c] transition"
            >
              Close Dossier
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
