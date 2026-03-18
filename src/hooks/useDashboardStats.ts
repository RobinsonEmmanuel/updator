import { useMemo } from "react"
import { useArticles, useSites, useOpenSignals } from "@/hooks"

export interface DashboardStats {
  articlesToUpdate: number
  articlesDoneToday: number
  sitesAtQuota: number
  sitesTotal: number
  averageAgeDays: number
  openSignalsCount: number
}

function daysSince(dateString: string): number {
  const date = new Date(dateString)
  const now = new Date()
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export function useDashboardStats(siteId?: string | null) {
  const { data: articles, isLoading: articlesLoading } = useArticles(
    siteId ? { siteId } : undefined
  )
  const { data: sites, isLoading: sitesLoading } = useSites()
  const { data: signals } = useOpenSignals(siteId ?? undefined)

  const stats = useMemo<DashboardStats | null>(() => {
    if (!articles || !sites) return null

    const filteredSites = siteId 
      ? sites.filter(s => s.id === siteId)
      : sites

    const toUpdate = articles.filter((a) => a.status === "to_update")
    const done = articles.filter((a) => a.status === "done")
    const atQuota = filteredSites.filter(
      (s) => s.todayUpdateCount >= s.maxArticlesPerDay
    )

    const avgAge =
      toUpdate.length > 0
        ? Math.round(
            toUpdate.reduce((sum, a) => sum + daysSince(a.lastModifiedAt), 0) /
              toUpdate.length
          )
        : 0

    return {
      articlesToUpdate: toUpdate.length,
      articlesDoneToday: done.length,
      sitesAtQuota: atQuota.length,
      sitesTotal: filteredSites.length,
      averageAgeDays: avgAge,
      openSignalsCount: signals?.length ?? 0,
    }
  }, [articles, sites, signals, siteId])

  return {
    data: stats,
    isLoading: articlesLoading || sitesLoading,
  }
}
