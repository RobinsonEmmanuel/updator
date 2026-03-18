import { useQuery } from "@tanstack/react-query"
import type { Signal } from "@/types"

export function useSignals(siteId?: string) {
  return useQuery({
    queryKey: ["signals", siteId],
    queryFn: async (): Promise<Signal[]> => {
      await new Promise((r) => setTimeout(r, 300))
      const data = await import("@/mocks/signals.json")
      const signals = data.default as Signal[]
      if (siteId) {
        return signals.filter((s) => s.siteId === siteId)
      }
      return signals
    },
  })
}

export function useOpenSignals(siteId?: string) {
  const { data: signals, ...rest } = useSignals(siteId)
  return {
    ...rest,
    data: signals?.filter((s) => s.status === "open"),
  }
}
