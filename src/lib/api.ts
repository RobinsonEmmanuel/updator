/** Region Lovers JWT access token (Bearer) */
export const RL_ACCESS_TOKEN_KEY = "rl_access_token"
export const RL_REFRESH_TOKEN_KEY = "rl_refresh_token"

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

function isPublicApiPath(url: string): boolean {
  if (url.startsWith("/api/auth/login")) return true
  if (url.startsWith("/api/health")) return true
  if (url.startsWith("/api/sites")) return true
  return false
}

/**
 * fetch wrapper: adds Bearer token for protected API routes; clears session on 401.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : String(input)

  const headers = new Headers(init?.headers)
  const token = getStoredAccessToken()
  if (token && url.startsWith("/api/") && !isPublicApiPath(url)) {
    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`)
    }
  }

  const res = await fetch(input, { ...init, headers })

  if (
    res.status === 401 &&
    url.startsWith("/api/") &&
    !url.startsWith("/api/auth/login")
  ) {
    clearRlTokens()
    window.dispatchEvent(new CustomEvent("auth:session-expired"))
    if (window.location.pathname !== "/login") {
      window.location.assign("/login")
    }
  }

  return res
}
