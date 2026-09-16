"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ShieldAlert, KeyRound, ArrowRight, Loader2, Lock, Eye, EyeOff, Terminal } from "lucide-react"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextUrl = searchParams.get("next") || "/"

  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      setError("Please enter the master access key.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        router.push(nextUrl)
        router.refresh()
      } else {
        setError(data.error || "Access Denied: Invalid master access key.")
      }
    } catch {
      setError("Network error. Unable to reach authentication server.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-[#c7d0d9] flex flex-col justify-center items-center p-4 relative overflow-hidden font-mono selection:bg-[#5794f2]/30 selection:text-white">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#5794f2]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[500px] h-[300px] bg-[#b877d9]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Grid line overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#161920_1px,transparent_1px),linear-gradient(to_bottom,#161920_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Terminal Header Badge */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161922] border border-[#2b3240] text-xs text-[#5794f2] shadow-sm">
            <Terminal className="w-3.5 h-3.5" />
            <span className="tracking-wider uppercase font-bold text-[11px]">Restricted Forensic Archive</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <Lock className="w-5 h-5 text-[#fade2a]" />
            <span>Investigation Intelligence</span>
          </h1>

          <p className="text-xs text-[#8e9297]">
            RAG Evaluation Pipeline & Noir Deduction System
          </p>
        </div>

        {/* Security Card Box */}
        <div className="bg-[#12151b]/90 border border-[#242a36] rounded-xl p-7 shadow-2xl backdrop-blur-md space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b border-[#202530]">
            <div className="w-10 h-10 rounded-lg bg-[#1a1f2c] border border-[#313b4d] flex items-center justify-center text-[#5794f2] shadow-inner">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase text-white tracking-wide">
                Terminal Authentication
              </div>
              <div className="text-[11px] text-[#8e9297]">
                Authorization clearance required to access case evidence and telemetry.
              </div>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-[#8e9297] flex items-center justify-between">
                <span>Master Access Key</span>
                <span className="text-[10px] text-[#5794f2]">APP_PASSWORD</span>
              </label>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter system access key..."
                  disabled={loading}
                  autoFocus
                  className="w-full bg-[#0a0c10] border border-[#272e3d] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-[#5a6270] focus:outline-none focus:border-[#5794f2] focus:ring-1 focus:ring-[#5794f2] transition pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e9297] hover:text-white transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[#3a151b] border border-[#f2495c]/40 text-[#fca5a5] text-xs flex items-center gap-2 animate-shake">
                <ShieldAlert className="w-4 h-4 shrink-0 text-[#f2495c]" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#1f2937] hover:bg-[#283548] border border-[#3b485d] text-white text-xs font-bold transition shadow-md disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#5794f2]" />
                  <span>Verifying Clearance...</span>
                </>
              ) : (
                <>
                  <span>Decrypt & Access Terminal</span>
                  <ArrowRight className="w-4 h-4 text-[#5794f2]" />
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-[#1a1f28] flex items-center justify-between text-[10px] text-[#5a6270]">
            <span>Security Status: ACTIVE</span>
            <span>Session: HTTP-ONLY COOKIE</span>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-[11px] text-[#5a6270]">
          Configure <code className="text-[#8e9297]">APP_PASSWORD</code> in your environment variables.
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0c10] flex items-center justify-center text-white font-mono">Loading authentication portal...</div>}>
      <LoginForm />
    </Suspense>
  )
}
