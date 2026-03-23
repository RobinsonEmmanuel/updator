import { Globe, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ConnectedSite } from "@/lib/WpConfigContext"

interface SiteCardsGridProps {
  sites: ConnectedSite[]
  onSelectSite?: (siteId: string) => void
  selectedSiteId?: string | null
  className?: string
}

function normalizeUrl(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

export function SiteCardsGrid({
  sites,
  onSelectSite,
  selectedSiteId = null,
  className,
}: SiteCardsGridProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3", className)}>
      {sites.map((site) => {
        const isSelected = selectedSiteId === site._id
        return (
          <button
            key={site._id}
            type="button"
            onClick={() => onSelectSite?.(site._id)}
            className={cn(
              "text-left rounded-xl border bg-white/70 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
              isSelected ? "border-orange-300 shadow-orange-100/60" : "border-stone-200 hover:border-stone-300"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-stone-800 truncate">{site.name}</p>
                <p className="text-xs text-stone-500 truncate">{normalizeUrl(site.url)}</p>
              </div>
              <Globe className="h-4 w-4 text-stone-300 shrink-0" />
            </div>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-stone-100 text-stone-600 text-xs">
                <Layers className="h-3 w-3" />
                {(site.regionIds || []).length} region{(site.regionIds || []).length > 1 ? "s" : ""}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
