import { useState, useRef, useEffect } from "react"
import { Link } from "react-router-dom"
import { Bell, ChevronDown, Check } from "lucide-react"
import { useOpenSignals } from "@/hooks"
import { useSiteContext } from "@/lib/SiteContext"
import { cn } from "@/lib/utils"

export function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { sites, selectedSite, selectedSiteId, setSelectedSiteId, isLoading, isAllSitesSelected } = useSiteContext()
  const { data: openSignals } = useOpenSignals(selectedSiteId ?? undefined)

  const signalsCount = openSignals?.length ?? 0

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (sites.length === 0 && !isLoading) {
    return (
      <header className="h-14 bg-white/80 backdrop-blur-sm border-b border-stone-100 flex items-center px-6">
        <Link 
          to="/settings"
          className="text-sm text-orange-600 hover:text-orange-700"
        >
          Configurer un site WordPress
        </Link>
      </header>
    )
  }

  return (
    <header className="h-14 bg-white/80 backdrop-blur-sm border-b border-stone-100 flex items-center justify-between px-6">
      {/* Site Selector Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={() => setIsOpen(true)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
            "hover:bg-stone-50 border border-transparent",
            isOpen && "bg-stone-50 border-stone-200"
          )}
        >
          <span className={selectedSiteId ? "text-orange-600" : "text-stone-700"}>
            {selectedSite?.name ?? "Tous les sites"}
          </span>
          <ChevronDown className={cn(
            "h-4 w-4 text-stone-400 transition-transform",
            isOpen && "rotate-180"
          )} />
        </button>

        {isOpen && (
          <div 
            className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-lg shadow-stone-200/50 border border-stone-100 py-1 z-50"
            onMouseLeave={() => setIsOpen(false)}
          >
            {sites.length > 1 && (
              <>
                <button
                  onClick={() => { setSelectedSiteId(null); setIsOpen(false) }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors",
                    isAllSitesSelected 
                      ? "bg-orange-50 text-orange-700" 
                      : "text-stone-600 hover:bg-stone-50"
                  )}
                >
                  <span>Tous les sites</span>
                  {isAllSitesSelected && <Check className="h-4 w-4" />}
                </button>
                <div className="h-px bg-stone-100 my-1" />
              </>
            )}
            {sites.map((site) => (
              <button
                key={site._id}
                onClick={() => { setSelectedSiteId(site._id); setIsOpen(false) }}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors",
                  selectedSiteId === site._id 
                    ? "bg-orange-50 text-orange-700" 
                    : "text-stone-600 hover:bg-stone-50"
                )}
              >
                <span>{site.name}</span>
                {selectedSiteId === site._id && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Signals indicator */}
      {signalsCount > 0 && (
        <Link 
          to="/signaux"
          className="flex items-center gap-2 text-stone-600 bg-orange-50 px-3 py-1.5 rounded-full hover:bg-orange-100 transition-colors"
        >
          <Bell className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-medium text-orange-700">
            {signalsCount} {signalsCount > 1 ? "signaux" : "signal"}
          </span>
        </Link>
      )}
    </header>
  )
}
