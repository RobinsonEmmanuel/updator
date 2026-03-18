import { useQuery } from "@tanstack/react-query"
import type { Article, ArticleStatus, ArticleType } from "@/types"

export interface ArticleFilters {
  siteId?: string
  clusterId?: string
  status?: ArticleStatus
  type?: ArticleType
  search?: string
}

export function useArticles(filters?: ArticleFilters) {
  return useQuery({
    queryKey: ["articles", filters],
    queryFn: async (): Promise<Article[]> => {
      await new Promise((r) => setTimeout(r, 300))
      const data = await import("@/mocks/articles.json")
      let articles = data.default as Article[]

      if (filters?.siteId) {
        articles = articles.filter((a) => a.siteId === filters.siteId)
      }
      if (filters?.clusterId) {
        articles = articles.filter((a) => a.clusterId === filters.clusterId)
      }
      if (filters?.status) {
        articles = articles.filter((a) => a.status === filters.status)
      }
      if (filters?.type) {
        articles = articles.filter((a) => a.type === filters.type)
      }
      if (filters?.search) {
        const search = filters.search.toLowerCase()
        articles = articles.filter((a) =>
          a.title.toLowerCase().includes(search)
        )
      }

      return articles
    },
  })
}

export function useArticle(articleId: string | undefined) {
  const { data: articles, ...rest } = useArticles()
  return {
    ...rest,
    data: articles?.find((a) => a.id === articleId),
  }
}
