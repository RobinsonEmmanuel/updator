import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Brain, RefreshCw, Save, AlertTriangle, Settings, Layers } from "lucide-react"
import {
  useClusterMappings,
  useOverrideClusterMapping,
  useRecomputeClusterMappings,
} from "@/hooks"
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

function MappingCard({
  item,
  onSave,
  saving,
}: {
  item: ArticleClusterMappingItem
  onSave: (wpPostId: number, clusterIds: string[]) => void
  saving: boolean
}) {
  const [draft, setDraft] = useState(item.clusterIds.join(", "))

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
          <p className="text-xs text-stone-400 mt-1">
            wpPostId: {item.wpPostId} · score: {Math.round(item.confidence * 100)}%
          </p>
          <p className="text-xs text-stone-400 mt-1">
            {item.sourceSignals.join(" · ") || "Aucun signal"}
          </p>
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
          {item.status}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="clusterId1, clusterId2"
          className="flex-1 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            onSave(
              item.wpPostId,
              draft
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
        >
          <Save className="h-3.5 w-3.5" />
          Sauver
        </button>
      </div>
    </div>
  )
}

export function ClusterMappings() {
  const { selectedSite, hasNoSites, isAllSitesSelected } = useSiteContext()
  const siteId = selectedSite?._id

  const [activeTab, setActiveTab] = useState<"review" | "clusters">("review")

  const { data, isLoading, error } = useClusterMappings(siteId)
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
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [data])

  if (hasNoSites) return <NoSitesMessage />

  if (isAllSitesSelected || !selectedSite) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="bg-white/70 rounded-xl p-8 text-center border border-stone-200">
          <Layers className="h-8 w-8 text-orange-500 mx-auto mb-3" />
          <h2 className="font-medium text-stone-800 mb-1">Sélectionnez un site</h2>
          <p className="text-sm text-stone-500">
            Le mapping cluster se gère site par site pour rester pertinent.
          </p>
        </div>
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
          disabled={recompute.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", recompute.isPending && "animate-spin")} />
          Recompute mapping
        </button>
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
        <div className="space-y-3">
          {needsReview.length === 0 ? (
            <div className="rounded-xl bg-white/70 p-8 text-center text-stone-500">
              Rien à revoir pour le moment.
            </div>
          ) : (
            needsReview.map((item) => (
              <MappingCard
                key={item._id}
                item={item}
                saving={override.isPending}
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
                {clusterId} <span className="text-stone-400 text-sm">({rows.length})</span>
              </h3>
              <div className="space-y-2">
                {rows.slice(0, 15).map((row) => (
                  <a
                    key={row._id}
                    href={row.post?.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-stone-700 hover:text-orange-600 truncate"
                  >
                    {row.post?.title || `Article #${row.wpPostId}`}
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
