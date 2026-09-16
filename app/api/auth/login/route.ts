import { NextRequest, NextResponse } from "next/server"
import { createAuthToken, getAppPassword, AUTH_COOKIE_NAME } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { password } = body

    const expectedPassword = getAppPassword()

    if (!password || typeof password !== "string" || password !== expectedPassword) {
      return NextResponse.json(
        { error: "Invalid master access key" },
        { status: 401 }
      )
    }

    const token = await createAuthToken()
    const response = NextResponse.json({ success: true, message: "Authentication successful" })

    const isHttps =
      request.nextUrl.protocol === "https:" ||
      request.headers.get("x-forwarded-proto") === "https"

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })

    return response
  } catch (error) {
    console.error("Login authentication error:", error)
    return NextResponse.json(
      { error: "Internal server error during authentication" },
      { status: 500 }
    )
  }
}
