// Helper utility to parse forensic metadata from evidence content

export interface ParsedForensicInfo {
  exhibitId: string
  timeString: string | null
  minutes: number | null
  isBreachWindow: boolean
  sourceType: string
  sourceDepartment: string
  mentionedSuspects: string[]
  significanceTier: "CRITICAL LEAD" | "CORROBORATING RECORD" | "CIRCUMSTANTIAL"
}

export function parseForensicMetadata(
  evidenceId: string,
  type: string,
  content: string,
  difficultyWeight?: number,
  allSuspectNames: string[] = []
): ParsedForensicInfo {
  // 1. Exhibit ID
  const exhibitId = `EXHIBIT #EV-${evidenceId.slice(-4).toUpperCase()}`

  // 2. Parse time
  let timeString: string | null = null
  let minutes: number | null = null
  let isBreachWindow = false

  // Match times like 02:00, 14:30, 2:15 AM/PM
  const ampmMatch = content.match(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i)
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10)
    const m = parseInt(ampmMatch[2], 10)
    const meridian = ampmMatch[3].toUpperCase()
    if (meridian === "PM" && h !== 12) h += 12
    if (meridian === "AM" && h === 12) h = 0
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      minutes = h * 60 + m
      timeString = `${ampmMatch[1]}:${ampmMatch[2]} ${meridian}`
    }
  } else {
    const h24Match = content.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/)
    if (h24Match) {
      const h = parseInt(h24Match[1], 10)
      const m = parseInt(h24Match[2], 10)
      minutes = h * 60 + m
      const pad = (n: number) => n.toString().padStart(2, "0")
      timeString = `${pad(h)}:${pad(m)} HRS`
    }
  }

  // Critical breach window is between 02:00 (120 min) and 05:00 (300 min) on Jan 15
  if (minutes !== null && minutes >= 105 && minutes <= 335) {
    // 01:45 to 05:35
    isBreachWindow = true
  }

  // 3. Source Type & Department
  let sourceType = "Official Record"
  let sourceDepartment = "Evidence Custody"

  if (type === "forensic_report" || content.toLowerCase().includes("audit") || content.toLowerCase().includes("telemetry")) {
    sourceType = "Digital Forensics & Hardware Analysis"
    sourceDepartment = "Cyber Defense Forensics Unit"
  } else if (type === "witness_statement" || content.toLowerCase().includes("stated:")) {
    sourceType = "Sworn Deposition / Interview"
    sourceDepartment = "Detective Bureau Interrogation"
  } else if (type === "location_report" || type === "cctv_log" || content.toLowerCase().includes("camera")) {
    sourceType = "Physical Surveillance & Geolocation"
    sourceDepartment = "Facility Physical Security"
  } else if (type === "financial_record" || content.toLowerCase().includes("charge") || content.toLowerCase().includes("direct deposit")) {
    sourceType = "Financial Ledger & Subpoenaed Bank Audit"
    sourceDepartment = "Financial Crimes Division"
  } else if (type === "email_message" || content.toLowerCase().includes("email")) {
    sourceType = "Corporate Email & Communication Logs"
    sourceDepartment = "Internal Affairs IT Compliance"
  }

  // 4. Mentioned suspects
  const mentionedSuspects: string[] = []
  for (const name of allSuspectNames) {
    const clean = name.replace(/\s*\((?:culprit|red herring|clearly innocent|suspicious red herring|motive but no skills)\)/gi, "").trim()
    const parts = clean.split(" ").filter(Boolean)
    if (content.toLowerCase().includes(clean.toLowerCase())) {
      mentionedSuspects.push(clean)
    } else if (parts.some((p) => p.length > 3 && content.toLowerCase().includes(p.toLowerCase()))) {
      mentionedSuspects.push(clean)
    }
  }

  // 5. Significance Tier
  const weight = difficultyWeight ?? 0.7
  let significanceTier: "CRITICAL LEAD" | "CORROBORATING RECORD" | "CIRCUMSTANTIAL" = "CORROBORATING RECORD"
  if (weight >= 0.85 || isBreachWindow) {
    significanceTier = "CRITICAL LEAD"
  } else if (weight < 0.5) {
    significanceTier = "CIRCUMSTANTIAL"
  }

  return {
    exhibitId,
    timeString,
    minutes,
    isBreachWindow,
    sourceType,
    sourceDepartment,
    mentionedSuspects: Array.from(new Set(mentionedSuspects)),
    significanceTier,
  }
}
