import type { ArticlePoiBacklogRow, PoiCandidateGroup } from "@/hooks/useArticlePoiCatchup"

interface BacklogResponseLike {
  data?: unknown
  total?: number
  page?: number
  limit?: number
  summary?: Record<string, unknown>
  categories?: unknown
}

export interface ArticlePoiMutationResult {
  articleId: string
  success: boolean
  message?: string
}

function normalizeCandidate(raw: unknown): PoiCandidateGroup | null {
  if (!raw || typeof raw !== "object") return null
  const candidate = raw as PoiCandidateGroup
  if (typeof candidate.candidate_id !== "string" || candidate.candidate_id.length === 0) return null
  return {
    ...candidate,
    suggestions: Array.isArray(candidate.suggestions) ? candidate.suggestions : [],
    occurrences: Array.isArray(candidate.occurrences) ? candidate.occurrences : [],
  }
}

function normalizeRow(raw: unknown): ArticlePoiBacklogRow | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as ArticlePoiBacklogRow
  if (typeof row.articleId !== "string" || typeof row.title !== "string") return null
  return {
    ...row,
    detectedCandidates: Array.isArray(row.detectedCandidates)
      ? row.detectedCandidates.map(normalizeCandidate).filter((candidate): candidate is PoiCandidateGroup => !!candidate)
      : [],
    categories: Array.isArray(row.categories) ? row.categories.filter((category): category is string => typeof category === "string") : [],
  }
}

export function mapBacklogResponse(raw: unknown): {
  data: ArticlePoiBacklogRow[]
  total: number
  page: number
  limit: number
  summary: Record<string, unknown>
  categories: string[]
} {
  const input = (raw || {}) as BacklogResponseLike
  const rows = Array.isArray(input.data)
    ? input.data.map(normalizeRow).filter((row): row is ArticlePoiBacklogRow => !!row)
    : []
  return {
    data: rows,
    total: typeof input.total === "number" ? input.total : rows.length,
    page: typeof input.page === "number" ? input.page : 1,
    limit: typeof input.limit === "number" ? input.limit : 50,
    summary: input.summary && typeof input.summary === "object" ? input.summary : {},
    categories: Array.isArray(input.categories)
      ? input.categories.filter((category): category is string => typeof category === "string")
      : [],
  }
}
