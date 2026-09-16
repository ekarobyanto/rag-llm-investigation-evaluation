"use client"

import { useEffect, useState, useMemo, useRef, Fragment, useContext, createContext, useCallback } from "react"
import {
  Activity,
  Play,
  Square,
  RotateCw,
  Trash2,
  Cpu,
  Database,
  Sparkles,
  Clock,
  Coins,
  Target,
  Search,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Layers,
  BarChart3,
  Server,
  SlidersHorizontal,
  PieChart,
  TrendingUp,
  Percent,
  Copy,
  Check,
  Download,
  Zap,
  Info,
  ShieldCheck,
  Scale,
  BrainCircuit,
  Loader2,
  X,
  FlaskConical,
  LogOut,
} from "lucide-react"
import MarkdownResponse from "@/components/MarkdownResponse"
import type { RetrievalMethod } from "@/lib/retrieval"

interface FiveWOneH {
  what: string
  why: string
  who: string
  when: string
  where: string
  how: string
}

interface BenchmarkSummary {
  verdict: string
  verdictMethod: "sparse" | "dense" | "hybrid"
  headline: string
  fiveWOneH?: FiveWOneH
  keyFindings: string[]
  tradeoffs: {
    bestAccuracy: string
    lowestLatency: string
    costEffective: string
  }
  recommendations: string[]
  analyzedRunCount: number
  generatedAt: string
}

interface Scenario {
  id: string
  prompt: string
  difficulty: string
  case: { title: string }
}

interface AggregateRow {
  retrievalMethod: string
  count: number
  avgCorrectness: number
  avgPrecision: number
  avgRecall: number
  topKAccuracyRate: number
  avgResponseTimeMs: number
  avgTokens: number
  totalCost: number
}

interface RecentLog {
  id: string
  sessionId?: string
  scenarioId?: string | null
  retrievalMethod: string
  userPrompt: string
  aiResponse?: string
  retrievedContext?: string | null
  retrievedContextsList?: any
  structuredRecommendation?: {
    action_type: string
    target: string
    reason: string
  } | null
  correctnessScore: number | null
  retrievalPrecision: number | null
  retrievalRecall: number | null
  topKAccuracy: boolean | null
  embeddingTimeMs?: number | null
  retrievalTimeMs?: number | null
  llmResponseTimeMs?: number | null
  totalResponseTimeMs: number
  promptTokens?: number
  completionTokens?: number
  totalTokens: number
  estimatedCost: number | null
  createdAt: string
  scenario: {
    prompt?: string
    difficulty: string
    referenceAnswer?: string | null
    notes?: string | null
    case: { title: string }
  } | null
  ragasEvaluation?: {
    id?: string
    faithfulness?: number | null
    answerRelevance?: number | null
    contextPrecision?: number | null
    contextRecall?: number | null
    faithfulnessReasoning?: string | null
    answerRelevanceReasoning?: string | null
    contextPrecisionReasoning?: string | null
    contextRecallReasoning?: string | null
    critique?: string | null
    evaluatedAt?: string
  } | null
}

interface RagasAggregateRow {
  retrievalMethod: string
  count: number
  avgFaithfulness: number
  avgAnswerRelevance: number
  avgContextPrecision: number
  avgContextRecall: number
  compositeScore: number
}

interface RagasDifficultyRow {
  retrievalMethod: string
  difficulty: string
  count: number
  avgFaithfulness: number
  avgAnswerRelevance: number
  avgContextPrecision: number
  avgContextRecall: number
  compositeScore: number
}

const METHOD_THEMES: Record<
  string,
  { label: string; text: string; bg: string; border: string; bar: string; badge: string }
> = {
  sparse: {
    label: "Sparse (BM25)",
    text: "text-[#ff9900]",
    bg: "bg-[#ff9900]/10",
    border: "border-[#ff9900]/30",
    bar: "bg-[#ff9900]",
    badge: "bg-[#332200] text-[#ff9900] border border-[#ff9900]/40",
  },
  dense: {
    label: "Dense (HNSW)",
    text: "text-[#5794f2]",
    bg: "bg-[#5794f2]/10",
    border: "border-[#5794f2]/30",
    bar: "bg-[#5794f2]",
    badge: "bg-[#112240] text-[#5794f2] border border-[#5794f2]/40",
  },
  hybrid: {
    label: "Hybrid (RRF)",
    text: "text-[#b877d9]",
    bg: "bg-[#b877d9]/10",
    border: "border-[#b877d9]/30",
    bar: "bg-[#b877d9]",
    badge: "bg-[#271536] text-[#b877d9] border border-[#b877d9]/40",
  },
}

interface TooltipDetail {
  title: string
  badge: string
  badgeColor: string
  description: string
  formula?: string
  takeaway?: string
}

interface TooltipContextType {
  showTooltip: (data: TooltipDetail | string, target: HTMLElement) => void
  hideTooltip: () => void
}

const TooltipContext = createContext<TooltipContextType>({
  showTooltip: () => {},
  hideTooltip: () => {},
})

const METRIC_TOOLTIPS: Record<string, TooltipDetail> = {
  // Engine & Setup
  engineMethod: {
    title: "Retrieval Engine Architecture",
    badge: "Search Engine",
    badgeColor: "bg-[#271536] text-[#b877d9] border-[#b877d9]/40",
    description:
      "The underlying search architecture used to query the evidence database:\n• Sparse: BM25 lexical keyword matching via PostgreSQL tsvector\n• Dense: 1536-dim semantic embeddings via pgvector cosine distance\n• Hybrid: Reciprocal Rank Fusion (RRF) blending Sparse + Dense rankings",
    formula: "Sparse (BM25) | Dense (Cosine) | Hybrid (RRF)",
    takeaway: "Reveals how different retrieval mechanics balance keyword precision vs semantic recall.",
  },
  engine: {
    title: "Active Retrieval Engine",
    badge: "Execution Mode",
    badgeColor: "bg-[#182338] text-[#5794f2] border-[#5794f2]/40",
    description:
      "The retrieval engine tested for this execution: 'sparse' (BM25 keyword search), 'dense' (pgvector semantic embeddings), or 'hybrid' (RRF fusion).",
    formula: "sparse | dense | hybrid",
    takeaway: "Compare performance between exact lexical hits and deep contextual synthesis.",
  },
  samples: {
    title: "Benchmark Samples (N)",
    badge: "Sample Size",
    badgeColor: "bg-[#202328] text-[#c7d0d9] border-[#383e4a]",
    description:
      "Total number of scenario benchmark runs executed and recorded in the telemetry database for this retrieval engine.",
    takeaway: "Higher sample counts yield statistically sound aggregate benchmark averages.",
  },
  evaluated: {
    title: "Evaluated Scenarios (N)",
    badge: "Judge Volume",
    badgeColor: "bg-[#271536] text-[#b877d9] border-[#b877d9]/40",
    description:
      "Total count of scenario executions scored by the LLM-as-a-Judge pipeline across all 4 RAGAS evaluation dimensions.",
    takeaway: "Ensures comprehensive qualitative scoring across all test runs.",
  },
  targetCase: {
    title: "Investigative Case Scenario",
    badge: "Ground Truth",
    badgeColor: "bg-[#182338] text-[#5794f2] border-[#5794f2]/40",
    description:
      "The specific investigative criminal case scenario being benchmarked, seeded from ground-truth criminal case definitions.",
    takeaway: "Evaluates RAG performance across diverse crime narratives and evidence distributions.",
  },
  difficulty: {
    title: "Scenario Difficulty Tier",
    badge: "Complexity",
    badgeColor: "bg-[#332211] text-[#ff9900] border-[#ff9900]/40",
    description:
      "Investigative reasoning complexity level:\n• Easy: Direct single-hop clue lookup\n• Medium: Multi-document clue correlation\n• Hard: Resolving deceptive alibis & contradictory telemetry",
    takeaway: "Hard scenarios stress-test multi-hop reasoning and hallucination resistance.",
  },
  promptInquiry: {
    title: "Investigative Prompt Inquiry",
    badge: "Input Query",
    badgeColor: "bg-[#202328] text-[#c7d0d9] border-[#383e4a]",
    description:
      "The simulated investigative question dispatched to the AI consultant to test evidence retrieval and deductive reasoning against case files.",
    takeaway: "Assesses how effectively the retrieval engine surfaces relevant evidence for investigator questions.",
  },

  // Deterministic IR Metrics
  precision: {
    title: "Retrieval Precision",
    badge: "IR Metric",
    badgeColor: "bg-[#182338] text-[#5794f2] border-[#5794f2]/40",
    description:
      "Fraction of retrieved evidence chunks that are genuinely relevant to the scenario inquiry. Higher precision means cleaner context with minimal noise.",
    formula: "|Retrieved ∩ Relevant| / |Retrieved|",
    takeaway: "1.00 = 100% of retrieved chunks are relevant; zero distractor clutter.",
  },
  recall: {
    title: "Retrieval Recall",
    badge: "IR Metric",
    badgeColor: "bg-[#132c1e] text-[#73bf69] border-[#73bf69]/40",
    description:
      "Fraction of all ground-truth required clues successfully surfaced by the retrieval engine. Higher recall ensures no smoking guns are missed.",
    formula: "|Retrieved ∩ Relevant| / |Required Ground Truth Clues|",
    takeaway: "1.00 = 100% of all required clues were successfully retrieved.",
  },
  topKAcc: {
    title: "Top-K Accuracy Rate (k=5)",
    badge: "Smoking Gun Hit",
    badgeColor: "bg-[#132c1e] text-[#73bf69] border-[#73bf69]/40",
    description:
      "Percentage of benchmark runs where the single most critical 'smoking gun' clue was successfully ranked within the top 5 retrieved chunks.",
    formula: "(Runs with critical clue in top-k) / Total Runs",
    takeaway: "100% = key breakthrough evidence was always immediately surfaced to the LLM.",
  },
  topK: {
    title: "Top-K Success (k=5)",
    badge: "Ranked Hit",
    badgeColor: "bg-[#132c1e] text-[#73bf69] border-[#73bf69]/40",
    description:
      "Indicates whether the primary ground-truth evidence chunk was successfully ranked within the top 5 retrieved search results.",
    formula: "Rank(Primary Clue) ≤ 5",
    takeaway: "Green Check = critical smoking gun was present in prompt context.",
  },
  correctness: {
    title: "Deduction Correctness",
    badge: "Answer Quality",
    badgeColor: "bg-[#332211] text-[#ff9900] border-[#ff9900]/40",
    description:
      "Heuristic score evaluating whether the AI deduction correctly identified suspects and key facts without contradicting established case evidence.",
    formula: "Scored 0.0 to 1.0 (0% - 100%)",
    takeaway: "High correctness indicates accurate logical reasoning from retrieved evidence.",
  },
  latency: {
    title: "End-to-End Latency",
    badge: "Performance",
    badgeColor: "bg-[#332211] text-[#ff9900] border-[#ff9900]/40",
    description:
      "Total round-trip execution time in milliseconds, including query embedding generation, PostgreSQL index search, prompt synthesis, and LLM answer generation.",
    formula: "t_total = t_embed + t_db_search + t_llm_inference",
    takeaway: "Lower is faster. Lexical BM25 typically has lowest latency.",
  },
  tokens: {
    title: "Total Token Volume",
    badge: "Token Usage",
    badgeColor: "bg-[#202328] text-[#c7d0d9] border-[#383e4a]",
    description:
      "Combined volume of prompt input tokens (retrieved context + instructions) and output completion tokens consumed by the OpenAI API call.",
    formula: "tokens = input_tokens + output_tokens",
    takeaway: "Directly governs API billing cost and LLM response speed.",
  },
  cost: {
    title: "Estimated Execution Cost",
    badge: "Expense ($ USD)",
    badgeColor: "bg-[#132c1e] text-[#73bf69] border-[#73bf69]/40",
    description:
      "Monetary expense based on OpenAI token pricing ($0.15/1M input, $0.60/1M output tokens for gpt-4o-mini + text-embedding-3-small fees).",
    formula: "(input_tok × $0.15/1M) + (output_tok × $0.60/1M) + embed_cost",
    takeaway: "Critical for production capacity planning and cost-per-query optimization.",
  },
  timestamp: {
    title: "Execution Timestamp",
    badge: "Telemetry Log",
    badgeColor: "bg-[#202328] text-[#c7d0d9] border-[#383e4a]",
    description:
      "Exact date and time when this benchmark execution was completed and logged into the PostgreSQL database.",
    takeaway: "Allows tracking performance drift and historical evaluation trends.",
  },

  // RAGAS LLM-as-a-Judge Metrics
  faithfulness: {
    title: "RAGAS Faithfulness",
    badge: "Hallucination Check",
    badgeColor: "bg-[#132c1e] text-[#73bf69] border-[#73bf69]/40",
    description:
      "Measures factual consistency of the AI answer against the retrieved evidence chunks. High faithfulness means zero ungrounded or fabricated claims.",
    formula: "|Context-Grounded Claims| / |Total Claims Made|",
    takeaway: "100% = every claim is strictly grounded in retrieved evidence; zero hallucination.",
  },
  answerRelevance: {
    title: "RAGAS Answer Relevance",
    badge: "Prompt Alignment",
    badgeColor: "bg-[#332211] text-[#ff9900] border-[#ff9900]/40",
    description:
      "Measures how directly responsive and pertinent the generated deduction is to the investigator's prompt inquiry. Penalizes evasive or verbose fluff.",
    formula: "Cosine Similarity between inquiry and generated deduction vectors",
    takeaway: "Higher = concise deduction directly addressing the investigator's query.",
  },
  contextPrecision: {
    title: "RAGAS Context Precision",
    badge: "Ranking Quality",
    badgeColor: "bg-[#182338] text-[#5794f2] border-[#5794f2]/40",
    description:
      "Signal-to-noise ranking quality. Measures whether the most relevant evidence chunks were ranked at the very top of the retrieved context list.",
    formula: "Mean Average Precision (MAP) of relevant chunks in retrieved context",
    takeaway: "Higher score prevents critical facts being lost in the middle of long prompts.",
  },
  contextRecall: {
    title: "RAGAS Context Recall",
    badge: "Ground Truth Coverage",
    badgeColor: "bg-[#271536] text-[#b877d9] border-[#b877d9]/40",
    description:
      "Measures whether the retrieved evidence chunks contain all necessary facts required by the scenario's ground truth.",
    formula: "|Ground Truth Statements in Context| / |Total Ground Truth Statements|",
    takeaway: "100% = retrieved context contains every single required fact.",
  },
  composite: {
    title: "RAGAS Composite Score",
    badge: "Unified Index",
    badgeColor: "bg-[#202328] text-white border-[#5794f2]",
    description:
      "Balanced harmonic mean across all four RAGAS dimensions: Faithfulness, Answer Relevance, Context Precision, and Context Recall.",
    formula: "Harmonic Mean(Faithfulness, Relevance, Precision, Recall)",
    takeaway: "Primary single-metric benchmark score representing end-to-end RAG quality.",
  },
}

function ThTip({
  label,
  tip,
  align = "left",
  className = "px-4 py-2.5",
}: {
  label: string
  tip: TooltipDetail | string
  align?: "left" | "right"
  className?: string
}) {
  const { showTooltip, hideTooltip } = useContext(TooltipContext)

  return (
    <th className={`${className} ${align === "right" ? "text-right" : ""}`}>
      <div
        className={`inline-flex items-center gap-1.5 group cursor-help select-none ${
          align === "right" ? "justify-end w-full" : ""
        }`}
        onMouseEnter={(e) => showTooltip(tip, e.currentTarget)}
        onMouseLeave={hideTooltip}
      >
        <span className="group-hover:text-white transition-colors underline decoration-dotted decoration-[#424652] group-hover:decoration-[#5794f2] underline-offset-4">
          {label}
        </span>
        <Info className="w-3 h-3 text-[#555a64] group-hover:text-[#5794f2] transition-colors shrink-0" />
      </div>
    </th>
  )
}

function CircularGauge({
  value,
  color,
  size = 84,
  strokeWidth = 7,
  label,
}: {
  value: number
  color: string
  size?: number
  strokeWidth?: number
  label?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1e2228"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
          <span className="text-xs font-bold text-white">{value.toFixed(1)}%</span>
        </div>
      </div>
      {label && (
        <span className="text-[10px] font-mono text-[#8e9297] mt-1.5 uppercase text-center font-semibold tracking-wider">
          {label}
        </span>
      )}
    </div>
  )
}

export default function EvalPage() {
  const [activeTab, setActiveTab] = useState<"system" | "ragas">("system")
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [aggregate, setAggregate] = useState<AggregateRow[]>([])
  const [recent, setRecent] = useState<RecentLog[]>([])
  const [ragasAggregate, setRagasAggregate] = useState<RagasAggregateRow[]>([])
  const [ragasDifficulty, setRagasDifficulty] = useState<RagasDifficultyRow[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [searchFilter, setSearchFilter] = useState("")
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [ragasSearchFilter, setRagasSearchFilter] = useState("")
  const [ragasMethodFilter, setRagasMethodFilter] = useState<string>("all")
  const [ragasDifficultyFilter, setRagasDifficultyFilter] = useState<string>("all")
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null)
  const [expandedRagasLogId, setExpandedRagasLogId] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastPollTime, setLastPollTime] = useState<string>("")
  const [copiedRagasCsv, setCopiedRagasCsv] = useState(false)
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [copySelectionMode, setCopySelectionMode] = useState<"all" | "custom">("all")
  const [copyCustomNumber, setCopyCustomNumber] = useState<number>(10)
  const [copiedFeedbackCount, setCopiedFeedbackCount] = useState<number | null>(null)

  const [isTelemetryCopyModalOpen, setIsTelemetryCopyModalOpen] = useState(false)
  const [telemetryCopySelectionMode, setTelemetryCopySelectionMode] = useState<"all" | "custom">("all")
  const [telemetryCopyCustomNumber, setTelemetryCopyCustomNumber] = useState<number>(10)
  const [telemetryCopiedFeedbackCount, setTelemetryCopiedFeedbackCount] = useState<number | null>(null)
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null)

  // Small Batch Test State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [batchPreset, setBatchPreset] = useState<"3" | "5" | "10" | "custom" | "selected">("3")
  const [batchCustomCount, setBatchCustomCount] = useState<number>(3)
  const [batchDifficulty, setBatchDifficulty] = useState<string>("all")
  const [batchBalanced, setBatchBalanced] = useState<boolean>(true)
  const [batchMethods, setBatchMethods] = useState<string[]>(["sparse", "dense", "hybrid"])
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<string[]>([])
  const [activeTargetRuns, setActiveTargetRuns] = useState<number | null>(null)
  const [activeEvalStatus, setActiveEvalStatus] = useState<{
    isRunning: boolean
    label?: string
    totalRuns?: number
    completedRuns?: number
  } | null>(null)

  // WebSocket and Log Stream Pagination State
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("connecting")
  const [logPage, setLogPage] = useState<number>(1)
  const [logPageSize, setLogPageSize] = useState<number | "all">(15)
  const [newLogsCount, setNewLogsCount] = useState<number>(0)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const [summary, setSummary] = useState<BenchmarkSummary | null>(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false)

  const [activeTooltip, setActiveTooltip] = useState<{
    data: TooltipDetail
    x: number
    y: number
    placeAbove: boolean
  } | null>(null)

  const showTooltip = (tip: TooltipDetail | string, target: HTMLElement) => {
    const data: TooltipDetail =
      typeof tip === "string"
        ? {
            title: "Metric Information",
            badge: "Info",
            badgeColor: "bg-[#202328] text-[#c7d0d9] border-[#383e4a]",
            description: tip,
          }
        : tip

    const rect = target.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const placeAbove = spaceBelow < 220 && rect.top > 220
    const tooltipWidth = 320
    const targetCenterX = rect.left + rect.width / 2
    const x = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, targetCenterX - tooltipWidth / 2))
    const y = placeAbove ? rect.top - 8 : rect.bottom + 8

    setActiveTooltip({ data, x, y, placeAbove })
  }

  const hideTooltip = () => {
    setActiveTooltip(null)
  }

  useEffect(() => {
    const handleDismiss = () => setActiveTooltip(null)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveTooltip(null)
        setIsCopyModalOpen(false)
        setIsTelemetryCopyModalOpen(false)
        setIsBatchModalOpen(false)
      }
    }
    window.addEventListener("scroll", handleDismiss, true)
    window.addEventListener("resize", handleDismiss)
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("scroll", handleDismiss, true)
      window.removeEventListener("resize", handleDismiss)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  const [auditingLogIds, setAuditingLogIds] = useState<Record<string, boolean>>({})
  const [isBatchAuditing, setIsBatchAuditing] = useState(false)

  const auditScenarioLog = async (logId: string) => {
    setAuditingLogIds((prev) => ({ ...prev, [logId]: true }))
    try {
      const res = await fetch("/api/eval/ragas/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, force: true }),
      })
      const data = await res.json()
      if (data.success && data.evaluations?.length > 0) {
        const updatedEval = data.evaluations[0]
        setRecent((prev) =>
          prev.map((item) =>
            item.id === logId ? { ...item, ragasEvaluation: updatedEval as any } : item
          )
        )
        setMessage("Forensic AI Judge audit successfully generated and recorded.")
        setTimeout(() => setMessage(null), 3500)
      }
    } catch (err: any) {
      console.error("Failed to audit scenario log:", err)
      setMessage("Failed to run AI judge audit: " + (err.message || String(err)))
    } finally {
      setAuditingLogIds((prev) => ({ ...prev, [logId]: false }))
    }
  }

  const auditBatchLogs = async (logIds: string[]) => {
    if (logIds.length === 0) return
    setIsBatchAuditing(true)
    try {
      const res = await fetch("/api/eval/ragas/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logIds, force: false }),
      })
      const data = await res.json()
      if (data.success && data.evaluations?.length > 0) {
        const evalsMap = new Map<string, any>(data.evaluations.map((ev: any) => [ev.logId, ev]))
        setRecent((prev) =>
          prev.map((item) =>
            evalsMap.has(item.id)
              ? { ...item, ragasEvaluation: evalsMap.get(item.id) as any }
              : item
          )
        )
        setMessage(`Successfully audited ${data.evaluations.length} evaluation scenarios.`)
        setTimeout(() => setMessage(null), 3500)
      }
    } catch (err: any) {
      console.error("Failed to batch audit logs:", err)
      setMessage("Failed to run batch audit: " + (err.message || String(err)))
    } finally {
      setIsBatchAuditing(false)
    }
  }

  const [isRunningRagas, setIsRunningRagas] = useState(false)

  const runRagasPipeline = async () => {
    setIsRunningRagas(true)
    setMessage("Running RAGAS evaluation pipeline with judge reasoning...")
    try {
      const res = await fetch("/api/eval/ragas/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage("RAGAS evaluation pipeline completed successfully.")
        await loadAll()
      } else {
        setMessage(`RAGAS Error: ${data.error || "Execution failed"}`)
      }
    } catch (err: any) {
      setMessage(`RAGAS Error: ${err.message || String(err)}`)
    } finally {
      setIsRunningRagas(false)
      setTimeout(() => setMessage(null), 5000)
    }
  }

  const loadSummary = async (forceGenerate = false) => {
    setIsSummaryLoading(true)
    try {
      const res = await fetch("/api/eval/summary", {
        method: forceGenerate ? "POST" : "GET",
      })
      const data = await res.json()
      if (data.available && data.summary) {
        setSummary(data.summary)
      } else if (forceGenerate && !data.available) {
        setMessage(data.message ?? "No benchmark runs available to summarize.")
      }
    } catch (err: any) {
      console.error("Failed to load AI summary:", err)
    } finally {
      setIsSummaryLoading(false)
    }
  }

  const loadAll = async () => {
    try {
      const [scRes, resRes] = await Promise.all([
        fetch("/api/eval/scenarios").then((r) => r.json()),
        fetch("/api/eval/results").then((r) => r.json()),
      ])
      setScenarios(Array.isArray(scRes) ? scRes : [])
      setAggregate(Array.isArray(resRes?.aggregate) ? resRes.aggregate : [])
      setRecent(Array.isArray(resRes?.recent) ? resRes.recent : [])
      if (resRes?.ragas) {
        setRagasAggregate(resRes.ragas.overall ?? [])
        setRagasDifficulty(resRes.ragas.byDifficulty ?? [])
      }
      if (resRes?.status) {
        setActiveEvalStatus(resRes.status)
        if (resRes.status.totalRuns && resRes.status.totalRuns > 0) {
          setActiveTargetRuns(resRes.status.totalRuns)
        }
      }
      if (resRes?.status?.isRunning) {
        setBusy(resRes.status.label || "Running benchmark pipeline...")
        if (resRes.status.type === "ragas") {
          setIsRunningRagas(true)
        }
      } else if (!abortControllerRef.current) {
        setBusy((prev) => (prev?.startsWith("Running") ? null : prev))
        setIsRunningRagas(false)
      }
      setLastPollTime(new Date().toLocaleTimeString())
    } catch (err) {
      console.error("Failed to load eval data:", err)
      setScenarios([])
      setAggregate([])
      setRecent([])
    }
  }

  useEffect(() => {
    loadAll()
    loadSummary(false)
  }, [])

  // Continuous live background polling every 2.5s for real-time benchmark logs & active pipeline state
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      fetch("/api/eval/results")
        .then((r) => r.json())
        .then((resRes) => {
          if (Array.isArray(resRes?.aggregate)) setAggregate(resRes.aggregate)
          if (Array.isArray(resRes?.recent)) setRecent(resRes.recent)
          if (resRes?.ragas) {
            setRagasAggregate(resRes.ragas.overall ?? [])
            setRagasDifficulty(resRes.ragas.byDifficulty ?? [])
          }
          if (resRes?.status) {
            setActiveEvalStatus(resRes.status)
            if (resRes.status.totalRuns && resRes.status.totalRuns > 0) {
              setActiveTargetRuns(resRes.status.totalRuns)
            }
          }
          if (resRes?.status?.isRunning) {
            setBusy(resRes.status.label || "Running benchmark pipeline...")
            if (resRes.status.type === "ragas") {
              setIsRunningRagas(true)
            }
          } else if (!abortControllerRef.current) {
            setBusy((prev) => (prev?.startsWith("Running") ? null : prev))
            setIsRunningRagas(false)
          }
          setLastPollTime(new Date().toLocaleTimeString())
        })
        .catch((err) => console.debug("Live poll error:", err))
    }, 2500)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const seedScenarios = async () => {
    setBusy("Seeding scenario benchmark dataset from JSON...")
    try {
      const res = await fetch("/api/eval/scenarios", { method: "POST" })
      const data = await res.json()
      setMessage(`Seeded ${data.created}/${data.total} scenarios. Skipped: ${data.skipped}.`)
      await loadAll()
    } finally {
      setBusy(null)
    }
  }

  const abortControllerRef = useRef<AbortController | null>(null)

  const stopBenchmark = async () => {
    setBusy("Stopping benchmark pipeline...")
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      const res = await fetch("/api/eval/stop", { method: "POST" })
      const data = await res.json()
      setMessage(data.message ?? "Benchmark stopped.")
    } catch (err) {
      console.error("Failed to cancel benchmark:", err)
    } finally {
      setBusy(null)
      await loadAll()
    }
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      window.location.href = "/login"
    } catch {
      window.location.href = "/login"
    }
  }

  const runMethods = async (methods: string[]) => {
    const label = methods.length === 3 ? "All 3 Engines (Sparse, Dense, Hybrid)" : methods.join(", ")
    const targetCount = (scenarios.length || 30) * methods.length
    setActiveTargetRuns(targetCount)
    setBusy(`Running benchmark pipeline (${label})...`)
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ methods }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (data.cancelled) {
        setMessage("Benchmark execution stopped early by user.")
      } else if (data.error) {
        setMessage(`Benchmark Error: ${data.error}`)
      } else {
        setMessage(
          `Completed ${data.results?.length ?? 0} evaluation runs in ${(
            data.totalDurationMs / 1000
          ).toFixed(1)}s. Total Cost: $${data.totalCost?.toFixed(4)}`
        )
      }
      await loadAll()
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setMessage("Benchmark cancelled by user.")
      } else {
        setMessage(`Benchmark Error: ${err?.message}`)
      }
    } finally {
      abortControllerRef.current = null
      setBusy(null)
    }
  }

  const runOne = async (scenarioId: string) => {
    setActiveTargetRuns(3)
    setBusy("Executing single scenario across all 3 methods...")
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, methods: ["sparse", "dense", "hybrid"] }),
        signal: controller.signal,
      })
      setMessage("Scenario benchmark run complete.")
      await loadAll()
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setMessage("Benchmark cancelled by user.")
      } else {
        setMessage(`Error: ${err?.message}`)
      }
    } finally {
      abortControllerRef.current = null
      setBusy(null)
    }
  }

  const toggleScenarioSelection = (scenarioId: string) => {
    setSelectedScenarioIds((prev) =>
      prev.includes(scenarioId) ? prev.filter((id) => id !== scenarioId) : [...prev, scenarioId]
    )
  }

  const toggleSelectAllScenarios = () => {
    if (selectedScenarioIds.length === scenarios.length) {
      setSelectedScenarioIds([])
    } else {
      setSelectedScenarioIds(scenarios.map((s) => s.id))
    }
  }

  const runBatch = async (opts?: {
    limit?: number
    scenarioIds?: string[]
    difficulty?: string
    balanced?: boolean
    methods?: string[]
  }) => {
    const targetMethods = (opts?.methods ?? batchMethods) as RetrievalMethod[]
    if (targetMethods.length === 0) {
      setMessage("Please select at least one retrieval engine.")
      return
    }

    const isSelectedMode =
      (opts?.scenarioIds && opts.scenarioIds.length > 0) ||
      (batchPreset === "selected" && selectedScenarioIds.length > 0)
    const targetScenarioIds = isSelectedMode
      ? opts?.scenarioIds ?? selectedScenarioIds
      : undefined

    let targetLimit: number | undefined
    if (!isSelectedMode) {
      if (opts?.limit !== undefined) {
        targetLimit = opts.limit
      } else if (batchPreset === "3") {
        targetLimit = 3
      } else if (batchPreset === "5") {
        targetLimit = 5
      } else if (batchPreset === "10") {
        targetLimit = 10
      } else if (batchPreset === "custom") {
        targetLimit = Math.max(1, Math.min(scenarios.length, batchCustomCount))
      }
    }

    const targetDifficulty =
      opts?.difficulty ?? (batchDifficulty !== "all" ? batchDifficulty : undefined)
    const targetBalanced = opts?.balanced ?? batchBalanced

    setIsBatchModalOpen(false)

    const countLabel = targetScenarioIds?.length
      ? `${targetScenarioIds.length} Selected Scenarios`
      : `${targetLimit ?? 3} Scenarios`
    const methodLabel =
      targetMethods.length === 3
        ? "All 3 Engines (Sparse, Dense, Hybrid)"
        : targetMethods.join(", ")

    const count = targetScenarioIds?.length ?? targetLimit ?? 3
    const targetCount = count * targetMethods.length
    setActiveTargetRuns(targetCount)

    setBusy(`Running batch test (${countLabel}, ${methodLabel})...`)
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const res = await fetch("/api/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          methods: targetMethods,
          limit: targetLimit,
          scenarioIds: targetScenarioIds,
          difficulty: targetDifficulty,
          balanced: targetBalanced,
        }),
        signal: controller.signal,
      })
      const data = await res.json()
      if (data.cancelled) {
        setMessage("Batch benchmark stopped early by user.")
      } else if (data.error) {
        setMessage(`Batch Error: ${data.error}`)
      } else {
        setMessage(
          `Completed batch of ${data.results?.length ?? 0} evaluation runs in ${(
            data.totalDurationMs / 1000
          ).toFixed(1)}s. Total Cost: $${data.totalCost?.toFixed(4)}`
        )
      }
      await loadAll()
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setMessage("Batch benchmark stopped early by user.")
      } else {
        setMessage(`Batch Error: ${err?.message}`)
      }
    } finally {
      abortControllerRef.current = null
      setBusy(null)
    }
  }

  const clearResults = async () => {
    if (!confirm("Are you sure you want to flush all evaluation interaction telemetry logs?")) return
    setBusy("Flushing evaluation telemetry logs...")
    try {
      await fetch("/api/eval/results", { method: "DELETE" })
      setMessage("Telemetry database cleared.")
      setActiveTargetRuns(null)
      setSummary(null)
      await loadAll()
    } finally {
      setBusy(null)
    }
  }

  const fmt = (n: number, digits = 3) => (Number.isFinite(n) ? n.toFixed(digits) : "—")
  const pct = (n: number) => (Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : "—")

  const [copiedCsv, setCopiedCsv] = useState(false)

  const copyAsCsv = (limitCount?: number | "all" | React.MouseEvent) => {
    const baseList = filteredRecent.length > 0 ? filteredRecent : recent
    if (baseList.length === 0) return

    const effectiveCount =
      typeof limitCount === "number"
        ? Math.min(Math.max(1, limitCount), baseList.length)
        : baseList.length

    const listToExport = baseList.slice(0, effectiveCount)
    if (listToExport.length === 0) return

    const headers = [
      "ID",
      "Timestamp",
      "Retrieval Method",
      "Case Title",
      "Difficulty",
      "User Prompt",
      "Correctness",
      "Precision",
      "Recall",
      "Top-K Accuracy",
      "Retrieval Time (ms)",
      "LLM Time (ms)",
      "Total Time (ms)",
      "Prompt Tokens",
      "Completion Tokens",
      "Total Tokens",
      "Estimated Cost ($)",
      "Recommended Action",
      "Recommended Target",
      "Recommended Reason",
      "AI Response",
    ]

    const escapeCsv = (str: string | number | null | undefined) => {
      if (str === null || str === undefined) return '""'
      const s = String(str).replace(/"/g, '""')
      return `"${s}"`
    }

    const rows = listToExport.map((r) => [
      escapeCsv(r.id),
      escapeCsv(r.createdAt),
      escapeCsv(r.retrievalMethod),
      escapeCsv(r.scenario?.case?.title ?? "The Nexus Data Breach"),
      escapeCsv(r.scenario?.difficulty ?? ""),
      escapeCsv(r.userPrompt),
      escapeCsv(r.correctnessScore),
      escapeCsv(r.retrievalPrecision !== null ? r.retrievalPrecision?.toFixed(4) : ""),
      escapeCsv(r.retrievalRecall !== null ? r.retrievalRecall?.toFixed(4) : ""),
      escapeCsv(r.topKAccuracy === null ? "" : r.topKAccuracy ? "TRUE" : "FALSE"),
      escapeCsv(r.retrievalTimeMs ?? ""),
      escapeCsv(r.llmResponseTimeMs ?? ""),
      escapeCsv(r.totalResponseTimeMs),
      escapeCsv(r.promptTokens ?? ""),
      escapeCsv(r.completionTokens ?? ""),
      escapeCsv(r.totalTokens),
      escapeCsv(r.estimatedCost !== null ? r.estimatedCost?.toFixed(5) : ""),
      escapeCsv(r.structuredRecommendation?.action_type ?? ""),
      escapeCsv(r.structuredRecommendation?.target ?? ""),
      escapeCsv(r.structuredRecommendation?.reason ?? ""),
      escapeCsv(r.aiResponse ?? ""),
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n")

    navigator.clipboard
      .writeText(csvContent)
      .then(() => {
        setCopiedCsv(true)
        setTelemetryCopiedFeedbackCount(effectiveCount)
        setMessage(`Copied ${effectiveCount} of ${baseList.length} telemetry records to clipboard.`)
        setTimeout(() => {
          setCopiedCsv(false)
          setTelemetryCopiedFeedbackCount(null)
          setIsTelemetryCopyModalOpen(false)
        }, 1200)
      })
      .catch((err) => {
        console.error("Failed to copy telemetry CSV:", err)
      })
  }

  const copyLogAsMarkdown = (r: RecentLog) => {
    const correctnessStr =
      r.correctnessScore === null
        ? "N/A"
        : r.correctnessScore >= 0.7
        ? `PASS (${(r.correctnessScore * 100).toFixed(0)}%)`
        : `FAIL (${(r.correctnessScore * 100).toFixed(0)}%)`

    const precisionStr = r.retrievalPrecision !== null ? pct(r.retrievalPrecision) : "N/A"
    const recallStr = r.retrievalRecall !== null ? pct(r.retrievalRecall) : "N/A"
    const topKStr = r.topKAccuracy === null ? "N/A" : r.topKAccuracy ? "TRUE" : "FALSE"

    let md = `# Execution Telemetry Log: \`${r.id}\`\n\n`
    md += `| Attribute | Value |\n`
    md += `| :--- | :--- |\n`
    md += `| **Log ID** | \`${r.id}\` |\n`
    md += `| **Timestamp** | ${new Date(r.createdAt).toLocaleString()} (${r.createdAt}) |\n`
    md += `| **Retrieval Method** | \`${r.retrievalMethod.toUpperCase()}\` |\n`
    md += `| **Case** | ${r.scenario?.case?.title ?? "The Nexus Data Breach"}${r.scenario?.difficulty ? ` [${r.scenario.difficulty.toUpperCase()}]` : ""} |\n`
    md += `| **Correctness** | ${correctnessStr} |\n`
    md += `| **Precision** | ${precisionStr} |\n`
    md += `| **Recall** | ${recallStr} |\n`
    md += `| **Top-K Accuracy** | ${topKStr} |\n`
    md += `| **Total Latency** | ${r.totalResponseTimeMs}ms (Retrieval: ${r.retrievalTimeMs ?? 0}ms, LLM: ${r.llmResponseTimeMs ?? 0}ms) |\n`
    md += `| **Tokens** | ${r.totalTokens} (${r.promptTokens ?? 0} prompt / ${r.completionTokens ?? 0} completion) |\n`
    md += `| **Estimated Cost** | $${r.estimatedCost !== null ? r.estimatedCost.toFixed(5) : "0.00000"} |\n\n`

    md += `### 📝 User Prompt / Evaluation Inquiry\n\n\`\`\`\n${r.userPrompt}\n\`\`\`\n\n`

    if (r.scenario?.referenceAnswer) {
      md += `### 🎯 Ground Truth / Reference Answer\n\n${r.scenario.referenceAnswer}\n\n`
    }

    if (r.retrievedContext) {
      md += `### 📂 Retrieved Evidence Context\n\n\`\`\`\n${r.retrievedContext}\n\`\`\`\n\n`
    }

    if (r.aiResponse) {
      md += `### 🤖 AI Response\n\n${r.aiResponse}\n\n`
    }

    if (r.structuredRecommendation) {
      md += `### 💡 Structured Recommendation\n\n`
      md += `- **Action**: \`${r.structuredRecommendation.action_type}\`\n`
      md += `- **Target**: **${r.structuredRecommendation.target}**\n`
      md += `- **Reason**: ${r.structuredRecommendation.reason}\n\n`
    }

    if (r.ragasEvaluation) {
      const e = r.ragasEvaluation
      const f = e.faithfulness !== null && e.faithfulness !== undefined ? `${(e.faithfulness * 100).toFixed(1)}%` : "N/A"
      const a = e.answerRelevance !== null && e.answerRelevance !== undefined ? `${(e.answerRelevance * 100).toFixed(1)}%` : "N/A"
      const p = e.contextPrecision !== null && e.contextPrecision !== undefined ? `${(e.contextPrecision * 100).toFixed(1)}%` : "N/A"
      const rc = e.contextRecall !== null && e.contextRecall !== undefined ? `${(e.contextRecall * 100).toFixed(1)}%` : "N/A"

      md += `### ⚖️ RAGAS Evaluation Metrics\n\n`
      md += `- **Faithfulness**: ${f}\n`
      md += `- **Answer Relevance**: ${a}\n`
      md += `- **Context Precision**: ${p}\n`
      md += `- **Context Recall**: ${rc}\n\n`

      if (e.faithfulnessReasoning || e.answerRelevanceReasoning || e.contextPrecisionReasoning || e.contextRecallReasoning) {
        md += `#### Judge Reasoning Breakdown\n\n`
        if (e.faithfulnessReasoning) md += `- **Faithfulness**: ${e.faithfulnessReasoning}\n`
        if (e.answerRelevanceReasoning) md += `- **Answer Relevance**: ${e.answerRelevanceReasoning}\n`
        if (e.contextPrecisionReasoning) md += `- **Context Precision**: ${e.contextPrecisionReasoning}\n`
        if (e.contextRecallReasoning) md += `- **Context Recall**: ${e.contextRecallReasoning}\n`
        md += `\n`
      }

      if (e.critique) {
        md += `#### Judge Critique\n\n${e.critique}\n\n`
      }
    }

    navigator.clipboard
      .writeText(md)
      .then(() => {
        setCopiedLogId(r.id)
        setMessage(`Copied log ${r.id.slice(0, 8)}... as Markdown to clipboard.`)
        setTimeout(() => setCopiedLogId(null), 3000)
        setTimeout(() => setMessage(null), 3500)
      })
      .catch((err) => {
        console.error("Failed to copy markdown:", err)
        setMessage("Failed to copy markdown to clipboard.")
      })
  }

  // High-level KPI aggregates
  const globalStats = useMemo(() => {
    if (aggregate.length === 0) return null
    const totalRuns = aggregate.reduce((acc, a) => acc + a.count, 0)
    if (totalRuns === 0) return null

    const avgPrec = aggregate.reduce((acc, a) => acc + a.avgPrecision * a.count, 0) / totalRuns
    const avgRec = aggregate.reduce((acc, a) => acc + a.avgRecall * a.count, 0) / totalRuns
    const avgLat = aggregate.reduce((acc, a) => acc + a.avgResponseTimeMs * a.count, 0) / totalRuns
    const totalCost = aggregate.reduce((acc, a) => acc + a.totalCost, 0)
    const avgAcc = aggregate.reduce((acc, a) => acc + a.topKAccuracyRate * a.count, 0) / totalRuns

    return { totalRuns, avgPrec, avgRec, avgLat, totalCost, avgAcc }
  }, [aggregate])

  // Filtered recent logs
  const filteredRecent = useMemo(() => {
    return recent.filter((r) => {
      if (methodFilter !== "all" && r.retrievalMethod !== methodFilter) return false
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase()
        return (
          r.userPrompt.toLowerCase().includes(q) ||
          r.retrievalMethod.toLowerCase().includes(q) ||
          (r.scenario?.case.title.toLowerCase().includes(q) ?? false) ||
          (r.scenario?.difficulty.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  }, [recent, methodFilter, searchFilter])

  const metricsToCompare = [
    { key: "precision", label: "Average Precision", desc: "Relevance ratio" },
    { key: "recall", label: "Average Recall", desc: "Ground-truth coverage" },
    { key: "topK", label: "Top-K Accuracy", desc: "Hit in top results" },
    { key: "correctness", label: "Recommendation Pass", desc: "Optimal action match" },
  ] as const

  // Engine-level comparative percentage stats
  const engineStats = useMemo(() => {
    const getVal = (method: string) => {
      const row = aggregate.find((a) => a.retrievalMethod === method)
      if (!row || row.count === 0) {
        return {
          count: 0,
          precision: 0,
          recall: 0,
          topK: 0,
          correctness: 0,
          composite: 0,
        }
      }
      const precision = row.avgPrecision * 100
      const recall = row.avgRecall * 100
      const topK = row.topKAccuracyRate * 100
      const correctness = row.avgCorrectness * 100
      const composite = (precision + recall + topK + correctness) / 4
      return {
        count: row.count,
        precision,
        recall,
        topK,
        correctness,
        composite,
      }
    }

    return {
      sparse: getVal("sparse"),
      dense: getVal("dense"),
      hybrid: getVal("hybrid"),
    }
  }, [aggregate])

  // Difficulty-level comparative percentage stats
  const difficultyStats = useMemo(() => {
    const diffs = ["easy", "medium", "hard"] as const
    const methods = ["sparse", "dense", "hybrid"] as const

    const data: Record<string, Record<string, { count: number; prec: number; rec: number; acc: number }>> = {
      easy: {},
      medium: {},
      hard: {},
    }

    diffs.forEach((d) => {
      methods.forEach((m) => {
        const matches = recent.filter(
          (r) => r.retrievalMethod === m && r.scenario?.difficulty === d
        )
        const count = matches.length
        if (count === 0) {
          data[d][m] = { count: 0, prec: 0, rec: 0, acc: 0 }
        } else {
          const sum = (fn: (r: RecentLog) => number | null | undefined) =>
            matches.reduce((acc, r) => acc + (fn(r) ?? 0), 0)
          data[d][m] = {
            count,
            prec: (sum((r) => r.retrievalPrecision) / count) * 100,
            rec: (sum((r) => r.retrievalRecall) / count) * 100,
            acc: (sum((r) => r.correctnessScore) / count) * 100,
          }
        }
      })
    })

    return data
  }, [recent])

  // RAGAS: Filtered logs with RAGAS evaluations
  const ragasLogs = useMemo(() => {
    return recent.filter((r) => r.ragasEvaluation != null)
  }, [recent])

  const filteredRagasLogs = useMemo(() => {
    return ragasLogs.filter((r) => {
      if (ragasMethodFilter !== "all" && r.retrievalMethod !== ragasMethodFilter) return false
      if (ragasDifficultyFilter !== "all" && r.scenario?.difficulty !== ragasDifficultyFilter) return false
      if (ragasSearchFilter.trim()) {
        const q = ragasSearchFilter.toLowerCase()
        return (
          r.userPrompt.toLowerCase().includes(q) ||
          r.retrievalMethod.toLowerCase().includes(q) ||
          (r.scenario?.case.title.toLowerCase().includes(q) ?? false) ||
          (r.scenario?.difficulty.toLowerCase().includes(q) ?? false) ||
          (r.aiResponse?.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  }, [ragasLogs, ragasMethodFilter, ragasDifficultyFilter, ragasSearchFilter])

  // RAGAS: High-level KPI aggregates
  const ragasGlobalStats = useMemo(() => {
    if (ragasLogs.length === 0) return null
    const totalEvaluated = ragasLogs.length
    const sum = (fn: (r: RecentLog) => number | null | undefined) =>
      ragasLogs.reduce((acc, r) => acc + (fn(r) ?? 0), 0)

    const avgFaith = sum((r) => r.ragasEvaluation?.faithfulness) / totalEvaluated
    const avgAnsRel = sum((r) => r.ragasEvaluation?.answerRelevance) / totalEvaluated
    const avgCtxPrec = sum((r) => r.ragasEvaluation?.contextPrecision) / totalEvaluated
    const avgCtxRec = sum((r) => r.ragasEvaluation?.contextRecall) / totalEvaluated
    const composite = (avgFaith + avgAnsRel + avgCtxPrec + avgCtxRec) / 4

    return { totalEvaluated, avgFaith, avgAnsRel, avgCtxPrec, avgCtxRec, composite }
  }, [ragasLogs])

  // RAGAS: Engine-level comparative percentage stats
  const ragasEngineStats = useMemo(() => {
    const getVal = (method: string) => {
      const row = ragasAggregate.find((a) => a.retrievalMethod === method)
      if (row && row.count > 0) {
        return {
          count: row.count,
          faithfulness: (row.avgFaithfulness ?? 0) * 100,
          answerRelevance: (row.avgAnswerRelevance ?? 0) * 100,
          contextPrecision: (row.avgContextPrecision ?? 0) * 100,
          contextRecall: (row.avgContextRecall ?? 0) * 100,
          composite: (row.compositeScore ?? 0) * 100,
        }
      }
      const methodLogs = ragasLogs.filter((r) => r.retrievalMethod === method)
      if (methodLogs.length === 0) {
        return { count: 0, faithfulness: 0, answerRelevance: 0, contextPrecision: 0, contextRecall: 0, composite: 0 }
      }
      const sum = (fn: (r: RecentLog) => number | null | undefined) =>
        methodLogs.reduce((acc, r) => acc + (fn(r) ?? 0), 0)
      const f = (sum((r) => r.ragasEvaluation?.faithfulness) / methodLogs.length) * 100
      const a = (sum((r) => r.ragasEvaluation?.answerRelevance) / methodLogs.length) * 100
      const cp = (sum((r) => r.ragasEvaluation?.contextPrecision) / methodLogs.length) * 100
      const cr = (sum((r) => r.ragasEvaluation?.contextRecall) / methodLogs.length) * 100
      return {
        count: methodLogs.length,
        faithfulness: f,
        answerRelevance: a,
        contextPrecision: cp,
        contextRecall: cr,
        composite: (f + a + cp + cr) / 4,
      }
    }

    return {
      sparse: getVal("sparse"),
      dense: getVal("dense"),
      hybrid: getVal("hybrid"),
    }
  }, [ragasAggregate, ragasLogs])

  // RAGAS: Difficulty-level stats
  const ragasDifficultyStats = useMemo(() => {
    const diffs = ["easy", "medium", "hard"] as const
    const methods = ["sparse", "dense", "hybrid"] as const

    const data: Record<
      string,
      Record<string, { count: number; faith: number; rel: number; prec: number; rec: number; comp: number }>
    > = {
      easy: {},
      medium: {},
      hard: {},
    }

    diffs.forEach((d) => {
      methods.forEach((m) => {
        const matches = ragasLogs.filter(
          (r) => r.retrievalMethod === m && r.scenario?.difficulty === d
        )
        const count = matches.length
        if (count === 0) {
          data[d][m] = { count: 0, faith: 0, rel: 0, prec: 0, rec: 0, comp: 0 }
        } else {
          const sum = (fn: (r: RecentLog) => number | null | undefined) =>
            matches.reduce((acc, r) => acc + (fn(r) ?? 0), 0)
          const f = (sum((r) => r.ragasEvaluation?.faithfulness) / count) * 100
          const a = (sum((r) => r.ragasEvaluation?.answerRelevance) / count) * 100
          const cp = (sum((r) => r.ragasEvaluation?.contextPrecision) / count) * 100
          const cr = (sum((r) => r.ragasEvaluation?.contextRecall) / count) * 100
          data[d][m] = {
            count,
            faith: f,
            rel: a,
            prec: cp,
            rec: cr,
            comp: (f + a + cp + cr) / 4,
          }
        }
      })
    })

    return data
  }, [ragasLogs])

  const copyRagasAsCsv = (limitCount?: number | "all" | React.MouseEvent) => {
    const effectiveCount =
      typeof limitCount === "number"
        ? Math.min(Math.max(1, limitCount), filteredRagasLogs.length)
        : filteredRagasLogs.length

    const listToExport = filteredRagasLogs.slice(0, effectiveCount)
    if (listToExport.length === 0) return

    const headers = [
      "ID",
      "Timestamp",
      "Retrieval Method",
      "Case Title",
      "Difficulty",
      "User Prompt",
      "Faithfulness",
      "Answer Relevance",
      "Context Precision",
      "Context Recall",
      "Composite RAGAS Score",
      "Faithfulness Reasoning",
      "Answer Relevance Reasoning",
      "Context Precision Reasoning",
      "Context Recall Reasoning",
      "Judge Critique",
      "AI Response",
    ]

    const escapeCsv = (str: string | number | null | undefined) => {
      if (str === null || str === undefined) return '""'
      const s = String(str).replace(/"/g, '""')
      return `"${s}"`
    }

    const rows = listToExport.map((r) => {
      const e = r.ragasEvaluation
      const f = e?.faithfulness ?? 0
      const a = e?.answerRelevance ?? 0
      const cp = e?.contextPrecision ?? 0
      const cr = e?.contextRecall ?? 0
      const comp = (f + a + cp + cr) / 4

      return [
        escapeCsv(r.id),
        escapeCsv(e?.evaluatedAt ?? r.createdAt),
        escapeCsv(r.retrievalMethod),
        escapeCsv(r.scenario?.case?.title ?? "The Nexus Data Breach"),
        escapeCsv(r.scenario?.difficulty ?? ""),
        escapeCsv(r.userPrompt),
        escapeCsv(e?.faithfulness !== null && e?.faithfulness !== undefined ? e.faithfulness.toFixed(4) : ""),
        escapeCsv(e?.answerRelevance !== null && e?.answerRelevance !== undefined ? e.answerRelevance.toFixed(4) : ""),
        escapeCsv(e?.contextPrecision !== null && e?.contextPrecision !== undefined ? e.contextPrecision.toFixed(4) : ""),
        escapeCsv(e?.contextRecall !== null && e?.contextRecall !== undefined ? e.contextRecall.toFixed(4) : ""),
        escapeCsv(comp.toFixed(4)),
        escapeCsv(e?.faithfulnessReasoning ?? ""),
        escapeCsv(e?.answerRelevanceReasoning ?? ""),
        escapeCsv(e?.contextPrecisionReasoning ?? ""),
        escapeCsv(e?.contextRecallReasoning ?? ""),
        escapeCsv(e?.critique ?? ""),
        escapeCsv(r.aiResponse ?? ""),
      ]
    })

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")

    navigator.clipboard
      .writeText(csvContent)
      .then(() => {
        setCopiedRagasCsv(true)
        setCopiedFeedbackCount(effectiveCount)
        setMessage(`Copied ${effectiveCount} of ${filteredRagasLogs.length} RAGAS records to clipboard.`)
        setTimeout(() => {
          setCopiedRagasCsv(false)
          setCopiedFeedbackCount(null)
          setIsCopyModalOpen(false)
        }, 1200)
      })
      .catch((err) => console.error("Failed to copy RAGAS CSV:", err))
  }

  return (
    <TooltipContext.Provider value={{ showTooltip, hideTooltip }}>
      <div className="min-h-screen bg-[#0b0c0e] text-[#d8d9da] font-sans select-none pb-12">
      {/* Top Grafana Navigation & Telemetry Bar */}
      <header className="bg-[#141619] border-b border-[#22252b] px-6 py-3 shadow-md sticky top-0 z-30">
        <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1f2328] hover:bg-[#2b3036] text-[#c7d0d9] text-xs font-mono border border-[#333842] transition"
              title="Return to Investigation Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Investigation App</span>
            </a>

            <div className="h-5 w-px bg-[#262930]" />

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#1f2328] border border-[#ff9900]/40 flex items-center justify-center text-[#ff9900]">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono tracking-widest px-1.5 py-0.5 rounded bg-[#1f2328] text-[#ff9900] border border-[#ff9900]/30 font-bold">
                    RAG BENCHMARK DASHBOARD
                  </span>
                  <span className="text-xs text-[#8e9297] font-mono">
                    Node: <span className="text-[#d8d9da]">PostgreSQL (pgvector 1536)</span>
                  </span>
                </div>
                <h1 className="text-base font-bold text-white tracking-tight leading-tight font-mono">
                  Observability & Evaluation Console
                </h1>
              </div>
            </div>
          </div>

          {/* Status Telemetry */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 bg-[#181b1f] border border-[#262930] px-3 py-1.5 rounded">
              <div
                className={`w-2 h-2 rounded-full ${
                  busy ? "bg-[#ff9900] animate-ping" : "bg-[#73bf69]"
                }`}
              />
              <span className="text-[#8e9297] uppercase">System State:</span>
              <span className={`font-bold ${busy ? "text-[#ff9900]" : "text-[#73bf69]"}`}>
                {busy ? "RUNNING PIPELINE" : "STANDBY // HEALTHY"}
              </span>
            </div>

            {busy && (
              <button
                onClick={stopBenchmark}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#e02f44] hover:bg-[#ff445a] text-white text-xs font-mono font-bold transition shadow-md animate-pulse"
                title="Halt active benchmark immediately"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            )}

            <button
              onClick={loadAll}
              disabled={busy !== null}
              className="p-1.5 rounded bg-[#1f2328] border border-[#2b3036] text-[#c7d0d9] hover:text-white transition"
              title="Refresh telemetry"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#1f2328] hover:bg-[#2b3038] border border-[#2b3036] text-[#8e9297] hover:text-[#f87171] text-xs font-mono transition"
              title="Lock terminal and logout"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Dashboard Container */}
      <div className="max-w-[1920px] mx-auto px-6 pt-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#22252b] pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("system")}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-t-lg font-mono text-xs font-bold transition border-b-2 ${
                activeTab === "system"
                  ? "bg-[#181b1f] text-[#5794f2] border-[#5794f2] shadow-sm"
                  : "text-[#8e9297] hover:text-[#c7d0d9] hover:bg-[#141619] border-transparent"
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>DETERMINISTIC IR & TELEMETRY</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#1f2328] text-[#c7d0d9] border border-[#2b3036]">
                {recent.length} Runs
              </span>
            </button>

            <button
              onClick={() => setActiveTab("ragas")}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-t-lg font-mono text-xs font-bold transition border-b-2 ${
                activeTab === "ragas"
                  ? "bg-[#181b1f] text-[#b877d9] border-[#b877d9] shadow-sm"
                  : "text-[#8e9297] hover:text-[#c7d0d9] hover:bg-[#141619] border-transparent"
              }`}
            >
              <Sparkles className="w-4 h-4 text-[#b877d9]" />
              <span>RAGAS LLM EVALUATION</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] border ${
                  ragasLogs.length > 0
                    ? "bg-[#271536] text-[#b877d9] border-[#b877d9]/40 font-bold"
                    : "bg-[#1f2328] text-[#8e9297] border-[#2b3036]"
                }`}
              >
                {ragasLogs.length} Evaluated
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-[#8e9297]">
            <span>Active View:</span>
            <span className="px-2.5 py-1 rounded bg-[#181b1f] border border-[#262930] text-white">
              {activeTab === "system"
                ? "Deterministic Retrieval Metrics (Precision / Recall / Top-K / Latency / Cost)"
                : "LLM-as-a-Judge Evaluation (GPT-4o-mini // Ragas Triad)"}
            </span>
          </div>
        </div>

        {/* AI Executive Benchmark Summary Card */}
        <div className="bg-[#141619] border border-[#2e263d] rounded-xl overflow-hidden shadow-lg transition">
          {/* Summary Header Strip */}
          <div className="bg-gradient-to-r from-[#1c142e] via-[#141619] to-[#121927] border-b border-[#2b223c] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#27153d] border border-[#b877d9]/50 flex items-center justify-center text-[#d89cf6] shadow-inner">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-[#b877d9]">
                    AI Executive Benchmark Synthesis
                  </span>
                  {summary && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#14532d]/60 text-[#4ade80] border border-[#4ade80]/40">
                      {summary.verdict}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#8e9297] font-mono">
                  {summary
                    ? `Synthesized from ${summary.analyzedRunCount} benchmark executions • ${new Date(
                        summary.generatedAt
                      ).toLocaleTimeString()}`
                    : "Empirical comparative analysis of Sparse, Dense, and Hybrid retrieval engines"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-xs">
              <button
                onClick={() => loadSummary(true)}
                disabled={isSummaryLoading || (recent.length === 0 && (!summary || summary.analyzedRunCount === 0))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#27153d] hover:bg-[#3b1d5c] text-[#d89cf6] border border-[#b877d9]/40 font-semibold transition disabled:opacity-50"
                title="Synthesize latest benchmark metrics with LLM"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isSummaryLoading ? "animate-spin" : ""}`} />
                <span>
                  {isSummaryLoading
                    ? "Synthesizing..."
                    : summary
                    ? "Regenerate Analysis"
                    : "Generate AI Summary"}
                </span>
              </button>

              {summary && (
                <button
                  onClick={() => setIsSummaryCollapsed(!isSummaryCollapsed)}
                  className="p-1.5 rounded hover:bg-[#202328] text-[#8e9297] hover:text-white transition"
                  title={isSummaryCollapsed ? "Expand AI summary" : "Collapse AI summary"}
                >
                  {isSummaryCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Summary Body (when expanded and available) */}
          {summary && !isSummaryCollapsed && (
            <div className="p-5 space-y-4 text-xs font-mono">
              {/* Executive Core Conclusion Headline */}
              <div className="p-3.5 rounded-lg bg-[#191524] border border-[#b877d9]/25 text-[#e5d4f7] leading-relaxed text-sm">
                <span className="text-[#b877d9] font-bold uppercase tracking-wider mr-2">
                  Core Takeaway:
                </span>
                {summary.headline}
              </div>

              {/* 5W 1H Investigative Architecture Analysis */}
              {summary.fiveWOneH && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-[#b877d9] uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-[#b877d9]" />
                      <span>5W 1H Investigative Architecture Breakdown</span>
                    </div>
                    <span className="text-[10px] text-[#8e9297]">
                      What • Why • Who • When • Where • How
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {/* WHAT */}
                    <div className="p-4 rounded-xl bg-[#111217] border border-[#5794f2]/30 space-y-2 hover:border-[#5794f2]/60 transition shadow-sm">
                      <div className="flex items-center justify-between border-b border-[#22252b] pb-2">
                        <span className="px-2 py-0.5 rounded bg-[#5794f2]/20 border border-[#5794f2]/40 text-[#5794f2] text-[10px] font-mono font-bold tracking-wider">
                          WHAT
                        </span>
                        <span className="text-[10px] uppercase font-bold text-[#8e9297] tracking-wider">
                          Empirical Outcome & Winner
                        </span>
                      </div>
                      <p className="text-[#d8d9da] text-[11px] leading-relaxed pt-0.5">
                        {summary.fiveWOneH.what}
                      </p>
                    </div>

                    {/* WHY */}
                    <div className="p-4 rounded-xl bg-[#111217] border border-[#fade2a]/30 space-y-2 hover:border-[#fade2a]/60 transition shadow-sm">
                      <div className="flex items-center justify-between border-b border-[#22252b] pb-2">
                        <span className="px-2 py-0.5 rounded bg-[#fade2a]/20 border border-[#fade2a]/40 text-[#fade2a] text-[10px] font-mono font-bold tracking-wider">
                          WHY
                        </span>
                        <span className="text-[10px] uppercase font-bold text-[#8e9297] tracking-wider">
                          Causal Superiority Analysis
                        </span>
                      </div>
                      <p className="text-[#d8d9da] text-[11px] leading-relaxed pt-0.5">
                        {summary.fiveWOneH.why}
                      </p>
                    </div>

                    {/* WHO */}
                    <div className="p-4 rounded-xl bg-[#111217] border border-[#b877d9]/30 space-y-2 hover:border-[#b877d9]/60 transition shadow-sm">
                      <div className="flex items-center justify-between border-b border-[#22252b] pb-2">
                        <span className="px-2 py-0.5 rounded bg-[#b877d9]/20 border border-[#b877d9]/40 text-[#d89cf6] text-[10px] font-mono font-bold tracking-wider">
                          WHO
                        </span>
                        <span className="text-[10px] uppercase font-bold text-[#8e9297] tracking-wider">
                          Beneficiary Workflows & Scenarios
                        </span>
                      </div>
                      <p className="text-[#d8d9da] text-[11px] leading-relaxed pt-0.5">
                        {summary.fiveWOneH.who}
                      </p>
                    </div>

                    {/* WHEN */}
                    <div className="p-4 rounded-xl bg-[#111217] border border-[#ff9900]/30 space-y-2 hover:border-[#ff9900]/60 transition shadow-sm">
                      <div className="flex items-center justify-between border-b border-[#22252b] pb-2">
                        <span className="px-2 py-0.5 rounded bg-[#ff9900]/20 border border-[#ff9900]/40 text-[#ff9900] text-[10px] font-mono font-bold tracking-wider">
                          WHEN
                        </span>
                        <span className="text-[10px] uppercase font-bold text-[#8e9297] tracking-wider">
                          Difficulty Divergence & Phasing
                        </span>
                      </div>
                      <p className="text-[#d8d9da] text-[11px] leading-relaxed pt-0.5">
                        {summary.fiveWOneH.when}
                      </p>
                    </div>

                    {/* WHERE */}
                    <div className="p-4 rounded-xl bg-[#111217] border border-[#f87171]/30 space-y-2 hover:border-[#f87171]/60 transition shadow-sm">
                      <div className="flex items-center justify-between border-b border-[#22252b] pb-2">
                        <span className="px-2 py-0.5 rounded bg-[#f87171]/20 border border-[#f87171]/40 text-[#f87171] text-[10px] font-mono font-bold tracking-wider">
                          WHERE
                        </span>
                        <span className="text-[10px] uppercase font-bold text-[#8e9297] tracking-wider">
                          Metric Margins & Trade-offs
                        </span>
                      </div>
                      <p className="text-[#d8d9da] text-[11px] leading-relaxed pt-0.5">
                        {summary.fiveWOneH.where}
                      </p>
                    </div>

                    {/* HOW */}
                    <div className="p-4 rounded-xl bg-[#111217] border border-[#73bf69]/30 space-y-2 hover:border-[#73bf69]/60 transition shadow-sm">
                      <div className="flex items-center justify-between border-b border-[#22252b] pb-2">
                        <span className="px-2 py-0.5 rounded bg-[#73bf69]/20 border border-[#73bf69]/40 text-[#73bf69] text-[10px] font-mono font-bold tracking-wider">
                          HOW
                        </span>
                        <span className="text-[10px] uppercase font-bold text-[#8e9297] tracking-wider">
                          Mechanism & Engineering Blueprint
                        </span>
                      </div>
                      <p className="text-[#d8d9da] text-[11px] leading-relaxed pt-0.5">
                        {summary.fiveWOneH.how}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Column 1: Key Empirical Findings */}
                <div className="p-3.5 rounded-lg bg-[#111217] border border-[#22252b] space-y-2.5">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#5794f2] uppercase tracking-wider">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Empirical Findings</span>
                  </div>
                  <ul className="space-y-2 text-[#c7d0d9] text-[11px] leading-relaxed">
                    {summary.keyFindings.map((finding, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#5794f2] font-bold shrink-0">•</span>
                        <span>{finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Column 2: Architecture Trade-off Matrix */}
                <div className="p-3.5 rounded-lg bg-[#111217] border border-[#22252b] space-y-2.5">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#fade2a] uppercase tracking-wider">
                    <Zap className="w-3.5 h-3.5 text-[#fade2a]" />
                    <span>Architecture Trade-offs</span>
                  </div>
                  <div className="space-y-2 text-[11px]">
                    <div className="p-2 rounded bg-[#181b1f] border border-[#262930] flex items-center justify-between">
                      <span className="text-[#8e9297]">Best Accuracy:</span>
                      <span className="font-bold text-[#73bf69]">{summary.tradeoffs.bestAccuracy}</span>
                    </div>
                    <div className="p-2 rounded bg-[#181b1f] border border-[#262930] flex items-center justify-between">
                      <span className="text-[#8e9297]">Lowest Latency:</span>
                      <span className="font-bold text-[#5794f2]">{summary.tradeoffs.lowestLatency}</span>
                    </div>
                    <div className="p-2 rounded bg-[#181b1f] border border-[#262930] flex items-center justify-between">
                      <span className="text-[#8e9297]">Cost Efficiency:</span>
                      <span className="font-bold text-[#b877d9]">{summary.tradeoffs.costEffective}</span>
                    </div>
                  </div>
                </div>

                {/* Column 3: Game Production Recommendations */}
                <div className="p-3.5 rounded-lg bg-[#111217] border border-[#22252b] space-y-2.5">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#73bf69] uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Production Recommendations</span>
                  </div>
                  <ul className="space-y-2 text-[#c7d0d9] text-[11px] leading-relaxed">
                    {summary.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-[#73bf69] font-bold shrink-0">✓</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Empty State / Trigger Prompt */}
          {!summary && !isSummaryLoading && (
            <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="text-[#8e9297] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#5794f2]" />
                <span>
                  {recent.length > 0
                    ? `${recent.length} benchmark executions recorded. Click 'Generate AI Summary' to synthesize comparative findings with ${
                        process.env.NEXT_PUBLIC_SUMMARY_MODEL || "GPT-4o-mini"
                      }.`
                    : "No benchmark telemetry recorded yet. Run benchmark scenarios below to unlock comparative AI synthesis."}
                </span>
              </div>
              {recent.length > 0 && (
                <button
                  onClick={() => loadSummary(true)}
                  className="px-3.5 py-1.5 rounded bg-[#27153d] hover:bg-[#3b1d5c] text-[#d89cf6] border border-[#b877d9]/40 font-semibold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#d89cf6]" />
                  <span>Analyze Benchmark Results</span>
                </button>
              )}
            </div>
          )}
        </div>

        {activeTab === "system" ? (
          <>
            {/* Grafana Action Control Strip */}
            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={seedScenarios}
              disabled={busy !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#202328] hover:bg-[#2b3038] text-[#c7d0d9] hover:text-white text-xs font-mono font-semibold border border-[#333842] transition disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5 text-[#5794f2]" />
              <span>Seed Scenarios (JSON)</span>
            </button>

            <div className="h-5 w-px bg-[#262930] mx-1" />

            <button
              onClick={() => runMethods(["sparse", "dense", "hybrid"])}
              disabled={busy !== null || scenarios.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#73bf69] hover:bg-[#86d97a] text-[#0b0c0e] text-xs font-mono font-bold transition disabled:opacity-50 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run All (3 Methods)</span>
            </button>

            <button
              onClick={() => setIsBatchModalOpen(true)}
              disabled={busy !== null || scenarios.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#182338] hover:bg-[#223352] text-[#5794f2] hover:text-[#8ab4f8] text-xs font-mono font-bold border border-[#5794f2]/50 transition disabled:opacity-50 shadow-sm"
              title="Configure and run a small batch test (3, 5, or 10 scenarios) to test pipeline performance quickly"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Run Small Batch...</span>
            </button>

            <button
              onClick={() => runMethods(["sparse"])}
              disabled={busy !== null || scenarios.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2a1c0d] hover:bg-[#3d2914] text-[#ff9900] text-xs font-mono font-semibold border border-[#ff9900]/40 transition disabled:opacity-50"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff9900]" />
              <span>Sparse Only</span>
            </button>

            <button
              onClick={() => runMethods(["dense"])}
              disabled={busy !== null || scenarios.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#101d33] hover:bg-[#182c4d] text-[#5794f2] text-xs font-mono font-semibold border border-[#5794f2]/40 transition disabled:opacity-50"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#5794f2]" />
              <span>Dense Only</span>
            </button>

            <button
              onClick={() => runMethods(["hybrid"])}
              disabled={busy !== null || scenarios.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#241330] hover:bg-[#371d4a] text-[#b877d9] text-xs font-mono font-semibold border border-[#b877d9]/40 transition disabled:opacity-50"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#b877d9]" />
              <span>Hybrid Only</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {busy && (
              <button
                onClick={stopBenchmark}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#e02f44] hover:bg-[#ff445a] text-white text-xs font-mono font-bold transition shadow-md animate-pulse"
                title="Stop ongoing benchmark execution immediately"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Benchmark</span>
              </button>
            )}

            <button
              onClick={clearResults}
              disabled={busy !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2e1518] hover:bg-[#3d1a1f] text-[#f2495c] text-xs font-mono border border-[#f2495c]/30 transition disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Logs</span>
            </button>
          </div>
        </div>

        {/* Status / Alert Banner */}
        {busy && (
          <div className="bg-[#241c0e] border border-[#ff9900]/40 text-[#ff9900] px-4 py-2.5 rounded-lg text-xs font-mono flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2 animate-pulse">
              <Activity className="w-4 h-4 shrink-0" />
              <span>{busy}</span>
            </div>
            <button
              onClick={stopBenchmark}
              className="px-3 py-1 rounded bg-[#e02f44] hover:bg-[#ff445a] text-white font-bold text-xs flex items-center gap-1.5 transition shrink-0"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>Cancel Execution</span>
            </button>
          </div>
        )}
        {message && !busy && (
          <div className="bg-[#122238] border border-[#5794f2]/40 text-[#5794f2] px-4 py-2.5 rounded-lg text-xs font-mono flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage(null)} className="text-[#8e9297] hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Row 1: High-Level Stat Panels (Grafana Big Numbers) */}
        {globalStats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 space-y-1 relative overflow-hidden">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#8e9297] flex items-center justify-between">
                <span>Total Benchmark Executions</span>
                <Server className="w-3.5 h-3.5 text-[#5794f2]" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {globalStats.totalRuns}
              </div>
              <div className="text-[11px] font-mono text-[#8e9297]">Across all engines</div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#5794f2]" />
            </div>

            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 space-y-1 relative overflow-hidden">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#8e9297] flex items-center justify-between">
                <span>Avg Precision</span>
                <Target className="w-3.5 h-3.5 text-[#73bf69]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#73bf69]">
                {pct(globalStats.avgPrec)}
              </div>
              <div className="text-[11px] font-mono text-[#8e9297]">Retrieved accuracy</div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#73bf69]" />
            </div>

            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 space-y-1 relative overflow-hidden">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#8e9297] flex items-center justify-between">
                <span>Avg Recall</span>
                <BarChart3 className="w-3.5 h-3.5 text-[#5794f2]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#5794f2]">
                {pct(globalStats.avgRec)}
              </div>
              <div className="text-[11px] font-mono text-[#8e9297]">Ground truth coverage</div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#5794f2]" />
            </div>

            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 space-y-1 relative overflow-hidden">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#8e9297] flex items-center justify-between">
                <span>Avg End-to-End Latency</span>
                <Clock className="w-3.5 h-3.5 text-[#fade2a]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#fade2a]">
                {fmt(globalStats.avgLat, 0)}
                <span className="text-sm font-normal text-[#8e9297]">ms</span>
              </div>
              <div className="text-[11px] font-mono text-[#8e9297]">Retrieval + LLM synthesis</div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#fade2a]" />
            </div>

            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 space-y-1 relative overflow-hidden">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#8e9297] flex items-center justify-between">
                <span>Total LLM Cost</span>
                <Coins className="w-3.5 h-3.5 text-[#b877d9]" />
              </div>
              <div className="text-2xl font-bold font-mono text-[#b877d9]">
                ${fmt(globalStats.totalCost, 4)}
              </div>
              <div className="text-[11px] font-mono text-[#8e9297]">Cumulative token usage</div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#b877d9]" />
            </div>
          </div>
        )}

        {/* Row 2: Method Comparison Panels (Sparse vs Dense vs Hybrid) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {["sparse", "dense", "hybrid"].map((methodKey) => {
            const row = aggregate.find((a) => a.retrievalMethod === methodKey)
            const theme = METHOD_THEMES[methodKey]
            const count = row?.count ?? 0
            const precision = row ? row.avgPrecision : 0
            const recall = row ? row.avgRecall : 0
            const latency = row ? row.avgResponseTimeMs : 0
            const accuracy = row ? row.topKAccuracyRate : 0

            return (
              <div
                key={methodKey}
                className="bg-[#141619] border border-[#22252b] rounded-lg p-5 space-y-4 shadow-md relative overflow-hidden flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#22252b] pb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${theme.bar}`} />
                      <h3 className={`font-mono font-bold text-sm ${theme.text}`}>
                        {theme.label}
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono text-[#8e9297] px-2 py-0.5 rounded bg-[#181b1f] border border-[#262930]">
                      N = {count} Runs
                    </span>
                  </div>

                  {/* Visual Progress / Metrics breakdown */}
                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[#8e9297]">Precision Rate</span>
                        <span className="font-bold text-white">{pct(precision)}</span>
                      </div>
                      <div className="w-full bg-[#1e2228] h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${theme.bar} transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, precision * 100))}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-[#8e9297]">Recall Coverage</span>
                        <span className="font-bold text-white">{pct(recall)}</span>
                      </div>
                      <div className="w-full bg-[#1e2228] h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${theme.bar} opacity-80 transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(0, recall * 100))}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1e2228] text-[11px]">
                      <div>
                        <span className="text-[#8e9297] block">Top-K Accuracy</span>
                        <span className="text-white font-bold">{pct(accuracy)}</span>
                      </div>
                      <div>
                        <span className="text-[#8e9297] block">Avg Latency</span>
                        <span className="text-white font-bold">{fmt(latency, 0)}ms</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => runMethods([methodKey])}
                  disabled={busy !== null || scenarios.length === 0}
                  className={`w-full mt-3 py-1.5 rounded text-xs font-mono font-semibold border transition text-center ${theme.badge} hover:brightness-125 disabled:opacity-40`}
                >
                  Trigger {theme.label} Benchmark
                </button>
              </div>
            )
          })}
        </div>

        {/* Analytic Performance Charts (Average Percentage of Stats) */}
        <section className="bg-[#141619] border border-[#22252b] rounded-lg shadow-md overflow-hidden space-y-6 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#22252b] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-[#1f2328] border border-[#b877d9]/40 flex items-center justify-center text-[#b877d9]">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-mono font-bold text-sm uppercase tracking-wider text-white flex flex-wrap items-center gap-2">
                  <span>Analytic Comparison Charts // Average Stat Percentages</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#1f1726] text-[#b877d9] border border-[#b877d9]/30">
                    Precision • Recall • Top-K • Action Pass Rate
                  </span>
                </h2>
                <p className="text-xs text-[#8e9297] font-mono">
                  Comparative performance percentages across Sparse (BM25), Dense (HNSW), and Hybrid (RRF)
                </p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[#ff9900]" />
                <span className="text-[#c7d0d9]">Sparse (BM25)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[#5794f2]" />
                <span className="text-[#c7d0d9]">Dense (HNSW)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-[#b877d9]" />
                <span className="text-[#c7d0d9]">Hybrid (RRF)</span>
              </div>
            </div>
          </div>

          {/* Main Visuals Grid: Grouped Percentage Bar Chart + Radial Gauges */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8 Cols: Grouped Bar Chart */}
            <div className="lg:col-span-8 bg-[#111217] border border-[#22252b] rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#5794f2]" />
                  <span className="font-mono font-bold text-xs uppercase text-white tracking-wider">
                    Core Metrics Comparison (0% - 100%)
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#8e9297]">
                  Normalized Average Percentage
                </span>
              </div>

              {/* The Visual Grouped Bar Chart Area */}
              <div className="relative pt-6 pb-2">
                {/* 0%, 25%, 50%, 75%, 100% Horizontal Gridlines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
                  {[100, 75, 50, 25, 0].map((level) => (
                    <div key={level} className="flex items-center gap-2 w-full">
                      <span className="font-mono text-[10px] text-[#555a64] w-7 text-right">
                        {level}%
                      </span>
                      <div className="flex-1 border-b border-[#1e2228] border-dashed" />
                    </div>
                  ))}
                </div>

                {/* Bars Container */}
                <div className="relative pl-9 pr-2 h-64 flex items-end justify-around pb-8 z-10">
                  {metricsToCompare.map((m) => {
                    const spVal = engineStats.sparse[m.key]
                    const dnVal = engineStats.dense[m.key]
                    const hyVal = engineStats.hybrid[m.key]

                    return (
                      <div key={m.key} className="flex flex-col items-center h-full justify-end group px-2">
                        {/* 3 Grouped Bars */}
                        <div className="flex items-end gap-2.5 h-full">
                          {/* Sparse Bar */}
                          <div className="flex flex-col items-center h-full justify-end">
                            <span className="text-[10px] font-mono font-bold text-[#ff9900] mb-1">
                              {spVal > 0 ? `${spVal.toFixed(1)}%` : "0%"}
                            </span>
                            <div
                              className="w-6 md:w-8 bg-[#ff9900] rounded-t transition-all duration-700 hover:brightness-125 shadow-sm"
                              style={{ height: `${Math.max(4, Math.min(100, spVal))}%` }}
                              title={`Sparse (BM25): ${spVal.toFixed(1)}%`}
                            />
                          </div>

                          {/* Dense Bar */}
                          <div className="flex flex-col items-center h-full justify-end">
                            <span className="text-[10px] font-mono font-bold text-[#5794f2] mb-1">
                              {dnVal > 0 ? `${dnVal.toFixed(1)}%` : "0%"}
                            </span>
                            <div
                              className="w-6 md:w-8 bg-[#5794f2] rounded-t transition-all duration-700 hover:brightness-125 shadow-sm"
                              style={{ height: `${Math.max(4, Math.min(100, dnVal))}%` }}
                              title={`Dense (HNSW): ${dnVal.toFixed(1)}%`}
                            />
                          </div>

                          {/* Hybrid Bar */}
                          <div className="flex flex-col items-center h-full justify-end">
                            <span className="text-[10px] font-mono font-bold text-[#b877d9] mb-1">
                              {hyVal > 0 ? `${hyVal.toFixed(1)}%` : "0%"}
                            </span>
                            <div
                              className="w-6 md:w-8 bg-[#b877d9] rounded-t transition-all duration-700 hover:brightness-125 shadow-sm"
                              style={{ height: `${Math.max(4, Math.min(100, hyVal))}%` }}
                              title={`Hybrid (RRF): ${hyVal.toFixed(1)}%`}
                            />
                          </div>
                        </div>

                        {/* Metric Label */}
                        <div className="text-center mt-3">
                          <span className="font-mono text-xs font-semibold text-white block">
                            {m.label}
                          </span>
                          <span className="font-mono text-[10px] text-[#8e9297] hidden sm:block">
                            {m.desc}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right 4 Cols: Radial Composite Score Rings */}
            <div className="lg:col-span-4 bg-[#111217] border border-[#22252b] rounded-lg p-5 space-y-4 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-[#b877d9]" />
                  <span className="font-mono font-bold text-xs uppercase text-white tracking-wider">
                    Overall Composite Quality
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1f2328] text-[#8e9297]">
                  Avg of 4 Percentage Stats
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2">
                <CircularGauge
                  value={engineStats.sparse.composite}
                  color="#ff9900"
                  label="Sparse"
                />
                <CircularGauge
                  value={engineStats.dense.composite}
                  color="#5794f2"
                  label="Dense"
                />
                <CircularGauge
                  value={engineStats.hybrid.composite}
                  color="#b877d9"
                  label="Hybrid"
                />
              </div>

              {/* Quick Summary Highlights */}
              <div className="space-y-2 pt-2 border-t border-[#1e2228] font-mono text-[11px]">
                <div className="flex items-center justify-between p-2 rounded bg-[#181b1f]">
                  <span className="text-[#8e9297]">Highest Precision:</span>
                  <span className="font-bold text-white">
                    {engineStats.hybrid.precision >= engineStats.dense.precision && engineStats.hybrid.precision >= engineStats.sparse.precision
                      ? `Hybrid (${engineStats.hybrid.precision.toFixed(1)}%)`
                      : engineStats.dense.precision >= engineStats.sparse.precision
                      ? `Dense (${engineStats.dense.precision.toFixed(1)}%)`
                      : `Sparse (${engineStats.sparse.precision.toFixed(1)}%)`}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-[#181b1f]">
                  <span className="text-[#8e9297]">Highest Recall:</span>
                  <span className="font-bold text-white">
                    {engineStats.hybrid.recall >= engineStats.dense.recall && engineStats.hybrid.recall >= engineStats.sparse.recall
                      ? `Hybrid (${engineStats.hybrid.recall.toFixed(1)}%)`
                      : engineStats.dense.recall >= engineStats.sparse.recall
                      ? `Dense (${engineStats.dense.recall.toFixed(1)}%)`
                      : `Sparse (${engineStats.sparse.recall.toFixed(1)}%)`}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-[#181b1f]">
                  <span className="text-[#8e9297]">Best Action Pass Rate:</span>
                  <span className="font-bold text-[#73bf69]">
                    {engineStats.hybrid.correctness >= engineStats.dense.correctness && engineStats.hybrid.correctness >= engineStats.sparse.correctness
                      ? `Hybrid (${engineStats.hybrid.correctness.toFixed(1)}%)`
                      : engineStats.dense.correctness >= engineStats.sparse.correctness
                      ? `Dense (${engineStats.dense.correctness.toFixed(1)}%)`
                      : `Sparse (${engineStats.sparse.correctness.toFixed(1)}%)`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Difficulty Breakdown Percentage Performance (Easy vs Medium vs Hard) */}
          <div className="bg-[#111217] border border-[#22252b] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#73bf69]" />
                <span className="font-mono font-bold text-xs uppercase text-white tracking-wider">
                  Percentage Stats by Scenario Complexity (Easy vs Medium vs Hard)
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#8e9297]">
                Evaluates Multi-Hop Reasoning Resilience
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["easy", "medium", "hard"] as const).map((diff) => {
                const diffLabel = diff.toUpperCase()
                const badgeColor =
                  diff === "easy"
                    ? "text-[#4ade80] bg-[#14532d]/40 border-[#22c55e]/30"
                    : diff === "medium"
                    ? "text-[#fbbf24] bg-[#78350f]/40 border-[#f59e0b]/30"
                    : "text-[#f87171] bg-[#7f1d1d]/40 border-[#ef4444]/30"

                return (
                  <div key={diff} className="bg-[#141619] border border-[#22252b] rounded-lg p-4 space-y-3 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-[#22252b] pb-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${badgeColor}`}>
                        {diffLabel} SCENARIOS
                      </span>
                      <span className="text-[10px] text-[#8e9297]">
                        Avg Precision / Recall
                      </span>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      {["sparse", "dense", "hybrid"].map((m) => {
                        const theme = METHOD_THEMES[m]
                        const st = difficultyStats[diff]?.[m] ?? { prec: 0, rec: 0 }
                        return (
                          <div key={m} className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className={theme.text}>{theme.label}</span>
                              <span className="text-white font-bold">
                                P: {st.prec.toFixed(1)}% | R: {st.rec.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex gap-1 h-2 w-full bg-[#1e2228] rounded-full overflow-hidden">
                              <div
                                className={`${theme.bar} transition-all duration-500`}
                                style={{ width: `${Math.min(50, st.prec / 2)}%` }}
                                title={`Precision: ${st.prec.toFixed(1)}%`}
                              />
                              <div
                                className={`${theme.bar} opacity-60 transition-all duration-500`}
                                style={{ width: `${Math.min(50, st.rec / 2)}%` }}
                                title={`Recall: ${st.rec.toFixed(1)}%`}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Row 3: Comparative Aggregate Matrix (Grafana Table View) */}
        <section className="bg-[#141619] border border-[#22252b] rounded-lg shadow-md overflow-hidden">
          <div className="px-5 py-3.5 bg-[#181b1f] border-b border-[#22252b] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#5794f2]" />
              <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-white">
                Engine Comparison Matrix // Benchmark Telemetry
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#8e9297]">
              Ground-Truth Verified
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#111217] text-[#8e9297] uppercase text-[10px] tracking-wider border-b border-[#22252b]">
                <tr>
                  <ThTip label="Engine Method" tip={METRIC_TOOLTIPS.engineMethod} />
                  <ThTip label="Samples (N)" tip={METRIC_TOOLTIPS.samples} />
                  <ThTip label="Precision" tip={METRIC_TOOLTIPS.precision} />
                  <ThTip label="Recall" tip={METRIC_TOOLTIPS.recall} />
                  <ThTip label="Top-K Acc" tip={METRIC_TOOLTIPS.topKAcc} />
                  <ThTip label="Avg Time" tip={METRIC_TOOLTIPS.latency} />
                  <ThTip label="Avg Tokens" tip={METRIC_TOOLTIPS.tokens} />
                  <ThTip label="Total Cost" tip={METRIC_TOOLTIPS.cost} />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2228]">
                {aggregate.length === 0 || aggregate.every((a) => a.count === 0) ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[#8e9297]">
                      No benchmark telemetry records found. Click &quot;Run All (3 Methods)&quot; above to generate comparative metrics.
                    </td>
                  </tr>
                ) : (
                  aggregate.map((a) => {
                    const theme = METHOD_THEMES[a.retrievalMethod]
                    return (
                      <tr key={a.retrievalMethod} className="hover:bg-[#181b1f] transition">
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              theme?.badge ?? "bg-gray-800 text-gray-300"
                            }`}
                          >
                            {theme?.label ?? a.retrievalMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white font-semibold">{a.count}</td>
                        <td className="px-4 py-3 text-[#73bf69] font-bold">
                          {pct(a.avgPrecision)}
                        </td>
                        <td className="px-4 py-3 text-[#5794f2] font-bold">{pct(a.avgRecall)}</td>
                        <td className="px-4 py-3 text-white">{pct(a.topKAccuracyRate)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              a.avgResponseTimeMs < 500
                                ? "bg-[#14532d]/40 text-[#4ade80]"
                                : a.avgResponseTimeMs < 1500
                                ? "bg-[#78350f]/40 text-[#fbbf24]"
                                : "bg-[#7f1d1d]/40 text-[#f87171]"
                            }`}
                          >
                            {fmt(a.avgResponseTimeMs, 0)}ms
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#8e9297]">{fmt(a.avgTokens, 0)}</td>
                        <td className="px-4 py-3 text-[#b877d9] font-bold">
                          ${fmt(a.totalCost, 4)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Row 4: Scenarios Catalog */}
        <section className="bg-[#141619] border border-[#22252b] rounded-lg shadow-md overflow-hidden">
          <div className="px-5 py-3.5 bg-[#181b1f] border-b border-[#22252b] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#ff9900]" />
              <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-white">
                Benchmark Scenario Scenarios ({scenarios.length} Loaded)
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#8e9297]">
              Source: <code>eval-scenarios/*.json</code>
            </span>
          </div>

          {/* Selection action bar */}
          {selectedScenarioIds.length > 0 && (
            <div className="px-5 py-2.5 bg-[#182338]/70 border-b border-[#5794f2]/30 flex flex-wrap items-center justify-between gap-2 text-xs font-mono animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#5794f2] animate-pulse" />
                <span className="text-white font-bold">{selectedScenarioIds.length}</span>
                <span className="text-[#8e9297]">scenario(s) selected for targeted batch run</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => runBatch({ scenarioIds: selectedScenarioIds, methods: ["sparse", "dense", "hybrid"] })}
                  disabled={busy !== null}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#5794f2] hover:bg-[#6ba5f5] text-[#0b0c0e] font-bold transition shadow-sm"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Run Selected ({selectedScenarioIds.length} × 3 = {selectedScenarioIds.length * 3} runs)</span>
                </button>
                <button
                  onClick={() => {
                    setBatchPreset("selected")
                    setIsBatchModalOpen(true)
                  }}
                  disabled={busy !== null}
                  className="px-2.5 py-1 rounded bg-[#202328] hover:bg-[#2b3038] text-[#5794f2] hover:text-white border border-[#333842] transition"
                >
                  Customize Batch...
                </button>
                <button
                  onClick={() => setSelectedScenarioIds([])}
                  className="px-2 py-1 rounded hover:bg-[#202328] text-[#8e9297] hover:text-white transition"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#111217] text-[#8e9297] uppercase text-[10px] tracking-wider border-b border-[#22252b] sticky top-0">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={scenarios.length > 0 && selectedScenarioIds.length === scenarios.length}
                      onChange={toggleSelectAllScenarios}
                      className="rounded bg-[#181b1f] border-[#383e4a] text-[#5794f2] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      title="Select / Deselect all scenarios"
                    />
                  </th>
                  <ThTip label="Target Case" tip={METRIC_TOOLTIPS.targetCase} />
                  <ThTip label="Difficulty" tip={METRIC_TOOLTIPS.difficulty} />
                  <ThTip label="Test Prompt Inquiry" tip={METRIC_TOOLTIPS.promptInquiry} />
                  <th className="px-4 py-2.5 text-right">Quick Run</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2228]">
                {scenarios.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-[#8e9297]">
                      No scenarios seeded. Click &quot;Seed Scenarios (JSON)&quot; to load ground-truth evaluation prompts.
                    </td>
                  </tr>
                ) : (
                  scenarios.map((s) => (
                    <tr
                      key={s.id}
                      className={`transition ${
                        selectedScenarioIds.includes(s.id)
                          ? "bg-[#182338]/30 hover:bg-[#182338]/50"
                          : "hover:bg-[#181b1f]"
                      }`}
                    >
                      <td className="w-10 px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedScenarioIds.includes(s.id)}
                          onChange={() => toggleScenarioSelection(s.id)}
                          className="rounded bg-[#181b1f] border-[#383e4a] text-[#5794f2] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-white truncate max-w-xs">
                        {s.case.title}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                            s.difficulty === "easy"
                              ? "bg-[#14532d]/40 text-[#4ade80] border border-[#22c55e]/30"
                              : s.difficulty === "medium"
                              ? "bg-[#78350f]/40 text-[#fbbf24] border border-[#f59e0b]/30"
                              : "bg-[#7f1d1d]/40 text-[#f87171] border border-[#ef4444]/30"
                          }`}
                        >
                          {s.difficulty}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#c7d0d9] max-w-lg truncate">
                        {s.prompt}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => runOne(s.id)}
                          disabled={busy !== null}
                          className="px-2.5 py-1 rounded bg-[#202328] hover:bg-[#2b3038] text-[#5794f2] hover:text-white border border-[#333842] text-[11px] font-mono transition disabled:opacity-50"
                        >
                          Run All 3
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Row 5: Recent Telemetry Stream (Grafana Log Table) */}
        <section className="bg-[#141619] border border-[#22252b] rounded-lg shadow-md overflow-hidden">
          <div className="px-5 py-3.5 bg-[#181b1f] border-b border-[#22252b] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#73bf69]" />
                <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-white">
                  Execution Log Stream ({filteredRecent.length} / {recent.length})
                </h2>
              </div>

              {/* Live stream indicator */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1f2328] border border-[#2b3036] text-[10px] font-mono">
                <div className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? "bg-[#4ade80] animate-ping" : "bg-[#8e9297]"}`} />
                <span className={autoRefresh ? "text-[#4ade80] font-semibold" : "text-[#8e9297]"}>
                  {autoRefresh ? "LIVE STREAM" : "PAUSED"}
                </span>
                {lastPollTime && <span className="text-[#8e9297]">({lastPollTime})</span>}
              </div>

              {/* Benchmark progress */}
              <div className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#111217] text-[#5794f2] border border-[#5794f2]/30">
                {(() => {
                  const target =
                    activeTargetRuns ||
                    (activeEvalStatus?.totalRuns && activeEvalStatus.totalRuns > 0
                      ? activeEvalStatus.totalRuns
                      : null) ||
                    (recent.length >= (scenarios.length > 0 ? scenarios.length * 3 : 90)
                      ? (scenarios.length > 0 ? scenarios.length * 3 : 90)
                      : null)

                  if (target) {
                    const pct = Math.min(100, Math.round((recent.length / target) * 100))
                    return (
                      <>
                        Benchmark: <strong>{recent.length}</strong> / {target} Runs ({pct}%)
                      </>
                    )
                  }

                  return (
                    <>
                      Benchmark: <strong>{recent.length}</strong> Runs Recorded
                    </>
                  )
                })()}
              </div>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsTelemetryCopyModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono border transition shadow-sm ${
                  copiedCsv
                    ? "bg-[#14532d] text-[#4ade80] border-[#22c55e]"
                    : "bg-[#202328] hover:bg-[#2b3038] text-[#c7d0d9] hover:text-white border-[#333842]"
                }`}
                title="Configure and copy execution telemetry logs as CSV"
              >
                {copiedCsv ? (
                  <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#5794f2]" />
                )}
                <span className={copiedCsv ? "font-bold text-[#4ade80]" : ""}>
                  {copiedCsv ? "Copied CSV!" : "Copy as CSV..."}
                </span>
              </button>

              <button
                onClick={() => setAutoRefresh((prev) => !prev)}
                className={`px-2.5 py-1 rounded text-xs font-mono border transition ${
                  autoRefresh
                    ? "bg-[#14532d]/50 text-[#4ade80] border-[#22c55e]/40 hover:bg-[#14532d]/70"
                    : "bg-[#202328] text-[#8e9297] border-[#333842] hover:text-white"
                }`}
              >
                {autoRefresh ? "Pause Live Poll" : "Resume Live Poll"}
              </button>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#8e9297]" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter logs..."
                  className="bg-[#111217] border border-[#262930] rounded pl-8 pr-2.5 py-1 text-xs font-mono text-white placeholder-[#8e9297] focus:outline-none focus:border-[#5794f2]"
                />
              </div>

              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="bg-[#111217] border border-[#262930] rounded px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-[#5794f2]"
              >
                <option value="all">All Methods</option>
                <option value="sparse">Sparse Only</option>
                <option value="dense">Dense Only</option>
                <option value="hybrid">Hybrid Only</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-[#111217] text-[#8e9297] uppercase text-[10px] tracking-wider border-b border-[#22252b] sticky top-0 z-10">
                <tr>
                  <ThTip label="Timestamp" tip={METRIC_TOOLTIPS.timestamp} />
                  <ThTip label="Engine" tip={METRIC_TOOLTIPS.engine} />
                  <ThTip label="Prompt" tip={METRIC_TOOLTIPS.promptInquiry} />
                  <ThTip label="Correctness" tip={METRIC_TOOLTIPS.correctness} />
                  <ThTip label="Precision" tip={METRIC_TOOLTIPS.precision} />
                  <ThTip label="Recall" tip={METRIC_TOOLTIPS.recall} />
                  <ThTip label="Top-K" tip={METRIC_TOOLTIPS.topK} />
                  <ThTip label="Latency" tip={METRIC_TOOLTIPS.latency} />
                  <ThTip label="Tokens" tip={METRIC_TOOLTIPS.tokens} />
                  <ThTip label="Cost" tip={METRIC_TOOLTIPS.cost} />
                  <th className="px-3 py-2.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2228]">
                {filteredRecent.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-[#8e9297]">
                      No telemetry logs match current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRecent.map((r) => {
                    const theme = METHOD_THEMES[r.retrievalMethod]
                    const isExpanded = expandedLogId === r.id
                    return (
                      <Fragment key={r.id}>
                        <tr
                          onClick={() => setExpandedLogId(isExpanded ? null : r.id)}
                          className={`hover:bg-[#181b1f] cursor-pointer transition ${
                            isExpanded ? "bg-[#181b1f]" : ""
                          }`}
                        >
                          <td className="px-4 py-2.5 text-[#8e9297] whitespace-nowrap text-[11px]">
                            {new Date(r.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                theme?.badge ?? "bg-gray-800 text-gray-300"
                              }`}
                            >
                              {theme?.label ?? r.retrievalMethod}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-white max-w-xs truncate font-medium">
                            {r.userPrompt}
                          </td>
                          <td className="px-4 py-2.5">
                            {r.correctnessScore === null ? (
                              <span className="text-[#8e9297]">—</span>
                            ) : r.correctnessScore >= 0.7 ? (
                              <span className="text-[#73bf69] font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>PASS{r.correctnessScore < 1 ? ` (${(r.correctnessScore * 100).toFixed(0)}%)` : ""}</span>
                              </span>
                            ) : (
                              <span className="text-[#f2495c] font-bold flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>FAIL{r.correctnessScore > 0 ? ` (${(r.correctnessScore * 100).toFixed(0)}%)` : ""}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[#73bf69] font-semibold">
                            {r.retrievalPrecision !== null ? pct(r.retrievalPrecision) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-[#5794f2] font-semibold">
                            {r.retrievalRecall !== null ? pct(r.retrievalRecall) : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            {r.topKAccuracy === null ? (
                              <span className="text-[#8e9297]">—</span>
                            ) : r.topKAccuracy ? (
                              <span className="text-[#73bf69] font-semibold">TRUE</span>
                            ) : (
                              <span className="text-[#f2495c] font-semibold">FALSE</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[#fade2a]">
                            {r.totalResponseTimeMs}ms
                          </td>
                          <td className="px-4 py-2.5 text-[#8e9297]">{r.totalTokens}</td>
                          <td className="px-4 py-2.5 text-[#b877d9] font-medium">
                            ${r.estimatedCost?.toFixed(4) ?? "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right text-[#8e9297]">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 inline text-[#5794f2]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 inline" />
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-[#0e1013] border-b border-[#22252b]">
                            <td colSpan={11} className="p-4 space-y-3">
                              <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 space-y-3 shadow-inner">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#22252b] pb-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#8e9297]">Target Case:</span>
                                    <span className="text-white font-semibold">
                                      {r.scenario?.case?.title ?? "The Nexus Data Breach"}
                                    </span>
                                    {r.scenario?.difficulty && (
                                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-[#1f2328] text-[#fade2a] border border-[#fade2a]/30">
                                        {r.scenario.difficulty}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-3 text-[#8e9297] font-mono text-[11px]">
                                      <span>Log ID: <code className="text-[#c7d0d9]">{r.id}</code></span>
                                      <span>•</span>
                                      <span>Retrieval: <strong className="text-[#fade2a]">{r.retrievalTimeMs ?? 0}ms</strong></span>
                                      <span>•</span>
                                      <span>LLM: <strong className="text-[#fade2a]">{r.llmResponseTimeMs ?? 0}ms</strong></span>
                                      <span>•</span>
                                      <span>Tokens: <strong className="text-[#b877d9]">{r.totalTokens}</strong> ({r.promptTokens ?? 0} in / {r.completionTokens ?? 0} out)</span>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        copyLogAsMarkdown(r)
                                      }}
                                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border transition shadow-sm ${
                                        copiedLogId === r.id
                                          ? "bg-[#14532d] text-[#4ade80] border-[#22c55e]"
                                          : "bg-[#202328] hover:bg-[#2b3038] text-[#c7d0d9] hover:text-white border-[#333842]"
                                      }`}
                                      title="Copy complete log detail as Markdown"
                                    >
                                      {copiedLogId === r.id ? (
                                        <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5 text-[#5794f2]" />
                                      )}
                                      <span className={copiedLogId === r.id ? "font-bold text-[#4ade80]" : ""}>
                                        {copiedLogId === r.id ? "Copied Markdown!" : "Copy as Markdown"}
                                      </span>
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="text-[11px] font-mono font-bold uppercase text-[#8e9297]">Evaluation Inquiry / Prompt:</div>
                                  <div className="p-2.5 rounded bg-[#181b1f] border border-[#262930] text-[#d8d9da] text-xs font-mono select-text">
                                    {r.userPrompt}
                                  </div>
                                </div>

                                {r.retrievedContext && (
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase text-[#8e9297]">
                                      <span>Retrieved Evidence Context:</span>
                                      <span className="text-[10px] text-[#5794f2]">
                                        Precision: {pct(r.retrievalPrecision ?? 0)} | Recall: {pct(r.retrievalRecall ?? 0)}
                                      </span>
                                    </div>
                                    <pre className="p-2.5 rounded bg-[#111217] border border-[#262930] text-[#8e9297] text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto select-text">
                                      {r.retrievedContext}
                                    </pre>
                                  </div>
                                )}

                                {r.aiResponse && (
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-mono font-bold uppercase text-[#73bf69]">AI Response (gpt-5.6-luna):</div>
                                    <div className="p-3 rounded bg-[#181b1f] border border-[#73bf69]/30 select-text">
                                      <MarkdownResponse content={r.aiResponse} variant="eval" />
                                    </div>
                                  </div>
                                )}

                                {r.structuredRecommendation && (
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-mono font-bold uppercase text-[#b877d9]">Structured Recommendation:</div>
                                    <div className="p-2.5 rounded bg-[#1f1726] border border-[#b877d9]/30 text-xs font-mono flex flex-wrap items-center gap-3">
                                      <span className="px-2 py-0.5 rounded bg-[#361a49] text-[#d89cf6] font-bold border border-[#b877d9]/40">
                                        {r.structuredRecommendation.action_type}
                                      </span>
                                      <span className="text-[#8e9297]">Target:</span>
                                      <span className="text-white font-semibold">{r.structuredRecommendation.target}</span>
                                      <span className="text-[#8e9297]">Reason:</span>
                                      <span className="text-[#d8d9da] italic">{r.structuredRecommendation.reason}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </>
    ) : (
        <>
          {/* RAGAS LLM Evaluation Tab Content */}

          {/* RAGAS Header & Status Strip */}
          <div className="bg-[#141619] border border-[#22252b] rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#b877d9]" />
                <span className="font-mono font-bold text-xs uppercase text-white tracking-wider">
                  RAGAS Framework Telemetry
                </span>
              </div>
              <div className="h-4 w-px bg-[#262930]" />
              <div className="flex items-center gap-2 text-xs font-mono text-[#8e9297]">
                <span>LLM Judge:</span>
                <span className="text-[#d8d9da] font-semibold">gpt-4o-mini (temperature: 0)</span>
              </div>
              <div className="h-4 w-px bg-[#262930]" />
              <div className="flex items-center gap-2 text-xs font-mono text-[#8e9297]">
                <span>Embedding Model:</span>
                <span className="text-[#d8d9da] font-semibold">text-embedding-3-small</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-[11px] font-mono px-2.5 py-1 rounded bg-[#1f1726] text-[#b877d9] border border-[#b877d9]/30">
                {(() => {
                  const total =
                    recent.length > 0
                      ? recent.length
                      : activeTargetRuns || (scenarios.length > 0 ? scenarios.length * 3 : 90)
                  const pct = total > 0 ? Math.min(100, Math.round((ragasLogs.length / total) * 100)) : 0
                  return (
                    <>
                      Evaluated: <strong>{ragasLogs.length}</strong> / {total} Runs ({pct}%)
                    </>
                  )
                })()}
              </div>

              <button
                onClick={() => setIsCopyModalOpen(true)}
                disabled={filteredRagasLogs.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono border transition shadow-sm disabled:opacity-50 ${
                  copiedRagasCsv
                    ? "bg-[#14532d] text-[#4ade80] border-[#22c55e]"
                    : "bg-[#202328] hover:bg-[#2b3038] text-[#c7d0d9] hover:text-white border-[#333842]"
                }`}
                title="Configure and copy evaluated RAGAS logs as CSV"
              >
                {copiedRagasCsv ? (
                  <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#b877d9]" />
                )}
                <span>{copiedRagasCsv ? "Copied CSV!" : "Copy RAGAS CSV"}</span>
              </button>
            </div>
          </div>

          {/* RAGAS Summary KPI Cards */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#73bf69]/50 transition">
              <div className="flex items-center justify-between pb-2 border-b border-[#22252b]">
                <span className="text-[10px] font-mono uppercase text-[#8e9297] tracking-wider font-semibold">
                  Avg Faithfulness
                </span>
                <div className="p-1 rounded bg-[#14532d]/30 text-[#73bf69]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="my-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono tracking-tight text-white">
                  {ragasGlobalStats ? `${(ragasGlobalStats.avgFaith * 100).toFixed(1)}%` : "0.0%"}
                </span>
                <span className="text-[10px] font-mono text-[#73bf69]">Grounding</span>
              </div>
              <p className="text-[11px] font-mono text-[#8e9297] leading-tight">
                Factual alignment of response with retrieved evidence chunks.
              </p>
            </div>

            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#ff9900]/50 transition">
              <div className="flex items-center justify-between pb-2 border-b border-[#22252b]">
                <span className="text-[10px] font-mono uppercase text-[#8e9297] tracking-wider font-semibold">
                  Answer Relevance
                </span>
                <div className="p-1 rounded bg-[#2a1c0d] text-[#ff9900]">
                  <Target className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="my-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono tracking-tight text-white">
                  {ragasGlobalStats ? `${(ragasGlobalStats.avgAnsRel * 100).toFixed(1)}%` : "0.0%"}
                </span>
                <span className="text-[10px] font-mono text-[#ff9900]">Directness</span>
              </div>
              <p className="text-[11px] font-mono text-[#8e9297] leading-tight">
                Direct pertinence and conciseness of answer to user inquiry.
              </p>
            </div>

            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#5794f2]/50 transition">
              <div className="flex items-center justify-between pb-2 border-b border-[#22252b]">
                <span className="text-[10px] font-mono uppercase text-[#8e9297] tracking-wider font-semibold">
                  Context Precision
                </span>
                <div className="p-1 rounded bg-[#101d33] text-[#5794f2]">
                  <BarChart3 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="my-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono tracking-tight text-white">
                  {ragasGlobalStats ? `${(ragasGlobalStats.avgCtxPrec * 100).toFixed(1)}%` : "0.0%"}
                </span>
                <span className="text-[10px] font-mono text-[#5794f2]">Signal/Noise</span>
              </div>
              <p className="text-[11px] font-mono text-[#8e9297] leading-tight">
                Ratio of relevant ground-truth evidence ranked near the top.
              </p>
            </div>

            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#b877d9]/50 transition">
              <div className="flex items-center justify-between pb-2 border-b border-[#22252b]">
                <span className="text-[10px] font-mono uppercase text-[#8e9297] tracking-wider font-semibold">
                  Context Recall
                </span>
                <div className="p-1 rounded bg-[#241330] text-[#b877d9]">
                  <Database className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="my-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono tracking-tight text-white">
                  {ragasGlobalStats ? `${(ragasGlobalStats.avgCtxRec * 100).toFixed(1)}%` : "0.0%"}
                </span>
                <span className="text-[10px] font-mono text-[#b877d9]">Coverage</span>
              </div>
              <p className="text-[11px] font-mono text-[#8e9297] leading-tight">
                Coverage of ground-truth evidence successfully retrieved.
              </p>
            </div>

            <div className="bg-[#141619] border border-[#22252b] rounded-lg p-4 flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-white/40 transition">
              <div className="flex items-center justify-between pb-2 border-b border-[#22252b]">
                <span className="text-[10px] font-mono uppercase text-[#8e9297] tracking-wider font-semibold">
                  Composite RAGAS Index
                </span>
                <div className="p-1 rounded bg-[#1f2328] text-white">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="my-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono tracking-tight text-[#d8d9da]">
                  {ragasGlobalStats ? `${(ragasGlobalStats.composite * 100).toFixed(1)}%` : "0.0%"}
                </span>
                <span className="text-[10px] font-mono text-[#8e9297]">Triad Avg</span>
              </div>
              <p className="text-[11px] font-mono text-[#8e9297] leading-tight">
                Harmonic aggregate score across all 4 LLM Judge metrics.
              </p>
            </div>
          </section>

          {/* Comparative Engine Analysis Section */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Col: Comparative Bar Chart */}
            <div className="lg:col-span-8 bg-[#141619] border border-[#22252b] rounded-lg p-5 space-y-6 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#22252b] pb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#b877d9]" />
                  <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-white">
                    Engine Comparative Performance // RAGAS Triad Metrics
                  </h2>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-[#ff9900]" />
                    <span className="text-[#ff9900]">Sparse (BM25)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-[#5794f2]" />
                    <span className="text-[#5794f2]">Dense (HNSW)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-[#b877d9]" />
                    <span className="text-[#b877d9]">Hybrid (RRF)</span>
                  </div>
                </div>
              </div>

              {/* Grouped Comparative Chart */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 pt-2">
                {[
                  { key: "faithfulness", label: "Faithfulness", desc: "Hallucination avoidance" },
                  { key: "answerRelevance", label: "Answer Relevance", desc: "Pertinence to prompt" },
                  { key: "contextPrecision", label: "Context Precision", desc: "Ranking efficiency" },
                  { key: "contextRecall", label: "Context Recall", desc: "Ground-truth recall" },
                  { key: "composite", label: "Composite Index", desc: "Overall Ragas index" },
                ].map((metric) => {
                  const sVal = (ragasEngineStats.sparse as any)[metric.key] ?? 0
                  const dVal = (ragasEngineStats.dense as any)[metric.key] ?? 0
                  const hVal = (ragasEngineStats.hybrid as any)[metric.key] ?? 0

                  return (
                    <div
                      key={metric.key}
                      className="bg-[#111217] border border-[#1e2228] rounded-lg p-3.5 flex flex-col justify-between"
                    >
                      <div className="text-center pb-2 border-b border-[#1e2228]">
                        <div className="font-mono font-bold text-xs text-white uppercase tracking-wider">
                          {metric.label}
                        </div>
                        <div className="text-[10px] font-mono text-[#8e9297]">{metric.desc}</div>
                      </div>

                      {/* Bars */}
                      <div className="h-44 flex items-end justify-center gap-3 pt-6 pb-2">
                        {/* Sparse */}
                        <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                          <span className="text-[10px] font-mono text-[#ff9900] font-bold">
                            {sVal.toFixed(1)}%
                          </span>
                          <div className="w-5 bg-[#202328] rounded-t overflow-hidden flex items-end h-32">
                            <div
                              className="w-full bg-[#ff9900] transition-all duration-700 rounded-t"
                              style={{ height: `${Math.min(100, sVal)}%` }}
                              title={`Sparse: ${sVal.toFixed(1)}%`}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-[#8e9297]">BM25</span>
                        </div>

                        {/* Dense */}
                        <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                          <span className="text-[10px] font-mono text-[#5794f2] font-bold">
                            {dVal.toFixed(1)}%
                          </span>
                          <div className="w-5 bg-[#202328] rounded-t overflow-hidden flex items-end h-32">
                            <div
                              className="w-full bg-[#5794f2] transition-all duration-700 rounded-t"
                              style={{ height: `${Math.min(100, dVal)}%` }}
                              title={`Dense: ${dVal.toFixed(1)}%`}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-[#8e9297]">HNSW</span>
                        </div>

                        {/* Hybrid */}
                        <div className="flex flex-col items-center gap-1.5 h-full justify-end group">
                          <span className="text-[10px] font-mono text-[#b877d9] font-bold">
                            {hVal.toFixed(1)}%
                          </span>
                          <div className="w-5 bg-[#202328] rounded-t overflow-hidden flex items-end h-32">
                            <div
                              className="w-full bg-[#b877d9] transition-all duration-700 rounded-t"
                              style={{ height: `${Math.min(100, hVal)}%` }}
                              title={`Hybrid: ${hVal.toFixed(1)}%`}
                            />
                          </div>
                          <span className="text-[9px] font-mono text-[#8e9297]">RRF</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right Col: Composite Gauge Rings & Summary */}
            <div className="lg:col-span-4 bg-[#141619] border border-[#22252b] rounded-lg p-5 space-y-5 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-[#22252b] pb-3">
                  <PieChart className="w-4 h-4 text-[#73bf69]" />
                  <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-white">
                    Overall Engine Composite RAGAS Score
                  </h3>
                </div>

                <div className="grid grid-cols-3 gap-2 py-4">
                  <CircularGauge
                    value={ragasEngineStats.sparse.composite}
                    color="#ff9900"
                    size={80}
                    strokeWidth={7}
                    label="Sparse (BM25)"
                  />
                  <CircularGauge
                    value={ragasEngineStats.dense.composite}
                    color="#5794f2"
                    size={80}
                    strokeWidth={7}
                    label="Dense (HNSW)"
                  />
                  <CircularGauge
                    value={ragasEngineStats.hybrid.composite}
                    color="#b877d9"
                    size={80}
                    strokeWidth={7}
                    label="Hybrid (RRF)"
                  />
                </div>
              </div>

              {/* Quick Summary Highlights */}
              <div className="space-y-2 pt-2 border-t border-[#1e2228] font-mono text-[11px]">
                <div className="flex items-center justify-between p-2 rounded bg-[#181b1f]">
                  <span className="text-[#8e9297]">Highest Faithfulness:</span>
                  <span className="font-bold text-white">
                    {ragasEngineStats.dense.faithfulness >= ragasEngineStats.sparse.faithfulness &&
                    ragasEngineStats.dense.faithfulness >= ragasEngineStats.hybrid.faithfulness
                      ? `Dense (${ragasEngineStats.dense.faithfulness.toFixed(1)}%)`
                      : ragasEngineStats.sparse.faithfulness >= ragasEngineStats.hybrid.faithfulness
                      ? `Sparse (${ragasEngineStats.sparse.faithfulness.toFixed(1)}%)`
                      : `Hybrid (${ragasEngineStats.hybrid.faithfulness.toFixed(1)}%)`}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-[#181b1f]">
                  <span className="text-[#8e9297]">Highest Answer Relevance:</span>
                  <span className="font-bold text-white">
                    {ragasEngineStats.hybrid.answerRelevance >= ragasEngineStats.dense.answerRelevance &&
                    ragasEngineStats.hybrid.answerRelevance >= ragasEngineStats.sparse.answerRelevance
                      ? `Hybrid (${ragasEngineStats.hybrid.answerRelevance.toFixed(1)}%)`
                      : ragasEngineStats.dense.answerRelevance >= ragasEngineStats.sparse.answerRelevance
                      ? `Dense (${ragasEngineStats.dense.answerRelevance.toFixed(1)}%)`
                      : `Sparse (${ragasEngineStats.sparse.answerRelevance.toFixed(1)}%)`}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-[#181b1f]">
                  <span className="text-[#8e9297]">Highest Context Precision:</span>
                  <span className="font-bold text-[#5794f2]">
                    {ragasEngineStats.dense.contextPrecision >= ragasEngineStats.hybrid.contextPrecision &&
                    ragasEngineStats.dense.contextPrecision >= ragasEngineStats.sparse.contextPrecision
                      ? `Dense (${ragasEngineStats.dense.contextPrecision.toFixed(1)}%)`
                      : ragasEngineStats.hybrid.contextPrecision >= ragasEngineStats.sparse.contextPrecision
                      ? `Hybrid (${ragasEngineStats.hybrid.contextPrecision.toFixed(1)}%)`
                      : `Sparse (${ragasEngineStats.sparse.contextPrecision.toFixed(1)}%)`}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-[#181b1f]">
                  <span className="text-[#8e9297]">Overall RAGAS Winner:</span>
                  <span className="font-bold text-[#73bf69]">
                    {ragasEngineStats.dense.composite >= ragasEngineStats.hybrid.composite &&
                    ragasEngineStats.dense.composite >= ragasEngineStats.sparse.composite
                      ? `Dense (${ragasEngineStats.dense.composite.toFixed(1)}%)`
                      : ragasEngineStats.hybrid.composite >= ragasEngineStats.sparse.composite
                      ? `Hybrid (${ragasEngineStats.hybrid.composite.toFixed(1)}%)`
                      : `Sparse (${ragasEngineStats.sparse.composite.toFixed(1)}%)`}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Complexity Breakdown Matrix (Easy vs Medium vs Hard) */}
          <section className="bg-[#111217] border border-[#22252b] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#b877d9]" />
                <span className="font-mono font-bold text-xs uppercase text-white tracking-wider">
                  RAGAS Metric Performance by Scenario Complexity
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#8e9297]">
                Evaluates Hallucination & Relevance Across Multi-Hop Difficulties
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["easy", "medium", "hard"] as const).map((diff) => {
                const diffLabel = diff.toUpperCase()
                const badgeColor =
                  diff === "easy"
                    ? "text-[#4ade80] bg-[#14532d]/40 border-[#22c55e]/30"
                    : diff === "medium"
                    ? "text-[#fbbf24] bg-[#78350f]/40 border-[#f59e0b]/30"
                    : "text-[#f87171] bg-[#7f1d1d]/40 border-[#ef4444]/30"

                return (
                  <div
                    key={diff}
                    className="bg-[#141619] border border-[#22252b] rounded-lg p-4 space-y-3 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between border-b border-[#22252b] pb-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${badgeColor}`}>
                        {diffLabel} SCENARIOS
                      </span>
                      <span className="text-[10px] text-[#8e9297]">Faith / Ctx Precision</span>
                    </div>

                    <div className="space-y-3 pt-1">
                      {["sparse", "dense", "hybrid"].map((m) => {
                        const theme = METHOD_THEMES[m]
                        const st = ragasDifficultyStats[diff]?.[m] ?? { faith: 0, rel: 0, prec: 0, rec: 0, comp: 0 }
                        return (
                          <div key={m} className="space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span className={theme.text}>{theme.label}</span>
                              <span className="text-white font-bold">
                                F: {st.faith.toFixed(1)}% | CP: {st.prec.toFixed(1)}%
                              </span>
                            </div>
                            <div className="flex gap-1 h-2 w-full bg-[#1e2228] rounded-full overflow-hidden">
                              <div
                                className={`${theme.bar} transition-all duration-500`}
                                style={{ width: `${Math.min(50, st.faith / 2)}%` }}
                                title={`Faithfulness: ${st.faith.toFixed(1)}%`}
                              />
                              <div
                                className={`${theme.bar} opacity-60 transition-all duration-500`}
                                style={{ width: `${Math.min(50, st.prec / 2)}%` }}
                                title={`Context Precision: ${st.prec.toFixed(1)}%`}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* RAGAS Comparative Matrix (Table View) */}
          <section className="bg-[#141619] border border-[#22252b] rounded-lg shadow-md overflow-hidden">
            <div className="px-5 py-3.5 bg-[#181b1f] border-b border-[#22252b] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#b877d9]" />
                <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-white">
                  RAGAS Triad Evaluation Summary Matrix
                </h2>
              </div>
              <span className="text-[11px] font-mono text-[#8e9297]">
                LLM Judge: gpt-4o-mini
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#111217] text-[#8e9297] uppercase text-[10px] tracking-wider border-b border-[#22252b]">
                  <tr>
                    <ThTip label="Engine Method" tip={METRIC_TOOLTIPS.engineMethod} />
                    <ThTip label="Evaluated (N)" tip={METRIC_TOOLTIPS.evaluated} />
                    <ThTip label="Faithfulness" tip={METRIC_TOOLTIPS.faithfulness} />
                    <ThTip label="Answer Relevance" tip={METRIC_TOOLTIPS.answerRelevance} />
                    <ThTip label="Context Precision" tip={METRIC_TOOLTIPS.contextPrecision} />
                    <ThTip label="Context Recall" tip={METRIC_TOOLTIPS.contextRecall} />
                    <ThTip label="Composite Score" tip={METRIC_TOOLTIPS.composite} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2228]">
                  {["sparse", "dense", "hybrid"].map((method) => {
                    const theme = METHOD_THEMES[method]
                    const st = (ragasEngineStats as any)[method]
                    return (
                      <tr key={method} className="hover:bg-[#181b1f] transition">
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              theme?.badge ?? "bg-gray-800 text-gray-300"
                            }`}
                          >
                            {theme?.label ?? method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white font-semibold">{st.count}</td>
                        <td className="px-4 py-3 text-[#73bf69] font-bold">
                          {st.faithfulness.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-[#ff9900] font-bold">
                          {st.answerRelevance.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-[#5794f2] font-bold">
                          {st.contextPrecision.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-[#b877d9] font-bold">
                          {st.contextRecall.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-white font-bold">
                          <span className="px-2 py-0.5 rounded bg-[#1f2328] border border-[#2b3036]">
                            {st.composite.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* RAGAS Detailed Evaluation Log Stream */}
          <section className="bg-[#141619] border border-[#22252b] rounded-lg shadow-md overflow-hidden">
            <div className="px-5 py-3.5 bg-[#181b1f] border-b border-[#22252b] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#b877d9]" />
                  <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-white">
                    Evaluated Scenario Logs ({filteredRagasLogs.length} / {ragasLogs.length})
                  </h2>
                </div>
              </div>

              {/* Filter controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setIsCopyModalOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono border transition shadow-sm ${
                    copiedRagasCsv
                      ? "bg-[#14532d] text-[#4ade80] border-[#22c55e]"
                      : "bg-[#202328] hover:bg-[#2b3038] text-[#c7d0d9] hover:text-white border-[#333842]"
                  }`}
                  title="Configure and copy RAGAS evaluation logs as CSV"
                >
                  {copiedRagasCsv ? (
                    <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#b877d9]" />
                  )}
                  <span>{copiedRagasCsv ? "Copied CSV!" : "Copy as CSV..."}</span>
                </button>

                <button
                  onClick={() => {
                    const unAudited = filteredRagasLogs
                      .filter((l) => !l.ragasEvaluation?.faithfulnessReasoning)
                      .slice(0, 10)
                      .map((l) => l.id)
                    auditBatchLogs(unAudited)
                  }}
                  disabled={
                    isBatchAuditing ||
                    filteredRagasLogs.every((l) => Boolean(l.ragasEvaluation?.faithfulnessReasoning))
                  }
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono border transition shadow-sm ${
                    isBatchAuditing
                      ? "bg-[#271536] text-[#b877d9] border-[#b877d9]/40 cursor-wait"
                      : filteredRagasLogs.every((l) => Boolean(l.ragasEvaluation?.faithfulnessReasoning))
                      ? "bg-[#1f2328] text-[#555a64] border-[#2b3036] cursor-not-allowed opacity-60"
                      : "bg-[#271536] hover:bg-[#391d4e] text-[#d69eff] hover:text-white border-[#b877d9]/60 shadow-[0_0_10px_rgba(184,119,217,0.2)]"
                  }`}
                  title="Run LLM Judge Forensic Audit on up to 10 un-audited logs in current view"
                >
                  {isBatchAuditing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b877d9]" />
                  ) : (
                    <Scale className="w-3.5 h-3.5 text-[#b877d9]" />
                  )}
                  <span>
                    {isBatchAuditing
                      ? "Auditing..."
                      : filteredRagasLogs.every((l) => Boolean(l.ragasEvaluation?.faithfulnessReasoning))
                      ? "All Audited"
                      : "Audit Batch (LLM)"}
                  </span>
                </button>

                <button
                  onClick={runRagasPipeline}
                  disabled={isRunningRagas}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono border transition shadow-sm ${
                    isRunningRagas
                      ? "bg-[#182338] text-[#5794f2] border-[#5794f2]/40 cursor-wait"
                      : "bg-[#182338] hover:bg-[#203152] text-[#5794f2] hover:text-white border-[#5794f2]/50 shadow-[0_0_10px_rgba(87,148,242,0.2)]"
                  }`}
                  title="Execute RAGAS evaluation pipeline on un-evaluated interaction logs"
                >
                  {isRunningRagas ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5794f2]" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-[#5794f2]" />
                  )}
                  <span>{isRunningRagas ? "Evaluating RAGAS..." : "Run RAGAS Pipeline"}</span>
                </button>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#8e9297] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search prompt, answer, case..."
                    value={ragasSearchFilter}
                    onChange={(e) => setRagasSearchFilter(e.target.value)}
                    className="pl-8 pr-3 py-1 rounded bg-[#181b1f] border border-[#2b3036] text-xs font-mono text-white placeholder-[#555] focus:outline-none focus:border-[#b877d9] w-48 transition"
                  />
                </div>

                <select
                  value={ragasMethodFilter}
                  onChange={(e) => setRagasMethodFilter(e.target.value)}
                  className="px-2.5 py-1 rounded bg-[#181b1f] border border-[#2b3036] text-xs font-mono text-[#c7d0d9] focus:outline-none focus:border-[#b877d9] transition"
                >
                  <option value="all">All Engines</option>
                  <option value="sparse">Sparse (BM25)</option>
                  <option value="dense">Dense (HNSW)</option>
                  <option value="hybrid">Hybrid (RRF)</option>
                </select>

                <select
                  value={ragasDifficultyFilter}
                  onChange={(e) => setRagasDifficultyFilter(e.target.value)}
                  className="px-2.5 py-1 rounded bg-[#181b1f] border border-[#2b3036] text-xs font-mono text-[#c7d0d9] focus:outline-none focus:border-[#b877d9] transition"
                >
                  <option value="all">All Difficulties</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="bg-[#111217] text-[#8e9297] uppercase text-[10px] tracking-wider border-b border-[#22252b] sticky top-0 z-10">
                  <tr>
                    <ThTip label="Engine" tip={METRIC_TOOLTIPS.engine} />
                    <ThTip label="Case" tip={METRIC_TOOLTIPS.targetCase} />
                    <ThTip label="Difficulty" tip={METRIC_TOOLTIPS.difficulty} />
                    <ThTip label="Prompt Inquiry" tip={METRIC_TOOLTIPS.promptInquiry} />
                    <ThTip label="Faithfulness" tip={METRIC_TOOLTIPS.faithfulness} />
                    <ThTip label="Answer Relevance" tip={METRIC_TOOLTIPS.answerRelevance} />
                    <ThTip label="Context Precision" tip={METRIC_TOOLTIPS.contextPrecision} />
                    <ThTip label="Context Recall" tip={METRIC_TOOLTIPS.contextRecall} />
                    <ThTip label="Composite" tip={METRIC_TOOLTIPS.composite} />
                    <th className="px-4 py-2.5 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2228]">
                  {filteredRagasLogs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-[#8e9297]">
                        No RAGAS evaluation logs found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRagasLogs.map((r) => {
                      const theme = METHOD_THEMES[r.retrievalMethod]
                      const isExpanded = expandedRagasLogId === r.id
                      const e = r.ragasEvaluation
                      const faith = e?.faithfulness ?? 0
                      const rel = e?.answerRelevance ?? 0
                      const prec = e?.contextPrecision ?? 0
                      const rec = e?.contextRecall ?? 0
                      const comp = (faith + rel + prec + rec) / 4

                      return (
                        <Fragment key={r.id}>
                          <tr
                            onClick={() => setExpandedRagasLogId(isExpanded ? null : r.id)}
                            className={`cursor-pointer transition ${
                              isExpanded ? "bg-[#181b1f]" : "hover:bg-[#15171b]"
                            }`}
                          >
                            <td className="px-4 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  theme?.badge ?? "bg-gray-800 text-gray-300"
                                }`}
                              >
                                {r.retrievalMethod}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-white truncate max-w-[140px]">
                              {r.scenario?.case?.title ?? "Nexus Data Breach"}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                  r.scenario?.difficulty === "easy"
                                    ? "bg-[#14532d]/40 text-[#4ade80] border border-[#22c55e]/30"
                                    : r.scenario?.difficulty === "medium"
                                    ? "bg-[#78350f]/40 text-[#fbbf24] border border-[#f59e0b]/30"
                                    : "bg-[#7f1d1d]/40 text-[#f87171] border border-[#ef4444]/30"
                                }`}
                              >
                                {r.scenario?.difficulty ?? "N/A"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[#c7d0d9] max-w-[280px] truncate" title={r.userPrompt}>
                              {r.userPrompt}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  faith >= 0.8
                                    ? "bg-[#14532d]/50 text-[#4ade80]"
                                    : faith >= 0.5
                                    ? "bg-[#78350f]/50 text-[#fbbf24]"
                                    : "bg-[#7f1d1d]/50 text-[#f87171]"
                                }`}
                              >
                                {(faith * 100).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  rel >= 0.8
                                    ? "bg-[#14532d]/50 text-[#4ade80]"
                                    : rel >= 0.3
                                    ? "bg-[#78350f]/50 text-[#fbbf24]"
                                    : "bg-[#7f1d1d]/50 text-[#f87171]"
                                }`}
                              >
                                {(rel * 100).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  prec >= 0.8
                                    ? "bg-[#14532d]/50 text-[#4ade80]"
                                    : prec >= 0.5
                                    ? "bg-[#78350f]/50 text-[#fbbf24]"
                                    : "bg-[#7f1d1d]/50 text-[#f87171]"
                                }`}
                              >
                                {(prec * 100).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  rec >= 0.8
                                    ? "bg-[#14532d]/50 text-[#4ade80]"
                                    : rec >= 0.4
                                    ? "bg-[#78350f]/50 text-[#fbbf24]"
                                    : "bg-[#7f1d1d]/50 text-[#f87171]"
                                }`}
                              >
                                {(rec * 100).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-bold text-white">
                              <span className="px-2 py-0.5 rounded bg-[#1f2328] border border-[#2b3036]">
                                {(comp * 100).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation()
                                  setExpandedRagasLogId(isExpanded ? null : r.id)
                                }}
                                className="p-1 rounded hover:bg-[#202328] text-[#8e9297] hover:text-white transition"
                                title="Inspect evaluation drawer"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-[#b877d9]" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded RAGAS Inspection Drawer */}
                          {isExpanded && (
                            <tr className="bg-[#0f1013]">
                              <td colSpan={10} className="px-6 py-4 border-b border-[#22252b]">
                                <div className="space-y-4">
                                  {/* Metric Score Cards */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
                                    <div className="p-3 rounded bg-[#181b1f] border border-[#73bf69]/30">
                                      <div className="text-[10px] uppercase text-[#73bf69] font-bold">
                                        Faithfulness
                                      </div>
                                      <div className="text-xl font-bold text-white my-1">
                                        {(faith * 100).toFixed(2)}%
                                      </div>
                                      <div className="text-[10px] text-[#8e9297]">
                                        Factual agreement with retrieved context
                                      </div>
                                    </div>
                                    <div className="p-3 rounded bg-[#181b1f] border border-[#ff9900]/30">
                                      <div className="text-[10px] uppercase text-[#ff9900] font-bold">
                                        Answer Relevance
                                      </div>
                                      <div className="text-xl font-bold text-white my-1">
                                        {(rel * 100).toFixed(2)}%
                                      </div>
                                      <div className="text-[10px] text-[#8e9297]">
                                        Pertinence & responsiveness to prompt
                                      </div>
                                    </div>
                                    <div className="p-3 rounded bg-[#181b1f] border border-[#5794f2]/30">
                                      <div className="text-[10px] uppercase text-[#5794f2] font-bold">
                                        Context Precision
                                      </div>
                                      <div className="text-xl font-bold text-white my-1">
                                        {(prec * 100).toFixed(2)}%
                                      </div>
                                      <div className="text-[10px] text-[#8e9297]">
                                        Signal-to-noise ranking of relevant chunks
                                      </div>
                                    </div>
                                    <div className="p-3 rounded bg-[#181b1f] border border-[#b877d9]/30">
                                      <div className="text-[10px] uppercase text-[#b877d9] font-bold">
                                        Context Recall
                                      </div>
                                      <div className="text-xl font-bold text-white my-1">
                                        {(rec * 100).toFixed(2)}%
                                      </div>
                                      <div className="text-[10px] text-[#8e9297]">
                                        Recall of required ground truth facts
                                      </div>
                                    </div>
                                  </div>

                                  {/* LLM Judge Score Rationale & Variable Breakdown */}
                                  <div className="rounded-lg bg-[#14161a] border border-[#262a33] p-4 space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#22252b] pb-3">
                                      <div className="flex items-center gap-2">
                                        <Scale className="w-4 h-4 text-[#b877d9]" />
                                        <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-white">
                                          LLM Judge Score Rationale & Variable Breakdown
                                        </h3>
                                        {e?.faithfulnessReasoning ? (
                                          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-[#14532d]/40 text-[#4ade80] border border-[#22c55e]/30">
                                            <Sparkles className="w-3 h-3 text-[#4ade80]" />
                                            Verified Forensic Audit
                                          </span>
                                        ) : (
                                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#202328] text-[#8e9297] border border-[#333842]">
                                            Heuristic Rationale
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2">
                                        <button
                                          onClick={(ev) => {
                                            ev.stopPropagation()
                                            copyLogAsMarkdown(r)
                                          }}
                                          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono border transition shadow-sm ${
                                            copiedLogId === r.id
                                              ? "bg-[#14532d] text-[#4ade80] border-[#22c55e]"
                                              : "bg-[#1f2328] hover:bg-[#2b3036] text-[#c7d0d9] hover:text-white border-[#333842]"
                                          }`}
                                          title="Copy complete log detail and RAGAS metrics as Markdown"
                                        >
                                          {copiedLogId === r.id ? (
                                            <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5 text-[#5794f2]" />
                                          )}
                                          <span className={copiedLogId === r.id ? "font-bold text-[#4ade80]" : ""}>
                                            {copiedLogId === r.id ? "Copied Markdown!" : "Copy as Markdown"}
                                          </span>
                                        </button>

                                        <button
                                          onClick={(ev) => {
                                            ev.stopPropagation()
                                            auditScenarioLog(r.id)
                                          }}
                                          disabled={auditingLogIds[r.id]}
                                          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono border transition shadow-sm ${
                                            auditingLogIds[r.id]
                                              ? "bg-[#271536] text-[#b877d9] border-[#b877d9]/40 cursor-wait"
                                              : e?.faithfulnessReasoning
                                              ? "bg-[#1f2328] hover:bg-[#2b3036] text-[#c7d0d9] hover:text-white border-[#333842]"
                                              : "bg-[#271536] hover:bg-[#391d4e] text-[#d69eff] hover:text-white border-[#b877d9]/60 shadow-[0_0_12px_rgba(184,119,217,0.25)]"
                                          }`}
                                          title="Request GPT-4o-mini to perform forensic audit explaining each score"
                                        >
                                          {auditingLogIds[r.id] ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b877d9]" />
                                              <span>Auditing Reasoning...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Sparkles className="w-3.5 h-3.5 text-[#b877d9]" />
                                              <span>
                                                {e?.faithfulnessReasoning
                                                  ? "Re-Audit with AI Judge"
                                                  : "Run Forensic AI Judge Audit"}
                                              </span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>

                                    {/* 4-Variable Reasoning Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                      {/* 1. Faithfulness Reasoning */}
                                      <div className="rounded-lg bg-[#0d0e11] border border-[#73bf69]/30 p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#73bf69]">
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            <span>Faithfulness Score: {(faith * 100).toFixed(1)}%</span>
                                          </div>
                                          <span className="text-[10px] font-mono text-[#8e9297]">
                                            {faith >= 0.8
                                              ? "Zero Hallucinations"
                                              : faith >= 0.5
                                              ? "Partial Support"
                                              : "High Hallucination"}
                                          </span>
                                        </div>
                                        <p className="text-xs text-[#c7d0d9] leading-relaxed font-sans select-text">
                                          {e?.faithfulnessReasoning || (
                                            faith >= 0.8
                                              ? "All factual assertions in the deduction strictly aligned with retrieved evidence chunks. No ungrounded claims or hallucinated alibis were detected."
                                              : faith >= 0.5
                                              ? "Partial factual grounding. Core conclusions matched context, but secondary inferences lacked explicit supporting citations."
                                              : "Low faithfulness score indicates unsupported speculation or fabricated details not corroborated by retrieved case documents."
                                          )}
                                        </p>
                                      </div>

                                      {/* 2. Answer Relevance Reasoning */}
                                      <div className="rounded-lg bg-[#0d0e11] border border-[#ff9900]/30 p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#ff9900]">
                                            <Target className="w-3.5 h-3.5" />
                                            <span>Answer Relevance Score: {(rel * 100).toFixed(1)}%</span>
                                          </div>
                                          <span className="text-[10px] font-mono text-[#8e9297]">
                                            {rel >= 0.8
                                              ? "Directly Responsive"
                                              : rel >= 0.3
                                              ? "Partially Responsive"
                                              : "Deflected / Incomplete"}
                                          </span>
                                        </div>
                                        <p className="text-xs text-[#c7d0d9] leading-relaxed font-sans select-text">
                                          {e?.answerRelevanceReasoning || (
                                            rel >= 0.8
                                              ? "Directly responsive. The AI answered the precise investigative lead without evasive qualifiers or non-responsive preamble."
                                              : rel >= 0.3
                                              ? "Moderate relevance. The deduction mentioned relevant suspects or telemetry but did not fully resolve the primary question asked."
                                              : "Low relevance. The AI deduction failed to identify requested targets, stated lack of evidence, or veered away from the prompt inquiry."
                                          )}
                                        </p>
                                      </div>

                                      {/* 3. Context Precision Reasoning */}
                                      <div className="rounded-lg bg-[#0d0e11] border border-[#5794f2]/30 p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#5794f2]">
                                            <SlidersHorizontal className="w-3.5 h-3.5" />
                                            <span>Context Precision Score: {(prec * 100).toFixed(1)}%</span>
                                          </div>
                                          <span className="text-[10px] font-mono text-[#8e9297]">
                                            {prec >= 0.8
                                              ? "High Signal Density"
                                              : prec >= 0.4
                                              ? "Moderate Precision"
                                              : "Distractor Clutter"}
                                          </span>
                                        </div>
                                        <p className="text-xs text-[#c7d0d9] leading-relaxed font-sans select-text">
                                          {e?.contextPrecisionReasoning || (
                                            prec >= 0.8
                                              ? "Optimal ranking quality. Critical ground-truth evidence chunks were ranked at the very top (rank 1-2) with minimal noise."
                                              : prec >= 0.4
                                              ? "Moderate precision. Relevant evidence was retrieved but diluted below several non-essential or distractor chunks."
                                              : "Poor signal-to-noise ratio. The search engine retrieved mostly unrelated documents, burying the smoking gun evidence."
                                          )}
                                        </p>
                                      </div>

                                      {/* 4. Context Recall Reasoning */}
                                      <div className="rounded-lg bg-[#0d0e11] border border-[#b877d9]/30 p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#b877d9]">
                                            <Layers className="w-3.5 h-3.5" />
                                            <span>Context Recall Score: {(rec * 100).toFixed(1)}%</span>
                                          </div>
                                          <span className="text-[10px] font-mono text-[#8e9297]">
                                            {rec >= 0.8
                                              ? "Complete Coverage"
                                              : rec >= 0.4
                                              ? "Partial Clues"
                                              : "Missing Ground Truth"}
                                          </span>
                                        </div>
                                        <p className="text-xs text-[#c7d0d9] leading-relaxed font-sans select-text">
                                          {e?.contextRecallReasoning || (
                                            rec >= 0.8
                                              ? "Comprehensive evidence coverage. The retrieved context contained all ground-truth facts required to formulate a complete deduction."
                                              : rec >= 0.4
                                              ? "Partial evidence coverage. Some scenario clues were retrieved, but critical corroborating facts remained missing."
                                              : "Low recall. Key ground-truth clues required by the scenario were completely missed by the retrieval engine."
                                          )}
                                        </p>
                                      </div>
                                    </div>

                                    {/* Critique / Architectural Diagnosis */}
                                    {e?.critique && (
                                      <div className="p-3 rounded-lg bg-[#181b1f] border border-[#383e4a] space-y-1.5">
                                        <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-white uppercase tracking-wider">
                                          <BrainCircuit className="w-3.5 h-3.5 text-[#b877d9]" />
                                          <span>Judge Forensic Verdict & Engineering Critique:</span>
                                        </div>
                                        <p className="text-xs text-[#d8d9da] leading-relaxed font-sans select-text">
                                          {e.critique}
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Ground Truth Reference Facts (if available) */}
                                  {(r.scenario?.referenceAnswer || r.scenario?.notes) && (
                                    <div className="space-y-1">
                                      <div className="text-[11px] font-mono font-bold uppercase text-[#fade2a]">
                                        Scenario Ground Truth Reference (Benchmark Standard):
                                      </div>
                                      <div className="p-2.5 rounded bg-[#181b1f] border border-[#fade2a]/30 text-[#e0e0e0] text-xs font-mono select-text">
                                        {r.scenario?.referenceAnswer || r.scenario?.notes}
                                      </div>
                                    </div>
                                  )}

                                  {/* Prompt */}
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-mono font-bold uppercase text-[#8e9297]">
                                      Investigation Prompt Inquiry:
                                    </div>
                                    <div className="p-2.5 rounded bg-[#181b1f] border border-[#262930] text-[#d8d9da] text-xs font-mono select-text">
                                      {r.userPrompt}
                                    </div>
                                  </div>

                                  {/* AI Response */}
                                  {r.aiResponse && (
                                    <div className="space-y-1">
                                      <div className="text-[11px] font-mono font-bold uppercase text-[#73bf69]">AI Response (gpt-5.6-luna):</div>
                                      <div className="p-3 rounded bg-[#181b1f] border border-[#73bf69]/30 select-text">
                                        <MarkdownResponse content={r.aiResponse} variant="eval" />
                                      </div>
                                    </div>
                                  )}

                                  {/* Retrieved Contexts */}
                                  {r.retrievedContext && (
                                    <div className="space-y-1">
                                      <div className="text-[11px] font-mono font-bold uppercase text-[#5794f2]">
                                        Retrieved Context Chunks Provided to LLM:
                                      </div>
                                      <pre className="p-2.5 rounded bg-[#111217] border border-[#262930] text-[#8e9297] text-[11px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto select-text">
                                        {r.retrievedContext}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      </div>
    </div>

    {/* Custom Floating Instant Tooltip */}
    {activeTooltip && (
      <div
        className="fixed z-[9999] pointer-events-none transition-all duration-75 ease-out animate-in fade-in zoom-in-95"
        style={{
          left: `${activeTooltip.x}px`,
          top: activeTooltip.placeAbove ? "auto" : `${activeTooltip.y}px`,
          bottom: activeTooltip.placeAbove ? `${window.innerHeight - activeTooltip.y}px` : "auto",
          width: "320px",
        }}
      >
        <div className="bg-[#14161a]/95 backdrop-blur-md border border-[#383e4a] rounded-lg shadow-2xl shadow-black/80 p-3.5 text-left font-sans">
          {/* Header with Title & Category Badge */}
          <div className="flex items-center justify-between gap-2 border-b border-[#22252b] pb-2">
            <span className="font-mono font-bold text-xs text-white tracking-wide">
              {activeTooltip.data.title}
            </span>
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border shrink-0 ${activeTooltip.data.badgeColor}`}
            >
              {activeTooltip.data.badge}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-[#c7d0d9] leading-relaxed mt-2 font-normal whitespace-pre-line">
            {activeTooltip.data.description}
          </p>

          {/* Formula Box (if present) */}
          {activeTooltip.data.formula && (
            <div className="mt-2.5 px-2.5 py-1.5 rounded bg-[#0d0e11] border border-[#262a33]">
              <div className="text-[9px] uppercase tracking-wider text-[#8e9297] font-mono font-semibold mb-0.5">
                Formula / Definition
              </div>
              <div className="text-[#fade2a] font-mono text-[11px] break-words">
                {activeTooltip.data.formula}
              </div>
            </div>
          )}

          {/* Takeaway / Rule of Thumb (if present) */}
          {activeTooltip.data.takeaway && (
            <div className="mt-2 flex items-start gap-1.5 text-[11px] text-[#73bf69] font-mono leading-tight">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#73bf69]" />
              <span>{activeTooltip.data.takeaway}</span>
            </div>
          )}
        </div>
      </div>
    )}

    {/* RAGAS CSV Export / Copy Configuration Modal */}
    {isCopyModalOpen && (
      <div
        className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsCopyModalOpen(false)
        }}
      >
        <div className="bg-[#14161a] border border-[#2e333d] rounded-xl shadow-2xl shadow-black/90 max-w-md w-full p-5 space-y-5 font-sans animate-in zoom-in-95 duration-150">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-[#22252b] pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#271536] border border-[#b877d9]/40 flex items-center justify-center text-[#b877d9]">
                <Copy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-mono font-bold text-sm text-white">
                  Copy RAGAS Telemetry (CSV)
                </h3>
                <p className="text-[11px] text-[#8e9297] font-mono">
                  Select volume or specify custom log count
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCopyModalOpen(false)}
              className="p-1 rounded-md hover:bg-[#202328] text-[#8e9297] hover:text-white transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scope / Filter Info */}
          <div className="p-2.5 rounded-lg bg-[#181b1f] border border-[#262930] flex items-center justify-between text-xs font-mono">
            <span className="text-[#8e9297]">Available Filtered Logs:</span>
            <span className="font-bold text-white px-2 py-0.5 rounded bg-[#202328] border border-[#333842]">
              {filteredRagasLogs.length} records
            </span>
          </div>

          {/* Selection Mode Controls */}
          <div className="space-y-3">
            <label className="block text-xs font-mono font-semibold uppercase text-[#8e9297] tracking-wider">
              Export Quantity:
            </label>

            {/* Option A: Copy All */}
            <div
              onClick={() => setCopySelectionMode("all")}
              className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                copySelectionMode === "all"
                  ? "bg-[#271536]/40 border-[#b877d9] text-white"
                  : "bg-[#181b1f] border-[#262930] hover:border-[#383e4a] text-[#c7d0d9]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    copySelectionMode === "all"
                      ? "border-[#b877d9] bg-[#b877d9]"
                      : "border-[#4f5562]"
                  }`}
                >
                  {copySelectionMode === "all" && (
                    <div className="w-1.5 h-1.5 rounded-full bg-black" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-mono font-bold">
                    Copy All Matching Records
                  </div>
                  <div className="text-[11px] text-[#8e9297]">
                    Entire filtered dataset ({filteredRagasLogs.length} logs)
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1f2328] border border-[#333842] text-[#fade2a] font-bold">
                {filteredRagasLogs.length} logs
              </span>
            </div>

            {/* Option B: Custom / Limit Count */}
            <div
              onClick={() => setCopySelectionMode("custom")}
              className={`p-3 rounded-lg border cursor-pointer transition space-y-2.5 ${
                copySelectionMode === "custom"
                  ? "bg-[#182338]/40 border-[#5794f2] text-white"
                  : "bg-[#181b1f] border-[#262930] hover:border-[#383e4a] text-[#c7d0d9]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      copySelectionMode === "custom"
                        ? "border-[#5794f2] bg-[#5794f2]"
                        : "border-[#4f5562]"
                    }`}
                  >
                    {copySelectionMode === "custom" && (
                      <div className="w-1.5 h-1.5 rounded-full bg-black" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold">
                      Specify Number of Logs
                    </div>
                    <div className="text-[11px] text-[#8e9297]">
                      Copies the latest N records from the view
                    </div>
                  </div>
                </div>

                {/* Number Input Field */}
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    min={1}
                    max={filteredRagasLogs.length || 1}
                    value={copyCustomNumber}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      setCopyCustomNumber(isNaN(val) ? 1 : Math.min(Math.max(1, val), filteredRagasLogs.length))
                      setCopySelectionMode("custom")
                    }}
                    onFocus={() => setCopySelectionMode("custom")}
                    className="w-20 px-2.5 py-1 text-center rounded bg-[#111217] border border-[#383e4a] text-xs font-mono text-white focus:outline-none focus:border-[#5794f2]"
                  />
                  <span className="text-[11px] font-mono text-[#8e9297]">logs</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="pt-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <span className="text-[10px] uppercase font-mono text-[#8e9297] mr-1">Quick:</span>
                {[5, 10, 25, 50].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setCopyCustomNumber(Math.min(preset, filteredRagasLogs.length))
                      setCopySelectionMode("custom")
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                      copySelectionMode === "custom" && copyCustomNumber === Math.min(preset, filteredRagasLogs.length)
                        ? "bg-[#1f2f4d] text-[#5794f2] border-[#5794f2]"
                        : "bg-[#202328] hover:bg-[#2b3038] text-[#c7d0d9] border-[#333842]"
                    }`}
                  >
                    Top {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Included Fields Checklist / Summary */}
          <div className="p-2.5 rounded bg-[#0d0e11] border border-[#22252b] text-[11px] font-mono text-[#8e9297] space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#c7d0d9]">Included in CSV output:</div>
            <div className="text-[10px] text-[#8e9297] leading-relaxed">
              ID, Timestamp, Engine, Case, Difficulty, Prompt, Faithfulness, Relevance, Precision, Recall, Composite Score, and Judge Forensic Reasoning.
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setIsCopyModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-mono bg-[#1f2328] hover:bg-[#2b3036] text-[#c7d0d9] hover:text-white border border-[#333842] transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => {
                const effective = copySelectionMode === "all" ? "all" : copyCustomNumber
                copyRagasAsCsv(effective)
              }}
              disabled={filteredRagasLogs.length === 0}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition shadow-md ${
                copiedFeedbackCount !== null
                  ? "bg-[#14532d] text-[#4ade80] border border-[#22c55e]"
                  : "bg-[#271536] hover:bg-[#391d4e] text-[#d69eff] hover:text-white border border-[#b877d9]/60 shadow-[0_0_15px_rgba(184,119,217,0.3)]"
              }`}
            >
              {copiedFeedbackCount !== null ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                  <span>Copied {copiedFeedbackCount} Logs!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#b877d9]" />
                  <span>
                    Copy {copySelectionMode === "all" ? `All (${filteredRagasLogs.length})` : `${copyCustomNumber}`} Logs as CSV
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* RAG Telemetry CSV Export / Copy Configuration Modal */}
    {isTelemetryCopyModalOpen && (
      <div
        className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsTelemetryCopyModalOpen(false)
        }}
      >
        <div className="bg-[#14161a] border border-[#2e333d] rounded-xl shadow-2xl shadow-black/90 max-w-md w-full p-5 space-y-5 font-sans animate-in zoom-in-95 duration-150">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-[#22252b] pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#182338] border border-[#5794f2]/40 flex items-center justify-center text-[#5794f2]">
                <Copy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-mono font-bold text-sm text-white">
                  Copy RAG Telemetry (CSV)
                </h3>
                <p className="text-[11px] text-[#8e9297] font-mono">
                  Select volume or specify custom log count
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsTelemetryCopyModalOpen(false)}
              className="p-1 rounded-md hover:bg-[#202328] text-[#8e9297] hover:text-white transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scope / Filter Info */}
          <div className="p-2.5 rounded-lg bg-[#181b1f] border border-[#262930] flex items-center justify-between text-xs font-mono">
            <span className="text-[#8e9297]">Available Filtered Logs:</span>
            <span className="font-bold text-white px-2 py-0.5 rounded bg-[#202328] border border-[#333842]">
              {filteredRecent.length} records
            </span>
          </div>

          {/* Selection Mode Controls */}
          <div className="space-y-3">
            <label className="block text-xs font-mono font-semibold uppercase text-[#8e9297] tracking-wider">
              Export Quantity:
            </label>

            {/* Option A: Copy All */}
            <div
              onClick={() => setTelemetryCopySelectionMode("all")}
              className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                telemetryCopySelectionMode === "all"
                  ? "bg-[#182338]/40 border-[#5794f2] text-white"
                  : "bg-[#181b1f] border-[#262930] hover:border-[#383e4a] text-[#c7d0d9]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    telemetryCopySelectionMode === "all"
                      ? "border-[#5794f2] bg-[#5794f2]"
                      : "border-[#4f5562]"
                  }`}
                >
                  {telemetryCopySelectionMode === "all" && (
                    <div className="w-1.5 h-1.5 rounded-full bg-black" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-mono font-bold">
                    Copy All Matching Records
                  </div>
                  <div className="text-[11px] text-[#8e9297]">
                    Entire filtered dataset ({filteredRecent.length} logs)
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1f2328] border border-[#333842] text-[#fade2a] font-bold">
                {filteredRecent.length} logs
              </span>
            </div>

            {/* Option B: Custom / Limit Count */}
            <div
              onClick={() => setTelemetryCopySelectionMode("custom")}
              className={`p-3 rounded-lg border cursor-pointer transition space-y-2.5 ${
                telemetryCopySelectionMode === "custom"
                  ? "bg-[#182338]/40 border-[#5794f2] text-white"
                  : "bg-[#181b1f] border-[#262930] hover:border-[#383e4a] text-[#c7d0d9]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      telemetryCopySelectionMode === "custom"
                        ? "border-[#5794f2] bg-[#5794f2]"
                        : "border-[#4f5562]"
                    }`}
                  >
                    {telemetryCopySelectionMode === "custom" && (
                      <div className="w-1.5 h-1.5 rounded-full bg-black" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold">
                      Specify Number of Logs
                    </div>
                    <div className="text-[11px] text-[#8e9297]">
                      Copies the latest N records from the view
                    </div>
                  </div>
                </div>

                {/* Number Input Field */}
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    min={1}
                    max={filteredRecent.length || 1}
                    value={telemetryCopyCustomNumber}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10)
                      setTelemetryCopyCustomNumber(isNaN(val) ? 1 : Math.min(Math.max(1, val), filteredRecent.length))
                      setTelemetryCopySelectionMode("custom")
                    }}
                    onFocus={() => setTelemetryCopySelectionMode("custom")}
                    className="w-20 px-2.5 py-1 text-center rounded bg-[#111217] border border-[#383e4a] text-xs font-mono text-white focus:outline-none focus:border-[#5794f2]"
                  />
                  <span className="text-[11px] font-mono text-[#8e9297]">logs</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="pt-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <span className="text-[10px] uppercase font-mono text-[#8e9297] mr-1">Quick:</span>
                {[5, 10, 25, 50].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setTelemetryCopyCustomNumber(Math.min(preset, filteredRecent.length))
                      setTelemetryCopySelectionMode("custom")
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition ${
                      telemetryCopySelectionMode === "custom" && telemetryCopyCustomNumber === Math.min(preset, filteredRecent.length)
                        ? "bg-[#1f2f4d] text-[#5794f2] border-[#5794f2]"
                        : "bg-[#202328] hover:bg-[#2b3038] text-[#c7d0d9] border-[#333842]"
                    }`}
                  >
                    Top {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Included Fields Checklist / Summary */}
          <div className="p-2.5 rounded bg-[#0d0e11] border border-[#22252b] text-[11px] font-mono text-[#8e9297] space-y-1">
            <div className="text-[10px] uppercase font-bold text-[#c7d0d9]">Included in CSV output:</div>
            <div className="text-[10px] text-[#8e9297] leading-relaxed">
              ID, Timestamp, Engine, Case, Difficulty, Prompt, Correctness, Precision, Recall, Top-K, Latency (ms), Tokens, Cost, Recommendations, AI Response.
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setIsTelemetryCopyModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-mono bg-[#1f2328] hover:bg-[#2b3036] text-[#c7d0d9] hover:text-white border border-[#333842] transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => {
                const effective = telemetryCopySelectionMode === "all" ? "all" : telemetryCopyCustomNumber
                copyAsCsv(effective)
              }}
              disabled={filteredRecent.length === 0}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-mono font-bold transition shadow-md ${
                telemetryCopiedFeedbackCount !== null
                  ? "bg-[#14532d] text-[#4ade80] border border-[#22c55e]"
                  : "bg-[#182338] hover:bg-[#203152] text-[#5794f2] hover:text-white border border-[#5794f2]/60 shadow-[0_0_15px_rgba(87,148,242,0.3)]"
              }`}
            >
              {telemetryCopiedFeedbackCount !== null ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#4ade80]" />
                  <span>Copied {telemetryCopiedFeedbackCount} Logs!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#5794f2]" />
                  <span>
                    Copy {telemetryCopySelectionMode === "all" ? `All (${filteredRecent.length})` : `${telemetryCopyCustomNumber}`} Logs as CSV
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Small Batch Benchmark Modal */}
    {isBatchModalOpen && (
      <div
        className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) setIsBatchModalOpen(false)
        }}
      >
        <div className="bg-[#14161a] border border-[#2e333d] rounded-xl shadow-2xl shadow-black/90 max-w-lg w-full p-5 space-y-5 font-sans animate-in zoom-in-95 duration-150">
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-[#22252b] pb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#182338] border border-[#5794f2]/40 flex items-center justify-center text-[#5794f2]">
                <FlaskConical className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-mono font-bold text-sm text-white">
                  Run Small Batch Test
                </h3>
                <p className="text-[11px] text-[#8e9297] font-mono">
                  Test a scenario subset to verify deduction accuracy & latency
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsBatchModalOpen(false)}
              className="p-1 rounded-md hover:bg-[#202328] text-[#8e9297] hover:text-white transition"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Section 1: Scenario Selection Strategy */}
          <div className="space-y-2.5">
            <label className="block text-xs font-mono font-semibold uppercase text-[#8e9297] tracking-wider">
              1. Sample Size & Preset:
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "3", label: "3 Scenarios", desc: "Fast smoke test" },
                { id: "5", label: "5 Scenarios", desc: "Quick check" },
                { id: "10", label: "10 Scenarios", desc: "Standard batch" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setBatchPreset(p.id as any)}
                  className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                    batchPreset === p.id
                      ? "bg-[#182338] border-[#5794f2] text-white"
                      : "bg-[#181b1f] border-[#262930] hover:border-[#383e4a] text-[#8e9297]"
                  }`}
                >
                  <span className="font-mono font-bold text-xs text-white">{p.label}</span>
                  <span className="text-[10px] text-[#8e9297]">{p.desc}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Custom Count Option */}
              <div
                onClick={() => setBatchPreset("custom")}
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between gap-2 ${
                  batchPreset === "custom"
                    ? "bg-[#182338] border-[#5794f2] text-white"
                    : "bg-[#181b1f] border-[#262930] hover:border-[#383e4a] text-[#8e9297]"
                }`}
              >
                <div className="text-xs font-mono font-semibold text-white">Custom Count:</div>
                <input
                  type="number"
                  min={1}
                  max={scenarios.length || 30}
                  value={batchCustomCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10)
                    setBatchCustomCount(isNaN(val) ? 1 : Math.max(1, Math.min(scenarios.length || 30, val)))
                    setBatchPreset("custom")
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-16 px-2 py-1 rounded bg-[#111217] border border-[#383e4a] text-white text-xs font-mono text-center focus:border-[#5794f2] focus:outline-none"
                />
              </div>

              {/* Selected in Table Option */}
              <button
                type="button"
                disabled={selectedScenarioIds.length === 0}
                onClick={() => setBatchPreset("selected")}
                className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between disabled:opacity-40 disabled:cursor-not-allowed ${
                  batchPreset === "selected"
                    ? "bg-[#182338] border-[#5794f2] text-white"
                    : "bg-[#181b1f] border-[#262930] hover:border-[#383e4a] text-[#8e9297]"
                }`}
              >
                <div>
                  <div className="font-mono font-bold text-xs text-white">
                    Selected ({selectedScenarioIds.length})
                  </div>
                  <div className="text-[10px] text-[#8e9297]">From table checkboxes</div>
                </div>
                {selectedScenarioIds.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-[#5794f2]" />
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Distribution & Filters */}
          {batchPreset !== "selected" && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#181b1f] border border-[#262930]">
              <div>
                <label className="block text-[11px] font-mono text-[#8e9297] mb-1">
                  Difficulty Filter:
                </label>
                <select
                  value={batchDifficulty}
                  onChange={(e) => setBatchDifficulty(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-[#111217] border border-[#333842] text-white text-xs font-mono focus:border-[#5794f2] focus:outline-none"
                >
                  <option value="all">All Difficulties</option>
                  <option value="easy">Easy Only</option>
                  <option value="medium">Medium Only</option>
                  <option value="hard">Hard Only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-[#8e9297] mb-1">
                  Sampling Strategy:
                </label>
                <label className="flex items-center gap-2 mt-1.5 cursor-pointer text-xs font-mono text-[#c7d0d9]">
                  <input
                    type="checkbox"
                    checked={batchBalanced}
                    onChange={(e) => setBatchBalanced(e.target.checked)}
                    disabled={batchDifficulty !== "all"}
                    className="rounded bg-[#111217] border-[#383e4a] text-[#5794f2] focus:ring-0 focus:ring-offset-0 cursor-pointer disabled:opacity-50"
                  />
                  <span>Balanced tiers (Easy+Med+Hard)</span>
                </label>
              </div>
            </div>
          )}

          {/* Section 3: Engine Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-mono font-semibold uppercase text-[#8e9297] tracking-wider">
                2. Retrieval Engines to Benchmark:
              </label>
              <div className="flex items-center gap-1.5 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setBatchMethods(["sparse", "dense", "hybrid"])}
                  className="text-[#5794f2] hover:underline"
                >
                  All 3
                </button>
                <span className="text-[#383e4a]">|</span>
                <button
                  type="button"
                  onClick={() => setBatchMethods(["hybrid"])}
                  className="text-[#b877d9] hover:underline"
                >
                  Hybrid Only
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "sparse", label: "Sparse", color: "text-[#ff9900]", bg: "border-[#ff9900]/40" },
                { id: "dense", label: "Dense", color: "text-[#5794f2]", bg: "border-[#5794f2]/40" },
                { id: "hybrid", label: "Hybrid", color: "text-[#b877d9]", bg: "border-[#b877d9]/40" },
              ].map((m) => {
                const active = batchMethods.includes(m.id as any)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setBatchMethods((prev) =>
                        prev.includes(m.id as any)
                          ? prev.filter((item) => item !== m.id)
                          : [...prev, m.id as any]
                      )
                    }
                    className={`p-2.5 rounded-lg border flex items-center gap-2 transition ${
                      active
                        ? `bg-[#181b1f] ${m.bg} text-white`
                        : "bg-[#111217] border-[#22252b] text-[#8e9297] opacity-60"
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                        active ? "border-[#5794f2] bg-[#5794f2]" : "border-[#4f5562]"
                      }`}
                    >
                      {active && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                    </div>
                    <span className={`font-mono font-bold text-xs ${m.color}`}>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section 4: Live Computation / Estimation Card */}
          {(() => {
            const count =
              batchPreset === "selected"
                ? selectedScenarioIds.length
                : batchPreset === "custom"
                ? batchCustomCount
                : parseInt(batchPreset, 10) || 3
            const totalRuns = count * batchMethods.length
            const estTimeSec = Math.max(2, totalRuns * 2.5)
            const estCost = totalRuns * 0.0003

            return (
              <div className="p-3 rounded-lg bg-[#111217] border border-[#22252b] space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[#8e9297]">
                  <span>Workload Preview:</span>
                  <span className="text-white font-bold">
                    {count} Scenarios × {batchMethods.length} Engines = {totalRuns} Runs
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1e2228] text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#8e9297]">
                    <Clock className="w-3 h-3 text-[#fade2a]" />
                    <span>Est. Duration: ~{estTimeSec.toFixed(0)}s</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#8e9297]">
                    <Coins className="w-3 h-3 text-[#73bf69]" />
                    <span>Est. Cost: ~${estCost.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#22252b]">
            <button
              onClick={() => setIsBatchModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-[#202328] hover:bg-[#2a2f38] text-[#c7d0d9] hover:text-white text-xs font-mono transition"
            >
              Cancel
            </button>
            <button
              onClick={() => runBatch()}
              disabled={batchMethods.length === 0 || busy !== null}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#73bf69] hover:bg-[#86d97a] text-[#0b0c0e] text-xs font-mono font-bold transition disabled:opacity-50 shadow-md shadow-[#73bf69]/20"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Execute Batch Test</span>
            </button>
          </div>
        </div>
      </div>
    )}
  </TooltipContext.Provider>
)
}
