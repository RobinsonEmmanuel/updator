import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useSignals, useOpenSignals } from "@/hooks/useSignals"
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

describe("useSignals", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("fetches signals successfully", async () => {
    const mockSignals = [
      { _id: "1", entityName: "Signal 1", type: "closure", status: "open" },
      { _id: "2", entityName: "Signal 2", type: "price_change", status: "open" },
    ]

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockSignals,
    } as Response)

    const { result } = renderHook(() => useSignals(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockSignals)
  })

  it("handles fetch error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: false,
    } as Response)

    const { result } = renderHook(() => useSignals(), {
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

    renderHook(() => useSignals("site-123"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/signals?siteId=site-123", expect.anything())
    })
  })
})

describe("useOpenSignals", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("fetches only open signals", async () => {
    const mockOpenSignals = [
      { _id: "1", entityName: "Open Signal", type: "closure", status: "open" },
    ]

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockOpenSignals,
    } as Response)

    const { result } = renderHook(() => useOpenSignals(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockOpenSignals)
    expect(global.fetch).toHaveBeenCalledWith("/api/signals/open", expect.anything())
  })
})
