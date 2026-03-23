import { Router, Request, Response } from "express"
import jwt from "jsonwebtoken"
import { syncUserFromRlToken } from "../lib/rlUser"

const router = Router()

function regionLoversBaseUrl(): string {
  return (process.env.REGIONLOVERS_API_URL || "https://api-prod.regionlovers.ai").replace(/\/$/, "")
}

function resolveRlPassword(bodyPassword: string | undefined): string {
  const envMode = process.env.ENVIRONMENT_MODE === "true"
  if (envMode && (!bodyPassword || bodyPassword === "")) {
    return process.env.ENVIRONMENT_MODE_DEV_PASSWORD || ""
  }
  return bodyPassword || ""
}

/**
 * POST /api/auth/login — Proxies to Region Lovers /auth/login and syncs Mongo user.
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string; password?: string }
    let password = resolveRlPassword((req.body as { password?: string }).password)

    if (!email) {
      return res.status(400).json({ error: "email is required" })
    }
    if (!password) {
      return res.status(400).json({ error: "password is required" })
    }

    const baseUrl = regionLoversBaseUrl()
    const headers: Record<string, string> = {
      accept: "*/*",
      "Content-Type": "application/json",
    }
    if (process.env.RL_API_KEY) {
      headers["X-Api-Key"] = process.env.RL_API_KEY
    }

    const rlRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password }),
    })

    const data = (await rlRes.json().catch(() => ({}))) as Record<string, unknown>

    if (!rlRes.ok) {
      // Prefer RL "message" (e.g. "Identifiants invalides") over generic "error" ("Unauthorized")
      const rlMessage =
        (data.message as string) ||
        (data.error as string) ||
        (rlRes.status === 401 ? "Identifiants incorrects" : "Login failed")
      return res.status(rlRes.status).json({
        error: rlMessage,
        ...data,
      })
    }

    const accessToken = data.accessToken as string | undefined
    const refreshToken = data.refreshToken as string | undefined

    if (!accessToken || !refreshToken) {
      return res.status(502).json({ error: "Invalid response from auth server" })
    }

    const decoded = jwt.decode(accessToken) as { sub?: string; email?: string } | null
    if (!decoded?.sub || !decoded.email) {
      return res.status(502).json({ error: "Invalid access token payload" })
    }

    await syncUserFromRlToken(decoded.sub, decoded.email)

    res.json({ accessToken, refreshToken })
  } catch (error) {
    console.error("auth/login error:", error)
    res.status(500).json({ error: "Login failed" })
  }
})

// POST /api/auth/logout — client clears tokens; optional future server-side revoke
router.post("/logout", (_req: Request, res: Response) => {
  res.json({ success: true })
})

// When access JWT expires, Region Lovers may expose POST /auth/refresh with refreshToken — wire here if documented.

export default router
