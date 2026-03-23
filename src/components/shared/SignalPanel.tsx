import { AlertTriangle, TrendingUp, Info, HelpCircle, X } from "lucide-react"
import { useOpenSignals, useDismissSignal } from "@/hooks"
import type { Signal } from "@/types"

interface SignalPanelProps {
  siteId?: string | null
}

const typeConfig: Record<string, { icon: typeof AlertTriangle; label: string; color: string }> = {
  closure: { icon: AlertTriangle, label: "Fermeture", color: "text-red-500 bg-red-50" },
  price_change: { icon: TrendingUp, label: "Prix", color: "text-orange-500 bg-orange-50" },
  new_info: { icon: Info, label: "Info", color: "text-blue-500 bg-blue-50" },
  suspicious: { icon: HelpCircle, label: "À vérifier", color: "text-amber-500 bg-amber-50" },
}

const defaultConfig = { icon: Info, label: "Autre", color: "text-stone-500 bg-stone-50" }

function daysSince(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (days === 0) return "aujourd'hui"
  if (days === 1) return "hier"
  return `il y a ${days}j`
}

function getSignalId(signal: Signal): string {
  return signal._id || signal.id || ""
}

function SignalCard({ signal, onDismiss }: { signal: Signal; onDismiss: () => void }) {
  const config = typeConfig[signal.type] ?? defaultConfig
  const Icon = config.icon

  return (
    <div className="p-3 rounded-lg bg-stone-50/50 group">
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded-lg ${config.color}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-stone-700">
              {signal.entityName}
            </span>
          </div>

          <p className="text-xs text-stone-500 line-clamp-2 mb-2">{signal.note}</p>

          <div className="flex items-center gap-2 text-xs text-stone-400">
            <span>{signal.detectedBy}</span>
            <span>•</span>
            <span>{daysSince(signal.detectedAt)}</span>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="p-1 rounded text-stone-300 hover:text-stone-500 hover:bg-stone-100 opacity-0 group-hover:opacity-100 transition-all"
          title="Fermer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function SignalPanel({ siteId }: SignalPanelProps) {
  const { data: signals, isLoading } = useOpenSignals(siteId ?? undefined)
  const dismissMutation = useDismissSignal()

  const handleDismiss = (signalId: string) => {
    dismissMutation.mutate(signalId)
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-20 bg-stone-50 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!signals?.length) {
    return (
      <p className="text-stone-400 text-sm py-4 text-center">
        Aucun signal
      </p>
    )
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {signals.map((signal) => (
        <SignalCard
          key={getSignalId(signal)}
          signal={signal}
          onDismiss={() => handleDismiss(getSignalId(signal))}
        />
      ))}
    </div>
  )
}
