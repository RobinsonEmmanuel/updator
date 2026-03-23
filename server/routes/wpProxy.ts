import { Router, Request, Response } from "express"
import { SiteWeb } from "../models/SiteWeb"
import { Actualisateur } from "../models/Actualisateur"
import { decryptAppPassword } from "../lib/credentialsCrypto"

const router = Router()

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

async function fetchAllPosts(baseUrl: string, auth: string): Promise<{ posts: any[]; total: number }> {
  const allPosts: any[] = []
  let page = 1
  let totalPages = 1
  let total = 0

  while (page <= totalPages) {
    const url = new URL(`${baseUrl}/wp-json/wp/v2/posts`)
    url.searchParams.set("per_page", "100")
    url.searchParams.set("page", page.toString())
    url.searchParams.set("orderby", "modified")
    url.searchParams.set("order", "asc")

    const response = await fetch(url.toString(), {
      headers: { Authorization: auth },
    })

    if (!response.ok) {
      throw new Error(`WordPress API error: ${response.status}`)
    }

    const posts = await response.json()
    allPosts.push(...posts)

    if (page === 1) {
      total = parseInt(response.headers.get("X-WP-Total") || "0", 10)
      totalPages = parseInt(response.headers.get("X-WP-TotalPages") || "1", 10)
    }

    page++
  }

  return { posts: allPosts, total }
}

async function fetchCategories(baseUrl: string, auth: string): Promise<any[]> {
  const allCategories: any[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const url = new URL(`${baseUrl}/wp-json/wp/v2/categories`)
    url.searchParams.set("per_page", "100")
    url.searchParams.set("page", page.toString())

    const response = await fetch(url.toString(), {
      headers: { Authorization: auth },
    })

    if (!response.ok) {
      throw new Error(`WordPress API error: ${response.status}`)
    }

    const categories = await response.json()
    allCategories.push(...categories)

    if (page === 1) {
      totalPages = parseInt(response.headers.get("X-WP-TotalPages") || "1", 10)
    }

    page++
  }

  return allCategories
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

    const { posts, total } = await fetchAllPosts(baseUrl, auth)

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

    const categories = await fetchCategories(baseUrl, auth)

    res.json(categories)
  } catch (error) {
    console.error("Error fetching categories:", error)
    res.status(500).json({ error: "Failed to fetch categories from WordPress" })
  }
})

export default router
