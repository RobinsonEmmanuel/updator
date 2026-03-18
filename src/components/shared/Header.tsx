import { useState, useRef, useEffect } from "react"
import { Link } from "react-router-dom"
import { Bell, ChevronDown, Check } from "lucide-react"
import { useSites, useOpenSignals } from "@/hooks"
import { useSiteContext } from "@/lib/SiteContext"
import { cn } from "@/lib/utils"

export function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { selectedSiteId, setSelectedSiteId } = useSiteContext()
  const { data: sites, isLoading: sitesLoading } = useSites()
  const { data: openSignals } = useOpenSignals(selectedSiteId ?? undefined)

  const signalsCount = openSignals?.length ?? 0
  const selectedSite = sites?.find(s => s.id === selectedSiteId)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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
            <button
              onClick={() => { setSelectedSiteId(null); setIsOpen(false) }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors",
                selectedSiteId === null 
                  ? "bg-orange-50 text-orange-700" 
                  : "text-stone-600 hover:bg-stone-50"
              )}
            >
              <span>Tous les sites</span>
              {selectedSiteId === null && <Check className="h-4 w-4" />}
            </button>
            
            <div className="h-px bg-stone-100 my-1" />
            
            {!sitesLoading && sites?.map((site) => (
              <button
                key={site.id}
                onClick={() => { setSelectedSiteId(site.id); setIsOpen(false) }}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors",
                  selectedSiteId === site.id 
                    ? "bg-orange-50 text-orange-700" 
                    : "text-stone-600 hover:bg-stone-50"
                )}
              >
                <span>{site.name}</span>
                <div className="flex items-center gap-2">
                  {site.todayUpdateCount >= site.maxArticlesPerDay && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600">quota</span>
                  )}
                  {selectedSiteId === site.id && <Check className="h-4 w-4" />}
                </div>
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
