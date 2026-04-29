import { Router, Request, Response } from "express"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { TodoConfigItem } from "../models/TodoConfigItem"

const router = Router()

interface LegacyChecklistItem {
  id?: string
  label?: string
  description?: string
  order?: number
  active?: boolean
  category?: string
}

interface TodoPayload {
  title?: string
  description?: string
  active?: boolean
  order?: number
  mainPrompt?: string
  additionalPrompts?: string[]
  technicalHints?: {
    examples?: string[]
    notes?: string
  }
  category?: string
}

function normalizeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback
}

function normalizePrompts(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
}

function toClientItem(item: Record<string, unknown>) {
  const technicalHints = (item.technicalHints || {}) as Record<string, unknown>
  return {
    _id: String(item._id || ""),
    id: String(item._id || ""),
    title: String(item.title || ""),
    label: String(item.title || ""),
    description: String(item.description || ""),
    active: Boolean(item.active),
    order: typeof item.order === "number" ? item.order : 0,
    mainPrompt: String(item.mainPrompt || ""),
    additionalPrompts: Array.isArray(item.additionalPrompts) ? item.additionalPrompts : [],
    technicalHints: {
      examples: normalizePrompts(technicalHints.examples),
      notes: normalizeText(technicalHints.notes),
    },
    category: normalizeText(item.category, "contenu"),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

async function readLegacyChecklistItems(): Promise<LegacyChecklistItem[]> {
  const currentFile = fileURLToPath(import.meta.url)
  const legacyPath = path.resolve(path.dirname(currentFile), "../../src/mocks/checklist_items.json")
  const raw = await readFile(legacyPath, "utf-8")
  const parsed = JSON.parse(raw) as unknown
  return Array.isArray(parsed) ? (parsed as LegacyChecklistItem[]) : []
}

export async function ensureTodoConfigSeeded(forceReplace = false): Promise<{ seeded: number; total: number }> {
  const existingCount = await TodoConfigItem.countDocuments()
  if (existingCount > 0 && !forceReplace) return { seeded: 0, total: existingCount }
  const legacyItems = await readLegacyChecklistItems()
  if (legacyItems.length === 0) return { seeded: 0, total: existingCount }

  if (forceReplace && existingCount > 0) {
    await TodoConfigItem.deleteMany({})
  }

  const toInsert = legacyItems.map((item, index) => ({
    title: normalizeText(item.label, `Tâche ${index + 1}`),
    description: normalizeText(item.description),
    active: typeof item.active === "boolean" ? item.active : true,
    order: typeof item.order === "number" ? item.order : index + 1,
    mainPrompt: normalizeText(item.description),
    additionalPrompts: [],
    technicalHints: {},
    category: normalizeText(item.category, "contenu"),
  }))

  if (toInsert.length > 0) {
    await TodoConfigItem.insertMany(toInsert)
  }

  const total = await TodoConfigItem.countDocuments()
  return { seeded: toInsert.length, total }
}

router.get("/", async (_req: Request, res: Response) => {
  try {
    await ensureTodoConfigSeeded(false)
    const items = await TodoConfigItem.find({}).sort({ order: 1, createdAt: 1 }).lean()
    res.json(items.map(toClientItem))
  } catch (error) {
    console.error("Error fetching todo config items:", error)
    res.status(500).json({ error: "Failed to fetch todo config items" })
  }
})

router.post("/", async (req: Request, res: Response) => {
  try {
    const payload = req.body as TodoPayload
    const title = normalizeText(payload.title)
    if (!title) {
      return res.status(400).json({ error: "title is required" })
    }

    const maxOrderItem = await TodoConfigItem.findOne({}).sort({ order: -1 }).lean()
    const nextOrder = typeof payload.order === "number" ? payload.order : ((maxOrderItem?.order as number | undefined) || 0) + 1

    const created = await TodoConfigItem.create({
      title,
      description: normalizeText(payload.description),
      active: typeof payload.active === "boolean" ? payload.active : true,
      order: nextOrder,
      mainPrompt: normalizeText(payload.mainPrompt),
      additionalPrompts: normalizePrompts(payload.additionalPrompts),
      technicalHints: {
        examples: normalizePrompts(payload.technicalHints?.examples),
        notes: normalizeText(payload.technicalHints?.notes),
      },
      category: normalizeText(payload.category, "contenu"),
    })

    res.status(201).json(toClientItem(created.toObject()))
  } catch (error) {
    console.error("Error creating todo config item:", error)
    res.status(500).json({ error: "Failed to create todo config item" })
  }
})

router.post("/reorder", async (req: Request, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]) : []
    const normalizedIds = ids
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter((id) => id.length > 0)
    if (normalizedIds.length === 0) {
      return res.status(400).json({ error: "ids array is required" })
    }

    await Promise.all(
      normalizedIds.map((id, index) =>
        TodoConfigItem.findByIdAndUpdate(id, { order: index + 1 }, { new: false })
      )
    )

    const items = await TodoConfigItem.find({}).sort({ order: 1, createdAt: 1 }).lean()
    res.json({ success: true, data: items.map(toClientItem) })
  } catch (error) {
    console.error("Error reordering todo config items:", error)
    res.status(500).json({ error: "Failed to reorder todo config items" })
  }
})

router.post("/import-legacy", async (req: Request, res: Response) => {
  try {
    const replace = req.body?.replace === true
    const result = await ensureTodoConfigSeeded(replace)
    const items = await TodoConfigItem.find({}).sort({ order: 1, createdAt: 1 }).lean()
    res.json({
      success: true,
      seeded: result.seeded,
      total: result.total,
      data: items.map(toClientItem),
    })
  } catch (error) {
    console.error("Error importing legacy todo items:", error)
    res.status(500).json({ error: "Failed to import legacy checklist items" })
  }
})

router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const payload = req.body as TodoPayload
    const update: Record<string, unknown> = {}
    if (payload.title !== undefined) {
      const title = normalizeText(payload.title)
      if (!title) return res.status(400).json({ error: "title cannot be empty" })
      update.title = title
    }
    if (payload.description !== undefined) update.description = normalizeText(payload.description)
    if (payload.active !== undefined) update.active = payload.active === true
    if (payload.order !== undefined && typeof payload.order === "number") update.order = payload.order
    if (payload.mainPrompt !== undefined) update.mainPrompt = normalizeText(payload.mainPrompt)
    if (payload.additionalPrompts !== undefined) update.additionalPrompts = normalizePrompts(payload.additionalPrompts)
    if (payload.category !== undefined) update.category = normalizeText(payload.category, "contenu")
    if (payload.technicalHints !== undefined) {
      update.technicalHints = {
        examples: normalizePrompts(payload.technicalHints.examples),
        notes: normalizeText(payload.technicalHints.notes),
      }
    }

    const updated = await TodoConfigItem.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    })
    if (!updated) return res.status(404).json({ error: "Todo item not found" })
    res.json(toClientItem(updated.toObject()))
  } catch (error) {
    console.error("Error updating todo config item:", error)
    res.status(500).json({ error: "Failed to update todo config item" })
  }
})

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const deleted = await TodoConfigItem.findByIdAndDelete(req.params.id)
    if (!deleted) return res.status(404).json({ error: "Todo item not found" })
    res.json({ success: true, message: "Todo item deleted successfully" })
  } catch (error) {
    console.error("Error deleting todo config item:", error)
    res.status(500).json({ error: "Failed to delete todo config item" })
  }
})

export default router
