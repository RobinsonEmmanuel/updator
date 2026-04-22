import { useState } from "react"
import type { ArticlePoiBacklogRow, PoiCandidateGroup } from "@/hooks"
import {
  applyLinkedCandidate,
  applyRecomputedCandidate,
  applyRemovedCandidate,
  applyUnlinkedCandidate,
} from "@/features/article-poi-catchup/poiCatchupDetailDomain"

interface ManualCandidateDraft {
  name: string
  sectionTitle: string
  sectionId: string
  anchorX: number
  anchorY: number
}

export function usePoiCatchupDetailController() {
  const [linkPanelRow, setLinkPanelRow] = useState<ArticlePoiBacklogRow | null>(null)
  const [regionPoiSearch, setRegionPoiSearch] = useState("")
  const [regionPoiClusterFilter, setRegionPoiClusterFilter] = useState("")
  const [regionPoiTypeFilter, setRegionPoiTypeFilter] = useState("")
  const [selectedRegionPoi, setSelectedRegionPoi] = useState<{
    rl_place_id: string
    name: string
    place_type?: string
    place_type_label_fr?: string
    cluster_name?: string
    confidenceScore?: number
  } | null>(null)
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [focusedCandidateId, setFocusedCandidateId] = useState<string | null>(null)
  const [openSectionIds, setOpenSectionIds] = useState<string[]>([])
  const [annuaireModalCandidateId, setAnnuaireModalCandidateId] = useState<string | null>(null)
  const [unlinkConfirmCandidateId, setUnlinkConfirmCandidateId] = useState<string | null>(null)
  const [removeConfirmCandidateId, setRemoveConfirmCandidateId] = useState<string | null>(null)
  const [expandedCandidateInfo, setExpandedCandidateInfo] = useState<Record<string, boolean>>({})
  const [manualCandidateDraft, setManualCandidateDraft] = useState<ManualCandidateDraft | null>(null)
  const [recomputeCandidateInFlightId, setRecomputeCandidateInFlightId] = useState<string | null>(null)

  const openLinkPanel = (row: ArticlePoiBacklogRow) => {
    setLinkPanelRow(row)
    const initialCandidateId = (row.detectedCandidates || [])[0]?.candidate_id || null
    setSelectedCandidateId(initialCandidateId)
    setRegionPoiSearch("")
    setRegionPoiClusterFilter("")
    setRegionPoiTypeFilter("")
    setSelectedRegionPoi(null)
    setFocusedCandidateId(null)
    setAnnuaireModalCandidateId(null)
    setExpandedCandidateInfo({})
    setUnlinkConfirmCandidateId(null)
    setRemoveConfirmCandidateId(null)
    setManualCandidateDraft(null)
  }

  const closeLinkPanel = () => {
    setLinkPanelRow(null)
    setSelectedRegionPoi(null)
    setAnnuaireModalCandidateId(null)
    setUnlinkConfirmCandidateId(null)
    setRemoveConfirmCandidateId(null)
    setFocusedCandidateId(null)
    setOpenSectionIds([])
    setImagePreviewSrc(null)
    setManualCandidateDraft(null)
  }

  const applyLinkedCandidateInPanel = (params: {
    candidateId: string
    rlPlaceId: string
    rlPlaceName?: string
    placeType?: string
    placeTypeLabelFr?: string
    clusterId?: string
    clusterName?: string
  }) => {
    setLinkPanelRow((prev) => (prev ? applyLinkedCandidate(prev, params) : prev))
  }

  const applyUnlinkedCandidateInPanel = (candidateId: string) => {
    setLinkPanelRow((prev) => (prev ? applyUnlinkedCandidate(prev, candidateId) : prev))
  }

  const applyRemovedCandidateInPanel = (candidateId: string) => {
    setLinkPanelRow((prev) => {
      if (!prev) return prev
      const next = applyRemovedCandidate(prev, candidateId)
      const nextSelectedCandidateId = next.detectedCandidates[0]?.candidate_id || null
      setSelectedCandidateId((prevSelected) => (prevSelected === candidateId ? nextSelectedCandidateId : prevSelected))
      setFocusedCandidateId((prevFocused) => (prevFocused === candidateId ? null : prevFocused))
      return next
    })
  }

  const applyRecomputedCandidateInPanel = (candidateId: string, nextCandidate: PoiCandidateGroup) => {
    setLinkPanelRow((prev) => (prev ? applyRecomputedCandidate(prev, candidateId, nextCandidate) : prev))
  }

  return {
    linkPanelRow,
    setLinkPanelRow,
    regionPoiSearch,
    setRegionPoiSearch,
    regionPoiClusterFilter,
    setRegionPoiClusterFilter,
    regionPoiTypeFilter,
    setRegionPoiTypeFilter,
    selectedRegionPoi,
    setSelectedRegionPoi,
    imagePreviewSrc,
    setImagePreviewSrc,
    selectedCandidateId,
    setSelectedCandidateId,
    focusedCandidateId,
    setFocusedCandidateId,
    openSectionIds,
    setOpenSectionIds,
    annuaireModalCandidateId,
    setAnnuaireModalCandidateId,
    unlinkConfirmCandidateId,
    setUnlinkConfirmCandidateId,
    removeConfirmCandidateId,
    setRemoveConfirmCandidateId,
    expandedCandidateInfo,
    setExpandedCandidateInfo,
    manualCandidateDraft,
    setManualCandidateDraft,
    recomputeCandidateInFlightId,
    setRecomputeCandidateInFlightId,
    openLinkPanel,
    closeLinkPanel,
    applyLinkedCandidateInPanel,
    applyUnlinkedCandidateInPanel,
    applyRemovedCandidateInPanel,
    applyRecomputedCandidateInPanel,
  }
}
