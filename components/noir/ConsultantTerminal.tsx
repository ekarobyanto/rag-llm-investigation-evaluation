"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import {
  Send,
  Bot,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  FileSearch,
  Flame,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Search,
  X,
  Copy,
  Check,
} from "lucide-react"
import { soundFx } from "@/lib/audio"
import MarkdownResponse from "@/components/MarkdownResponse"

interface InteractionResponse {
  prompt: string
  response: string
  time: number
  retrievedContext?: string
}

interface ConsultantTerminalProps {
  responses: InteractionResponse[]
  loading: boolean
  onSendPrompt: (prompt: string) => Promise<void>
}

const PREDEFINED_INQUIRIES = [
  { label: "Check Suspect Alibis", query: "Compare the alibis of all suspects against forensic evidence.", icon: FileSearch },
  { label: "Find Contradictions", query: "Identify any direct contradictions between witness statements and physical/telemetry evidence.", icon: Flame },
  { label: "Trace Exfiltration Path", query: "Analyze how svc-threatfeed was accessed and trace the IP address/vpn connection origin.", icon: ShieldCheck },
  { label: "Crime Timeline Audit", query: "Synthesize a chronological timeline of events between 01:00 and 06:00 on January 15.", icon: Clock },
  { label: "Next Best Action", query: "Based on the evidence collected so far, what should the investigator focus on next?", icon: HelpCircle },
]

export default function ConsultantTerminal({ responses, loading, onSendPrompt }: ConsultantTerminalProps) {
  const [customPrompt, setCustomPrompt] = useState("")
  const [expandedContextIndex, setExpandedContextIndex] = useState<number | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [filterQuery, setFilterQuery] = useState("")
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const modalTranscriptEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll when new responses arrive
  useEffect(() => {
    if (isExpanded) {
      modalTranscriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
    } else {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [responses.length, loading, isExpanded])

  // Close expanded dialog on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExpanded) {
        soundFx.playClick()
        setIsExpanded(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isExpanded])

  const handleQuickPrompt = async (query: string) => {
    soundFx.playClick()
    await onSendPrompt(query)
  }

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customPrompt.trim() || loading) return
    soundFx.playClick()
    const p = customPrompt
    setCustomPrompt("")
    await onSendPrompt(p)
  }

  const handleCopy = (text: string, idx: number) => {
    soundFx.playClick()
    navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const filteredResponses = useMemo(() => {
    if (!filterQuery.trim()) return responses
    const q = filterQuery.toLowerCase()
    return responses.filter(
      (r) =>
        r.prompt.toLowerCase().includes(q) ||
        r.response.toLowerCase().includes(q) ||
        (r.retrievedContext?.toLowerCase().includes(q) ?? false)
    )
  }, [responses, filterQuery])

  // Render a single inquiry/response bubble
  const renderResponseBubble = (r: InteractionResponse, idx: number, isModal: boolean) => {
    const isContextOpen = expandedContextIndex === idx
    const isCopied = copiedIdx === idx

    return (
      <div
        key={idx}
        className={`bg-[#201a15] border border-[#382f25] rounded-lg ${
          isModal ? "p-4 space-y-3" : "p-3.5 space-y-2"
        } text-left shadow-sm hover:border-[#4d3f32] transition`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-[#30261e] pb-2">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#8a7a68] block mb-0.5">
              Inquiry #{idx + 1}
            </span>
            <div className="text-xs font-mono font-bold text-[#c99a5e] leading-snug break-words">
              Inquiry: <span className="text-[#f5efe6] font-normal">{r.prompt}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-none ml-2">
            <span className="text-[10px] font-mono text-[#8a7a68] px-1.5 py-0.5 rounded bg-[#181411] border border-[#2d241c]">
              {r.time}ms
            </span>
            <button
              type="button"
              onClick={() => handleCopy(r.response, idx)}
              className="p-1 rounded hover:bg-[#2e251d] text-[#8a7a68] hover:text-[#e0a96d] transition"
              title="Copy response to clipboard"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-[#86efac]" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <MarkdownResponse
          content={r.response}
          variant="noir"
          className={isModal ? "text-sm leading-relaxed" : "text-xs"}
        />

        {r.retrievedContext && (
          <div className="pt-2 border-t border-[#30261e]">
            <button
              type="button"
              onClick={() => setExpandedContextIndex(isContextOpen ? null : idx)}
              className="flex items-center justify-between w-full text-[10px] font-mono text-[#a89984] hover:text-[#e2d5c3] transition py-0.5"
            >
              <span className="flex items-center gap-1.5">
                <FileSearch className="w-3 h-3 text-[#c99a5e]" />
                <span>Referenced Evidence & Forensic Chunks</span>
              </span>
              {isContextOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {isContextOpen && (
              <div
                className={`mt-2 p-3 rounded bg-[#181411] border border-[#2e261f] text-[11px] font-mono text-[#b8a994] whitespace-pre-wrap ${
                  isModal ? "max-h-72" : "max-h-40"
                } overflow-y-auto leading-relaxed select-text`}
              >
                {r.retrievedContext}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Docked Sidebar Terminal Container */}
      <div className="flex flex-col h-full bg-[#181411] border border-[#332a21] rounded-lg shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#241e18] px-3.5 py-2.5 border-b border-[#3b3127] flex items-center justify-between flex-none">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded bg-[#38281a] border border-[#5a422a] flex items-center justify-center text-[#e0a96d] flex-none">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <h2 className="text-xs font-serif font-bold text-[#f5efe6] tracking-wide truncate">Forensic Consultant</h2>
              <p className="text-[10px] font-mono text-[#a89984] truncate">AI Investigation Partner</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1f3824] text-[#86efac] border border-[#2e5e37]">
              ONLINE
            </span>
            <button
              type="button"
              onClick={() => {
                soundFx.playPaper()
                setIsExpanded(true)
              }}
              className="p-1.5 rounded hover:bg-[#34291f] text-[#c99a5e] hover:text-[#f5efe6] border border-[#44382c] transition flex items-center gap-1"
              title="Expand into full dialog popup"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="text-[10px] font-mono hidden sm:inline">Expand</span>
            </button>
          </div>
        </div>

        {isExpanded ? (
          /* Placeholder while expanded */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#8a7a68] space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#2a221a] border border-[#44382c] flex items-center justify-center text-[#c99a5e]">
              <Maximize2 className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="font-serif font-bold text-sm text-[#f5efe6]">Terminal Expanded</h3>
              <p className="text-xs font-mono text-[#a89984] max-w-[200px] leading-relaxed">
                Viewing forensic inquiries in dialog window.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick()
                setIsExpanded(false)
              }}
              className="px-3 py-1.5 rounded bg-[#2e261f] hover:bg-[#3d3328] text-xs font-mono text-[#c99a5e] border border-[#44382c] transition"
            >
              Collapse to Sidebar
            </button>
          </div>
        ) : (
          <>
            {/* Quick Inquiries Strip */}
            <div className="bg-[#1f1914] px-3 py-2 border-b border-[#332920] flex-none">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#8a7a68] mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#c99a5e]" />
                <span>Tactical Inquiries</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PREDEFINED_INQUIRIES.map((item, idx) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickPrompt(item.query)}
                      disabled={loading}
                      className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded bg-[#2b241c] hover:bg-[#3d3328] text-[#e2d5c3] border border-[#44382c] transition disabled:opacity-50"
                    >
                      <Icon className="w-3 h-3 text-[#c99a5e]" />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Response Transcript Stream */}
            <div className="overflow-y-auto p-3.5 space-y-3.5 flex-1">
              {responses.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8a7a68]">
                  <FileSearch className="w-10 h-10 text-[#524436] mb-3" />
                  <h3 className="font-serif font-bold text-sm text-[#c99a5e] mb-1">Consultant Dispatch Ready</h3>
                  <p className="text-xs font-mono max-w-xs leading-relaxed">
                    Select a tactical inquiry above or ask a specific question regarding suspect alibis, logs, or contradictions.
                  </p>
                </div>
              ) : (
                responses.map((r, idx) => renderResponseBubble(r, idx, false))
              )}

              {loading && (
                <div className="p-4 rounded-lg bg-[#251e18] border border-[#44372a] text-center space-y-2 animate-pulse">
                  <div className="text-xs font-mono text-[#c99a5e]">Analyzing investigative records & evidence...</div>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Bottom Custom Question Input */}
            <form onSubmit={handleCustomSubmit} className="bg-[#241e18] p-3 border-t border-[#3b3127] flex-none">
              <div className="relative">
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Type investigative dispatch or question..."
                  rows={2}
                  className="w-full bg-[#181411] border border-[#42372c] rounded-md p-2 pr-10 text-xs text-[#f5efe6] placeholder-[#8a7a68] font-mono focus:outline-none focus:border-[#c99a5e] resize-none"
                />
                <button
                  type="submit"
                  disabled={loading || !customPrompt.trim()}
                  className="absolute right-2 bottom-2.5 p-1.5 rounded bg-[#c99a5e] text-[#1c1813] hover:bg-[#e0b57c] disabled:opacity-40 transition font-bold"
                  title="Dispatch question"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Expandable Modal / Dialog Popup */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => {
            soundFx.playClick()
            setIsExpanded(false)
          }}
        >
          <div
            className="w-full max-w-5xl h-[90vh] bg-[#181411] border-2 border-[#5a422a] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div className="bg-[#241e18] px-5 py-3.5 border-b border-[#3b3127] flex flex-wrap items-center justify-between gap-3 flex-none">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#38281a] border border-[#5a422a] flex items-center justify-center text-[#e0a96d]">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-serif font-bold text-[#f5efe6] tracking-wide">
                      Forensic Consultant Terminal
                    </h2>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1f3824] text-[#86efac] border border-[#2e5e37]">
                      ONLINE
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#2e251d] text-[#c99a5e] border border-[#44382c]">
                      {responses.length} Inquiries Logged
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-[#a89984]">
                    Expanded Investigative Transcript & Forensic Cross-Examination
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Search / Filter past interactions */}
                <div className="relative w-64 sm:w-72">
                  <Search className="w-3.5 h-3.5 text-[#8a7a68] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    placeholder="Search past inquiries & clues..."
                    className="w-full bg-[#120f0d] border border-[#3d3226] rounded-md py-1.5 pl-8 pr-7 text-xs font-mono text-[#f5efe6] placeholder-[#7d6e5d] focus:outline-none focus:border-[#c99a5e]"
                  />
                  {filterQuery && (
                    <button
                      type="button"
                      onClick={() => setFilterQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8a7a68] hover:text-[#f5efe6]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Minimize / Return to Docked */}
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick()
                    setIsExpanded(false)
                  }}
                  className="p-1.5 rounded bg-[#2a221a] hover:bg-[#382e24] text-[#c99a5e] border border-[#44382c] transition"
                  title="Minimize to sidebar (Esc)"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick()
                    setIsExpanded(false)
                  }}
                  className="p-1.5 rounded bg-[#2a221a] hover:bg-[#382e24] text-[#8a7a68] hover:text-[#f5efe6] border border-[#44382c] transition"
                  title="Close dialog (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Tactical Inquiries Banner */}
            <div className="bg-[#1f1914] px-5 py-2.5 border-b border-[#332920] flex items-center justify-between gap-3 flex-none flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#8a7a68] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#c99a5e]" />
                  <span>Tactical Inquiries:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PREDEFINED_INQUIRIES.map((item, idx) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleQuickPrompt(item.query)}
                        disabled={loading}
                        className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded bg-[#2b241c] hover:bg-[#3d3328] text-[#e2d5c3] border border-[#44382c] transition disabled:opacity-50"
                      >
                        <Icon className="w-3.5 h-3.5 text-[#c99a5e]" />
                        <span>{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {filterQuery && (
                <div className="text-[11px] font-mono text-[#c99a5e] flex items-center gap-2">
                  <span>
                    Found {filteredResponses.length} of {responses.length} matches
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterQuery("")}
                    className="underline text-[#a89984] hover:text-white"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            {/* Large Scrollable Dialogue Stream */}
            <div className="overflow-y-auto p-6 space-y-4 flex-1">
              {responses.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#8a7a68]">
                  <FileSearch className="w-14 h-14 text-[#524436] mb-4" />
                  <h3 className="font-serif font-bold text-base text-[#c99a5e] mb-1">
                    Consultant Dispatch Terminal Ready
                  </h3>
                  <p className="text-xs font-mono max-w-md leading-relaxed text-[#a89984]">
                    Launch tactical inquiries above or ask specific questions to cross-examine suspects, audit server logs,
                    and verify timelines across the evidence vault.
                  </p>
                </div>
              ) : filteredResponses.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#8a7a68] space-y-3">
                  <Search className="w-10 h-10 text-[#524436]" />
                  <div className="text-sm font-mono text-[#e6dfd5]">
                    No inquiries found matching &quot;{filterQuery}&quot;
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterQuery("")}
                    className="px-3 py-1.5 rounded bg-[#2b241c] hover:bg-[#3d3328] text-xs font-mono text-[#c99a5e] border border-[#44382c] transition"
                  >
                    Clear Filter
                  </button>
                </div>
              ) : (
                filteredResponses.map((r, idx) => renderResponseBubble(r, idx, true))
              )}

              {loading && (
                <div className="p-5 rounded-lg bg-[#251e18] border border-[#44372a] text-center space-y-2 animate-pulse">
                  <div className="text-sm font-mono text-[#c99a5e]">
                    Analyzing investigative records & cross-referencing evidence...
                  </div>
                </div>
              )}
              <div ref={modalTranscriptEndRef} />
            </div>

            {/* Bottom Modal Question Input */}
            <form onSubmit={handleCustomSubmit} className="bg-[#241e18] p-4 border-t border-[#3b3127] flex-none">
              <div className="relative">
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Type an investigative dispatch, ask about suspect contradictions, or request timeline verification..."
                  rows={3}
                  className="w-full bg-[#181411] border border-[#42372c] rounded-lg p-3 pr-12 text-sm text-[#f5efe6] placeholder-[#8a7a68] font-mono focus:outline-none focus:border-[#c99a5e] resize-none"
                />
                <button
                  type="submit"
                  disabled={loading || !customPrompt.trim()}
                  className="absolute right-3 bottom-3.5 p-2 rounded-md bg-[#c99a5e] text-[#1c1813] hover:bg-[#e0b57c] disabled:opacity-40 transition font-bold"
                  title="Dispatch question (Enter)"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
