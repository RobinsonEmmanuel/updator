import { Router, Request, Response } from "express"
import { SiteWeb } from "../models/SiteWeb"

const router = Router()

// GET /api/sites - List all available sites (read-only)
router.get("/", async (_req: Request, res: Response) => {
  try {
    const sites = await SiteWeb.find().sort({ name: 1 })
    res.json(sites)
  } catch (error) {
    console.error("Error fetching sites:", error)
    res.status(500).json({ error: "Failed to fetch sites" })
  }
})

// GET /api/sites/:id - Get single site
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const site = await SiteWeb.findById(req.params.id)
    if (!site) {
      return res.status(404).json({ error: "Site not found" })
    }
    res.json(site)
  } catch (error) {
    console.error("Error fetching site:", error)
    res.status(500).json({ error: "Failed to fetch site" })
  }
})

export default router
