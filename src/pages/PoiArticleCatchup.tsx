import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { RefreshCw, Settings, Search, Link2, Sparkles, Loader2, PanelRight, X, Info } from "lucide-react"
import { SiteCardsGrid } from "@/components/shared"
import { useSiteContext } from "@/lib/SiteContext"
import {
  useArticlePoiBacklog,
  useArticlePoiManualLink,
  useArticlePoiRecompute,
  useArticlePoiRecomputeArticle,
  useArticlePoiRegionPois,
  useSiteCategories,
  type PoiAssociationStatus,
  type ArticlePoiBacklogRow,
} from "@/hooks"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<PoiAssociationStatus, string> = {
  pending: "A traiter",
  needs_review: "A revoir",
  linked: "Associé",
  created: "Créé RL",
  ignored: "Ignoré",
}

type ActionLogLevel = "info" | "success" | "error"

interface ActionLogEntry {
  id: string
  at: string
  level: ActionLogLevel
  message: string
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&rsquo;|&#8217;|&#x2019;/g, "'")
    .replace(/&#8216;|&#x2018;/g, "'")
    .replace(/&#8220;|&#8221;|&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
}

function formatLogTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("fr-FR")
}

function highlightHtmlByTerms(html: string, terms: string[]): string {
  const source = html || ""
  if (!source) return source
  const tokens = Array.from(new Set(terms.map((t) => decodeHtmlEntities(t).trim()).filter((t) => t.length >= 3))).sort(
    (a, b) => b.length - a.length
  )
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return source

  const parser = new DOMParser()
  const doc = parser.parseFromString(source, "text/html")

  doc.body.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") || ""
    if (!src) return
    img.setAttribute("data-preview-src", src)
    img.setAttribute("style", "max-width:200px;width:100%;height:auto;cursor:zoom-in;display:block;margin:8px 0;")
    img.setAttribute("loading", "lazy")
  })

  if (tokens.length === 0) return doc.body.innerHTML
  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  if (!escaped) return doc.body.innerHTML

  const regex = new RegExp(`(${escaped})`, "gi")
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let node = walker.nextNode()
  while (node) {
    textNodes.push(node as Text)
    node = walker.nextNode()
  }

  textNodes.forEach((textNode) => {
    const parentTag = textNode.parentElement?.tagName.toLowerCase()
    if (parentTag === "script" || parentTag === "style" || parentTag === "noscript" || parentTag === "mark") return
    const textValue = textNode.nodeValue || ""
    if (!textValue || !regex.test(textValue)) return

    regex.lastIndex = 0
    const frag = doc.createDocumentFragment()
    let lastIndex = 0
    textValue.replace(regex, (match, _group, offset) => {
      if (offset > lastIndex) frag.appendChild(doc.createTextNode(textValue.slice(lastIndex, offset)))
      const mark = doc.createElement("mark")
      mark.className = "bg-yellow-200 text-stone-900 rounded px-0.5"
      mark.textContent = match
      frag.appendChild(mark)
      lastIndex = offset + match.length
      return match
    })
    if (lastIndex < textValue.length) frag.appendChild(doc.createTextNode(textValue.slice(lastIndex)))
    textNode.parentNode?.replaceChild(frag, textNode)
  })

  return doc.body.innerHTML
}

function NoSitesMessage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Settings className="h-8 w-8 text-orange-500" />
        </div>
        <h2 className="text-lg font-medium text-stone-800 mb-2">Aucun site WordPress configuré</h2>
        <p className="text-stone-500 mb-6">Configure un site WordPress pour lancer le rattrapage POI/article.</p>
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          Configurer un site
        </Link>
      </div>
    </div>
  )
}

export function PoiArticleCatchup() {
  const { selectedSite, hasNoSites, isAllSitesSelected, sites, setSelectedSiteId } = useSiteContext()
  const siteId = selectedSite?._id
  const [status, setStatus] = useState<PoiAssociationStatus | undefined>("needs_review")
  const [category, setCategory] = useState<string>("")
  const [search, setSearch] = useState("")
  const [linkState, setLinkState] = useState<"all" | "linked" | "unlinked">("all")
  const [linkPanelRow, setLinkPanelRow] = useState<ArticlePoiBacklogRow | null>(null)
  const [regionPoiSearch, setRegionPoiSearch] = useState("")
  const [regionPoiClusterFilter, setRegionPoiClusterFilter] = useState("")
  const [regionPoiTypeFilter, setRegionPoiTypeFilter] = useState("")
  const [selectedRegionPoi, setSelectedRegionPoi] = useState<{
    rl_place_id: string
    name: string
    confidenceScore?: number
  } | null>(null)
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [expandedCandidateInfo, setExpandedCandidateInfo] = useState<Record<string, boolean>>({})
  const [detailRightTab, setDetailRightTab] = useState<"matching" | "directory">("matching")
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [actionLogs, setActionLogs] = useState<ActionLogEntry[]>([])

  const backlog = useArticlePoiBacklog({
    siteId,
    status,
    category: category || undefined,
    page: 1,
    limit: 100,
  })
  const recompute = useArticlePoiRecompute(siteId)
  const recomputeArticle = useArticlePoiRecomputeArticle(siteId)
  const manualLink = useArticlePoiManualLink(siteId)
  const siteCategories = useSiteCategories(siteId)
  const regionPois = useArticlePoiRegionPois({ siteId, q: regionPoiSearch, limit: 120 })

  const filteredRows = useMemo(() => {
    const rows = backlog.data?.data || []
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      const isLinked = !!(row.hasLinkedPoi ?? row.association?.rl_place_id)
      if (linkState === "linked" && !isLinked) return false
      if (linkState === "unlinked" && isLinked) return false
      if (!q) return true
      return (
        decodeHtmlEntities(row.title).toLowerCase().includes(q) ||
        decodeHtmlEntities(row.candidateName).toLowerCase().includes(q) ||
        (row.rlSuggestions || row.suggestions).some((s) => decodeHtmlEntities(s.name).toLowerCase().includes(q)) ||
        (row.detectedCandidates || row.candidateGroups).some((g) => decodeHtmlEntities(g.name).toLowerCase().includes(q))
      )
    })
  }, [backlog.data?.data, linkState, search])

  const panelCandidateGroups = useMemo(
    () => (linkPanelRow?.detectedCandidates || linkPanelRow?.candidateGroups || []),
    [linkPanelRow]
  )

  const selectedCandidate = useMemo(
    () => panelCandidateGroups.find((g) => g.candidate_id === selectedCandidateId) || panelCandidateGroups[0],
    [panelCandidateGroups, selectedCandidateId]
  )

  const availableClusterNames = useMemo(
    () =>
      Array.from(
        new Set(
          (regionPois.data || [])
            .flatMap((poi) => poi.cluster_names || [])
            .map((name) => decodeHtmlEntities(name).trim())
            .filter((name) => name.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [regionPois.data]
  )

  const availableTypeLabels = useMemo(
    () =>
      Array.from(
        new Set(
          (regionPois.data || []).map((poi) =>
            decodeHtmlEntities(poi.place_type_label_fr || poi.place_type || "Autre").trim()
          )
        )
      ).sort((a, b) => a.localeCompare(b)),
    [regionPois.data]
  )

  const filteredRegionPois = useMemo(() => {
    const rows = regionPois.data || []
    const q = regionPoiSearch.trim().toLowerCase()
    return rows.filter((poi) => {
      const placeTypeLabel = decodeHtmlEntities(poi.place_type_label_fr || poi.place_type || "").toLowerCase()
      const clusterNames = (poi.cluster_names || []).map((name) => decodeHtmlEntities(name))
      if (regionPoiClusterFilter && !clusterNames.includes(regionPoiClusterFilter)) return false
      if (regionPoiTypeFilter && placeTypeLabel !== regionPoiTypeFilter.toLowerCase()) return false
      if (!q) return true
      return (
        decodeHtmlEntities(poi.name).toLowerCase().includes(q) ||
        placeTypeLabel.includes(q) ||
        decodeHtmlEntities(poi.place_type || "").toLowerCase().includes(q) ||
        clusterNames.some((name) => name.toLowerCase().includes(q)) ||
        poi.rl_place_id.toLowerCase().includes(q)
      )
    })
  }, [regionPois.data, regionPoiSearch, regionPoiClusterFilter, regionPoiTypeFilter])
  const candidateHighlightTerms = useMemo(
    () => panelCandidateGroups.map((group) => group.name).filter((name) => (name || "").trim().length > 0),
    [panelCandidateGroups]
  )
  const highlightedArticleHtml = useMemo(
    () => highlightHtmlByTerms(linkPanelRow?.htmlCleaned || linkPanelRow?.htmlBrut || "", candidateHighlightTerms),
    [linkPanelRow?.htmlCleaned, linkPanelRow?.htmlBrut, candidateHighlightTerms]
  )
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

  const mutationPending = recompute.isPending || manualLink.isPending || recomputeArticle.isPending

  const pushLog = (level: ActionLogLevel, message: string) => {
    const entry: ActionLogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      at: new Date().toISOString(),
      level,
      message,
    }
    setActionLogs((prev) => [entry, ...prev].slice(0, 30))
  }

  const openLinkPanel = (row: ArticlePoiBacklogRow) => {
    setLinkPanelRow(row)
    const groups = row.detectedCandidates || row.candidateGroups || []
    const initialCandidateId =
      row.association?.candidate_id ||
      groups[0]?.candidate_id ||
      null
    setSelectedCandidateId(initialCandidateId)
    setRegionPoiSearch("")
    setRegionPoiClusterFilter("")
    setRegionPoiTypeFilter("")
    setDetailRightTab("matching")
    setSelectedRegionPoi(null)
    setExpandedCandidateInfo({})
  }

  const closeLinkPanel = () => {
    setLinkPanelRow(null)
    setSelectedRegionPoi(null)
    setImagePreviewSrc(null)
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

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            {isDetailView ? "Détail liaison POI/article" : "Studio Match POI"}
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {isDetailView && linkPanelRow
              ? `${selectedSite.name} · Article en cours: ${decodeHtmlEntities(linkPanelRow.title)}`
              : `${selectedSite.name} · articles, suggestions RL, liaisons validées`}
          </p>
        </div>
        {isDetailView ? (
          <button
            type="button"
            onClick={closeLinkPanel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-200 bg-white text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Retour à la liste
          </button>
        ) : (
          <button
            type="button"
            onClick={handleScanSite}
            disabled={recompute.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4", recompute.isPending && "animate-spin")} />
            Scanner tout le site
          </button>
        )}
      </div>

      {!isDetailView && recompute.data?.summary && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          Scan terminé · {recompute.data.summary.refreshed} contenus refresh WP · {recompute.data.summary.updated} matching recalculés ·{" "}
          {recompute.data.summary.needsReview} à revue
        </div>
      )}

      {!isDetailView && <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <div className="text-xs text-stone-500">Articles backlog</div>
          <div className="text-lg font-semibold text-stone-800">{backlog.data?.total ?? 0}</div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <div className="text-xs text-stone-500">Avec POI lié</div>
          <div className="text-lg font-semibold text-stone-800">{backlog.data?.summary?.withLinkedPoi ?? 0}</div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <div className="text-xs text-stone-500">Sans POI lié</div>
          <div className="text-lg font-semibold text-stone-800">{backlog.data?.summary?.withoutLinkedPoi ?? 0}</div>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-3">
          <div className="text-xs text-stone-500">Candidats détectés</div>
          <div className="text-lg font-semibold text-stone-800">{backlog.data?.summary?.detectedCandidates ?? 0}</div>
        </div>
      </div>}

      {!isDetailView && <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatus(undefined)}
          className={cn("px-3 py-1.5 text-sm rounded-lg border", !status ? "bg-orange-100 border-orange-200 text-orange-800" : "bg-white border-stone-200 text-stone-600")}
        >
          Tous ({backlog.data?.total ?? 0})
        </button>
        {(Object.keys(STATUS_LABELS) as PoiAssociationStatus[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(key)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg border",
              status === key ? "bg-orange-100 border-orange-200 text-orange-800" : "bg-white border-stone-200 text-stone-600"
            )}
          >
            {STATUS_LABELS[key]} ({backlog.data?.summary?.[key] || 0})
          </button>
        ))}
      </div>}

      {!isDetailView && <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setLinkState("all")}
          className={cn("px-3 py-1.5 text-sm rounded-lg border", linkState === "all" ? "bg-orange-100 border-orange-200 text-orange-800" : "bg-white border-stone-200 text-stone-600")}
        >
          Tous
        </button>
        <button
          type="button"
          onClick={() => setLinkState("linked")}
          className={cn("px-3 py-1.5 text-sm rounded-lg border", linkState === "linked" ? "bg-orange-100 border-orange-200 text-orange-800" : "bg-white border-stone-200 text-stone-600")}
        >
          Avec POI lié
        </button>
        <button
          type="button"
          onClick={() => setLinkState("unlinked")}
          className={cn("px-3 py-1.5 text-sm rounded-lg border", linkState === "unlinked" ? "bg-orange-100 border-orange-200 text-orange-800" : "bg-white border-stone-200 text-stone-600")}
        >
          Sans POI lié
        </button>
      </div>}

      {!isDetailView && <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
      </div>}

      {!isDetailView && actionLogs.length > 0 && (
        <div className="rounded-xl border border-stone-200 bg-white/80 p-3">
          <h3 className="text-sm font-medium text-stone-700 mb-2">Journal d’actions</h3>
          <div className="space-y-1 max-h-44 overflow-auto">
            {actionLogs.map((log) => (
              <div key={log.id} className="text-xs text-stone-600 flex items-center gap-2">
                <span className="text-stone-400 min-w-[54px]">{formatLogTime(log.at)}</span>
                <span
                  className={cn(
                    "inline-flex rounded px-1.5 py-0.5",
                    log.level === "success" && "bg-green-100 text-green-700",
                    log.level === "error" && "bg-red-100 text-red-700",
                    log.level === "info" && "bg-stone-100 text-stone-700"
                  )}
                >
                  {log.level}
                </span>
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isDetailView && backlog.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(backlog.error as Error).message}
        </div>
      )}

      {!isDetailView && backlog.isLoading ? (
        <div className="text-sm text-stone-500">Chargement du backlog…</div>
      ) : !linkPanelRow ? (
        <div className="bg-white/80 rounded-xl border border-stone-200 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Article</th>
                <th className="text-left px-4 py-3 font-medium">POI associé(s)</th>
                <th className="text-left px-4 py-3 font-medium">POI RL proposés</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const candidates = row.detectedCandidates || row.candidateGroups || []
                const previewSuggestions = Array.from(
                  new Map(
                    candidates
                      .flatMap((group) => (group.suggestions || []).slice(0, 2))
                      .sort((a, b) => b.score - a.score)
                      .map((s) => [s.rl_place_id, s])
                  ).values()
                ).slice(0, 4)
                const displayTitle = decodeHtmlEntities(row.title)
                const displayCandidate = decodeHtmlEntities(row.candidateName || "—")
                const candidateCount = row.detectedCandidatesCount ?? candidates.length ?? (row.candidateName ? 1 : 0)
                const unmatchedCount = row.unmatchedCandidatesCount ?? candidates.filter((g) => (g.suggestions || []).length === 0).length
                return (
                  <tr key={row.articleId} className="border-t border-stone-100 align-top">
                    <td className="px-4 py-3 min-w-[340px]">
                      <div className="font-medium text-stone-800">{displayTitle}</div>
                      <div className="text-xs text-stone-500 mt-1">{row.categories.join(" · ") || "Sans catégorie"}</div>
                      <div className="text-xs text-stone-500 mt-1">Candidat principal: {displayCandidate}</div>
                      <div className="text-xs text-stone-500 mt-1">
                        Candidats détectés: {candidateCount} · Candidats sans suggestion RL: {unmatchedCount}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[220px]">
                      <div className="font-medium text-stone-800">{row.linkedPoiCount ?? row.associatedPoiCount}</div>
                      <div className="text-xs text-stone-500 mt-1">
                        {row.association?.rl_place_name || row.association?.rl_place_id || "Aucun lien RL"}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[360px]">
                      {previewSuggestions.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {previewSuggestions.map((s) => {
                            const isOfficiallyLinked =
                              !!row.association?.rl_place_id &&
                              row.association.rl_place_id === s.rl_place_id &&
                              (row.status === "linked" || row.status === "created" || row.association?.validated === true)
                            return (
                              <span
                                key={s.rl_place_id}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs border",
                                  isOfficiallyLinked
                                    ? "bg-orange-100 border-orange-200 text-orange-800"
                                    : "bg-stone-100 border-stone-200 text-stone-700"
                                )}
                                title={`${decodeHtmlEntities(s.name)} (${Math.round(s.score * 100)}%)`}
                              >
                                <span className="max-w-[180px] truncate">{decodeHtmlEntities(s.name)}</span>
                                <span className="font-medium">{Math.round(s.score * 100)}%</span>
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-stone-500">Aucun POI RL proposé</span>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[150px]">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            triggerRecomputeArticle(row)
                          }}
                          disabled={mutationPending}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-xs border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-60"
                          title="Relancer l'article"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={mutationPending}
                          onClick={() => openLinkPanel(row)}
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
          {filteredRows.length === 0 && (
            <div className="p-8 text-center text-sm text-stone-500">Aucun article avec ces filtres.</div>
          )}
        </div>
      ) : null}

      {linkPanelRow && (
        <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="sticky top-0 z-10 px-5 py-4 border-b border-stone-200 bg-white flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-stone-800">Espace de liaison POI</h3>
                <p className="text-xs text-stone-500 mt-1">{decodeHtmlEntities(linkPanelRow.title)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(linkPanelRow.categories || []).length > 0 ? (
                    linkPanelRow.categories.map((cat) => (
                      <span key={cat} className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] text-stone-600">
                        {decodeHtmlEntities(cat)}
                      </span>
                    ))
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] text-stone-500">
                      Sans catégorie
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => triggerRecomputeArticle(linkPanelRow)}
                  disabled={mutationPending}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-60 text-xs"
                  title="Relancer scan POI article (avec vérification WP)"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", recomputeArticle.isPending && "animate-spin")} />
                  Relancer scan article
                </button>
                <button
                  type="button"
                  onClick={closeLinkPanel}
                  className="p-1.5 rounded border border-stone-200 text-stone-600 hover:bg-stone-50"
                  aria-label="Fermer le panneau"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
          </div>

          <div className="p-5">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-8 space-y-3">
                  <div className="rounded-lg border border-stone-200 bg-white p-3">
                    <div className="text-xs text-stone-500">Article complet (références candidats surlignées)</div>
                    <div className="text-sm font-medium text-stone-800 mt-1">{decodeHtmlEntities(linkPanelRow.title)}</div>
                    {linkPanelRow.articleUrl ? (
                      <a
                        href={linkPanelRow.articleUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-orange-700 underline underline-offset-2"
                      >
                        Ouvrir l’article source
                      </a>
                    ) : null}
                    <div className="mt-2 max-h-[75vh] overflow-y-auto rounded border border-stone-100 bg-stone-50 p-3 prose prose-sm max-w-none">
                      <div
                        onClick={(event) => {
                          const target = event.target as HTMLElement | null
                          if (!target) return
                          const image = target.closest("img[data-preview-src]") as HTMLImageElement | null
                          const src = image?.getAttribute("data-preview-src")
                          if (src) setImagePreviewSrc(src)
                        }}
                        dangerouslySetInnerHTML={{ __html: highlightedArticleHtml || linkPanelRow.htmlBrut || "<p>Aucun contenu article.</p>" }}
                      />
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-4 space-y-3">
                  <div className="inline-flex rounded-lg border border-stone-200 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setDetailRightTab("matching")}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-md",
                        detailRightTab === "matching" ? "bg-orange-100 text-orange-800" : "text-stone-600 hover:bg-stone-50"
                      )}
                    >
                      Rapprochement
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailRightTab("directory")}
                      className={cn(
                        "px-3 py-1.5 text-xs rounded-md",
                        detailRightTab === "directory" ? "bg-orange-100 text-orange-800" : "text-stone-600 hover:bg-stone-50"
                      )}
                    >
                      Annuaire RL
                    </button>
                  </div>

                  {detailRightTab === "matching" ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                        <div className="text-xs text-stone-500">Candidat sélectionné</div>
                        <div className="text-sm text-stone-800 mt-1">{selectedCandidate ? decodeHtmlEntities(selectedCandidate.name) : "Aucun candidat détecté"}</div>
                        {selectedCandidate && (
                          <div className="text-xs text-stone-500 mt-1">Score candidat: {Math.round((selectedCandidate.mention_score || 0) * 100)}%</div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs text-stone-500">Détecté dans le texte</div>
                        <div className="space-y-2 max-h-56 overflow-y-auto">
                          {panelCandidateGroups.map((group) => {
                            const active = selectedCandidate?.candidate_id === group.candidate_id
                            const expanded = !!expandedCandidateInfo[group.candidate_id]
                            return (
                              <div
                                key={group.candidate_id}
                                className={cn(
                                  "w-full rounded-lg border p-2",
                                  active ? "border-orange-300 bg-orange-50" : "border-stone-200 bg-white"
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedCandidateId(group.candidate_id)}
                                    className="text-left min-w-0 flex-1"
                                  >
                                    <div className="text-sm text-stone-800 truncate">{decodeHtmlEntities(group.name)}</div>
                                    <div className="text-xs text-stone-500 mt-0.5">
                                      Score {Math.round((group.mention_score || 0) * 100)}%
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedCandidateInfo((prev) => ({
                                        ...prev,
                                        [group.candidate_id]: !expanded,
                                      }))
                                    }
                                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-stone-200 text-stone-600 hover:bg-stone-50"
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                    Infos
                                  </button>
                                </div>
                                {expanded && (
                                  <div className="mt-2 text-xs text-stone-600 space-y-1">
                                    <div><strong>Source:</strong> {group.source}</div>
                                    <div><strong>Occurrences (freq):</strong> {group.frequency}</div>
                                    <div><strong>Hits titres (h):</strong> {group.heading_hits} sur H1/H2/H3</div>
                                    <div><strong>Suggestions RL (sugg):</strong> {group.suggestions.length}</div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs text-stone-500">Rapprochement RL ({selectedCandidate?.suggestions?.length || 0})</div>
                        {selectedCandidate?.suggestions?.length ? (
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {selectedCandidate.suggestions.slice(0, 8).map((s) => (
                              <div key={s.rl_place_id} className="rounded-lg border border-stone-200 bg-white p-2">
                                <div className="text-sm font-medium text-stone-800 truncate">{decodeHtmlEntities(s.name)}</div>
                                <div className="text-xs text-stone-500 mt-0.5">
                                  {decodeHtmlEntities(s.place_type_label_fr || s.place_type)} · {Math.round(s.score * 100)}%
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-stone-500 rounded-lg border border-stone-200 bg-stone-50 p-2">
                            Aucune suggestion RL disponible pour ce candidat.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <div className="text-xs text-stone-500">Moteur POI région (filtres)</div>
                        <input
                          value={regionPoiSearch}
                          onChange={(e) => setRegionPoiSearch(e.target.value)}
                          placeholder="Recherche nom, ID, cluster, type"
                          className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <select
                            value={regionPoiClusterFilter}
                            onChange={(e) => setRegionPoiClusterFilter(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm bg-white"
                          >
                            <option value="">Tous les clusters</option>
                            {availableClusterNames.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                          <select
                            value={regionPoiTypeFilter}
                            onChange={(e) => setRegionPoiTypeFilter(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm bg-white"
                          >
                            <option value="">Toutes les catégories</option>
                            {availableTypeLabels.map((label) => (
                              <option key={label} value={label}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-1 rounded-lg border border-stone-200 bg-white p-2">
                          {filteredRegionPois.map((poi) => (
                            <button
                              key={poi.rl_place_id}
                              type="button"
                              onClick={() => {
                                setSelectedRegionPoi({
                                  rl_place_id: poi.rl_place_id,
                                  name: poi.name,
                                })
                              }}
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
                              <div className="text-[11px] text-stone-500 font-mono">{poi.rl_place_id}</div>
                            </button>
                          ))}
                          {!regionPois.isLoading && filteredRegionPois.length === 0 && (
                            <div className="text-xs text-stone-500 p-1">Aucun POI trouvé avec ces filtres.</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs text-stone-500">Validation de la sélection</div>
                        {selectedRegionPoi ? (
                          <div className="text-xs text-stone-700 rounded border border-stone-200 bg-stone-50 p-2">
                            Sélectionné: {decodeHtmlEntities(selectedRegionPoi.name)} ·{" "}
                            <span className="font-mono">{selectedRegionPoi.rl_place_id}</span>
                          </div>
                        ) : (
                          <div className="text-xs text-stone-500 rounded border border-stone-200 bg-stone-50 p-2">
                            Sélectionne un POI dans la liste pour le lier.
                          </div>
                        )}
                        <button
                          type="button"
                          disabled={mutationPending || !selectedRegionPoi?.rl_place_id}
                          onClick={() =>
                            manualLink.mutate(
                              {
                                articleId: linkPanelRow.articleId,
                                rlPlaceId: selectedRegionPoi?.rl_place_id || "",
                                rlPlaceName: selectedRegionPoi?.name || undefined,
                                candidateId: selectedCandidate?.candidate_id || undefined,
                                confidence: "high",
                                score: 1,
                                validated: true,
                              },
                              {
                                onSuccess: () =>
                                  pushLog(
                                    "success",
                                    `Liaison OK (${decodeHtmlEntities(linkPanelRow.title)}) -> ${selectedRegionPoi?.rl_place_id || ""}`
                                  ),
                                onError: (error) => pushLog("error", `Erreur liaison manuelle (${decodeHtmlEntities(linkPanelRow.title)}): ${error.message}`),
                              }
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Valider et lier
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
          </div>
        </div>
      )}

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

      {scanModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-xl shadow-xl border border-stone-200 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-stone-800">Scan POI en cours</h3>
                <p className="text-sm text-stone-500 mt-1">Site: {selectedSite.name}</p>
              </div>
              {!recompute.isPending && (
                <button
                  type="button"
                  onClick={() => setScanModalOpen(false)}
                  className="px-2.5 py-1.5 rounded-lg text-xs border border-stone-200 text-stone-700 hover:bg-stone-50"
                >
                  Fermer
                </button>
              )}
            </div>
            <div className="px-6 py-4 overflow-y-auto">

              {recompute.isPending ? (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Refresh WordPress complet (html/images/urls) + matching POI par cluster...
                </div>
              ) : recompute.isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {(recompute.error as Error).message}
                </div>
              ) : recompute.data?.summary ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 space-y-1">
                  <div>Scan terminé: {recompute.data.summary.updated} articles recalculés</div>
                  <div>Refresh WP: {recompute.data.summary.refreshed} OK · {recompute.data.summary.refreshFailed} KO</div>
                  <div>POI RL lus: {recompute.data.summary.rlPlacesLoaded}</div>
                  <div>A revue: {recompute.data.summary.needsReview} · Pending: {recompute.data.summary.pending}</div>
                </div>
              ) : (
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
                  Le scan va démarrer.
                </div>
              )}

              {actionLogs.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-stone-700 mb-2">Derniers événements</h4>
                  <div className="space-y-1 max-h-36 overflow-auto">
                    {actionLogs.slice(0, 8).map((log) => (
                      <div key={log.id} className="text-xs text-stone-600 flex items-center gap-2">
                        <span className="text-stone-400 min-w-[54px]">{formatLogTime(log.at)}</span>
                        <span>{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
