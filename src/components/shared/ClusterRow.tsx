import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { ProgressBar } from "./ProgressBar"
import { useArticles } from "@/hooks"
import type { Cluster } from "@/types"

interface ClusterRowProps {
  cluster: Cluster
  showBoostBadge?: boolean
}

export function ClusterRow({ cluster, showBoostBadge }: ClusterRowProps) {
  const navigate = useNavigate()
  const { data: articles } = useArticles({ clusterId: cluster.id })

  const total = articles?.length ?? 0
  const done = articles?.filter((a) => a.status === "done").length ?? 0

  const handleClick = () => {
    navigate(`/queue?clusterId=${cluster.id}`)
  }

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-stone-100 transition-colors text-left"
    >
      <span className="text-sm text-stone-700 flex-1 truncate">
        {cluster.name}
        {cluster.isBestOf && (
          <span className="ml-1 text-orange-500 text-xs">★</span>
        )}
      </span>
      
      {showBoostBadge && (
        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
          boost
        </Badge>
      )}

      <ProgressBar
        value={done}
        max={total}
        className="w-20"
        variant={done === total && total > 0 ? "success" : "default"}
      />

      <span className="text-xs text-stone-400 w-8 text-right">
        {done}/{total}
      </span>
    </button>
  )
}
