import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useWpConfig, type ConnectedSite } from "./WpConfigContext"

const ALL_SITES_VALUE = "__ALL__"

interface SiteContextValue {
  sites: ConnectedSite[]
  selectedSite: ConnectedSite | null
  selectedSiteId: string | null
  setSelectedSiteId: (siteId: string | null) => void
  isLoading: boolean
  hasNoSites: boolean
  isAllSitesSelected: boolean
}

const SiteContext = createContext<SiteContextValue | undefined>(undefined)

const STORAGE_KEY = "selectedSiteId"

export function SiteProvider({ children }: { children: ReactNode }) {
  const { connectedSites, isLoading } = useWpConfig()
  
  const [selectedSiteId, setSelectedSiteIdInternal] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === ALL_SITES_VALUE) return null
      return stored
    }
    return null
  })

  const [isAllSitesSelected, setIsAllSitesSelected] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) === ALL_SITES_VALUE
    }
    return false
  })

  const setSelectedSiteId = (siteId: string | null) => {
    if (siteId === null) {
      setIsAllSitesSelected(true)
      setSelectedSiteIdInternal(null)
      localStorage.setItem(STORAGE_KEY, ALL_SITES_VALUE)
    } else {
      setIsAllSitesSelected(false)
      setSelectedSiteIdInternal(siteId)
      localStorage.setItem(STORAGE_KEY, siteId)
    }
  }

  useEffect(() => {
    if (!isLoading && connectedSites.length > 0 && !selectedSiteId && !isAllSitesSelected) {
      setSelectedSiteId(connectedSites[0]._id)
    }
    if (!isLoading && selectedSiteId && !connectedSites.find(s => s._id === selectedSiteId)) {
      if (connectedSites.length > 0) {
        setSelectedSiteId(connectedSites[0]._id)
      } else {
        setSelectedSiteId(null)
      }
    }
  }, [connectedSites, isLoading, selectedSiteId, isAllSitesSelected])

  const selectedSite = selectedSiteId ? connectedSites.find(s => s._id === selectedSiteId) || null : null

  return (
    <SiteContext.Provider 
      value={{ 
        sites: connectedSites,
        selectedSite,
        selectedSiteId, 
        setSelectedSiteId,
        isLoading,
        hasNoSites: !isLoading && connectedSites.length === 0,
        isAllSitesSelected
      }}
    >
      {children}
    </SiteContext.Provider>
  )
}

export function useSiteContext() {
  const context = useContext(SiteContext)
  if (context === undefined) {
    throw new Error("useSiteContext must be used within a SiteProvider")
  }
  return context
}
