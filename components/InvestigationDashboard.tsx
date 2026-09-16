"use client"

import { useState } from "react"
import DeskHeader from "./noir/DeskHeader"
import SuspectDossiers, { sanitizeName, type Suspect } from "./noir/SuspectDossiers"
import EvidenceBoard, { type EvidenceItem } from "./noir/EvidenceBoard"
import ConsultantTerminal from "./noir/ConsultantTerminal"
import AccusationTrialModal from "./noir/AccusationTrialModal"
import EvidenceDetailModal from "./noir/EvidenceDetailModal"
import CaseBriefingModal from "./noir/CaseBriefingModal"
import { soundFx } from "@/lib/audio"
import type { RetrievalMethod } from "@/lib/retrieval/types"
import { X } from "lucide-react"

interface Case {
  id: string
  title: string
  description: string
  suspects: Suspect[]
  evidence: EvidenceItem[]
}

interface InvestigationDashboardProps {
  caseData: Case
  sessionId: string
  retrievalMethod: RetrievalMethod
  onBack: () => void
}

interface DeductionResult {
  isCorrect: boolean
  chosenSuspect: { id: string; name: string }
  correctSuspect: { id: string; name: string } | null
  contradictionPairs?: unknown
  relevantEvidenceIds?: string[]
}

export default function InvestigationDashboard({
  caseData,
  sessionId,
  retrievalMethod,
  onBack,
}: InvestigationDashboardProps) {
  const [pinnedEvidenceIds, setPinnedEvidenceIds] = useState<string[]>([])
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null)
  const [inspectingEvidence, setInspectingEvidence] = useState<EvidenceItem | null>(null)
  const [selectedSuspectId, setSelectedSuspectId] = useState<string | null>(null)
  const [showBriefingModal, setShowBriefingModal] = useState(false)
  const [showAccusationModal, setShowAccusationModal] = useState(false)
  const [deductionResult, setDeductionResult] = useState<DeductionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [responses, setResponses] = useState<
    Array<{ prompt: string; response: string; time: number; retrievedContext?: string }>
  >([])

  // Toggle pushpin on evidence
  const handleTogglePin = (evidenceId: string) => {
    setPinnedEvidenceIds((prev) =>
      prev.includes(evidenceId) ? prev.filter((id) => id !== evidenceId) : [...prev, evidenceId]
    )
  }

  // Handle clicking an evidence card -> opens full forensic dossier modal
  const handleSelectEvidence = (evidenceId: string) => {
    setSelectedEvidenceId(evidenceId)
    const item = caseData.evidence.find((e) => e.id === evidenceId)
    if (item) {
      soundFx.playPaper()
      setInspectingEvidence(item)
    }
  }

  // Send prompt to AI consultant
  const handleSendPrompt = async (prompt: string) => {
    setLoading(true)
    try {
      const res = await fetch("/api/ai/interact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          caseId: caseData.id,
          prompt,
          retrievalMethod,
        }),
      })
      const data = await res.json()
      setResponses((prev) => [
        ...prev,
        {
          prompt,
          response: data.response ?? "No findings returned.",
          time: data.timings?.totalResponseTimeMs ?? 0,
          retrievedContext: data.context ?? data.retrievedContext,
        },
      ])
    } catch (error) {
      console.error("Failed to query consultant:", error)
    } finally {
      setLoading(false)
    }
  }

  // Cross examine a specific suspect
  const handleCrossExamineSuspect = (suspect: Suspect) => {
    const cleanName = sanitizeName(suspect.name)
    const prompt = `Cross-examine ${cleanName}: audit their stated alibi, device activity, and physical movements during the exfiltration window between 02:00 and 05:00.`
    handleSendPrompt(prompt)
  }

  const selectedSuspect = caseData.suspects.find((s) => s.id === selectedSuspectId)
  const pinnedEvidenceList = caseData.evidence.filter((e) => pinnedEvidenceIds.includes(e.id))
  const allSuspectNames = caseData.suspects.map((s) => s.name)

  return (
    <div className="min-h-screen md:h-screen flex flex-col bg-[#14110e] bg-corkboard overflow-x-hidden select-none">
      {/* Top Desk Header */}
      <DeskHeader
        caseTitle={caseData.title}
        retrievalMethod={retrievalMethod}
        pinnedCount={pinnedEvidenceIds.length}
        hasDeduction={deductionResult !== null}
        onOpenBriefing={() => setShowBriefingModal(true)}
        onOpenIndictment={() => setShowAccusationModal(true)}
        onBack={onBack}
      />

      {/* Main 3-Column Desk Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden p-2 sm:p-3 gap-2 sm:gap-3">
        {/* Left Column: Suspect Dossiers (w-80) */}
        <aside className="w-full lg:w-80 h-[32vh] min-h-[260px] lg:h-auto flex flex-col min-h-0 flex-none">
          <SuspectDossiers
            suspects={caseData.suspects}
            selectedSuspectId={selectedSuspectId}
            onSelectSuspect={(id) => setSelectedSuspectId(id === selectedSuspectId ? null : id)}
            onCrossExamine={handleCrossExamineSuspect}
          />
        </aside>

        {/* Center Column: The Evidence Corkboard */}
        <main className="w-full lg:flex-1 h-[45vh] min-h-[320px] lg:h-auto flex flex-col min-h-0 min-w-0">
          <EvidenceBoard
            evidenceList={caseData.evidence}
            pinnedEvidenceIds={pinnedEvidenceIds}
            selectedEvidenceId={selectedEvidenceId}
            onTogglePin={handleTogglePin}
            onSelectEvidence={handleSelectEvidence}
          />
        </main>

        {/* Right Column: AI Forensic Consultant Terminal (w-96) */}
        <aside className="w-full lg:w-96 h-[40vh] min-h-[300px] lg:h-auto flex flex-col min-h-0 flex-none">
          <ConsultantTerminal
            responses={responses}
            loading={loading}
            onSendPrompt={handleSendPrompt}
          />
        </aside>
      </div>

      {/* Floating Suspect Inspection Card (if suspect selected) */}
      {selectedSuspect && !inspectingEvidence && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-xl w-full mx-auto px-4 animate-in slide-in-from-bottom-3 duration-200">
          <div className="p-4 rounded-xl bg-[#f4ede2] text-[#26211c] border-2 border-[#82715d] shadow-2xl relative">
            <button
              onClick={() => {
                soundFx.playClick()
                setSelectedSuspectId(null)
              }}
              className="absolute top-3 right-3 p-1 rounded hover:bg-black/10 text-[#524131]"
              title="Close inspection"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 pr-8">
              <div className="text-[10px] font-mono font-bold uppercase text-[#854d0e]">
                Suspect Profile Record
              </div>
              <h4 className="text-sm font-serif font-bold text-[#1c1917]">
                {sanitizeName(selectedSuspect.name)}
              </h4>
              <p className="text-xs font-serif text-[#44382c] leading-relaxed">
                {selectedSuspect.profile}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rich Click-to-Expand Evidence Dossier Modal */}
      <EvidenceDetailModal
        evidence={inspectingEvidence}
        isPinned={inspectingEvidence ? pinnedEvidenceIds.includes(inspectingEvidence.id) : false}
        allSuspectNames={allSuspectNames}
        onClose={() => setInspectingEvidence(null)}
        onTogglePin={handleTogglePin}
        onAskConsultant={(prompt) => handleSendPrompt(prompt)}
      />

      {/* Full Case Briefing & Crime Chronology Modal */}
      <CaseBriefingModal
        isOpen={showBriefingModal}
        caseTitle={caseData.title}
        caseDescription={caseData.description}
        suspectCount={caseData.suspects.length}
        evidenceCount={caseData.evidence.length}
        onClose={() => setShowBriefingModal(false)}
      />

      {/* Accusation & Indictment Presentation Modal */}
      <AccusationTrialModal
        isOpen={showAccusationModal}
        suspects={caseData.suspects}
        pinnedEvidence={pinnedEvidenceList}
        sessionId={sessionId}
        existingResult={deductionResult}
        onClose={() => setShowAccusationModal(false)}
        onSuccess={(res) => setDeductionResult(res)}
      />
    </div>
  )
}
