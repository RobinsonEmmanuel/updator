import { BookOpen, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatLogTime } from "@/features/article-poi-catchup/domain"

export type ActionLogLevel = "info" | "success" | "error"

export interface ActionLogEntry {
  id: string
  at: string
  level: ActionLogLevel
  message: string
}

interface ActionLogWidgetProps {
  logs: ActionLogEntry[]
  isOpen: boolean
  hasBlockingLogs: boolean
  onOpen: () => void
  onClose: () => void
}

export function ActionLogWidget({ logs, isOpen, hasBlockingLogs, onOpen, onClose }: ActionLogWidgetProps) {
  if (logs.length === 0) return null

  return (
    <div className="fixed right-4 bottom-4 z-[60]">
      {isOpen ? (
        <div className="w-[360px] max-w-[90vw] rounded-xl border border-stone-200 bg-white shadow-xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200">
            <div className="text-xs font-medium text-stone-700">Journal d’actions</div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center h-7 w-7 rounded border border-stone-200 text-stone-600 hover:bg-stone-50"
              title="Réduire le journal"
              aria-label="Réduire le journal"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-3 space-y-1.5 max-h-52 overflow-auto">
            {logs.slice(0, 10).map((log) => (
              <div key={log.id} className="text-xs text-stone-600 flex items-start gap-2">
                <span className="text-stone-400 min-w-[54px]">{formatLogTime(log.at)}</span>
                <span
                  className={cn(
                    "inline-flex rounded px-1.5 py-0.5 mt-0.5",
                    log.level === "success" && "bg-green-100 text-green-700",
                    log.level === "error" && "bg-red-100 text-red-700",
                    log.level === "info" && "bg-stone-100 text-stone-700"
                  )}
                >
                  {log.level}
                </span>
                <span className="leading-relaxed">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            "relative inline-flex items-center justify-center h-11 w-11 rounded-full border shadow-lg",
            hasBlockingLogs
              ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
          )}
          title="Afficher le journal d’actions"
          aria-label="Afficher le journal d’actions"
        >
          <BookOpen className="h-4.5 w-4.5" />
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-stone-900 text-white text-[10px] leading-[18px]">
            {Math.min(logs.length, 99)}
          </span>
        </button>
      )}
    </div>
  )
}
