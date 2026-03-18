import { ExternalLink, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ProgressBar } from "./ProgressBar"
import { ClusterRow } from "./ClusterRow"
import { useClusters, useArticles } from "@/hooks"
import type { Site } from "@/types"

interface SiteCardProps {
  site: Site
}

function daysSince(dateString: string): number {
  const date = new Date(dateString)
  const now = new Date()
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
}

export function SiteCard({ site }: SiteCardProps) {
  const { data: clusters } = useClusters(site.id)
  const { data: articles } = useArticles({ siteId: site.id })

  const isAtQuota = site.todayUpdateCount >= site.maxArticlesPerDay
  const remaining = site.maxArticlesPerDay - site.todayUpdateCount

  const clustersWithBoost = clusters?.filter((cluster) => {
    const clusterArticles = articles?.filter((a) => a.clusterId === cluster.id) ?? []
    if (clusterArticles.length === 0) return false
    const oldCount = clusterArticles.filter(
      (a) => daysSince(a.lastModifiedAt) > 365
    ).length
    return oldCount / clusterArticles.length > 0.5
  })

  const boostClusterIds = new Set(clustersWithBoost?.map((c) => c.id) ?? [])

  return (
    <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
      <div className="p-4 border-b border-stone-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-stone-800">{site.name}</h3>
            <a
              href={`https://${site.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-400 hover:text-stone-600"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {isAtQuota ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Quota atteint
            </Badge>
          ) : (
            <Badge variant="secondary">
              {remaining} restant{remaining > 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ProgressBar
            value={site.todayUpdateCount}
            max={site.maxArticlesPerDay}
            className="flex-1"
            variant={isAtQuota ? "danger" : "default"}
          />
          <span className="text-xs text-stone-500">
            {site.todayUpdateCount}/{site.maxArticlesPerDay}
          </span>
        </div>
      </div>

      <div className="p-2">
        {clusters?.map((cluster) => (
          <ClusterRow
            key={cluster.id}
            cluster={cluster}
            showBoostBadge={boostClusterIds.has(cluster.id)}
          />
        ))}
      </div>
    </div>
  )
}
