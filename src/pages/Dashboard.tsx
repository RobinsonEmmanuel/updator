import { FileText, CheckCircle, AlertTriangle, Clock } from "lucide-react"
import { StatCard, SiteCard, UrgentArticlesList, SignalPanel } from "@/components/shared"
import { useDashboardStats, useSites } from "@/hooks"
import { useSiteContext } from "@/lib/SiteContext"

export function Dashboard() {
  const { selectedSiteId } = useSiteContext()
  const { data: stats, isLoading } = useDashboardStats(selectedSiteId)
  const { data: sites } = useSites()

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-stone-800 mb-6">Dashboard</h1>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-stone-200 p-4 animate-pulse">
              <div className="h-4 bg-stone-200 rounded w-24 mb-2" />
              <div className="h-8 bg-stone-200 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-stone-800">Dashboard</h1>
        <p className="text-sm text-stone-500">
          {selectedSiteId ? "Site sélectionné" : "Vue globale — tous les sites"}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Articles à traiter"
          value={stats.articlesToUpdate}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label="Mis à jour aujourd'hui"
          value={stats.articlesDoneToday}
          icon={<CheckCircle className="h-4 w-4" />}
          variant="success"
        />
        <StatCard
          label="Sites au quota"
          value={`${stats.sitesAtQuota}/${stats.sitesTotal}`}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={stats.sitesAtQuota > 0 ? "warning" : "default"}
          subtitle={stats.sitesAtQuota > 0 ? "Bloqués pour aujourd'hui" : "Aucun bloqué"}
        />
        <StatCard
          label="Ancienneté moyenne"
          value={`${stats.averageAgeDays}j`}
          icon={<Clock className="h-4 w-4" />}
          subtitle="Articles à traiter"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <h2 className="font-medium text-stone-800 mb-4">Sites & Clusters</h2>
          <div className="grid grid-cols-2 gap-4">
            {(selectedSiteId 
              ? sites?.filter(s => s.id === selectedSiteId)
              : sites
            )?.map((site) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-stone-200 p-4">
            <h2 className="font-medium text-stone-800 mb-4">Articles urgents</h2>
            <UrgentArticlesList siteId={selectedSiteId} limit={8} />
          </div>
          <div className="bg-white rounded-lg border border-stone-200 p-4">
            <h2 className="font-medium text-stone-800 mb-4">
              Signaux ouverts ({stats.openSignalsCount})
            </h2>
            <SignalPanel siteId={selectedSiteId} />
          </div>
        </div>
      </div>
    </div>
  )
}
