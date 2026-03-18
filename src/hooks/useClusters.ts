import { useQuery } from "@tanstack/react-query"
import type { Cluster } from "@/types"

export function useClusters(siteId?: string) {
  return useQuery({
    queryKey: ["clusters", siteId],
    queryFn: async (): Promise<Cluster[]> => {
      await new Promise((r) => setTimeout(r, 300))
      const data = await import("@/mocks/clusters.json")
      const clusters = data.default as Cluster[]
      if (siteId) {
        return clusters.filter((c) => c.siteId === siteId)
      }
      return clusters
    },
  })
}

export function useCluster(clusterId: string | undefined) {
  const { data: clusters, ...rest } = useClusters()
  return {
    ...rest,
    data: clusters?.find((c) => c.id === clusterId),
  }
}
