import type { ArticlePoiBacklogRow, PoiCandidateGroup, RegionPoiLite } from "@/hooks/useArticlePoiCatchup"

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&rsquo;|&#8217;|&#x2019;/g, "'")
    .replace(/&#8216;|&#x2018;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
}

export function normalizeForMatch(input: string): string {
  return decodeHtmlEntities(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function formatLogTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("fr-FR")
}

export function splitLinkedCandidates(candidates: PoiCandidateGroup[]): {
  linked: PoiCandidateGroup[]
  unlinked: PoiCandidateGroup[]
} {
  return {
    linked: candidates.filter((candidate) => !!candidate.rl_place_id),
    unlinked: candidates.filter((candidate) => !candidate.rl_place_id),
  }
}

export function getCandidateSuggestions(candidates: PoiCandidateGroup[]) {
  return candidates.flatMap((candidate) => candidate.suggestions || [])
}

export function countUnmatchedCandidates(candidates: PoiCandidateGroup[]): number {
  return candidates.filter((candidate) => !candidate.rl_place_id && (candidate.suggestions || []).length === 0).length
}

export function sortLabelAsc<T extends { name: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name))
}

export function buildRegionPoiMap(regionPois: RegionPoiLite[]): Map<string, RegionPoiLite> {
  return new Map(regionPois.map((poi) => [poi.rl_place_id, poi]))
}

export function computeReportingStats(rows: ArticlePoiBacklogRow[]) {
  const articlesMatchedToDirectory = rows.filter((row) => {
    if (!row.poiScanValidated) return false
    return (row.detectedCandidates || []).some((candidate) => !!candidate.rl_place_id)
  }).length
  const uniqueLinkedRlPoiCount = new Set(
    rows.flatMap((row) =>
      (row.detectedCandidates || [])
        .map((candidate) => candidate.rl_place_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  ).size
  return {
    articlesCount: rows.length,
    articlesMatchedToDirectory,
    uniqueLinkedRlPoiCount,
  }
}
