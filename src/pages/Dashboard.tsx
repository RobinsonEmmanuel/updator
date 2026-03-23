import { Link, useNavigate } from "react-router-dom"
import { FileText, CheckCircle, Clock, ExternalLink, Settings, Loader2 } from "lucide-react"
import { StatCard, SignalPanel } from "@/components/shared"
import { useWpSiteData, useOpenSignals, useAllSitesData, type WpPostWithSite } from "@/hooks"
import { useSiteContext } from "@/lib/SiteContext"
import type { WpPost, WpCategory } from "@/types/wordpress"

function formatAge(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (days < 30) return `${days}j`
  if (days < 365) {
    const months = Math.floor(days / 30)
    return `${months} mois`
  }
  const years = Math.floor(days / 365)
  return `${years} an${years > 1 ? "s" : ""}`
}

function getPercentageColor(percentage: number): string {
  if (percentage >= 80) return "bg-teal-500"
  if (percentage >= 50) return "bg-orange-400"
  return "bg-red-400"
}

interface CategoryRowProps {
  category: WpCategory & { posts: WpPost[]; upToDatePercent: number }
}

function CategoryRow({ category }: CategoryRowProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/queue?categoryId=${category.id}`)
  }

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-stone-50 transition-colors text-left group"
    >
      <div className="flex items-center gap-2 w-14">
        <div className={`w-2 h-2 rounded-full ${getPercentageColor(category.upToDatePercent)}`} />
        <span className="text-xs text-stone-400 tabular-nums">{category.upToDatePercent}%</span>
      </div>

      <span className="text-sm text-stone-600 flex-1 truncate group-hover:text-stone-800">
        {category.name}
      </span>

      <span className="text-xs text-stone-400 tabular-nums">
        {category.count} art.
      </span>
    </button>
  )
}

interface PriorityArticleProps {
  post: WpPost | WpPostWithSite
  categories: WpCategory[]
  showSite?: boolean
}

function PriorityArticle({ post, categories, showSite = false }: PriorityArticleProps) {
  const category = categories.find(c => post.categories.includes(c.id))
  const postWithSite = post as WpPostWithSite
  const siteName = postWithSite._siteName
  const siteId = postWithSite._siteId
  
  const articleUrl = siteId 
    ? `/article/${post.id}?siteId=${siteId}` 
    : `/article/${post.id}`

  return (
    <Link
      to={articleUrl}
      className="block p-2.5 rounded-lg hover:bg-stone-50 transition-colors group"
    >
      <p className="text-sm text-stone-700 truncate group-hover:text-orange-600 transition-colors">
        {post.title.rendered.replace(/&#8217;/g, "'").replace(/&amp;/g, "&")}
      </p>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        {showSite && siteName && (
          <>
            <span className="text-xs text-orange-500 font-medium">{siteName}</span>
            <span className="text-xs text-stone-300">•</span>
          </>
        )}
        <span className="text-xs text-stone-400">{category?.name || "Sans catégorie"}</span>
        <span className="text-xs text-stone-300">•</span>
        <span className="text-xs text-stone-400">
          modifié il y a {formatAge(post.modified)}
        </span>
      </div>
    </Link>
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
          Pour commencer, ajoutez votre premier site WordPress dans les paramètres.
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

interface CategoryWithStats extends WpCategory {
  posts: WpPost[]
  outdatedCount: number
  upToDatePercent: number
}

function computeCategoryStats(posts: WpPost[], categories: WpCategory[]): CategoryWithStats[] {
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
  const isOutdated = (p: WpPost) => Date.now() - new Date(p.modified).getTime() > ONE_YEAR_MS

  return categories
    .filter(cat => cat.count > 0)
    .map(cat => {
      const catPosts = posts.filter(p => p.categories.includes(cat.id))
      const outdatedCount = catPosts.filter(isOutdated).length
      const upToDateCount = catPosts.length - outdatedCount
      return {
        ...cat,
        posts: catPosts,
        outdatedCount,
        upToDatePercent: catPosts.length > 0 
          ? Math.round((upToDateCount / catPosts.length) * 100)
          : 100,
      }
    })
    .sort((a, b) => a.upToDatePercent - b.upToDatePercent)
}

export function Dashboard() {
  const { selectedSite, sites, isLoading: sitesLoading, hasNoSites, isAllSitesSelected } = useSiteContext()
  const singleSiteData = useWpSiteData(selectedSite)
  const allSitesData = useAllSitesData()
  const { data: signals } = useOpenSignals(isAllSitesSelected ? undefined : selectedSite?._id)

  const posts = isAllSitesSelected ? allSitesData.allPosts : singleSiteData.posts
  const categories = isAllSitesSelected ? allSitesData.allCategories : singleSiteData.categories
  const dataLoading = isAllSitesSelected ? allSitesData.isLoading : singleSiteData.isLoading
  const stats = isAllSitesSelected ? allSitesData.stats : singleSiteData.stats
  const priorityPosts = isAllSitesSelected ? allSitesData.priorityPosts : singleSiteData.priorityPosts
  const categoriesWithStats = isAllSitesSelected 
    ? computeCategoryStats(posts, categories)
    : singleSiteData.categoriesWithStats

  const isLoading = sitesLoading || dataLoading

  if (hasNoSites) {
    return <NoSitesMessage />
  }

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 text-orange-500 animate-spin mb-4" />
        <p className="text-stone-500 text-sm">
          Chargement des articles depuis WordPress...
        </p>
      </div>
    )
  }

  const signalsCount = signals?.length ?? 0

  const title = isAllSitesSelected ? "Tous les sites" : selectedSite?.name
  const subtitle = isAllSitesSelected 
    ? `${sites.length} sites · ${stats.total} articles au total`
    : `${stats.total} articles · ${categories.length} catégories`

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-5">
        <StatCard
          label="À traiter"
          value={stats.outdated}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label="Faits aujourd'hui"
          value={stats.updatedToday}
          icon={<CheckCircle className="h-4 w-4" />}
          variant="success"
        />
        <StatCard
          label="Total articles"
          value={stats.total}
          icon={<FileText className="h-4 w-4" />}
        />
        <StatCard
          label="Ancienneté moy."
          value={`${stats.avgAgeDays}j`}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Categories */}
        <div className="col-span-2 space-y-4">
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide">
            {isAllSitesSelected ? "Catégories à prioriser" : title}
          </h2>
          <div className="bg-white/60 backdrop-blur-sm rounded-xl overflow-hidden shadow-sm shadow-stone-100">
            <div className="p-4 border-b border-stone-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-stone-800">{title}</h3>
                  {!isAllSitesSelected && selectedSite && (
                    <a
                      href={selectedSite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stone-300 hover:text-stone-500 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <span className="text-xs text-stone-400">{subtitle}</span>
              </div>
            </div>

            <div className="p-2 max-h-96 overflow-y-auto">
              {categoriesWithStats.map((category) => (
                <CategoryRow key={category.id} category={category} />
              ))}
              {categoriesWithStats.length === 0 && (
                <p className="text-sm text-stone-400 p-3 text-center">
                  Aucune catégorie avec des articles
                </p>
              )}
            </div>
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
              {priorityPosts.length > 0 ? (
                <div className="space-y-1">
                  {priorityPosts.map((post) => (
                    <PriorityArticle key={post.id} post={post} categories={categories} showSite={isAllSitesSelected} />
                  ))}
                </div>
              ) : (
                <p className="text-stone-400 text-sm py-4 text-center">
                  Aucun article à traiter
                </p>
              )}
            </div>
          </div>

          {/* Signaux */}
          <div>
            <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-4">
              Signaux {signalsCount > 0 && `(${signalsCount})`}
            </h2>
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 shadow-sm shadow-stone-100">
              <SignalPanel siteId={isAllSitesSelected ? undefined : selectedSite?._id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
