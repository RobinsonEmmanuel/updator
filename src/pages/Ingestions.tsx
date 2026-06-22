import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { Globe, Server, Link2, Play, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, ChevronDown, ExternalLink, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSiteContext } from "@/lib/SiteContext"
import {
  formatPoiEntityKind,
  formatPoiExtractionAction,
  formatPoiRelevance,
} from "@/features/article-poi-catchup/poiExtractionContract"
import {
  useIngestionStatus,
  useIngestionRuns,
  useTriggerIngestion,
  useTriggerSiteIngestion,
  useTriggerUrlIngestion,
  useResolveArticleUrl,
  useArticleRaw,
  type IngestionRun,
  type ResolvedArticle,
  type ArticleRaw,
} from "@/hooks/useIngestions"

function formatDurationMs(ms?: number): string {
  if (ms == null) return "—"
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  return rem > 0 ? `${min}m ${rem}s` : `${min}m`
}

function formatRunningDuration(startedAt?: string): string {
  if (!startedAt) return "—"
  const ms = Date.now() - new Date(startedAt).getTime()
  return formatDurationMs(ms)
}

function formatDate(iso?: string): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase()
  if (s === "queued" || s === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
        <RefreshCw className="h-3 w-3 animate-spin" />
        {s === "queued" ? "En attente" : "En cours"}
      </span>
    )
  }
  if (s === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Terminé
      </span>
    )
  }
  if (s === "completed_with_errors") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
        <AlertCircle className="h-3 w-3" />
        Terminé avec erreurs
      </span>
    )
  }
  if (s === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
        <XCircle className="h-3 w-3" />
        Échec
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
      <Clock className="h-3 w-3" />
      {status || "—"}
    </span>
  )
}

function RunSummary({ run }: { run: IngestionRun }) {
  const items: { label: string; value: number; danger?: boolean }[] = []
  if (run.counts) {
    if (run.counts.ok > 0) items.push({ label: "ok", value: run.counts.ok })
    if (run.counts.skipped > 0) items.push({ label: "ignorés", value: run.counts.skipped })
    if (run.counts.failed > 0) items.push({ label: "échecs", value: run.counts.failed, danger: true })
  }
  if (run.totals) {
    if (run.totals.inserted > 0) items.push({ label: "insérés", value: run.totals.inserted })
    if (run.totals.updated > 0) items.push({ label: "mis à jour", value: run.totals.updated })
    if (run.totals.errorsCount > 0) items.push({ label: "erreurs", value: run.totals.errorsCount, danger: true })
  }
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-3 mt-1">
      {items.map((item) => (
        <span key={item.label} className="text-xs text-stone-500">
          <span className={cn("font-medium", item.danger ? "text-red-600" : "text-stone-700")}>
            {item.value}
          </span>{" "}
          {item.label}
        </span>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-stone-100 last:border-0">
      <span className="text-xs text-stone-400 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-stone-700 flex-1 min-w-0 break-words">{children}</span>
    </div>
  )
}

function ArticleRawModal({ siteId, wpId, siteName, onClose }: { siteId: string; wpId: number; siteName: string; onClose: () => void }) {
  const { data, isLoading, error } = useArticleRaw(siteId, wpId)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-stone-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-stone-800">Résultat articles_raw</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              {siteName} · WP ID <span className="font-mono">{wpId}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-2">
          {isLoading && (
            <div className="flex items-center gap-2 py-8 justify-center text-sm text-stone-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Chargement…
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 py-8 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error.message}
            </div>
          )}
          {data && <ArticleRawFields doc={data} />}
        </div>
      </div>
    </div>,
    document.body
  )
}

function ArticleRawFields({ doc }: { doc: ArticleRaw }) {
  return (
    <div>
      <Field label="Titre">{doc.title}</Field>
      <Field label="Slug">{doc.slug}</Field>
      <Field label="Statut WP">
        <span className={cn(
          "px-1.5 py-0.5 rounded text-xs font-medium",
          doc.post_status === "publish" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"
        )}>
          {doc.post_status}
        </span>
      </Field>
      <Field label="Auteur">{doc.author_name || "—"}</Field>
      <Field label="Catégories">{doc.categories?.join(", ") || "—"}</Field>
      {doc.tags && doc.tags.length > 0 && (
        <Field label="Tags">{doc.tags.join(", ")}</Field>
      )}
      {doc.meta_description && (
        <Field label="Méta description">{doc.meta_description}</Field>
      )}
      <Field label="Créé WP">{formatDate(doc.wp_created_at)}</Field>
      <Field label="Modifié WP">{formatDate(doc.wp_modified_at)}</Field>
      <Field label="Dernière sync">{formatDate(doc.last_sync_at)}</Field>
      {doc.wp_source?.post_url && (
        <Field label="URL WordPress">
          <a href={doc.wp_source.post_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700 underline underline-offset-2 truncate max-w-full">
            {doc.wp_source.post_url}
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </a>
        </Field>
      )}
      {doc.cluster_ids && doc.cluster_ids.length > 0 && (
        <Field label="Clusters">
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              {doc.cluster_ids.map((id) => (
                <span key={id} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">{id}</span>
              ))}
            </div>
            {doc.cluster_match_status && (
              <span className="text-stone-400">Statut : {doc.cluster_match_status}
                {doc.cluster_match_confidence != null && ` · confiance ${Math.round(doc.cluster_match_confidence * 100)}%`}
              </span>
            )}
          </div>
        </Field>
      )}
      {doc.poi_candidates && doc.poi_candidates.length > 0 && (
        <Field label={`POI candidats (${doc.poi_candidates.length})`}>
          <div className="space-y-1.5">
            {doc.poi_candidates.slice(0, 10).map((p) => (
              <div key={p.candidate_id} className="rounded border border-amber-100 bg-amber-50 px-2 py-1 text-xs">
                <div className="font-medium text-amber-800">{p.name}</div>
                {(p.entity_kind || p.tourism_relevance || p.extraction_action || p.suggested_place_type) && (
                  <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-amber-700">
                    {p.entity_kind && <span>{formatPoiEntityKind(p.entity_kind)}</span>}
                    {p.suggested_place_type && <span>type: {p.suggested_place_type.replace(/_/g, " ")}</span>}
                    {p.tourism_relevance && <span>{formatPoiRelevance(p.tourism_relevance)}</span>}
                    {p.extraction_action && <span>{formatPoiExtractionAction(p.extraction_action)}</span>}
                    {p.detection_confidence != null && <span>{Math.round(p.detection_confidence * 100)}%</span>}
                  </div>
                )}
              </div>
            ))}
            {doc.poi_candidates.length > 10 && (
              <span className="text-stone-400 text-xs">+{doc.poi_candidates.length - 10} autres</span>
            )}
          </div>
        </Field>
      )}
      {doc.urls_by_lang && Object.keys(doc.urls_by_lang).length > 0 && (
        <Field label="URLs multilingues">
          <div className="space-y-0.5">
            {Object.entries(doc.urls_by_lang).map(([lang, url]) => (
              <div key={lang} className="flex items-center gap-1.5">
                <span className="font-mono text-stone-500 w-6">{lang}</span>
                <a href={url} target="_blank" rel="noopener noreferrer"
                  className="text-orange-600 hover:underline truncate max-w-xs">{url}</a>
              </div>
            ))}
          </div>
        </Field>
      )}
      {doc.is_deleted && (
        <Field label="Supprimé">
          <span className="text-red-600 font-medium">Oui</span>
        </Field>
      )}
    </div>
  )
}

function TriggerCard({
  icon: Icon,
  title,
  description,
  children,
  onTrigger,
  isLoading,
  disabled,
  error,
  success,
}: {
  icon: React.ElementType
  title: string
  description: string
  children?: React.ReactNode
  onTrigger: () => void
  isLoading: boolean
  disabled?: boolean
  error?: string
  success?: boolean
}) {

  return (
    <div className="bg-white rounded-xl border border-stone-200/60 p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon className="h-4.5 w-4.5 text-orange-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-800">{title}</p>
          <p className="text-xs text-stone-500 mt-0.5">{description}</p>
        </div>
      </div>

      {children && <div>{children}</div>}

      {error && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && !error && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
          Ingestion déclenchée
        </div>
      )}

      <button
        onClick={onTrigger}
        disabled={isLoading || disabled}
        className="self-start inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
      >
        {isLoading ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
        {isLoading ? "Déclenchement…" : "Lancer"}
      </button>
    </div>
  )
}

export function Ingestions() {
  const { sites } = useSiteContext()
  const [selectedSiteId, setSelectedSiteId] = useState<string>("")
  const [articleUrl, setArticleUrl] = useState<string>("")
  const [resolved, setResolved] = useState<ResolvedArticle | null>(null)
  const [globalSuccess, setGlobalSuccess] = useState(false)
  const [siteSuccess, setSiteSuccess] = useState(false)
  const [urlSuccess, setUrlSuccess] = useState(false)
  const [manualTriggers, setManualTriggers] = useState<Array<{ resolved: ResolvedArticle; triggeredAt: string }>>([])
  const [articleModal, setArticleModal] = useState<{ siteId: string; wpId: number; siteName: string } | null>(null)

  const { data: status, isLoading: statusLoading } = useIngestionStatus()
  const { data: runs, isLoading: runsLoading } = useIngestionRuns()

  const triggerGlobal = useTriggerIngestion()
  const triggerSite = useTriggerSiteIngestion()
  const triggerUrl = useTriggerUrlIngestion()
  const resolveUrl = useResolveArticleUrl()

  const handleTriggerGlobal = () => {
    setGlobalSuccess(false)
    triggerGlobal.mutate(undefined, {
      onSuccess: () => setGlobalSuccess(true),
    })
  }

  const handleTriggerSite = () => {
    if (!selectedSiteId) return
    setSiteSuccess(false)
    triggerSite.mutate(selectedSiteId, {
      onSuccess: () => setSiteSuccess(true),
    })
  }

  const handleResolveUrl = () => {
    if (!articleUrl.trim()) return
    setResolved(null)
    resolveUrl.mutate(articleUrl.trim(), {
      onSuccess: (data) => setResolved(data),
    })
  }

  const handleTriggerUrl = () => {
    if (!resolved) return
    setUrlSuccess(false)
    triggerUrl.mutate({ siteId: resolved.siteId, wpId: resolved.wpId }, {
      onSuccess: () => {
        setUrlSuccess(true)
        setManualTriggers((prev) => [
          { resolved, triggeredAt: new Date().toISOString() },
          ...prev,
        ])
      },
    })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Ingestions</h1>
          <p className="text-sm text-stone-500 mt-0.5">Déclenchez et suivez les synchronisations de contenu</p>
        </div>
        {!statusLoading && status && (
          <StatusBadge status={status.status} />
        )}
      </div>

      {/* Trigger cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TriggerCard
          icon={Globe}
          title="Ingestion globale"
          description="Synchronise tous les sites de la collection"
          onTrigger={handleTriggerGlobal}
          isLoading={triggerGlobal.isPending}
          error={triggerGlobal.error?.message}
          success={globalSuccess}
        />

        <TriggerCard
          icon={Server}
          title="Par site"
          description="Synchronise un seul site de ta collection"
          onTrigger={handleTriggerSite}
          isLoading={triggerSite.isPending}
          error={!selectedSiteId && triggerSite.isIdle ? undefined : triggerSite.error?.message}
          success={siteSuccess}
        >
          <div className="relative">
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="w-full appearance-none bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 pr-8 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            >
              <option value="">Choisir un site…</option>
              {sites.map((site) => (
                <option key={site._id} value={site._id}>
                  {site.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none" />
          </div>
        </TriggerCard>

        <TriggerCard
          icon={Link2}
          title="Par article"
          description="Colle l'URL de l'article pour retrouver son wpId automatiquement"
          onTrigger={handleTriggerUrl}
          isLoading={triggerUrl.isPending}
          error={triggerUrl.error?.message}
          success={urlSuccess}
          disabled={!resolved}
        >
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="url"
                value={articleUrl}
                onChange={(e) => { setArticleUrl(e.target.value); setResolved(null) }}
                onKeyDown={(e) => e.key === "Enter" && handleResolveUrl()}
                placeholder="https://monsite.fr/mon-article"
                className="flex-1 min-w-0 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
              <button
                onClick={handleResolveUrl}
                disabled={!articleUrl.trim() || resolveUrl.isPending}
                className="flex-shrink-0 px-3 py-2 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-xs font-medium text-stone-700 transition-colors"
              >
                {resolveUrl.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Chercher"}
              </button>
            </div>

            {resolveUrl.error && (
              <p className="text-xs text-red-600">{resolveUrl.error.message}</p>
            )}

            {resolved && (
              <div className="flex items-center gap-2 text-xs bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                <span className="text-stone-700">
                  <span className="font-medium">{resolved.siteName}</span>
                  <span className="text-stone-400 mx-1">·</span>
                  WP ID <span className="font-mono font-medium">{resolved.wpId}</span>
                </span>
              </div>
            )}
            {urlSuccess && (
              <p className="text-xs text-stone-400">Visible dans l'historique ci-dessous</p>
            )}
          </div>
        </TriggerCard>
      </div>

      {/* Runs history */}
      <div>
        <h2 className="text-sm font-semibold text-stone-700 mb-3">Historique des runs</h2>

        {runsLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-5 w-5 animate-spin text-stone-400" />
          </div>
        )}

        {!runsLoading && manualTriggers.length === 0 && (!runs || runs.length === 0) && (
          <div className="bg-white rounded-xl border border-stone-200/60 p-8 text-center">
            <Clock className="h-8 w-8 text-stone-300 mx-auto mb-2" />
            <p className="text-sm text-stone-500">Aucun run trouvé</p>
          </div>
        )}

        {!runsLoading && (manualTriggers.length > 0 || (runs && runs.length > 0)) && (
          <div className="bg-white rounded-xl border border-stone-200/60 divide-y divide-stone-100 shadow-sm overflow-hidden">
            {/* Déclenchements manuels de la session */}
            {manualTriggers.map((t, i) => (
              <div key={`manual-${i}`} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusBadge status="completed" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-stone-700">Manuel — article</p>
                        <span className="text-xs text-stone-400">
                          {t.resolved.siteName} · WP ID <span className="font-mono">{t.resolved.wpId}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right text-xs text-stone-400">
                      <p>{formatDate(t.triggeredAt)}</p>
                    </div>
                    <button
                      onClick={() => setArticleModal({ siteId: t.resolved.siteId, wpId: t.resolved.wpId, siteName: t.resolved.siteName })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-stone-200 bg-stone-50 hover:bg-stone-100 rounded-lg text-xs font-medium text-stone-600 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Voir le résultat
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Runs sync */}
            {runs && runs.map((run, i) => {
              const key = run.runId ?? String(i)
              const isStillRunning = run.status === "queued" || run.status === "processing"
              const sourceLabel = run.source === "cron" ? "Cron" : run.source === "manual" ? "Manuel" : run.source === "cli" ? "CLI" : "Run"

              return (
                <div key={key} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <StatusBadge status={run.status} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-stone-700">{sourceLabel}</p>
                          {run.runId && (
                            <span className="text-xs text-stone-400 font-mono">{run.runId.slice(-8)}</span>
                          )}
                        </div>
                        <RunSummary run={run} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 text-xs text-stone-400 space-y-0.5">
                      <p>{formatDate(run.startedAt)}</p>
                      <p className={cn(isStillRunning && "text-blue-500")}>
                        {isStillRunning
                          ? `En cours — ${formatRunningDuration(run.startedAt)}`
                          : `Durée : ${formatDurationMs(run.durationMs)}`}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modale article_raw */}
      {articleModal && (
        <ArticleRawModal
          siteId={articleModal.siteId}
          wpId={articleModal.wpId}
          siteName={articleModal.siteName}
          onClose={() => setArticleModal(null)}
        />
      )}
    </div>
  )
}
