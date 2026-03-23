import { useQueries } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { useWpConfig } from "@/lib/WpConfigContext"
import type { WpPost, WpCategory } from "@/types/wordpress"

export interface WpPostWithSite extends WpPost {
  _siteId: string
  _siteName: string
}

interface AllSitesStats {
  total: number
  outdated: number
  upToDate: number
  avgAgeDays: number
  updatedToday: number
}

interface SiteWithData {
  siteId: string
  siteName: string
  posts: WpPostWithSite[]
  categories: WpCategory[]
}

export interface AllSitesData {
  allPosts: WpPostWithSite[]
  allCategories: WpCategory[]
  siteData: SiteWithData[]
  stats: AllSitesStats
  priorityPosts: WpPostWithSite[]
  isLoading: boolean
  error: Error | null
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

export function useAllSitesData(): AllSitesData {
  const { connectedSites, isLoading: sitesLoading } = useWpConfig()

  const postsQueries = useQueries({
    queries: connectedSites.map((site) => ({
      queryKey: ["wp-site-posts", site._id],
      queryFn: () => fetchPostsViaProxy(site._id),
      staleTime: 5 * 60 * 1000,
      retry: 1,
    })),
  })

  const categoriesQueries = useQueries({
    queries: connectedSites.map((site) => ({
      queryKey: ["wp-site-categories", site._id],
      queryFn: () => fetchCategoriesViaProxy(site._id),
      staleTime: 30 * 60 * 1000,
      retry: 1,
    })),
  })

  const isLoading = sitesLoading || 
    postsQueries.some((q) => q.isLoading) || 
    categoriesQueries.some((q) => q.isLoading)

  const error = postsQueries.find((q) => q.error)?.error || 
    categoriesQueries.find((q) => q.error)?.error

  const siteData: SiteWithData[] = connectedSites.map((site, index) => {
    const rawPosts = postsQueries[index]?.data?.data || []
    const postsWithSite: WpPostWithSite[] = rawPosts.map((post) => ({
      ...post,
      _siteId: site._id,
      _siteName: site.name,
    }))
    return {
      siteId: site._id,
      siteName: site.name,
      posts: postsWithSite,
      categories: categoriesQueries[index]?.data || [],
    }
  })

  const allPosts = siteData.flatMap((sd) => sd.posts)
  const allCategories = siteData.flatMap((sd) => sd.categories)

  const outdatedPosts = allPosts.filter(isOutdated)
  const upToDatePosts = allPosts.filter((p) => !isOutdated(p))

  const stats: AllSitesStats = {
    total: allPosts.length,
    outdated: outdatedPosts.length,
    upToDate: upToDatePosts.length,
    avgAgeDays: allPosts.length > 0
      ? Math.round(allPosts.reduce((sum, p) => sum + getAgeDays(p), 0) / allPosts.length)
      : 0,
    updatedToday: allPosts.filter(isUpdatedToday).length,
  }

  const priorityPosts = [...allPosts]
    .filter((p) => p.status === "publish")
    .sort((a, b) => new Date(a.modified).getTime() - new Date(b.modified).getTime())
    .slice(0, 10)

  return {
    allPosts,
    allCategories,
    siteData,
    stats,
    priorityPosts,
    isLoading,
    error: error as Error | null,
  }
}
