import { Bell } from "lucide-react"
import { useSites, useOpenSignals } from "@/hooks"
import { useSiteContext } from "@/lib/SiteContext"
import { cn } from "@/lib/utils"

export function Header() {
  const { selectedSiteId, setSelectedSiteId } = useSiteContext()
  const { data: sites, isLoading: sitesLoading } = useSites()
  const { data: openSignals } = useOpenSignals(selectedSiteId ?? undefined)

  const signalsCount = openSignals?.length ?? 0

  return (
    <header className="h-14 bg-white/80 backdrop-blur-sm border-b border-stone-100 flex items-center justify-between px-6">
      {/* Site Pills */}
      <div className="flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setSelectedSiteId(null)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
            selectedSiteId === null
              ? "bg-stone-800 text-white"
              : "text-stone-500 hover:bg-stone-100"
          )}
        >
          Tous
        </button>
        {!sitesLoading &&
          sites?.map((site) => (
            <button
              key={site.id}
              onClick={() => setSelectedSiteId(site.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                selectedSiteId === site.id
                  ? "bg-orange-600 text-white"
                  : "text-stone-500 hover:bg-stone-100"
              )}
            >
              {site.name}
            </button>
          ))}
      </div>

      {/* Signals indicator */}
      {signalsCount > 0 && (
        <div className="flex items-center gap-2 text-stone-600 bg-orange-50 px-3 py-1.5 rounded-full">
          <Bell className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-medium text-orange-700">
            {signalsCount} {signalsCount > 1 ? "signaux" : "signal"}
          </span>
        </div>
      )}
    </header>
  )
}
