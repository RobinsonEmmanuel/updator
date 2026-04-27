import { useEffect, useMemo, useState, type MouseEvent } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, CheckCircle2, ChevronDown, ExternalLink, ListChecks, RadioTower, Search, X } from "lucide-react"
import { useChecklistItems, useSignals, useWpPost } from "@/hooks"
import { fetchWpSiteBundle } from "@/lib/wpSiteBundle"
import { useWpConfig } from "@/lib/WpConfigContext"
import { cn } from "@/lib/utils"
import { parseSectionsFromHtml } from "@/features/article-poi-catchup/articleSectionHtml"
import { ArticleSectionsPanel } from "@/features/article-poi-catchup/components/ArticleSectionsPanel"

type RightTab = "signals" | "todo"

interface PersistedWorkspaceFilters {
  activeTab: RightTab
  signalSearch: string
  selectedSignalCluster: string
}

const FILTER_VERSION = "v1"

const defaultFilters: PersistedWorkspaceFilters = {
  activeTab: "signals",
  signalSearch: "",
  selectedSignalCluster: "",
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
}

function storageKey(siteId: string) {
  return `article-update-workspace-filters:${FILTER_VERSION}:${siteId}`
}

function readFilters(siteId: string): PersistedWorkspaceFilters {
  if (typeof window === "undefined") return defaultFilters
  try {
    const raw = window.localStorage.getItem(storageKey(siteId))
    if (!raw) return defaultFilters
    const parsed = JSON.parse(raw) as Partial<PersistedWorkspaceFilters>
    const activeTab: RightTab = parsed.activeTab === "todo" ? "todo" : "signals"
    return {
      activeTab,
      signalSearch: typeof parsed.signalSearch === "string" ? parsed.signalSearch : "",
      selectedSignalCluster: typeof parsed.selectedSignalCluster === "string" ? parsed.selectedSignalCluster : "",
    }
  } catch {
    return defaultFilters
  }
}

export function ArticleUpdateWorkspace() {
  const navigate = useNavigate()
  const { siteId = "", postId = "" } = useParams<{ siteId: string; postId: string }>()
  const postIdNum = Number.parseInt(postId, 10)
  const { connectedSites } = useWpConfig()
  const site = connectedSites.find((entry) => entry._id === siteId)

  const [activeTab, setActiveTab] = useState<RightTab>("signals")
  const [signalSearch, setSignalSearch] = useState("")
  const [selectedSignalCluster, setSelectedSignalCluster] = useState("")
  const [localChecks, setLocalChecks] = useState<Record<string, boolean>>({})
  const [openSectionIds, setOpenSectionIds] = useState<string[]>([])
  const [imagePreviewSrc, setImagePreviewSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!siteId) return
    const persisted = readFilters(siteId)
    setActiveTab(persisted.activeTab)
    setSignalSearch(persisted.signalSearch)
    setSelectedSignalCluster(persisted.selectedSignalCluster)
  }, [siteId])

  useEffect(() => {
    if (!siteId || typeof window === "undefined") return
    const payload: PersistedWorkspaceFilters = { activeTab, signalSearch, selectedSignalCluster }
    window.localStorage.setItem(storageKey(siteId), JSON.stringify(payload))
  }, [siteId, activeTab, signalSearch, selectedSignalCluster])

  const bundleQuery = useQuery({
    queryKey: ["wp-site-bundle", siteId, "article-update-workspace"],
    queryFn: () => fetchWpSiteBundle(siteId, false),
    enabled: !!siteId,
    staleTime: 5 * 60 * 1000,
  })

  const listPost = useMemo(() => {
    const posts = bundleQuery.data?.posts || []
    return posts.find((entry) => entry.id === postIdNum)
  }, [bundleQuery.data?.posts, postIdNum])

  const categoriesById = useMemo(() => {
    const map = new Map<number, string>()
    ;(bundleQuery.data?.categories || []).forEach((category) => {
      map.set(category.id, category.name)
    })
    return map
  }, [bundleQuery.data?.categories])

  const wpPostQuery = useWpPost(site?.url || "", site ? postIdNum : 0)
  const signalsQuery = useSignals(siteId)
  const checklistQuery = useChecklistItems()

  const availableSignalClusters = useMemo(() => {
    const clusters = new Set<string>()
    ;(signalsQuery.data || []).forEach((signal) => {
      ;(signal.clusterIds || []).forEach((clusterId) => {
        const value = clusterId.trim()
        if (value) clusters.add(value)
      })
    })
    return Array.from(clusters).sort((a, b) => a.localeCompare(b))
  }, [signalsQuery.data])

  const filteredSignals = useMemo(() => {
    const q = signalSearch.trim().toLowerCase()
    return (signalsQuery.data || [])
      .filter((signal) => signal.status === "open")
      .filter((signal) => {
        if (!selectedSignalCluster) return true
        return (signal.clusterIds || []).some((clusterId) => clusterId === selectedSignalCluster)
      })
      .filter((signal) => {
        if (!q) return true
        return (
          decodeHtmlEntities(signal.entityName).toLowerCase().includes(q) ||
          decodeHtmlEntities(signal.note).toLowerCase().includes(q)
        )
      })
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
  }, [signalsQuery.data, selectedSignalCluster, signalSearch])

  const checklistItems = useMemo(
    () => (checklistQuery.data || []).filter((item) => item.active).sort((a, b) => a.order - b.order),
    [checklistQuery.data]
  )

  const articleSections = useMemo(() => {
    const html = wpPostQuery.data?.content?.rendered || ""
    return parseSectionsFromHtml(html, [])
  }, [wpPostQuery.data?.content?.rendered])

  useEffect(() => {
    if (articleSections.length === 0) {
      setOpenSectionIds([])
      return
    }
    setOpenSectionIds((prev) => {
      if (prev.length > 0) return prev
      return [articleSections[0].id]
    })
  }, [articleSections])

  const checkedCount = useMemo(
    () => checklistItems.filter((item) => localChecks[`${siteId}:${postId}:${item.id}`]).length,
    [checklistItems, localChecks, siteId, postId]
  )

  const postTitle = decodeHtmlEntities(listPost?.title?.rendered || wpPostQuery.data?.title?.rendered || "Article")
  const categoryLabel = (listPost?.categories || []).map((id) => categoriesById.get(id)).filter(Boolean).join(", ")

  const expandAllSections = () => {
    setOpenSectionIds(articleSections.map((section) => section.id))
  }

  const collapseAllSections = () => {
    setOpenSectionIds([])
  }

  const toggleSection = (sectionId: string) => {
    setOpenSectionIds((prev) => (prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]))
  }

  const handleSectionContentClick = (event: MouseEvent<HTMLElement>) => {
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
    if (anchor) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  if (!site || !Number.isFinite(postIdNum)) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <p className="text-sm text-stone-600">Article introuvable pour ce site.</p>
        <Link to="/queue" className="text-sm text-orange-600 hover:underline">
          Retour à la file de travail
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/queue")}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 hover:bg-stone-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour file de travail
        </button>
        <a
          href={listPost?.link || wpPostQuery.data?.link || site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm text-stone-700 hover:bg-stone-50"
        >
          Ouvrir sur WordPress
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
        <div className="xl:col-span-8 space-y-2">
          <ArticleSectionsPanel
            title={postTitle}
            articleUrl={listPost?.link || wpPostQuery.data?.link || null}
            focusedCandidateId={null}
            onResetFocus={() => {}}
            onExpandAll={expandAllSections}
            onCollapseAll={collapseAllSections}
            canExpandAll={articleSections.length > 0 && openSectionIds.length !== articleSections.length}
            canCollapseAll={openSectionIds.length > 0}
            markPending={false}
            mutationPending={false}
            manualDraft={null}
            onMarkDraft={() => {}}
            onCloseDraft={() => {}}
          >
            {wpPostQuery.isLoading || bundleQuery.isLoading ? (
              <div className="rounded border border-stone-200/80 bg-white px-3 py-3 text-sm text-stone-500">
                Chargement de l’article…
              </div>
            ) : null}
            {!wpPostQuery.isLoading && wpPostQuery.error ? (
              <div className="rounded border border-stone-200/80 bg-white px-3 py-3 text-sm text-stone-600">
                <p>Contenu complet indisponible (fallback metadata uniquement). Vérifie les accès WP.</p>
                <p className="mt-1 text-xs text-stone-500">
                  Site: {site.name}
                  {categoryLabel ? ` · ${categoryLabel}` : ""}
                  {listPost?.modified ? ` · modifié le ${new Date(listPost.modified).toLocaleDateString("fr-FR")}` : ""}
                </p>
              </div>
            ) : null}
            {!wpPostQuery.isLoading && !wpPostQuery.error && articleSections.length === 0 ? (
              <div className="rounded border border-stone-200/80 bg-white px-3 py-3 text-sm text-stone-600">
                <p>Pas de contenu HTML exploitable pour cet article dans cette vue.</p>
                <p className="mt-1">Tu peux utiliser “Ouvrir sur WordPress” pour l’édition complète.</p>
              </div>
            ) : null}
            {articleSections.map((section) => {
              const isOpen = openSectionIds.includes(section.id)
              return (
                <div key={section.id} className="rounded border border-stone-200/80 bg-white overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-stone-50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-800 truncate">{decodeHtmlEntities(section.title)}</div>
                      <div className="text-[11px] text-stone-500">{section.level.toUpperCase()}</div>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 text-stone-500 transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen ? (
                    <div
                      className="px-2.5 pb-2 prose prose-sm max-w-none"
                      onClick={handleSectionContentClick}
                      dangerouslySetInnerHTML={{ __html: section.html || "<p>Section vide.</p>" }}
                    />
                  ) : null}
                </div>
              )
            })}
          </ArticleSectionsPanel>
        </div>

        <aside className="xl:col-span-4 rounded border border-stone-200 bg-white overflow-hidden">
          <div className="px-3 py-3 border-b border-stone-200 bg-stone-50/70">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-white p-1 border border-stone-200">
              <button
                type="button"
                onClick={() => setActiveTab("signals")}
                className={cn(
                  "px-2 py-1 text-xs rounded-md inline-flex items-center justify-center gap-1.5",
                  activeTab === "signals" ? "bg-orange-100 text-orange-800 font-medium" : "text-stone-600 hover:bg-stone-50"
                )}
              >
                <RadioTower className="h-3.5 w-3.5" />
                Signaux
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("todo")}
                className={cn(
                  "px-2 py-1 text-xs rounded-md inline-flex items-center justify-center gap-1.5",
                  activeTab === "todo" ? "bg-emerald-100 text-emerald-800 font-medium" : "text-stone-600 hover:bg-stone-50"
                )}
              >
                <ListChecks className="h-3.5 w-3.5" />
                Todo ({checkedCount}/{checklistItems.length})
              </button>
            </div>
          </div>

          {activeTab === "signals" ? (
            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 gap-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    value={signalSearch}
                    onChange={(event) => setSignalSearch(event.target.value)}
                    placeholder="Rechercher un signal"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
                  />
                </div>
                <select
                  value={selectedSignalCluster}
                  onChange={(event) => setSelectedSignalCluster(event.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
                >
                  <option value="">Tous les clusters</option>
                  {availableSignalClusters.map((clusterId) => (
                    <option key={clusterId} value={clusterId}>
                      {clusterId}
                    </option>
                  ))}
                </select>
              </div>

              {signalsQuery.isLoading ? <p className="text-xs text-stone-500 px-1 py-1">Chargement des signaux…</p> : null}
              {!signalsQuery.isLoading && filteredSignals.length === 0 ? (
                <div className="text-xs text-stone-500 rounded border border-stone-200 bg-stone-50 px-2 py-2">
                  Aucun signal ouvert sur ce filtre.
                </div>
              ) : null}
              {filteredSignals.map((signal) => (
                <div key={signal._id || signal.id || `${signal.entityName}-${signal.detectedAt}`} className="rounded border border-stone-200 bg-stone-50/70 px-2 py-2">
                  <p className="text-xs font-medium text-stone-800">{decodeHtmlEntities(signal.entityName)}</p>
                  <p className="text-[11px] text-stone-500 mt-0.5">{new Date(signal.detectedAt).toLocaleDateString("fr-FR")} · {signal.type}</p>
                  <p className="text-xs text-stone-700 mt-1">{decodeHtmlEntities(signal.note)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 space-y-2 max-h-[70vh] overflow-y-auto">
              {checklistQuery.isLoading ? <p className="text-xs text-stone-500 px-1 py-1">Chargement de la todo…</p> : null}
              {checklistItems.map((item) => {
                const key = `${siteId}:${postId}:${item.id}`
                const checked = !!localChecks[key]
                return (
                  <label key={item.id} className={cn("rounded border px-2 py-2 block cursor-pointer", checked ? "border-emerald-300 bg-emerald-50/80" : "border-stone-200 bg-stone-50/70")}>
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setLocalChecks((prev) => ({
                            ...prev,
                            [key]: !prev[key],
                          }))
                        }
                        className="mt-0.5 h-3.5 w-3.5 rounded border-stone-300 text-emerald-600"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-stone-800 flex items-center gap-1.5">
                          {checked ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : null}
                          {item.label}
                        </p>
                        <p className="text-[11px] text-stone-500 mt-0.5">{item.description}</p>
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </aside>
      </div>

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
    </div>
  )
}
