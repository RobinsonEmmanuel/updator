import { beforeEach, describe, expect, it, vi } from "vitest"

const { ingestionFetchMock, ingestionApiUrlMock } = vi.hoisted(() => ({
  ingestionFetchMock: vi.fn(),
  ingestionApiUrlMock: vi.fn((path: string) => `https://ingestion-service.up.railway.app${path}`),
}))

vi.mock("@/lib/api", () => ({
  ingestionFetch: ingestionFetchMock,
  ingestionApiUrl: ingestionApiUrlMock,
}))

import { fetchWpSiteBundle } from "@/lib/wpSiteBundle"

describe("fetchWpSiteBundle", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    ingestionFetchMock.mockReset()
    ingestionApiUrlMock.mockClear()
  })

  it("calls ingestion endpoints for posts and categories", async () => {
    ingestionFetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 1 }], total: 1 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 10, name: "cat" }],
      } as Response)

    const result = await fetchWpSiteBundle("site-123")

    expect(ingestionApiUrlMock).toHaveBeenCalledWith("/api/v1/user/sites/site-123/posts")
    expect(ingestionApiUrlMock).toHaveBeenCalledWith("/api/v1/user/sites/site-123/categories")
    expect(ingestionFetchMock).toHaveBeenCalledTimes(2)
    expect(ingestionFetchMock).toHaveBeenNthCalledWith(
      1,
      "https://ingestion-service.up.railway.app/api/v1/user/sites/site-123/posts"
    )
    expect(ingestionFetchMock).toHaveBeenNthCalledWith(
      2,
      "https://ingestion-service.up.railway.app/api/v1/user/sites/site-123/categories"
    )
    expect(result).toEqual({
      posts: [{ id: 1 }],
      total: 1,
      categories: [{ id: 10, name: "cat" }],
    })
  })

  it("adds refresh query when refresh is true", async () => {
    ingestionFetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], total: 0 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)

    await fetchWpSiteBundle("site-123", true)

    expect(ingestionApiUrlMock).toHaveBeenCalledWith("/api/v1/user/sites/site-123/posts?refresh=1")
    expect(ingestionApiUrlMock).toHaveBeenCalledWith("/api/v1/user/sites/site-123/categories?refresh=1")
  })

  it("throws posts endpoint error message", async () => {
    ingestionFetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: "Not connected to this site." }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)

    await expect(fetchWpSiteBundle("site-123")).rejects.toThrow("Not connected to this site.")
  })

  it("throws categories endpoint error message", async () => {
    ingestionFetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [], total: 0 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ error: "WordPress auth failed for this site connection" }),
      } as Response)

    await expect(fetchWpSiteBundle("site-123")).rejects.toThrow("WordPress auth failed for this site connection")
  })
})
