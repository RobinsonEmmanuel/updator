import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PoiMentionReview {
  action: "approve" | "reject"
  reviewedAt: string
  reviewedBy?: string
}

export interface PoiMention {
  _id: string
  article_id: string
  nom_dans_article: string
  place_type: string
  infos_presentes: string[]
  extrait?: string
  rl_poi_id?: string
  rl_poi_name?: string
  match_confidence?: number
  match_status?: "auto" | "needs_review" | "buffer" | string
  review?: PoiMentionReview | null
  extracted_at?: string
}

export interface PoiMentionArticleMeta {
  _id: string
  title: string
  slug: string
  url_fr?: string
  primary_cluster_id?: string
  wp_modified_at?: string
}

export interface PoiMentionArticleStats {
  total: number
  auto: number
  needs_review: number
  buffer: number
  approved: number
  rejected: number
}

export interface PoiMentionArticleResponse {
  article: PoiMentionArticleMeta
  stats: PoiMentionArticleStats
  mentions: PoiMention[]
}

export interface PoiMentionsListResponse {
  total: number
  page: number
  limit: number
  pages: number
  results: PoiMention[]
}

export interface PoiMentionsStats {
  total_mentions: number
  total_articles: number
  by_status: Record<string, number>
  by_place_type: Array<{ place_type: string; count: number; avg_confidence: number }>
}

export interface ArticleContent {
  _id: string
  site_id?: string
  wp_id?: number
  title?: string
  slug?: string
  markdown?: string
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function usePoiMentionsStats() {
  return useQuery<PoiMentionsStats>({
    queryKey: ["poi-mentions-stats"],
    queryFn: async () => {
      const res = await apiFetch("/api/poi-mentions/stats")
      if (!res.ok) throw new Error("Impossible de récupérer les statistiques POI")
      return res.json()
    },
    staleTime: 30000,
  })
}

/** Fetches all pages to collect unique article IDs */
export function usePoiMentionsArticleIds() {
  return useQuery<string[]>({
    queryKey: ["poi-mentions-article-ids"],
    queryFn: async () => {
      const res = await apiFetch("/api/poi-mentions?page=1&limit=200")
      if (!res.ok) throw new Error("Impossible de récupérer les mentions")
      const data: PoiMentionsListResponse = await res.json()
      const ids = Array.from(new Set(data.results.map((m) => m.article_id)))
      return ids
    },
    staleTime: 60000,
  })
}

export function usePoiMentionsByArticle(articleId: string | null) {
  return useQuery<PoiMentionArticleResponse>({
    queryKey: ["poi-mentions-article", articleId],
    queryFn: async () => {
      const res = await apiFetch(`/api/poi-mentions/article/${articleId}`)
      if (!res.ok) throw new Error("Impossible de récupérer les mentions de cet article")
      return res.json()
    },
    enabled: !!articleId,
    staleTime: 10000,
  })
}

export function usePoiArticleContent(articleId: string | null) {
  return useQuery<ArticleContent>({
    queryKey: ["poi-article-content", articleId],
    queryFn: async () => {
      const res = await apiFetch(`/api/poi-mentions/article-content/${articleId}`)
      if (!res.ok) throw new Error("Impossible de récupérer le contenu de l'article")
      return res.json()
    },
    enabled: !!articleId,
    staleTime: 300000,
  })
}

export function useReviewPoiMention() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ mentionId, action }: { mentionId: string; action: "approve" | "reject" }) => {
      const res = await apiFetch(`/api/poi-mentions/${mentionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((data as { error?: string }).error || "Échec de la revue")
      return data
    },
    onSuccess: (_data, { mentionId }) => {
      // Invalidate article-level queries to refresh stats
      queryClient.invalidateQueries({ queryKey: ["poi-mentions-article"] })
      queryClient.invalidateQueries({ queryKey: ["poi-mentions-stats"] })
      // Optimistic-style: invalidate the specific mention
      queryClient.invalidateQueries({ queryKey: ["poi-mention", mentionId] })
    },
  })
}
