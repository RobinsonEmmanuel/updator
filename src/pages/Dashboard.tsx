import { useSites, useArticles, useOpenSignals } from "@/hooks"
import { useSiteContext } from "@/lib/SiteContext"

export function Dashboard() {
  const { selectedSiteId } = useSiteContext()
  const { data: sites, isLoading: sitesLoading } = useSites()
  const { data: articles, isLoading: articlesLoading } = useArticles(
    selectedSiteId ? { siteId: selectedSiteId } : undefined
  )
  const { data: signals } = useOpenSignals(selectedSiteId ?? undefined)

  const toUpdateCount = articles?.filter((a) => a.status === "to_update").length ?? 0
  const doneToday = articles?.filter((a) => a.status === "done").length ?? 0

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-stone-800 mb-6">Dashboard</h1>
      
      {(sitesLoading || articlesLoading) ? (
        <p className="text-stone-500">Chargement...</p>
      ) : (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg border border-stone-200 p-4">
            <p className="text-sm text-stone-500 mb-1">Articles à traiter</p>
            <p className="text-3xl font-semibold text-stone-800">{toUpdateCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-stone-200 p-4">
            <p className="text-sm text-stone-500 mb-1">Mis à jour aujourd'hui</p>
            <p className="text-3xl font-semibold text-teal-600">{doneToday}</p>
          </div>
          <div className="bg-white rounded-lg border border-stone-200 p-4">
            <p className="text-sm text-stone-500 mb-1">Sites</p>
            <p className="text-3xl font-semibold text-stone-800">{sites?.length ?? 0}</p>
          </div>
          <div className="bg-white rounded-lg border border-stone-200 p-4">
            <p className="text-sm text-stone-500 mb-1">Signaux ouverts</p>
            <p className="text-3xl font-semibold text-orange-600">{signals?.length ?? 0}</p>
          </div>
        </div>
      )}

      <p className="text-stone-600">
        {selectedSiteId 
          ? `Filtré sur le site sélectionné`
          : `Vue globale - tous les sites`
        }
      </p>
    </div>
  )
}
