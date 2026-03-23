import mongoose from "mongoose"
import dotenv from "dotenv"
import { SiteWeb } from "../models/SiteWeb"

dotenv.config()

const SITES = [
  { name: "Loire Lovers", url: "https://loirelovers.fr" },
  { name: "Corsica Lovers", url: "https://corsicalovers.fr" },
  { name: "Crete Lovers", url: "https://cretelovers.com" },
  { name: "Croatia Lovers", url: "https://croatialovers.com" },
  { name: "Provence Lovers", url: "https://provencelovers.fr" },
  { name: "Canarias Lovers", url: "https://canariaslovers.com" },
  { name: "Canarias Lovers TF+GC", url: "https://canarias-lovers.com" },
  { name: "Madeira Lovers", url: "https://madeiralovers.com" },
  { name: "Maroc Lovers", url: "https://maroclovers.com" },
  { name: "Normandie Lovers", url: "https://normandielovers.fr" },
  { name: "Andalucia Lovers", url: "https://andalucialovers.com" },
  { name: "Portugal Lovers", url: "https://portugallovers.com" },
  { name: "Baleares Lovers", url: "https://baleareslovers.com" },
  { name: "Scotland Lovers", url: "https://scotland-lovers.com" },
  { name: "Iceland Lovers", url: "https://iceland-lovers.com" },
  { name: "Sicilia Lovers", url: "https://sicilialovers.com" },
]

async function seed() {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) {
    console.error("MONGODB_URI not defined")
    process.exit(1)
  }

  try {
    await mongoose.connect(mongoUri)
    console.log("Connected to MongoDB")

    for (const site of SITES) {
      const existing = await SiteWeb.findOne({ url: site.url })
      if (existing) {
        console.log(`Skip: ${site.name} (already exists)`)
      } else {
        await SiteWeb.create(site)
        console.log(`Created: ${site.name}`)
      }
    }

    console.log("\nSeed completed!")
    console.log(`Total sites in DB: ${await SiteWeb.countDocuments()}`)
  } catch (error) {
    console.error("Seed error:", error)
  } finally {
    await mongoose.disconnect()
  }
}

seed()
