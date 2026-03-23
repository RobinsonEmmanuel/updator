import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { Router } from "express"

const mockWpSite = {
  _id: "507f1f77bcf86cd799439011",
  name: "Test Site",
  url: "https://test.com",
  username: "user",
  appPassword: "pass",
  createdAt: new Date(),
}

const mockFind = vi.fn()
const mockFindById = vi.fn()
const mockFindByIdAndUpdate = vi.fn()
const mockFindByIdAndDelete = vi.fn()

function createApp() {
  const app = express()
  app.use(express.json())

  const router = Router()

  router.get("/", async (_req, res) => {
    const sites = await mockFind()
    res.json(sites)
  })

  router.get("/:id", async (req, res) => {
    const site = await mockFindById(req.params.id)
    if (!site) return res.status(404).json({ error: "Site not found" })
    res.json(site)
  })

  router.post("/", async (req, res) => {
    const { name, url, username, appPassword } = req.body
    if (!name || !url || !username || !appPassword) {
      return res.status(400).json({ error: "Missing required fields" })
    }
    res.status(201).json({ ...req.body, _id: "new-id" })
  })

  router.put("/:id", async (req, res) => {
    const site = await mockFindByIdAndUpdate(req.params.id, req.body)
    if (!site) return res.status(404).json({ error: "Site not found" })
    res.json({ ...site, ...req.body })
  })

  router.delete("/:id", async (req, res) => {
    const site = await mockFindByIdAndDelete(req.params.id)
    if (!site) return res.status(404).json({ error: "Site not found" })
    res.json({ message: "Site deleted successfully" })
  })

  app.use("/api/wp-sites", router)
  return app
}

const app = createApp()

describe("GET /api/wp-sites", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns empty array when no sites exist", async () => {
    mockFind.mockResolvedValueOnce([])
    const res = await request(app).get("/api/wp-sites")
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it("returns all sites", async () => {
    mockFind.mockResolvedValueOnce([mockWpSite, { ...mockWpSite, _id: "2", name: "Site 2" }])
    const res = await request(app).get("/api/wp-sites")
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })
})

describe("GET /api/wp-sites/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns a site by id", async () => {
    mockFindById.mockResolvedValueOnce(mockWpSite)
    const res = await request(app).get("/api/wp-sites/507f1f77bcf86cd799439011")
    expect(res.status).toBe(200)
    expect(res.body.name).toBe("Test Site")
  })

  it("returns 404 for non-existent site", async () => {
    mockFindById.mockResolvedValueOnce(null)
    const res = await request(app).get("/api/wp-sites/nonexistent")
    expect(res.status).toBe(404)
    expect(res.body.error).toBe("Site not found")
  })
})

describe("POST /api/wp-sites", () => {
  it("creates a new site", async () => {
    const siteData = {
      name: "New Site",
      url: "https://newsite.com",
      username: "admin",
      appPassword: "secret123",
    }

    const res = await request(app).post("/api/wp-sites").send(siteData)
    expect(res.status).toBe(201)
    expect(res.body.name).toBe("New Site")
    expect(res.body._id).toBeDefined()
  })

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app).post("/api/wp-sites").send({ name: "Incomplete" })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe("Missing required fields")
  })
})

describe("PUT /api/wp-sites/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates a site", async () => {
    mockFindByIdAndUpdate.mockResolvedValueOnce(mockWpSite)
    const res = await request(app)
      .put("/api/wp-sites/507f1f77bcf86cd799439011")
      .send({ name: "Updated" })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe("Updated")
  })

  it("returns 404 for non-existent site", async () => {
    mockFindByIdAndUpdate.mockResolvedValueOnce(null)
    const res = await request(app)
      .put("/api/wp-sites/nonexistent")
      .send({ name: "Test" })
    expect(res.status).toBe(404)
  })
})

describe("DELETE /api/wp-sites/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes a site", async () => {
    mockFindByIdAndDelete.mockResolvedValueOnce(mockWpSite)
    const res = await request(app).delete("/api/wp-sites/507f1f77bcf86cd799439011")
    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Site deleted successfully")
  })

  it("returns 404 for non-existent site", async () => {
    mockFindByIdAndDelete.mockResolvedValueOnce(null)
    const res = await request(app).delete("/api/wp-sites/nonexistent")
    expect(res.status).toBe(404)
  })
})
