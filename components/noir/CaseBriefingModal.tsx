"use client"

import { soundFx } from "@/lib/audio"
import { FolderKanban, Clock, X, ShieldAlert, CheckSquare, Target, Activity } from "lucide-react"

interface CaseBriefingModalProps {
  isOpen: boolean
  caseTitle: string
  caseDescription: string
  suspectCount: number
  evidenceCount: number
  onClose: () => void
}

const CRIME_NIGHT_MILESTONES = [
  {
    time: "Jan 14 — 22:45",
    title: "Executive Dinner Concludes",
    desc: "Sales VP James Whitfield concludes business dinner at Harbour Steak House; departs via Uber.",
    tag: "NORMAL OPERATION",
    tagColor: "text-[#4ade80] border-[#22c55e] bg-[#14532d]/20",
  },
  {
    time: "Jan 14 — 23:25",
    title: "Alibi Verified: James Whitfield",
    desc: "Home CCTV confirms Whitfield enters his residence. Device telemetry shows inactive by 00:15.",
    tag: "ALIBI CONFIRMED",
    tagColor: "text-[#4ade80] border-[#22c55e] bg-[#14532d]/20",
  },
  {
    time: "Jan 15 — 01:45",
    title: "Suspicious Telemetry: Marcus Chen Residence",
    desc: "Home office occupancy sensor and desk lamp activate continuously, directly contradicting Marcus's statement of sleeping from 11 PM.",
    tag: "CONTRADICTION",
    tagColor: "text-[#f87171] border-[#ef4444] bg-[#7f1d1d]/20",
  },
  {
    time: "Jan 15 — 02:00",
    title: "BREACH INITIATION: svc-threatfeed VPN Connects",
    desc: "High-privilege internal service account establishes an encrypted tunnel from residential IP 74.125.224.72.",
    tag: "EXFILTRATION START",
    tagColor: "text-[#f87171] border-[#ef4444] bg-[#7f1d1d]/30",
  },
  {
    time: "Jan 15 — 02:15 – 04:45",
    title: "High-Bandwidth ISP Data Transfer",
    desc: "Sustained upstream bandwidth averaging 142 Mbps recorded on residential fiber line assigned to Marcus Chen's address.",
    tag: "SMOKING GUN",
    tagColor: "text-[#f87171] border-[#ef4444] bg-[#7f1d1d]/40",
  },
  {
    time: "Jan 15 — 05:00",
    title: "Breach Tunnel Terminated",
    desc: "VPN session closed after approximately 2.3 Terabytes of classified threat intelligence data exfiltrated.",
    tag: "TUNNEL CLOSED",
    tagColor: "text-[#fbbf24] border-[#f59e0b] bg-[#78350f]/20",
  },
  {
    time: "Jan 18 — 72 Hours Later",
    title: "Dark Web Marketplace Listing",
    desc: "CyberShield security monitoring flags Nexus Dynamics database for sale on illicit cyber forums.",
    tag: "BREACH DISCLOSED",
    tagColor: "text-[#c084fc] border-[#9333ea] bg-[#581c87]/20",
  },
]

export default function CaseBriefingModal({
  isOpen,
  caseTitle,
  caseDescription,
  suspectCount,
  evidenceCount,
  onClose,
}: CaseBriefingModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none">
      <div className="relative w-full max-w-3xl bg-[#1c1813] border-2 border-[#544333] rounded-xl shadow-2xl text-[#e6dfd5] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Top Case Docket Header */}
        <div className="bg-[#261f18] px-6 py-4 border-b border-[#3d3226] flex items-center justify-between flex-none">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#382b20] border border-[#5a4533] flex items-center justify-center text-[#c99a5e]">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-[#3d1a1a] text-[#f87171] border border-[#7f1d1d]">
                  Classified Case Briefing
                </span>
                <span className="text-xs font-mono text-[#8a7a68]">
                  Docket Ref: #ND-2027-0115
                </span>
              </div>
              <h2 className="text-base font-serif font-bold text-[#f5efe6] mt-0.5">
                {caseTitle}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-[#8a7a68] hover:text-[#f5efe6] hover:bg-[#382d23] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 text-left">
          {/* Executive Summary */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#c99a5e]">
              <ShieldAlert className="w-4 h-4" />
              <span>Incident Overview & Incident Vector</span>
            </div>
            <div className="p-4 rounded-lg bg-[#241e17] border border-[#382f25] font-serif text-sm text-[#e6dfd5] leading-relaxed">
              {caseDescription}
            </div>
          </div>

          {/* Incident Telemetry Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-[#221b15] border border-[#382d22]">
              <span className="text-[10px] text-[#8a7a68] uppercase font-bold block mb-1">
                Data Volume Exfiltrated
              </span>
              <span className="font-bold text-[#f87171] text-sm">2.3 Terabytes</span>
            </div>
            <div className="p-3 rounded-lg bg-[#221b15] border border-[#382d22]">
              <span className="text-[10px] text-[#8a7a68] uppercase font-bold block mb-1">
                Suspects Under Watch
              </span>
              <span className="font-bold text-[#c99a5e] text-sm">{suspectCount} Individuals</span>
            </div>
            <div className="p-3 rounded-lg bg-[#221b15] border border-[#382d22]">
              <span className="text-[10px] text-[#8a7a68] uppercase font-bold block mb-1">
                Cataloged Evidence Items
              </span>
              <span className="font-bold text-[#38bdf8] text-sm">{evidenceCount} Records</span>
            </div>
          </div>

          {/* Crime Night Chronology */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#33271d] pb-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#c99a5e]">
                <Clock className="w-4 h-4" />
                <span>Crime-Night Chronology & Event Timeline</span>
              </div>
              <span className="text-[11px] font-mono text-[#8a7a68]">
                Critical Window: 02:00 – 05:00
              </span>
            </div>

            <div className="relative pl-6 border-l-2 border-[#47392c] space-y-4 my-2">
              {CRIME_NIGHT_MILESTONES.map((item, idx) => (
                <div key={idx} className="relative group">
                  {/* Timeline Dot */}
                  <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-[#c99a5e] border-2 border-[#1c1813] group-hover:scale-125 transition" />

                  <div className="p-3 rounded-lg bg-[#241e17] border border-[#382e23] hover:border-[#524131] transition text-left space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-[#c99a5e]">
                        {item.time}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border border-dashed ${item.tagColor}`}
                      >
                        {item.tag}
                      </span>
                    </div>

                    <h4 className="font-serif font-bold text-sm text-[#f5efe6]">
                      {item.title}
                    </h4>

                    <p className="font-serif text-xs text-[#b8a994] leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detective Objectives */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-[#c99a5e]">
              <Target className="w-4 h-4" />
              <span>Core Investigative Objectives</span>
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-[#221b15] border border-[#33281d] flex items-start gap-2.5">
                <CheckSquare className="w-4 h-4 text-[#c99a5e] shrink-0 mt-0.5" />
                <div className="text-xs font-serif leading-relaxed">
                  <strong className="text-[#f5efe6]">Audit Provisioning Logs:</strong> Identify who created the <code>svc-threatfeed</code> account and granted elevated database export permissions.
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#221b15] border border-[#33281d] flex items-start gap-2.5">
                <CheckSquare className="w-4 h-4 text-[#c99a5e] shrink-0 mt-0.5" />
                <div className="text-xs font-serif leading-relaxed">
                  <strong className="text-[#f5efe6]">Break False Alibis:</strong> Cross-examine suspect statements against smart home occupancy sensors and residential ISP upload telemetry.
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#221b15] border border-[#33281d] flex items-start gap-2.5">
                <CheckSquare className="w-4 h-4 text-[#c99a5e] shrink-0 mt-0.5" />
                <div className="text-xs font-serif leading-relaxed">
                  <strong className="text-[#f5efe6]">Eliminate Red Herrings:</strong> Verify that innocent or non-technical personnel (like VP of Sales James Whitfield) could not have executed this exfiltration.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#261f18] px-6 py-4 border-t border-[#3d3226] flex items-center justify-end flex-none">
          <button
            onClick={() => {
              soundFx.playClick()
              onClose()
            }}
            className="px-5 py-2 rounded bg-[#c99a5e] hover:bg-[#e0b57c] text-[#1c1813] font-mono text-xs font-bold transition"
          >
            Return to Investigation Board
          </button>
        </div>
      </div>
    </div>
  )
}
