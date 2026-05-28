import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Investigation System",
  description: "Interactive Investigation Simulation System",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
