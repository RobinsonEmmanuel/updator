import { useState, useMemo } from "react"
import { Search, RefreshCw, ChevronRight, Code2, Loader2, AlertCircle, FileCode2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useWpConfig } from "@/lib/WpConfigContext"
import { useReusableBlocksBySite, useSyncReusableBlocks } from "@/hooks/useReusableBlocks"
import type { ReusableBlock } from "@/hooks/useReusableBlocks"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function blockRef(wpBlockId: number) {
  return `<!-- wp:block {"ref":${wpBlockId}} -->`
}

// ─── Block detail panel ───────────────────────────────────────────────────────

function BlockDetail({ block, onClose }: { block: ReusableBlock; onClose: () => void }) {
  const [copied, setCopied] = useState<"ref" | "content" | null>(null)

  const copy = (text: string, type: "ref" | "content") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  return (
    <div className="flex flex-col h-full border-l border-stone-200 bg-white min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-stone-100">
        <div className="min-w-0">
          <h2 className="font-semibold text-stone-900 leading-tight">{block.title || block.slug || `Bloc #${block.wp_block_id}`}</h2>
          <div className="flex items-center gap-3 mt-1 text-xs text-stone-400">
            <span>ID WordPress : <strong className="text-stone-600">#{block.wp_block_id}</strong></span>
            {block.status && (
              <span className={cn(
                "px-1.5 py-0.5 rounded border text-[10px] font-medium",
                block.status === "publish" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-stone-50 border-stone-200 text-stone-500"
              )}>
                {block.status}
              </span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Meta */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {block.slug && (
            <div>
              <div className="text-xs text-stone-400 mb-0.5">Slug</div>
              <div className="font-mono text-xs text-stone-700 bg-stone-50 px-2 py-1 rounded border border-stone-100">{block.slug}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-stone-400 mb-0.5">Dernière modif WP</div>
            <div className="text-stone-700">{formatDate(block.wp_modified_at)}</div>
          </div>
          <div>
            <div className="text-xs text-stone-400 mb-0.5">Synchronisé le</div>
            <div className="text-stone-700">{formatDate(block.synced_at)}</div>
          </div>
        </div>

        {/* Référence à insérer */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Référence WordPress</span>
            <button
              onClick={() => copy(blockRef(block.wp_block_id), "ref")}
              className="text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              {copied === "ref" ? "Copié ✓" : "Copier"}
            </button>
          </div>
          <pre className="text-[11px] bg-stone-900 text-emerald-400 rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all">
            {blockRef(block.wp_block_id)}
          </pre>
        </div>

        {/* Contenu brut */}
        {block.content && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Contenu HTML</span>
              <button
                onClick={() => copy(block.content!, "content")}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium"
              >
                {copied === "content" ? "Copié ✓" : "Copier"}
              </button>
            </div>
            <pre className="text-[11px] bg-stone-50 border border-stone-200 text-stone-700 rounded-lg px-3 py-2.5 overflow-x-auto max-h-64 whitespace-pre-wrap break-words">
              {block.content}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Block list item ──────────────────────────────────────────────────────────

function BlockRow({
  block,
  isSelected,
  onSelect,
}: {
  block: ReusableBlock
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-4 py-3 border-b border-stone-100 flex items-center gap-3 transition-colors group",
        isSelected ? "bg-orange-50" : "hover:bg-stone-50"
      )}
    >
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
        isSelected ? "bg-orange-100 text-orange-600" : "bg-stone-100 text-stone-400 group-hover:bg-stone-200"
      )}>
        <FileCode2 className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className={cn("font-medium text-sm truncate", isSelected ? "text-orange-900" : "text-stone-800")}>
          {block.title || block.slug || `#${block.wp_block_id}`}
        </div>
        <div className="text-xs text-stone-400 flex items-center gap-2 mt-0.5">
          <span>#{block.wp_block_id}</span>
          {block.status && block.status !== "publish" && (
            <span className="text-stone-300">· {block.status}</span>
          )}
          {block.synced_at && (
            <span className="text-stone-300">· {formatDate(block.synced_at)}</span>
          )}
        </div>
      </div>
      <ChevronRight className={cn("h-4 w-4 flex-shrink-0", isSelected ? "text-orange-400" : "text-stone-200 group-hover:text-stone-400")} />
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ReusableBlocks() {
  const { connectedSites } = useWpConfig()
  const [manualSiteId, setManualSiteId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [selectedBlock, setSelectedBlock] = useState<ReusableBlock | null>(null)

  // Toujours résolu : la sélection manuelle ou le premier site disponible
  const selectedSiteId = manualSiteId ?? connectedSites[0]?._id ?? ""

  const { data: blocks = [], isLoading, error, refetch } = useReusableBlocksBySite(selectedSiteId || null, query)
  const syncMutation = useSyncReusableBlocks(selectedSiteId || null)

  const selectedSiteName = useMemo(
    () => connectedSites.find((s) => s._id === selectedSiteId)?.name ?? selectedSiteId,
    [connectedSites, selectedSiteId]
  )

  const handleSync = () => {
    syncMutation.mutate(undefined, {
      onSuccess: () => refetch(),
    })
  }

  // When site changes, reset selection
  const handleSiteChange = (id: string) => {
    setManualSiteId(id)
    setSelectedBlock(null)
    setQuery("")
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b border-stone-100 bg-white">
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-stone-400" />
          <h1 className="text-lg font-bold text-stone-900">Blocs réutilisables</h1>
        </div>

        {/* Site selector */}
        {connectedSites.length > 0 && (
          <select
            value={selectedSiteId}
            onChange={(e) => handleSiteChange(e.target.value)}
            className="ml-2 text-sm border border-stone-200 rounded-lg px-3 py-1.5 bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            {connectedSites.map((site) => (
              <option key={site._id} value={site._id}>
                {site.name}
              </option>
            ))}
          </select>
        )}

        {/* Search */}
        <div className="flex-1 max-w-xs relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Rechercher un bloc…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-stone-200 rounded-lg bg-white text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Bloc count */}
          {!isLoading && blocks.length > 0 && (
            <span className="text-xs text-stone-400">
              {blocks.length} bloc{blocks.length !== 1 ? "s" : ""}
            </span>
          )}

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={!selectedSiteId || syncMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncMutation.isPending && "animate-spin")} />
            {syncMutation.isPending ? "Sync…" : "Synchroniser"}
          </button>
        </div>
      </div>

      {/* Sync feedback */}
      {syncMutation.isError && (
        <div className="flex-shrink-0 mx-6 mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {syncMutation.error?.message}
        </div>
      )}
      {syncMutation.isSuccess && (
        <div className="flex-shrink-0 mx-6 mt-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Synchronisation terminée pour <strong>{selectedSiteName}</strong>.
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* List */}
        <div className={cn("flex flex-col overflow-hidden", selectedBlock ? "w-80 flex-shrink-0" : "flex-1")}>
          {!selectedSiteId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-stone-400 gap-2 p-6">
              <Code2 className="h-8 w-8 text-stone-300" />
              <p className="text-sm">Connectez d'abord un site WordPress dans les paramètres.</p>
            </div>
          ) : isLoading ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-stone-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Chargement…</span>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-red-500 p-6">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">Impossible de charger les blocs. Avez-vous synchronisé ce site ?</span>
            </div>
          ) : blocks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-stone-400 gap-3 p-6">
              <FileCode2 className="h-8 w-8 text-stone-300" />
              <div className="text-center">
                <p className="text-sm font-medium text-stone-500">Aucun bloc trouvé</p>
                <p className="text-xs text-stone-400 mt-1">
                  {query ? `Aucun résultat pour « ${query} »` : "Lancez une synchronisation pour importer les blocs WordPress."}
                </p>
              </div>
              {!query && (
                <button
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", syncMutation.isPending && "animate-spin")} />
                  Synchroniser maintenant
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {blocks.map((block) => (
                <BlockRow
                  key={block._id ?? block.wp_block_id}
                  block={block}
                  isSelected={selectedBlock?.wp_block_id === block.wp_block_id}
                  onSelect={() => setSelectedBlock(block)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedBlock && (
          <div className="flex-1 min-w-0 overflow-hidden">
            <BlockDetail block={selectedBlock} onClose={() => setSelectedBlock(null)} />
          </div>
        )}
      </div>
    </div>
  )
}
