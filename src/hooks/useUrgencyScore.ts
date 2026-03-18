import { useMemo } from "react"
import { useArticles, useClusters } from "@/hooks"
import type { Article } from "@/types"

function daysSince(dateString: string): number {
  const date = new Date(dateString)
  const now = new Date()
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

function formatAge(days: number): string {
  if (days < 30) return `${days}j`
  if (days < 365) return `${Math.floor(days / 30)} mois`
  const years = Math.floor(days / 365)
  return `${years} an${years > 1 ? "s" : ""}`
}

export interface ScoredArticle extends Article {
  calculatedScore: number
  ageDays: number
  ageFormatted: string
  hasClusterBoost: boolean
}

export function useUrgentArticles(siteId?: string | null, limit = 10) {
  const { data: articles, isLoading: articlesLoading } = useArticles(
    siteId ? { siteId } : undefined
  )
  const { data: clusters, isLoading: clustersLoading } = useClusters(
    siteId ?? undefined
  )

  const scoredArticles = useMemo<ScoredArticle[]>(() => {
    if (!articles || !clusters) return []

    const toUpdate = articles.filter((a) => a.status === "to_update")

    const clusterOldRatios = new Map<string, number>()
    clusters.forEach((cluster) => {
      const clusterArticles = articles.filter((a) => a.clusterId === cluster.id)
      if (clusterArticles.length === 0) {
        clusterOldRatios.set(cluster.id, 0)
        return
      }
      const oldCount = clusterArticles.filter(
        (a) => daysSince(a.lastModifiedAt) > 365
      ).length
      clusterOldRatios.set(cluster.id, oldCount / clusterArticles.length)
    })

    return toUpdate
      .map((article) => {
        const ageDays = daysSince(article.lastModifiedAt)
        let calculatedScore = Math.min(100, Math.floor(ageDays / 10))

        const clusterRatio = clusterOldRatios.get(article.clusterId) ?? 0
        const hasClusterBoost = clusterRatio > 0.5

        if (hasClusterBoost) {
          calculatedScore = Math.min(100, calculatedScore + 15)
        }

        return {
          ...article,
          calculatedScore,
          ageDays,
          ageFormatted: formatAge(ageDays),
          hasClusterBoost,
        }
      })
      .sort((a, b) => b.calculatedScore - a.calculatedScore)
      .slice(0, limit)
  }, [articles, clusters, limit])

  return {
    data: scoredArticles,
    isLoading: articlesLoading || clustersLoading,
  }
}
