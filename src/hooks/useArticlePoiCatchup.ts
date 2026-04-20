import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ingestionApiUrl, ingestionFetch } from "@/lib/api"

export type PoiAssociationStatus = "pending" | "needs_review" | "linked" | "created" | "ignored"
export type PoiConfidence = "high" | "medium" | "low"

export interface PoiSuggestion {
  rl_place_id: string
  name: string
  place_type: string
  place_type_label_fr?: string
  cluster_id: string
  cluster_ids: string[]
  cluster_name?: string
  cluster_names?: string[]
  score: number
  confidence: PoiConfidence
  reason: string
  matched_tokens: string[]
  evidence_excerpt: string
  score_details: {
    name_match: number
    title_score: number
    content_score: number
    token_coverage: number
    section_signal: number
    occurrence_signal: number
    type_compatibility: number
    generic_penalty: number
    final_score: number
  }
  mismatch_warning?: string
}

export interface PoiCandidateGroup {
  candidate_id: string
  name: string
  source: "h1" | "h2" | "h3" | "title" | "body" | "fallback"
  section_title: string
  frequency: number
  heading_hits: number
  mention_score: number
  evidence_excerpt: string
  occurrences: Array<{
    section_type: "h1" | "h2" | "h3" | "title" | "body"
    section_title: string
    excerpt: string
    hits: number
  }>
  suggestions: PoiSuggestion[]
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
  candidate_id?: string
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
  rlSuggestions?: PoiSuggestion[]
  candidateGroups: PoiCandidateGroup[]
  detectedCandidates?: PoiCandidateGroup[]
  detectedCandidatesCount?: number
  unmatchedCandidatesCount?: number
  association: PoiAssociation | null
  associatedPoiCount: number
  linkedPoiCount?: number
  hasLinkedPoi?: boolean
  articleUrl: string | null
  htmlBrut: string
  htmlCleaned?: string
}

interface BacklogResponse {
  data: ArticlePoiBacklogRow[]
  total: number
  page: number
  limit: number
  summary: Record<PoiAssociationStatus, number> & {
    withLinkedPoi: number
    withoutLinkedPoi: number
    detectedCandidates: number
    unmatchedCandidates: number
  }
  categories: string[]
}

interface RecomputeResponse {
  success: boolean
  summary: {
    siteId: string
    regionIds: string[]
    rlPlacesLoaded: number
    articlesScanned: number
    refreshed: number
    refreshFailed: number
    updated: number
    autoValidated: number
    needsReview: number
    pending: number
    skippedFinal: number
    force: boolean
  }
}

interface RecomputeArticleResponse {
  success: boolean
  articleId: string
  result: "updated-pending" | "updated-needs-review" | "updated-linked" | "skipped-final"
  rlPlacesLoaded: number
  refreshed: boolean
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
          summary: {
            pending: 0,
            needs_review: 0,
            linked: 0,
            created: 0,
            ignored: 0,
            withLinkedPoi: 0,
            withoutLinkedPoi: 0,
            detectedCandidates: 0,
            unmatchedCandidates: 0,
          },
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

export function useArticlePoiRecomputeArticle(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation<RecomputeArticleResponse, Error, { articleId: string; force?: boolean }>({
    mutationFn: async ({ articleId, force = true }) => {
      if (!siteId) throw new Error("No site selected")
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/article-poi/${articleId}/recompute`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, force }),
      })
      const data = (await res.json().catch(() => ({}))) as RecomputeArticleResponse & { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to recompute article")
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
      candidateId?: string
    }) => {
      if (!siteId) throw new Error("No site selected")
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/article-poi/${payload.articleId}/link`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          rlPlaceId: payload.rlPlaceId,
          rlPlaceName: payload.rlPlaceName,
          candidateId: payload.candidateId,
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
      candidateId?: string
    }) => {
      if (!siteId) throw new Error("No site selected")
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/article-poi/${payload.articleId}/create-rl`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          regionId: payload.regionId,
          candidateId: payload.candidateId,
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

export interface RegionPoiLite {
  rl_place_id: string
  name: string
  place_type: string
  place_type_label_fr?: string
  cluster_ids: string[]
  cluster_names?: string[]
}

interface RegionPoisResponse {
  siteId: string
  regionIds: string[]
  total: number
  data: RegionPoiLite[]
}

export function useArticlePoiRegionPois(params: { siteId?: string; q?: string; limit?: number }) {
  const { siteId, q, limit = 80 } = params
  return useQuery({
    queryKey: ["article-poi-region-pois", siteId, q, limit],
    queryFn: async (): Promise<RegionPoiLite[]> => {
      if (!siteId) return []
      const qs = new URLSearchParams({ siteId, limit: String(limit) })
      if (q) qs.set("q", q)
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/article-poi/region-pois?${qs.toString()}`))
      const data = (await res.json().catch(() => ({}))) as RegionPoisResponse & { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to load region POIs")
      return Array.isArray(data.data) ? data.data : []
    },
    enabled: !!siteId,
    staleTime: 45 * 1000,
    retry: 1,
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
