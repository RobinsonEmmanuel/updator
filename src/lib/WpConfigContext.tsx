import { createContext, useContext, type ReactNode } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch, apiUrl } from "@/lib/api"
import { useAuth } from "@/lib/AuthContext"

export interface SiteWeb {
  _id: string
  name: string
  url: string
  regionIds?: string[]
  regionsUpdatedAt?: string | null
}

export interface ConnectedSite extends SiteWeb {
  username: string
  hasPassword: boolean
}

interface WpConfigContextType {
  availableSites: SiteWeb[]
  connectedSites: ConnectedSite[]
  isLoading: boolean
  error: Error | null
  connectToSite: (siteId: string, username: string, appPassword: string) => Promise<void>
  disconnectFromSite: (siteId: string) => Promise<void>
  testConnection: (siteId: string, username: string, appPassword: string) => Promise<{ success: boolean; postsCount?: number; categoriesCount?: number; error?: string }>
  isConnected: (siteId: string) => boolean
  getConnectedSite: (siteId: string) => ConnectedSite | undefined
}

const WpConfigContext = createContext<WpConfigContextType | null>(null)

async function fetchAvailableSites(): Promise<SiteWeb[]> {
  const res = await fetch(apiUrl("/api/sites"))
  if (!res.ok) throw new Error("Failed to fetch sites")
  return res.json()
}

async function fetchConnectedSites(): Promise<ConnectedSite[]> {
  const res = await apiFetch("/api/user/sites")
  if (!res.ok) throw new Error("Failed to fetch connected sites")
  return res.json()
}

async function connectSite(siteId: string, username: string, appPassword: string): Promise<void> {
  const res = await apiFetch(`/api/user/sites/${siteId}/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, appPassword }),
  })
  if (!res.ok) throw new Error("Failed to connect to site")
}

async function disconnectSite(siteId: string): Promise<void> {
  const res = await apiFetch(`/api/user/sites/${siteId}/disconnect`, {
    method: "DELETE",
  })
  if (!res.ok) throw new Error("Failed to disconnect from site")
}

async function testSiteConnection(siteId: string, username: string, appPassword: string): Promise<{ success: boolean; postsCount?: number; categoriesCount?: number; error?: string }> {
  const res = await apiFetch(`/api/user/sites/${siteId}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, appPassword }),
  })
  return res.json()
}

export function WpConfigProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()

  const { data: availableSites = [], isLoading: loadingAvailable, error: errorAvailable } = useQuery({
    queryKey: ["available-sites"],
    queryFn: fetchAvailableSites,
    retry: 1,
  })

  const { data: connectedSites = [], isLoading: loadingConnected, error: errorConnected } = useQuery({
    queryKey: ["connected-sites"],
    queryFn: fetchConnectedSites,
    enabled: isAuthenticated,
    retry: 1,
  })

  const connectMutation = useMutation({
    mutationFn: ({ siteId, username, appPassword }: { siteId: string; username: string; appPassword: string }) =>
      connectSite(siteId, username, appPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connected-sites"] })
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: disconnectSite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connected-sites"] })
    },
  })

  const connectToSite = async (siteId: string, username: string, appPassword: string) => {
    await connectMutation.mutateAsync({ siteId, username, appPassword })
  }

  const disconnectFromSite = async (siteId: string) => {
    await disconnectMutation.mutateAsync(siteId)
  }

  const testConnection = async (siteId: string, username: string, appPassword: string) => {
    return testSiteConnection(siteId, username, appPassword)
  }

  const isConnected = (siteId: string) => {
    return connectedSites.some((site) => site._id === siteId)
  }

  const getConnectedSite = (siteId: string) => {
    return connectedSites.find((site) => site._id === siteId)
  }

  return (
    <WpConfigContext.Provider
      value={{
        availableSites,
        connectedSites,
        isLoading: loadingAvailable || loadingConnected,
        error: (errorAvailable || errorConnected) as Error | null,
        connectToSite,
        disconnectFromSite,
        testConnection,
        isConnected,
        getConnectedSite,
      }}
    >
      {children}
    </WpConfigContext.Provider>
  )
}

export function useWpConfig() {
  const context = useContext(WpConfigContext)
  if (!context) {
    throw new Error("useWpConfig must be used within WpConfigProvider")
  }
  return context
}
