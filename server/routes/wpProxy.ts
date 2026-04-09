import { Router, Request, Response } from "express"
import { getOrSetCache, getWpProxyTtlMs } from "../lib/wpProxyCache"
import { findCanonicalSiteById, getCanonicalUserCredentials } from "../lib/canonicalSitesStore"

const router = Router()
function parseWpStatus(error: unknown): number | null {
  const msg = error instanceof Error ? error.message : String(error)
  const m = msg.match(/WordPress API error: (\d+)/)
  if (!m) return null
  const n = Number.parseInt(m[1], 10)
  return Number.isNaN(n) ? null : n
}


/** Champs minimaux liste posts (évite content/excerpt volumineux) */
const POST_LIST_FIELDS = "id,date,modified,slug,status,type,link,title,categories"
const CATEGORY_LIST_FIELDS = "id,name,slug,count,parent"

function appendPostListParams(url: URL): void {
  url.searchParams.set("_fields", POST_LIST_FIELDS)
}

function appendCategoryListParams(url: URL): void {
  url.searchParams.set("_fields", CATEGORY_LIST_FIELDS)
}

function isRefreshQuery(req: Request): boolean {
  const r = req.query.refresh
  return r === "1" || r === "true"
}

async function fetchAllPosts(baseUrl: string, auth: string): Promise<{ posts: unknown[]; total: number }> {
  const url1 = new URL(`${baseUrl}/wp-json/wp/v2/posts`)
  url1.searchParams.set("per_page", "100")
  url1.searchParams.set("page", "1")
  url1.searchParams.set("orderby", "modified")
  url1.searchParams.set("order", "asc")
  appendPostListParams(url1)

  const firstResponse = await fetch(url1.toString(), {
    headers: { Authorization: auth },
  })

  if (!firstResponse.ok) {
    throw new Error(`WordPress API error: ${firstResponse.status}`)
  }

  const firstPage = await firstResponse.json()
  const total = parseInt(firstResponse.headers.get("X-WP-Total") || "0", 10)
  const totalPages = parseInt(firstResponse.headers.get("X-WP-TotalPages") || "1", 10)

  if (totalPages <= 1) {
    return { posts: firstPage, total }
  }

  const pagePromises: Promise<unknown[]>[] = []
  for (let page = 2; page <= totalPages; page++) {
    const url = new URL(`${baseUrl}/wp-json/wp/v2/posts`)
    url.searchParams.set("per_page", "100")
    url.searchParams.set("page", page.toString())
    url.searchParams.set("orderby", "modified")
    url.searchParams.set("order", "asc")
    appendPostListParams(url)

    pagePromises.push(
      fetch(url.toString(), { headers: { Authorization: auth } }).then(async (res) => {
        if (!res.ok) throw new Error(`WordPress API error: ${res.status}`)
        return res.json()
      })
    )
  }

  const restPages = await Promise.all(pagePromises)
  const allPosts = [...firstPage, ...restPages.flat()]

  return { posts: allPosts, total }
}

async function fetchCategories(baseUrl: string, auth: string): Promise<unknown[]> {
  const url1 = new URL(`${baseUrl}/wp-json/wp/v2/categories`)
  url1.searchParams.set("per_page", "100")
  url1.searchParams.set("page", "1")
  appendCategoryListParams(url1)

  const firstResponse = await fetch(url1.toString(), {
    headers: { Authorization: auth },
  })

  if (!firstResponse.ok) {
    throw new Error(`WordPress API error: ${firstResponse.status}`)
  }

  const firstPage = await firstResponse.json()
  const totalPages = parseInt(firstResponse.headers.get("X-WP-TotalPages") || "1", 10)

  if (totalPages <= 1) {
    return firstPage
  }

  const pagePromises: Promise<unknown[]>[] = []
  for (let page = 2; page <= totalPages; page++) {
    const url = new URL(`${baseUrl}/wp-json/wp/v2/categories`)
    url.searchParams.set("per_page", "100")
    url.searchParams.set("page", page.toString())
    appendCategoryListParams(url)

    pagePromises.push(
      fetch(url.toString(), { headers: { Authorization: auth } }).then(async (res) => {
        if (!res.ok) throw new Error(`WordPress API error: ${res.status}`)
        return res.json()
      })
    )
  }

  const restPages = await Promise.all(pagePromises)
  return [...firstPage, ...restPages.flat()]
}

function cacheKey(userId: string | undefined, siteId: string, resource: "posts" | "categories"): string {
  return `wp:${userId ?? "anon"}:${siteId}:${resource}`
}

// GET /api/wp-proxy/:siteId/posts - Get all posts for a site
router.get("/:siteId/posts", async (req: Request, res: Response) => {
  try {
    const siteId = String(req.params.siteId)
    const rlUserId = (req as Request & { rlUserId?: string }).rlUserId
    const site = await findCanonicalSiteById(siteId)
    if (!site) {
      return res.status(404).json({ error: "Site not found" })
    }

    const credentials = await getCanonicalUserCredentials(rlUserId, siteId)
    if (!credentials) {
      return res.status(403).json({ error: "Not connected to this site. Please add your credentials first." })
    }

    const baseUrl = site.url.replace(/\/$/, "")
    const auth = "Basic " + Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString("base64")

    const ttl = getWpProxyTtlMs()
    const refresh = isRefreshQuery(req)
    const key = cacheKey(rlUserId, siteId, "posts")

    const { posts, total } = refresh
      ? await fetchAllPosts(baseUrl, auth)
      : await getOrSetCache(key, ttl, () => fetchAllPosts(baseUrl, auth))

    res.json({ data: posts, total, totalPages: 1 })
  } catch (error) {
    console.error("Error fetching posts:", error)
    const wpStatus = parseWpStatus(error)
    if (wpStatus === 401 || wpStatus === 403) {
      return res.status(502).json({
        error: "WordPress auth failed for this site connection",
        wpStatus,
      })
    }
    res.status(500).json({ error: "Failed to fetch posts from WordPress", wpStatus })
  }
})

// GET /api/wp-proxy/:siteId/categories - Get all categories for a site
router.get("/:siteId/categories", async (req: Request, res: Response) => {
  try {
    const siteId = String(req.params.siteId)
    const rlUserId = (req as Request & { rlUserId?: string }).rlUserId
    const site = await findCanonicalSiteById(siteId)
    if (!site) {
      return res.status(404).json({ error: "Site not found" })
    }

    const credentials = await getCanonicalUserCredentials(rlUserId, siteId)
    if (!credentials) {
      return res.status(403).json({ error: "Not connected to this site. Please add your credentials first." })
    }

    const baseUrl = site.url.replace(/\/$/, "")
    const auth = "Basic " + Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString("base64")

    const ttl = getWpProxyTtlMs()
    const refresh = isRefreshQuery(req)
    const key = cacheKey(rlUserId, siteId, "categories")

    const categories = refresh
      ? await fetchCategories(baseUrl, auth)
      : await getOrSetCache(key, ttl, () => fetchCategories(baseUrl, auth))

    res.json(categories)
  } catch (error) {
    console.error("Error fetching categories:", error)
    const wpStatus = parseWpStatus(error)
    if (wpStatus === 401 || wpStatus === 403) {
      return res.status(502).json({
        error: "WordPress auth failed for this site connection",
        wpStatus,
      })
    }
    res.status(500).json({ error: "Failed to fetch categories from WordPress", wpStatus })
  }
})

export default router
