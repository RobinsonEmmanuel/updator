import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { Router } from "express"

const mockDraft = {
  _id: "507f1f77bcf86cd799439011",
  articleId: "art-001",
  content: "Test content",
  author: "Julie",
  status: "editing",
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockFind = vi.fn()
const mockFindById = vi.fn()
const mockFindOne = vi.fn()
const mockFindByIdAndUpdate = vi.fn()
const mockFindByIdAndDelete = vi.fn()
const mockInsertMany = vi.fn()
const mockDeleteMany = vi.fn()

function createApp() {
  const app = express()
  app.use(express.json())

  const router = Router()

  router.get("/", async (req, res) => {
    const { status, siteId, articleId } = req.query
    const filter: Record<string, unknown> = {}
    if (status) filter.status = status
    if (siteId) filter.siteId = siteId
    if (articleId) filter.articleId = articleId
    const drafts = await mockFind(filter)
    res.json(drafts)
  })

  router.get("/article/:articleId", async (req, res) => {
    const draft = await mockFindOne({ articleId: req.params.articleId })
    if (!draft) return res.status(404).json({ error: "Draft not found for this article" })
    res.json(draft)
  })

  router.get("/:id", async (req, res) => {
    const draft = await mockFindById(req.params.id)
    if (!draft) return res.status(404).json({ error: "Draft not found" })
    res.json(draft)
  })

  router.post("/", async (req, res) => {
    const { articleId, content, author } = req.body
    if (!articleId || !content || !author) {
      return res.status(400).json({ error: "Missing required fields: articleId, content, author" })
    }
    const existing = await mockFindOne({ articleId })
    if (existing) {
      return res.status(400).json({ error: "A draft already exists for this article" })
    }
    res.status(201).json({ ...req.body, _id: "new-id", status: "editing" })
  })

  router.put("/:id", async (req, res) => {
    const draft = await mockFindByIdAndUpdate(req.params.id, req.body)
    if (!draft) return res.status(404).json({ error: "Draft not found" })
    res.json({ ...draft, ...req.body })
  })

  router.put("/:id/ready", async (req, res) => {
    const draft = await mockFindByIdAndUpdate(req.params.id, { status: "ready_to_push" })
    if (!draft) return res.status(404).json({ error: "Draft not found" })
    res.json({ ...draft, status: "ready_to_push" })
  })

  router.put("/:id/push", async (req, res) => {
    const draft = await mockFindByIdAndUpdate(req.params.id, { status: "pushed" })
    if (!draft) return res.status(404).json({ error: "Draft not found" })
    res.json({ ...draft, status: "pushed" })
  })

  router.delete("/:id", async (req, res) => {
    const draft = await mockFindByIdAndDelete(req.params.id)
    if (!draft) return res.status(404).json({ error: "Draft not found" })
    res.json({ message: "Draft deleted successfully" })
  })

  router.post("/seed", async (_req, res) => {
    await mockDeleteMany()
    const drafts = await mockInsertMany([mockDraft])
    res.json({ message: `Seeded drafts`, drafts })
  })

  app.use("/api/drafts", router)
  return app
}

const app = createApp()

describe("GET /api/drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFind.mockResolvedValue([])
  })

  it("returns drafts", async () => {
    const res = await request(app).get("/api/drafts")
    expect(res.status).toBe(200)
    expect(mockFind).toHaveBeenCalledWith({})
  })

  it("filters drafts by status", async () => {
    const res = await request(app).get("/api/drafts?status=editing")
    expect(res.status).toBe(200)
    expect(mockFind).toHaveBeenCalledWith({ status: "editing" })
  })
})

describe("GET /api/drafts/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns a draft by id", async () => {
    mockFindById.mockResolvedValueOnce(mockDraft)
    const res = await request(app).get("/api/drafts/507f1f77bcf86cd799439011")
    expect(res.status).toBe(200)
    expect(res.body.articleId).toBe("art-001")
  })

  it("returns 404 for non-existent draft", async () => {
    mockFindById.mockResolvedValueOnce(null)
    const res = await request(app).get("/api/drafts/nonexistent")
    expect(res.status).toBe(404)
  })
})

describe("GET /api/drafts/article/:articleId", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns a draft for an article", async () => {
    mockFindOne.mockResolvedValueOnce(mockDraft)
    const res = await request(app).get("/api/drafts/article/art-001")
    expect(res.status).toBe(200)
    expect(res.body.articleId).toBe("art-001")
  })

  it("returns 404 when no draft exists", async () => {
    mockFindOne.mockResolvedValueOnce(null)
    const res = await request(app).get("/api/drafts/article/nonexistent")
    expect(res.status).toBe(404)
  })
})

describe("POST /api/drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a new draft", async () => {
    mockFindOne.mockResolvedValueOnce(null)
    const draftData = {
      articleId: "art-new",
      content: "<h2>New Article</h2>",
      author: "Julie",
    }
    const res = await request(app).post("/api/drafts").send(draftData)
    expect(res.status).toBe(201)
    expect(res.body.articleId).toBe("art-new")
    expect(res.body.status).toBe("editing")
  })

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app).post("/api/drafts").send({ articleId: "incomplete" })
    expect(res.status).toBe(400)
  })

  it("returns 400 when draft already exists", async () => {
    mockFindOne.mockResolvedValueOnce(mockDraft)
    const res = await request(app).post("/api/drafts").send({
      articleId: "art-001",
      content: "New content",
      author: "Manu",
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("A draft already exists for this article")
  })
})

describe("PUT /api/drafts/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates a draft", async () => {
    mockFindByIdAndUpdate.mockResolvedValueOnce(mockDraft)
    const res = await request(app)
      .put("/api/drafts/507f1f77bcf86cd799439011")
      .send({ content: "Updated content" })
    expect(res.status).toBe(200)
    expect(res.body.content).toBe("Updated content")
  })

  it("returns 404 for non-existent draft", async () => {
    mockFindByIdAndUpdate.mockResolvedValueOnce(null)
    const res = await request(app)
      .put("/api/drafts/nonexistent")
      .send({ content: "Test" })
    expect(res.status).toBe(404)
  })
})

describe("PUT /api/drafts/:id/ready", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("marks a draft as ready to push", async () => {
    mockFindByIdAndUpdate.mockResolvedValueOnce(mockDraft)
    const res = await request(app).put("/api/drafts/507f1f77bcf86cd799439011/ready")
    expect(res.status).toBe(200)
    expect(res.body.status).toBe("ready_to_push")
  })
})

describe("PUT /api/drafts/:id/push", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("marks a draft as pushed", async () => {
    mockFindByIdAndUpdate.mockResolvedValueOnce(mockDraft)
    const res = await request(app).put("/api/drafts/507f1f77bcf86cd799439011/push")
    expect(res.status).toBe(200)
    expect(res.body.status).toBe("pushed")
  })
})

describe("DELETE /api/drafts/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes a draft", async () => {
    mockFindByIdAndDelete.mockResolvedValueOnce(mockDraft)
    const res = await request(app).delete("/api/drafts/507f1f77bcf86cd799439011")
    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Draft deleted successfully")
  })

  it("returns 404 for non-existent draft", async () => {
    mockFindByIdAndDelete.mockResolvedValueOnce(null)
    const res = await request(app).delete("/api/drafts/nonexistent")
    expect(res.status).toBe(404)
  })
})

describe("POST /api/drafts/seed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("seeds drafts", async () => {
    mockInsertMany.mockResolvedValueOnce([mockDraft])
    const res = await request(app).post("/api/drafts/seed")
    expect(res.status).toBe(200)
    expect(res.body.drafts).toBeDefined()
  })
})
