import { PanelRight, RefreshCw } from "lucide-react"
import type { ArticlePoiBacklogRow } from "@/hooks"
import { decodeHtmlEntities, splitLinkedCandidates, countUnmatchedCandidates } from "@/features/article-poi-catchup/domain"

interface BacklogTableProps {
  rows: ArticlePoiBacklogRow[]
  mutationPending: boolean
  onRecomputeArticle: (row: ArticlePoiBacklogRow) => void
  onOpenDetail: (row: ArticlePoiBacklogRow) => void
}

export function BacklogTable({ rows, mutationPending, onRecomputeArticle, onOpenDetail }: BacklogTableProps) {
  return (
    <div className="bg-white/80 rounded-xl border border-stone-200 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-stone-50 text-stone-600">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Article</th>
            <th className="text-left px-4 py-3 font-medium">POI RL associés</th>
            <th className="text-left px-4 py-3 font-medium">Candidats sans POI RL validé</th>
            <th className="text-left px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const candidates = row.detectedCandidates || []
            const { linked, unlinked } = splitLinkedCandidates(candidates)
            const linkedVisible = linked.slice(0, 6)
            const hiddenLinkedCount = Math.max(0, linked.length - linkedVisible.length)
            const unlinkedVisible = unlinked.slice(0, 6)
            const hiddenUnlinkedCount = Math.max(0, unlinked.length - unlinkedVisible.length)
            const displayTitle = decodeHtmlEntities(row.title)
            const unmatchedCount = countUnmatchedCandidates(unlinked)
            return (
              <tr
                key={row.articleId}
                className={`border-t border-stone-100 align-top ${row.poiScanValidated ? "bg-emerald-50/50" : ""}`}
              >
                <td className="px-4 py-3 min-w-[340px]">
                  <div className="font-medium text-stone-800 truncate">{displayTitle}</div>
                  <div className="text-xs text-stone-500 mt-1">{row.categories.join(" · ") || "Sans catégorie"}</div>
                  <div className="text-xs text-stone-500 mt-1">
                    Candidats détectés: {candidates.length} · Candidats sans suggestion RL: {unmatchedCount}
                  </div>
                </td>
                <td className="px-4 py-3 min-w-[300px]">
                  {linkedVisible.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {linkedVisible.map((candidate) => (
                        <span
                          key={candidate.candidate_id}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs border bg-orange-100 border-orange-200 text-orange-800"
                          title={decodeHtmlEntities(candidate.rl_place_name || candidate.name)}
                        >
                          <span className="max-w-[220px] truncate">{decodeHtmlEntities(candidate.rl_place_name || candidate.name)}</span>
                        </span>
                      ))}
                      {hiddenLinkedCount > 0 ? (
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs border bg-orange-100 border-orange-200 text-orange-700">
                          +{hiddenLinkedCount}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-stone-500">Aucun POI RL associé</span>
                  )}
                </td>
                <td className="px-4 py-3 min-w-[360px]">
                  {unlinkedVisible.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {unlinkedVisible.map((candidate) => (
                        <span
                          key={candidate.candidate_id}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs border bg-stone-100 border-stone-200 text-stone-700"
                          title={decodeHtmlEntities(candidate.name)}
                        >
                          <span className="max-w-[180px] truncate">{decodeHtmlEntities(candidate.name)}</span>
                          <span className="font-medium text-stone-500">{(candidate.suggestions || []).length} sugg</span>
                        </span>
                      ))}
                      {hiddenUnlinkedCount > 0 ? (
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs border bg-stone-100 border-stone-200 text-stone-600">
                          +{hiddenUnlinkedCount}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-xs text-stone-500">Aucun candidat en attente</span>
                  )}
                </td>
                <td className="px-4 py-3 min-w-[150px]">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onRecomputeArticle(row)}
                      disabled={mutationPending}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-xs border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-60"
                      title="Relancer l'article"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={mutationPending}
                      onClick={() => onOpenDetail(row)}
                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-xs border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-60"
                      title="Ouvrir espace liaison"
                    >
                      <PanelRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="p-8 text-center text-sm text-stone-500">Aucun article avec ces filtres.</div>}
    </div>
  )
}
