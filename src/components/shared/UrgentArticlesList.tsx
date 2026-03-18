import { Link } from "react-router-dom"
import { FileEdit, Bell, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useUrgentArticles } from "@/hooks/useUrgencyScore"
import { useSites, useClusters } from "@/hooks"

interface UrgentArticlesListProps {
  siteId?: string | null
  limit?: number
}

const typeLabels: Record<string, string> = {
  editorial: "Édito",
  hebergement: "Hôtel",
  restaurant: "Resto",
  activite: "Activité",
  bon_plan: "Bon plan",
}

const typeColors: Record<string, string> = {
  editorial: "bg-blue-100 text-blue-700",
  hebergement: "bg-purple-100 text-purple-700",
  restaurant: "bg-pink-100 text-pink-700",
  activite: "bg-green-100 text-green-700",
  bon_plan: "bg-amber-100 text-amber-700",
}

function ScoreBadge({ score }: { score: number }) {
  let variant = "bg-stone-100 text-stone-700"
  if (score >= 90) variant = "bg-red-100 text-red-700"
  else if (score >= 70) variant = "bg-orange-100 text-orange-700"
  else if (score >= 50) variant = "bg-amber-100 text-amber-700"

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${variant}`}>
      {score}
    </span>
  )
}

export function UrgentArticlesList({ siteId, limit = 10 }: UrgentArticlesListProps) {
  const { data: articles, isLoading } = useUrgentArticles(siteId, limit)
  const { data: sites } = useSites()
  const { data: clusters } = useClusters()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-stone-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!articles?.length) {
    return (
      <p className="text-stone-500 text-sm py-4 text-center">
        Aucun article urgent
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {articles.map((article, index) => {
        const site = sites?.find((s) => s.id === article.siteId)
        const cluster = clusters?.find((c) => c.id === article.clusterId)

        return (
          <Link
            key={article.id}
            to={`/article/${article.id}`}
            className="flex items-center gap-3 p-2 rounded hover:bg-stone-50 transition-colors group"
          >
            <span className="text-xs text-stone-400 w-5">{index + 1}.</span>

            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-800 truncate group-hover:text-orange-600">
                {article.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-stone-400">{site?.name}</span>
                <span className="text-xs text-stone-300">•</span>
                <span className="text-xs text-stone-400">{cluster?.name}</span>
              </div>
            </div>

            <Badge className={`text-xs ${typeColors[article.type]}`}>
              {typeLabels[article.type]}
            </Badge>

            <div className="flex items-center gap-1 text-stone-400">
              <Clock className="h-3 w-3" />
              <span className="text-xs">{article.ageFormatted}</span>
            </div>

            <div className="flex items-center gap-1">
              {article.hasDraft && (
                <FileEdit className="h-3.5 w-3.5 text-blue-500" title="Brouillon" />
              )}
              {article.hasSignals && (
                <Bell className="h-3.5 w-3.5 text-orange-500" title="Signal" />
              )}
            </div>

            <ScoreBadge score={article.calculatedScore} />
          </Link>
        )
      })}
    </div>
  )
}
