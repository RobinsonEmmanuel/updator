import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type { PoiExtractionFields } from "@/features/article-poi-catchup/poiExtractionContract"

export interface IngestionRunCounts {
  ok: number
  skipped: number
  failed: number
}

export interface IngestionRunTotals {
  inserted: number
  updated: number
  softDeleted: number
  skippedNoMatch: number
  errorsCount: number
}

export interface IngestionRun {
  runId: string
  status: "queued" | "processing" | "completed" | "completed_with_errors" | "failed" | string
  source?: "cli" | "cron" | "manual" | string
  startedAt?: string
  endedAt?: string
  durationMs?: number
  counts?: IngestionRunCounts
  totals?: IngestionRunTotals
}

export type IngestionRunSummary = IngestionRun

export type IngestionStatus = IngestionRun | null

export function useIngestionStatus() {
  return useQuery<IngestionStatus>({
    queryKey: ["ingestion-status"],
    queryFn: async () => {
      const res = await apiFetch("/api/ingestions/status")
      if (!res.ok) throw new Error("Impossible de récupérer le statut d'ingestion")
      return res.json()
    },
    refetchInterval: (query) => {
      const run = query.state.data as IngestionRun | null
      if (run?.status === "queued" || run?.status === "processing") return 5000
      return 20000
    },
  })
}

export function useIngestionRuns(limit = 30) {
  return useQuery<IngestionRun[]>({
    queryKey: ["ingestion-runs", limit],
    queryFn: async () => {
      const res = await apiFetch(`/api/ingestions/runs?limit=${limit}`)
      if (!res.ok) throw new Error("Impossible de récupérer l'historique")
      const data = await res.json()
      if (Array.isArray(data)) return data
      if (Array.isArray(data?.data)) return data.data
      return []
    },
    refetchInterval: 15000,
  })
}

export interface ArticleRawWpSource {
  site_url?: string
  post_url?: string
  rest_endpoint?: string
  last_seen_at?: string
  sync_run_id?: string
}

export interface ArticleRawPoiCandidate extends PoiExtractionFields {
  candidate_id: string
  name: string
  source?: string
  mention_score?: number
  frequency?: number
}

export interface ArticleRaw {
  _id: string
  site_id: string
  wp_id: number
  title: string
  slug: string
  post_status: string
  author_name?: string
  categories?: string[]
  tags?: string[]
  wp_created_at?: string
  wp_modified_at?: string
  last_sync_at?: string
  is_deleted?: boolean
  wp_source?: ArticleRawWpSource
  cluster_ids?: string[]
  cluster_match_status?: string
  cluster_match_confidence?: number
  primary_cluster_id?: string
  poi_candidates?: ArticleRawPoiCandidate[]
  meta_description?: string
  urls_by_lang?: Record<string, string>
  [key: string]: unknown
}

export interface ResolvedArticle {
  siteId: string
  siteName: string
  wpId: number
}

export function useArticleRaw(siteId: string | null, wpId: number | null) {
  return useQuery<ArticleRaw>({
    queryKey: ["article-raw", siteId, wpId],
    queryFn: async () => {
      const res = await apiFetch(`/api/ingestions/article-raw?siteId=${siteId}&wpId=${wpId}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Article introuvable")
      }
      return res.json()
    },
    enabled: !!siteId && !!wpId,
    staleTime: 30000,
  })
}

export function useResolveArticleUrl() {
  return useMutation({
    mutationFn: async (url: string): Promise<ResolvedArticle> => {
      const res = await apiFetch(`/api/ingestions/resolve-url?url=${encodeURIComponent(url)}`)
      const data = await res.json()
      if (!res.ok) throw new Error((data as { error?: string }).error || "Résolution échouée")
      return data as ResolvedArticle
    },
  })
}

export function useTriggerIngestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/ingestions/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all", writeMode: "insert-missing" }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Échec du déclenchement")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-runs"] })
      queryClient.invalidateQueries({ queryKey: ["ingestion-status"] })
    },
  })
}

export function useTriggerSiteIngestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (siteId: string) => {
      const res = await apiFetch("/api/ingestions/trigger-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, writeMode: "insert-missing" }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Échec du déclenchement")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-runs"] })
      queryClient.invalidateQueries({ queryKey: ["ingestion-status"] })
    },
  })
}

export function useTriggerUrlIngestion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ siteId, wpId }: { siteId: string; wpId: number }) => {
      const res = await apiFetch("/api/ingestions/trigger-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, wpId, writeMode: "insert-missing" }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Échec du déclenchement")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion-runs"] })
      queryClient.invalidateQueries({ queryKey: ["ingestion-status"] })
    },
  })
}
