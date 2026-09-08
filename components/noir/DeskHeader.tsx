"use client"

import { useEffect, useState } from "react"
import { Volume2, VolumeX, FolderKanban, Clock, Pin, Award, ArrowLeft, ShieldAlert } from "lucide-react"
import { soundFx } from "@/lib/audio"
import type { RetrievalMethod } from "@/lib/retrieval/types"

interface DeskHeaderProps {
  caseTitle: string
  retrievalMethod: RetrievalMethod
  pinnedCount: number
  hasDeduction: boolean
  onOpenBriefing: () => void
  onOpenIndictment: () => void
  onBack: () => void
}

export default function DeskHeader({
  caseTitle,
  retrievalMethod,
  pinnedCount,
  hasDeduction,
  onOpenBriefing,
  onOpenIndictment,
  onBack,
}: DeskHeaderProps) {
  const [seconds, setSeconds] = useState(0)
  const [muted, setMuted] = useState(false)

  useEffect(() => {
    setMuted(soundFx.isMuted())
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleToggleMute = () => {
    const isNowMuted = soundFx.toggleMute()
    setMuted(isNowMuted)
    if (!isNowMuted) soundFx.playClick()
  }

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0")
    const s = (sec % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }

  const methodLabel: Record<RetrievalMethod, { name: string; tag: string }> = {
    sparse: { name: "BM25 Keyword Cross-Ref", tag: "Lexical" },
    dense: { name: "Neural Vector Memory", tag: "Semantic" },
    hybrid: { name: "Master Detective Fusion", tag: "RRF Fusion" },
  }

  return (
    <header className="bg-[#1c1814] border-b border-[#382f26] px-6 py-3 shadow-md flex-none select-none">
      <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Left: Case Info */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              soundFx.playPaper()
              onBack()
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2a241d] hover:bg-[#3d3328] text-[#d6c7b2] text-xs font-mono border border-[#4a3d31] transition"
            title="Return to case archives"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Case Files</span>
          </button>

          <div className="h-6 w-px bg-[#3d3328]" />

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-[#2e261f] border border-[#524436] flex items-center justify-center text-[#c99a5e]">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-[#3b1717] text-[#f87171] border border-[#7f1d1d]">
                  Classified Docket
                </span>
                <span className="text-xs text-[#a89984] font-mono">
                  Method: <span className="text-[#e2d5c3] font-semibold">{methodLabel[retrievalMethod].name}</span>
                </span>
              </div>
              <h1 className="text-lg font-bold text-[#f5efe6] font-serif tracking-tight leading-tight">
                {caseTitle}
              </h1>
            </div>
          </div>
        </div>

        {/* Center: Case Telemetry & Counters */}
        <div className="flex items-center gap-6 bg-[#161310] border border-[#2e261f] px-4 py-1.5 rounded-lg text-xs font-mono">
          <div className="flex items-center gap-2 text-[#b0a290]" title="Investigation Time">
            <Clock className="w-4 h-4 text-[#c99a5e]" />
            <span className="text-[#f5efe6] font-bold text-sm tracking-wider">{formatTimer(seconds)}</span>
          </div>

          <div className="h-4 w-px bg-[#2e261f]" />

          <div className="flex items-center gap-2 text-[#b0a290]" title="Pinned Clues">
            <Pin className="w-4 h-4 text-[#ef4444] fill-[#ef4444]" />
            <span>
              <strong className="text-[#f5efe6]">{pinnedCount}</strong> Clues Pinned
            </span>
          </div>
        </div>

        {/* Right: Sound Toggle & Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleMute}
            className={`p-2 rounded border transition ${
              muted
                ? "bg-[#2e1d1d] border-[#5e2d2d] text-[#f87171]"
                : "bg-[#25201a] border-[#44382c] text-[#c99a5e] hover:bg-[#332b23]"
            }`}
            title={muted ? "Unmute sound effects" : "Mute sound effects"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            onClick={() => {
              soundFx.playPaper()
              onOpenBriefing()
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded bg-[#2a221a] hover:bg-[#382d23] text-[#e2d5c3] font-mono text-xs border border-[#4a3d31] transition"
            title="View full incident briefing and crime timeline"
          >
            <FolderKanban className="w-4 h-4 text-[#c99a5e]" />
            <span>Case Chronology</span>
          </button>

          <button
            onClick={() => {
              soundFx.playStamp()
              onOpenIndictment()
            }}
            className={`flex items-center gap-2 px-5 py-2 rounded font-serif font-bold text-sm shadow-lg transition border ${
              hasDeduction
                ? "bg-[#1f3824] border-[#2e5e37] text-[#86efac] hover:bg-[#28492e]"
                : "bg-[#8b1e1e] border-[#b91c1c] text-[#fef2f2] hover:bg-[#a52424] hover:shadow-red-950/50"
            }`}
          >
            {hasDeduction ? (
              <>
                <Award className="w-4 h-4" />
                <span>Verdict Delivered</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>Indict Culprit</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
