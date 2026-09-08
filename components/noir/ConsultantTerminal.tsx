"use client"

import { useState } from "react"
import { Send, Bot, Sparkles, Clock, ChevronDown, ChevronUp, HelpCircle, FileSearch, Flame, ShieldCheck } from "lucide-react"
import { soundFx } from "@/lib/audio"

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

  return (
    <div className="flex flex-col h-full bg-[#181411] border border-[#332a21] rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#241e18] px-4 py-3 border-b border-[#3b3127] flex items-center justify-between flex-none">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#38281a] border border-[#5a422a] flex items-center justify-center text-[#e0a96d]">
            <Bot className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-sm font-serif font-bold text-[#f5efe6] tracking-wide">Forensic Consultant</h2>
            <p className="text-[10px] font-mono text-[#a89984]">AI Investigation Partner</p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1f3824] text-[#86efac] border border-[#2e5e37]">
          ONLINE
        </span>
      </div>

      {/* Quick Inquiries Strip */}
      <div className="bg-[#1f1914] px-3 py-2.5 border-b border-[#332920] flex-none">
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
      <div className="overflow-y-auto p-4 space-y-4 flex-1">
        {responses.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#8a7a68]">
            <FileSearch className="w-10 h-10 text-[#524436] mb-3" />
            <h3 className="font-serif font-bold text-sm text-[#c99a5e] mb-1">Consultant Dispatch Ready</h3>
            <p className="text-xs font-mono max-w-xs leading-relaxed">
              Select a tactical inquiry above or ask a specific question regarding suspect alibis, logs, or contradictions.
            </p>
          </div>
        ) : (
          responses.map((r, idx) => {
            const isContextOpen = expandedContextIndex === idx
            return (
              <div key={idx} className="bg-[#201a15] border border-[#382f25] rounded-lg p-3.5 space-y-2 text-left shadow-sm">
                <div className="flex items-start justify-between gap-2 border-b border-[#30261e] pb-2">
                  <div className="text-xs font-mono font-bold text-[#c99a5e]">
                    Inquiry: <span className="text-[#f5efe6]">{r.prompt}</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8a7a68] px-1.5 py-0.5 rounded bg-[#181411]">
                    {r.time}ms
                  </span>
                </div>

                <div className="text-xs font-serif text-[#e6dfd5] leading-relaxed whitespace-pre-wrap">
                  {r.response}
                </div>

                {r.retrievedContext && (
                  <div className="pt-2 border-t border-[#30261e]">
                    <button
                      onClick={() => setExpandedContextIndex(isContextOpen ? null : idx)}
                      className="flex items-center justify-between w-full text-[10px] font-mono text-[#a89984] hover:text-[#e2d5c3]"
                    >
                      <span>Referenced Clues & Context</span>
                      {isContextOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {isContextOpen && (
                      <div className="mt-2 p-2.5 rounded bg-[#181411] border border-[#2e261f] text-[11px] font-mono text-[#b8a994] whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {r.retrievedContext}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}

        {loading && (
          <div className="p-4 rounded-lg bg-[#251e18] border border-[#44372a] text-center space-y-2 animate-pulse">
            <div className="text-xs font-mono text-[#c99a5e]">Analyzing investigative records & evidence...</div>
          </div>
        )}
      </div>

      {/* Bottom Custom Question Input */}
      <form onSubmit={handleCustomSubmit} className="bg-[#241e18] p-3 border-t border-[#3b3127] flex-none">
        <div className="relative">
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Type investigative dispatch or question..."
            rows={2}
            className="w-full bg-[#181411] border border-[#42372c] rounded-md p-2 text-xs text-[#f5efe6] placeholder-[#8a7a68] font-mono focus:outline-none focus:border-[#c99a5e] resize-none"
          />
          <button
            type="submit"
            disabled={loading || !customPrompt.trim()}
            className="absolute right-2 bottom-2 p-1.5 rounded bg-[#c99a5e] text-[#1c1813] hover:bg-[#e0b57c] disabled:opacity-40 transition font-bold"
            title="Dispatch question"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  )
}
