import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { Link } from "react-router-dom"
import { RefreshCw, Settings, Search, Link2, Sparkles, Loader2, PanelRight, X, Info, BookOpen, Trash2, ChevronDown, ArrowLeft } from "lucide-react"
import { SiteCardsGrid } from "@/components/shared"
import { useSiteContext } from "@/lib/SiteContext"
import {
  useArticlePoiBacklog,
  useArticlePoiManualLink,
  useArticlePoiRecompute,
  useArticlePoiRecomputeArticle,
  useArticlePoiRegionPois,
  useArticlePoiUnlink,
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

interface ArticleSectionView {
  id: string
  title: string
  level: "h1" | "h2" | "h3" | "intro"
  html: string
  text: string
  candidateIds: string[]
  suggestionCount: number
}

interface CandidateSectionMeta {
  candidate_id: string
  name: string
  source?: string
  section_title?: string
  occurrences?: Array<{ section_title?: string }>
  suggestions?: unknown[]
}

function normalizeForMatch(input: string): string {
  return decodeHtmlEntities(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
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

function parseSectionsFromHtml(html: string, candidates: CandidateSectionMeta[]): ArticleSectionView[] {
  const source = html || ""
  if (typeof window === "undefined" || typeof DOMParser === "undefined" || !source) {
    return [
      {
        id: "intro",
        title: "Contenu",
        level: "intro",
        html: source,
        text: decodeHtmlEntities(source),
        candidateIds: [],
        suggestionCount: 0,
      },
    ]
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(source, "text/html")

  doc.body.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") || ""
    if (!src) return
    img.setAttribute("data-preview-src", src)
    img.setAttribute("style", "max-width:200px;width:100%;height:auto;cursor:zoom-in;display:block;margin:8px 0;")
    img.setAttribute("loading", "lazy")
  })

  type RawSection = { id: string; title: string; level: "h1" | "h2" | "h3" | "intro"; nodes: Node[] }
  const children = Array.from(doc.body.childNodes)
  const headingEntries = children
    .map((node, nodeIndex) => {
      const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : null
      const tag = (el?.tagName || "").toLowerCase()
      if (tag !== "h1" && tag !== "h2" && tag !== "h3") return null
      const title = decodeHtmlEntities(el?.textContent || "").replace(/\s+/g, " ").trim()
      if (!title) return null
      return {
        nodeIndex,
        level: tag as "h1" | "h2" | "h3",
        title,
        normalizedTitle: normalizeForMatch(title),
      }
    })
    .filter((entry): entry is { nodeIndex: number; level: "h1" | "h2" | "h3"; title: string; normalizedTitle: string } => !!entry)

  const normalizedCandidates = candidates
    .map((candidate) => ({ ...candidate, normalized: normalizeForMatch(candidate.name) }))
    .filter((candidate) => candidate.normalized.length >= 3)

  const extractSommaireTitles = (): string[] => {
    const containers = Array.from(doc.body.querySelectorAll("div,section,aside,nav"))
    for (const container of containers) {
      const text = normalizeForMatch(container.textContent || "")
      if (!text.includes("sommaire")) continue
      const list = container.querySelector("ul,ol")
      if (!list) continue
      const titles = Array.from(list.querySelectorAll("li"))
        .map((li) => decodeHtmlEntities(li.textContent || "").replace(/\s+/g, " ").trim())
        .filter((t) => t.length > 0)
      if (titles.length > 0) return titles
    }
    return []
  }

  const sommaireTitles = extractSommaireTitles()
  const usedHeadingNodeIndexes = new Set<number>()
  const sommaireAnchors = sommaireTitles
    .map((title) => {
      const normalizedTitle = normalizeForMatch(title)
      if (!normalizedTitle) return null
      const match = headingEntries.find((entry) => {
        if (usedHeadingNodeIndexes.has(entry.nodeIndex)) return false
        return (
          entry.normalizedTitle === normalizedTitle ||
          entry.normalizedTitle.includes(normalizedTitle) ||
          normalizedTitle.includes(entry.normalizedTitle)
        )
      })
      if (!match) return null
      usedHeadingNodeIndexes.add(match.nodeIndex)
      return {
        nodeIndex: match.nodeIndex,
        level: match.level,
        title,
      }
    })
    .filter((entry): entry is { nodeIndex: number; level: "h1" | "h2" | "h3"; title: string } => !!entry)
    .sort((a, b) => a.nodeIndex - b.nodeIndex)

  const fallbackAnchors = (() => {
    if (sommaireAnchors.length > 0) return sommaireAnchors
    const h2Only = headingEntries.filter((entry) => entry.level === "h2")
    const selected = h2Only.length > 0 ? h2Only : headingEntries
    return selected.map((entry) => ({
      nodeIndex: entry.nodeIndex,
      level: entry.level,
      title: entry.title,
    }))
  })()

  const sections: RawSection[] = []
  if (fallbackAnchors.length === 0) {
    sections.push({ id: "intro", title: "Introduction", level: "intro", nodes: children.map((node) => node.cloneNode(true)) })
  } else {
    const firstIndex = fallbackAnchors[0].nodeIndex
    if (firstIndex > 0) {
      sections.push({
        id: "intro",
        title: "Introduction",
        level: "intro",
        nodes: children.slice(0, firstIndex).map((node) => node.cloneNode(true)),
      })
    }
    fallbackAnchors.forEach((anchor, idx) => {
      const end = idx + 1 < fallbackAnchors.length ? fallbackAnchors[idx + 1].nodeIndex : children.length
      const nodes = children.slice(anchor.nodeIndex, end).map((node) => node.cloneNode(true))
      sections.push({
        id: `section-${idx + 1}-${anchor.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "heading"}`,
        title: anchor.title,
        level: anchor.level,
        nodes,
      })
    })
  }

  const builtSections = sections
    .map((section) => {
      const tmp = doc.createElement("div")
      section.nodes.forEach((node) => tmp.appendChild(node))
      const htmlContent = tmp.innerHTML
      const textContent = decodeHtmlEntities(tmp.textContent || "").replace(/\s+/g, " ").trim()
      const normalizedText = normalizeForMatch(textContent)
      const sectionTitleNormalized = normalizeForMatch(section.title)
      const candidateIds = normalizedCandidates
        .filter((candidate) => {
          const titleMatches = [
            candidate.section_title || "",
            ...(Array.isArray(candidate.occurrences) ? candidate.occurrences.map((o) => o.section_title || "") : []),
          ]
            .map((t) => normalizeForMatch(t))
            .filter((t) => t.length > 0)
            .some((candidateSectionTitle) =>
              candidateSectionTitle === sectionTitleNormalized ||
              candidateSectionTitle.includes(sectionTitleNormalized) ||
              sectionTitleNormalized.includes(candidateSectionTitle)
            )
          if (titleMatches) return true
          return normalizedText.includes(candidate.normalized)
        })
        .map((candidate) => candidate.candidate_id)
      const suggestionCount = candidates
        .filter((candidate) => candidateIds.includes(candidate.candidate_id))
        .reduce((acc, candidate) => acc + (Array.isArray(candidate.suggestions) ? candidate.suggestions.length : 0), 0)
      return {
        id: section.id,
        title: section.title,
        level: section.level,
        html: htmlContent,
        text: textContent,
        candidateIds,
        suggestionCount,
      } satisfies ArticleSectionView
    })
    .filter((section) => section.html.trim().length > 0 || section.level !== "intro")
  return builtSections
}

function highlightSectionHtmlByCandidates(
  html: string,
  candidates: Array<{ candidate_id: string; name: string }>,
  activeCandidateId: string | null
): string {
  const source = html || ""
  if (!source || typeof window === "undefined" || typeof DOMParser === "undefined") return source
  const parser = new DOMParser()
  const doc = parser.parseFromString(source, "text/html")

  const entries = candidates
    .map((candidate) => ({
      candidateId: candidate.candidate_id,
      label: decodeHtmlEntities(candidate.name).trim(),
      lower: decodeHtmlEntities(candidate.name).trim().toLowerCase(),
    }))
    .filter((entry) => entry.label.length >= 3)
    .sort((a, b) => b.label.length - a.label.length)

  if (entries.length === 0) return doc.body.innerHTML
  const escaped = entries.map((entry) => entry.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  if (!escaped) return doc.body.innerHTML
  const byTerm = new Map(entries.map((entry) => [entry.lower, entry.candidateId]))
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
      const candidateId = byTerm.get(match.toLowerCase())
      const mark = doc.createElement("mark")
      mark.textContent = match
      if (candidateId) {
        mark.setAttribute("data-candidate-id", candidateId)
        mark.className =
          activeCandidateId === candidateId
            ? "bg-orange-200 text-orange-900 rounded px-0.5 cursor-pointer"
            : "bg-yellow-200 text-stone-900 rounded px-0.5 cursor-pointer"
      } else {
        mark.className = "bg-yellow-200 text-stone-900 rounded px-0.5"
      }
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
  const [expandedCandidateInfo, setExpandedCandidateInfo] = useState<Record<string, boolean>>({})
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
  const unlinkPoi = useArticlePoiUnlink(siteId)
  const siteCategories = useSiteCategories(siteId)
  const regionPois = useArticlePoiRegionPois({ siteId, q: regionPoiSearch, limit: 1000 })

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
  const annuaireModalCandidate = useMemo(
    () => panelCandidateGroups.find((g) => g.candidate_id === annuaireModalCandidateId) || null,
    [panelCandidateGroups, annuaireModalCandidateId]
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
  const regionPoiById = useMemo(() => {
    return new Map((regionPois.data || []).map((poi) => [poi.rl_place_id, poi]))
  }, [regionPois.data])
  const placeTypeLabelByType = useMemo(() => {
    const map = new Map<string, string>()
    ;(regionPois.data || []).forEach((poi) => {
      const key = (poi.place_type || "").trim().toLowerCase()
      const label = decodeHtmlEntities(poi.place_type_label_fr || "").trim()
      if (key && label && !map.has(key)) map.set(key, label)
    })
    return map
  }, [regionPois.data])
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
  const isDetailView = Boolean(linkPanelRow)

  useEffect(() => {
    if (!linkPanelRow) return
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLinkPanelRow(null)
    }
    window.addEventListener("keydown", onKeydown)
    return () => window.removeEventListener("keydown", onKeydown)
  }, [linkPanelRow])

  useEffect(() => {
    if (!linkPanelRow) return
    const latestRows = backlog.data?.data || []
    const updated = latestRows.find((row) => row.articleId === linkPanelRow.articleId)
    if (updated) {
      setLinkPanelRow(updated)
      if (selectedCandidateId) {
        const groups = updated.detectedCandidates || updated.candidateGroups || []
        const stillExists = groups.some((g) => g.candidate_id === selectedCandidateId)
        if (!stillExists) setSelectedCandidateId(groups[0]?.candidate_id || null)
      }
      return
    }
    // If current filtered page no longer contains the article, keep panel as-is.
  }, [backlog.data?.data, linkPanelRow?.articleId, selectedCandidateId])

  useEffect(() => {
    if (!linkPanelRow) {
      setOpenSectionIds([])
      setFocusedCandidateId(null)
      return
    }
    setOpenSectionIds([])
    setFocusedCandidateId(null)
  }, [linkPanelRow?.articleId, articleSections])

  useEffect(() => {
    if (!focusedCandidateId) return
    const sectionIds = candidateSectionIdsMap.get(focusedCandidateId) || []
    if (sectionIds.length === 0) return
    setOpenSectionIds((prev) => {
      const merged = new Set(prev)
      sectionIds.forEach((id) => merged.add(id))
      return Array.from(merged)
    })
  }, [focusedCandidateId, candidateSectionIdsMap])

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

  const mutationPending = recompute.isPending || manualLink.isPending || unlinkPoi.isPending || recomputeArticle.isPending

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
    setSelectedRegionPoi(null)
    setFocusedCandidateId(null)
    setAnnuaireModalCandidateId(null)
    setExpandedCandidateInfo({})
  }

  const closeLinkPanel = () => {
    setLinkPanelRow(null)
    setSelectedRegionPoi(null)
    setAnnuaireModalCandidateId(null)
    setUnlinkConfirmCandidateId(null)
    setFocusedCandidateId(null)
    setOpenSectionIds([])
    setImagePreviewSrc(null)
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
    setLinkPanelRow((prev) => {
      if (!prev) return prev
      const current = prev.detectedCandidates || prev.candidateGroups || []
      const nextGroups = current.map((group) =>
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
      const linkedCount = nextGroups.filter((group) => !!group.rl_place_id).length
      return {
        ...prev,
        status: linkedCount > 0 ? "linked" : prev.status,
        detectedCandidates: nextGroups,
        candidateGroups: nextGroups,
        linkedPoiCount: linkedCount,
        associatedPoiCount: linkedCount,
        hasLinkedPoi: linkedCount > 0,
        association: {
          status: "linked",
          rl_place_id: params.rlPlaceId,
          rl_place_name: params.rlPlaceName,
          candidate_id: params.candidateId,
          validated: true,
          score: 1,
          confidence: "high",
          updated_at: new Date().toISOString(),
        },
      }
    })
  }

  const applyUnlinkedCandidateInPanel = (candidateId: string) => {
    setLinkPanelRow((prev) => {
      if (!prev) return prev
      const current = prev.detectedCandidates || prev.candidateGroups || []
      const nextGroups = current.map((group) =>
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
      const linkedCount = nextGroups.filter((group) => !!group.rl_place_id).length
      return {
        ...prev,
        status: linkedCount > 0 ? "linked" : "needs_review",
        detectedCandidates: nextGroups,
        candidateGroups: nextGroups,
        linkedPoiCount: linkedCount,
        associatedPoiCount: linkedCount,
        hasLinkedPoi: linkedCount > 0,
        association: linkedCount > 0 ? prev.association : null,
      }
    })
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

  const toggleSection = (sectionId: string) => {
    setOpenSectionIds((prev) => (prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]))
  }

  const handleSectionContentClick = (sectionId: string, event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null
    if (!target) return
    const image = target.closest("img[data-preview-src]") as HTMLImageElement | null
    const src = image?.getAttribute("data-preview-src")
    if (src) {
      setImagePreviewSrc(src)
      return
    }
    const mark = target.closest("mark[data-candidate-id]") as HTMLElement | null
    const candidateId = mark?.getAttribute("data-candidate-id")
    if (!candidateId) return
    setFocusedCandidateId((prev) => (prev === candidateId ? null : candidateId))
    setSelectedCandidateId(candidateId)
    setOpenSectionIds((prev) => (prev.includes(sectionId) ? prev : [...prev, sectionId]))
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
                const linkedCandidates = candidates.filter((candidate) => !!candidate.rl_place_id)
                const linkedIds = new Set(linkedCandidates.map((candidate) => candidate.rl_place_id).filter(Boolean))
                const allSuggestions = Array.from(
                  new Map(
                    candidates
                      .filter((group) => !group.rl_place_id)
                      .flatMap((group) => (group.suggestions || []).slice(0, 2))
                      .sort((a, b) => b.score - a.score)
                      .map((s) => [s.rl_place_id, s])
                  ).values()
                )
                const linkedPills = linkedCandidates
                  .filter((candidate) => !!candidate.rl_place_id)
                  .map((candidate) => ({
                    rl_place_id: candidate.rl_place_id as string,
                    name: candidate.rl_place_name || candidate.name,
                    score: 1,
                  }))
                const previewSuggestions = [...linkedPills, ...allSuggestions.filter((s) => !linkedIds.has(s.rl_place_id))].slice(0, 4)
                const displayTitle = decodeHtmlEntities(row.title)
                const candidateCount = row.detectedCandidatesCount ?? candidates.length ?? (row.candidateName ? 1 : 0)
                const unmatchedCount = row.unmatchedCandidatesCount ?? candidates.filter((g) => !g.rl_place_id && (g.suggestions || []).length === 0).length
                return (
                  <tr key={row.articleId} className="border-t border-stone-100 align-top">
                    <td className="px-4 py-3 min-w-[340px]">
                      <div className="font-medium text-stone-800">{displayTitle}</div>
                      <div className="text-xs text-stone-500 mt-1">{row.categories.join(" · ") || "Sans catégorie"}</div>
                      <div className="text-xs text-stone-500 mt-1">
                        Candidats détectés: {candidateCount} · Candidats sans suggestion RL: {unmatchedCount}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[220px]">
                      <div className="font-medium text-stone-800">{row.linkedPoiCount ?? row.associatedPoiCount}</div>
                      <div className="text-xs text-stone-500 mt-1">
                        {linkedCandidates.length > 0
                          ? linkedCandidates
                              .map((candidate) => decodeHtmlEntities(candidate.rl_place_name || candidate.name))
                              .filter(Boolean)
                              .join(" · ")
                          : row.association?.rl_place_name || row.association?.rl_place_id || "Aucun lien RL"}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[360px]">
                      {previewSuggestions.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {previewSuggestions.map((s) => {
                            const isOfficiallyLinked =
                              linkedIds.has(s.rl_place_id) ||
                              (!!row.association?.rl_place_id &&
                                row.association.rl_place_id === s.rl_place_id &&
                                (row.status === "linked" || row.status === "created" || row.association?.validated === true))
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
        <div className="bg-transparent">
          <div className="sticky top-0 z-10 px-0 py-2 bg-stone-50/85 backdrop-blur-sm flex items-start justify-between gap-3">
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 text-xs"
                  aria-label="Retour à la liste"
                  title="Retour à la liste"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Retour à la liste
                </button>
              </div>
          </div>

          <div className="p-0">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
                <div className="xl:col-span-8 space-y-2">
                  <div className="bg-white p-2.5 rounded-lg">
                    <div className="text-xs text-stone-500">Article complet (sections H1/H2/H3, candidats surlignés cliquables)</div>
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
                    {focusedCandidateId ? (
                      <div className="mt-2 text-[11px] rounded border border-orange-200 bg-orange-50 text-orange-800 px-2 py-1 inline-flex items-center gap-2">
                        Filtre candidat actif
                        <button
                          type="button"
                          onClick={() => setFocusedCandidateId(null)}
                          className="inline-flex items-center rounded border border-orange-200 bg-stone-50 px-1.5 py-0.5 hover:bg-orange-100"
                        >
                          Réinitialiser
                        </button>
                      </div>
                    ) : null}
                    <div className="mt-2 max-h-[75vh] overflow-y-auto rounded-md bg-white p-2 space-y-1.5">
                      {articleSections.map((section) => {
                        const isOpen = openSectionIds.includes(section.id)
                        const sectionCandidates = panelCandidateGroups.filter((group) => section.candidateIds.includes(group.candidate_id))
                        const highlightedHtml = highlightSectionHtmlByCandidates(section.html, sectionCandidates, focusedCandidateId)
                        return (
                          <div key={section.id} className="rounded border border-stone-200/80 bg-white overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleSection(section.id)}
                              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-stone-50"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-stone-800 truncate">{decodeHtmlEntities(section.title)}</div>
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
                                dangerouslySetInnerHTML={{ __html: highlightedHtml || "<p>Section vide.</p>" }}
                              />
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-4 space-y-2">
                  <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-0.5">
                    {linkedPanelCandidateGroups.length > 0 ? (
                      <div className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 bg-emerald-50/70 border border-emerald-200 rounded px-2 py-1">
                        POI déjà liés ({linkedPanelCandidateGroups.length})
                      </div>
                    ) : null}
                    {[...linkedPanelCandidateGroups, ...unlinkedPanelCandidateGroups].map((group, index) => {
                      const firstUnlinkedIndex = linkedPanelCandidateGroups.length
                      const showUnlinkedHeader = unlinkedPanelCandidateGroups.length > 0 && index === firstUnlinkedIndex
                      const active = selectedCandidate?.candidate_id === group.candidate_id
                      const expanded = !!expandedCandidateInfo[group.candidate_id]
                      const baseSuggestions = group.suggestions || []
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
                      const linkedClusterName = decodeHtmlEntities(
                        group.rl_cluster_name || linkedPoi?.cluster_names?.[0] || "Cluster inconnu"
                      )
                      const linkedClusterMeta =
                        group.rl_cluster_id ||
                        linkedPoi?.cluster_ids?.[0] ||
                        null
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
                      const suggestions = isLinkedCandidate ? [] : baseSuggestions
                      return (
                        <div key={group.candidate_id} className="space-y-2">
                          {showUnlinkedHeader ? (
                            <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500 bg-stone-50/80 border border-stone-200 rounded px-2 py-1">
                              Candidats à valider ({unlinkedPanelCandidateGroups.length})
                            </div>
                          ) : null}
                        <div
                          className={cn(
                            "relative rounded-lg border p-2.5 pr-24",
                            isLinkedCandidate
                              ? "border-emerald-200 bg-emerald-50/30"
                              : active
                                ? "border-orange-300 bg-orange-50/40"
                                : "border-stone-200 bg-white"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedCandidateId(group.candidate_id)}
                              className="text-left min-w-0 flex-1"
                            >
                              <div className="text-sm font-medium text-stone-800 break-words">
                                {decodeHtmlEntities(group.name)}
                              </div>
                              <div className="text-xs text-stone-500 mt-0.5">
                                {isLinkedCandidate
                                  ? `POI RL validé`
                                  : `Score ${Math.round((group.mention_score || 0) * 100)}% · ${suggestions.length} rapprochement(s)`}
                              </div>
                              {isLinkedCandidate ? (
                                <div className="mt-1 text-[11px] text-stone-600 leading-relaxed">
                                  <span>{linkedTypeLabel}</span>
                                  <span className="text-stone-400"> · </span>
                                  <span>{linkedClusterName}</span>
                                </div>
                              ) : null}
                            </button>
                            <div className="absolute top-2 right-2 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedCandidateInfo((prev) => ({
                                    ...prev,
                                    [group.candidate_id]: !expanded,
                                  }))
                                }
                                className="inline-flex items-center justify-center h-8 w-8 rounded border border-stone-200 text-stone-600 hover:bg-stone-50"
                                title="Voir les infos du candidat"
                                aria-label="Voir les infos du candidat"
                              >
                                <Info className="h-4 w-4" />
                              </button>
                              {!isLinkedCandidate ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCandidateId(group.candidate_id)
                                    setAnnuaireModalCandidateId(group.candidate_id)
                                    setSelectedRegionPoi(null)
                                  }}
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
                                    onClick={() =>
                                      setUnlinkConfirmCandidateId((prev) =>
                                        prev === group.candidate_id ? null : group.candidate_id
                                      )
                                    }
                                    disabled={mutationPending}
                                    className="inline-flex items-center justify-center h-8 w-8 rounded border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                                    title="Retirer la liaison RL de ce candidat"
                                    aria-label="Retirer la liaison RL de ce candidat"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                  {unlinkConfirmCandidateId === group.candidate_id ? (
                                    <div className="absolute right-0 mt-1 z-20 w-56 rounded-md border border-red-200 bg-white shadow-sm p-2 text-[11px] text-stone-700">
                                      <div className="mb-2">Confirmer le retrait du POI lié pour ce candidat ?</div>
                                      <div className="flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setUnlinkConfirmCandidateId(null)}
                                          className="px-2 py-1 rounded border border-stone-200 text-stone-600 hover:bg-stone-50"
                                        >
                                          Annuler
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            unlinkPoi.mutate(
                                              {
                                                articleId: linkPanelRow.articleId,
                                                candidateId: group.candidate_id,
                                              },
                                              {
                                                onSuccess: () => {
                                                  setUnlinkConfirmCandidateId(null)
                                                  applyUnlinkedCandidateInPanel(group.candidate_id)
                                                  void backlog.refetch()
                                                  pushLog(
                                                    "success",
                                                    `Liaison retirée (${decodeHtmlEntities(linkPanelRow.title)}) · candidat ${decodeHtmlEntities(group.name)}`
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
                            </div>
                          </div>

                          {expanded && (
                            <div className="mt-2 text-xs text-stone-600 space-y-1">
                              <div><strong>Occurrences (freq):</strong> {group.frequency}</div>
                              <div><strong>Hits titres (h):</strong> {group.heading_hits} sur H1/H2/H3</div>
                              <div><strong>Suggestions RL (sugg):</strong> {suggestions.length}</div>
                              {isLinkedCandidate ? (
                                <>
                                  <div><strong>Place type (clé):</strong> {group.rl_place_type || linkedPoi?.place_type || "—"}</div>
                                  <div><strong>Cluster (id):</strong> {linkedClusterMeta || "—"}</div>
                                  <div><strong>POI RL id:</strong> {group.rl_place_id || "—"}</div>
                                </>
                              ) : null}
                            </div>
                          )}

                          {!isLinkedCandidate ? (
                            <div className="mt-3 space-y-2">
                              <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wide">
                                Rapprochements RL à valider
                              </div>
                              {suggestions.length > 0 ? (
                              <div className="space-y-1">
                                {suggestions.slice(0, 8).map((s) => {
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
                                  <button
                                    key={s.rl_place_id}
                                    type="button"
                                    onClick={() =>
                                      manualLink.mutate(
                                        {
                                          articleId: linkPanelRow.articleId,
                                          rlPlaceId: s.rl_place_id,
                                          rlPlaceName: s.name,
                                          placeType: s.place_type,
                                          placeTypeLabelFr: typeLabel,
                                          clusterId: s.cluster_id,
                                          clusterName: clusterLabel,
                                          candidateId: group.candidate_id,
                                          confidence: "high",
                                          score: s.score ?? 1,
                                          validated: true,
                                        },
                                        {
                                          onSuccess: () =>
                                            {
                                              applyLinkedCandidateInPanel({
                                                candidateId: group.candidate_id,
                                                rlPlaceId: s.rl_place_id,
                                                rlPlaceName: s.name,
                                                placeType: s.place_type,
                                                placeTypeLabelFr: typeLabel,
                                                clusterId: s.cluster_id,
                                                clusterName: clusterLabel,
                                              })
                                              void backlog.refetch()
                                              pushLog(
                                                "success",
                                                `Liaison OK (${decodeHtmlEntities(linkPanelRow.title)}) -> ${s.rl_place_id}`
                                              )
                                            },
                                          onError: (error) =>
                                            pushLog("error", `Erreur liaison manuelle (${decodeHtmlEntities(linkPanelRow.title)}): ${error.message}`),
                                        }
                                      )
                                    }
                                    className="w-full text-left rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] text-stone-700 hover:bg-orange-50"
                                  >
                                    <div
                                      className="leading-snug break-words"
                                      style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                                    >
                                      <span className="font-medium text-stone-800">{decodeHtmlEntities(s.name)}</span>
                                      <span className="text-stone-500"> · </span>
                                      <span className="text-stone-600">{typeLabel}</span>
                                      <span className="text-stone-500"> · </span>
                                      <span className="text-stone-600">{clusterLabel}</span>
                                      <span className="text-stone-500"> · </span>
                                      <span className="font-medium text-stone-700">{Math.round(s.score * 100)}%</span>
                                    </div>
                                  </button>
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
                    })}
                    {visiblePanelCandidateGroups.length === 0 ? (
                      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-500">
                        Aucun candidat visible. Ouvre une section H1/H2/H3 dans l’article pour afficher les candidats/POI correspondants.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
          </div>
        </div>
      )}

      {annuaireModalCandidateId && annuaireModalCandidate && linkPanelRow && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setAnnuaireModalCandidateId(null)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-3xl shadow-xl border border-stone-200 max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-5 py-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-stone-800">Annuaire RL · Liaison manuelle</h3>
                <p className="text-xs text-stone-500 mt-1">
                  Candidat détecté: {decodeHtmlEntities(annuaireModalCandidate.name)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAnnuaireModalCandidateId(null)}
                className="p-1.5 rounded border border-stone-200 text-stone-600 hover:bg-stone-50"
                aria-label="Fermer annuaire RL"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 overflow-y-auto space-y-3">
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
                <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-stone-200 bg-white p-2">
                  {filteredRegionPois.map((poi) => (
                    <button
                      key={poi.rl_place_id}
                      type="button"
                      onClick={() => {
                        setSelectedRegionPoi({
                          rl_place_id: poi.rl_place_id,
                          name: poi.name,
                          place_type: poi.place_type,
                          place_type_label_fr: poi.place_type_label_fr,
                          cluster_name: (poi.cluster_names || [])[0] || "Cluster inconnu",
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
                  onClick={() =>
                    manualLink.mutate(
                      {
                        articleId: linkPanelRow.articleId,
                        rlPlaceId: selectedRegionPoi?.rl_place_id || "",
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
                        onSuccess: () => {
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
                          pushLog(
                            "success",
                            `Liaison OK (${decodeHtmlEntities(linkPanelRow.title)}) -> ${selectedRegionPoi?.rl_place_id || ""}`
                          )
                          setAnnuaireModalCandidateId(null)
                        },
                        onError: (error) =>
                          pushLog("error", `Erreur liaison manuelle (${decodeHtmlEntities(linkPanelRow.title)}): ${error.message}`),
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
