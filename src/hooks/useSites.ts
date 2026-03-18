import { useQuery } from "@tanstack/react-query"
import type { Site } from "@/types"

export function useSites() {
  return useQuery({
    queryKey: ["sites"],
    queryFn: async (): Promise<Site[]> => {
      await new Promise((r) => setTimeout(r, 300))
      const data = await import("@/mocks/sites.json")
      return data.default as Site[]
    },
  })
}

export function useSite(siteId: string | undefined) {
  const { data: sites, ...rest } = useSites()
  return {
    ...rest,
    data: sites?.find((s) => s.id === siteId),
  }
}
