import { Router, Request, Response } from "express"
import { MongoClient, ObjectId } from "mongodb"

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
  return (process.env.INGESTION_SERVICE_URL || "http://localhost:4001").trim().replace(/\/$/, "")
}

function ingestionApiKey(): string {
  return (process.env.RL_INGESTION_API_KEY || "").trim()
}

async function fetchPoiJson(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const headers = new Headers(init?.headers as HeadersInit)
  const apiKey = ingestionApiKey()
  if (apiKey) headers.set("X-Api-Key", apiKey)
  const response = await fetch(`${ingestionBaseUrl()}${path}`, { ...init, headers })
  const data = await response.json().catch(() => ({ error: "Invalid JSON response" }))
  return { ok: response.ok, status: response.status, data }
}

// GET /api/poi-mentions/stats
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const remote = await fetchPoiJson("/api/v1/poi-mentions/stats")
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    res.status(502).json({ error: "Service indisponible", details: error instanceof Error ? error.message : String(error) })
  }
})

// GET /api/poi-mentions?page=1&limit=50
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = req.query.page || "1"
    const limit = req.query.limit || "50"
    const remote = await fetchPoiJson(`/api/v1/poi-mentions?page=${page}&limit=${limit}`)
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    res.status(502).json({ error: "Service indisponible", details: error instanceof Error ? error.message : String(error) })
  }
})

// GET /api/poi-mentions/article/:articleId — mentions + article metadata
router.get("/article/:articleId", async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params
    const remote = await fetchPoiJson(`/api/v1/poi-mentions/article/${articleId}`)
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    res.status(502).json({ error: "Service indisponible", details: error instanceof Error ? error.message : String(error) })
  }
})

// GET /api/poi-mentions/article-content/:articleId — markdown content from articles_raw
router.get("/article-content/:articleId", async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params
    const db = await getServiceRedactionDb()

    let filter: Record<string, unknown>
    try {
      filter = { _id: new ObjectId(articleId) }
    } catch {
      filter = { _id: articleId }
    }

    const doc = await db.collection("articles_raw").findOne(filter, {
      projection: { markdown: 1, title: 1, site_id: 1, wp_id: 1, slug: 1 },
    })

    if (!doc) return res.status(404).json({ error: "Article introuvable dans articles_raw" })
    res.json(doc)
  } catch (error) {
    res.status(500).json({ error: "Erreur lecture article", details: error instanceof Error ? error.message : String(error) })
  }
})

// PATCH /api/poi-mentions/:mentionId — approve or reject
router.patch("/:mentionId", async (req: Request, res: Response) => {
  try {
    const { mentionId } = req.params
    const { action } = req.body as { action: "approve" | "reject" }
    if (!action || !["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "action doit être 'approve' ou 'reject'" })
    }
    const remote = await fetchPoiJson(`/api/v1/poi-mentions/${mentionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    res.status(502).json({ error: "Service indisponible", details: error instanceof Error ? error.message : String(error) })
  }
})

export default router
