import { Bell, ExternalLink, X, AlertTriangle, TrendingDown, Info, XCircle } from "lucide-react"
import { useOpenSignals, useClusters } from "@/hooks"
import { useSiteContext } from "@/lib/SiteContext"
import type { Signal, SignalType } from "@/types"

const signalTypeConfig: Record<SignalType, { icon: typeof Bell; label: string; color: string }> = {
  closure: { icon: XCircle, label: "Fermeture", color: "text-red-600 bg-red-50" },
  price_change: { icon: TrendingDown, label: "Changement de prix", color: "text-orange-600 bg-orange-50" },
  new_info: { icon: Info, label: "Nouvelle info", color: "text-blue-600 bg-blue-50" },
  suspicious: { icon: AlertTriangle, label: "Suspicion", color: "text-amber-600 bg-amber-50" },
}

interface SignalCardProps {
  signal: Signal
  clusters: { id: string; name: string }[]
  onDismiss: (id: string) => void
}

function SignalCard({ signal, clusters, onDismiss }: SignalCardProps) {
  const config = signalTypeConfig[signal.type]
  const Icon = config.icon
  const affectedClusters = clusters.filter(c => signal.clusterIds.includes(c.id))

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 shadow-sm shadow-stone-100 group">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`p-2 rounded-lg ${config.color}`}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-medium text-stone-800 mb-1">{signal.title}</h3>
              <p className="text-sm text-stone-500 mb-3">{signal.description}</p>
            </div>

            <button
              onClick={() => onDismiss(signal.id)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-stone-100 rounded transition-all"
              title="Ignorer ce signal"
            >
              <X className="h-4 w-4 text-stone-400" />
            </button>
          </div>

          {/* Clusters concernés */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {affectedClusters.map(cluster => (
              <span
                key={cluster.id}
                className="text-xs px-2 py-1 bg-stone-100 text-stone-600 rounded-md"
              >
                {cluster.name}
              </span>
            ))}
          </div>

          {/* Source link */}
          {signal.sourceUrl && (
            <a
              href={signal.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Voir la source
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export function Signals() {
  const { selectedSiteId } = useSiteContext()
  const { data: signals, isLoading } = useOpenSignals(selectedSiteId ?? undefined)
  const { data: clusters } = useClusters(selectedSiteId ?? undefined)

  const handleDismiss = (signalId: string) => {
    console.log("Dismiss signal:", signalId)
  }

  const groupedByType = signals?.reduce((acc, signal) => {
    if (!acc[signal.type]) acc[signal.type] = []
    acc[signal.type].push(signal)
    return acc
  }, {} as Record<SignalType, Signal[]>)

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Bell className="h-5 w-5 text-orange-600" />
          </div>
          <h1 className="text-xl font-semibold text-stone-800">Signaux</h1>
        </div>
        <p className="text-sm text-stone-500">
          Événements nécessitant une vérification lors de la prochaine mise à jour
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-stone-400">
          Chargement...
        </div>
      ) : !signals || signals.length === 0 ? (
        <div className="bg-white/40 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="h-5 w-5 text-teal-500" />
          </div>
          <h3 className="font-medium text-stone-700 mb-1">Aucun signal en cours</h3>
          <p className="text-sm text-stone-500">Tout est à jour</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByType ?? {}).map(([type, typeSignals]) => {
            const config = signalTypeConfig[type as SignalType]
            if (!config) return null
            const bgColor = config.color.split(' ')[0].replace('text-', 'bg-')
            return (
              <section key={type}>
                <h2 className="text-sm font-medium text-stone-500 mb-3 flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${bgColor}`} />
                  {config.label}
                  <span className="text-stone-400">({typeSignals.length})</span>
                </h2>
                <div className="space-y-3">
                  {typeSignals.map(signal => (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
                      clusters={clusters ?? []}
                      onDismiss={handleDismiss}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
