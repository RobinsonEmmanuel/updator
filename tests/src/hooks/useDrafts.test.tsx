import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useDrafts, useDraftForArticle } from "@/hooks/useDrafts"
import { ReactNode } from "react"

vi.mock("@/lib/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { name: "Julie" as const, email: "julie@regionlovers.fr" },
    login: vi.fn(),
    logout: vi.fn(),
    authError: null,
    clearAuthError: vi.fn(),
  }),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useDrafts", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("fetches drafts successfully", async () => {
    const mockDrafts = [
      { _id: "1", articleId: "art-1", content: "Content 1", author: "Julie", status: "editing" },
      { _id: "2", articleId: "art-2", content: "Content 2", author: "Manu", status: "ready_to_push" },
    ]

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockDrafts,
    } as Response)

    const { result } = renderHook(() => useDrafts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockDrafts)
  })

  it("handles fetch error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
    } as Response)

    const { result } = renderHook(() => useDrafts(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
  })

  it("filters by siteId", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response)

    renderHook(() => useDrafts("site-123"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/drafts?siteId=site-123", expect.anything())
    })
  })
})

describe("useDraftForArticle", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("fetches draft for specific article", async () => {
    const mockDraft = {
      _id: "1",
      articleId: "art-specific",
      content: "Specific content",
      author: "Julie",
    }

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockDraft,
    } as Response)

    const { result } = renderHook(() => useDraftForArticle("art-specific"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockDraft)
    expect(global.fetch).toHaveBeenCalledWith("/api/drafts/article/art-specific", expect.anything())
  })

  it("returns null when draft not found", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response)

    const { result } = renderHook(() => useDraftForArticle("non-existent"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toBeNull()
  })

  it("does not fetch when articleId is undefined", () => {
    vi.spyOn(global, "fetch")

    const { result } = renderHook(() => useDraftForArticle(undefined), {
      wrapper: createWrapper(),
    })

    expect(result.current.isFetching).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
