import { Link } from "react-router-dom"
import { useArticles, useClusters } from "@/hooks"

interface UrgentArticlesListProps {
  siteId?: string | null
  limit?: number
}

function formatAge(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (days < 30) return `${days}j`
  if (days < 365) {
    const months = Math.floor(days / 30)
    return `${months} mois`
  }
  const years = Math.floor(days / 365)
  return `${years} an${years > 1 ? "s" : ""}`
}

export function UrgentArticlesList({ siteId, limit = 10 }: UrgentArticlesListProps) {
  const { data: articles, isLoading } = useArticles(
    siteId ? { siteId, status: "to_update" } : { status: "to_update" }
  )
  const { data: clusters } = useClusters()

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-stone-50 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  const sortedArticles = articles
    ?.slice()
    .sort((a, b) => new Date(a.lastModifiedAt).getTime() - new Date(b.lastModifiedAt).getTime())
    .slice(0, limit)

  if (!sortedArticles?.length) {
    return (
      <p className="text-stone-400 text-sm py-4 text-center">
        Aucun article à traiter
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {sortedArticles.map((article) => {
        const cluster = clusters?.find((c) => c.id === article.clusterId)

        return (
          <Link
            key={article.id}
            to={`/article/${article.id}`}
            className="block p-2.5 rounded-lg hover:bg-stone-50 transition-colors group"
          >
            <p className="text-sm text-stone-700 truncate group-hover:text-orange-600 transition-colors">
              {article.title}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-stone-400">{cluster?.name}</span>
              <span className="text-xs text-stone-300">•</span>
              <span className="text-xs text-stone-400">
                modifié il y a {formatAge(article.lastModifiedAt)}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
