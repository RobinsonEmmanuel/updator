import { ExternalLink } from "lucide-react"
import { ClusterRow } from "./ClusterRow"
import { useClusters } from "@/hooks"
import type { Site } from "@/types"

interface SiteCardProps {
  site: Site
}

export function SiteCard({ site }: SiteCardProps) {
  const { data: clusters } = useClusters(site.id)

  const isAtQuota = site.todayUpdateCount >= site.maxArticlesPerDay

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm shadow-stone-100">
      <div className="p-4 border-b border-stone-50">
        <div className="flex items-center justify-between">
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

          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            isAtQuota 
              ? "bg-red-50 text-red-600" 
              : "bg-stone-100 text-stone-600"
          }`}>
            {site.todayUpdateCount}/{site.maxArticlesPerDay} aujourd'hui
          </span>
        </div>
      </div>

      <div className="p-2">
        {clusters?.map((cluster) => (
          <ClusterRow key={cluster.id} cluster={cluster} siteId={site.id} />
        ))}
      </div>
    </div>
  )
}
