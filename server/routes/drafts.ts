import { Router, Request, Response } from "express"
import { Draft } from "../models/Draft"

const router = Router()

// GET /api/drafts - List all drafts
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, siteId, articleId } = req.query
    
    const filter: Record<string, unknown> = {}
    if (status) filter.status = status
    if (siteId) filter.siteId = siteId
    if (articleId) filter.articleId = articleId

    const drafts = await Draft.find(filter).sort({ updatedAt: -1 })
    res.json(drafts)
  } catch (error) {
    console.error("Error fetching drafts:", error)
    res.status(500).json({ error: "Failed to fetch drafts" })
  }
})

// GET /api/drafts/:id - Get single draft
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const draft = await Draft.findById(req.params.id)
    if (!draft) {
      return res.status(404).json({ error: "Draft not found" })
    }
    res.json(draft)
  } catch (error) {
    console.error("Error fetching draft:", error)
    res.status(500).json({ error: "Failed to fetch draft" })
  }
})

// GET /api/drafts/article/:articleId - Get draft for a specific article
router.get("/article/:articleId", async (req: Request, res: Response) => {
  try {
    const draft = await Draft.findOne({ articleId: req.params.articleId })
    if (!draft) {
      return res.status(404).json({ error: "Draft not found for this article" })
    }
    res.json(draft)
  } catch (error) {
    console.error("Error fetching draft:", error)
    res.status(500).json({ error: "Failed to fetch draft" })
  }
})

// POST /api/drafts - Create new draft
router.post("/", async (req: Request, res: Response) => {
  try {
    const { articleId, siteId, clusterId, content, checksSnapshot, author } = req.body

    if (!articleId || !content || !author) {
      return res.status(400).json({ error: "Missing required fields: articleId, content, author" })
    }

    const existingDraft = await Draft.findOne({ articleId })
    if (existingDraft) {
      return res.status(400).json({ error: "A draft already exists for this article" })
    }

    const draft = new Draft({
      articleId,
      siteId,
      clusterId,
      content,
      checksSnapshot: checksSnapshot || {},
      author,
      status: "editing"
    })

    await draft.save()
    res.status(201).json(draft)
  } catch (error) {
    console.error("Error creating draft:", error)
    res.status(500).json({ error: "Failed to create draft" })
  }
})

// PUT /api/drafts/:id - Update draft
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const draft = await Draft.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    )

    if (!draft) {
      return res.status(404).json({ error: "Draft not found" })
    }

    res.json(draft)
  } catch (error) {
    console.error("Error updating draft:", error)
    res.status(500).json({ error: "Failed to update draft" })
  }
})

// PUT /api/drafts/:id/ready - Mark draft as ready to push
router.put("/:id/ready", async (req: Request, res: Response) => {
  try {
    const draft = await Draft.findByIdAndUpdate(
      req.params.id,
      { status: "ready_to_push", updatedAt: new Date() },
      { new: true }
    )

    if (!draft) {
      return res.status(404).json({ error: "Draft not found" })
    }

    res.json(draft)
  } catch (error) {
    console.error("Error marking draft as ready:", error)
    res.status(500).json({ error: "Failed to mark draft as ready" })
  }
})

// PUT /api/drafts/:id/push - Mark draft as pushed
router.put("/:id/push", async (req: Request, res: Response) => {
  try {
    const draft = await Draft.findByIdAndUpdate(
      req.params.id,
      { status: "pushed", updatedAt: new Date() },
      { new: true }
    )

    if (!draft) {
      return res.status(404).json({ error: "Draft not found" })
    }

    res.json(draft)
  } catch (error) {
    console.error("Error marking draft as pushed:", error)
    res.status(500).json({ error: "Failed to mark draft as pushed" })
  }
})

// DELETE /api/drafts/:id - Delete draft
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const draft = await Draft.findByIdAndDelete(req.params.id)

    if (!draft) {
      return res.status(404).json({ error: "Draft not found" })
    }

    res.json({ message: "Draft deleted successfully" })
  } catch (error) {
    console.error("Error deleting draft:", error)
    res.status(500).json({ error: "Failed to delete draft" })
  }
})

// POST /api/drafts/seed - Seed drafts from mock data
router.post("/seed", async (req: Request, res: Response) => {
  try {
    const mockDrafts = [
      {
        articleId: "art-001",
        content: "<h2>Article exemple</h2><p>Contenu de l'article mis à jour.</p>",
        checksSnapshot: { "check-liens-generaux": true },
        author: "Julie",
        status: "editing"
      },
      {
        articleId: "art-002",
        content: "<h2>Guide complet</h2><p>Un guide détaillé avec toutes les informations.</p>",
        checksSnapshot: { "check-liens-generaux": true, "check-booking": true },
        author: "Manu",
        status: "ready_to_push"
      }
    ]

    await Draft.deleteMany({})
    const drafts = await Draft.insertMany(mockDrafts)
    
    res.json({ message: `Seeded ${drafts.length} drafts`, drafts })
  } catch (error) {
    console.error("Error seeding drafts:", error)
    res.status(500).json({ error: "Failed to seed drafts" })
  }
})

export default router
