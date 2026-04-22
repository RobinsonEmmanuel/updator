import { Link2, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { decodeHtmlEntities } from "@/features/article-poi-catchup/domain"
import type { RegionPoiLite } from "@/hooks"

interface SelectedRegionPoi {
  rl_place_id: string
  name: string
  place_type?: string
  place_type_label_fr?: string
  cluster_name?: string
}

interface AnnuaireModalProps {
  open: boolean
  candidateName: string
  articleTitle: string
  regionPoiSearch: string
  onRegionPoiSearchChange: (value: string) => void
  regionPoiClusterFilter: string
  onRegionPoiClusterFilterChange: (value: string) => void
  regionPoiTypeFilter: string
  onRegionPoiTypeFilterChange: (value: string) => void
  availableClusterNames: string[]
  availableTypeLabels: string[]
  filteredRegionPois: RegionPoiLite[]
  showRegionPoiSearchSpinner: boolean
  showRegionPoiLoadingPlaceholder: boolean
  selectedRegionPoi: SelectedRegionPoi | null
  onSelectRegionPoi: (poi: SelectedRegionPoi) => void
  mutationPending: boolean
  onClose: () => void
  onValidateLink: () => void
}

export function AnnuaireModal({
  open,
  candidateName,
  articleTitle,
  regionPoiSearch,
  onRegionPoiSearchChange,
  regionPoiClusterFilter,
  onRegionPoiClusterFilterChange,
  regionPoiTypeFilter,
  onRegionPoiTypeFilterChange,
  availableClusterNames,
  availableTypeLabels,
  filteredRegionPois,
  showRegionPoiSearchSpinner,
  showRegionPoiLoadingPlaceholder,
  selectedRegionPoi,
  onSelectRegionPoi,
  mutationPending,
  onClose,
  onValidateLink,
}: AnnuaireModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-3xl shadow-xl border border-stone-200 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-stone-800">Annuaire RL · Liaison manuelle</h3>
            <p className="text-xs text-stone-500 mt-1">Candidat détecté: {decodeHtmlEntities(candidateName)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded border border-stone-200 text-stone-600 hover:bg-stone-50"
            aria-label="Fermer annuaire RL"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-3">
          <div className="space-y-2">
            <div className="text-xs text-stone-500">Moteur POI région (filtres)</div>
            <div className="relative">
              <input
                value={regionPoiSearch}
                onChange={(e) => onRegionPoiSearchChange(e.target.value)}
                placeholder="Recherche nom, ID, cluster, type"
                className="w-full px-3 py-2 pr-9 rounded-lg border border-stone-200 text-sm"
              />
              {showRegionPoiSearchSpinner ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 animate-spin" />
              ) : null}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select
                value={regionPoiClusterFilter}
                onChange={(e) => onRegionPoiClusterFilterChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm bg-white"
              >
                <option value="">Tous les clusters</option>
                {availableClusterNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                value={regionPoiTypeFilter}
                onChange={(e) => onRegionPoiTypeFilterChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm bg-white"
              >
                <option value="">Toutes les catégories</option>
                {availableTypeLabels.map((label) => (
                  <option key={label} value={label}>{label}</option>
                ))}
              </select>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-stone-200 bg-white p-2">
              {showRegionPoiLoadingPlaceholder ? (
                <div className="flex items-center gap-2 text-xs text-stone-500 p-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
                  Recherche des POI en cours...
                </div>
              ) : null}
              {filteredRegionPois.map((poi) => (
                <button
                  key={poi.rl_place_id}
                  type="button"
                  onClick={() =>
                    onSelectRegionPoi({
                      rl_place_id: poi.rl_place_id,
                      name: poi.name,
                      place_type: poi.place_type,
                      place_type_label_fr: poi.place_type_label_fr,
                      cluster_name: (poi.cluster_names || [])[0] || "Cluster inconnu",
                    })
                  }
                  className={cn(
                    "w-full text-left rounded border px-2 py-1.5 hover:bg-stone-50",
                    selectedRegionPoi?.rl_place_id === poi.rl_place_id
                      ? "border-orange-300 bg-orange-50"
                      : "border-stone-100"
                  )}
                >
                  <div className="text-xs text-stone-800">{decodeHtmlEntities(poi.name)}</div>
                  <div className="text-[11px] text-stone-500">
                    {decodeHtmlEntities(poi.place_type_label_fr || poi.place_type)} · {(poi.cluster_names || [])[0] || "Cluster inconnu"}
                  </div>
                </button>
              ))}
              {!showRegionPoiLoadingPlaceholder && filteredRegionPois.length === 0 && (
                <div className="text-xs text-stone-500 p-1">Aucun POI trouvé avec ces filtres.</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-stone-500">Validation de la sélection</div>
            {selectedRegionPoi ? (
              <div className="text-xs text-stone-700 rounded border border-stone-200 bg-stone-50 p-2">
                Sélectionné: {decodeHtmlEntities(selectedRegionPoi.name)} ·{" "}
                {decodeHtmlEntities(selectedRegionPoi.place_type_label_fr || selectedRegionPoi.place_type || "Type inconnu")} ·{" "}
                {decodeHtmlEntities(selectedRegionPoi.cluster_name || "Cluster inconnu")}
              </div>
            ) : (
              <div className="text-xs text-stone-500 rounded border border-stone-200 bg-stone-50 p-2">
                Sélectionne un POI dans la liste pour le lier.
              </div>
            )}
            <button
              type="button"
              disabled={mutationPending || !selectedRegionPoi?.rl_place_id}
              onClick={onValidateLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-60"
            >
              <Link2 className="h-3.5 w-3.5" />
              Valider et lier
            </button>
            <div className="text-[11px] text-stone-500">Article: {decodeHtmlEntities(articleTitle)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
