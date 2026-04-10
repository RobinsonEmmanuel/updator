import { ingestionApiUrl, ingestionFetch } from "@/lib/api"
import type { WpPostListItem, WpCategoryListItem } from "@/types/wordpress"

export interface WpSiteBundle {
  posts: WpPostListItem[]
  total: number
  categories: WpCategoryListItem[]
}

export async function fetchWpSiteBundle(siteId: string, refresh = false): Promise<WpSiteBundle> {
  const q = refresh ? "?refresh=1" : ""
  const [postsRes, catRes] = await Promise.all([
    ingestionFetch(ingestionApiUrl(`/api/v1/user/sites/${siteId}/posts${q}`)),
    ingestionFetch(ingestionApiUrl(`/api/v1/user/sites/${siteId}/categories${q}`)),
  ])
  if (!postsRes.ok) {
    const error = await postsRes.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `Failed to fetch posts: ${postsRes.status}`)
  }
  if (!catRes.ok) {
    const error = await catRes.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `Failed to fetch categories: ${catRes.status}`)
  }
  const postsJson = (await postsRes.json()) as { data: WpPostListItem[]; total: number }
  const categories = (await catRes.json()) as WpCategoryListItem[]
  return {
    posts: postsJson.data,
    total: postsJson.total,
    categories,
  }
}
