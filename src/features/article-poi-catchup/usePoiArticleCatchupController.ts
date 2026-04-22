import { useMemo, useRef, useState } from "react"
import {
  useArticlePoiBacklog,
  useArticlePoiManualLink,
  useArticlePoiCreateRl,
  useArticlePoiMarkCandidate,
  useArticlePoiRecompute,
  useArticlePoiRecomputeArticle,
  useArticlePoiRecomputeCandidate,
  useArticlePoiRegionPois,
  useArticlePoiRemoveCandidate,
  useArticlePoiSetScanValidation,
  useArticlePoiUnlink,
  useSiteCategories,
  type ArticlePoiBacklogRow,
} from "@/hooks"
import {
  computeReportingStats,
  decodeHtmlEntities,
  getCandidateSuggestions,
  splitLinkedCandidates,
} from "@/features/article-poi-catchup/domain"
import type { ActionLogEntry, ActionLogLevel } from "@/features/article-poi-catchup/components/ActionLogWidget"

interface ControllerParams {
  siteId?: string
}

export function usePoiArticleCatchupController({ siteId }: ControllerParams) {
  const [category, setCategory] = useState<string>("")
  const [search, setSearch] = useState("")
  const [scanValidationFilter, setScanValidationFilter] = useState<"all" | "validated" | "to_validate">("all")
  const [selectedRlPoiFilter, setSelectedRlPoiFilter] = useState<string>("")
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [actionLogs, setActionLogs] = useState<ActionLogEntry[]>([])
  const [isLogWidgetOpen, setIsLogWidgetOpen] = useState(false)
  const autoCloseTimerRef = useRef<number | null>(null)

  const backlog = useArticlePoiBacklog({
    siteId,
    category: category || undefined,
    page: 1,
    limit: 100,
  })
  const recompute = useArticlePoiRecompute(siteId)
  const recomputeArticle = useArticlePoiRecomputeArticle(siteId)
  const setScanValidation = useArticlePoiSetScanValidation(siteId)
  const recomputeCandidate = useArticlePoiRecomputeCandidate(siteId)
  const markCandidate = useArticlePoiMarkCandidate(siteId)
  const manualLink = useArticlePoiManualLink(siteId)
  const createRl = useArticlePoiCreateRl(siteId)
  const unlinkPoi = useArticlePoiUnlink(siteId)
  const removeCandidate = useArticlePoiRemoveCandidate(siteId)
  const siteCategories = useSiteCategories(siteId)
  const regionPois = useArticlePoiRegionPois({ siteId, limit: 1000 })

  const filteredRows = useMemo(() => {
    const rows = backlog.data?.data || []
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      const candidates = row.detectedCandidates || []
      const { linked } = splitLinkedCandidates(candidates)
      const candidateSuggestions = getCandidateSuggestions(candidates)
      if (scanValidationFilter === "validated" && !row.poiScanValidated) return false
      if (scanValidationFilter === "to_validate" && row.poiScanValidated) return false
      if (selectedRlPoiFilter && !linked.some((candidate) => candidate.rl_place_id === selectedRlPoiFilter)) return false
      if (!q) return true
      return (
        decodeHtmlEntities(row.title).toLowerCase().includes(q) ||
        candidates.some((candidate) => decodeHtmlEntities(candidate.name).toLowerCase().includes(q)) ||
        candidateSuggestions.some((suggestion) => decodeHtmlEntities(suggestion.name).toLowerCase().includes(q))
      )
    })
  }, [backlog.data?.data, scanValidationFilter, search, selectedRlPoiFilter])

  const scanValidationCounts = useMemo(() => {
    const rows = backlog.data?.data || []
    const validated = rows.filter((row) => row.poiScanValidated).length
    return { validated, toValidate: Math.max(0, rows.length - validated) }
  }, [backlog.data?.data])

  const availableLinkedPois = useMemo(() => {
    const rows = backlog.data?.data || []
    const byId = new Map<string, string>()
    rows.forEach((row) => {
      ;(row.detectedCandidates || []).forEach((candidate) => {
        if (!candidate.rl_place_id) return
        if (!byId.has(candidate.rl_place_id)) {
          byId.set(candidate.rl_place_id, decodeHtmlEntities(candidate.rl_place_name || candidate.name || candidate.rl_place_id))
        }
      })
    })
    return Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [backlog.data?.data])

  const reportingStats = useMemo(() => computeReportingStats(backlog.data?.data || []), [backlog.data?.data])

  const mutationPending =
    recompute.isPending ||
    manualLink.isPending ||
    createRl.isPending ||
    unlinkPoi.isPending ||
    setScanValidation.isPending ||
    removeCandidate.isPending ||
    recomputeArticle.isPending ||
    recomputeCandidate.isPending ||
    markCandidate.isPending

  const pushLog = (level: ActionLogLevel, message: string) => {
    const entry: ActionLogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      at: new Date().toISOString(),
      level,
      message,
    }
    setActionLogs((prev) => {
      const next = [entry, ...prev].slice(0, 30)
      const hasBlocking = next.some((log) => log.level === "error" || /warn(ing)?/i.test(log.message))
      if (autoCloseTimerRef.current) {
        window.clearTimeout(autoCloseTimerRef.current)
        autoCloseTimerRef.current = null
      }
      setIsLogWidgetOpen(true)
      if (!hasBlocking) {
        autoCloseTimerRef.current = window.setTimeout(() => {
          setIsLogWidgetOpen(false)
          autoCloseTimerRef.current = null
        }, 5000)
      }
      return next
    })
  }

  const hasBlockingActionLogs = useMemo(
    () => actionLogs.some((log) => log.level === "error" || /warn(ing)?/i.test(log.message)),
    [actionLogs]
  )

  const triggerScanSite = (selectedSiteName: string) => {
    setScanModalOpen(true)
    pushLog("info", `Scan site lancé (${selectedSiteName})`)
    recompute.mutate({ force: false })
  }

  return {
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
    setActionLogs,
    isLogWidgetOpen,
    setIsLogWidgetOpen,
    filteredRows,
    scanValidationCounts,
    availableLinkedPois,
    reportingStats,
    mutationPending,
    hasBlockingActionLogs,
    pushLog,
    triggerScanSite,
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
  }
}

export type PoiArticleCatchupController = ReturnType<typeof usePoiArticleCatchupController>
export type PoiArticleRow = ArticlePoiBacklogRow
