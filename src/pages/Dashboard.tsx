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
      <div className="p-8">
        <div className="grid grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/60 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-stone-100 rounded w-24 mb-3" />
              <div className="h-8 bg-stone-100 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return null

  const filteredSites = selectedSiteId 
    ? sites?.filter(s => s.id === selectedSiteId)
    : sites

  return (
    <div className="p-8 space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-5">
        <StatCard
          label="À traiter"
          value={stats.articlesToUpdate}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label="Faits aujourd'hui"
          value={stats.articlesDoneToday}
          icon={<CheckCircle className="h-4 w-4" />}
          variant="success"
        />
        <StatCard
          label="Sites au quota"
          value={`${stats.sitesAtQuota}/${stats.sitesTotal}`}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={stats.sitesAtQuota > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Ancienneté moy."
          value={`${stats.averageAgeDays}j`}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Sites & Clusters */}
        <div className="col-span-2 space-y-4">
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide">
            Sites
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {filteredSites?.map((site) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Articles récents */}
          <div>
            <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-4">
              À traiter en priorité
            </h2>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 shadow-sm shadow-stone-100">
              <UrgentArticlesList siteId={selectedSiteId} limit={6} />
            </div>
          </div>

          {/* Signaux */}
          {stats.openSignalsCount > 0 && (
            <div>
              <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-4">
                Signaux ({stats.openSignalsCount})
              </h2>
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 shadow-sm shadow-stone-100">
                <SignalPanel siteId={selectedSiteId} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
