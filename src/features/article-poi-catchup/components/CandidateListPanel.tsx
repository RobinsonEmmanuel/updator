import type { ReactNode } from "react"

interface CandidateListPanelProps {
  linkedCount: number
  unlinkedCount: number
  hasVisibleCandidates: boolean
  children: ReactNode
}

export function CandidateListPanel({ linkedCount, unlinkedCount, hasVisibleCandidates, children }: CandidateListPanelProps) {
  return (
    <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-0.5">
      {linkedCount > 0 ? (
        <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 bg-emerald-50/70 border border-emerald-200 rounded px-2 py-1">
          POI déjà liés ({linkedCount})
        </div>
      ) : null}
      {linkedCount === 0 && unlinkedCount > 0 ? (
        <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500 bg-stone-50/80 border border-stone-200 rounded px-2 py-1">
          Candidats à valider ({unlinkedCount})
        </div>
      ) : null}
      {children}
      {!hasVisibleCandidates ? (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
          Aucun candidat visible. Ouvre une section H1/H2/H3 dans l’article pour afficher les candidats/POI correspondants.
        </div>
      ) : null}
    </div>
  )
}
