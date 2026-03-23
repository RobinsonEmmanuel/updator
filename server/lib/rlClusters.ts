import type { Request } from "express"

export interface RlClusterLite {
  id: string
  name: string
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
  const id = (r._id ?? r.id) as string | undefined
  const name = (r.name ?? r.title ?? r.label) as string | undefined
  if (!id || !name) return null
  return { id, name }
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
