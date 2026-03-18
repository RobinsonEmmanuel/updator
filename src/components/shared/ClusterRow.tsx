import { useNavigate } from "react-router-dom"
import { ProgressBar } from "./ProgressBar"
import { useArticles } from "@/hooks"
import type { Cluster } from "@/types"

interface ClusterRowProps {
  cluster: Cluster
}

export function ClusterRow({ cluster }: ClusterRowProps) {
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
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-stone-50 transition-colors text-left group"
    >
      <span className="text-sm text-stone-600 flex-1 truncate group-hover:text-stone-800">
        {cluster.name}
        {cluster.isBestOf && (
          <span className="ml-1.5 text-orange-400 text-xs">★</span>
        )}
      </span>

      <ProgressBar
        value={done}
        max={total}
        className="w-16"
        variant={done === total && total > 0 ? "success" : "default"}
      />

      <span className="text-xs text-stone-400 w-8 text-right tabular-nums">
        {done}/{total}
      </span>
    </button>
  )
}
