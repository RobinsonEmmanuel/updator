import { Link } from "react-router-dom"
import { Bell, X, AlertTriangle, TrendingDown, Info, XCircle, HelpCircle, Settings } from "lucide-react"
import { useOpenSignals } from "@/hooks"
import { useSiteContext } from "@/lib/SiteContext"
import { cn } from "@/lib/utils"
import type { Signal, SignalType } from "@/types"

const signalTypeConfig: Record<SignalType, { icon: typeof Bell; label: string; color: string }> = {
  closure: { icon: XCircle, label: "Fermeture", color: "text-red-600 bg-red-50" },
  price_change: { icon: TrendingDown, label: "Changement de prix", color: "text-orange-600 bg-orange-50" },
  new_info: { icon: Info, label: "Nouvelle info", color: "text-blue-600 bg-blue-50" },
  suspicious: { icon: AlertTriangle, label: "Suspicion", color: "text-amber-600 bg-amber-50" },
}

const defaultConfig = { icon: HelpCircle, label: "Autre", color: "text-stone-600 bg-stone-50" }

interface SignalCardProps {
  signal: Signal
  onDismiss: (id: string) => void
}

function SignalCard({ signal, onDismiss }: SignalCardProps) {
  const config = signalTypeConfig[signal.type] ?? defaultConfig
  const Icon = config.icon

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
              <h3 className="font-medium text-stone-800 mb-1">{signal.entityName}</h3>
              <p className="text-sm text-stone-500 mb-3">{signal.note}</p>
            </div>

            <button
              onClick={() => {
                const id = signal.id ?? (signal._id != null ? String(signal._id) : undefined)
                if (id) onDismiss(id)
              }}
              className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-stone-100 rounded-lg transition-all"
              title="Ignorer ce signal"
            >
              <X className="h-4 w-4 text-stone-400" />
            </button>
          </div>

          {/* Métadonnées */}
          <div className="flex items-center gap-4 text-xs text-stone-400">
            <span>Détecté par {signal.detectedBy === "gpt" ? "GPT" : signal.detectedBy}</span>
            <span>·</span>
            <span>{new Date(signal.detectedAt).toLocaleDateString("fr-FR")}</span>
            {signal.sourceUrl && (
              <>
                <span>·</span>
                <a 
                  href={signal.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:underline"
                >
                  Voir la source
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function NoSitesMessage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Settings className="h-8 w-8 text-orange-500" />
        </div>
        <h2 className="text-lg font-medium text-stone-800 mb-2">
          Aucun site WordPress configuré
        </h2>
        <p className="text-stone-500 mb-6">
          Configurez un site WordPress pour voir les signaux.
        </p>
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          Configurer un site
        </Link>
      </div>
    </div>
  )
}

export function Signals() {
  const { selectedSite, hasNoSites } = useSiteContext()
  const { data: signals, isLoading } = useOpenSignals(selectedSite?._id)

  const handleDismiss = (signalId: string) => {
    console.log("Dismiss signal:", signalId)
  }

  if (hasNoSites) {
    return <NoSitesMessage />
  }

  const knownTypes = Object.keys(signalTypeConfig) as SignalType[]
  
  const groupedByType = signals?.reduce((acc, signal) => {
    const type = knownTypes.includes(signal.type) ? signal.type : ("other" as SignalType)
    if (!acc[type]) acc[type] = []
    acc[type].push(signal)
    return acc
  }, {} as Record<SignalType | "other", Signal[]>)

  const orderedTypes: (SignalType | "other")[] = [...knownTypes, "other"]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Bell className="h-5 w-5 text-orange-600" />
          </div>
          <h1 className="text-xl font-semibold text-stone-800">Signaux</h1>
          {signals && signals.length > 0 && (
            <span className="text-sm text-stone-400">({signals.length})</span>
          )}
        </div>
        <p className="text-sm text-stone-500">
          {selectedSite 
            ? `Signaux pour ${selectedSite.name}`
            : "Événements nécessitant une vérification lors de la prochaine mise à jour"}
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
          {orderedTypes.map(type => {
            const typeSignals = groupedByType?.[type]
            if (!typeSignals || typeSignals.length === 0) return null
            
            const config = type === "other" ? defaultConfig : signalTypeConfig[type]
            const bgColor = config.color.split(' ')[0].replace('text-', 'bg-')
            
            return (
              <section key={type}>
                <h2 className="text-sm font-medium text-stone-500 mb-3 flex items-center gap-2">
                  <span className={cn("w-1.5 h-1.5 rounded-full", bgColor)} />
                  {config.label}
                  <span className="text-stone-400">({typeSignals.length})</span>
                </h2>
                <div className="space-y-3">
                  {typeSignals.map(signal => (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
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
