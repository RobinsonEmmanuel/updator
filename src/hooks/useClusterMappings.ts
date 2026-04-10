import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, ingestionFetch, ingestionApiUrl } from "@/lib/api"
import type { ArticleClusterMappingItem, ClusterMappingStatus } from "@/types"

interface MappingListResponse {
  data: ArticleClusterMappingItem[]
  total: number
  site: {
    _id: string
    name: string
    regionIds: string[]
  }
  clustersCatalog: Array<{ id: string; name: string }>
  staleClusterRefsCount: number
}

interface RecomputeResponse {
  success: boolean
  summary: {
    clustersLoaded: number
    wpPosts: number
    updated: number
    needsReview: number
    skippedOverridden: number
    force: boolean
  }
}

interface RegionsOverviewResponse {
  data: Array<{
    id: string
    name: string
    lastSyncedAt: string | null
    assignedSiteIds: string[]
    assignedSiteNames: string[]
    isAssignedToCurrentSite: boolean
    isUnassigned: boolean
  }>
  unknownRegionRefs: Array<{
    siteId: string
    siteName: string
    regionId: string
    isCurrentSite: boolean
  }>
  summary: {
    totalRegions: number
    unassignedRegions: number
    unknownRegionRefs: number
    currentSiteUnknownRefs: number
    crossSiteWarnings: number
  }
  crossSiteWarnings: Array<{
    regionId: string
    regionName: string
    otherSiteIds: string[]
    otherSiteNames: string[]
  }>
}

export function useClusterMappings(siteId?: string, status?: ClusterMappingStatus) {
  return useQuery({
    queryKey: ["cluster-mappings", siteId, status],
    queryFn: async (): Promise<MappingListResponse> => {
      if (!siteId) {
        return {
          data: [],
          total: 0,
          site: { _id: "", name: "", regionIds: [] },
          clustersCatalog: [],
          staleClusterRefsCount: 0,
        }
      }
      const qs = status ? `?status=${status}` : ""
      const res = await apiFetch(`/api/cluster-mappings/${siteId}${qs}`)
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(error.error || "Failed to fetch cluster mappings")
      }
      return res.json()
    },
    enabled: !!siteId,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  })
}

export function useRecomputeClusterMappings(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation<RecomputeResponse, Error, boolean>({
    mutationFn: async (force: boolean): Promise<RecomputeResponse> => {
      if (!siteId) throw new Error("No site selected")
      const qs = force ? "?force=1" : ""
      const res = await apiFetch(`/api/cluster-mappings/${siteId}/recompute${qs}`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as RecomputeResponse & { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to recompute mappings")
      return data
    },
    onSuccess: () => {
      if (siteId) {
        queryClient.invalidateQueries({ queryKey: ["cluster-mappings", siteId] })
      }
    },
  })
}

export function useOverrideClusterMapping(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { wpPostId: number; clusterIds: string[]; status?: ClusterMappingStatus }) => {
      if (!siteId) throw new Error("No site selected")
      const res = await apiFetch(`/api/cluster-mappings/${siteId}/${payload.wpPostId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to update mapping")
      return data
    },
    onSuccess: () => {
      if (siteId) {
        queryClient.invalidateQueries({ queryKey: ["cluster-mappings", siteId] })
      }
    },
  })
}

export function useUpdateSiteRegions(siteId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (regionIds: string[]) => {
      if (!siteId) throw new Error("No site selected")
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/user/sites/${siteId}/regions`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regionIds }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(data.error || "Failed to update site regions")
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connected-sites"] })
      queryClient.invalidateQueries({ queryKey: ["available-sites"] })
      if (siteId) queryClient.invalidateQueries({ queryKey: ["cluster-mappings", siteId] })
      queryClient.invalidateQueries({ queryKey: ["regions-overview"] })
    },
  })
}

export function useRegionsOverview(siteId?: string) {
  return useQuery({
    queryKey: ["regions-overview", siteId],
    queryFn: async (): Promise<RegionsOverviewResponse> => {
      const qs = siteId ? `?siteId=${siteId}` : ""
      const res = await ingestionFetch(ingestionApiUrl(`/api/v1/regions/overview${qs}`))
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(error.error || "Failed to load regions overview")
      }
      return res.json()
    },
    staleTime: 60 * 1000,
    retry: 1,
  })
}
