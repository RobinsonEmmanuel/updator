import { useSearchParams, Link, useNavigate } from "react-router-dom"
import { Search, X, Calendar, ChevronRight, Filter, Clock, ChevronDown, Settings, Loader2, ExternalLink } from "lucide-react"
import { useState, useMemo, useRef, useEffect } from "react"
import { BundleProgressBanner } from "@/components/shared"
import { useWpSiteData, useAllSitesData, type WpPostWithSite } from "@/hooks"
import { useSiteContext } from "@/lib/SiteContext"
import { cn } from "@/lib/utils"
import type { WpPostListItem, WpCategoryListItem } from "@/types/wordpress"

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return "Hier"
  if (diffDays < 30) return `Il y a ${diffDays} jours`
  if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`
  return `Il y a ${Math.floor(diffDays / 365)} an${Math.floor(diffDays / 365) > 1 ? 's' : ''}`
}

function isOlderThanOneYear(dateString: string): boolean {
  const date = new Date(dateString)
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  return date < oneYearAgo
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
}

type FilterType = "outdated"

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
          Pour voir vos articles, ajoutez un site WordPress dans les paramètres.
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

export function WorkQueue() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { selectedSite, hasNoSites, isLoading: sitesLoading, isAllSitesSelected } = useSiteContext()
  const navigate = useNavigate()
  
  const categoryId = searchParams.get("categoryId")
    ? parseInt(searchParams.get("categoryId")!, 10)
    : undefined
  const siteIdFilter = searchParams.get("siteId") || undefined
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set())
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)

  const singleSiteData = useWpSiteData(selectedSite)
  const allSitesData = useAllSitesData({ enabled: isAllSitesSelected })

  const posts: WpPostListItem[] = isAllSitesSelected ? allSitesData.allPosts : singleSiteData.posts
  const categories: WpCategoryListItem[] = isAllSitesSelected ? allSitesData.allCategories : singleSiteData.categories
  const dataLoading = isAllSitesSelected ? allSitesData.isLoading : singleSiteData.isLoading

  const selectedCategory = useMemo(() => {
    if (categoryId === undefined) return undefined
    if (siteIdFilter && isAllSitesSelected) {
      const sd = allSitesData.siteData.find((s) => s.siteId === siteIdFilter)
      return sd?.categories.find((c) => c.id === categoryId)
    }
    return categories?.find((c) => c.id === categoryId)
  }, [categoryId, siteIdFilter, isAllSitesSelected, categories, allSitesData.siteData])
  const isLoading = sitesLoading || dataLoading

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const toggleFilter = (filter: FilterType) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(filter)) {
        next.delete(filter)
      } else {
        next.add(filter)
      }
      return next
    })
  }

  const clearFilters = () => {
    setActiveFilters(new Set())
  }

  const filteredPosts = useMemo(() => {
    if (!posts) return []
    
    let result: WpPostListItem[] = posts

    if (categoryId !== undefined) {
      result = result.filter((p) => {
        if (!p.categories.includes(categoryId)) return false
        if (siteIdFilter) {
          const wp = p as WpPostWithSite
          return wp._siteId === siteIdFilter
        }
        return true
      })
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(p => 
        decodeHtmlEntities(p.title.rendered).toLowerCase().includes(query)
      )
    }

    if (activeFilters.has("outdated")) {
      result = result.filter(p => isOlderThanOneYear(p.modified))
    }

    return result
  }, [posts, categoryId, siteIdFilter, searchQuery, activeFilters])

  const sortedPosts = useMemo(() => {
    return [...filteredPosts].sort((a, b) => 
      new Date(a.modified).getTime() - new Date(b.modified).getTime()
    )
  }, [filteredPosts])

  const clearCategoryFilter = () => {
    searchParams.delete("categoryId")
    searchParams.delete("siteId")
    setSearchParams(searchParams)
  }

  const selectCategory = (id: number | null, forSiteId?: string) => {
    if (id) {
      searchParams.set("categoryId", id.toString())
      if (forSiteId) searchParams.set("siteId", forSiteId)
      else searchParams.delete("siteId")
    } else {
      searchParams.delete("categoryId")
      searchParams.delete("siteId")
    }
    setSearchParams(searchParams)
    setCategoryDropdownOpen(false)
  }

  const categoryDropdownItems = useMemo(() => {
    if (isAllSitesSelected) {
      return allSitesData.siteData.flatMap((sd) =>
        sd.categories
          .filter((c) => c.count > 0)
          .map((c) => ({
            category: c,
            siteId: sd.siteId,
            siteName: sd.siteName,
          }))
      )
    }
    return (categories ?? [])
      .filter((c) => c.count > 0)
      .map((c) => ({
        category: c,
        siteId: undefined as string | undefined,
        siteName: undefined as string | undefined,
      }))
  }, [isAllSitesSelected, allSitesData.siteData, categories])

  const getCategoryName = (post: WpPostListItem) => {
    const wp = post as WpPostWithSite
    if (isAllSitesSelected && wp._siteId) {
      const sd = allSitesData.siteData.find((s) => s.siteId === wp._siteId)
      const cat = sd?.categories.find((c) => post.categories.includes(c.id))
      return cat?.name ?? "Sans catégorie"
    }
    const cat = categories?.find((c) => post.categories.includes(c.id))
    return cat?.name ?? "Sans catégorie"
  }

  const outdatedCount = posts?.filter(p => isOlderThanOneYear(p.modified)).length ?? 0
  const hasActiveFilters = activeFilters.size > 0

  if (hasNoSites) {
    return <NoSitesMessage />
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-stone-800 mb-1">File de travail</h1>
        <p className="text-sm text-stone-500">
          {isAllSitesSelected 
            ? "Articles de tous les sites" 
            : selectedSite 
              ? `Articles de ${selectedSite.name}` 
              : "Gérez vos articles à mettre à jour"}
        </p>
      </div>

      {isAllSitesSelected && allSitesData.hasPendingBundles && (
        <div className="mb-5">
          <BundleProgressBanner
            ready={allSitesData.bundlesReadyCount}
            total={allSitesData.bundlesTotalCount}
          />
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            placeholder="Rechercher un article..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/60 backdrop-blur-sm border border-stone-200 rounded-xl text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300"
          />
        </div>

        {/* Dropdown catégorie */}
        <div className="relative" ref={categoryDropdownRef}>
          <button
            onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border",
              selectedCategory 
                ? "bg-orange-50 text-orange-700 border-orange-200" 
                : "bg-white/60 text-stone-600 border-stone-200 hover:bg-stone-50"
            )}
          >
            <Filter className="h-4 w-4" />
            <span>{selectedCategory?.name ?? "Toutes les catégories"}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", categoryDropdownOpen && "rotate-180")} />
          </button>

          {categoryDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-lg shadow-stone-200/50 border border-stone-100 py-1 z-50 max-h-64 overflow-auto">
              <button
                onClick={() => selectCategory(null)}
                className={cn(
                  "w-full text-left px-4 py-2 text-sm transition-colors",
                  !categoryId ? "bg-orange-50 text-orange-700" : "text-stone-600 hover:bg-stone-50"
                )}
              >
                Toutes les catégories
              </button>
              <div className="h-px bg-stone-100 my-1" />
              {categoryDropdownItems.map(({ category, siteId: optSiteId, siteName }) => (
                <button
                  key={optSiteId ? `${optSiteId}-${category.id}` : String(category.id)}
                  type="button"
                  onClick={() => selectCategory(category.id, optSiteId)}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between",
                    categoryId === category.id && (siteIdFilter ? siteIdFilter === optSiteId : !optSiteId)
                      ? "bg-orange-50 text-orange-700"
                      : "text-stone-600 hover:bg-stone-50"
                  )}
                >
                  <span className="truncate">
                    {siteName ? (
                      <>
                        <span className="text-stone-400">{siteName} · </span>
                        {category.name}
                      </>
                    ) : (
                      category.name
                    )}
                  </span>
                  <span className="text-xs text-stone-400 shrink-0">{category.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedCategory && (
          <button
            onClick={clearCategoryFilter}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Boutons de filtre type (cumulables) */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs text-stone-400 mr-1">Filtres :</span>
        <button
          onClick={() => toggleFilter("outdated")}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
            activeFilters.has("outdated")
              ? "bg-orange-100 text-orange-700 border-orange-200"
              : "text-stone-500 hover:bg-stone-100 hover:text-stone-700 border-transparent"
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>À actualiser (&gt;1 an)</span>
          {outdatedCount > 0 && (
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded-full",
              activeFilters.has("outdated") ? "bg-orange-200 text-orange-800" : "bg-stone-200 text-stone-600"
            )}>
              {outdatedCount}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="ml-2 text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Effacer
          </button>
        )}
      </div>

      {/* Résumé */}
      <p className="text-sm text-stone-500 mb-4">
        {sortedPosts.length} article{sortedPosts.length > 1 ? 's' : ''} 
        {hasActiveFilters && (
          <span className="text-orange-600"> (obsolètes uniquement)</span>
        )}
      </p>

      {/* Liste des articles */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center h-64">
          <Loader2 className="h-8 w-8 text-orange-500 animate-spin mb-4" />
          <p className="text-stone-500 text-sm">Chargement des articles...</p>
        </div>
      ) : sortedPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-stone-400">
          <p>Aucun article trouvé</p>
          {hasActiveFilters && (
            <button 
              onClick={clearFilters}
              className="mt-2 text-sm text-orange-600 hover:underline"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white/60 backdrop-blur-sm rounded-xl shadow-sm shadow-stone-100 divide-y divide-stone-100">
          {sortedPosts.map((post) => {
            const wpPost = post as WpPostWithSite
            const targetSiteId = wpPost._siteId || selectedSite?._id
            const rowKey = targetSiteId ? `${targetSiteId}-${post.id}` : String(post.id)
            const canOpenUpdateWorkspace = typeof targetSiteId === "string" && targetSiteId.length > 0
            return (
              <div
                key={rowKey}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 transition-colors text-left group",
                  canOpenUpdateWorkspace ? "hover:bg-stone-50 cursor-pointer" : "hover:bg-stone-50"
                )}
                onClick={() => {
                  if (!canOpenUpdateWorkspace || !targetSiteId) return
                  navigate(`/queue/article-update/${targetSiteId}/${post.id}`)
                }}
                role={canOpenUpdateWorkspace ? "button" : undefined}
                tabIndex={canOpenUpdateWorkspace ? 0 : -1}
                onKeyDown={(event) => {
                  if (!canOpenUpdateWorkspace || !targetSiteId) return
                  if (event.key !== "Enter" && event.key !== " ") return
                  event.preventDefault()
                  navigate(`/queue/article-update/${targetSiteId}/${post.id}`)
                }}
              >
                {/* Indicateur ancienneté */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isOlderThanOneYear(post.modified) ? "bg-red-400" : "bg-teal-400"
                }`} />

                {/* Titre & info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-stone-700 truncate group-hover:text-stone-900">
                    {decodeHtmlEntities(post.title.rendered)}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-400">
                    {!categoryId && (
                      <>
                        <span>{getCategoryName(post)}</span>
                        <span>·</span>
                      </>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(post.modified)}
                    </span>
                  </div>
                </div>

                <a
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 px-2 py-1 rounded hover:bg-stone-100"
                >
                  WP
                  <ExternalLink className="h-3 w-3" />
                </a>
                <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-400" />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
