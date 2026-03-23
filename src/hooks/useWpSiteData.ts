import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchWpSiteBundle } from "@/lib/wpSiteBundle"
import { computeCategoryStats, type CategoryWithStats } from "@/lib/wpCategoryStats"
import type { ConnectedSite } from "@/lib/WpConfigContext"
import type { WpPostListItem, WpCategoryListItem } from "@/types/wordpress"

interface WpSiteStats {
  total: number
  outdated: number
  upToDate: number
  avgAgeDays: number
  updatedToday: number
}

export interface WpSiteData {
  posts: WpPostListItem[]
  categories: WpCategoryListItem[]
  categoriesWithStats: CategoryWithStats[]
  stats: WpSiteStats
  priorityPosts: WpPostListItem[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<unknown>
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function isOutdated(post: WpPostListItem): boolean {
  const modifiedDate = new Date(post.modified)
  return Date.now() - modifiedDate.getTime() > ONE_YEAR_MS
}

function getAgeDays(post: WpPostListItem): number {
  const modifiedDate = new Date(post.modified)
  return Math.floor((Date.now() - modifiedDate.getTime()) / ONE_DAY_MS)
}

function isUpdatedToday(post: WpPostListItem): boolean {
  const modifiedDate = new Date(post.modified)
  const today = new Date()
  return (
    modifiedDate.getFullYear() === today.getFullYear() &&
    modifiedDate.getMonth() === today.getMonth() &&
    modifiedDate.getDate() === today.getDate()
  )
}

export function useWpSiteData(site: ConnectedSite | null): WpSiteData {
  const queryClient = useQueryClient()

  const bundleQuery = useQuery({
    queryKey: ["wp-site-bundle", site?._id] as const,
    queryFn: async () => {
      if (!site) {
        return { posts: [], total: 0, categories: [] as WpCategoryListItem[] }
      }
      return fetchWpSiteBundle(site._id, false)
    },
    enabled: !!site,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const posts = bundleQuery.data?.posts || []
  const categories = bundleQuery.data?.categories || []

  const outdatedPosts = posts.filter(isOutdated)
  const upToDatePosts = posts.filter((p) => !isOutdated(p))

  const stats: WpSiteStats = {
    total: bundleQuery.data?.total ?? posts.length,
    outdated: outdatedPosts.length,
    upToDate: upToDatePosts.length,
    avgAgeDays:
      posts.length > 0
        ? Math.round(posts.reduce((sum, p) => sum + getAgeDays(p), 0) / posts.length)
        : 0,
    updatedToday: posts.filter(isUpdatedToday).length,
  }

  const categoriesWithStats: CategoryWithStats[] = computeCategoryStats(posts, categories)

  const priorityPosts = [...posts]
    .filter((p) => p.status === "publish")
    .sort((a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime())
    .slice(0, 10)

  const refetch = useCallback(async () => {
    if (!site) return undefined
    return queryClient.fetchQuery({
      queryKey: ["wp-site-bundle", site._id],
      queryFn: () => fetchWpSiteBundle(site._id, true),
    })
  }, [queryClient, site])

  return {
    posts,
    categories,
    categoriesWithStats,
    stats,
    priorityPosts,
    isLoading: bundleQuery.isLoading,
    error: bundleQuery.error as Error | null,
    refetch,
  }
}
