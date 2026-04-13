import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import {
  RL_ACCESS_TOKEN_KEY,
  RL_REFRESH_TOKEN_KEY,
  getStoredAccessToken,
  clearRlTokens,
  apiUrl,
} from "@/lib/api"
import { queryClient } from "@/lib/queryClient"

const AUTH_USER_KEY = "auth_user"

interface User {
  name: string
  email: string
  role?: string
}

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password?: string) => Promise<void>
  logout: () => void
  authError: string | null
  clearAuthError: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function decodeJwtPayload(token: string): { sub?: string; email?: string; role?: string; exp?: number } | null {
  try {
    const p = token.split(".")[1]
    if (!p) return null
    const json = atob(p.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(json) as { sub?: string; email?: string; role?: string; exp?: number }
  } catch {
    return null
  }
}

function isTokenValid(token: string | null): boolean {
  if (!token) return false
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return true
  return payload.exp * 1000 > Date.now()
}

function readStoredUser(): User | null {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem(AUTH_USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

function userFromToken(token: string): User | null {
  const p = decodeJwtPayload(token)
  if (!p?.email) return null
  const local = (p.email.split("@")[0] ?? "").trim()
  const name = local
    ? local.charAt(0).toUpperCase() + local.slice(1)
    : p.email
  return { name, email: p.email, role: p.role }
}

function initialUser(): User | null {
  const token = getStoredAccessToken()
  if (!token || !isTokenValid(token)) return null
  const fromToken = userFromToken(token)
  const stored = readStoredUser()
  if (stored) {
    return {
      ...stored,
      role: stored.role ?? fromToken?.role,
    }
  }
  return fromToken
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [authError, setAuthError] = useState<string | null>(null)

  const clearAuthError = useCallback(() => setAuthError(null), [])

  useEffect(() => {
    const token = getStoredAccessToken()
    if (!token || !isTokenValid(token)) {
      clearRlTokens()
      localStorage.removeItem(AUTH_USER_KEY)
      setUser(null)
      return
    }
    setUser((prev) => prev ?? userFromToken(token))
  }, [])

  useEffect(() => {
    const onExpired = () => {
      setUser(null)
      localStorage.removeItem(AUTH_USER_KEY)
    }
    window.addEventListener("auth:session-expired", onExpired)
    return () => window.removeEventListener("auth:session-expired", onExpired)
  }, [])

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(AUTH_USER_KEY)
    }
  }, [user])

  const login = async (email: string, password?: string) => {
    setAuthError(null)
    const res = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: password ?? "" }),
    })
    const data = (await res.json().catch(() => ({}))) as { accessToken?: string; refreshToken?: string; error?: string }
    if (!res.ok) {
      const msg = data.error || "Connexion refusée"
      setAuthError(typeof msg === "string" ? msg : "Connexion refusée")
      throw new Error(typeof msg === "string" ? msg : "Connexion refusée")
    }
    if (!data.accessToken || !data.refreshToken) {
      setAuthError("Réponse invalide du serveur")
      throw new Error("Réponse invalide du serveur")
    }
    localStorage.setItem(RL_ACCESS_TOKEN_KEY, data.accessToken)
    localStorage.setItem(RL_REFRESH_TOKEN_KEY, data.refreshToken)
    setUser(userFromToken(data.accessToken) ?? { name: email.split("@")[0] || email, email })
  }

  const logout = () => {
    clearRlTokens()
    localStorage.removeItem(AUTH_USER_KEY)
    setUser(null)
    queryClient.removeQueries({ queryKey: ["connected-sites"] })
    queryClient.removeQueries({ queryKey: ["signals"] })
    queryClient.removeQueries({ queryKey: ["drafts"] })
    void fetch(apiUrl("/api/auth/logout"), { method: "POST" }).catch(() => {})
  }

  const token = getStoredAccessToken()
  const isAuthenticated = isTokenValid(token) && !!user

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        login,
        logout,
        authError,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
