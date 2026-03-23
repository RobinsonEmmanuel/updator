import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BrowserRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Header } from "@/components/shared/Header"
import * as SiteContextModule from "@/lib/SiteContext"

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
})

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe("Header", () => {
  it("shows 'Configurer un site WordPress' when no sites exist", () => {
    vi.spyOn(SiteContextModule, "useSiteContext").mockReturnValue({
      sites: [],
      selectedSite: null,
      selectedSiteId: null,
      setSelectedSiteId: vi.fn(),
      isLoading: false,
      hasNoSites: true,
      isAllSitesSelected: false,
    })

    renderWithProviders(<Header />)
    expect(screen.getByText("Configurer un site WordPress")).toBeInTheDocument()
  })

  it("shows 'Tous les sites' when isAllSitesSelected is true", () => {
    vi.spyOn(SiteContextModule, "useSiteContext").mockReturnValue({
      sites: [
        { _id: "1", name: "Site 1", url: "https://site1.com", username: "user", appPassword: "pass" },
        { _id: "2", name: "Site 2", url: "https://site2.com", username: "user", appPassword: "pass" },
      ],
      selectedSite: null,
      selectedSiteId: null,
      setSelectedSiteId: vi.fn(),
      isLoading: false,
      hasNoSites: false,
      isAllSitesSelected: true,
    })

    renderWithProviders(<Header />)
    expect(screen.getByText("Tous les sites")).toBeInTheDocument()
  })

  it("shows selected site name when a site is selected", () => {
    const selectedSite = { _id: "1", name: "My Site", url: "https://mysite.com", username: "user", appPassword: "pass" }
    
    vi.spyOn(SiteContextModule, "useSiteContext").mockReturnValue({
      sites: [selectedSite],
      selectedSite,
      selectedSiteId: "1",
      setSelectedSiteId: vi.fn(),
      isLoading: false,
      hasNoSites: false,
      isAllSitesSelected: false,
    })

    renderWithProviders(<Header />)
    expect(screen.getByText("My Site")).toBeInTheDocument()
  })

  it("opens dropdown on click", () => {
    const sites = [
      { _id: "1", name: "Site 1", url: "https://site1.com", username: "user", appPassword: "pass" },
      { _id: "2", name: "Site 2", url: "https://site2.com", username: "user", appPassword: "pass" },
    ]
    
    vi.spyOn(SiteContextModule, "useSiteContext").mockReturnValue({
      sites,
      selectedSite: sites[0],
      selectedSiteId: "1",
      setSelectedSiteId: vi.fn(),
      isLoading: false,
      hasNoSites: false,
      isAllSitesSelected: false,
    })

    renderWithProviders(<Header />)
    
    const button = screen.getByText("Site 1")
    fireEvent.click(button)
    
    expect(screen.getByText("Tous les sites")).toBeInTheDocument()
    expect(screen.getByText("Site 2")).toBeInTheDocument()
  })

  it("calls setSelectedSiteId when clicking 'Tous les sites'", () => {
    const setSelectedSiteId = vi.fn()
    const sites = [
      { _id: "1", name: "Site 1", url: "https://site1.com", username: "user", appPassword: "pass" },
      { _id: "2", name: "Site 2", url: "https://site2.com", username: "user", appPassword: "pass" },
    ]
    
    vi.spyOn(SiteContextModule, "useSiteContext").mockReturnValue({
      sites,
      selectedSite: sites[0],
      selectedSiteId: "1",
      setSelectedSiteId,
      isLoading: false,
      hasNoSites: false,
      isAllSitesSelected: false,
    })

    renderWithProviders(<Header />)
    
    fireEvent.click(screen.getByText("Site 1"))
    fireEvent.click(screen.getByText("Tous les sites"))
    
    expect(setSelectedSiteId).toHaveBeenCalledWith(null)
  })

  it("calls setSelectedSiteId when selecting a site", () => {
    const setSelectedSiteId = vi.fn()
    const sites = [
      { _id: "1", name: "Site 1", url: "https://site1.com", username: "user", appPassword: "pass" },
      { _id: "2", name: "Site 2", url: "https://site2.com", username: "user", appPassword: "pass" },
    ]
    
    vi.spyOn(SiteContextModule, "useSiteContext").mockReturnValue({
      sites,
      selectedSite: sites[0],
      selectedSiteId: "1",
      setSelectedSiteId,
      isLoading: false,
      hasNoSites: false,
      isAllSitesSelected: false,
    })

    renderWithProviders(<Header />)
    
    fireEvent.click(screen.getByText("Site 1"))
    fireEvent.click(screen.getByText("Site 2"))
    
    expect(setSelectedSiteId).toHaveBeenCalledWith("2")
  })
})
