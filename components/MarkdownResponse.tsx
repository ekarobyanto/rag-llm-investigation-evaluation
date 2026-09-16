"use client"

import React, { useMemo } from "react"
import { marked } from "marked"

interface MarkdownResponseProps {
  content?: string | null
  variant?: "noir" | "eval"
  className?: string
}

export default function MarkdownResponse({
  content,
  variant = "noir",
  className = "",
}: MarkdownResponseProps) {
  const html = useMemo(() => {
    if (!content) return ""
    try {
      const parsed = marked.parse(content, {
        gfm: true,
        breaks: true,
        async: false,
      })
      return typeof parsed === "string" ? parsed : ""
    } catch (err) {
      console.error("Markdown parsing error:", err)
      return content
    }
  }, [content])

  if (!content) return null

  return (
    <div
      className={`markdown-response markdown-${variant} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
