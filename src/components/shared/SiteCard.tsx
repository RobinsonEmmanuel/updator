import { ExternalLink } from "lucide-react"
import { ProgressBar } from "./ProgressBar"
import { ClusterRow } from "./ClusterRow"
import { useClusters } from "@/hooks"
import type { Site } from "@/types"

interface SiteCardProps {
  site: Site
}

export function SiteCard({ site }: SiteCardProps) {
  const { data: clusters } = useClusters(site.id)

  const isAtQuota = site.todayUpdateCount >= site.maxArticlesPerDay
  const remaining = site.maxArticlesPerDay - site.todayUpdateCount

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm shadow-stone-100">
      <div className="p-4 border-b border-stone-50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-stone-800">{site.name}</h3>
            <a
              href={`https://${site.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-300 hover:text-stone-500 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isAtQuota 
              ? "bg-red-50 text-red-600" 
              : "bg-stone-100 text-stone-600"
          }`}>
            {isAtQuota ? "Quota atteint" : `${remaining} restant${remaining > 1 ? "s" : ""}`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ProgressBar
            value={site.todayUpdateCount}
            max={site.maxArticlesPerDay}
            className="flex-1"
            variant={isAtQuota ? "danger" : "default"}
          />
          <span className="text-xs text-stone-400 tabular-nums">
            {site.todayUpdateCount}/{site.maxArticlesPerDay}
          </span>
        </div>
      </div>

      <div className="p-2">
        {clusters?.map((cluster) => (
          <ClusterRow key={cluster.id} cluster={cluster} />
        ))}
      </div>
    </div>
  )
}
