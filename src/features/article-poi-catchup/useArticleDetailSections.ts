import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react"
import type { ArticlePoiBacklogRow, PoiCandidateGroup } from "@/hooks"
import { normalizeForMatch } from "@/features/article-poi-catchup/domain"
import { parseSectionsFromHtml } from "@/features/article-poi-catchup/articleSectionHtml"

interface Params {
  linkPanelRow: ArticlePoiBacklogRow | null
  panelCandidateGroups: PoiCandidateGroup[]
  openSectionIds: string[]
  setOpenSectionIds: Dispatch<SetStateAction<string[]>>
  focusedCandidateId: string | null
  setFocusedCandidateId: (value: string | null) => void
  setManualCandidateDraft: (value: null) => void
  setLinkPanelRow: (value: ArticlePoiBacklogRow | null) => void
  selectedCandidateId: string | null
  setSelectedCandidateId: (value: string | null) => void
  backlogRows: ArticlePoiBacklogRow[]
}

export function useArticleDetailSections({
  linkPanelRow,
  panelCandidateGroups,
  openSectionIds,
  setOpenSectionIds,
  focusedCandidateId,
  setFocusedCandidateId,
  setManualCandidateDraft,
  setLinkPanelRow,
  selectedCandidateId,
  setSelectedCandidateId,
  backlogRows,
}: Params) {
  const lastOpenedArticleIdRef = useRef<string | null>(null)
  const openSectionTitleKeysRef = useRef<string[]>([])

  const articleSections = useMemo(() => {
    const html = linkPanelRow?.htmlCleaned || linkPanelRow?.htmlBrut || ""
    return parseSectionsFromHtml(html, panelCandidateGroups)
  }, [linkPanelRow?.htmlCleaned, linkPanelRow?.htmlBrut, panelCandidateGroups])

  const candidateSectionIdsMap = useMemo(() => {
    const map = new Map<string, string[]>()
    articleSections.forEach((section) => {
      section.candidateIds.forEach((candidateId) => {
        const prev = map.get(candidateId) || []
        if (!prev.includes(section.id)) map.set(candidateId, [...prev, section.id])
      })
    })
    return map
  }, [articleSections])

  const openSectionCandidateIds = useMemo(() => {
    const openSet = new Set(openSectionIds)
    const ids = new Set<string>()
    articleSections.forEach((section) => {
      if (!openSet.has(section.id)) return
      section.candidateIds.forEach((candidateId) => ids.add(candidateId))
    })
    return ids
  }, [articleSections, openSectionIds])

  const visiblePanelCandidateGroups = useMemo(() => {
    if (focusedCandidateId) {
      return panelCandidateGroups.filter((group) => group.candidate_id === focusedCandidateId)
    }
    return panelCandidateGroups.filter((group) => openSectionCandidateIds.has(group.candidate_id))
  }, [panelCandidateGroups, focusedCandidateId, openSectionCandidateIds])

  const linkedPanelCandidateGroups = useMemo(
    () => visiblePanelCandidateGroups.filter((group) => !!group.rl_place_id),
    [visiblePanelCandidateGroups]
  )

  const unlinkedPanelCandidateGroups = useMemo(
    () => visiblePanelCandidateGroups.filter((group) => !group.rl_place_id),
    [visiblePanelCandidateGroups]
  )

  useEffect(() => {
    if (!linkPanelRow) return
    const updated = backlogRows.find((row) => row.articleId === linkPanelRow.articleId)
    if (updated) {
      setLinkPanelRow(updated)
      if (selectedCandidateId) {
        const groups = updated.detectedCandidates || []
        const stillExists = groups.some((g) => g.candidate_id === selectedCandidateId)
        if (!stillExists) setSelectedCandidateId(groups[0]?.candidate_id || null)
      }
    }
  }, [backlogRows, linkPanelRow?.articleId, selectedCandidateId, setLinkPanelRow, setSelectedCandidateId])

  useEffect(() => {
    if (!linkPanelRow) {
      setOpenSectionIds([])
      setFocusedCandidateId(null)
      setManualCandidateDraft(null)
      lastOpenedArticleIdRef.current = null
      return
    }
    if (lastOpenedArticleIdRef.current !== linkPanelRow.articleId) {
      setOpenSectionIds([])
      setFocusedCandidateId(null)
      setManualCandidateDraft(null)
      lastOpenedArticleIdRef.current = linkPanelRow.articleId
    }
  }, [linkPanelRow?.articleId, setOpenSectionIds, setFocusedCandidateId, setManualCandidateDraft])

  useEffect(() => {
    openSectionTitleKeysRef.current = articleSections
      .filter((section) => openSectionIds.includes(section.id))
      .map((section) => normalizeForMatch(section.title) || section.id)
  }, [articleSections, openSectionIds])

  useEffect(() => {
    if (!linkPanelRow) return
    if (openSectionTitleKeysRef.current.length === 0) return
    const desired = new Set(openSectionTitleKeysRef.current)
    const remappedIds = articleSections
      .filter((section) => desired.has(normalizeForMatch(section.title) || section.id))
      .map((section) => section.id)
    if (remappedIds.length === 0) return
    const current = openSectionIds.join("|")
    const next = remappedIds.join("|")
    if (current !== next) setOpenSectionIds(remappedIds)
  }, [articleSections, linkPanelRow?.articleId, openSectionIds, setOpenSectionIds])

  useEffect(() => {
    if (!focusedCandidateId) return
    const sectionIds = candidateSectionIdsMap.get(focusedCandidateId) || []
    if (sectionIds.length === 0) return
    setOpenSectionIds((prev) => {
      const merged = new Set(prev)
      sectionIds.forEach((id) => merged.add(id))
      return Array.from(merged)
    })
  }, [focusedCandidateId, candidateSectionIdsMap, setOpenSectionIds])

  return {
    articleSections,
    candidateSectionIdsMap,
    visiblePanelCandidateGroups,
    linkedPanelCandidateGroups,
    unlinkedPanelCandidateGroups,
  }
}
