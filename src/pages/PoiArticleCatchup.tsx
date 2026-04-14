import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { RefreshCw, Settings, Search, Link2, PlusCircle } from "lucide-react"
import { SiteCardsGrid } from "@/components/shared"
import { useSiteContext } from "@/lib/SiteContext"
import {
  useArticlePoiBacklog,
  useArticlePoiCreateRl,
  useArticlePoiManualLink,
  useArticlePoiRecompute,
  useSiteCategories,
  type PoiAssociationStatus,
} from "@/hooks"
import { cn } from "@/lib/utils"

const STATUS_LABELS: Record<PoiAssociationStatus, string> = {
  pending: "A traiter",
  needs_review: "A revoir",
  linked: "Associé",
  created: "Créé RL",
  ignored: "Ignoré",
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

  const backlog = useArticlePoiBacklog({
    siteId,
    status,
    category: category || undefined,
    page: 1,
    limit: 100,
  })
  const recompute = useArticlePoiRecompute(siteId)
  const manualLink = useArticlePoiManualLink(siteId)
  const createRl = useArticlePoiCreateRl(siteId)
  const siteCategories = useSiteCategories(siteId)

  const filteredRows = useMemo(() => {
    const rows = backlog.data?.data || []
    if (!search.trim()) return rows
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      return (
        row.title.toLowerCase().includes(q) ||
        row.candidateName.toLowerCase().includes(q) ||
        row.suggestions.some((s) => s.name.toLowerCase().includes(q))
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

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Rattrapage association POI / article</h1>
          <p className="text-sm text-stone-500 mt-1">
            {selectedSite.name} · candidates temporaires + liens RL validés
          </p>
        </div>
        <button
          type="button"
          onClick={() => recompute.mutate({ force: false })}
          disabled={recompute.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", recompute.isPending && "animate-spin")} />
          Analyser et mettre à jour
        </button>
      </div>

      {recompute.data?.summary && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          Recompute OK · {recompute.data.summary.updated} articles mis à jour ·{" "}
          {recompute.data.summary.autoValidated} auto-validés · {recompute.data.summary.needsReview} à revoir
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

      {backlog.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(backlog.error as Error).message}
        </div>
      )}

      {backlog.isLoading ? (
        <div className="text-sm text-stone-500">Chargement du backlog…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRows.map((row) => {
            const topSuggestion = row.suggestions[0]
            const regionId = topSuggestion?.region_id || selectedSite.regionIds?.[0]
            return (
              <article key={row.articleId} className="bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-sm border border-stone-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-stone-800 line-clamp-2">{row.title}</h3>
                    <p className="text-xs text-stone-500 mt-1">{row.categories.join(" · ") || "Sans catégorie"}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-stone-100 text-stone-700">
                    {STATUS_LABELS[row.status]}
                  </span>
                </div>

                <div className="mt-3 text-sm text-stone-700">
                  <p>
                    <span className="text-stone-500">Candidat:</span> {row.candidateName || "—"}
                  </p>
                  {topSuggestion ? (
                    <p className="mt-1">
                      <span className="text-stone-500">Suggestion RL:</span> {topSuggestion.name} ·{" "}
                      {Math.round(topSuggestion.score * 100)}%
                    </p>
                  ) : (
                    <p className="mt-1 text-stone-500">Aucune suggestion RL fiable</p>
                  )}
                  {row.association?.rl_place_id && (
                    <p className="mt-1 text-teal-700">
                      Lien actuel: {row.association.rl_place_name || row.association.rl_place_id}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {topSuggestion && (
                    <button
                      type="button"
                      disabled={manualLink.isPending}
                      onClick={() =>
                        manualLink.mutate({
                          articleId: row.articleId,
                          rlPlaceId: topSuggestion.rl_place_id,
                          rlPlaceName: topSuggestion.name,
                          confidence: topSuggestion.confidence,
                          score: topSuggestion.score,
                          validated: true,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Associer
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={createRl.isPending || !regionId}
                    onClick={() =>
                      createRl.mutate({
                        articleId: row.articleId,
                        regionId,
                        name: row.candidateName || row.title,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-stone-200 text-stone-700 bg-white hover:bg-stone-50 disabled:opacity-60"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    Créer POI RL
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
