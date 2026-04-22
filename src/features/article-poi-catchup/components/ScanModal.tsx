import { Loader2 } from "lucide-react"
import { formatLogTime } from "@/features/article-poi-catchup/domain"
import type { ActionLogEntry } from "@/features/article-poi-catchup/components/ActionLogWidget"

interface ScanModalProps {
  open: boolean
  siteName: string
  isPending: boolean
  isError: boolean
  errorMessage?: string
  summary?: {
    updated: number
    refreshed: number
    refreshFailed: number
    rlPlacesLoaded: number
    needsReview: number
    pending: number
  } | null
  logs: ActionLogEntry[]
  onClose: () => void
}

export function ScanModal({
  open,
  siteName,
  isPending,
  isError,
  errorMessage,
  summary,
  logs,
  onClose,
}: ScanModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-xl shadow-xl border border-stone-200 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-stone-800">Scan POI en cours</h3>
            <p className="text-sm text-stone-500 mt-1">Site: {siteName}</p>
          </div>
          {!isPending && (
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg text-xs border border-stone-200 text-stone-700 hover:bg-stone-50"
            >
              Fermer
            </button>
          )}
        </div>
        <div className="px-6 py-4 overflow-y-auto">
          {isPending ? (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Refresh WordPress complet (html/images/urls) + matching POI par cluster...
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage || "Erreur scan"}</div>
          ) : summary ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 space-y-1">
              <div>Scan terminé: {summary.updated} articles recalculés</div>
              <div>Refresh WP: {summary.refreshed} OK · {summary.refreshFailed} KO</div>
              <div>POI RL lus: {summary.rlPlacesLoaded}</div>
              <div>A revue: {summary.needsReview} · Pending: {summary.pending}</div>
            </div>
          ) : (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">Le scan va démarrer.</div>
          )}

          {logs.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-stone-700 mb-2">Derniers événements</h4>
              <div className="space-y-1 max-h-36 overflow-auto">
                {logs.slice(0, 8).map((log) => (
                  <div key={log.id} className="text-xs text-stone-600 flex items-center gap-2">
                    <span className="text-stone-400 min-w-[54px]">{formatLogTime(log.at)}</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
