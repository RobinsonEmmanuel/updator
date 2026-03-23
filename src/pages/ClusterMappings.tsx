import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Brain, RefreshCw, Save, AlertTriangle, Settings, Layers, Search } from "lucide-react"
import {
  useClusterMappings,
  useOverrideClusterMapping,
  useRecomputeClusterMappings,
  useRegionsOverview,
  useUpdateSiteRegions,
} from "@/hooks"
import { SiteCardsGrid } from "@/components/shared"
import { useSiteContext } from "@/lib/SiteContext"
import { cn } from "@/lib/utils"
import type { ArticleClusterMappingItem } from "@/types"

function NoSitesMessage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Settings className="h-8 w-8 text-orange-500" />
        </div>
        <h2 className="text-lg font-medium text-stone-800 mb-2">
          Aucun site WordPress configuré
        </h2>
        <p className="text-stone-500 mb-6">
          Configurez un site WordPress pour activer le mapping cluster.
        </p>
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

function statusLabel(status: ArticleClusterMappingItem["status"]): string {
  if (status === "needs_review") return "A verifier"
  if (status === "overridden") return "Manuel"
  if (status === "approved") return "Valide"
  return "Auto"
}

function MappingCard({
  item,
  onSave,
  saving,
  clusterOptions,
}: {
  item: ArticleClusterMappingItem
  onSave: (wpPostId: number, clusterIds: string[]) => void
  saving: boolean
  clusterOptions: Array<{ id: string; name: string }>
}) {
  const [selectedClusterIds, setSelectedClusterIds] = useState<string[]>(item.clusterIds || [])

  useEffect(() => {
    setSelectedClusterIds(item.clusterIds || [])
  }, [item._id, item.clusterIds])

  const selectedLabels = useMemo(() => {
    const map = new Map(clusterOptions.map((c) => [c.id, c.name]))
    return selectedClusterIds.map((id) => ({ id, name: map.get(id) || id }))
  }, [clusterOptions, selectedClusterIds])

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 shadow-sm shadow-stone-100">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <a
            href={item.post?.link}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-stone-800 hover:text-orange-600 transition-colors line-clamp-2"
          >
            {item.post?.title || `Article #${item.wpPostId}`}
          </a>
          <p className="text-xs text-stone-400 mt-1">Score de confiance: {Math.round(item.confidence * 100)}%</p>
        </div>
        <span
          className={cn(
            "text-xs px-2 py-1 rounded-full whitespace-nowrap",
            item.status === "needs_review"
              ? "bg-red-50 text-red-600"
              : item.status === "overridden"
                ? "bg-blue-50 text-blue-600"
                : "bg-teal-50 text-teal-700"
          )}
        >
          {statusLabel(item.status)}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-xs text-stone-500">Clusters assignés (manuel)</p>
        {selectedLabels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedLabels.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedClusterIds((prev) => prev.filter((id) => id !== c.id))}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 border border-orange-200"
                title="Retirer"
              >
                <span className="truncate max-w-40">{c.name}</span>
                <span className="text-[10px]">x</span>
              </button>
            ))}
          </div>
        )}
        <select
          className="w-full px-2 py-2 rounded-lg border border-stone-200 bg-white text-sm"
          defaultValue=""
          onChange={(e) => {
            const id = e.target.value
            if (!id) return
            setSelectedClusterIds((prev) => [...new Set([...prev, id])])
            e.currentTarget.value = ""
          }}
        >
          <option value="">+ Ajouter un cluster…</option>
          {clusterOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(item.wpPostId, selectedClusterIds)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            Sauver
          </button>
        </div>
      </div>
    </div>
  )
}

export function ClusterMappings() {
  const { selectedSite, hasNoSites, isAllSitesSelected, sites, setSelectedSiteId } = useSiteContext()
  const siteId = selectedSite?._id

  const [activeTab, setActiveTab] = useState<"review" | "clusters">("clusters")
  const [isEditingRegions, setIsEditingRegions] = useState(false)
  const [checkedRegionIds, setCheckedRegionIds] = useState<string[]>([])
  const [regionSearch, setRegionSearch] = useState("")

  const { data, isLoading, error } = useClusterMappings(siteId)
  const { data: regionsOverview, isLoading: regionsLoading } = useRegionsOverview(siteId)
  const recompute = useRecomputeClusterMappings(siteId)
  const override = useOverrideClusterMapping(siteId)
  const updateRegions = useUpdateSiteRegions(siteId)

  useEffect(() => {
    setCheckedRegionIds(selectedSite?.regionIds || [])
  }, [selectedSite?._id, selectedSite?.regionIds])

  const needsReview = useMemo(
    () => (data?.data || []).filter((i) => i.status === "needs_review"),
    [data]
  )

  const groupedByCluster = useMemo(() => {
    const groups = new Map<string, ArticleClusterMappingItem[]>()
    for (const item of data?.data || []) {
      for (const cid of item.clusterIds) {
        if (!groups.has(cid)) groups.set(cid, [])
        groups.get(cid)?.push(item)
      }
    }
    const arr = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length)
    if (needsReview.length > 0) {
      arr.unshift(["__needs_review__", needsReview])
    }
    return arr
  }, [data, needsReview])
  const clusterNameById = useMemo(
    () => new Map((data?.clustersCatalog || []).map((c) => [c.id, c.name])),
    [data?.clustersCatalog]
  )

  const filteredRegions = useMemo(() => {
    const query = regionSearch.trim().toLowerCase()
    const list = regionsOverview?.data || []
    if (!query) return list
    return list.filter(
      (r) => r.name.toLowerCase().includes(query) || r.id.toLowerCase().includes(query)
    )
  }, [regionsOverview, regionSearch])

  const selectedRegionTags = useMemo(() => {
    const byId = new Map((regionsOverview?.data || []).map((r) => [r.id, r]))
    return checkedRegionIds.map((id) => {
      const region = byId.get(id)
      return {
        id,
        name: region?.name || id,
      }
    })
  }, [checkedRegionIds, regionsOverview])

  if (hasNoSites) return <NoSitesMessage />

  if (isAllSitesSelected || !selectedSite) {
    return (
      <div className="p-8 max-w-6xl mx-auto space-y-5">
        <div className="bg-white/70 rounded-xl p-6 border border-stone-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
              <Layers className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <h2 className="font-medium text-stone-800 mb-1">Sélectionnez un site</h2>
              <p className="text-sm text-stone-500">
                Le mapping cluster se gère site par site pour rester pertinent.
              </p>
            </div>
          </div>
        </div>

        <SiteCardsGrid
          sites={sites}
          onSelectSite={setSelectedSiteId}
          selectedSiteId={selectedSite?._id ?? null}
        />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
            <Brain className="h-5 w-5 text-orange-500" />
            Mapping intelligent clusters
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            {selectedSite.name} · {data?.site.regionIds?.length ?? 0} régions RL
          </p>
        </div>
        <button
          type="button"
          onClick={() => recompute.mutate(false)}
          disabled={recompute.isPending || !selectedSite.regionIds?.length}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", recompute.isPending && "animate-spin")} />
          Analyser et mettre a jour
        </button>
      </div>
      <p className="text-xs text-stone-500 -mt-3">
        Analyse et mise a jour = relit les articles WordPress + clusters RL, puis met a jour les assignations automatiques.
      </p>

      <div className="rounded-xl border border-stone-200/80 bg-white/70 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-stone-700">Régions RL (liste vivante)</p>
            <p className="text-xs text-stone-500">
              Coche les régions à rattacher à ce site. Les nouvelles/non rattachées et les disparues sont visibles ici.
            </p>
          </div>
          {isEditingRegions ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await updateRegions.mutateAsync(checkedRegionIds)
                  setIsEditingRegions(false)
                }}
                disabled={updateRegions.isPending}
                className="px-3 py-1.5 rounded-lg text-sm text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
              >
                Sauver ({checkedRegionIds.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckedRegionIds(selectedSite.regionIds || [])
                  setIsEditingRegions(false)
                }}
                className="px-3 py-1.5 rounded-lg text-sm text-stone-700 bg-stone-100 hover:bg-stone-200"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingRegions(true)}
              className="px-3 py-1.5 rounded-lg text-sm text-stone-700 bg-stone-100 hover:bg-stone-200"
            >
              Modifier
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded-full bg-stone-100 text-stone-700">
            Total RL: {regionsOverview?.summary.totalRegions ?? 0}
          </span>
          <span className="px-2 py-1 rounded-full bg-sky-100 text-sky-700">
            Non rattachées: {regionsOverview?.summary.unassignedRegions ?? 0}
          </span>
          <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700">
            Références inconnues (sites): {regionsOverview?.summary.unknownRegionRefs ?? 0}
          </span>
          <span className="px-2 py-1 rounded-full bg-violet-100 text-violet-700">
            Clusters devenus obsoletes: {data?.staleClusterRefsCount ?? 0}
          </span>
          {(regionsOverview?.summary.currentSiteUnknownRefs ?? 0) > 0 && (
            <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700">
              Inconnues sur ce site: {regionsOverview?.summary.currentSiteUnknownRefs}
            </span>
          )}
        </div>

        {isEditingRegions && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                value={regionSearch}
                onChange={(e) => setRegionSearch(e.target.value)}
                placeholder="Rechercher une région RL (nom ou ID)…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
              />
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-stone-100 bg-white p-2">
              {regionsLoading ? (
                <p className="p-3 text-sm text-stone-500">Chargement des régions RL…</p>
              ) : filteredRegions.length === 0 ? (
                <p className="p-3 text-sm text-stone-500">Aucune région trouvée.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredRegions.map((region) => {
                    const checked = checkedRegionIds.includes(region.id)
                    return (
                      <button
                        key={region.id}
                        type="button"
                        title={`${region.name || "(sans nom)"} — ${region.id}`}
                        onClick={() => {
                          setCheckedRegionIds((prev) =>
                            checked ? prev.filter((id) => id !== region.id) : [...new Set([...prev, region.id])]
                          )
                        }}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs leading-4 transition-colors max-w-full",
                          checked
                            ? "bg-orange-100 border-orange-200 text-orange-800"
                            : "bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100",
                          region.isUnassigned && !checked && "bg-amber-50 border-amber-200 text-amber-800"
                        )}
                      >
                        <span className="truncate max-w-44">{region.name || "(sans nom)"}</span>
                        {region.assignedSiteNames.length > 0 && !checked && (
                          <span className="text-[10px] opacity-70 truncate max-w-28">
                            · {region.assignedSiteNames[0]}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <div className="rounded-lg border border-stone-100 bg-stone-50/70 p-3">
          <p className="text-xs font-medium text-stone-600 mb-2">
            Régions sélectionnées pour ce site ({selectedRegionTags.length})
          </p>
          {selectedRegionTags.length === 0 ? (
            <p className="text-xs text-stone-400">Aucune région sélectionnée.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {selectedRegionTags.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => {
                    if (!isEditingRegions) return
                    setCheckedRegionIds((prev) => prev.filter((id) => id !== region.id))
                  }}
                  className={cn(
                    "inline-flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs text-left",
                    isEditingRegions
                      ? "bg-orange-100 border-orange-200 text-orange-800 hover:bg-orange-200"
                      : "bg-stone-100 border-stone-200 text-stone-700"
                  )}
                  title={isEditingRegions ? "Cliquer pour désassigner" : region.id}
                >
                  <span className="truncate">{region.name}</span>
                  {isEditingRegions && <span className="text-[10px]">x</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {(regionsOverview?.unknownRegionRefs || []).length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-medium text-red-700 mb-1">
              Références de régions présentes dans des sites mais absentes de RL
            </p>
            <div className="space-y-1 max-h-28 overflow-auto">
              {regionsOverview?.unknownRegionRefs.map((ref) => (
                <p key={`${ref.siteId}-${ref.regionId}`} className="text-xs text-red-700">
                  {ref.siteName}: <span className="font-mono">{ref.regionId}</span>
                  {ref.isCurrentSite ? " (site courant)" : ""}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      {!selectedSite.regionIds?.length && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Ce site n’a pas de `regionIds` configurés. Ajoutez-les avant de lancer le mapping.
        </div>
      )}

      {recompute.data?.summary && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">
          Recompute OK · {recompute.data.summary.updated} mappings mis à jour ·{" "}
          {recompute.data.summary.needsReview} à revoir
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(error as Error).message}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("review")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm",
            activeTab === "review" ? "bg-orange-100 text-orange-700" : "text-stone-600 hover:bg-stone-100"
          )}
        >
          <AlertTriangle className="h-4 w-4 inline mr-1" />
          Revue manuelle ({needsReview.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("clusters")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm",
            activeTab === "clusters" ? "bg-orange-100 text-orange-700" : "text-stone-600 hover:bg-stone-100"
          )}
        >
          Vue par cluster ({groupedByCluster.length})
        </button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-stone-500">Chargement des mappings...</div>
      ) : activeTab === "review" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {needsReview.length === 0 ? (
            <div className="rounded-xl bg-white/70 p-8 text-center text-stone-500 lg:col-span-2 xl:col-span-3">
              Rien à revoir pour le moment.
            </div>
          ) : (
            needsReview.map((item) => (
              <MappingCard
                key={item._id}
                item={item}
                saving={override.isPending}
                clusterOptions={data?.clustersCatalog || []}
                onSave={(wpPostId, clusterIds) =>
                  override.mutate({ wpPostId, clusterIds, status: "overridden" })
                }
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByCluster.map(([clusterId, rows]) => (
            <section key={clusterId} className="rounded-xl bg-white/70 p-4 shadow-sm shadow-stone-100">
              <h3 className="font-medium text-stone-800 mb-2">
                {clusterId === "__needs_review__"
                  ? "A verifier (assignation incertaine)"
                  : clusterNameById.get(clusterId) || clusterId}{" "}
                <span className="text-stone-400 text-sm">({rows.length})</span>
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {rows.slice(0, 24).map((row) => (
                  <MappingCard
                    key={`${clusterId}-${row._id}`}
                    item={row}
                    saving={override.isPending}
                    clusterOptions={data?.clustersCatalog || []}
                    onSave={(wpPostId, clusterIds) =>
                      override.mutate({ wpPostId, clusterIds, status: "overridden" })
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
