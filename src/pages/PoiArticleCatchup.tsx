import { useEffect, useMemo, useRef, type MouseEvent } from "react"
import { RefreshCw, Search, Sparkles, X, ChevronDown } from "lucide-react"
import { SiteCardsGrid } from "@/components/shared"
import { useSiteContext } from "@/lib/SiteContext"
import {
  type ArticlePoiBacklogRow,
} from "@/hooks"
import { cn } from "@/lib/utils"
import {
  decodeHtmlEntities,
} from "@/features/article-poi-catchup/domain"
import {
  highlightSectionHtmlByCandidates,
  resolveSectionTitleCandidateId,
} from "@/features/article-poi-catchup/articleSectionHtml"
import { useRegionPoiDirectoryOptions } from "@/features/article-poi-catchup/useRegionPoiDirectoryOptions"
import { useArticleDetailSections } from "@/features/article-poi-catchup/useArticleDetailSections"
import { NoSitesMessage } from "@/features/article-poi-catchup/components/NoSitesMessage"
import { ActionLogWidget } from "@/features/article-poi-catchup/components/ActionLogWidget"
import { BacklogTable } from "@/features/article-poi-catchup/components/BacklogTable"
import { usePoiArticleCatchupController } from "@/features/article-poi-catchup/usePoiArticleCatchupController"
import { usePoiCatchupDetailController } from "@/features/article-poi-catchup/usePoiCatchupDetailController"
import { ArticleDetailHeader } from "@/features/article-poi-catchup/components/ArticleDetailHeader"
import { ArticleSectionsPanel } from "@/features/article-poi-catchup/components/ArticleSectionsPanel"
import { CandidateListPanel } from "@/features/article-poi-catchup/components/CandidateListPanel"
import { DetailCandidateCard } from "@/features/article-poi-catchup/components/DetailCandidateCard"
import { AnnuaireModal } from "@/features/article-poi-catchup/components/AnnuaireModal"
import { ScanModal } from "@/features/article-poi-catchup/components/ScanModal"

export function PoiArticleCatchup() {
  const { selectedSite, hasNoSites, isAllSitesSelected, sites, setSelectedSiteId } = useSiteContext()
  const siteId = selectedSite?._id
  const controller = usePoiArticleCatchupController({ siteId })
  const {
    category,
    setCategory,
    search,
    setSearch,
    scanValidationFilter,
    setScanValidationFilter,
    selectedRlPoiFilter,
    setSelectedRlPoiFilter,
    scanModalOpen,
    setScanModalOpen,
    actionLogs,
    isLogWidgetOpen,
    setIsLogWidgetOpen,
    filteredRows,
    scanValidationCounts,
    availableLinkedPois,
    reportingStats,
    mutationPending,
    hasBlockingActionLogs,
    pushLog,
    backlog,
    recompute,
    recomputeArticle,
    setScanValidation,
    recomputeCandidate,
    markCandidate,
    manualLink,
    createRl,
    unlinkPoi,
    removeCandidate,
    siteCategories,
    regionPois,
  } = controller
  const detail = usePoiCatchupDetailController()
  const {
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
    createPoiName,
    setCreatePoiName,
    createPoiType,
    setCreatePoiType,
    createPoiClusterId,
    setCreatePoiClusterId,
    openLinkPanel,
    closeLinkPanel,
    applyLinkedCandidateInPanel,
    applyUnlinkedCandidateInPanel,
    applyRemovedCandidateInPanel,
    applyRecomputedCandidateInPanel,
  } = detail

  const panelCandidateGroups = useMemo(
    () => (linkPanelRow?.detectedCandidates || []),
    [linkPanelRow]
  )
  const linkedRlPlaceIdsInPanel = useMemo(
    () =>
      Array.from(
        new Set(
          panelCandidateGroups
            .map((group) => group.rl_place_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        )
      ),
    [panelCandidateGroups]
  )

  const annuaireModalCandidate = useMemo(
    () => panelCandidateGroups.find((g) => g.candidate_id === annuaireModalCandidateId) || null,
    [panelCandidateGroups, annuaireModalCandidateId]
  )

  const {
    availableClusterNames,
    availableTypeLabels,
    createPoiTypeOptions,
    createPoiClusterOptions,
    filteredRegionPois,
    regionPoiById,
    placeTypeLabelByType,
  } = useRegionPoiDirectoryOptions({
    regionPois: regionPois.data || [],
    regionPoiSearch,
    regionPoiClusterFilter,
    regionPoiTypeFilter,
  })
  const showRegionPoiSearchSpinner = regionPois.isLoading || regionPois.isFetching
  const showRegionPoiLoadingPlaceholder =
    (regionPois.isLoading || regionPois.isFetching) && filteredRegionPois.length === 0
  const unknownMetaLogRef = useRef<Set<string>>(new Set())
  const logUnknownMeta = (
    kind: "linked" | "suggestion",
    candidateId: string,
    rlPlaceId: string,
    reason: "missing_cluster" | "missing_type",
    extra: Record<string, unknown>
  ) => {
    const key = `${kind}:${candidateId}:${rlPlaceId}:${reason}`
    if (unknownMetaLogRef.current.has(key)) return
    unknownMetaLogRef.current.add(key)
    console.warn("[Studio Match POI] Métadonnée RL manquante", {
      reason,
      kind,
      candidateId,
      rlPlaceId,
      siteId,
      articleId: linkPanelRow?.articleId,
      regionPoisLoaded: (regionPois.data || []).length,
      regionPoisLimit: 1000,
      ...extra,
    })
  }
  const {
    articleSections,
    candidateSectionIdsMap,
    visiblePanelCandidateGroups,
    linkedPanelCandidateGroups,
    unlinkedPanelCandidateGroups,
  } = useArticleDetailSections({
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
    backlogRows: backlog.data?.data || [],
  })
  const isDetailView = Boolean(linkPanelRow)

  useEffect(() => {
    if (!linkPanelRow) return
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLinkPanelRow(null)
    }
    window.addEventListener("keydown", onKeydown)
    return () => window.removeEventListener("keydown", onKeydown)
  }, [linkPanelRow])

  if (hasNoSites) return <NoSitesMessage />

  if (isAllSitesSelected || !selectedSite) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-5">
        <div className="bg-white/70 rounded-xl p-6 border border-stone-200">
          <h2 className="font-medium text-stone-800 mb-1">Sélectionne un site</h2>
          <p className="text-sm text-stone-500">
            Le rattrapage POI/article se traite site par site pour rester lisible.
          </p>
        </div>
        <SiteCardsGrid sites={sites} onSelectSite={setSelectedSiteId} selectedSiteId={selectedSite?._id ?? null} />
      </div>
    )
  }

  const handleScanSite = () => {
    setScanModalOpen(true)
    pushLog("info", `Scan site lancé (${selectedSite.name})`)
    recompute.mutate(
      { force: false },
      {
        onSuccess: (res) => {
          pushLog(
            "success",
            `Scan terminé: ${res.summary.refreshed} refresh WP, ${res.summary.updated} recalculés, ${res.summary.needsReview} à revue, ${res.summary.refreshFailed} échecs refresh`
          )
        },
        onError: (error) => {
          pushLog("error", `Scan en erreur: ${error.message}`)
        },
      }
    )
  }

  const triggerRecomputeArticle = (row: ArticlePoiBacklogRow) => {
    const displayTitle = decodeHtmlEntities(row.title)
    pushLog("info", `Relance article lancée: ${displayTitle}`)
    recomputeArticle.mutate(
      { articleId: row.articleId, force: true },
      {
        onSuccess: (res) => {
          if (res.refreshed) {
            setLinkPanelRow((prev) =>
              prev && prev.articleId === row.articleId
                ? {
                    ...prev,
                    poiScanValidated: false,
                    poiScanValidatedAt: null,
                  }
                : prev
            )
          }
          pushLog(
            "success",
            `Relance article terminée (${displayTitle}): ${res.result}, refresh=${res.refreshed ? "ok" : "non"}, ${res.rlPlacesLoaded} POI RL`
          )
        },
        onError: (error) => {
          pushLog("error", `Relance article en erreur (${displayTitle}): ${error.message}`)
        },
      }
    )
  }

  const triggerSetArticleScanValidation = (row: ArticlePoiBacklogRow, validated: boolean) => {
    const displayTitle = decodeHtmlEntities(row.title)
    setScanValidation.mutate(
      { articleId: row.articleId, validated },
      {
        onSuccess: (res) => {
          setLinkPanelRow((prev) =>
            prev && prev.articleId === row.articleId
              ? {
                  ...prev,
                  poiScanValidated: res.poiScanValidated,
                  poiScanValidatedAt: res.poiScanValidatedAt,
                }
              : prev
          )
          pushLog(
            "success",
            `${validated ? "Validation scan activée" : "Validation scan retirée"} (${displayTitle})`
          )
        },
        onError: (error) => {
          pushLog("error", `Validation scan en erreur (${displayTitle}): ${error.message}`)
        },
      }
    )
  }

  const triggerRecomputeCandidate = (
    row: ArticlePoiBacklogRow,
    candidateId: string,
    candidateName: string,
    options?: { suggestionId?: string; suggestionName?: string }
  ) => {
    const displayTitle = decodeHtmlEntities(row.title)
    const displayCandidate = decodeHtmlEntities(candidateName)
    const modeLabel = options?.suggestionId
      ? `ciblé suggestion (${decodeHtmlEntities(options.suggestionName || options.suggestionId)})`
      : "candidat uniquement"
    pushLog("info", `Relance ${modeLabel} lancée: ${displayTitle} · ${displayCandidate}`)
    setRecomputeCandidateInFlightId(candidateId)
    recomputeCandidate.mutate(
      {
        articleId: row.articleId,
        candidateId,
        refreshFromWp: false,
        onlySuggestionRlPlaceId: options?.suggestionId,
      },
      {
        onSuccess: (res) => {
          applyRecomputedCandidateInPanel(candidateId, res.candidate)
          void backlog.refetch()
          pushLog(
            "success",
            `Relance ${modeLabel} terminée (${displayCandidate}): ${res.suggestionsCount} suggestion(s), RL chargés=${res.rlPlacesLoaded}`
          )
        },
        onError: (error) => {
          pushLog("error", `Relance ${modeLabel} en erreur (${displayCandidate}): ${error.message}`)
        },
        onSettled: () => {
          setRecomputeCandidateInFlightId(null)
        },
      }
    )
  }

  const handleSectionSelection = (sectionId: string, sectionTitle: string, event: MouseEvent<HTMLElement>) => {
    const container = event.currentTarget as HTMLElement
    const selection = window.getSelection()
    const selectedText = selection?.toString().replace(/\s+/g, " ").trim() || ""
    if (!selectedText || selectedText.length < 3) {
      setManualCandidateDraft((prev) => (prev?.sectionId === sectionId ? null : prev))
      return
    }
    const anchorNode = selection?.anchorNode
    const isInsideSection = !!anchorNode && container.contains(anchorNode)
    if (!isInsideSection) return
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    const rect = range?.getBoundingClientRect()
    const anchorX = rect ? rect.left + rect.width / 2 : event.clientX
    const anchorY = rect ? rect.top : event.clientY
    setManualCandidateDraft({
      name: selectedText.slice(0, 90),
      sectionId,
      sectionTitle: decodeHtmlEntities(sectionTitle || "").trim(),
      anchorX,
      anchorY,
    })
  }

  const markCandidateFromSelection = () => {
    if (!linkPanelRow || !manualCandidateDraft) return
    const candidateName = manualCandidateDraft.name.trim()
    if (!candidateName) return
    pushLog("info", `Marquage candidat: ${candidateName}`)
    markCandidate.mutate(
      {
        articleId: linkPanelRow.articleId,
        candidateName,
        sectionTitle: manualCandidateDraft.sectionTitle,
        source: "body",
      },
      {
        onSuccess: (res) => {
          applyRecomputedCandidateInPanel(res.candidateId, res.candidate)
          setSelectedCandidateId(res.candidateId)
          setFocusedCandidateId(res.candidateId)
          setManualCandidateDraft(null)
          void backlog.refetch()
          pushLog("success", `Candidat marqué et scanné: ${candidateName} (${res.suggestionsCount} suggestion(s))`)
        },
        onError: (error) => {
          pushLog("error", `Erreur marquage candidat (${candidateName}): ${error.message}`)
        },
      }
    )
  }

  const expandAllSections = () => {
    setOpenSectionIds(articleSections.map((section) => section.id))
  }

  const collapseAllSections = () => {
    setOpenSectionIds([])
  }

  const toggleSection = (sectionId: string) => {
    setOpenSectionIds((prev) => (prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]))
  }

  const handleSectionContentClick = (sectionId: string, event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null
    if (!target) return
    const anchor = target.closest("a") as HTMLAnchorElement | null
    const image = target.closest("img[data-preview-src]") as HTMLImageElement | null
    const src = image?.getAttribute("data-preview-src")
    if (src) {
      if (anchor) {
        event.preventDefault()
        event.stopPropagation()
      }
      setImagePreviewSrc(src)
      return
    }
    const mark = target.closest("mark[data-candidate-id]") as HTMLElement | null
    const candidateId = mark?.getAttribute("data-candidate-id")
    if (candidateId) {
      if (anchor) {
        event.preventDefault()
        event.stopPropagation()
      }
      const nextFocusedCandidateId = focusedCandidateId === candidateId ? null : candidateId
      setFocusedCandidateId(nextFocusedCandidateId)
      setSelectedCandidateId(candidateId)
      setOpenSectionIds((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]))
      return
    }
    if (anchor) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!isDetailView ? (
          <div>
            <h1 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-orange-500" />
              Studio Match POI
            </h1>
            <p className="text-sm text-stone-500 mt-1">{`${selectedSite.name} · articles, suggestions RL, liaisons validées`}</p>
          </div>
        ) : (
          <div />
        )}
        {!isDetailView ? (
          <button
            type="button"
            onClick={handleScanSite}
            disabled={recompute.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4", recompute.isPending && "animate-spin")} />
            Scanner tout le site
          </button>
        ) : null}
      </div>

      {!isDetailView && <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <div className="text-xs text-stone-500">Articles (catégorie en cours)</div>
          <div className="text-lg font-semibold text-stone-800">{reportingStats.articlesCount}</div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <div className="text-xs text-stone-500">Articles rapprochés à l'annuaire</div>
          <div className="text-lg font-semibold text-stone-800">{reportingStats.articlesMatchedToDirectory}</div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <div className="text-xs text-stone-500">POI RL uniques associés</div>
          <div className="text-lg font-semibold text-emerald-700">{reportingStats.uniqueLinkedRlPoiCount}</div>
        </div>
      </div>}

      {!isDetailView && <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setScanValidationFilter("all")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-lg border",
            scanValidationFilter === "all" ? "bg-emerald-100 border-emerald-200 text-emerald-800" : "bg-white border-stone-200 text-stone-600"
          )}
        >
          Tous ({backlog.data?.total ?? 0})
        </button>
        <button
          type="button"
          onClick={() => setScanValidationFilter("validated")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-lg border",
            scanValidationFilter === "validated"
              ? "bg-emerald-100 border-emerald-200 text-emerald-800"
              : "bg-white border-stone-200 text-stone-600"
          )}
        >
          Articles validés scan POI ({scanValidationCounts.validated})
        </button>
        <button
          type="button"
          onClick={() => setScanValidationFilter("to_validate")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-lg border",
            scanValidationFilter === "to_validate"
              ? "bg-amber-100 border-amber-200 text-amber-800"
              : "bg-white border-stone-200 text-stone-600"
          )}
        >
          À valider ({scanValidationCounts.toValidate})
        </button>
      </div>}

      {!isDetailView && <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un article ou un POI"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
            />
          </div>
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
        >
          <option value="">Toutes les catégories</option>
          {(siteCategories.data || []).map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          value={selectedRlPoiFilter}
          onChange={(e) => setSelectedRlPoiFilter(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
        >
          <option value="">Tous les POI RL liés</option>
          {availableLinkedPois.map((poi) => (
            <option key={poi.id} value={poi.id}>
              {poi.name}
            </option>
          ))}
        </select>
      </div>}

      {!isDetailView && backlog.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(backlog.error as Error).message}
        </div>
      )}

      {!isDetailView && backlog.isLoading ? (
        <div className="text-sm text-stone-500">Chargement du backlog…</div>
      ) : !linkPanelRow ? (
        <BacklogTable
          rows={filteredRows}
          mutationPending={mutationPending}
          onRecomputeArticle={triggerRecomputeArticle}
          onOpenDetail={openLinkPanel}
        />
      ) : null}

      {linkPanelRow && (
        <div className="bg-transparent">
          <ArticleDetailHeader
            row={linkPanelRow}
            mutationPending={mutationPending}
            recomputePending={recomputeArticle.isPending}
            onRecomputeArticle={() => triggerRecomputeArticle(linkPanelRow)}
            onToggleScanValidation={() => triggerSetArticleScanValidation(linkPanelRow, !linkPanelRow.poiScanValidated)}
            onBack={closeLinkPanel}
          />

          <div className="p-0">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
                <div className="xl:col-span-8 space-y-2">
                  <ArticleSectionsPanel
                    title={linkPanelRow.title}
                    articleUrl={linkPanelRow.articleUrl}
                    focusedCandidateId={focusedCandidateId}
                    onResetFocus={() => setFocusedCandidateId(null)}
                    onExpandAll={expandAllSections}
                    onCollapseAll={collapseAllSections}
                    canExpandAll={articleSections.length > 0 && openSectionIds.length !== articleSections.length}
                    canCollapseAll={openSectionIds.length > 0}
                    markPending={markCandidate.isPending}
                    mutationPending={mutationPending}
                    manualDraft={
                      manualCandidateDraft
                        ? { name: manualCandidateDraft.name, anchorX: manualCandidateDraft.anchorX, anchorY: manualCandidateDraft.anchorY }
                        : null
                    }
                    onMarkDraft={markCandidateFromSelection}
                    onCloseDraft={() => setManualCandidateDraft(null)}
                  >
                      {articleSections.map((section) => {
                        const isOpen = openSectionIds.includes(section.id)
                        const sectionCandidates = panelCandidateGroups.filter((group) => section.candidateIds.includes(group.candidate_id))
                        const highlightedHtml = highlightSectionHtmlByCandidates(section.html, sectionCandidates, focusedCandidateId)
                        const titleCandidateId = resolveSectionTitleCandidateId(section.title, sectionCandidates)
                        return (
                          <div key={section.id} className="rounded border border-stone-200/80 bg-white overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleSection(section.id)}
                              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-stone-50"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-stone-800 truncate">
                                  {titleCandidateId ? (
                                    <span
                                      className={
                                        focusedCandidateId === titleCandidateId
                                          ? "inline rounded px-1 !bg-orange-300 !text-orange-950 ring-1 ring-orange-400"
                                          : "inline rounded px-1 !bg-yellow-200 !text-stone-900 ring-1 ring-yellow-300"
                                      }
                                    >
                                      {decodeHtmlEntities(section.title)}
                                    </span>
                                  ) : (
                                    decodeHtmlEntities(section.title)
                                  )}
                                </div>
                                <div className="text-[11px] text-stone-500">
                                  {section.candidateIds.length} candidat(s) · {section.suggestionCount} suggestion(s)
                                </div>
                              </div>
                              <ChevronDown className={cn("h-4 w-4 text-stone-500 transition-transform", isOpen && "rotate-180")} />
                            </button>
                            {isOpen ? (
                              <div
                                className="px-2.5 pb-2 prose prose-sm max-w-none"
                                onClick={(event) => handleSectionContentClick(section.id, event)}
                                onMouseUp={(event) => handleSectionSelection(section.id, section.title, event)}
                                dangerouslySetInnerHTML={{ __html: highlightedHtml || "<p>Section vide.</p>" }}
                              />
                            ) : null}
                          </div>
                        )
                      })}
                  </ArticleSectionsPanel>
                </div>

                <div className="xl:col-span-4 space-y-2">
                  <CandidateListPanel
                    linkedCount={linkedPanelCandidateGroups.length}
                    unlinkedCount={unlinkedPanelCandidateGroups.length}
                    hasVisibleCandidates={visiblePanelCandidateGroups.length > 0}
                  >
                    {[...linkedPanelCandidateGroups, ...unlinkedPanelCandidateGroups].map((group, index) => {
                      const firstUnlinkedIndex = linkedPanelCandidateGroups.length
                      const showUnlinkedHeader =
                        unlinkedPanelCandidateGroups.length > 0 && index === firstUnlinkedIndex
                      const expanded = !!expandedCandidateInfo[group.candidate_id]
                      return (
                        <DetailCandidateCard
                          key={group.candidate_id}
                          group={group}
                          expanded={expanded}
                          mutationPending={mutationPending}
                          recomputePending={
                            recomputeCandidate.isPending &&
                            recomputeCandidateInFlightId === group.candidate_id
                          }
                          unlinkConfirmOpen={unlinkConfirmCandidateId === group.candidate_id}
                          removeConfirmOpen={removeConfirmCandidateId === group.candidate_id}
                          linkedRlPlaceIdsInPanel={linkedRlPlaceIdsInPanel}
                          regionPoiById={regionPoiById}
                          placeTypeLabelByType={placeTypeLabelByType}
                          showUnlinkedHeader={showUnlinkedHeader}
                          showSuggestionHeader={showUnlinkedHeader}
                          logUnknownMeta={logUnknownMeta}
                          onFocusCandidate={(candidateId) => {
                            setSelectedCandidateId(candidateId)
                            setFocusedCandidateId(candidateId)
                            const candidateSectionIds = candidateSectionIdsMap.get(candidateId) || []
                            if (candidateSectionIds.length > 0) {
                              setOpenSectionIds((prev) => {
                                const merged = new Set(prev)
                                candidateSectionIds.forEach((id: string) => merged.add(id))
                                return Array.from(merged)
                              })
                            }
                          }}
                          onToggleInfo={(candidateId) =>
                            setExpandedCandidateInfo((prev) => ({
                              ...prev,
                              [candidateId]: !prev[candidateId],
                            }))
                          }
                          onRecomputeCandidate={(candidate) =>
                            triggerRecomputeCandidate(linkPanelRow, candidate.candidate_id, candidate.name)
                          }
                          onOpenAnnuaire={(candidate) => {
                            setSelectedCandidateId(candidate.candidate_id)
                            setAnnuaireModalCandidateId(candidate.candidate_id)
                            setSelectedRegionPoi(null)
                            setCreatePoiName(decodeHtmlEntities(candidate.name))
                            setCreatePoiType("")
                            setCreatePoiClusterId("")
                          }}
                          onToggleUnlinkConfirm={(candidateId) =>
                            setUnlinkConfirmCandidateId((prev) =>
                              prev === candidateId ? null : candidateId
                            )
                          }
                          onConfirmUnlink={(candidate) =>
                            unlinkPoi.mutate(
                              {
                                articleId: linkPanelRow.articleId,
                                candidateId: candidate.candidate_id,
                              },
                              {
                                onSuccess: () => {
                                  setUnlinkConfirmCandidateId(null)
                                  applyUnlinkedCandidateInPanel(candidate.candidate_id)
                                  void backlog.refetch()
                                  pushLog(
                                    "success",
                                    `Liaison retirée (${decodeHtmlEntities(linkPanelRow.title)}) · candidat ${decodeHtmlEntities(candidate.name)}`
                                  )
                                },
                                onError: (error) =>
                                  pushLog(
                                    "error",
                                    `Erreur retrait liaison (${decodeHtmlEntities(linkPanelRow.title)}): ${error.message}`
                                  ),
                              }
                            )
                          }
                          onToggleRemoveConfirm={(candidateId) =>
                            setRemoveConfirmCandidateId((prev) =>
                              prev === candidateId ? null : candidateId
                            )
                          }
                          onConfirmRemove={(candidate) =>
                            removeCandidate.mutate(
                              {
                                articleId: linkPanelRow.articleId,
                                candidateId: candidate.candidate_id,
                              },
                              {
                                onSuccess: () => {
                                  setRemoveConfirmCandidateId(null)
                                  setUnlinkConfirmCandidateId(null)
                                  applyRemovedCandidateInPanel(candidate.candidate_id)
                                  pushLog(
                                    "success",
                                    `Candidat supprimé (${decodeHtmlEntities(linkPanelRow.title)}) · ${decodeHtmlEntities(candidate.name)}`
                                  )
                                },
                                onError: (error) =>
                                  pushLog(
                                    "error",
                                    `Erreur suppression candidat (${decodeHtmlEntities(linkPanelRow.title)}): ${error.message}`
                                  ),
                              }
                            )
                          }
                          onSuggestionLink={({ group: selectedGroup, suggestion, typeLabel, clusterLabel }) =>
                            manualLink.mutate(
                              {
                                articleId: linkPanelRow.articleId,
                                rlPlaceId: suggestion.rl_place_id,
                                rlPlaceName: suggestion.name,
                                placeType: suggestion.place_type,
                                placeTypeLabelFr: typeLabel,
                                clusterId: suggestion.cluster_id,
                                clusterName: clusterLabel,
                                candidateId: selectedGroup.candidate_id,
                                confidence: "high",
                                score: suggestion.score ?? 1,
                                validated: true,
                              },
                              {
                                onSuccess: (res) => {
                                  if (res.duplicate_link_prevented && res.existingCandidateId) {
                                    applyLinkedCandidateInPanel({
                                      candidateId: res.existingCandidateId,
                                      rlPlaceId: suggestion.rl_place_id,
                                      rlPlaceName: suggestion.name,
                                      placeType: suggestion.place_type,
                                      placeTypeLabelFr: typeLabel,
                                      clusterId: suggestion.cluster_id,
                                      clusterName: clusterLabel,
                                    })
                                    pushLog(
                                      "info",
                                      `POI déjà lié sur cet article, liaison conservée (${decodeHtmlEntities(linkPanelRow.title)})`
                                    )
                                  } else {
                                    applyLinkedCandidateInPanel({
                                      candidateId: selectedGroup.candidate_id,
                                      rlPlaceId: suggestion.rl_place_id,
                                      rlPlaceName: suggestion.name,
                                      placeType: suggestion.place_type,
                                      placeTypeLabelFr: typeLabel,
                                      clusterId: suggestion.cluster_id,
                                      clusterName: clusterLabel,
                                    })
                                  }
                                  void backlog.refetch()
                                  pushLog(
                                    "success",
                                    `Liaison OK (${decodeHtmlEntities(linkPanelRow.title)}) -> ${suggestion.rl_place_id}`
                                  )
                                },
                                onError: (error) =>
                                  pushLog(
                                    "error",
                                    `Erreur liaison manuelle (${decodeHtmlEntities(linkPanelRow.title)}): ${error.message}`
                                  ),
                              }
                            )
                          }
                        />
                      )
                    })}
                  </CandidateListPanel>
                </div>
              </div>
          </div>
        </div>
      )}

      <AnnuaireModal
        open={Boolean(annuaireModalCandidateId && annuaireModalCandidate && linkPanelRow)}
        candidateName={annuaireModalCandidate?.name || ""}
        articleTitle={linkPanelRow?.title || ""}
        regionPoiSearch={regionPoiSearch}
        onRegionPoiSearchChange={setRegionPoiSearch}
        regionPoiClusterFilter={regionPoiClusterFilter}
        onRegionPoiClusterFilterChange={setRegionPoiClusterFilter}
        regionPoiTypeFilter={regionPoiTypeFilter}
        onRegionPoiTypeFilterChange={setRegionPoiTypeFilter}
        availableClusterNames={availableClusterNames}
        availableTypeLabels={availableTypeLabels}
        filteredRegionPois={filteredRegionPois}
        linkedRlPlaceIds={linkedRlPlaceIdsInPanel}
        showRegionPoiSearchSpinner={showRegionPoiSearchSpinner}
        showRegionPoiLoadingPlaceholder={showRegionPoiLoadingPlaceholder}
        selectedRegionPoi={selectedRegionPoi}
        onSelectRegionPoi={setSelectedRegionPoi}
        mutationPending={mutationPending}
        createPoiName={createPoiName}
        onCreatePoiNameChange={setCreatePoiName}
        createPoiType={createPoiType}
        onCreatePoiTypeChange={setCreatePoiType}
        createPoiTypeOptions={createPoiTypeOptions}
        createPoiClusterId={createPoiClusterId}
        onCreatePoiClusterIdChange={setCreatePoiClusterId}
        createPoiClusterOptions={createPoiClusterOptions}
        onClose={() => {
          setAnnuaireModalCandidateId(null)
          setCreatePoiName("")
          setCreatePoiType("")
          setCreatePoiClusterId("")
        }}
        onValidateLink={() => {
          if (!linkPanelRow || !selectedRegionPoi?.rl_place_id) return
          manualLink.mutate(
            {
              articleId: linkPanelRow.articleId,
              rlPlaceId: selectedRegionPoi.rl_place_id,
              rlPlaceName: selectedRegionPoi?.name || undefined,
              placeType: selectedRegionPoi?.place_type,
              placeTypeLabelFr: selectedRegionPoi?.place_type_label_fr,
              clusterName: selectedRegionPoi?.cluster_name,
              candidateId: annuaireModalCandidate?.candidate_id || undefined,
              confidence: "high",
              score: 1,
              validated: true,
            },
            {
              onSuccess: (res) => {
                if (annuaireModalCandidate?.candidate_id && selectedRegionPoi?.rl_place_id) {
                  applyLinkedCandidateInPanel({
                    candidateId: annuaireModalCandidate.candidate_id,
                    rlPlaceId: selectedRegionPoi.rl_place_id,
                    rlPlaceName: selectedRegionPoi.name,
                    placeType: selectedRegionPoi.place_type,
                    placeTypeLabelFr: selectedRegionPoi.place_type_label_fr,
                    clusterName: selectedRegionPoi.cluster_name,
                  })
                }
                void backlog.refetch()
                if (res.duplicate_link_prevented) {
                  pushLog(
                    "info",
                    `POI déjà lié sur cet article, liaison conservée (${decodeHtmlEntities(linkPanelRow.title)})`
                  )
                }
                pushLog(
                  "success",
                  `Liaison OK (${decodeHtmlEntities(linkPanelRow.title)}) -> ${selectedRegionPoi?.rl_place_id || ""}`
                )
                setAnnuaireModalCandidateId(null)
                setCreatePoiName("")
                setCreatePoiType("")
                setCreatePoiClusterId("")
              },
              onError: (error) =>
                pushLog("error", `Erreur liaison manuelle (${decodeHtmlEntities(linkPanelRow.title)}): ${error.message}`),
            }
          )
        }}
        onCreatePoi={() => {
          if (!linkPanelRow || !annuaireModalCandidate || !createPoiName.trim() || !createPoiType.trim() || !createPoiClusterId.trim()) return
          const selectedCluster = createPoiClusterOptions.find((option) => option.value === createPoiClusterId)
          createRl.mutate(
            {
              articleId: linkPanelRow.articleId,
              candidateId: annuaireModalCandidate.candidate_id,
              placeName: createPoiName.trim(),
              placeType: createPoiType.trim(),
              clusterId: createPoiClusterId.trim(),
              clusterName: selectedCluster?.label,
            },
            {
              onSuccess: (result) => {
                if (result.createdRlPlaceId && !result.duplicate_link_prevented) {
                  const createdTypeLabel =
                    placeTypeLabelByType.get(createPoiType.trim().toLowerCase()) || createPoiType.trim()
                  applyLinkedCandidateInPanel({
                    candidateId: annuaireModalCandidate.candidate_id,
                    rlPlaceId: result.createdRlPlaceId,
                    rlPlaceName: createPoiName.trim(),
                    placeType: createPoiType.trim(),
                    placeTypeLabelFr: createdTypeLabel,
                    clusterId: createPoiClusterId.trim(),
                    clusterName: selectedCluster?.label,
                  })
                }
                if (result.duplicate_link_prevented) {
                  pushLog(
                    "info",
                    `POI déjà lié sur cet article, liaison conservée (${decodeHtmlEntities(linkPanelRow.title)})`
                  )
                }
                void backlog.refetch()
                pushLog(
                  "success",
                  `POI créé et lié (${decodeHtmlEntities(linkPanelRow.title)}) -> ${result.createdRlPlaceId || "N/A"}`
                )
                setAnnuaireModalCandidateId(null)
                setCreatePoiName("")
                setCreatePoiType("")
                setCreatePoiClusterId("")
              },
              onError: (error) =>
                pushLog("error", `Erreur création POI (${decodeHtmlEntities(linkPanelRow.title)}): ${error.message}`),
            }
          )
        }}
      />

      {imagePreviewSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setImagePreviewSrc(null)}
        >
          <div
            className="relative max-w-[90vw] max-h-[90vh] bg-white rounded-lg overflow-hidden shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setImagePreviewSrc(null)}
              className="absolute top-2 right-2 inline-flex items-center justify-center h-8 w-8 rounded bg-black/60 text-white hover:bg-black/75"
              aria-label="Fermer aperçu image"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={imagePreviewSrc}
              alt="Aperçu"
              className="block max-w-[90vw] max-h-[90vh] object-contain bg-white"
            />
          </div>
        </div>
      )}

      <ActionLogWidget
        logs={actionLogs}
        isOpen={isLogWidgetOpen}
        hasBlockingLogs={hasBlockingActionLogs}
        onOpen={() => setIsLogWidgetOpen(true)}
        onClose={() => setIsLogWidgetOpen(false)}
      />

      <ScanModal
        open={scanModalOpen}
        siteName={selectedSite.name}
        isPending={recompute.isPending}
        isError={recompute.isError}
        errorMessage={recompute.isError ? (recompute.error as Error).message : undefined}
        summary={recompute.data?.summary || null}
        logs={actionLogs}
        onClose={() => setScanModalOpen(false)}
      />

    </div>
  )
}
