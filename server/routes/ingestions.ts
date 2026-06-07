import { Router, Request, Response } from "express"
import { MongoClient } from "mongodb"
import { listCanonicalSites } from "../lib/canonicalSitesStore"

const router = Router()

let _mongoClient: MongoClient | null = null
async function getServiceRedactionDb() {
  if (!_mongoClient) {
    const uri = (process.env.SERVICE_REDACTION_MONGODB_URI || process.env.MONGODB_URI || "").trim()
    _mongoClient = new MongoClient(uri)
    await _mongoClient.connect()
  }
  return _mongoClient.db("service-redaction")
}

function ingestionBaseUrl(): string {
  const explicit = (process.env.INGESTION_SERVICE_URL || "").trim().replace(/\/$/, "")
  if (explicit) return explicit
  return "http://localhost:4001"
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

// GET /api/ingestions/status
router.get("/status", async (req: Request, res: Response) => {
  try {
    const remote = await fetchIngestionJson(req, "/api/v1/ingest/articles-raw-sync/status")
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    res.status(502).json({
      error: "Service d'ingestion indisponible",
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

// GET /api/ingestions/runs?limit=20
router.get("/runs", async (req: Request, res: Response) => {
  try {
    const limit = typeof req.query.limit === "string" ? req.query.limit : "20"
    const remote = await fetchIngestionJson(req, `/api/v1/ingest/articles-raw-sync/runs?limit=${limit}`)
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    res.status(502).json({
      error: "Service d'ingestion indisponible",
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

// POST /api/ingestions/trigger — ingestion globale
router.post("/trigger", async (req: Request, res: Response) => {
  try {
    const remote = await fetchIngestionJson(req, "/api/v1/ingest/articles-raw-sync/trigger", {
      method: "POST",
    })
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    res.status(502).json({
      error: "Service d'ingestion indisponible",
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

// POST /api/ingestions/trigger-site — ingestion d'un site
router.post("/trigger-site", async (req: Request, res: Response) => {
  try {
    const remote = await fetchIngestionJson(req, "/api/v1/ingest/articles-raw-sync/trigger-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    })
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    res.status(502).json({
      error: "Service d'ingestion indisponible",
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

// GET /api/ingestions/article-raw?siteId=...&wpId=...
router.get("/article-raw", async (req: Request, res: Response) => {
  try {
    const siteId = typeof req.query.siteId === "string" ? req.query.siteId : ""
    const wpId = typeof req.query.wpId === "string" ? parseInt(req.query.wpId, 10) : NaN
    if (!siteId || isNaN(wpId)) {
      return res.status(400).json({ error: "Paramètres siteId et wpId requis" })
    }
    const db = await getServiceRedactionDb()
    const doc = await db.collection("articles_raw").findOne(
      { site_id: siteId, wp_id: wpId },
      { projection: { html_brut: 0, markdown: 0 } }
    )
    if (!doc) return res.status(404).json({ error: "Article introuvable dans articles_raw" })
    res.json(doc)
  } catch (error) {
    res.status(500).json({
      error: "Erreur lors de la lecture de l'article",
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

// GET /api/ingestions/resolve-url?url=... — résout une URL en { siteId, wpId }
router.get("/resolve-url", async (req: Request, res: Response) => {
  try {
    const rawUrl = typeof req.query.url === "string" ? req.query.url.trim() : ""
    if (!rawUrl) return res.status(400).json({ error: "Paramètre url requis" })

    let targetHostname: string
    try {
      targetHostname = new URL(rawUrl).hostname.replace(/^www\./, "")
    } catch {
      return res.status(400).json({ error: "URL invalide" })
    }

    const sites = await listCanonicalSites()
    const matchingSite = sites.find((s) => {
      try {
        const siteHostname = new URL(s.url).hostname.replace(/^www\./, "")
        return siteHostname === targetHostname
      } catch {
        return false
      }
    })

    if (!matchingSite) {
      return res.status(404).json({ error: `Aucun site correspondant à ${targetHostname}` })
    }

    const postsRemote = await fetchIngestionJson(req, `/api/v1/user/sites/${matchingSite._id}/posts`)
    if (!postsRemote.ok) {
      return res.status(postsRemote.status).json({ error: "Impossible de récupérer les articles du site" })
    }

    type PostEntry = { id?: number; wpId?: number; link?: string; url?: string; permalink?: string }
    const raw = postsRemote.data as { data?: PostEntry[] } | PostEntry[]
    const posts: PostEntry[] = Array.isArray(raw) ? raw : (raw?.data ?? [])

    const normalizeUrl = (u: string) => u.replace(/\/$/, "").toLowerCase()
    const needle = normalizeUrl(rawUrl)

    const match = posts.find((p) => {
      const link = p.link ?? p.url ?? p.permalink ?? ""
      return normalizeUrl(link) === needle
    })

    if (!match) {
      return res.status(404).json({ error: "Article introuvable pour cette URL dans articles_raw" })
    }

    const wpId = match.id ?? match.wpId
    if (!wpId) {
      return res.status(404).json({ error: "Article trouvé mais sans wpId" })
    }

    res.json({ siteId: matchingSite._id, siteName: matchingSite.name, wpId })
  } catch (error) {
    res.status(500).json({
      error: "Erreur lors de la résolution de l'URL",
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

// POST /api/ingestions/trigger-article — ingestion d'une URL
router.post("/trigger-article", async (req: Request, res: Response) => {
  try {
    const remote = await fetchIngestionJson(req, "/api/v1/ingest/articles-raw-sync/trigger-article", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    })
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    res.status(502).json({
      error: "Service d'ingestion indisponible",
      details: error instanceof Error ? error.message : String(error),
    })
  }
})

export default router
