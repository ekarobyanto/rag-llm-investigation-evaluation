"use client"

import { useEffect, useState } from "react"
import InvestigationDashboard from "@/components/InvestigationDashboard"
import CaseSelection from "@/components/CaseSelection"

interface Case {
  id: string
  title: string
  description: string
  suspects: any[]
  evidence: any[]
}

export default function Home() {
  const [cases, setCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [ragEnabled, setRagEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCases()
  }, [])

  const fetchCases = async () => {
    try {
      const res = await fetch("/api/cases")
      const data = await res.json()
      setCases(data)
      setLoading(false)
    } catch (error) {
      console.error("Failed to fetch cases:", error)
      setLoading(false)
    }
  }

  const handleCaseSelect = async (caseData: Case, rag: boolean) => {
    setSelectedCase(caseData)
    setRagEnabled(rag)

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: caseData.id,
          ragEnabled: rag,
        }),
      })
      const session = await res.json()
      setSessionId(session.id)
    } catch (error) {
      console.error("Failed to create session:", error)
    }
  }

  const handleBackToSelection = () => {
    setSelectedCase(null)
    setSessionId(null)
  }

  if (loading) {
    return <div className="p-8 text-center">Loading cases...</div>
  }

  return (
    <main>
      {!selectedCase ? (
        <CaseSelection cases={cases} onSelectCase={handleCaseSelect} />
      ) : sessionId ? (
        <InvestigationDashboard
          caseData={selectedCase}
          sessionId={sessionId}
          ragEnabled={ragEnabled}
          onBack={handleBackToSelection}
        />
      ) : (
        <div className="p-8 text-center">Creating session...</div>
      )}
    </main>
  )
}
