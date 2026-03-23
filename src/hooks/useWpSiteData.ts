import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import type { ConnectedSite } from "@/lib/WpConfigContext"
import type { WpPost, WpCategory } from "@/types/wordpress"

interface WpSiteStats {
  total: number
  outdated: number
  upToDate: number
  avgAgeDays: number
  updatedToday: number
}

interface CategoryWithStats extends WpCategory {
  posts: WpPost[]
  outdatedCount: number
  upToDatePercent: number
}

export interface WpSiteData {
  posts: WpPost[]
  categories: WpCategory[]
  categoriesWithStats: CategoryWithStats[]
  stats: WpSiteStats
  priorityPosts: WpPost[]
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
const ONE_DAY_MS = 24 * 60 * 60 * 1000

function isOutdated(post: WpPost): boolean {
  const modifiedDate = new Date(post.modified)
  return Date.now() - modifiedDate.getTime() > ONE_YEAR_MS
}

function getAgeDays(post: WpPost): number {
  const modifiedDate = new Date(post.modified)
  return Math.floor((Date.now() - modifiedDate.getTime()) / ONE_DAY_MS)
}

function isUpdatedToday(post: WpPost): boolean {
  const modifiedDate = new Date(post.modified)
  const today = new Date()
  return (
    modifiedDate.getFullYear() === today.getFullYear() &&
    modifiedDate.getMonth() === today.getMonth() &&
    modifiedDate.getDate() === today.getDate()
  )
}

async function fetchPostsViaProxy(siteId: string): Promise<{ data: WpPost[]; total: number }> {
  const res = await apiFetch(`/api/wp-proxy/${siteId}/posts`)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `Failed to fetch posts: ${res.status}`)
  }
  return res.json()
}

async function fetchCategoriesViaProxy(siteId: string): Promise<WpCategory[]> {
  const res = await apiFetch(`/api/wp-proxy/${siteId}/categories`)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `Failed to fetch categories: ${res.status}`)
  }
  return res.json()
}

export function useWpSiteData(site: ConnectedSite | null): WpSiteData {
  const postsQuery = useQuery({
    queryKey: ["wp-site-posts", site?._id],
    queryFn: async () => {
      if (!site) return { data: [], total: 0 }
      return fetchPostsViaProxy(site._id)
    },
    enabled: !!site,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const categoriesQuery = useQuery({
    queryKey: ["wp-site-categories", site?._id],
    queryFn: async () => {
      if (!site) return []
      return fetchCategoriesViaProxy(site._id)
    },
    enabled: !!site,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  })

  const posts = postsQuery.data?.data || []
  const categories = categoriesQuery.data || []

  const outdatedPosts = posts.filter(isOutdated)
  const upToDatePosts = posts.filter(p => !isOutdated(p))

  const stats: WpSiteStats = {
    total: postsQuery.data?.total || posts.length,
    outdated: outdatedPosts.length,
    upToDate: upToDatePosts.length,
    avgAgeDays: posts.length > 0 
      ? Math.round(posts.reduce((sum, p) => sum + getAgeDays(p), 0) / posts.length)
      : 0,
    updatedToday: posts.filter(isUpdatedToday).length,
  }

  const categoriesWithStats: CategoryWithStats[] = categories
    .filter(cat => cat.count > 0)
    .map(cat => {
      const catPosts = posts.filter(p => p.categories.includes(cat.id))
      const outdatedCount = catPosts.filter(isOutdated).length
      const upToDateCount = catPosts.length - outdatedCount
      return {
        ...cat,
        posts: catPosts,
        outdatedCount,
        upToDatePercent: catPosts.length > 0 
          ? Math.round((upToDateCount / catPosts.length) * 100)
          : 100,
      }
    })
    .sort((a, b) => a.upToDatePercent - b.upToDatePercent)

  const priorityPosts = [...posts]
    .filter(p => p.status === "publish")
    .sort((a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime())
    .slice(0, 10)

  return {
    posts,
    categories,
    categoriesWithStats,
    stats,
    priorityPosts,
    isLoading: postsQuery.isLoading || categoriesQuery.isLoading,
    error: (postsQuery.error || categoriesQuery.error) as Error | null,
    refetch: () => {
      postsQuery.refetch()
      categoriesQuery.refetch()
    },
  }
}
