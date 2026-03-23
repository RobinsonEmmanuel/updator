export interface ScoringCluster {
  id: string
  name: string
}

export interface PostForScoring {
  id: number
  slug: string
  title: { rendered?: string }
  categories: number[]
}

interface CategoryRef {
  id: number
  name: string
}

export interface ClusterScoringResult {
  clusterIds: string[]
  confidence: number
  status: "auto" | "needs_review"
  sourceSignals: string[]
}

function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokens(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .filter((t) => t.length >= 3)
}

function uniqueTokens(text: string): Set<string> {
  return new Set(tokens(text))
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let overlap = 0
  for (const t of a) if (b.has(t)) overlap++
  return overlap / Math.max(a.size, b.size)
}

function isBestOf(text: string): boolean {
  const n = normalizeText(text)
  return /best of|meilleurs|incontournables|top [0-9]+|que faire/.test(n)
}

function confidenceToStatus(confidence: number): "auto" | "needs_review" {
  return confidence >= 0.75 ? "auto" : "needs_review"
}

export function scorePostClusters(
  post: PostForScoring,
  categories: CategoryRef[],
  clusters: ScoringCluster[]
): ClusterScoringResult {
  const categoryNames = categories
    .filter((c) => post.categories.includes(c.id))
    .map((c) => c.name)
    .join(" ")

  const title = post.title?.rendered || ""
  const mergedText = `${title} ${post.slug} ${categoryNames}`.trim()
  const bestOf = isBestOf(mergedText)
  const sourceSignals: string[] = []
  if (bestOf) sourceSignals.push("bestof_pattern")

  const postTokens = uniqueTokens(mergedText)
  const ranked = clusters
    .map((cluster) => {
      const clusterTokens = uniqueTokens(cluster.name)
      let score = overlapRatio(postTokens, clusterTokens)

      const normalizedTitle = normalizeText(title)
      const normalizedCluster = normalizeText(cluster.name)

      if (normalizedTitle.includes(normalizedCluster) && normalizedCluster.length > 3) {
        score += 0.35
      }
      if (normalizeText(post.slug).includes(normalizedCluster.replace(/\s+/g, "-"))) {
        score += 0.2
      }
      if (bestOf) score += 0.08

      return { cluster, score: Math.min(score, 1) }
    })
    .sort((a, b) => b.score - a.score)

  const top = ranked.slice(0, bestOf ? 8 : 4)
  const accepted = top.filter((r) => r.score >= (bestOf ? 0.35 : 0.5))
  const clusterIds = accepted.map((r) => r.cluster.id)
  const confidence = top[0]?.score ?? 0

  if (clusterIds.length > 0) {
    sourceSignals.push("token_overlap")
    if (top[0] && top[0].score >= 0.75) sourceSignals.push("title_exact")
  }

  return {
    clusterIds,
    confidence,
    status: confidenceToStatus(confidence),
    sourceSignals,
  }
}
