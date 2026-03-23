import { Router, Request, Response } from "express"
import { SiteWeb } from "../models/SiteWeb"
import { Actualisateur } from "../models/Actualisateur"
import { decryptAppPassword } from "../lib/credentialsCrypto"
import { getOrSetCache, getWpProxyTtlMs } from "../lib/wpProxyCache"

const router = Router()

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

async function getUserCredentials(req: Request, siteId: string) {
  const user = await Actualisateur.findById(req.rlUserId)
  if (!user) return null

  const connection = user.siteConnections.find(
    (conn) => conn.siteId.toString() === siteId
  )
  if (!connection) return null

  return {
    username: connection.username,
    appPassword: decryptAppPassword(connection.appPassword),
  }
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
    const site = await SiteWeb.findById(req.params.siteId)
    if (!site) {
      return res.status(404).json({ error: "Site not found" })
    }

    const credentials = await getUserCredentials(req, req.params.siteId)
    if (!credentials) {
      return res.status(403).json({ error: "Not connected to this site. Please add your credentials first." })
    }

    const baseUrl = site.url.replace(/\/$/, "")
    const auth = "Basic " + Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString("base64")

    const ttl = getWpProxyTtlMs()
    const refresh = isRefreshQuery(req)
    const key = cacheKey(req.rlUserId, req.params.siteId, "posts")

    const { posts, total } = refresh
      ? await fetchAllPosts(baseUrl, auth)
      : await getOrSetCache(key, ttl, () => fetchAllPosts(baseUrl, auth))

    res.json({ data: posts, total, totalPages: 1 })
  } catch (error) {
    console.error("Error fetching posts:", error)
    res.status(500).json({ error: "Failed to fetch posts from WordPress" })
  }
})

// GET /api/wp-proxy/:siteId/categories - Get all categories for a site
router.get("/:siteId/categories", async (req: Request, res: Response) => {
  try {
    const site = await SiteWeb.findById(req.params.siteId)
    if (!site) {
      return res.status(404).json({ error: "Site not found" })
    }

    const credentials = await getUserCredentials(req, req.params.siteId)
    if (!credentials) {
      return res.status(403).json({ error: "Not connected to this site. Please add your credentials first." })
    }

    const baseUrl = site.url.replace(/\/$/, "")
    const auth = "Basic " + Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString("base64")

    const ttl = getWpProxyTtlMs()
    const refresh = isRefreshQuery(req)
    const key = cacheKey(req.rlUserId, req.params.siteId, "categories")

    const categories = refresh
      ? await fetchCategories(baseUrl, auth)
      : await getOrSetCache(key, ttl, () => fetchCategories(baseUrl, auth))

    res.json(categories)
  } catch (error) {
    console.error("Error fetching categories:", error)
    res.status(500).json({ error: "Failed to fetch categories from WordPress" })
  }
})

export default router
