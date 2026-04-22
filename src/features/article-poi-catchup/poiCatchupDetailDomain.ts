import type { PoiAssociationStatus, ArticlePoiBacklogRow, PoiCandidateGroup } from "@/hooks"

function withLinkedCounters(row: ArticlePoiBacklogRow, detectedCandidates: PoiCandidateGroup[]): ArticlePoiBacklogRow {
  const linkedPoiCount = detectedCandidates.filter((group) => !!group.rl_place_id).length
  return {
    ...row,
    detectedCandidates,
    linkedPoiCount,
    hasLinkedPoi: linkedPoiCount > 0,
    status: linkedPoiCount > 0 ? "linked" : row.status,
  }
}

export function applyLinkedCandidate(
  row: ArticlePoiBacklogRow,
  params: {
    candidateId: string
    rlPlaceId: string
    rlPlaceName?: string
    placeType?: string
    placeTypeLabelFr?: string
    clusterId?: string
    clusterName?: string
  }
): ArticlePoiBacklogRow {
  const nextGroups = (row.detectedCandidates || []).map((group) =>
    group.candidate_id === params.candidateId
      ? {
          ...group,
          rl_place_id: params.rlPlaceId,
          rl_place_name: params.rlPlaceName || group.rl_place_name || group.name,
          rl_place_type: params.placeType || group.rl_place_type,
          rl_place_type_label_fr: params.placeTypeLabelFr || group.rl_place_type_label_fr,
          rl_cluster_id: params.clusterId || group.rl_cluster_id,
          rl_cluster_name: params.clusterName || group.rl_cluster_name,
          link_status: "linked" as PoiAssociationStatus,
          validated: true,
          suggestions: [],
        }
      : group
  )
  return withLinkedCounters(row, nextGroups)
}

export function applyUnlinkedCandidate(row: ArticlePoiBacklogRow, candidateId: string): ArticlePoiBacklogRow {
  const nextGroups = (row.detectedCandidates || []).map((group) =>
    group.candidate_id === candidateId
      ? {
          ...group,
          rl_place_id: undefined,
          rl_place_name: undefined,
          rl_place_type: undefined,
          rl_place_type_label_fr: undefined,
          rl_cluster_id: undefined,
          rl_cluster_name: undefined,
          link_status: "needs_review" as PoiAssociationStatus,
          validated: false,
        }
      : group
  )
  const rowWithCounters = withLinkedCounters(row, nextGroups)
  if (rowWithCounters.linkedPoiCount && rowWithCounters.linkedPoiCount > 0) return rowWithCounters
  return {
    ...rowWithCounters,
    status: "needs_review",
  }
}

export function applyRemovedCandidate(row: ArticlePoiBacklogRow, candidateId: string): ArticlePoiBacklogRow {
  const nextGroups = (row.detectedCandidates || [])
    .filter((group) => group.candidate_id !== candidateId)
    .map((group, index) => ({ ...group, is_primary: index === 0 }))
  return withLinkedCounters(row, nextGroups)
}

export function applyRecomputedCandidate(
  row: ArticlePoiBacklogRow,
  candidateId: string,
  nextCandidate: PoiCandidateGroup
): ArticlePoiBacklogRow {
  const nextGroups = (row.detectedCandidates || []).map((group, index) =>
    group.candidate_id === candidateId
      ? {
          ...nextCandidate,
          is_primary: index === 0,
          suggestions: Array.isArray(nextCandidate.suggestions) ? nextCandidate.suggestions : [],
        }
      : group
  )
  return withLinkedCounters(row, nextGroups)
}
