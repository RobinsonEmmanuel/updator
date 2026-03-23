import { Router, Request, Response } from "express"
import { Signal } from "../models/Signal"

const router = Router()

// GET /api/signals - List all signals
router.get("/", async (req: Request, res: Response) => {
  try {
    const { status, siteId } = req.query
    
    const filter: Record<string, unknown> = {}
    if (status) filter.status = status
    if (siteId) filter.siteId = siteId

    const signals = await Signal.find(filter).sort({ detectedAt: -1 })
    res.json(signals)
  } catch (error) {
    console.error("Error fetching signals:", error)
    res.status(500).json({ error: "Failed to fetch signals" })
  }
})

// GET /api/signals/open - List open signals
router.get("/open", async (req: Request, res: Response) => {
  try {
    const { siteId } = req.query
    
    const filter: Record<string, unknown> = { status: "open" }
    if (siteId) filter.siteId = siteId

    const signals = await Signal.find(filter).sort({ detectedAt: -1 })
    res.json(signals)
  } catch (error) {
    console.error("Error fetching open signals:", error)
    res.status(500).json({ error: "Failed to fetch signals" })
  }
})

// GET /api/signals/:id - Get single signal
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const signal = await Signal.findById(req.params.id)
    if (!signal) {
      return res.status(404).json({ error: "Signal not found" })
    }
    res.json(signal)
  } catch (error) {
    console.error("Error fetching signal:", error)
    res.status(500).json({ error: "Failed to fetch signal" })
  }
})

// POST /api/signals - Create new signal
router.post("/", async (req: Request, res: Response) => {
  try {
    const { entityName, type, note, siteId, clusterIds, detectedBy, sourceUrl, expiresAt } = req.body

    if (!entityName || !type || !note || !detectedBy) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    const signal = new Signal({
      entityName,
      type,
      note,
      siteId,
      clusterIds: clusterIds || [],
      detectedAt: new Date(),
      detectedBy,
      status: "open",
      sourceUrl,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    })

    await signal.save()
    res.status(201).json(signal)
  } catch (error) {
    console.error("Error creating signal:", error)
    res.status(500).json({ error: "Failed to create signal" })
  }
})

// PUT /api/signals/:id - Update signal
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const signal = await Signal.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )

    if (!signal) {
      return res.status(404).json({ error: "Signal not found" })
    }

    res.json(signal)
  } catch (error) {
    console.error("Error updating signal:", error)
    res.status(500).json({ error: "Failed to update signal" })
  }
})

// PUT /api/signals/:id/resolve - Resolve a signal
router.put("/:id/resolve", async (req: Request, res: Response) => {
  try {
    const signal = await Signal.findByIdAndUpdate(
      req.params.id,
      { status: "resolved" },
      { new: true }
    )

    if (!signal) {
      return res.status(404).json({ error: "Signal not found" })
    }

    res.json(signal)
  } catch (error) {
    console.error("Error resolving signal:", error)
    res.status(500).json({ error: "Failed to resolve signal" })
  }
})

// PUT /api/signals/:id/dismiss - Dismiss a signal
router.put("/:id/dismiss", async (req: Request, res: Response) => {
  try {
    const signal = await Signal.findByIdAndUpdate(
      req.params.id,
      { status: "dismissed" },
      { new: true }
    )

    if (!signal) {
      return res.status(404).json({ error: "Signal not found" })
    }

    res.json(signal)
  } catch (error) {
    console.error("Error dismissing signal:", error)
    res.status(500).json({ error: "Failed to dismiss signal" })
  }
})

// DELETE /api/signals/:id - Delete signal
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const signal = await Signal.findByIdAndDelete(req.params.id)

    if (!signal) {
      return res.status(404).json({ error: "Signal not found" })
    }

    res.json({ message: "Signal deleted successfully" })
  } catch (error) {
    console.error("Error deleting signal:", error)
    res.status(500).json({ error: "Failed to delete signal" })
  }
})

// POST /api/signals/seed - Seed signals from mock data
router.post("/seed", async (req: Request, res: Response) => {
  try {
    const mockSignals = [
      {
        entityName: "Riad Jardin Secret",
        type: "closure",
        note: "Fermé définitivement depuis janvier 2026. À retirer de tous les articles Marrakech.",
        clusterIds: ["cluster-maroc-marrakech", "cluster-maroc-bestof"],
        detectedAt: new Date("2026-02-15T10:00:00Z"),
        detectedBy: "Julie",
        status: "open",
        expiresAt: new Date("2026-03-17T10:00:00Z")
      },
      {
        entityName: "Excursion Essaouira",
        type: "price_change",
        note: "Prix passé de 45€ à 65€ depuis février 2026. Vérifier sur tous les articles Maroc.",
        clusterIds: ["cluster-maroc-agadir", "cluster-maroc-marrakech"],
        detectedAt: new Date("2026-03-01T14:30:00Z"),
        detectedBy: "gpt",
        status: "open",
        expiresAt: new Date("2026-03-31T14:30:00Z")
      },
      {
        entityName: "Hôtel Bela Vista",
        type: "closure",
        note: "En rénovation jusqu'à septembre 2026. Ne plus recommander temporairement.",
        clusterIds: ["cluster-portugal-porto", "cluster-portugal-bestof"],
        detectedAt: new Date("2026-02-20T09:00:00Z"),
        detectedBy: "Myriam",
        status: "open",
        expiresAt: new Date("2026-03-22T09:00:00Z")
      },
      {
        entityName: "Sagrada Familia",
        type: "price_change",
        note: "Nouveau tarif : 26€ au lieu de 20€ depuis mars 2026.",
        clusterIds: ["cluster-espagne-barcelone"],
        detectedAt: new Date("2026-03-05T11:00:00Z"),
        detectedBy: "Claire",
        status: "open",
        expiresAt: new Date("2026-04-04T11:00:00Z")
      },
      {
        entityName: "Trattoria da Luigi",
        type: "closure",
        note: "Restaurant fermé. Le propriétaire a pris sa retraite.",
        clusterIds: ["cluster-italie-rome"],
        detectedAt: new Date("2026-03-10T16:00:00Z"),
        detectedBy: "Manu",
        status: "open",
        expiresAt: new Date("2026-04-09T16:00:00Z")
      },
      {
        entityName: "Ferry Santorin",
        type: "new_info",
        note: "Nouvelle compagnie SeaJets avec trajets plus rapides. À mentionner dans les guides.",
        clusterIds: ["cluster-grece-santorin", "cluster-grece-bestof"],
        detectedAt: new Date("2026-03-08T14:00:00Z"),
        detectedBy: "gpt",
        status: "open",
        expiresAt: new Date("2026-04-07T14:00:00Z")
      },
      {
        entityName: "Vol en montgolfière Cappadoce",
        type: "price_change",
        note: "Prix moyen passé de 150€ à 200€. Haute saison très demandée.",
        clusterIds: ["cluster-turquie-cappadoce", "cluster-turquie-bestof"],
        detectedAt: new Date("2026-03-12T08:30:00Z"),
        detectedBy: "Julie",
        status: "open",
        expiresAt: new Date("2026-04-11T08:30:00Z")
      },
      {
        entityName: "Temple de Karnak",
        type: "new_info",
        note: "Nouveaux horaires d'été : 6h-18h au lieu de 7h-17h.",
        clusterIds: ["cluster-egypte-louxor"],
        detectedAt: new Date("2026-03-15T10:00:00Z"),
        detectedBy: "Myriam",
        status: "open",
        expiresAt: new Date("2026-04-14T10:00:00Z")
      },
      {
        entityName: "Khao San Road",
        type: "suspicious",
        note: "Plusieurs arnaques signalées récemment. Ajouter mise en garde dans les articles.",
        clusterIds: ["cluster-thailande-bangkok"],
        detectedAt: new Date("2026-03-14T12:00:00Z"),
        detectedBy: "Claire",
        status: "open",
        expiresAt: new Date("2026-04-13T12:00:00Z")
      },
      {
        entityName: "JR Pass",
        type: "price_change",
        note: "Augmentation significative du JR Pass : +70% depuis octobre 2025. Mettre à jour tous les articles budget.",
        clusterIds: ["cluster-japon-tokyo", "cluster-japon-kyoto", "cluster-japon-osaka", "cluster-japon-bestof"],
        detectedAt: new Date("2026-02-28T09:00:00Z"),
        detectedBy: "Manu",
        status: "open",
        expiresAt: new Date("2026-03-30T09:00:00Z")
      }
    ]

    await Signal.deleteMany({})
    const signals = await Signal.insertMany(mockSignals)
    
    res.json({ message: `Seeded ${signals.length} signals`, signals })
  } catch (error) {
    console.error("Error seeding signals:", error)
    res.status(500).json({ error: "Failed to seed signals" })
  }
})

export default router
