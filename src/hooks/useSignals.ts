import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Signal } from "@/types"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/lib/AuthContext"

const API_URL = "/api/signals"

async function fetchSignals(siteId?: string): Promise<Signal[]> {
  const url = siteId ? `${API_URL}?siteId=${siteId}` : API_URL
  const res = await apiFetch(url)
  if (!res.ok) throw new Error("Failed to fetch signals")
  return res.json()
}

async function fetchOpenSignals(siteId?: string): Promise<Signal[]> {
  const url = siteId ? `${API_URL}/open?siteId=${siteId}` : `${API_URL}/open`
  const res = await apiFetch(url)
  if (!res.ok) throw new Error("Failed to fetch open signals")
  return res.json()
}

export function useSignals(siteId?: string) {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: ["signals", siteId],
    queryFn: () => fetchSignals(siteId),
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
  })
}

export function useOpenSignals(siteId?: string) {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: ["signals", "open", siteId],
    queryFn: () => fetchOpenSignals(siteId),
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
  })
}

export function useResolveSignal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (signalId: string) => {
      const res = await apiFetch(`${API_URL}/${signalId}/resolve`, { method: "PUT" })
      if (!res.ok) throw new Error("Failed to resolve signal")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] })
    },
  })
}

export function useDismissSignal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (signalId: string) => {
      const res = await apiFetch(`${API_URL}/${signalId}/dismiss`, { method: "PUT" })
      if (!res.ok) throw new Error("Failed to dismiss signal")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] })
    },
  })
}

export function useCreateSignal() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (signal: Omit<Signal, "id" | "_id" | "status" | "detectedAt">) => {
      const res = await apiFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(signal),
      })
      if (!res.ok) throw new Error("Failed to create signal")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals"] })
    },
  })
}
