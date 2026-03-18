import { useSearchParams, useNavigate } from "react-router-dom"
import { Search, X, Calendar, ChevronRight, Filter, FileEdit, Bell, ChevronDown } from "lucide-react"
import { useState, useMemo, useRef, useEffect } from "react"
import { useArticles, useClusters, useSites } from "@/hooks"
import { useSiteContext } from "@/lib/SiteContext"
import { cn } from "@/lib/utils"

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

type FilterType = "all" | "drafts" | "signals" | "outdated"

export function WorkQueue() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { selectedSiteId } = useSiteContext()
  
  const clusterId = searchParams.get("clusterId") ?? undefined
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const [clusterDropdownOpen, setClusterDropdownOpen] = useState(false)
  const clusterDropdownRef = useRef<HTMLDivElement>(null)

  const { data: articles, isLoading } = useArticles({ 
    siteId: selectedSiteId ?? undefined,
    clusterId 
  })
  const { data: clusters } = useClusters(selectedSiteId ?? undefined)
  const { data: sites } = useSites()

  const selectedCluster = clusters?.find(c => c.id === clusterId)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (clusterDropdownRef.current && !clusterDropdownRef.current.contains(event.target as Node)) {
        setClusterDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredArticles = useMemo(() => {
    if (!articles) return []
    
    let result = articles
    
    if (searchQuery) {
      result = result.filter(a => 
        a.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    switch (activeFilter) {
      case "drafts":
        result = result.filter(a => a.hasDraft)
        break
      case "signals":
        result = result.filter(a => a.hasSignals)
        break
      case "outdated":
        result = result.filter(a => isOlderThanOneYear(a.lastModifiedAt))
        break
    }

    return result
  }, [articles, searchQuery, activeFilter])

  const sortedArticles = useMemo(() => {
    return [...filteredArticles].sort((a, b) => 
      new Date(a.lastModifiedAt).getTime() - new Date(b.lastModifiedAt).getTime()
    )
  }, [filteredArticles])

  const clearClusterFilter = () => {
    searchParams.delete("clusterId")
    setSearchParams(searchParams)
  }

  const selectCluster = (id: string | null) => {
    if (id) {
      searchParams.set("clusterId", id)
    } else {
      searchParams.delete("clusterId")
    }
    setSearchParams(searchParams)
    setClusterDropdownOpen(false)
  }

  const getClusterName = (articleClusterId: string) => {
    return clusters?.find(c => c.id === articleClusterId)?.name ?? ""
  }

  const getSiteName = (siteId: string) => {
    return sites?.find(s => s.id === siteId)?.name ?? ""
  }

  const filterButtons: { id: FilterType; label: string; icon?: typeof FileEdit }[] = [
    { id: "all", label: "Tous" },
    { id: "outdated", label: "À actualiser" },
    { id: "drafts", label: "Brouillons", icon: FileEdit },
    { id: "signals", label: "Avec signaux", icon: Bell },
  ]

  const draftsCount = articles?.filter(a => a.hasDraft).length ?? 0
  const signalsCount = articles?.filter(a => a.hasSignals).length ?? 0
  const outdatedCount = articles?.filter(a => isOlderThanOneYear(a.lastModifiedAt)).length ?? 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-stone-800 mb-1">File de travail</h1>
        <p className="text-sm text-stone-500">
          Gérez vos articles à mettre à jour
        </p>
      </div>

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

        {/* Dropdown cluster */}
        <div className="relative" ref={clusterDropdownRef}>
          <button
            onClick={() => setClusterDropdownOpen(!clusterDropdownOpen)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border",
              selectedCluster 
                ? "bg-orange-50 text-orange-700 border-orange-200" 
                : "bg-white/60 text-stone-600 border-stone-200 hover:bg-stone-50"
            )}
          >
            <Filter className="h-4 w-4" />
            <span>{selectedCluster?.name ?? "Tous les clusters"}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", clusterDropdownOpen && "rotate-180")} />
          </button>

          {clusterDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl shadow-lg shadow-stone-200/50 border border-stone-100 py-1 z-50 max-h-64 overflow-auto">
              <button
                onClick={() => selectCluster(null)}
                className={cn(
                  "w-full text-left px-4 py-2 text-sm transition-colors",
                  !clusterId ? "bg-orange-50 text-orange-700" : "text-stone-600 hover:bg-stone-50"
                )}
              >
                Tous les clusters
              </button>
              <div className="h-px bg-stone-100 my-1" />
              {clusters?.map(cluster => (
                <button
                  key={cluster.id}
                  onClick={() => selectCluster(cluster.id)}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm transition-colors",
                    clusterId === cluster.id ? "bg-orange-50 text-orange-700" : "text-stone-600 hover:bg-stone-50"
                  )}
                >
                  {cluster.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedCluster && (
          <button
            onClick={clearClusterFilter}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Boutons de filtre type */}
      <div className="flex items-center gap-2 mb-6">
        {filterButtons.map(btn => {
          const count = btn.id === "drafts" ? draftsCount : btn.id === "signals" ? signalsCount : btn.id === "outdated" ? outdatedCount : null
          return (
            <button
              key={btn.id}
              onClick={() => setActiveFilter(btn.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                activeFilter === btn.id
                  ? "bg-orange-100 text-orange-700"
                  : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
              )}
            >
              {btn.icon && <btn.icon className="h-3.5 w-3.5" />}
              <span>{btn.label}</span>
              {count !== null && count > 0 && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  activeFilter === btn.id ? "bg-orange-200 text-orange-800" : "bg-stone-200 text-stone-600"
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Résumé */}
      <p className="text-sm text-stone-500 mb-4">
        {sortedArticles.length} article{sortedArticles.length > 1 ? 's' : ''} 
        {activeFilter !== "all" && ` (filtre actif)`}
      </p>

      {/* Liste des articles */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-stone-400">
          Chargement...
        </div>
      ) : sortedArticles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-stone-400">
          <p>Aucun article trouvé</p>
          {activeFilter !== "all" && (
            <button 
              onClick={() => setActiveFilter("all")}
              className="mt-2 text-sm text-orange-600 hover:underline"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white/60 backdrop-blur-sm rounded-xl shadow-sm shadow-stone-100 divide-y divide-stone-100">
          {sortedArticles.map((article) => (
            <button
              key={article.id}
              onClick={() => navigate(`/article/${article.id}`)}
              className="w-full flex items-center gap-4 px-4 py-3 hover:bg-stone-50 transition-colors text-left group"
            >
              {/* Indicateur ancienneté */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isOlderThanOneYear(article.lastModifiedAt) ? "bg-red-400" : "bg-teal-400"
              }`} />

              {/* Titre & info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-stone-700 truncate group-hover:text-stone-900">
                  {article.title}
                </h3>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-400">
                  {!selectedSiteId && (
                    <>
                      <span>{getSiteName(article.siteId)}</span>
                      <span>·</span>
                    </>
                  )}
                  {!clusterId && (
                    <>
                      <span>{getClusterName(article.clusterId)}</span>
                      <span>·</span>
                    </>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(article.lastModifiedAt)}
                  </span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2">
                {article.hasDraft && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                    <FileEdit className="h-3 w-3" />
                    brouillon
                  </span>
                )}
                {article.hasSignals && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">
                    <Bell className="h-3 w-3" />
                    signal
                  </span>
                )}
              </div>

              <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
