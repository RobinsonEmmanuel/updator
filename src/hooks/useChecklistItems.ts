import { useQuery } from "@tanstack/react-query"
import type { ChecklistItem, ArticleType } from "@/types"

export function useChecklistItems() {
  return useQuery({
    queryKey: ["checklistItems"],
    queryFn: async (): Promise<ChecklistItem[]> => {
      await new Promise((r) => setTimeout(r, 300))
      const data = await import("@/mocks/checklist_items.json")
      return data.default as ChecklistItem[]
    },
  })
}

export function useChecklistItemsForType(articleType: ArticleType) {
  const { data: items, ...rest } = useChecklistItems()
  return {
    ...rest,
    data: items?.filter((item) => {
      if (!item.active) return false
      if (item.applicableTo === "all") return true
      return item.applicableTo.includes(articleType)
    }),
  }
}
