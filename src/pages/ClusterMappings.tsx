import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Brain, RefreshCw, Save, AlertTriangle, Settings, Layers } from "lucide-react"
import {
  useClusterMappings,
  useOverrideClusterMapping,
  useRecomputeClusterMappings,
  useRegionsOverview,
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

  const { data, isLoading, error } = useClusterMappings(siteId)
  const { data: regionsOverview } = useRegionsOverview(siteId)
  const recompute = useRecomputeClusterMappings(siteId)
  const override = useOverrideClusterMapping(siteId)

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
  const selectedSiteRegionIds = selectedSite?.regionIds || []
  const selectedRegionNames = useMemo(() => {
    const byId = new Map((regionsOverview?.data || []).map((r) => [r.id, r.name]))
    return selectedSiteRegionIds.map((id) => byId.get(id) || id)
  }, [regionsOverview?.data, selectedSiteRegionIds])

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
      <p className="text-sm text-stone-600">
        Régions du site:{" "}
        {selectedRegionNames.length > 0 ? selectedRegionNames.join(" · ") : "Aucune région associée"}
      </p>

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
