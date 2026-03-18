import { useQuery } from "@tanstack/react-query"
import type { Draft } from "@/types"

export function useDrafts() {
  return useQuery({
    queryKey: ["drafts"],
    queryFn: async (): Promise<Draft[]> => {
      await new Promise((r) => setTimeout(r, 300))
      const data = await import("@/mocks/drafts.json")
      return data.default as Draft[]
    },
  })
}

export function useDraftForArticle(articleId: string | undefined) {
  const { data: drafts, ...rest } = useDrafts()
  return {
    ...rest,
    data: drafts?.find((d) => d.articleId === articleId),
  }
}
