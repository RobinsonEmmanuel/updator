import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface SiteContextValue {
  selectedSiteId: string | null
  setSelectedSiteId: (siteId: string | null) => void
}

const SiteContext = createContext<SiteContextValue | undefined>(undefined)

const STORAGE_KEY = "selectedSiteId"

export function SiteProvider({ children }: { children: ReactNode }) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY)
    }
    return null
  })

  useEffect(() => {
    if (selectedSiteId) {
      localStorage.setItem(STORAGE_KEY, selectedSiteId)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [selectedSiteId])

  return (
    <SiteContext.Provider value={{ selectedSiteId, setSelectedSiteId }}>
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
