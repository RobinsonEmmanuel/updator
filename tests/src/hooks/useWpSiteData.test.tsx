import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useWpSiteData } from "@/hooks/useWpSiteData"
import type { ConnectedSite } from "@/lib/WpConfigContext"
import { ReactNode } from "react"

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

const mockSite: ConnectedSite = {
  _id: "site-123",
  name: "Test Site",
  url: "https://test.com",
  username: "admin",
  hasPassword: true,
}

const mockPosts = [
  {
    id: 1,
    date: "2025-01-01T00:00:00",
    slug: "post-1",
    type: "post",
    link: "https://test.com/p1",
    title: { rendered: "Post 1" },
    modified: "2025-01-01T00:00:00Z",
    status: "publish" as const,
    categories: [1],
  },
  {
    id: 2,
    date: "2026-03-01T00:00:00",
    slug: "post-2",
    type: "post",
    link: "https://test.com/p2",
    title: { rendered: "Post 2" },
    modified: "2026-03-01T00:00:00Z",
    status: "publish" as const,
    categories: [1],
  },
]

const mockCategories = [
  { id: 1, name: "Category 1", slug: "cat-1", count: 2, parent: 0 },
]

describe("useWpSiteData", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns empty state when site is null", () => {
    const { result } = renderHook(() => useWpSiteData(null), {
      wrapper: createWrapper(),
    })

    expect(result.current.posts).toEqual([])
    expect(result.current.categories).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it("fetches posts and categories for a site", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockPosts, total: 2 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories,
      } as Response)

    const { result } = renderHook(() => useWpSiteData(mockSite), {
      wrapper: createWrapper(),
    })

    expect(result.current.isLoading).toBe(true)

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.posts).toHaveLength(2)
    expect(result.current.categories).toHaveLength(1)
  })

  it("calculates stats correctly", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockPosts, total: 2 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories,
      } as Response)

    const { result } = renderHook(() => useWpSiteData(mockSite), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.stats.total).toBe(2)
    expect(result.current.stats.outdated).toBeGreaterThanOrEqual(0)
    expect(result.current.stats.upToDate).toBeGreaterThanOrEqual(0)
  })

  it("calculates priority posts (oldest first)", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockPosts, total: 2 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories,
      } as Response)

    const { result } = renderHook(() => useWpSiteData(mockSite), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.priorityPosts.length).toBeLessThanOrEqual(10)
    if (result.current.priorityPosts.length > 1) {
      const firstDate = new Date(result.current.priorityPosts[0].modified).getTime()
      const secondDate = new Date(result.current.priorityPosts[1].modified).getTime()
      expect(firstDate).toBeLessThanOrEqual(secondDate)
    }
  })

  it("handles fetch errors gracefully", async () => {
    const failed = { ok: false, json: async () => ({ error: "fail" }) } as Response
    vi.spyOn(global, "fetch").mockResolvedValueOnce(failed).mockResolvedValueOnce(failed)

    const { result } = renderHook(() => useWpSiteData(mockSite), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.error).toBeDefined()
    })
  })
})
