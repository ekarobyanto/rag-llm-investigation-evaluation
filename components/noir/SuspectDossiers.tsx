"use client"

import { useState } from "react"
import { User, MessageSquare, AlertCircle, CheckCircle2, HelpCircle } from "lucide-react"
import { soundFx } from "@/lib/audio"

export type SuspicionLevel = "unverified" | "cleared" | "poi" | "suspect"

export interface Suspect {
  id: string
  name: string
  profile: string
}

interface SuspectDossiersProps {
  suspects: Suspect[]
  selectedSuspectId: string | null
  onSelectSuspect: (suspectId: string) => void
  onCrossExamine: (suspect: Suspect) => void
}

// Cleans up any spoiler labels from the raw input data
export function sanitizeProfile(profile: string): string {
  return profile
    .replace(/\s*\((?:culprit|red herring|clearly innocent|suspicious red herring|motive but no skills)\)/gi, "")
    .trim()
}

export function sanitizeName(name: string): string {
  return name
    .replace(/\s*\((?:culprit|red herring|clearly innocent|suspicious red herring|motive but no skills)\)/gi, "")
    .trim()
}

export default function SuspectDossiers({
  suspects,
  selectedSuspectId,
  onSelectSuspect,
  onCrossExamine,
}: SuspectDossiersProps) {
  // Local suspicion levels map
  const [suspicionMap, setSuspicionMap] = useState<Record<string, SuspicionLevel>>({})

  const handleCycleSuspicion = (e: React.MouseEvent, suspectId: string) => {
    e.stopPropagation()
    soundFx.playStamp()
    setSuspicionMap((prev) => {
      const current = prev[suspectId] ?? "unverified"
      const cycle: Record<SuspicionLevel, SuspicionLevel> = {
        unverified: "poi",
        poi: "suspect",
        suspect: "cleared",
        cleared: "unverified",
      }
      return { ...prev, [suspectId]: cycle[current] }
    })
  }

  const getStampConfig = (level: SuspicionLevel) => {
    switch (level) {
      case "cleared":
        return {
          label: "CLEARED",
          className: "text-[#4ade80] border-[#22c55e] bg-[#14532d]/20",
          icon: CheckCircle2,
        }
      case "poi":
        return {
          label: "P.O.I.",
          className: "text-[#fbbf24] border-[#f59e0b] bg-[#78350f]/20",
          icon: HelpCircle,
        }
      case "suspect":
        return {
          label: "PRIME SUSPECT",
          className: "text-[#f87171] border-[#ef4444] bg-[#7f1d1d]/20",
          icon: AlertCircle,
        }
      default:
        return {
          label: "UNVERIFIED",
          className: "text-[#a89984] border-[#574c3f] bg-[#29221b]/40",
          icon: User,
        }
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#181411] border border-[#332a21] rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#241e18] px-4 py-3 border-b border-[#3b3127] flex items-center justify-between flex-none">
        <div>
          <h2 className="text-sm font-serif font-bold text-[#f5efe6] tracking-wide flex items-center gap-2">
            <User className="w-4 h-4 text-[#c99a5e]" />
            <span>Suspect Dossiers</span>
          </h2>
          <p className="text-[11px] font-mono text-[#a89984]">Click stamp to update suspicion</p>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#2e261f] text-[#c99a5e] border border-[#4a3d31]">
          {suspects.length} Persons
        </span>
      </div>

      {/* Suspect list */}
      <div className="overflow-y-auto p-3 space-y-3 flex-1">
        {suspects.map((suspect) => {
          const isSelected = selectedSuspectId === suspect.id
          const cleanName = sanitizeName(suspect.name)
          const cleanProfile = sanitizeProfile(suspect.profile)
          const suspicion = suspicionMap[suspect.id] ?? "unverified"
          const stamp = getStampConfig(suspicion)
          const StampIcon = stamp.icon

          return (
            <div
              key={suspect.id}
              onClick={() => {
                soundFx.playPaper()
                onSelectSuspect(suspect.id)
              }}
              className={`p-3.5 rounded-lg cursor-pointer transition border text-left ${
                isSelected
                  ? "bg-[#2c241c] border-[#c99a5e] shadow-md shadow-amber-950/20"
                  : "bg-[#201a15] border-[#382f25] hover:border-[#524436] hover:bg-[#251f19]"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded bg-[#2e261f] border border-[#524436] flex items-center justify-center font-mono font-bold text-xs text-[#c99a5e] shrink-0">
                    {cleanName.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-serif font-bold text-[#f5efe6]">{cleanName}</h3>
                    <div className="text-[11px] font-mono text-[#c99a5e] mt-0.5">{cleanProfile}</div>
                  </div>
                </div>

                {/* Tactile Rubber Stamp Selector */}
                <button
                  onClick={(e) => handleCycleSuspicion(e, suspect.id)}
                  title="Click to cycle suspicion level"
                  className={`flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-dashed transition hover:scale-105 active:scale-95 shrink-0 ${stamp.className}`}
                >
                  <StampIcon className="w-3 h-3" />
                  <span>{stamp.label}</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-[#332920] mt-2 text-xs">
                <span className="text-[10px] font-mono text-[#8a7a68]">
                  ID: #{suspect.id.slice(-4).toUpperCase()}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    soundFx.playClick()
                    onCrossExamine(suspect)
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-[#2e261f] hover:bg-[#3d3328] text-[#e2d5c3] text-[11px] font-mono border border-[#4d3f32] transition"
                >
                  <MessageSquare className="w-3 h-3 text-[#c99a5e]" />
                  <span>Question</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
