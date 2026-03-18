import { useNavigate } from "react-router-dom"
import { Bell } from "lucide-react"
import { useArticles, useOpenSignals } from "@/hooks"
import type { Cluster } from "@/types"

interface ClusterRowProps {
  cluster: Cluster
  siteId: string
}

function getUpToDatePercentage(articles: { lastModifiedAt: string }[]): number {
  if (articles.length === 0) return 100
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  
  const upToDate = articles.filter(a => new Date(a.lastModifiedAt) > oneYearAgo).length
  return Math.round((upToDate / articles.length) * 100)
}

function getPercentageColor(percentage: number): string {
  if (percentage >= 80) return "bg-teal-500"
  if (percentage >= 50) return "bg-orange-400"
  return "bg-red-400"
}

export function ClusterRow({ cluster, siteId }: ClusterRowProps) {
  const navigate = useNavigate()
  const { data: articles } = useArticles({ clusterId: cluster.id })
  const { data: signals } = useOpenSignals(siteId)

  const clusterSignals = signals?.filter(s => s.clusterIds.includes(cluster.id)) ?? []
  const percentage = getUpToDatePercentage(articles ?? [])

  const handleClick = () => {
    navigate(`/queue?clusterId=${cluster.id}`)
  }

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-stone-50 transition-colors text-left group"
    >
      {/* Indicateur % à jour */}
      <div className="flex items-center gap-2 w-14">
        <div className={`w-2 h-2 rounded-full ${getPercentageColor(percentage)}`} />
        <span className="text-xs text-stone-400 tabular-nums">{percentage}%</span>
      </div>

      {/* Nom cluster */}
      <span className="text-sm text-stone-600 flex-1 truncate group-hover:text-stone-800">
        {cluster.name}
        {cluster.isBestOf && (
          <span className="ml-1.5 text-orange-400 text-xs">★</span>
        )}
      </span>

      {/* Badge signaux si applicable */}
      {clusterSignals.length > 0 && (
        <div className="flex items-center gap-1 text-orange-500">
          <Bell className="h-3 w-3" />
          <span className="text-xs">{clusterSignals.length}</span>
        </div>
      )}

      {/* Nombre d'articles */}
      <span className="text-xs text-stone-400 tabular-nums">
        {articles?.length ?? 0} art.
      </span>
    </button>
  )
}
