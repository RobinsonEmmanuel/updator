import { Router, Request, Response } from "express"
import { Actualisateur } from "../models/Actualisateur"
import { SiteWeb } from "../models/SiteWeb"
import mongoose from "mongoose"
import { encryptAppPassword } from "../lib/credentialsCrypto"

const router = Router()

async function getUserFromRequest(req: Request) {
  const user = await Actualisateur.findById(req.rlUserId)
  return user
}

// GET /api/user/sites - Get user's connected sites with site details
router.get("/", async (req: Request, res: Response) => {
  try {
    const user = await getUserFromRequest(req)
    if (!user) {
      return res.status(401).json({ error: "User not found" })
    }
    await user.populate("siteConnections.siteId")

    const connectedSites = user.siteConnections.map((conn: any) => ({
      _id: conn.siteId._id,
      name: conn.siteId.name,
      url: conn.siteId.url,
      username: conn.username,
      hasPassword: !!conn.appPassword,
    }))

    res.json(connectedSites)
  } catch (error) {
    console.error("Error fetching user sites:", error)
    res.status(500).json({ error: "Failed to fetch connected sites" })
  }
})

// POST /api/user/sites/:siteId/connect - Connect to a site with credentials
router.post("/:siteId/connect", async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params
    const { username, appPassword } = req.body

    if (!username || !appPassword) {
      return res.status(400).json({ error: "Username and appPassword required" })
    }

    const site = await SiteWeb.findById(siteId)
    if (!site) {
      return res.status(404).json({ error: "Site not found" })
    }

    const user = await getUserFromRequest(req)
    if (!user) {
      return res.status(401).json({ error: "User not found" })
    }

    const storedPassword = encryptAppPassword(appPassword)

    const existingIndex = user.siteConnections.findIndex(
      (conn) => conn.siteId.toString() === siteId
    )

    if (existingIndex >= 0) {
      user.siteConnections[existingIndex].username = username
      user.siteConnections[existingIndex].appPassword = storedPassword
    } else {
      user.siteConnections.push({
        siteId: new mongoose.Types.ObjectId(siteId),
        username,
        appPassword: storedPassword,
      })
    }

    await user.save()

    res.json({
      success: true,
      message: `Connected to ${site.name}`,
      site: {
        _id: site._id,
        name: site.name,
        url: site.url,
        username,
      },
    })
  } catch (error) {
    console.error("Error connecting to site:", error)
    const message = error instanceof Error ? error.message : "Failed to connect to site"
    if (message.includes("WP_CREDENTIALS_SECRET")) {
      return res.status(500).json({ error: "Server misconfiguration: WP_CREDENTIALS_SECRET" })
    }
    res.status(500).json({ error: "Failed to connect to site" })
  }
})

// DELETE /api/user/sites/:siteId/disconnect - Disconnect from a site
router.delete("/:siteId/disconnect", async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params
    const user = await getUserFromRequest(req)
    if (!user) {
      return res.status(401).json({ error: "User not found" })
    }

    user.siteConnections = user.siteConnections.filter(
      (conn) => conn.siteId.toString() !== siteId
    )

    await user.save()

    res.json({ success: true, message: "Disconnected from site" })
  } catch (error) {
    console.error("Error disconnecting from site:", error)
    res.status(500).json({ error: "Failed to disconnect from site" })
  }
})

// POST /api/user/sites/:siteId/test - Test connection to a site (uses credentials from body)
router.post("/:siteId/test", async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params
    const { username, appPassword } = req.body

    const site = await SiteWeb.findById(siteId)
    if (!site) {
      return res.status(404).json({ error: "Site not found" })
    }

    if (!username || !appPassword) {
      return res.status(400).json({ error: "Username and appPassword required" })
    }

    const baseUrl = site.url.replace(/\/$/, "")
    const auth = "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64")

    const postsUrl = new URL(`${baseUrl}/wp-json/wp/v2/posts`)
    postsUrl.searchParams.set("per_page", "1")

    const postsResponse = await fetch(postsUrl.toString(), {
      headers: { Authorization: auth },
    })

    if (!postsResponse.ok) {
      return res.json({
        success: false,
        error: `WordPress returned ${postsResponse.status}`,
      })
    }

    const postsTotal = parseInt(postsResponse.headers.get("X-WP-Total") || "0", 10)

    const categoriesUrl = new URL(`${baseUrl}/wp-json/wp/v2/categories`)
    const categoriesResponse = await fetch(categoriesUrl.toString(), {
      headers: { Authorization: auth },
    })

    const categories = await categoriesResponse.json()

    res.json({
      success: true,
      postsCount: postsTotal,
      categoriesCount: Array.isArray(categories) ? categories.length : 0,
    })
  } catch (error) {
    console.error("Error testing connection:", error)
    res.json({ success: false, error: "Failed to connect to WordPress" })
  }
})

export default router
