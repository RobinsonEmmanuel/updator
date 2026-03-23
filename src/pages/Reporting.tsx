import { Link } from "react-router-dom"
import { BarChart3, Calendar, TrendingUp, Settings } from "lucide-react"
import { BundleProgressBanner } from "@/components/shared"
import { useWpSiteData, useAllSitesData } from "@/hooks"
import { useSiteContext } from "@/lib/SiteContext"
import { flattenCategoryStatsPerSite } from "@/lib/wpCategoryStats"
import type { WpPostListItem } from "@/types/wordpress"

function getUpToDatePercentage(posts: WpPostListItem[]): number {
  if (posts.length === 0) return 100
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const upToDate = posts.filter(p => new Date(p.modified) > oneYearAgo).length
  return Math.round((upToDate / posts.length) * 100)
}

function getUpdatesThisMonth(posts: WpPostListItem[]): number {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return posts.filter(p => new Date(p.modified) >= startOfMonth).length
}

function getUpdatesThisWeek(posts: WpPostListItem[]): number {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  return posts.filter(p => new Date(p.modified) >= startOfWeek).length
}

interface StatBoxProps {
  label: string
  value: string | number
  sublabel?: string
  icon: typeof BarChart3
  color?: string
}

function StatBox({ label, value, sublabel, icon: Icon, color = "orange" }: StatBoxProps) {
  const colorClasses: Record<string, string> = {
    orange: "bg-orange-50 text-orange-600",
    teal: "bg-teal-50 text-teal-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
  }

  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl p-5 shadow-sm shadow-stone-100">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color] ?? colorClasses.orange}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-stone-800">{value}</p>
      <p className="text-sm text-stone-500 mt-1">{label}</p>
      {sublabel && <p className="text-xs text-stone-400 mt-0.5">{sublabel}</p>}
    </div>
  )
}

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
          Configurez un site WordPress pour voir les statistiques.
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

export function Reporting() {
  const { selectedSite, hasNoSites, isLoading: sitesLoading, isAllSitesSelected } = useSiteContext()
  const singleSiteData = useWpSiteData(selectedSite)
  const allSitesData = useAllSitesData({ enabled: isAllSitesSelected })

  const posts: WpPostListItem[] = isAllSitesSelected ? allSitesData.allPosts : singleSiteData.posts
  const dataLoading = isAllSitesSelected ? allSitesData.isLoading : singleSiteData.isLoading
  const categoriesWithStats = isAllSitesSelected
    ? flattenCategoryStatsPerSite(allSitesData.siteData)
    : singleSiteData.categoriesWithStats

  const isLoading = sitesLoading || dataLoading

  if (hasNoSites) {
    return <NoSitesMessage />
  }

  const globalPercentage = getUpToDatePercentage(posts)
  const updatesThisMonth = getUpdatesThisMonth(posts)
  const updatesThisWeek = getUpdatesThisWeek(posts)

  const categoryStats = categoriesWithStats
    .filter(c => c.upToDatePercent < 100)
    .slice(0, 10)

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <BarChart3 className="h-5 w-5 text-purple-600" />
          </div>
          <h1 className="text-xl font-semibold text-stone-800">Reporting</h1>
        </div>
        <p className="text-sm text-stone-500">
          {isAllSitesSelected 
            ? "Statistiques agrégées de tous les sites"
            : selectedSite 
              ? `Statistiques pour ${selectedSite.name}` 
              : "Vue d'ensemble de l'activité et de l'état des contenus"}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white/60 rounded-xl p-5 animate-pulse">
              <div className="h-4 bg-stone-100 rounded w-24 mb-3" />
              <div className="h-8 bg-stone-100 rounded w-16" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {isAllSitesSelected && allSitesData.hasPendingBundles && (
            <div className="mb-6">
              <BundleProgressBanner
                ready={allSitesData.bundlesReadyCount}
                total={allSitesData.bundlesTotalCount}
              />
            </div>
          )}

          {/* KPIs globaux */}
          <section className="mb-10">
            <h2 className="text-sm font-medium text-stone-500 mb-4">Vue globale</h2>
            <div className="grid grid-cols-4 gap-4">
              <StatBox
                label="Articles à jour"
                value={`${globalPercentage}%`}
                sublabel="modifiés < 1 an"
                icon={TrendingUp}
                color="teal"
              />
              <StatBox
                label="Mises à jour ce mois"
                value={updatesThisMonth}
                sublabel={`sur ${posts.length} articles`}
                icon={Calendar}
                color="blue"
              />
              <StatBox
                label="Mises à jour cette semaine"
                value={updatesThisWeek}
                icon={Calendar}
                color="orange"
              />
              <StatBox
                label="Total articles"
                value={posts.length}
                icon={BarChart3}
                color="purple"
              />
            </div>
          </section>

          {/* Catégories à prioriser */}
          <section>
            <h2 className="text-sm font-medium text-stone-500 mb-4">Catégories à prioriser</h2>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl shadow-sm shadow-stone-100 p-4">
              {categoryStats.length > 0 ? (
                <div className="space-y-2">
                  {categoryStats.map((cat) => (
                    <div 
                      key={
                        "siteId" in cat && cat.siteId
                          ? `${cat.siteId}-${cat.id}`
                          : String(cat.id)
                      }
                      className="flex items-center gap-4 px-3 py-2 rounded-lg hover:bg-stone-50"
                    >
                      <div className={`w-2 h-2 rounded-full ${
                        cat.upToDatePercent >= 80 ? "bg-teal-500" : 
                        cat.upToDatePercent >= 50 ? "bg-orange-400" : "bg-red-400"
                      }`} />
                      <span className="flex-1 text-stone-700">{cat.name}</span>
                      <span className="text-xs text-stone-400">{cat.count} art.</span>
                      <span className={`text-sm font-medium ${
                        cat.upToDatePercent >= 50 ? "text-orange-600" : "text-red-600"
                      }`}>
                        {cat.upToDatePercent}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-stone-500">
                  Toutes les catégories sont à jour
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
