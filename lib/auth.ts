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

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/")
  while (base64.length % 4 !== 0) {
    base64 += "="
  }
  return base64
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export async function createAuthToken(): Promise<string> {
  const payload = JSON.stringify({
    authenticated: true,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  })
  const payloadB64Url = toBase64Url(btoa(payload))
  const key = await getHmacKey(getAuthSecret())
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64Url))
  const sigB64Url = toBase64Url(arrayBufferToBase64(sigBuffer))
  return `${payloadB64Url}.${sigB64Url}`
}

export async function verifyAuthTokenDetailed(token?: string | null): Promise<{ valid: boolean; reason?: string }> {
  if (!token) {
    return { valid: false, reason: "NO_TOKEN" }
  }
  try {
    const cleanToken = decodeURIComponent(token.trim())
    const parts = cleanToken.split(".")
    if (parts.length !== 2) {
      return { valid: false, reason: `INVALID_PARTS_${parts.length}` }
    }
    const [payloadPart, sigPart] = parts

    const secret = getAuthSecret()
    const key = await getHmacKey(secret)
    const sigBase64 = fromBase64Url(sigPart)
    const sigBytes = base64ToUint8Array(sigBase64)

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(payloadPart)
    )
    if (!isValid) {
      return { valid: false, reason: `SIGNATURE_MISMATCH_SECRET_LEN_${secret.length}` }
    }

    const payloadBase64 = fromBase64Url(payloadPart)
    const payload = JSON.parse(atob(payloadBase64))
    if (payload.exp && Date.now() > payload.exp) {
      return { valid: false, reason: "TOKEN_EXPIRED" }
    }

    return { valid: Boolean(payload.authenticated), reason: "OK" }
  } catch (err: any) {
    return { valid: false, reason: `EXCEPTION_${err?.message || err}` }
  }
}

export async function verifyAuthToken(token?: string | null): Promise<boolean> {
  const result = await verifyAuthTokenDetailed(token)
  return result.valid
}
