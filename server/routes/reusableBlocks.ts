import { Router, Request, Response } from "express"

const router = Router()

function ingestionBaseUrl(): string {
  return (process.env.INGESTION_SERVICE_URL || "http://localhost:4001").trim().replace(/\/$/, "")
}

async function fetchIngestionJson(
  req: Request,
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const headers = new Headers(init?.headers as HeadersInit)
  if (req.headers.authorization && !headers.has("Authorization")) {
    headers.set("Authorization", req.headers.authorization)
  }
  const response = await fetch(`${ingestionBaseUrl()}${path}`, { ...init, headers })
  const data = await response.json().catch(() => ({ error: "Invalid JSON response" }))
  return { ok: response.ok, status: response.status, data }
}

// GET /api/reusable-blocks?site_id=...&q=...&page=1&limit=50
// Vue globale tous sites confondus
router.get("/", async (req: Request, res: Response) => {
  try {
    const params = new URLSearchParams()
    if (req.query.site_id) params.set("site_id", String(req.query.site_id))
    if (req.query.q) params.set("q", String(req.query.q))
    if (req.query.page) params.set("page", String(req.query.page))
    if (req.query.limit) params.set("limit", String(req.query.limit))
    const qs = params.toString()
    const remote = await fetchIngestionJson(req, `/api/v1/reusable-blocks${qs ? `?${qs}` : ""}`)
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    res.status(502).json({ error: "Service indisponible", details: error instanceof Error ? error.message : String(error) })
  }
})

// GET /api/reusable-blocks/site/:siteId?status=publish&q=...
// Liste des blocs pour un site donné — DOIT être avant /:wpBlockId
router.get("/site/:siteId", async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params
    const params = new URLSearchParams()
    if (req.query.status) params.set("status", String(req.query.status))
    if (req.query.q) params.set("q", String(req.query.q))
    const qs = params.toString()
    const remote = await fetchIngestionJson(req, `/api/v1/sites/${siteId}/reusable-blocks${qs ? `?${qs}` : ""}`)
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    res.status(502).json({ error: "Service indisponible", details: error instanceof Error ? error.message : String(error) })
  }
})

// POST /api/reusable-blocks/site/:siteId/sync
// Déclenche la synchronisation depuis WordPress — DOIT être avant /:wpBlockId
router.post("/site/:siteId/sync", async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params
    const targetUrl = `${ingestionBaseUrl()}/api/v1/sites/${siteId}/reusable-blocks/sync`
    console.log("[sync] POST", targetUrl)
    const remote = await fetchIngestionJson(req, `/api/v1/sites/${siteId}/reusable-blocks/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    console.log("[sync] response status:", remote.status, JSON.stringify(remote.data))
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    console.error("[sync] CAUGHT ERROR:", error)
    res.status(502).json({ error: "Service indisponible", details: error instanceof Error ? error.message : String(error) })
  }
})

// GET /api/reusable-blocks/:wpBlockId?site_id=...
// Détail d'un bloc par son ID WordPress — wildcard, doit rester en dernier
router.get("/:wpBlockId", async (req: Request, res: Response) => {
  try {
    const { wpBlockId } = req.params
    const qs = req.query.site_id ? `?site_id=${encodeURIComponent(String(req.query.site_id))}` : ""
    const remote = await fetchIngestionJson(req, `/api/v1/reusable-blocks/${wpBlockId}${qs}`)
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    res.status(502).json({ error: "Service indisponible", details: error instanceof Error ? error.message : String(error) })
  }
})

export default router
