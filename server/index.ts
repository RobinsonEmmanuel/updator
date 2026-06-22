import express from "express"
import cors from "cors"
import compression from "compression"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { existsSync } from "fs"
import { connectDB } from "./db"
import signalsRouter from "./routes/signals"
import draftsRouter from "./routes/drafts"
import authRouter from "./routes/auth"
import clusterMappingsRouter from "./routes/clusterMappings"
import todoConfigRouter, { ensureTodoConfigSeeded } from "./routes/todoConfig"
import ingestionsRouter from "./routes/ingestions"
import poiMentionsRouter from "./routes/poiMentions"
import reusableBlocksRouter from "./routes/reusableBlocks"
import { requireAuth } from "./middleware/requireAuth"
import { Signal } from "./models/Signal"
import { Draft } from "./models/Draft"

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(compression())
app.use(cors())
app.use(express.json())

// Routes
app.use("/api/auth", authRouter)
app.use("/api/signals", requireAuth, signalsRouter)
app.use("/api/drafts", requireAuth, draftsRouter)
app.use("/api/cluster-mappings", requireAuth, clusterMappingsRouter)
app.use("/api/todo-config", requireAuth, todoConfigRouter)
app.use("/api/ingestions", requireAuth, ingestionsRouter)
app.use("/api/poi-mentions", requireAuth, poiMentionsRouter)
app.use("/api/reusable-blocks", requireAuth, reusableBlocksRouter)

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// Serve Vite build in production
const __dirname = dirname(fileURLToPath(import.meta.url))
const distPath = join(__dirname, "../dist")
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get("*", (_req, res) => {
    res.sendFile(join(distPath, "index.html"))
  })
}

async function seedIfEmpty() {
  const signalCount = await Signal.countDocuments()
  if (signalCount === 0) {
    console.log("Seeding signals...")
    const mockSignals = [
      { entityName: "Riad Jardin Secret", type: "closure", note: "Fermé définitivement depuis janvier 2026.", clusterIds: [], detectedAt: new Date("2026-02-15T10:00:00Z"), detectedBy: "Julie", status: "open" },
      { entityName: "Excursion Essaouira", type: "price_change", note: "Prix passé de 45€ à 65€ depuis février 2026.", clusterIds: [], detectedAt: new Date("2026-03-01T14:30:00Z"), detectedBy: "gpt", status: "open" },
      { entityName: "Hôtel Bela Vista", type: "closure", note: "En rénovation jusqu'à septembre 2026.", clusterIds: [], detectedAt: new Date("2026-02-20T09:00:00Z"), detectedBy: "Myriam", status: "open" },
      { entityName: "Sagrada Familia", type: "price_change", note: "Nouveau tarif : 26€ au lieu de 20€ depuis mars 2026.", clusterIds: [], detectedAt: new Date("2026-03-05T11:00:00Z"), detectedBy: "Claire", status: "open" },
      { entityName: "Trattoria da Luigi", type: "closure", note: "Restaurant fermé. Le propriétaire a pris sa retraite.", clusterIds: [], detectedAt: new Date("2026-03-10T16:00:00Z"), detectedBy: "Manu", status: "open" },
      { entityName: "Ferry Santorin", type: "new_info", note: "Nouvelle compagnie SeaJets avec trajets plus rapides.", clusterIds: [], detectedAt: new Date("2026-03-08T14:00:00Z"), detectedBy: "gpt", status: "open" },
      { entityName: "Vol en montgolfière Cappadoce", type: "price_change", note: "Prix moyen passé de 150€ à 200€.", clusterIds: [], detectedAt: new Date("2026-03-12T08:30:00Z"), detectedBy: "Julie", status: "open" },
      { entityName: "Temple de Karnak", type: "new_info", note: "Nouveaux horaires d'été : 6h-18h.", clusterIds: [], detectedAt: new Date("2026-03-15T10:00:00Z"), detectedBy: "Myriam", status: "open" },
      { entityName: "Khao San Road", type: "suspicious", note: "Plusieurs arnaques signalées récemment.", clusterIds: [], detectedAt: new Date("2026-03-14T12:00:00Z"), detectedBy: "Claire", status: "open" },
      { entityName: "JR Pass", type: "price_change", note: "Augmentation significative du JR Pass : +70%.", clusterIds: [], detectedAt: new Date("2026-02-28T09:00:00Z"), detectedBy: "Manu", status: "open" },
    ]
    await Signal.insertMany(mockSignals)
    console.log(`✓ Seeded ${mockSignals.length} signals`)
  }

  const draftCount = await Draft.countDocuments()
  if (draftCount === 0) {
    console.log("Seeding drafts...")
    const mockDrafts = [
      { articleId: "art-001", content: "<h2>Article exemple</h2><p>Contenu de l'article mis à jour.</p>", checksSnapshot: { "check-liens-generaux": true }, author: "Julie", status: "editing" },
      { articleId: "art-002", content: "<h2>Guide complet</h2><p>Un guide détaillé avec toutes les informations.</p>", checksSnapshot: { "check-liens-generaux": true, "check-booking": true }, author: "Manu", status: "ready_to_push" },
    ]
    await Draft.insertMany(mockDrafts)
    console.log(`✓ Seeded ${mockDrafts.length} drafts`)
  }

  const todoSeed = await ensureTodoConfigSeeded(false)
  if (todoSeed.seeded > 0) {
    console.log(`✓ Seeded ${todoSeed.seeded} todo config items`)
  }
}

// Start server
async function start() {
  await connectDB()
  await seedIfEmpty()
  
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`)
  })
}

start()
