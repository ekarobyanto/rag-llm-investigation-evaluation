"use client"

import { useState, useMemo } from "react"
import { Search, Pin, FileText, Camera, MessageCircle, DollarSign, Mail, Sparkles, Filter } from "lucide-react"
import { soundFx } from "@/lib/audio"

export interface EvidenceItem {
  id: string
  type: string
  content: string
  category?: string
  difficultyWeight?: number
}

interface EvidenceBoardProps {
  evidenceList: EvidenceItem[]
  pinnedEvidenceIds: string[]
  selectedEvidenceId: string | null
  onTogglePin: (evidenceId: string) => void
  onSelectEvidence: (evidenceId: string) => void
}

type EvidenceCategoryTab = "all" | "forensic" | "surveillance" | "witness" | "financial" | "email" | "pinned"

export default function EvidenceBoard({
  evidenceList,
  pinnedEvidenceIds,
  selectedEvidenceId,
  onTogglePin,
  onSelectEvidence,
}: EvidenceBoardProps) {
  const [activeTab, setActiveTab] = useState<EvidenceCategoryTab>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const categoryConfig: Record<string, { label: string; icon: typeof FileText; color: string; bg: string }> = {
    forensic_report: { label: "Forensics", icon: FileText, color: "text-[#38bdf8]", bg: "bg-[#0c4a6e]/20 border-[#0284c7]/40" },
    location_report: { label: "Location Log", icon: Camera, color: "text-[#fb923c]", bg: "bg-[#7c2d12]/20 border-[#ea580c]/40" },
    cctv_log: { label: "CCTV Log", icon: Camera, color: "text-[#fb923c]", bg: "bg-[#7c2d12]/20 border-[#ea580c]/40" },
    witness_statement: { label: "Witness", icon: MessageCircle, color: "text-[#c084fc]", bg: "bg-[#581c87]/20 border-[#9333ea]/40" },
    financial_record: { label: "Financial", icon: DollarSign, color: "text-[#4ade80]", bg: "bg-[#14532d]/20 border-[#16a34a]/40" },
    email_message: { label: "Email/Memo", icon: Mail, color: "text-[#f472b6]", bg: "bg-[#831843]/20 border-[#db2777]/40" },
  }

  const filteredEvidence = useMemo(() => {
    return evidenceList.filter((e) => {
      // Tab filter
      if (activeTab === "pinned") {
        if (!pinnedEvidenceIds.includes(e.id)) return false
      } else if (activeTab === "forensic") {
        if (e.type !== "forensic_report") return false
      } else if (activeTab === "surveillance") {
        if (e.type !== "cctv_log" && e.type !== "location_report") return false
      } else if (activeTab === "witness") {
        if (e.type !== "witness_statement") return false
      } else if (activeTab === "financial") {
        if (e.type !== "financial_record") return false
      } else if (activeTab === "email") {
        if (e.type !== "email_message") return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return e.content.toLowerCase().includes(q) || e.type.toLowerCase().includes(q)
      }

      return true
    })
  }, [evidenceList, activeTab, searchQuery, pinnedEvidenceIds])

  const pinnedItems = useMemo(() => {
    return evidenceList.filter((e) => pinnedEvidenceIds.includes(e.id))
  }, [evidenceList, pinnedEvidenceIds])

  const getCategoryMeta = (type: string) => {
    return (
      categoryConfig[type] ?? {
        label: type.replace(/_/g, " "),
        icon: FileText,
        color: "text-[#c99a5e]",
        bg: "bg-[#382f25]/30 border-[#524436]",
      }
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#181411] border border-[#332a21] rounded-lg shadow-xl overflow-hidden">
      {/* Top Search & Category Filter Bar */}
      <div className="bg-[#241e18] p-3 border-b border-[#3b3127] space-y-2.5 flex-none">
        <div className="flex items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#8a7a68]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evidence, timestamps, IP addresses, statements..."
              className="w-full bg-[#181411] border border-[#42372c] rounded-md pl-9 pr-3 py-1.5 text-xs text-[#f5efe6] placeholder-[#8a7a68] font-mono focus:outline-none focus:border-[#c99a5e]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-xs text-[#8a7a68] hover:text-[#f5efe6]"
              >
                ✕
              </button>
            )}
          </div>

          <div className="text-xs font-mono text-[#a89984] px-2.5 py-1.5 rounded bg-[#1c1813] border border-[#332a21] whitespace-nowrap">
            Showing <strong className="text-[#f5efe6]">{filteredEvidence.length}</strong> / {evidenceList.length}
          </div>
        </div>

        {/* Manila Folder Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono select-none">
          <button
            onClick={() => {
              soundFx.playPaper()
              setActiveTab("all")
            }}
            className={`px-3 py-1 rounded transition border whitespace-nowrap ${
              activeTab === "all"
                ? "bg-[#c99a5e] text-[#1c1813] font-bold border-[#e0b57c] shadow-sm"
                : "bg-[#2b241c] text-[#a89984] border-[#44382c] hover:bg-[#332b22] hover:text-[#d6c7b2]"
            }`}
          >
            All Evidence ({evidenceList.length})
          </button>

          <button
            onClick={() => {
              soundFx.playPaper()
              setActiveTab("pinned")
            }}
            className={`flex items-center gap-1 px-3 py-1 rounded transition border whitespace-nowrap ${
              activeTab === "pinned"
                ? "bg-[#dc2626] text-white font-bold border-[#ef4444] shadow-sm shadow-red-900/40"
                : "bg-[#2b241c] text-[#f87171] border-[#502828] hover:bg-[#3b2020]"
            }`}
          >
            <Pin className="w-3 h-3 fill-current" />
            <span>Pinned ({pinnedItems.length})</span>
          </button>

          <button
            onClick={() => {
              soundFx.playPaper()
              setActiveTab("forensic")
            }}
            className={`px-3 py-1 rounded transition border whitespace-nowrap ${
              activeTab === "forensic"
                ? "bg-[#0284c7] text-white font-bold border-[#38bdf8]"
                : "bg-[#2b241c] text-[#7dd3fc] border-[#224458] hover:bg-[#1a3344]"
            }`}
          >
            Forensics
          </button>

          <button
            onClick={() => {
              soundFx.playPaper()
              setActiveTab("surveillance")
            }}
            className={`px-3 py-1 rounded transition border whitespace-nowrap ${
              activeTab === "surveillance"
                ? "bg-[#d97706] text-white font-bold border-[#fbbf24]"
                : "bg-[#2b241c] text-[#fdba74] border-[#55381a] hover:bg-[#3d2612]"
            }`}
          >
            Surveillance & CCTV
          </button>

          <button
            onClick={() => {
              soundFx.playPaper()
              setActiveTab("witness")
            }}
            className={`px-3 py-1 rounded transition border whitespace-nowrap ${
              activeTab === "witness"
                ? "bg-[#9333ea] text-white font-bold border-[#c084fc]"
                : "bg-[#2b241c] text-[#d8b4fe] border-[#442366] hover:bg-[#301948]"
            }`}
          >
            Witness Statements
          </button>

          <button
            onClick={() => {
              soundFx.playPaper()
              setActiveTab("financial")
            }}
            className={`px-3 py-1 rounded transition border whitespace-nowrap ${
              activeTab === "financial"
                ? "bg-[#16a34a] text-white font-bold border-[#4ade80]"
                : "bg-[#2b241c] text-[#86efac] border-[#1f492b] hover:bg-[#163520]"
            }`}
          >
            Financial Trail
          </button>
        </div>
      </div>

      {/* Main Evidence Canvas */}
      <div className="overflow-y-auto p-4 flex-1 space-y-4">
        {/* Pinned Clues Header on Corkboard (if any and not in pinned tab) */}
        {activeTab !== "pinned" && pinnedItems.length > 0 && (
          <div className="bg-[#241e17] border-2 border-dashed border-[#853636] rounded-lg p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono text-[#fca5a5]">
              <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                <Pin className="w-3.5 h-3.5 fill-[#ef4444] text-[#ef4444]" />
                <span>Pinned to Corkboard (Key Leads)</span>
              </span>
              <span className="text-[11px] text-[#8a7a68]">{pinnedItems.length} items</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {pinnedItems.map((item) => {
                const meta = getCategoryMeta(item.type)
                const isSelected = selectedEvidenceId === item.id
                return (
                  <div
                    key={`pinned-${item.id}`}
                    onClick={() => {
                      soundFx.playPaper()
                      onSelectEvidence(item.id)
                    }}
                    className={`p-3 rounded bg-[#f4ede2] text-[#26211c] cursor-pointer shadow-md transition relative group border-l-4 border-l-[#dc2626] ${
                      isSelected ? "ring-2 ring-[#c99a5e]" : "hover:bg-[#fff9f0]"
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        soundFx.playPin()
                        onTogglePin(item.id)
                      }}
                      className="absolute top-2 right-2 p-1 rounded hover:bg-black/10 text-[#dc2626]"
                      title="Unpin clue"
                    >
                      <Pin className="w-4 h-4 fill-current" />
                    </button>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#854d0e] mb-1">
                      {meta.label}
                    </div>
                    <p className="text-xs font-serif text-[#1c1917] line-clamp-3 leading-relaxed">
                      {item.content}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Filtered Evidence Cards Grid */}
        <div className="space-y-2.5">
          {filteredEvidence.length === 0 ? (
            <div className="text-center py-12 text-sm font-mono text-[#8a7a68]">
              No evidence matching the selected filters.
            </div>
          ) : (
            filteredEvidence.map((item) => {
              const meta = getCategoryMeta(item.type)
              const CategoryIcon = meta.icon
              const isPinned = pinnedEvidenceIds.includes(item.id)
              const isSelected = selectedEvidenceId === item.id

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    soundFx.playPaper()
                    onSelectEvidence(item.id)
                  }}
                  className={`p-3.5 rounded-lg border transition cursor-pointer text-left relative group ${
                    isSelected
                      ? "bg-[#2e261f] border-[#c99a5e] shadow-lg shadow-amber-950/20"
                      : "bg-[#1f1914] border-[#382f25] hover:border-[#5a4a3a] hover:bg-[#251e18]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${meta.bg} ${meta.color}`}
                      >
                        <CategoryIcon className="w-3 h-3" />
                        <span>{meta.label}</span>
                      </span>
                      <span className="text-[10px] font-mono text-[#8a7a68]">
                        ID: #{item.id.slice(-4).toUpperCase()}
                      </span>
                    </div>

                    {/* Pushpin Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        soundFx.playPin()
                        onTogglePin(item.id)
                      }}
                      className={`p-1.5 rounded transition ${
                        isPinned
                          ? "text-[#f87171] bg-[#7f1d1d]/30 hover:bg-[#7f1d1d]/50"
                          : "text-[#8a7a68] hover:text-[#f87171] hover:bg-[#2e261f]"
                      }`}
                      title={isPinned ? "Unpin clue" : "Pin clue to corkboard"}
                    >
                      <Pin className={`w-3.5 h-3.5 ${isPinned ? "fill-current" : ""}`} />
                    </button>
                  </div>

                  <p className="text-xs font-serif text-[#e6dfd5] leading-relaxed line-clamp-3">
                    {item.content}
                  </p>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
