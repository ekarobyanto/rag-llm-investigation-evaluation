/**
 * Authentication helper for Master Access Key.
 * Compatible with Next.js Edge Middleware and Node.js Runtime.
 */

const encoder = new TextEncoder()

export const AUTH_COOKIE_NAME = "investigation_auth_token"

export function getAppPassword(): string {
  return process.env.APP_PASSWORD || "investigation2027"
}

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || getAppPassword() + "_salt_secret_key"
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export async function createAuthToken(): Promise<string> {
  const payload = JSON.stringify({
    authenticated: true,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  })
  const payloadB64 = btoa(payload)
  const key = await getHmacKey(getAuthSecret())
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64))
  const sigB64 = arrayBufferToBase64(sigBuffer)
  return `${payloadB64}.${sigB64}`
}

export async function verifyAuthToken(token?: string | null): Promise<boolean> {
  if (!token) return false
  try {
    const parts = token.split(".")
    if (parts.length !== 2) return false
    const [payloadB64, sigB64] = parts

    const key = await getHmacKey(getAuthSecret())
    const sigBuffer = base64ToArrayBuffer(sigB64)
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBuffer,
      encoder.encode(payloadB64)
    )
    if (!isValid) return false

    const payload = JSON.parse(atob(payloadB64))
    if (payload.exp && Date.now() > payload.exp) {
      return false
    }

    return Boolean(payload.authenticated)
  } catch {
    return false
  }
}
