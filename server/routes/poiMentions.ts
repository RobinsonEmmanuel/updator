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
  // Convert 401/403 from ingestion service to 502 — a backend auth error must not
  // trigger a frontend session expiry redirect.
  if (response.status === 401 || response.status === 403) {
    return { ok: false, status: 502, data: { error: "Service d'ingestion non autorisé. Vérifiez RL_INGESTION_API_KEY.", remoteStatus: response.status } }
  }
  return { ok: response.ok, status: response.status, data }
}

function normalizePoiName(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function idFilter(value: string) {
  return ObjectId.isValid(value)
    ? { $or: [{ _id: new ObjectId(value) }, { _id: value }] }
    : { _id: value }
}

type MentionLike = {
  article_id?: unknown
  nom_dans_article?: unknown
  rl_poi_id?: unknown
}

function sendReingestRemoteResponse(res: Response, remote: { status: number; data: unknown }) {
  if (remote.status === 401 || remote.status === 403) {
    return res.status(502).json({
      error: "Le service d'ingestion a refusé la relance POI. Vérifiez la clé API côté actualisation-sites.",
      remoteStatus: remote.status,
    })
  }

  return res.status(remote.status).json(remote.data)
}

async function getArticleForReingest(articleId: string) {
  const db = await getServiceRedactionDb()
  return db.collection("articles_raw").findOne(
    idFilter(articleId),
    { projection: { site_id: 1, poi_candidates: 1 } }
  )
}

// GET /api/poi-mentions/stats
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const site_id = req.query.site_id as string | undefined
    const qs = site_id ? `?site_id=${encodeURIComponent(site_id)}` : ""
    const remote = await fetchPoiJson(`/api/v1/poi-mentions/stats${qs}`)
    return res.status(remote.status).json(remote.data)
  } catch (error) {
    res.status(502).json({ error: "Service indisponible", details: error instanceof Error ? error.message : String(error) })
  }
})

// GET /api/poi-mentions?page=1&limit=50&site_id=...
router.get("/", async (req: Request, res: Response) => {
  try {
    const page = req.query.page || "1"
    const limit = req.query.limit || "50"
    const site_id = req.query.site_id as string | undefined
    console.log(`[poi-mentions GET /] site_id reçu = "${site_id ?? 'ABSENT'}"`)
    const siteParam = site_id ? `&site_id=${encodeURIComponent(site_id)}` : ""
    const remote = await fetchPoiJson(`/api/v1/poi-mentions?page=${page}&limit=${limit}${siteParam}`)
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

// POST /api/poi-mentions/article/:articleId/reingest — relance la détection POI de l'article entier
router.post("/article/:articleId/reingest", async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params
    const article = await getArticleForReingest(articleId)

    if (!article) return res.status(404).json({ error: "Article introuvable" })

    const remote = await fetchPoiJson(`/api/v1/article-poi/${articleId}/recompute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: JSON.stringify({
        siteId: String(article.site_id),
        force: true,
      }),
    })

    return sendReingestRemoteResponse(res, remote)
  } catch (error) {
    res.status(502).json({ error: "Service indisponible", details: error instanceof Error ? error.message : String(error) })
  }
})

// POST /api/poi-mentions/:mentionId/reingest — relance le recompute du candidat POI associé
router.post("/:mentionId/reingest", async (req: Request, res: Response) => {
  try {
    const { mentionId } = req.params
    const authHeader = req.headers.authorization
    const db = await getServiceRedactionDb()

    let mention = await db.collection<MentionLike>("article_poi_mentions").findOne(idFilter(mentionId))

    if (!mention) {
      const remoteMention = await fetchPoiJson(`/api/v1/poi-mentions/${mentionId}`)
      if (remoteMention.ok && remoteMention.data && typeof remoteMention.data === "object") {
        mention = remoteMention.data as MentionLike
      }
    }

    if (!mention) return res.status(404).json({ error: "Mention POI introuvable" })

    const articleId = String(mention.article_id || "")
    const article = await db.collection("articles_raw").findOne(
      idFilter(articleId),
      { projection: { site_id: 1, poi_candidates: 1 } }
    )

    if (!article) return res.status(404).json({ error: "Article introuvable" })

    const candidates = Array.isArray(article.poi_candidates) ? article.poi_candidates : []
    const mentionName = normalizePoiName(mention.nom_dans_article)
    const mentionRlPoiId = String(mention.rl_poi_id || "")

    const candidate = candidates.find((item) => {
      const candidateRecord = item as Record<string, unknown>
      if (mentionRlPoiId && candidateRecord.rl_place_id === mentionRlPoiId) return true
      return normalizePoiName(candidateRecord.name) === mentionName
    }) as Record<string, unknown> | undefined

    if (!candidate?.candidate_id) {
      const remote = await fetchPoiJson(`/api/v1/article-poi/${articleId}/candidate/mark`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          siteId: String(article.site_id),
          candidateName: String(mention.nom_dans_article || ""),
          source: "body",
        }),
      })

      return sendReingestRemoteResponse(res, remote)
    }

    const remote = await fetchPoiJson(`/api/v1/article-poi/${articleId}/candidate/recompute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({
        siteId: String(article.site_id),
        candidateId: String(candidate.candidate_id),
        refreshFromWp: true,
      }),
    })

    return sendReingestRemoteResponse(res, remote)
  } catch (error) {
    res.status(502).json({ error: "Service indisponible", details: error instanceof Error ? error.message : String(error) })
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
