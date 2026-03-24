/** Region Lovers JWT access token (Bearer) */
export const RL_ACCESS_TOKEN_KEY = "rl_access_token"
export const RL_REFRESH_TOKEN_KEY = "rl_refresh_token"
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "")

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(RL_ACCESS_TOKEN_KEY)
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(RL_REFRESH_TOKEN_KEY)
}

export function clearRlTokens(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(RL_ACCESS_TOKEN_KEY)
  localStorage.removeItem(RL_REFRESH_TOKEN_KEY)
}

function getApiPath(url: string): string {
  if (url.startsWith("/api/")) return url
  try {
    const parsed = new URL(url)
    if (parsed.pathname.startsWith("/api/")) return parsed.pathname
    return ""
  } catch {
    return ""
  }
}

export function apiUrl(path: string): string {
  if (!path.startsWith("/api/")) return path
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path
}

function isPublicApiPath(path: string): boolean {
  if (path.startsWith("/api/auth/login")) return true
  if (path.startsWith("/api/health")) return true
  if (path.startsWith("/api/sites")) return true
  return false
}

/**
 * fetch wrapper: adds Bearer token for protected API routes; clears session on 401.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : String(input)
  const apiPath = getApiPath(url)
  const requestInput: RequestInfo | URL = apiPath ? apiUrl(apiPath) : input

  const headers = new Headers(init?.headers)
  const token = getStoredAccessToken()
  if (token && apiPath && !isPublicApiPath(apiPath)) {
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`)
    }
  }

  const res = await fetch(requestInput, { ...init, headers })

  if (
    res.status === 401 &&
    apiPath &&
    !apiPath.startsWith("/api/auth/login")
  ) {
    clearRlTokens()
    window.dispatchEvent(new CustomEvent("auth:session-expired"))
    if (window.location.pathname !== "/login") {
      window.location.assign("/login")
    }
  }

  return res
}
