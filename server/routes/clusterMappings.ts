import { Router, Request, Response } from "express"
import { Types } from "mongoose"
import { ArticleClusterMapping } from "../models/ArticleClusterMapping"
import { fetchClustersForRegions, fetchRegions } from "../lib/rlClusters"
import { scorePostClusters } from "../lib/clusterScoring"
import { findCanonicalSiteById, getCanonicalUserCredentials, listCanonicalSites } from "../lib/canonicalSitesStore"

const router = Router()
function parseWpStatus(error: unknown): number | null {
  const msg = error instanceof Error ? error.message : String(error)
  const m = msg.match(/WordPress API error: (\d+)/)
  if (!m) return null
  const n = Number.parseInt(m[1], 10)
  return Number.isNaN(n) ? null : n
}


type WpPostLite = {
  id: number
  slug: string
  modified: string
  status: string
  link: string
  title: { rendered?: string }
  categories: number[]
}

type WpCategoryLite = {
  id: number
  name: string
}

function parseWpPostId(raw: string): number | null {
  const n = Number.parseInt(raw, 10)
  return Number.isNaN(n) ? null : n
}

function parseSiteObjectId(siteId: string): Types.ObjectId | null {
  if (!Types.ObjectId.isValid(siteId)) return null
  return new Types.ObjectId(siteId)
}

function wpAuthHeader(username: string, appPassword: string): string {
  return "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64")
}

async function fetchPaged<T>(baseUrl: string, path: string, auth: string, fields: string): Promise<T[]> {
  const first = new URL(`${baseUrl}${path}`)
  first.searchParams.set("per_page", "100")
  first.searchParams.set("page", "1")
  first.searchParams.set("_fields", fields)

  const firstRes = await fetch(first.toString(), { headers: { Authorization: auth } })
  if (!firstRes.ok) throw new Error(`WordPress API error: ${firstRes.status}`)
  const firstData = (await firstRes.json()) as T[]
  const totalPages = parseInt(firstRes.headers.get("X-WP-TotalPages") || "1", 10)
  if (totalPages <= 1) return firstData

  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => i + 2).map(async (page) => {
      const url = new URL(`${baseUrl}${path}`)
      url.searchParams.set("per_page", "100")
      url.searchParams.set("page", String(page))
      url.searchParams.set("_fields", fields)
      const res = await fetch(url.toString(), { headers: { Authorization: auth } })
      if (!res.ok) throw new Error(`WordPress API error: ${res.status}`)
      return (await res.json()) as T[]
    })
  )
  return [...firstData, ...remaining.flat()]
}

async function fetchWpSiteData(site: { url: string }, credentials: { username: string; appPassword: string }) {
  const baseUrl = site.url.replace(/\/$/, "")
  const auth = wpAuthHeader(credentials.username, credentials.appPassword)
  const [posts, categories] = await Promise.all([
    fetchPaged<WpPostLite>(
      baseUrl,
      "/wp-json/wp/v2/posts",
      auth,
      "id,slug,modified,status,link,title,categories"
    ),
    fetchPaged<WpCategoryLite>(baseUrl, "/wp-json/wp/v2/categories", auth, "id,name"),
  ])
  return { posts, categories }
}

// GET /api/cluster-mappings/regions/overview?siteId=...
router.get("/regions/overview", async (req: Request, res: Response) => {
  try {
    const currentSiteId = typeof req.query.siteId === "string" ? req.query.siteId : undefined
    const [regions, sites] = await Promise.all([
      fetchRegions(req),
      listCanonicalSites(),
    ])

    const siteById = new Map<string, { id: string; name: string; regionIds: string[] }>(
      sites.map((s) => [s._id, { id: s._id, name: s.name, regionIds: s.regionIds || [] }])
    )

    const assignedMap = new Map<string, { siteIds: string[]; siteNames: string[] }>()
    for (const site of siteById.values()) {
      for (const rid of site.regionIds) {
        if (!assignedMap.has(rid)) assignedMap.set(rid, { siteIds: [], siteNames: [] })
        const row = assignedMap.get(rid)!
        row.siteIds.push(site.id)
        row.siteNames.push(site.name)
      }
    }

    const rlRegionIds = new Set(regions.map((r) => r.id))
    const unknownRegionRefs = Array.from(siteById.values()).flatMap((site) =>
      site.regionIds
        .filter((rid) => !rlRegionIds.has(rid))
        .map((rid) => ({
          siteId: site.id,
          siteName: site.name,
          regionId: rid,
          isCurrentSite: currentSiteId ? site.id === currentSiteId : false,
        }))
    )

    const data = regions
      .map((region) => {
        const assigned = assignedMap.get(region.id) || { siteIds: [], siteNames: [] }
        return {
          id: region.id,
          name: region.name,
          lastSyncedAt: region.lastSyncedAt || null,
          assignedSiteIds: assigned.siteIds,
          assignedSiteNames: assigned.siteNames,
          isAssignedToCurrentSite: currentSiteId ? assigned.siteIds.includes(currentSiteId) : false,
          isUnassigned: assigned.siteIds.length === 0,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))

    res.json({
      data,
      unknownRegionRefs,
      summary: {
        totalRegions: data.length,
        unassignedRegions: data.filter((r) => r.isUnassigned).length,
        unknownRegionRefs: unknownRegionRefs.length,
        currentSiteUnknownRefs: unknownRegionRefs.filter((r) => r.isCurrentSite).length,
      },
    })
  } catch (error) {
    console.error("Error loading regions overview:", error)
    res.status(500).json({ error: "Failed to load regions overview" })
  }
})

// GET /api/cluster-mappings/:siteId?status=needs_review|auto|approved|overridden
router.get("/:siteId", async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params
    const status = typeof req.query.status === "string" ? req.query.status : undefined
    const siteObjectId = parseSiteObjectId(siteId)
    if (!siteObjectId) return res.status(400).json({ error: "Invalid siteId" })

    const site = await findCanonicalSiteById(siteId)
    if (!site) return res.status(404).json({ error: "Site not found" })

    const query: Record<string, unknown> = { siteId: siteObjectId }
    if (status) query.status = status
    const mappings = await ArticleClusterMapping.find(query).sort({ updatedAt: -1 }).lean()

    const credentials = await getCanonicalUserCredentials(req.rlUserId, siteId)
    if (!credentials) {
      return res.status(403).json({ error: "Not connected to this site. Please add your credentials first." })
    }

    const [clustersCatalog, wpData] = await Promise.all([
      Array.isArray(site.regionIds) && site.regionIds.length > 0
        ? fetchClustersForRegions(req, site.regionIds)
        : Promise.resolve([]),
      fetchWpSiteData(site, credentials),
    ])
    const { posts, categories } = wpData
    const postById = new Map<number, WpPostLite>(posts.map((p) => [p.id, p]))
    const catById = new Map<number, string>(categories.map((c) => [c.id, c.name]))
    const clusterNameById = new Map<string, string>(clustersCatalog.map((c) => [c.id, c.name]))

    const data = mappings.map((m) => {
      const post = postById.get(m.wpPostId)
      const categoryNames = post ? post.categories.map((id) => catById.get(id)).filter(Boolean) : []
      return {
        ...m,
        clusterNames: (m.clusterIds || []).map((id) => clusterNameById.get(id) || id),
        hasStaleClusterRefs: (m.sourceSignals || []).includes("stale_cluster_id"),
        post: post
          ? {
              id: post.id,
              slug: post.slug,
              modified: post.modified,
              status: post.status,
              link: post.link,
              title: post.title?.rendered || "",
              categoryNames,
            }
          : null,
      }
    })

    const staleClusterRefsCount = data.filter((row) => row.hasStaleClusterRefs).length

    res.json({
      data,
      total: data.length,
      site: { _id: site._id, name: site.name, regionIds: site.regionIds || [] },
      clustersCatalog: clustersCatalog.sort((a, b) => a.name.localeCompare(b.name, "fr")),
      staleClusterRefsCount,
    })
  } catch (error) {
    console.error("Error listing cluster mappings:", error)
    const wpStatus = parseWpStatus(error)
    if (wpStatus === 401 || wpStatus === 403) {
      return res.status(502).json({
        error: "WordPress auth failed for this site connection",
        wpStatus,
      })
    }
    res.status(500).json({ error: "Failed to list cluster mappings", wpStatus })
  }
})

// POST /api/cluster-mappings/:siteId/recompute
router.post("/:siteId/recompute", async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params
    const force = req.query.force === "1" || req.query.force === "true"
    const siteObjectId = parseSiteObjectId(siteId)
    if (!siteObjectId) return res.status(400).json({ error: "Invalid siteId" })

    const site = await findCanonicalSiteById(siteId)
    if (!site) return res.status(404).json({ error: "Site not found" })
    if (!Array.isArray(site.regionIds) || site.regionIds.length === 0) {
      return res.status(400).json({ error: "Site has no regionIds configured" })
    }

    const credentials = await getCanonicalUserCredentials(req.rlUserId, siteId)
    if (!credentials) {
      return res.status(403).json({ error: "Not connected to this site. Please add your credentials first." })
    }

    const [clusters, wpData, existing] = await Promise.all([
      fetchClustersForRegions(req, site.regionIds),
      fetchWpSiteData(site, credentials),
      ArticleClusterMapping.find({ siteId: siteObjectId }),
    ])

    const existingByPost = new Map<number, (typeof existing)[number]>()
    for (const row of existing) existingByPost.set(row.wpPostId, row)

    const validClusterIds = new Set(clusters.map((c) => c.id))
    const currentWpPostIds = new Set<number>()
    const ops: Promise<unknown>[] = []
    let updated = 0
    let skippedOverridden = 0
    let needsReview = 0

    for (const post of wpData.posts) {
      currentWpPostIds.add(post.id)
      const prev = existingByPost.get(post.id)

      if (prev?.status === "overridden" && !force) {
        skippedOverridden++
        continue
      }

      const score = scorePostClusters(post, wpData.categories, clusters)
      const staleClusterSignal = (prev?.clusterIds || []).some((id) => !validClusterIds.has(id))
        ? ["stale_cluster_id"]
        : []
      const finalStatus = score.clusterIds.length === 0 ? "needs_review" : score.status

      if (finalStatus === "needs_review") needsReview++

      ops.push(
        ArticleClusterMapping.updateOne(
          { siteId: siteObjectId, wpPostId: post.id },
          {
            $set: {
              siteId: siteObjectId,
              wpPostId: post.id,
              clusterIds: score.clusterIds,
              confidence: score.confidence,
              status: finalStatus,
              sourceSignals: [...new Set([...score.sourceSignals, ...staleClusterSignal])],
              updatedAt: new Date(),
            },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true }
        )
      )
      updated++
    }

    // Drop mappings for deleted/unavailable WP posts
    ops.push(
      ArticleClusterMapping.deleteMany({
        siteId: siteObjectId,
        wpPostId: { $nin: Array.from(currentWpPostIds) },
      })
    )

    await Promise.all(ops)

    res.json({
      success: true,
      summary: {
        clustersLoaded: clusters.length,
        wpPosts: wpData.posts.length,
        updated,
        needsReview,
        skippedOverridden,
        force,
      },
    })
  } catch (error) {
    console.error("Error recomputing cluster mappings:", error)
    const wpStatus = parseWpStatus(error)
    if (wpStatus === 401 || wpStatus === 403) {
      return res.status(502).json({
        error: "WordPress auth failed for this site connection",
        wpStatus,
      })
    }
    res.status(500).json({ error: "Failed to recompute cluster mappings", wpStatus })
  }
})

// PATCH /api/cluster-mappings/:siteId/:wpPostId (manual override)
router.patch("/:siteId/:wpPostId", async (req: Request, res: Response) => {
  try {
    const { siteId, wpPostId: rawWpPostId } = req.params
    const wpPostId = parseWpPostId(rawWpPostId)
    if (wpPostId == null) return res.status(400).json({ error: "Invalid wpPostId" })
    const siteObjectId = parseSiteObjectId(siteId)
    if (!siteObjectId) return res.status(400).json({ error: "Invalid siteId" })

    const { clusterIds, status } = req.body as {
      clusterIds?: unknown
      status?: "approved" | "overridden" | "needs_review"
    }

    if (!Array.isArray(clusterIds) || !clusterIds.every((id) => typeof id === "string")) {
      return res.status(400).json({ error: "clusterIds must be a string array" })
    }

    const finalStatus = status || "overridden"

    await ArticleClusterMapping.updateOne(
      { siteId: siteObjectId, wpPostId },
      {
        $set: {
          siteId: siteObjectId,
          wpPostId,
          clusterIds,
          status: finalStatus,
          confidence: finalStatus === "overridden" ? 1 : 0.85,
          sourceSignals: ["manual_override"],
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    )

    const row = await ArticleClusterMapping.findOne({ siteId: siteObjectId, wpPostId }).lean()
    res.json({ success: true, data: row })
  } catch (error) {
    console.error("Error overriding cluster mapping:", error)
    res.status(500).json({ error: "Failed to update cluster mapping" })
  }
})

export default router
