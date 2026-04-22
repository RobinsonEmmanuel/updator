import { ArrowLeft, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { decodeHtmlEntities } from "@/features/article-poi-catchup/domain"
import type { ArticlePoiBacklogRow } from "@/hooks"

interface ArticleDetailHeaderProps {
  row: ArticlePoiBacklogRow
  mutationPending: boolean
  recomputePending: boolean
  onRecomputeArticle: () => void
  onToggleScanValidation: () => void
  onBack: () => void
}

export function ArticleDetailHeader({
  row,
  mutationPending,
  recomputePending,
  onRecomputeArticle,
  onToggleScanValidation,
  onBack,
}: ArticleDetailHeaderProps) {
  return (
    <div className="sticky top-0 z-10 px-0 py-2 bg-stone-50/85 backdrop-blur-sm flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-stone-800">Espace de liaison POI</h3>
        <p className="text-xs text-stone-500 mt-1">{decodeHtmlEntities(row.title)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(row.categories || []).length > 0 ? (
            row.categories.map((cat) => (
              <span key={cat} className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] text-stone-600">
                {decodeHtmlEntities(cat)}
              </span>
            ))
          ) : (
            <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] text-stone-500">
              Sans catégorie
            </span>
          )}
          {row.poiScanValidated ? (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
              Validé scan POI
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
              Scan POI à valider
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRecomputeArticle}
          disabled={mutationPending}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-60 text-xs"
          title="Relancer scan POI article (avec vérification WP)"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", recomputePending && "animate-spin")} />
          Relancer scan article
        </button>
        <button
          type="button"
          onClick={onToggleScanValidation}
          disabled={mutationPending}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border disabled:opacity-60 text-xs",
            row.poiScanValidated
              ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          )}
          title={row.poiScanValidated ? "Retirer validation scan POI article" : "Valider scan POI article"}
        >
          {row.poiScanValidated ? "Retirer validation scan" : "Valider scan article"}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 text-xs"
          aria-label="Retour à la liste"
          title="Retour à la liste"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour à la liste
        </button>
      </div>
    </div>
  )
}
