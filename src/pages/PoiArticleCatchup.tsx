import { useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { RefreshCw, Settings, Search, Link2, PlusCircle, Sparkles, Loader2, Eye, ExternalLink } from "lucide-react"
import { SiteCardsGrid } from "@/components/shared"
import { useSiteContext } from "@/lib/SiteContext"
import {
  useArticlePoiBacklog,
  useArticlePoiCreateRl,
  useArticlePoiManualLink,
  useArticlePoiRecompute,
  useArticlePoiRecomputeArticle,
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

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeTokens(input: string): string[] {
  return decodeHtmlEntities(input)
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
}

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function highlightByTokens(text: string, tokens: string[]): ReactNode {
  const source = decodeHtmlEntities(text)
  if (!source || tokens.length === 0) return source
  const uniq = Array.from(new Set(tokens)).sort((a, b) => b.length - a.length)
  const pattern = uniq.map((t) => escapeRegExp(t)).join("|")
  if (!pattern) return source
  const regex = new RegExp(`(${pattern})`, "gi")
  const parts = source.split(regex)
  return parts.map((part, idx) => {
    const isHit = uniq.some((t) => t.toLowerCase() === part.toLowerCase())
    return isHit ? (
      <mark key={`${part}-${idx}`} className="bg-yellow-100 text-stone-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      <span key={`${part}-${idx}`}>{part}</span>
    )
  })
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
  const [manualPlaceId, setManualPlaceId] = useState<Record<string, string>>({})
  const [manualPlaceName, setManualPlaceName] = useState<Record<string, string>>({})
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [actionLogs, setActionLogs] = useState<ActionLogEntry[]>([])
  const [inspectRow, setInspectRow] = useState<ArticlePoiBacklogRow | null>(null)

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
  const createRl = useArticlePoiCreateRl(siteId)
  const siteCategories = useSiteCategories(siteId)

  const filteredRows = useMemo(() => {
    const rows = backlog.data?.data || []
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      return (
        decodeHtmlEntities(row.title).toLowerCase().includes(q) ||
        decodeHtmlEntities(row.candidateName).toLowerCase().includes(q) ||
        row.suggestions.some((s) => decodeHtmlEntities(s.name).toLowerCase().includes(q))
      )
    })
  }, [backlog.data?.data, search])

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

  const mutationPending = recompute.isPending || manualLink.isPending || createRl.isPending || recomputeArticle.isPending

  const pushLog = (level: ActionLogLevel, message: string) => {
    const entry: ActionLogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      at: new Date().toISOString(),
      level,
      message,
    }
    setActionLogs((prev) => [entry, ...prev].slice(0, 30))
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

  const handleManualLink = (articleId: string, displayTitle: string) => {
    const rlPlaceId = (manualPlaceId[articleId] || "").trim()
    const rlPlaceName = (manualPlaceName[articleId] || "").trim()
    if (!rlPlaceId) return
    manualLink.mutate(
      {
        articleId,
        rlPlaceId,
        rlPlaceName: rlPlaceName || undefined,
        validated: true,
        confidence: "high",
        score: 1,
      },
      {
        onSuccess: () => pushLog("success", `Liaison manuelle OK (${displayTitle}) -> ${rlPlaceId}`),
        onError: (error) => pushLog("error", `Erreur liaison manuelle (${displayTitle}): ${error.message}`),
      }
    )
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500" />
            Studio Match POI
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {selectedSite.name} · articles, suggestions RL, liaisons validées
          </p>
        </div>
        <button
          type="button"
          onClick={handleScanSite}
          disabled={recompute.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", recompute.isPending && "animate-spin")} />
          Scanner tout le site
        </button>
      </div>

      {recompute.data?.summary && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          Scan terminé · {recompute.data.summary.refreshed} contenus refresh WP · {recompute.data.summary.updated} matching recalculés ·{" "}
          {recompute.data.summary.needsReview} à revue
        </div>
      )}

      <div className="flex flex-wrap gap-2">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
      </div>

      {actionLogs.length > 0 && (
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

      {backlog.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(backlog.error as Error).message}
        </div>
      )}

      {backlog.isLoading ? (
        <div className="text-sm text-stone-500">Chargement du backlog…</div>
      ) : (
        <div className="bg-white/80 rounded-xl border border-stone-200 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Article</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="text-left px-4 py-3 font-medium">POI associé(s)</th>
                <th className="text-left px-4 py-3 font-medium">Suggestion RL</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const topSuggestion = row.suggestions[0]
                const regionId = selectedSite.regionIds?.[0]
                const displayTitle = decodeHtmlEntities(row.title)
                const displayCandidate = decodeHtmlEntities(row.candidateName || "—")
                const displaySuggestionName = topSuggestion ? decodeHtmlEntities(topSuggestion.name) : null
                return (
                  <tr key={row.articleId} className="border-t border-stone-100 align-top">
                    <td className="px-4 py-3 min-w-[340px]">
                      <div className="font-medium text-stone-800">{displayTitle}</div>
                      <div className="text-xs text-stone-500 mt-1">{row.categories.join(" · ") || "Sans catégorie"}</div>
                      <div className="text-xs text-stone-500 mt-1">Candidat: {displayCandidate}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex text-xs px-2 py-1 rounded-full bg-stone-100 text-stone-700">
                        {STATUS_LABELS[row.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 min-w-[220px]">
                      <div className="font-medium text-stone-800">{row.associatedPoiCount}</div>
                      <div className="text-xs text-stone-500 mt-1">
                        {row.association?.rl_place_name || row.association?.rl_place_id || "Aucun lien RL"}
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[250px]">
                      {topSuggestion ? (
                        <div>
                          <div className="font-medium text-stone-800">{displaySuggestionName}</div>
                          <div className="text-xs text-stone-500 mt-1">
                            ID: <span className="font-mono">{topSuggestion.rl_place_id}</span>
                          </div>
                          <div className="text-xs text-stone-500 mt-0.5">
                            Type: <span className="font-medium">{topSuggestion.place_type}</span>
                          </div>
                          <div className="text-xs text-stone-500 mt-0.5">
                            Cluster: <span className="font-mono">{topSuggestion.cluster_id || "—"}</span>
                          </div>
                          <div className="text-xs text-stone-500 mt-0.5">{Math.round(topSuggestion.score * 100)}% · {topSuggestion.confidence}</div>
                          <div className="text-xs text-stone-600 mt-1">{topSuggestion.reason}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-500">Pas de suggestion fiable</span>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[460px]">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
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
                          }}
                          disabled={mutationPending}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-60"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Relancer l'article
                        </button>
                        {topSuggestion && (
                          <button
                            type="button"
                            disabled={mutationPending}
                            onClick={() =>
                              manualLink.mutate({
                                articleId: row.articleId,
                                rlPlaceId: topSuggestion.rl_place_id,
                                rlPlaceName: displaySuggestionName || topSuggestion.name,
                                confidence: topSuggestion.confidence,
                                score: topSuggestion.score,
                                validated: true,
                              }, {
                                onSuccess: () => pushLog("success", `POI lié (${displayTitle}) -> ${displaySuggestionName || topSuggestion.name}`),
                                onError: (error) => pushLog("error", `Erreur liaison suggestion (${displayTitle}): ${error.message}`),
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            Lier suggestion
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={mutationPending || !regionId}
                          onClick={() =>
                            createRl.mutate({
                              articleId: row.articleId,
                              regionId,
                              name: decodeHtmlEntities(row.candidateName || row.title),
                            }, {
                              onSuccess: () => pushLog("success", `POI créé dans RL et lié (${displayTitle})`),
                              onError: (error) => pushLog("error", `Erreur création RL (${displayTitle}): ${error.message}`),
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-60"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          Créer dans RL
                        </button>
                        <button
                          type="button"
                          disabled={mutationPending}
                          onClick={() => setInspectRow(row)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-60"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Vérifier
                        </button>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          value={manualPlaceId[row.articleId] || ""}
                          onChange={(e) =>
                            setManualPlaceId((prev) => ({
                              ...prev,
                              [row.articleId]: e.target.value,
                            }))
                          }
                          placeholder="rl_place_id"
                          className="w-[140px] px-2 py-1 rounded border border-stone-200 text-xs"
                        />
                        <input
                          value={manualPlaceName[row.articleId] || ""}
                          onChange={(e) =>
                            setManualPlaceName((prev) => ({
                              ...prev,
                              [row.articleId]: e.target.value,
                            }))
                          }
                          placeholder="Nom (optionnel)"
                          className="w-[160px] px-2 py-1 rounded border border-stone-200 text-xs"
                        />
                        <button
                          type="button"
                          disabled={mutationPending || !(manualPlaceId[row.articleId] || "").trim()}
                          onClick={() => {
                            pushLog("info", `Liaison manuelle par rl_place_id (${displayTitle})`)
                            handleManualLink(row.articleId, displayTitle)
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Lier ID RL
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

      {inspectRow && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl border border-stone-200 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-stone-800">Vérification du matching POI</h3>
                <p className="text-sm text-stone-500 mt-1">{selectedSite.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setInspectRow(null)}
                className="px-2.5 py-1.5 rounded-lg text-xs border border-stone-200 text-stone-700 hover:bg-stone-50"
              >
                Fermer
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto">

            {(() => {
              const row = inspectRow
              const topSuggestion = row.suggestions[0]
              const articleTitle = decodeHtmlEntities(row.title)
              const candidateName = decodeHtmlEntities(row.candidateName || "")
              const suggestionName = topSuggestion ? decodeHtmlEntities(topSuggestion.name) : ""
              const sourceText = stripHtml(row.htmlBrut || "")
              const annotationTokens = topSuggestion?.matched_tokens?.join(" ") || ""
              const highlightTokens = normalizeTokens(`${candidateName} ${suggestionName} ${annotationTokens}`)
              const articleUrl = row.articleUrl || (row.slug && selectedSite.url
                ? `${selectedSite.url.replace(/\/$/, "")}/${row.slug.replace(/^\/+|\/+$/g, "")}/`
                : null)

              return (
                <div className="space-y-4">
                  <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                    <div className="text-xs text-stone-500 mb-1">Source utilisée actuellement pour le matching</div>
                    <div className="text-sm text-stone-700">Contenu HTML WordPress (refresh complet) + titre/candidat</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-stone-500">Titre article</div>
                    <div className="text-sm text-stone-900 leading-relaxed">{highlightByTokens(articleTitle, highlightTokens)}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-stone-500">Candidat détecté</div>
                    <div className="text-sm text-stone-900 leading-relaxed">{highlightByTokens(candidateName || "—", highlightTokens)}</div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-stone-500">Suggestion RL</div>
                    {topSuggestion ? (
                      <div className="text-sm text-stone-900 space-y-1">
                        <div className="font-medium">{highlightByTokens(suggestionName, highlightTokens)}</div>
                        <div className="text-xs text-stone-500 mt-1">
                          ID: <span className="font-mono">{topSuggestion.rl_place_id}</span> · Type:{" "}
                          <span className="font-medium">{topSuggestion.place_type || "autre"}</span> · Cluster:{" "}
                          <span className="font-mono">{topSuggestion.cluster_id || "—"}</span> · {Math.round(topSuggestion.score * 100)}% (
                          {topSuggestion.confidence})
                        </div>
                        <div className="text-xs text-stone-700">
                          <strong>Pourquoi:</strong> {topSuggestion.reason}
                        </div>
                        <div className="text-xs text-stone-600">
                          <strong>Tokens trouvés:</strong> {topSuggestion.matched_tokens?.join(", ") || "aucun"}
                        </div>
                        <div className="text-xs text-stone-600">
                          <strong>Détail score:</strong>{" "}
                          titre={topSuggestion.score_details?.title_score ?? 0} · contenu={topSuggestion.score_details?.content_score ?? 0} ·
                          couverture={topSuggestion.score_details?.token_coverage ?? 0} · final={topSuggestion.score_details?.final_score ?? topSuggestion.score}
                        </div>
                        {topSuggestion.evidence_excerpt ? (
                          <div className="rounded border border-stone-200 bg-stone-50 p-2 text-xs text-stone-700 leading-relaxed">
                            {highlightByTokens(topSuggestion.evidence_excerpt, highlightTokens)}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-sm text-stone-500">Aucune suggestion fiable pour cet article.</div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-stone-500">Texte intégral extrait de html_brut (matching)</div>
                    <div className="text-sm text-stone-900 leading-relaxed max-h-48 overflow-auto rounded-lg border border-stone-200 bg-white p-3">
                      {sourceText
                        ? highlightByTokens(sourceText, highlightTokens)
                        : <span className="text-stone-500">Aucun contenu disponible (html_brut vide).</span>}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-stone-500">html_brut complet (rendu)</div>
                    <div
                      className="max-h-72 overflow-auto rounded-lg border border-stone-200 bg-white p-3 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: row.htmlBrut || "<p>Aucun html_brut</p>" }}
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    {articleUrl ? (
                      <a
                        href={articleUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-stone-200 text-stone-700 hover:bg-stone-50"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ouvrir l’article
                      </a>
                    ) : (
                      <span className="text-xs text-stone-500">Lien article indisponible (slug absent)</span>
                    )}
                  </div>
                </div>
              )
            })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
