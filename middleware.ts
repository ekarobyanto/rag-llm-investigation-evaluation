import { NextRequest, NextResponse } from "next/server"
import { verifyAuthToken, AUTH_COOKIE_NAME, getAppPassword } from "@/lib/auth"

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // 1. Allow public paths without authentication
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/login") ||
    pathname === "/login" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  // 2. Check for Bearer token authorization header (for CLI scripts / curl)
  const authHeader = request.headers.get("authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.substring(7).trim()
    if (bearerToken === getAppPassword()) {
      return NextResponse.next()
    }
  }

  // 3. Check for valid signed session cookie
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value
  const isAuthenticated = await verifyAuthToken(cookie)

  if (isAuthenticated) {
    return NextResponse.next()
  }

  // 4. Handle unauthenticated requests
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Unauthorized. Valid session or Bearer token required." },
      { status: 401 }
    )
  }

  // Redirect web page navigation to login terminal
  const loginUrl = new URL("/login", request.url)
  const destination = pathname + search
  if (destination && destination !== "/") {
    loginUrl.searchParams.set("next", destination)
  }

  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
