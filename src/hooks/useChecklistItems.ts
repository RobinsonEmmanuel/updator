import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ChecklistItem } from "@/types"
import { apiFetch } from "@/lib/api"
import { useAuth } from "@/lib/AuthContext"

const API_URL = "/api/todo-config"

export interface TodoItemInput {
  title: string
  description?: string
  active?: boolean
  order?: number
  mainPrompt?: string
  additionalPrompts?: string[]
  technicalHints?: {
    examples?: string[]
    notes?: string
  }
  category?: string
}

export interface TodoItemUpdateInput extends Partial<TodoItemInput> {
  id: string
}

function normalizeChecklistItem(raw: Partial<ChecklistItem> & { _id?: string; id?: string }): ChecklistItem {
  const id = raw.id || raw._id || ""
  const title = raw.title || raw.label || ""
  return {
    id,
    title,
    label: title,
    description: raw.description || "",
    mainPrompt: raw.mainPrompt || "",
    additionalPrompts: Array.isArray(raw.additionalPrompts) ? raw.additionalPrompts : [],
    technicalHints: raw.technicalHints || {},
    order: typeof raw.order === "number" ? raw.order : 0,
    active: raw.active !== false,
    category: raw.category || "contenu",
  }
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const payload = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    const message = (payload as { error?: string }).error || "Request failed"
    throw new Error(message)
  }
  return payload
}

export function useChecklistItems() {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: ["checklistItems"],
    queryFn: async (): Promise<ChecklistItem[]> => {
      const res = await apiFetch(API_URL)
      const data = await parseJsonResponse<ChecklistItem[]>(res)
      return data.map((item) => normalizeChecklistItem(item))
    },
    staleTime: 60_000,
    enabled: isAuthenticated,
  })
}

export function useCreateTodoItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: TodoItemInput): Promise<ChecklistItem> => {
      const res = await apiFetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const data = await parseJsonResponse<ChecklistItem>(res)
      return normalizeChecklistItem(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklistItems"] })
    },
  })
}

export function useUpdateTodoItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: TodoItemUpdateInput): Promise<ChecklistItem> => {
      const res = await apiFetch(`${API_URL}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const data = await parseJsonResponse<ChecklistItem>(res)
      return normalizeChecklistItem(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklistItems"] })
    },
  })
}

export function useDeleteTodoItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await apiFetch(`${API_URL}/${id}`, { method: "DELETE" })
      await parseJsonResponse<{ success: boolean }>(res)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklistItems"] })
    },
  })
}

export function useReorderTodoItems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]): Promise<ChecklistItem[]> => {
      const res = await apiFetch(`${API_URL}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
      const payload = await parseJsonResponse<{ success: boolean; data: ChecklistItem[] }>(res)
      return payload.data.map((item) => normalizeChecklistItem(item))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklistItems"] })
    },
  })
}

export function useImportLegacyTodoItems() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (replace: boolean): Promise<{ seeded: number; total: number }> => {
      const res = await apiFetch(`${API_URL}/import-legacy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace }),
      })
      return parseJsonResponse<{ seeded: number; total: number }>(res)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklistItems"] })
    },
  })
}
