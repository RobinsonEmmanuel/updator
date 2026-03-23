import type { Request } from "express"

export interface RlClusterLite {
  id: string
  name: string
}

export interface RlRegionLite {
  id: string
  name: string
  lastSyncedAt?: string
}

function regionLoversBaseUrl(): string {
  return (process.env.REGIONLOVERS_API_URL || "https://api-prod.regionlovers.ai").replace(/\/$/, "")
}

function authHeaders(req: Request): HeadersInit {
  const incoming = req.headers.authorization
  const headers: Record<string, string> = {
    accept: "*/*",
  }
  if (incoming) headers.Authorization = incoming
  if (process.env.RL_API_KEY) headers["X-Api-Key"] = process.env.RL_API_KEY
  return headers
}

function toClusterLite(raw: unknown): RlClusterLite | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const airtableId = r.airtableId as string | undefined
  const mongoId = (r._id ?? r.id) as string | undefined
  const id =
    airtableId && /^rec[a-zA-Z0-9]+$/.test(airtableId)
      ? airtableId
      : mongoId
  const name = (r.name ?? r.title ?? r.label) as string | undefined
  if (!id || !name) return null
  return { id, name }
}

function toRegionLite(raw: unknown): RlRegionLite | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const id = (r._id ?? r.id) as string | undefined
  const rawName = (r.name ?? r.title ?? r.label) as string | undefined
  const name = (rawName || "").trim()
  const lastSyncedAt = r.lastSyncedAt as string | undefined
  if (!id) return null
  return { id, name, lastSyncedAt }
}

function normalizeRegionName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function isDeprecatedRegionName(name: string): boolean {
  const n = normalizeRegionName(name)
  return (
    n === "" ||
    /\bzz$/.test(n) ||
    n.includes("(ancien a supprimer)") ||
    n.includes("ancien a supprimer")
  )
}

export async function fetchClustersForRegions(req: Request, regionIds: string[]): Promise<RlClusterLite[]> {
  const headers = authHeaders(req)
  const baseUrl = regionLoversBaseUrl()

  const results = await Promise.all(
    regionIds.map(async (regionId) => {
      const res = await fetch(`${baseUrl}/v2/clusters/region/${regionId}`, { headers })
      if (!res.ok) {
        throw new Error(`RL clusters error for region ${regionId}: ${res.status}`)
      }
      const json = (await res.json().catch(() => [])) as unknown
      const list = Array.isArray(json)
        ? json
        : json && typeof json === "object" && Array.isArray((json as Record<string, unknown>).data)
          ? ((json as Record<string, unknown>).data as unknown[])
          : []
      return list.map(toClusterLite).filter((c): c is RlClusterLite => !!c)
    })
  )

  const dedup = new Map<string, RlClusterLite>()
  for (const group of results) {
    for (const cluster of group) dedup.set(cluster.id, cluster)
  }
  return Array.from(dedup.values())
}

export async function fetchRegions(req: Request): Promise<RlRegionLite[]> {
  const headers = authHeaders(req)
  const baseUrl = regionLoversBaseUrl()
  const res = await fetch(`${baseUrl}/regions`, { headers })
  if (!res.ok) {
    throw new Error(`RL regions error: ${res.status}`)
  }
  const json = (await res.json().catch(() => [])) as unknown
  const list = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as Record<string, unknown>).data)
      ? ((json as Record<string, unknown>).data as unknown[])
      : []
  const parsed = list.map(toRegionLite).filter((r): r is RlRegionLite => !!r)

  // Nettoyage: retire entrées vides/obsolètes et déduplique par nom normalisé.
  const dedup = new Map<string, RlRegionLite>()
  for (const region of parsed) {
    if (isDeprecatedRegionName(region.name)) continue
    const key = normalizeRegionName(region.name)
    const existing = dedup.get(key)
    if (!existing) {
      dedup.set(key, region)
      continue
    }
    const existingTs = existing.lastSyncedAt ? Date.parse(existing.lastSyncedAt) : 0
    const currentTs = region.lastSyncedAt ? Date.parse(region.lastSyncedAt) : 0
    if (currentTs >= existingTs) {
      dedup.set(key, region)
    }
  }

  return Array.from(dedup.values())
}
