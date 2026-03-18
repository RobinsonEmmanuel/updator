import { useState } from "react"
import { AlertTriangle, TrendingUp, Info, HelpCircle, X, ChevronDown, ChevronUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useOpenSignals, useArticles, useClusters } from "@/hooks"
import type { Signal } from "@/types"

interface SignalPanelProps {
  siteId?: string | null
}

const typeConfig: Record<string, { icon: typeof AlertTriangle; label: string; color: string }> = {
  closure: { icon: AlertTriangle, label: "Fermeture", color: "bg-red-100 text-red-700" },
  price_change: { icon: TrendingUp, label: "Prix", color: "bg-orange-100 text-orange-700" },
  new_info: { icon: Info, label: "Info", color: "bg-blue-100 text-blue-700" },
  suspicious: { icon: HelpCircle, label: "À vérifier", color: "bg-amber-100 text-amber-700" },
}

function daysSince(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return "aujourd'hui"
  if (days === 1) return "hier"
  return `il y a ${days}j`
}

function SignalCard({ signal, onDismiss }: { signal: Signal; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const { data: articles } = useArticles({ siteId: signal.siteId })
  const { data: clusters } = useClusters(signal.siteId)

  const config = typeConfig[signal.type]
  const Icon = config.icon

  const matchingArticles = articles?.filter((article) => {
    const searchTerm = signal.entityName.toLowerCase()
    return (
      article.title.toLowerCase().includes(searchTerm) ||
      signal.clusterIds.includes(article.clusterId)
    )
  })

  const signalClusters = clusters?.filter((c) => signal.clusterIds.includes(c.id))

  return (
    <div className="border border-stone-200 rounded-lg p-3 bg-stone-50">
      <div className="flex items-start gap-2">
        <div className={`p-1.5 rounded ${config.color}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-stone-800 truncate">
              {signal.entityName}
            </span>
            <Badge className={`text-xs ${config.color}`}>{config.label}</Badge>
          </div>

          <p className="text-xs text-stone-600 line-clamp-2">{signal.note}</p>

          <div className="flex items-center gap-2 mt-2 text-xs text-stone-400">
            <span>Par {signal.detectedBy}</span>
            <span>•</span>
            <span>{daysSince(signal.detectedAt)}</span>
          </div>

          {signalClusters && signalClusters.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {signalClusters.map((cluster) => (
                <Badge key={cluster.id} variant="secondary" className="text-xs">
                  {cluster.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDismiss}
          className="text-stone-400 hover:text-stone-600"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {matchingArticles && matchingArticles.length > 0 && (
        <div className="mt-3 pt-3 border-t border-stone-200">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {matchingArticles.length} article{matchingArticles.length > 1 ? "s" : ""} concerné{matchingArticles.length > 1 ? "s" : ""}
          </button>

          {expanded && (
            <ul className="mt-2 space-y-1">
              {matchingArticles.slice(0, 5).map((article) => (
                <li key={article.id} className="text-xs text-stone-600 truncate pl-4">
                  • {article.title}
                </li>
              ))}
              {matchingArticles.length > 5 && (
                <li className="text-xs text-stone-400 pl-4">
                  + {matchingArticles.length - 5} autres
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function SignalPanel({ siteId }: SignalPanelProps) {
  const { data: signals, isLoading } = useOpenSignals(siteId ?? undefined)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visibleSignals = signals?.filter((s) => !dismissed.has(s.id))

  const handleDismiss = (signalId: string) => {
    setDismissed((prev) => new Set([...prev, signalId]))
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-stone-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!visibleSignals?.length) {
    return (
      <p className="text-stone-500 text-sm py-4 text-center">
        Aucun signal ouvert
      </p>
    )
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {visibleSignals.map((signal) => (
        <SignalCard
          key={signal.id}
          signal={signal}
          onDismiss={() => handleDismiss(signal.id)}
        />
      ))}
    </div>
  )
}
