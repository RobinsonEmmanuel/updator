import type { WpPostListItem, WpCategoryListItem } from "@/types/wordpress"

export interface CategoryWithStats extends WpCategoryListItem {
  posts: WpPostListItem[]
  outdatedCount: number
  upToDatePercent: number
}

export type CategoryWithStatsForSite = CategoryWithStats & { siteId: string }

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

function isOutdatedPost(p: WpPostListItem): boolean {
  return Date.now() - new Date(p.modified).getTime() > ONE_YEAR_MS
}

export function computeCategoryStats(
  posts: WpPostListItem[],
  categories: WpCategoryListItem[]
): CategoryWithStats[] {
  return categories
    .filter((cat) => cat.count > 0)
    .map((cat) => {
      const catPosts = posts.filter((p) => p.categories.includes(cat.id))
      const outdatedCount = catPosts.filter(isOutdatedPost).length
      const upToDateCount = catPosts.length - outdatedCount
      return {
        ...cat,
        posts: catPosts,
        outdatedCount,
        upToDatePercent:
          catPosts.length > 0 ? Math.round((upToDateCount / catPosts.length) * 100) : 100,
      }
    })
    .sort((a, b) => a.upToDatePercent - b.upToDatePercent)
}

export function flattenCategoryStatsPerSite(
  siteData: Array<{ siteId: string; posts: WpPostListItem[]; categories: WpCategoryListItem[] }>
): CategoryWithStatsForSite[] {
  return siteData.flatMap((sd) =>
    computeCategoryStats(sd.posts, sd.categories).map((c) => ({
      ...c,
      siteId: sd.siteId,
    }))
  )
}
