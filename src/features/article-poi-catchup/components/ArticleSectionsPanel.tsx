import { ChevronsDown, ChevronsUp, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { decodeHtmlEntities } from "@/features/article-poi-catchup/domain"
import type { ReactNode } from "react"

interface ArticleSectionsPanelProps {
  title: string
  articleUrl: string | null
  focusedCandidateId: string | null
  onResetFocus: () => void
  onExpandAll: () => void
  onCollapseAll: () => void
  canExpandAll: boolean
  canCollapseAll: boolean
  markPending: boolean
  mutationPending: boolean
  manualDraft: { name: string; anchorX: number; anchorY: number } | null
  onMarkDraft: () => void
  onCloseDraft: () => void
  children: ReactNode
}

export function ArticleSectionsPanel({
  title,
  articleUrl,
  focusedCandidateId,
  onResetFocus,
  onExpandAll,
  onCollapseAll,
  canExpandAll,
  canCollapseAll,
  markPending,
  mutationPending,
  manualDraft,
  onMarkDraft,
  onCloseDraft,
  children,
}: ArticleSectionsPanelProps) {
  return (
    <div className="bg-white p-2.5 rounded-lg">
      <div className="text-xs text-stone-500">Article complet (sections H1/H2/H3, candidats surlignés cliquables)</div>
      <div className="text-sm font-medium text-stone-800 mt-1">{decodeHtmlEntities(title)}</div>
      {articleUrl ? (
        <a
          href={articleUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-orange-700 underline underline-offset-2"
        >
          Ouvrir l’article source
        </a>
      ) : null}
      {focusedCandidateId ? (
        <div className="mt-2 text-[11px] rounded border border-orange-200 bg-orange-50 text-orange-800 px-2 py-1 inline-flex items-center gap-2">
          Filtre candidat actif
          <button
            type="button"
            onClick={onResetFocus}
            className="inline-flex items-center rounded border border-orange-200 bg-stone-50 px-1.5 py-0.5 hover:bg-orange-100"
          >
            Réinitialiser
          </button>
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onExpandAll}
          disabled={!canExpandAll}
          className="inline-flex items-center gap-1 rounded border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          title="Tout déplier"
        >
          <ChevronsDown className="h-3.5 w-3.5" />
          Tout déplier
        </button>
        <button
          type="button"
          onClick={onCollapseAll}
          disabled={!canCollapseAll}
          className="inline-flex items-center gap-1 rounded border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-100 disabled:opacity-50"
          title="Tout replier"
        >
          <ChevronsUp className="h-3.5 w-3.5" />
          Tout replier
        </button>
      </div>
      <div className="mt-2 max-h-[75vh] overflow-y-auto rounded-md bg-white p-2 space-y-1.5">
        {children}
        {manualDraft ? (
          <div
            className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-md border border-orange-300 bg-white shadow-lg px-2 py-1.5 flex items-center gap-2"
            style={{
              left: Math.max(120, Math.min(window.innerWidth - 120, manualDraft.anchorX)),
              top: Math.max(80, manualDraft.anchorY - 10),
            }}
          >
            <span className="text-[11px] text-stone-600 max-w-[260px] truncate" title={manualDraft.name}>
              "{manualDraft.name}"
            </span>
            <button
              type="button"
              onClick={onMarkDraft}
              disabled={mutationPending}
              className="inline-flex items-center gap-1 rounded border border-orange-300 bg-orange-50 px-2 py-1 text-[11px] text-orange-800 hover:bg-orange-100 disabled:opacity-60"
            >
              <Sparkles className={cn("h-3.5 w-3.5", markPending && "animate-spin")} />
              Marquer + scanner RL
            </button>
            <button
              type="button"
              onClick={onCloseDraft}
              className="inline-flex items-center rounded border border-stone-200 bg-white px-1.5 py-1 text-[11px] text-stone-600 hover:bg-stone-50"
              aria-label="Fermer l'action de marquage"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
