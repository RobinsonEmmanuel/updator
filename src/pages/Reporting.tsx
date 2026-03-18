import { BarChart3, Users, Calendar, TrendingUp, User } from "lucide-react"
import { useSites, useClusters, useArticles } from "@/hooks"
import type { Actualiseur } from "@/types"

const actualiseurs: Actualiseur[] = ["Julie", "Myriam", "Claire", "Emmanuel"]

function getUpToDatePercentage(articles: { lastModifiedAt: string }[]): number {
  if (articles.length === 0) return 100
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const upToDate = articles.filter(a => new Date(a.lastModifiedAt) > oneYearAgo).length
  return Math.round((upToDate / articles.length) * 100)
}

function getUpdatesThisMonth(articles: { lastModifiedAt: string }[]): number {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return articles.filter(a => new Date(a.lastModifiedAt) >= startOfMonth).length
}

function getUpdatesThisWeek(articles: { lastModifiedAt: string }[]): number {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  return articles.filter(a => new Date(a.lastModifiedAt) >= startOfWeek).length
}

function simulateActualiseurUpdates(articles: { lastModifiedAt: string }[], actualiseurIndex: number): { month: number; week: number } {
  const monthUpdates = getUpdatesThisMonth(articles)
  const weekUpdates = getUpdatesThisWeek(articles)
  const weights = [0.35, 0.30, 0.25, 0.10]
  return {
    month: Math.round(monthUpdates * weights[actualiseurIndex]),
    week: Math.round(weekUpdates * weights[actualiseurIndex]),
  }
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

export function Reporting() {
  const { data: sites } = useSites()
  const { data: clusters } = useClusters()
  const { data: articles } = useArticles()

  const globalPercentage = getUpToDatePercentage(articles ?? [])
  const updatesThisMonth = getUpdatesThisMonth(articles ?? [])
  const updatesThisWeek = getUpdatesThisWeek(articles ?? [])

  const siteStats = sites?.map(site => {
    const siteArticles = articles?.filter(a => a.siteId === site.id) ?? []
    return {
      site,
      percentage: getUpToDatePercentage(siteArticles),
      monthUpdates: getUpdatesThisMonth(siteArticles),
      weekUpdates: getUpdatesThisWeek(siteArticles),
      totalArticles: siteArticles.length,
    }
  }).sort((a, b) => a.percentage - b.percentage)

  const actualiseurStats = actualiseurs.map((name, index) => {
    const stats = simulateActualiseurUpdates(articles ?? [], index)
    return {
      name,
      ...stats,
    }
  })

  const clusterStats = clusters?.map(cluster => {
    const clusterArticles = articles?.filter(a => a.clusterId === cluster.id) ?? []
    return {
      cluster,
      percentage: getUpToDatePercentage(clusterArticles),
      totalArticles: clusterArticles.length,
    }
  }).filter(c => c.percentage < 100).sort((a, b) => a.percentage - b.percentage).slice(0, 10)

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-100 rounded-lg">
            <BarChart3 className="h-5 w-5 text-purple-600" />
          </div>
          <h1 className="text-xl font-semibold text-stone-800">Reporting</h1>
        </div>
        <p className="text-sm text-stone-500">
          Vue d'ensemble de l'activité et de l'état des contenus
        </p>
      </div>

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
            sublabel={`sur ${articles?.length ?? 0} articles`}
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
            label="Actualiseurs actifs"
            value={actualiseurs.length}
            icon={Users}
            color="purple"
          />
        </div>
      </section>

      {/* Par actualiseur */}
      <section className="mb-10">
        <h2 className="text-sm font-medium text-stone-500 mb-4">Par actualiseur</h2>
        <div className="grid grid-cols-4 gap-4">
          {actualiseurStats.map((act) => (
            <div 
              key={act.name}
              className="bg-white/60 backdrop-blur-sm rounded-xl p-5 shadow-sm shadow-stone-100"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-orange-600" />
                </div>
                <span className="font-medium text-stone-700">{act.name}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-stone-500">Ce mois</span>
                  <span className="font-medium text-stone-700">{act.month} màj</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Cette semaine</span>
                  <span className="font-medium text-stone-700">{act.week} màj</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Par site */}
      <section className="mb-10">
        <h2 className="text-sm font-medium text-stone-500 mb-4">Par site</h2>
        <div className="bg-white/60 backdrop-blur-sm rounded-xl shadow-sm shadow-stone-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50/50">
                <th className="text-left font-medium text-stone-600 px-4 py-3">Site</th>
                <th className="text-center font-medium text-stone-600 px-4 py-3">Articles</th>
                <th className="text-center font-medium text-stone-600 px-4 py-3">% à jour</th>
                <th className="text-center font-medium text-stone-600 px-4 py-3">Ce mois</th>
                <th className="text-center font-medium text-stone-600 px-4 py-3">Cette semaine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {siteStats?.map(({ site, percentage, monthUpdates, weekUpdates, totalArticles }) => (
                <tr key={site.id} className="hover:bg-stone-50/50">
                  <td className="px-4 py-3 font-medium text-stone-700">{site.name}</td>
                  <td className="px-4 py-3 text-center text-stone-600">{totalArticles}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1.5 ${
                      percentage >= 80 ? "text-teal-600" : 
                      percentage >= 50 ? "text-orange-600" : "text-red-600"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        percentage >= 80 ? "bg-teal-500" : 
                        percentage >= 50 ? "bg-orange-400" : "bg-red-400"
                      }`} />
                      {percentage}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-stone-600">{monthUpdates}</td>
                  <td className="px-4 py-3 text-center text-stone-600">{weekUpdates}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Clusters en retard */}
      <section>
        <h2 className="text-sm font-medium text-stone-500 mb-4">Clusters à prioriser</h2>
        <div className="bg-white/60 backdrop-blur-sm rounded-xl shadow-sm shadow-stone-100 p-4">
          {clusterStats && clusterStats.length > 0 ? (
            <div className="space-y-2">
              {clusterStats.map(({ cluster, percentage, totalArticles }) => (
                <div 
                  key={cluster.id}
                  className="flex items-center gap-4 px-3 py-2 rounded-lg hover:bg-stone-50"
                >
                  <div className={`w-2 h-2 rounded-full ${
                    percentage >= 80 ? "bg-teal-500" : 
                    percentage >= 50 ? "bg-orange-400" : "bg-red-400"
                  }`} />
                  <span className="flex-1 text-stone-700">{cluster.name}</span>
                  <span className="text-xs text-stone-400">{totalArticles} art.</span>
                  <span className={`text-sm font-medium ${
                    percentage >= 50 ? "text-orange-600" : "text-red-600"
                  }`}>
                    {percentage}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-stone-500">
              Tous les clusters sont à jour
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
