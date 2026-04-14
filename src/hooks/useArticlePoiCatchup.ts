import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ingestionApiUrl, ingestionFetch } from "@/lib/api"

export type PoiAssociationStatus = "pending" | "needs_review" | "linked" | "created" | "ignored"
export type PoiConfidence = "high" | "medium" | "low"

export interface PoiSuggestion {
  rl_place_id: string
  name: string
  score: number
  confidence: PoiConfidence
  region_id: string
}

export interface PoiAssociation {
  status?: PoiAssociationStatus
  rl_place_id?: string
  rl_place_name?: string
  rl_region_id?: string
  matched_automatically?: boolean
  confidence?: PoiConfidence
  score?: number
  validated?: boolean
  created_via_write?: boolean
  updated_at?: string
}

export interface ArticlePoiBacklogRow {
  articleId: string
  wpPostId: number
  title: string
  slug: string
  categories: string[]
  wpModifiedAt: string | null
  status: PoiAssociationStatus
  candidateName: string
  suggestions: PoiSuggestion[]
  association: PoiAssociation | null
}

interface BacklogResponse {
  data: ArticlePoiBacklogRow[]
  total: number
  page: number
  limit: number
  summary: Record<PoiAssociationStatus, number>
  categories: string[]
}

interface RecomputeResponse {
  success: boolean
  summary: {
    siteId: string
    regionIds: string[]
    rlPlacesLoaded: number
    articlesScanned: number
    updated: number
    autoValidated: number
    needsReview: number
    pending: number
    skippedFinal: number
    force: boolean
  }
}

interface SiteCategory {
  id: number
  name: string
  slug: string
  count: number
  parent: number
}

export function useArticlePoiBacklog(params: {
  siteId?: string
  status?: PoiAssociationStatus
  category?: string
  page?: number
  limit?: number
}) {
  const { siteId, status, category, page = 1, limit = 50 } = params
  return useQuery({
    queryKey: ["article-poi-backlog", siteId, status, category, page, limit],
    queryFn: async (): Promise<BacklogResponse> => {
      if (!siteId) {
        return {
          data: [],
          total: 0,
          page: 1,
          limit,
          summary: { pending: 0, needs_review: 0, linked: 0, created: 0, ignored: 0 },
          categories: [],
        }
      }
      const qs = new URLSearchParams({
        siteId,
        page: String(page),
        limit: String(limit),
      })
      if (status) qs.set("status", status)
      if (category) qs.set("category", category)
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/article-poi/backlog?${qs.toString()}`))
      const data = (await res.json().catch(() => ({}))) as BacklogResponse & { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to load article-poi backlog")
      return data
    },
    enabled: !!siteId,
    staleTime: 60 * 1000,
    retry: 1,
  })
}

export function useArticlePoiRecompute(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation<RecomputeResponse, Error, { force?: boolean }>({
    mutationFn: async ({ force = false }) => {
      if (!siteId) throw new Error("No site selected")
      const res = await ingestionFetch(ingestionApiUrl("/api/v1/article-poi/match/recompute"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, force }),
      })
      const data = (await res.json().catch(() => ({}))) as RecomputeResponse & { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to recompute article-poi matching")
      return data
    },
    onSuccess: () => {
      if (siteId) queryClient.invalidateQueries({ queryKey: ["article-poi-backlog", siteId] })
    },
  })
}

export function useArticlePoiManualLink(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      articleId: string
      rlPlaceId: string
      rlPlaceName?: string
      confidence?: PoiConfidence
      score?: number
      validated?: boolean
    }) => {
      if (!siteId) throw new Error("No site selected")
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/article-poi/${payload.articleId}/link`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          rlPlaceId: payload.rlPlaceId,
          rlPlaceName: payload.rlPlaceName,
          confidence: payload.confidence ?? "high",
          score: payload.score ?? 1,
          validated: payload.validated ?? true,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to link POI")
      return data
    },
    onSuccess: () => {
      if (siteId) queryClient.invalidateQueries({ queryKey: ["article-poi-backlog", siteId] })
    },
  })
}

export function useArticlePoiCreateRl(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      articleId: string
      regionId?: string
      name?: string
      placeType?: string
    }) => {
      if (!siteId) throw new Error("No site selected")
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/article-poi/${payload.articleId}/create-rl`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          regionId: payload.regionId,
          name: payload.name,
          placeType: payload.placeType,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; rl_write_target?: string }
      if (!res.ok) throw new Error(data.error || "Failed to create RL place")
      return data
    },
    onSuccess: () => {
      if (siteId) queryClient.invalidateQueries({ queryKey: ["article-poi-backlog", siteId] })
    },
  })
}

export function useSiteCategories(siteId?: string) {
  return useQuery({
    queryKey: ["site-categories", siteId],
    queryFn: async (): Promise<SiteCategory[]> => {
      if (!siteId) return []
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/user/sites/${siteId}/categories`))
      const data = (await res.json().catch(() => [])) as SiteCategory[] | { error?: string }
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to load site categories")
      return Array.isArray(data) ? data : []
    },
    enabled: !!siteId,
    staleTime: 60 * 1000,
    retry: 1,
  })
}
