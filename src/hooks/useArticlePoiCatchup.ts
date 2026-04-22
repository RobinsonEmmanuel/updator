import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ingestionApiUrl, ingestionFetch } from "@/lib/api"
import { mapBacklogResponse } from "@/features/article-poi-catchup/articlePoiMapper"
import type { CreateRlBody, CreateRlResponse, ManualLinkResponse } from "@redactor-guide/article-poi-contract"

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
  suggestions?: PoiSuggestion[]
  is_primary?: boolean
  link_status?: PoiAssociationStatus
  rl_place_id?: string
  rl_place_name?: string | null
  rl_region_id?: string
  rl_place_type?: string
  rl_place_type_label_fr?: string
  rl_cluster_id?: string
  rl_cluster_name?: string
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
  detectedCandidates: PoiCandidateGroup[]
  detectedCandidatesCount?: number
  unmatchedCandidatesCount?: number
  linkedPoiCount?: number
  hasLinkedPoi?: boolean
  poiScanValidated?: boolean
  poiScanValidatedAt?: string | null
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

interface SetScanValidationResponse {
  success: boolean
  articleId: string
  poiScanValidated: boolean
  poiScanValidatedAt: string | null
}

interface RecomputeCandidateResponse {
  success: boolean
  articleId: string
  candidateId: string
  scopedSuggestion: boolean
  refreshFromWp: boolean
  refreshed: boolean
  rlPlacesLoaded: number
  suggestionsCount: number
  candidate: PoiCandidateGroup
}

interface MarkCandidateResponse {
  success: boolean
  articleId: string
  candidateId: string
  suggestionsCount: number
  candidate: PoiCandidateGroup
}

interface SiteCategory {
  id: number
  name: string
  slug: string
  count: number
  parent: number
}

function computeDerivedCounts(candidates: PoiCandidateGroup[]) {
  const linkedCandidates = candidates.filter((candidate) => !!candidate.rl_place_id)
  const unmatchedCandidates = candidates.filter(
    (candidate) => !candidate.rl_place_id && (candidate.suggestions || []).length === 0
  )
  return {
    detectedCandidatesCount: candidates.length,
    linkedPoiCount: linkedCandidates.length,
    hasLinkedPoi: linkedCandidates.length > 0,
    unmatchedCandidatesCount: unmatchedCandidates.length,
  }
}

function updateBacklogRows(
  queryClient: ReturnType<typeof useQueryClient>,
  siteId: string | undefined,
  updater: (row: ArticlePoiBacklogRow) => ArticlePoiBacklogRow
) {
  if (!siteId) return
  queryClient.setQueriesData<BacklogResponse>(
    {
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey[0] === "article-poi-backlog" &&
        query.queryKey[1] === siteId,
    },
    (old) => {
      if (!old) return old
      return {
        ...old,
        data: old.data.map(updater),
      }
    }
  )
}

function invalidateBacklog(
  queryClient: ReturnType<typeof useQueryClient>,
  siteId: string | undefined,
  refetchType?: "none"
) {
  if (!siteId) return
  if (refetchType) {
    queryClient.invalidateQueries({ queryKey: ["article-poi-backlog", siteId], refetchType })
    return
  }
  queryClient.invalidateQueries({ queryKey: ["article-poi-backlog", siteId] })
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
      return mapBacklogResponse(data) as BacklogResponse
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
      invalidateBacklog(queryClient, siteId)
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
    onSuccess: (result, variables) => {
      updateBacklogRows(queryClient, siteId, (row) => {
        if (row.articleId !== variables.articleId) return row
        if (!result.refreshed) return row
        return {
          ...row,
          poiScanValidated: false,
          poiScanValidatedAt: null,
        }
      })
      invalidateBacklog(queryClient, siteId)
    },
  })
}

export function useArticlePoiSetScanValidation(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation<SetScanValidationResponse, Error, { articleId: string; validated: boolean }>({
    mutationFn: async ({ articleId, validated }) => {
      if (!siteId) throw new Error("No site selected")
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/article-poi/${articleId}/scan-validation`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, validated }),
      })
      const data = (await res.json().catch(() => ({}))) as SetScanValidationResponse & { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to update scan validation")
      return data
    },
    onSuccess: (result, variables) => {
      updateBacklogRows(queryClient, siteId, (row) =>
        row.articleId === variables.articleId
          ? {
              ...row,
              poiScanValidated: result.poiScanValidated,
              poiScanValidatedAt: result.poiScanValidatedAt,
            }
          : row
      )
      invalidateBacklog(queryClient, siteId, "none")
    },
  })
}

export function useArticlePoiRecomputeCandidate(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation<
    RecomputeCandidateResponse,
    Error,
    { articleId: string; candidateId: string; refreshFromWp?: boolean; onlySuggestionRlPlaceId?: string }
  >({
    mutationFn: async ({ articleId, candidateId, refreshFromWp = false, onlySuggestionRlPlaceId }) => {
      if (!siteId) throw new Error("No site selected")
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/article-poi/${articleId}/candidate/recompute`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, candidateId, refreshFromWp, onlySuggestionRlPlaceId }),
      })
      const data = (await res.json().catch(() => ({}))) as RecomputeCandidateResponse & { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to recompute candidate")
      return data
    },
    onSuccess: (result, variables) => {
      updateBacklogRows(queryClient, siteId, (row) => {
        if (row.articleId !== variables.articleId) return row
        const nextCandidates = (row.detectedCandidates || []).map((candidate) =>
          candidate.candidate_id === variables.candidateId ? result.candidate : candidate
        )
        return {
          ...row,
          detectedCandidates: nextCandidates,
          ...computeDerivedCounts(nextCandidates),
        }
      })
      invalidateBacklog(queryClient, siteId, "none")
    },
  })
}

export function useArticlePoiMarkCandidate(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation<
    MarkCandidateResponse,
    Error,
    { articleId: string; candidateName: string; sectionTitle?: string; source?: "h1" | "h2" | "h3" | "title" | "body" | "fallback" }
  >({
    mutationFn: async ({ articleId, candidateName, sectionTitle, source = "body" }) => {
      if (!siteId) throw new Error("No site selected")
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/article-poi/${articleId}/candidate/mark`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, candidateName, sectionTitle, source }),
      })
      const data = (await res.json().catch(() => ({}))) as MarkCandidateResponse & { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to mark candidate")
      return data
    },
    onSuccess: (result, variables) => {
      updateBacklogRows(queryClient, siteId, (row) => {
        if (row.articleId !== variables.articleId) return row
        const currentCandidates = row.detectedCandidates || []
        const hasCandidate = currentCandidates.some((candidate) => candidate.candidate_id === result.candidateId)
        const nextCandidates = hasCandidate
          ? currentCandidates.map((candidate) => (candidate.candidate_id === result.candidateId ? result.candidate : candidate))
          : [result.candidate, ...currentCandidates]
        return {
          ...row,
          detectedCandidates: nextCandidates,
          ...computeDerivedCounts(nextCandidates),
        }
      })
      invalidateBacklog(queryClient, siteId, "none")
    },
  })
}

export function useArticlePoiManualLink(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation<
    ManualLinkResponse,
    Error,
    {
      articleId: string
      rlPlaceId: string
      rlPlaceName?: string
      placeType?: string
      placeTypeLabelFr?: string
      clusterId?: string
      clusterName?: string
      confidence?: PoiConfidence
      score?: number
      validated?: boolean
      candidateId?: string
    }
  >({
    mutationFn: async (payload: {
      articleId: string
      rlPlaceId: string
      rlPlaceName?: string
      placeType?: string
      placeTypeLabelFr?: string
      clusterId?: string
      clusterName?: string
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
          placeType: payload.placeType,
          placeTypeLabelFr: payload.placeTypeLabelFr,
          clusterId: payload.clusterId,
          clusterName: payload.clusterName,
          candidateId: payload.candidateId,
          confidence: payload.confidence ?? "high",
          score: payload.score ?? 1,
          validated: payload.validated ?? true,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        articleId?: string
        rlPlaceId?: string
        status?: string
        duplicate_link_prevented?: boolean
        existingCandidateId?: string
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Failed to link POI")
      return {
        success: !!data.success,
        articleId: data.articleId || payload.articleId,
        rlPlaceId: data.rlPlaceId || payload.rlPlaceId,
        status: data.status || "linked",
        duplicate_link_prevented: data.duplicate_link_prevented === true,
        existingCandidateId: data.existingCandidateId,
      } satisfies ManualLinkResponse
    },
    onSuccess: (result, payload) => {
      updateBacklogRows(queryClient, siteId, (row) => {
        if (row.articleId !== payload.articleId) return row
        const targetCandidateId = result.duplicate_link_prevented
          ? result.existingCandidateId
          : payload.candidateId
        if (!targetCandidateId) return row
        const nextCandidates = (row.detectedCandidates || []).map((candidate) =>
          candidate.candidate_id === targetCandidateId
            ? {
                ...candidate,
                rl_place_id: payload.rlPlaceId,
                rl_place_name: payload.rlPlaceName || candidate.rl_place_name || candidate.name,
                rl_place_type: payload.placeType || candidate.rl_place_type,
                rl_place_type_label_fr: payload.placeTypeLabelFr || candidate.rl_place_type_label_fr,
                rl_cluster_id: payload.clusterId || candidate.rl_cluster_id,
                rl_cluster_name: payload.clusterName || candidate.rl_cluster_name,
                link_status: "linked" as PoiAssociationStatus,
                validated: payload.validated ?? true,
                suggestions: [],
              }
            : candidate
        )
        return {
          ...row,
          detectedCandidates: nextCandidates,
          ...computeDerivedCounts(nextCandidates),
        }
      })
      invalidateBacklog(queryClient, siteId, "none")
    },
  })
}

export function useArticlePoiUnlink(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { articleId: string; candidateId: string }) => {
      if (!siteId) throw new Error("No site selected")
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/article-poi/${payload.articleId}/unlink`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          candidateId: payload.candidateId,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to unlink POI")
      return data
    },
    onSuccess: (_result, payload) => {
      updateBacklogRows(queryClient, siteId, (row) => {
        if (row.articleId !== payload.articleId) return row
        const nextCandidates = (row.detectedCandidates || []).map((candidate) =>
          candidate.candidate_id === payload.candidateId
            ? {
                ...candidate,
                rl_place_id: undefined,
                rl_place_name: null,
                rl_place_type: undefined,
                rl_place_type_label_fr: undefined,
                rl_cluster_id: undefined,
                rl_cluster_name: undefined,
                validated: false,
                link_status: "needs_review" as PoiAssociationStatus,
              }
            : candidate
        )
        return {
          ...row,
          detectedCandidates: nextCandidates,
          ...computeDerivedCounts(nextCandidates),
        }
      })
      invalidateBacklog(queryClient, siteId, "none")
    },
  })
}

export function useArticlePoiRemoveCandidate(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation<
    { success: boolean; articleId: string; removedCandidateId: string; remainingCandidates: number },
    Error,
    { articleId: string; candidateId: string }
  >({
    mutationFn: async (payload: { articleId: string; candidateId: string }) => {
      if (!siteId) throw new Error("No site selected")
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/article-poi/${payload.articleId}/candidate/remove`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          candidateId: payload.candidateId,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        articleId?: string
        removedCandidateId?: string
        remainingCandidates?: number
        error?: string
      }
      if (!res.ok) throw new Error(data.error || "Failed to remove candidate")
      return {
        success: !!data.success,
        articleId: data.articleId || payload.articleId,
        removedCandidateId: data.removedCandidateId || payload.candidateId,
        remainingCandidates: data.remainingCandidates ?? 0,
      }
    },
    onSuccess: (_result, payload) => {
      updateBacklogRows(queryClient, siteId, (row) => {
        if (row.articleId !== payload.articleId) return row
        const nextCandidates = (row.detectedCandidates || []).filter((candidate) => candidate.candidate_id !== payload.candidateId)
        return {
          ...row,
          detectedCandidates: nextCandidates,
          ...computeDerivedCounts(nextCandidates),
        }
      })
      if (siteId) {
        invalidateBacklog(queryClient, siteId, "none")
      }
    },
  })
}

export function useArticlePoiCreateRl(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation<
    CreateRlResponse,
    Error,
    Omit<CreateRlBody, "siteId"> & {
      articleId: string
    }
  >({
    mutationFn: async (payload) => {
      if (!siteId) throw new Error("No site selected")
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/article-poi/${payload.articleId}/create-rl`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          regionId: payload.regionId,
          candidateId: payload.candidateId,
          name: payload.name,
          placeName: payload.placeName,
          placeType: payload.placeType,
          clusterId: payload.clusterId,
          clusterName: payload.clusterName,
          blocks: payload.blocks,
          payload: payload.payload,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean
        articleId?: string
        createdRlPlaceId?: string
        createdRlPlaceInstanceId?: string
        duplicate_link_prevented?: boolean
        existingCandidateId?: string
        error?: string
        status?: number
        details?: unknown
        rl_write_target?: string
        rl_read_target?: string
      }
      if (!res.ok) {
        const detailMessage = (() => {
          if (!data.details) return ""
          if (typeof data.details === "string") return data.details
          if (typeof data.details === "object" && data.details !== null) {
            const detailsRecord = data.details as Record<string, unknown>
            const messages = detailsRecord.message
            if (Array.isArray(messages)) {
              const first = messages.find((entry) => typeof entry === "string")
              if (typeof first === "string") return first
            }
            if (typeof detailsRecord.error === "string") return detailsRecord.error
          }
          return ""
        })()
        const statusMessage = typeof data.status === "number" ? ` (RL ${data.status})` : ""
        const suffix = detailMessage ? `: ${detailMessage}` : ""
        throw new Error(`${data.error || "Failed to create RL place"}${statusMessage}${suffix}`)
      }
      return {
        success: !!data.success,
        articleId: data.articleId || payload.articleId,
        createdRlPlaceId: data.createdRlPlaceId,
        createdRlPlaceInstanceId: data.createdRlPlaceInstanceId,
        rl_write_target: data.rl_write_target,
        rl_read_target: data.rl_read_target,
        duplicate_link_prevented: data.duplicate_link_prevented === true,
        existingCandidateId: data.existingCandidateId,
      } satisfies CreateRlResponse
    },
    onSuccess: () => {
      invalidateBacklog(queryClient, siteId)
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
