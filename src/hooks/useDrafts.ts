import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Draft } from "@/types"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/lib/AuthContext"

const API_URL = "/api/drafts"

async function fetchDrafts(siteId?: string): Promise<Draft[]> {
  const url = siteId ? `${API_URL}?siteId=${siteId}` : API_URL
  const res = await apiFetch(url)
  if (!res.ok) throw new Error("Failed to fetch drafts")
  return res.json()
}

async function fetchDraftForArticle(articleId: string): Promise<Draft | null> {
  const res = await apiFetch(`${API_URL}/article/${articleId}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error("Failed to fetch draft")
  return res.json()
}

export function useDrafts(siteId?: string) {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: ["drafts", siteId],
    queryFn: () => fetchDrafts(siteId),
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
  })
}

export function useDraftForArticle(articleId: string | undefined) {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: ["drafts", "article", articleId],
    queryFn: () => fetchDraftForArticle(articleId!),
    enabled: isAuthenticated && !!articleId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (draft: { articleId: string; content: string; author: string; siteId?: string; clusterId?: string }) => {
      const res = await apiFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      if (!res.ok) throw new Error("Failed to create draft")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] })
    },
  })
}

export function useUpdateDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; content?: string; checksSnapshot?: Record<string, boolean | null> }) => {
      const res = await apiFetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error("Failed to update draft")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] })
    },
  })
}

export function useMarkDraftReady() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (draftId: string) => {
      const res = await apiFetch(`${API_URL}/${draftId}/ready`, { method: "PUT" })
      if (!res.ok) throw new Error("Failed to mark draft as ready")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] })
    },
  })
}

export function usePushDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (draftId: string) => {
      const res = await apiFetch(`${API_URL}/${draftId}/push`, { method: "PUT" })
      if (!res.ok) throw new Error("Failed to push draft")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] })
    },
  })
}

export function useDeleteDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (draftId: string) => {
      const res = await apiFetch(`${API_URL}/${draftId}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete draft")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drafts"] })
    },
  })
}
