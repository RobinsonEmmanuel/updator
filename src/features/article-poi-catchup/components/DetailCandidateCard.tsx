import { BookOpen, Info, Link2, RefreshCw, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { decodeHtmlEntities } from "@/features/article-poi-catchup/domain"
import {
  formatPoiEntityKind,
  formatPoiExtractionAction,
  formatPoiRelevance,
} from "@/features/article-poi-catchup/poiExtractionContract"
import type { PoiCandidateGroup, RegionPoiLite } from "@/hooks"
import type { PoiSuggestion } from "@/hooks/useArticlePoiCatchup"

interface SuggestionLinkPayload {
  group: PoiCandidateGroup
  suggestion: PoiSuggestion
  typeLabel: string
  clusterLabel: string
}

interface DetailCandidateCardProps {
  group: PoiCandidateGroup
  expanded: boolean
  mutationPending: boolean
  recomputePending: boolean
  unlinkConfirmOpen: boolean
  removeConfirmOpen: boolean
  linkedRlPlaceIdsInPanel: string[]
  regionPoiById: Map<string, RegionPoiLite>
  placeTypeLabelByType: Map<string, string>
  showUnlinkedHeader: boolean
  showSuggestionHeader: boolean
  onFocusCandidate: (candidateId: string) => void
  onToggleInfo: (candidateId: string) => void
  onRecomputeCandidate: (candidate: PoiCandidateGroup) => void
  onOpenAnnuaire: (candidate: PoiCandidateGroup) => void
  onToggleUnlinkConfirm: (candidateId: string) => void
  onConfirmUnlink: (candidate: PoiCandidateGroup) => void
  onToggleRemoveConfirm: (candidateId: string) => void
  onConfirmRemove: (candidate: PoiCandidateGroup) => void
  onSuggestionLink: (payload: SuggestionLinkPayload) => void
  logUnknownMeta: (
    kind: "linked" | "suggestion",
    candidateId: string,
    rlPlaceId: string,
    reason: "missing_cluster" | "missing_type",
    extra: Record<string, unknown>
  ) => void
}

export function DetailCandidateCard({
  group,
  expanded,
  mutationPending,
  recomputePending,
  unlinkConfirmOpen,
  removeConfirmOpen,
  linkedRlPlaceIdsInPanel,
  regionPoiById,
  placeTypeLabelByType,
  showUnlinkedHeader,
  showSuggestionHeader,
  onFocusCandidate,
  onToggleInfo,
  onRecomputeCandidate,
  onOpenAnnuaire,
  onToggleUnlinkConfirm,
  onConfirmUnlink,
  onToggleRemoveConfirm,
  onConfirmRemove,
  onSuggestionLink,
  logUnknownMeta,
}: DetailCandidateCardProps) {
  const suggestions = group.suggestions || []
  const isLinkedCandidate = !!group.rl_place_id
  const linkedPoi = group.rl_place_id ? regionPoiById.get(group.rl_place_id) : undefined
  const linkedTypeKey = (group.rl_place_type || linkedPoi?.place_type || "").trim().toLowerCase()
  const linkedTypeLabel = decodeHtmlEntities(
    group.rl_place_type_label_fr ||
      linkedPoi?.place_type_label_fr ||
      (linkedTypeKey ? placeTypeLabelByType.get(linkedTypeKey) : "") ||
      group.rl_place_type ||
      linkedPoi?.place_type ||
      "Type inconnu"
  )
  const linkedClusterName = decodeHtmlEntities(group.rl_cluster_name || linkedPoi?.cluster_names?.[0] || "Cluster inconnu")
  const linkedDisplayName = decodeHtmlEntities(group.rl_place_name || linkedPoi?.name || group.name)
  const linkedClusterMeta = group.rl_cluster_id || linkedPoi?.cluster_ids?.[0] || undefined

  if (isLinkedCandidate && linkedClusterName === "Cluster inconnu") {
    logUnknownMeta("linked", group.candidate_id, group.rl_place_id || group.candidate_id, "missing_cluster", {
      candidateCluster: group.rl_cluster_name,
      poiCluster: linkedPoi?.cluster_names,
    })
  }
  if (isLinkedCandidate && linkedTypeLabel === "Type inconnu") {
    logUnknownMeta("linked", group.candidate_id, group.rl_place_id || group.candidate_id, "missing_type", {
      candidateType: group.rl_place_type,
      candidateTypeLabel: group.rl_place_type_label_fr,
      poiType: linkedPoi?.place_type,
      poiTypeLabel: linkedPoi?.place_type_label_fr,
    })
  }

  return (
    <div>
      {showUnlinkedHeader ? (
        <div className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-stone-500">
          Candidats à valider
        </div>
      ) : null}
      <div
        className={cn(
          "relative rounded-lg border p-2.5 pr-24",
          isLinkedCandidate ? "border-emerald-200 bg-emerald-50/30" : "border-stone-200 bg-white"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onFocusCandidate(group.candidate_id)}
            className="text-left min-w-0 flex-1"
          >
            <div className="text-sm font-medium text-stone-800 break-words">
              {isLinkedCandidate ? linkedDisplayName : decodeHtmlEntities(group.name)}
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              {isLinkedCandidate
                ? `POI RL validé`
                : `Score ${Math.round((group.mention_score || 0) * 100)}% · ${suggestions.length} rapprochement(s)`}
            </div>
            {!isLinkedCandidate ? (
              <div className="mt-0.5 text-[11px] text-stone-500">
                Candidat détecté: {decodeHtmlEntities(group.name)}
              </div>
            ) : null}
            {isLinkedCandidate ? (
              <div className="mt-1 text-[11px] text-stone-600 leading-relaxed">
                <span>{linkedTypeLabel}</span>
                <span className="text-stone-400"> · </span>
                <span>{linkedClusterName}</span>
              </div>
            ) : null}
            {(group.entity_kind || group.tourism_relevance || group.extraction_action || group.suggested_place_type) ? (
              <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                {group.entity_kind ? (
                  <span className="rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-blue-700">
                    {formatPoiEntityKind(group.entity_kind)}
                  </span>
                ) : null}
                {group.suggested_place_type ? (
                  <span className="rounded border border-stone-100 bg-stone-50 px-1.5 py-0.5 text-stone-600">
                    type: {group.suggested_place_type.replace(/_/g, " ")}
                  </span>
                ) : null}
                {group.tourism_relevance ? (
                  <span className="rounded border border-orange-100 bg-orange-50 px-1.5 py-0.5 text-orange-700">
                    {formatPoiRelevance(group.tourism_relevance)}
                  </span>
                ) : null}
                {group.extraction_action ? (
                  <span className="rounded border border-purple-100 bg-purple-50 px-1.5 py-0.5 text-purple-700">
                    {formatPoiExtractionAction(group.extraction_action)}
                  </span>
                ) : null}
                {group.is_geolocatable === false ? (
                  <span className="rounded border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-stone-500">
                    non geolocalisable
                  </span>
                ) : null}
              </div>
            ) : null}
          </button>

          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleInfo(group.candidate_id)}
              className="inline-flex items-center justify-center h-8 w-8 rounded border border-stone-200 text-stone-600 hover:bg-stone-50"
              title="Voir les infos du candidat"
              aria-label="Voir les infos du candidat"
            >
              <Info className="h-4 w-4" />
            </button>

            {!isLinkedCandidate ? (
              <button
                type="button"
                onClick={() => onRecomputeCandidate(group)}
                disabled={mutationPending}
                className="inline-flex items-center justify-center h-8 w-8 rounded border border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 disabled:opacity-60"
                title="Relancer le scan POI réel pour ce candidat"
                aria-label="Relancer le scan POI réel pour ce candidat"
              >
                <RefreshCw className={cn("h-4 w-4", recomputePending && "animate-spin")} />
              </button>
            ) : null}

            {!isLinkedCandidate ? (
              <button
                type="button"
                onClick={() => onOpenAnnuaire(group)}
                className="inline-flex items-center justify-center h-8 w-8 rounded border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                title="Ouvrir l'annuaire RL"
                aria-label="Ouvrir l'annuaire RL"
              >
                <BookOpen className="h-4 w-4" />
              </button>
            ) : null}

            {isLinkedCandidate ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => onToggleUnlinkConfirm(group.candidate_id)}
                  disabled={mutationPending}
                  className="inline-flex items-center justify-center h-8 w-8 rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                  title="Retirer la liaison RL de ce candidat"
                  aria-label="Retirer la liaison RL de ce candidat"
                >
                  <Link2 className="h-4 w-4" />
                </button>
                {unlinkConfirmOpen ? (
                  <div className="absolute right-0 mt-1 z-20 w-56 rounded-md border border-red-200 bg-white shadow-sm p-2 text-[11px] text-stone-700">
                    <div className="mb-2">Confirmer le retrait du POI lié pour ce candidat ?</div>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onToggleUnlinkConfirm(group.candidate_id)}
                        className="px-2 py-1 rounded border border-stone-200 text-stone-600 hover:bg-stone-50"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={() => onConfirmUnlink(group)}
                        disabled={mutationPending}
                        className="px-2 py-1 rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        Confirmer
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="relative">
              <button
                type="button"
                onClick={() => onToggleRemoveConfirm(group.candidate_id)}
                disabled={mutationPending}
                className="inline-flex items-center justify-center h-8 w-8 rounded border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60"
                title="Supprimer complètement ce candidat"
                aria-label="Supprimer complètement ce candidat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              {removeConfirmOpen ? (
                <div className="absolute right-0 mt-1 z-20 w-64 rounded-md border border-red-200 bg-white shadow-sm p-2 text-[11px] text-stone-700">
                  <div className="mb-2">
                    Supprimer définitivement ce candidat hors sujet
                    {isLinkedCandidate ? " (avec son lien RL)" : ""} ?
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onToggleRemoveConfirm(group.candidate_id)}
                      className="px-2 py-1 rounded border border-stone-200 text-stone-600 hover:bg-stone-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => onConfirmRemove(group)}
                      disabled={mutationPending}
                      className="px-2 py-1 rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {expanded ? (
          <div className="mt-2 text-xs text-stone-600 space-y-1">
            <div><strong>Occurrences (freq):</strong> {group.frequency}</div>
            <div><strong>Hits titres (h):</strong> {group.heading_hits} sur H1/H2/H3</div>
            <div><strong>Suggestions RL (sugg):</strong> {suggestions.length}</div>
            {group.detection_confidence != null ? (
              <div><strong>Confiance extraction:</strong> {Math.round(group.detection_confidence * 100)}%</div>
            ) : null}
            {group.evidence_text ? (
              <div><strong>Extrait extraction:</strong> {decodeHtmlEntities(group.evidence_text)}</div>
            ) : null}
            {group.extraction_reason ? (
              <div><strong>Raison extraction:</strong> {decodeHtmlEntities(group.extraction_reason)}</div>
            ) : null}
            {isLinkedCandidate ? (
              <>
                <div><strong>Place type (clé):</strong> {group.rl_place_type || linkedPoi?.place_type || "—"}</div>
                <div><strong>Cluster (id):</strong> {linkedClusterMeta || "—"}</div>
                <div><strong>POI RL id:</strong> {group.rl_place_id || "—"}</div>
              </>
            ) : null}
          </div>
        ) : null}

        {!isLinkedCandidate ? (
          <div className="mt-3 space-y-2">
            {showSuggestionHeader ? (
              <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">
                Rapprochements RL à valider
              </div>
            ) : null}
            {suggestions.length > 0 ? (
              <div className="space-y-1">
                {suggestions.slice(0, 8).map((s) => {
                  const alreadyLinkedOnArticle = linkedRlPlaceIdsInPanel.includes(s.rl_place_id)
                  const fallbackPoi = regionPoiById.get(s.rl_place_id)
                  const typeKey = (s.place_type || fallbackPoi?.place_type || "").trim().toLowerCase()
                  const typeLabel = decodeHtmlEntities(
                    s.place_type_label_fr ||
                      fallbackPoi?.place_type_label_fr ||
                      (typeKey ? placeTypeLabelByType.get(typeKey) : "") ||
                      s.place_type ||
                      fallbackPoi?.place_type ||
                      "Type inconnu"
                  )
                  const clusterLabel = decodeHtmlEntities(
                    s.cluster_name || s.cluster_names?.[0] || fallbackPoi?.cluster_names?.[0] || "Cluster inconnu"
                  )
                  if (clusterLabel === "Cluster inconnu") {
                    logUnknownMeta("suggestion", group.candidate_id, s.rl_place_id, "missing_cluster", {
                      suggestionCluster: s.cluster_name,
                      suggestionClusterNames: s.cluster_names,
                      poiCluster: fallbackPoi?.cluster_names,
                    })
                  }
                  if (typeLabel === "Type inconnu") {
                    logUnknownMeta("suggestion", group.candidate_id, s.rl_place_id, "missing_type", {
                      suggestionType: s.place_type,
                      suggestionTypeLabel: s.place_type_label_fr,
                      poiType: fallbackPoi?.place_type,
                      poiTypeLabel: fallbackPoi?.place_type_label_fr,
                    })
                  }
                  return (
                    <div key={s.rl_place_id} className="flex items-stretch gap-1">
                      <button
                        type="button"
                        disabled={alreadyLinkedOnArticle}
                        onClick={() =>
                          !alreadyLinkedOnArticle &&
                          onSuggestionLink({ group, suggestion: s, typeLabel, clusterLabel })
                        }
                        className={cn(
                          "flex-1 text-left rounded-lg border px-2.5 py-1.5 text-[11px]",
                          alreadyLinkedOnArticle
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 cursor-not-allowed"
                            : "border-stone-200 bg-white text-stone-700 hover:bg-orange-50"
                        )}
                      >
                        <div
                          className="leading-snug break-words"
                          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                        >
                          <span className="font-medium text-stone-800">{decodeHtmlEntities(s.name)}</span>
                          <span className="text-stone-500"> (suggestion RL)</span>
                          <span className="text-stone-500"> · </span>
                          <span className="text-stone-600">{typeLabel}</span>
                          <span className="text-stone-500"> · </span>
                          <span className="text-stone-600">{clusterLabel}</span>
                          <span className="text-stone-500"> · </span>
                          <span className="font-medium text-stone-700">{Math.round(s.score * 100)}%</span>
                        </div>
                        {alreadyLinkedOnArticle ? (
                          <div className="mt-1 text-[11px] text-emerald-700">Déjà lié sur cet article</div>
                        ) : null}
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-xs text-stone-500 rounded-lg border border-stone-200 bg-stone-50 p-2">
                Aucun rapprochement RL pour ce candidat.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
