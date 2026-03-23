import { useQueries } from "@tanstack/react-query"
import { useWpConfig } from "@/lib/WpConfigContext"
import { fetchWpSiteBundle } from "@/lib/wpSiteBundle"
import type { WpPostListItem, WpCategoryListItem } from "@/types/wordpress"

export interface WpPostWithSite extends WpPostListItem {
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

export interface SiteWithData {
  siteId: string
  siteName: string
  posts: WpPostWithSite[]
  categories: WpCategoryListItem[]
}

export interface AllSitesData {
  allPosts: WpPostWithSite[]
  allCategories: WpCategoryListItem[]
  siteData: SiteWithData[]
  stats: AllSitesStats
  priorityPosts: WpPostWithSite[]
  /**
   * True tant qu’aucun bundle n’a fini (écran d’attente initial).
   * Dès qu’au moins un site a répondu, false → UI progressive.
   */
  isLoading: boolean
  /** Bundles terminés (succès ou erreur), pour affichage X / Y sites */
  bundlesReadyCount: number
  bundlesTotalCount: number
  /** Au moins un site encore en attente de première réponse */
  hasPendingBundles: boolean
  error: Error | null
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

export function useAllSitesData(options?: { enabled?: boolean }): AllSitesData {
  const enabled = options?.enabled !== false
  const { connectedSites, isLoading: sitesLoading } = useWpConfig()

  const siteQueries = useQueries({
    queries: connectedSites.map((site) => ({
      queryKey: ["wp-site-bundle", site._id] as const,
      queryFn: () => fetchWpSiteBundle(site._id, false),
      staleTime: 5 * 60 * 1000,
      retry: 1,
      enabled: enabled && connectedSites.length > 0,
    })),
  })

  const bundlesTotalCount = enabled ? connectedSites.length : 0
  /** Premier rendu « tout vide » : aucune requête n’a encore abouti */
  const allBundlesStillPending =
    enabled &&
    bundlesTotalCount > 0 &&
    siteQueries.length > 0 &&
    siteQueries.every((q) => q.isPending)

  const bundlesReadyCount = enabled
    ? siteQueries.filter((q) => !q.isPending).length
    : 0

  const hasPendingBundles =
    enabled && bundlesTotalCount > 0 && bundlesReadyCount < bundlesTotalCount

  const isLoading = sitesLoading || allBundlesStillPending

  const error = enabled ? siteQueries.find((q) => q.error)?.error : undefined

  const siteData: SiteWithData[] = !enabled
    ? []
    : connectedSites.map((site, index) => {
        const bundle = siteQueries[index]?.data
        const rawPosts = bundle?.posts || []
        const postsWithSite: WpPostWithSite[] = rawPosts.map((post) => ({
          ...post,
          _siteId: site._id,
          _siteName: site.name,
        }))
        return {
          siteId: site._id,
          siteName: site.name,
          posts: postsWithSite,
          categories: bundle?.categories || [],
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
    avgAgeDays:
      allPosts.length > 0
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
    bundlesReadyCount,
    bundlesTotalCount,
    hasPendingBundles,
    error: error as Error | null,
  }
}
