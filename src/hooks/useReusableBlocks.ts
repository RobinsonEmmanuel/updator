import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReusableBlock {
  _id?: string
  wp_block_id: number
  site_id: string
  title: string
  content?: string
  status?: string
  slug?: string
  synced_at?: string
  wp_modified_at?: string
}

export interface ReusableBlocksListResponse {
  total: number
  page: number
  limit: number
  pages: number
  results: ReusableBlock[]
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Liste les blocs pour un site donné */
export function useReusableBlocksBySite(siteId: string | null, query = "", status = "") {
  return useQuery<ReusableBlock[]>({
    queryKey: ["reusable-blocks-site", siteId, query, status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (query) params.set("q", query)
      if (status) params.set("status", status)
      const qs = params.toString()
      const res = await apiFetch(`/api/reusable-blocks/site/${siteId}${qs ? `?${qs}` : ""}`)
      if (!res.ok) throw new Error("Impossible de récupérer les blocs")
      const data = await res.json()
      if (Array.isArray(data)) return data
      if (Array.isArray(data?.blocks)) return data.blocks
      if (Array.isArray(data?.results)) return data.results
      if (Array.isArray(data?.data)) return data.data
      return []
    },
    enabled: !!siteId,
    staleTime: 30000,
  })
}

/** Vue globale paginée tous sites confondus */
export function useReusableBlocksGlobal(opts: {
  siteId?: string
  q?: string
  page?: number
  limit?: number
}) {
  const { siteId, q, page = 1, limit = 50 } = opts
  return useQuery<ReusableBlocksListResponse>({
    queryKey: ["reusable-blocks-global", siteId, q, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (siteId) params.set("site_id", siteId)
      if (q) params.set("q", q)
      params.set("page", String(page))
      params.set("limit", String(limit))
      const res = await apiFetch(`/api/reusable-blocks?${params.toString()}`)
      if (!res.ok) throw new Error("Impossible de récupérer les blocs")
      return res.json()
    },
    staleTime: 30000,
  })
}

/** Détail d'un bloc par son WP block ID */
export function useReusableBlock(wpBlockId: number | null, siteId: string | null) {
  return useQuery<ReusableBlock>({
    queryKey: ["reusable-block", wpBlockId, siteId],
    queryFn: async () => {
      const qs = siteId ? `?site_id=${encodeURIComponent(siteId)}` : ""
      const res = await apiFetch(`/api/reusable-blocks/${wpBlockId}${qs}`)
      if (!res.ok) throw new Error("Bloc introuvable")
      return res.json()
    },
    enabled: !!wpBlockId,
    staleTime: 60000,
  })
}

/** Déclenche la synchronisation WordPress → base pour un site */
export function useSyncReusableBlocks(siteId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!siteId) throw new Error("Aucun site sélectionné")
      const res = await apiFetch(`/api/reusable-blocks/site/${siteId}/sync`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const d = data as { error?: string; details?: string }
        const msg = [d.error, d.details].filter(Boolean).join(" — ")
        throw new Error(msg || "Échec de la synchronisation")
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reusable-blocks-site", siteId] })
      queryClient.invalidateQueries({ queryKey: ["reusable-blocks-global"] })
    },
  })
}
