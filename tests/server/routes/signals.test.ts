import { describe, it, expect, vi, beforeEach } from "vitest"
import request from "supertest"
import express, { Router } from "express"

const mockSignal = {
  _id: "507f1f77bcf86cd799439011",
  entityName: "Test Signal",
  type: "closure",
  note: "Test note",
  detectedAt: new Date(),
  detectedBy: "User",
  status: "open",
}

const mockFind = vi.fn()
const mockFindByIdAndUpdate = vi.fn()
const mockFindByIdAndDelete = vi.fn()
const mockInsertMany = vi.fn()
const mockDeleteMany = vi.fn()

function createApp() {
  const app = express()
  app.use(express.json())

  const router = Router()

  router.get("/", async (req, res) => {
    const { status, siteId } = req.query
    const filter: Record<string, unknown> = {}
    if (status) filter.status = status
    if (siteId) filter.siteId = siteId
    const signals = await mockFind(filter)
    res.json(signals)
  })

  router.get("/open", async (req, res) => {
    const { siteId } = req.query
    const filter: Record<string, unknown> = { status: "open" }
    if (siteId) filter.siteId = siteId
    const signals = await mockFind(filter)
    res.json(signals)
  })

  router.post("/", async (req, res) => {
    const { entityName, type, note, detectedBy } = req.body
    if (!entityName || !type || !note || !detectedBy) {
      return res.status(400).json({ error: "Missing required fields" })
    }
    res.status(201).json({ ...req.body, _id: "new-id", status: "open", detectedAt: new Date() })
  })

  router.put("/:id/resolve", async (req, res) => {
    const signal = await mockFindByIdAndUpdate(req.params.id, { status: "resolved" })
    if (!signal) return res.status(404).json({ error: "Signal not found" })
    res.json({ ...signal, status: "resolved" })
  })

  router.put("/:id/dismiss", async (req, res) => {
    const signal = await mockFindByIdAndUpdate(req.params.id, { status: "dismissed" })
    if (!signal) return res.status(404).json({ error: "Signal not found" })
    res.json({ ...signal, status: "dismissed" })
  })

  router.delete("/:id", async (req, res) => {
    const signal = await mockFindByIdAndDelete(req.params.id)
    if (!signal) return res.status(404).json({ error: "Signal not found" })
    res.json({ message: "Signal deleted successfully" })
  })

  router.post("/seed", async (_req, res) => {
    await mockDeleteMany()
    const signals = await mockInsertMany([mockSignal])
    res.json({ message: `Seeded signals`, signals })
  })

  app.use("/api/signals", router)
  return app
}

const app = createApp()

describe("GET /api/signals", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFind.mockResolvedValue([])
  })

  it("returns signals", async () => {
    const res = await request(app).get("/api/signals")
    expect(res.status).toBe(200)
    expect(mockFind).toHaveBeenCalledWith({})
  })

  it("filters signals by status", async () => {
    const res = await request(app).get("/api/signals?status=open")
    expect(res.status).toBe(200)
    expect(mockFind).toHaveBeenCalledWith({ status: "open" })
  })
})

describe("GET /api/signals/open", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns only open signals", async () => {
    mockFind.mockResolvedValueOnce([mockSignal])
    const res = await request(app).get("/api/signals/open")
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].status).toBe("open")
  })
})

describe("POST /api/signals", () => {
  it("creates a new signal", async () => {
    const signalData = {
      entityName: "New Restaurant",
      type: "closure",
      note: "Restaurant closed",
      detectedBy: "Julie",
    }
    const res = await request(app).post("/api/signals").send(signalData)
    expect(res.status).toBe(201)
    expect(res.body.entityName).toBe("New Restaurant")
    expect(res.body.status).toBe("open")
  })

  it("returns 400 when required fields are missing", async () => {
    const res = await request(app).post("/api/signals").send({ entityName: "Incomplete" })
    expect(res.status).toBe(400)
  })
})

describe("PUT /api/signals/:id/resolve", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("resolves a signal", async () => {
    mockFindByIdAndUpdate.mockResolvedValueOnce(mockSignal)
    const res = await request(app).put("/api/signals/507f1f77bcf86cd799439011/resolve")
    expect(res.status).toBe(200)
    expect(res.body.status).toBe("resolved")
  })

  it("returns 404 for non-existent signal", async () => {
    mockFindByIdAndUpdate.mockResolvedValueOnce(null)
    const res = await request(app).put("/api/signals/nonexistent/resolve")
    expect(res.status).toBe(404)
  })
})

describe("PUT /api/signals/:id/dismiss", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("dismisses a signal", async () => {
    mockFindByIdAndUpdate.mockResolvedValueOnce(mockSignal)
    const res = await request(app).put("/api/signals/507f1f77bcf86cd799439011/dismiss")
    expect(res.status).toBe(200)
    expect(res.body.status).toBe("dismissed")
  })
})

describe("DELETE /api/signals/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes a signal", async () => {
    mockFindByIdAndDelete.mockResolvedValueOnce(mockSignal)
    const res = await request(app).delete("/api/signals/507f1f77bcf86cd799439011")
    expect(res.status).toBe(200)
    expect(res.body.message).toBe("Signal deleted successfully")
  })

  it("returns 404 for non-existent signal", async () => {
    mockFindByIdAndDelete.mockResolvedValueOnce(null)
    const res = await request(app).delete("/api/signals/nonexistent")
    expect(res.status).toBe(404)
  })
})

describe("POST /api/signals/seed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("seeds signals", async () => {
    mockInsertMany.mockResolvedValueOnce([mockSignal])
    const res = await request(app).post("/api/signals/seed")
    expect(res.status).toBe(200)
    expect(res.body.signals).toBeDefined()
  })
})
