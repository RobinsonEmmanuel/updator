import { useState, useMemo } from "react"
import { CheckCircle, XCircle, Clock, ChevronRight, Loader2, BookOpen, MapPin, AlertCircle, ThumbsUp, ThumbsDown, BarChart2 } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  usePoiMentionsStats,
  usePoiMentionsArticleIds,
  usePoiMentionsByArticle,
  usePoiArticleContent,
  useReviewPoiMention,
} from "@/hooks/usePoiMentions"
import type { PoiMention, PoiMentionArticleResponse } from "@/hooks/usePoiMentions"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function confidenceColor(v?: number) {
  if (v == null) return "text-stone-400"
  if (v >= 0.8) return "text-emerald-600"
  if (v >= 0.5) return "text-amber-500"
  return "text-red-500"
}

function statusLabel(status?: string) {
  switch (status) {
    case "auto": return { label: "Auto", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    case "needs_review": return { label: "À revoir", cls: "bg-amber-50 text-amber-700 border-amber-200" }
    case "buffer": return { label: "Buffer", cls: "bg-blue-50 text-blue-700 border-blue-200" }
    default: return { label: status ?? "—", cls: "bg-stone-50 text-stone-500 border-stone-200" }
  }
}

function placeTypeLabel(t?: string) {
  if (!t) return "—"
  return t.replace(/_/g, " ")
}

// ─── Session summary (local state) ───────────────────────────────────────────

interface SessionReview {
  mentionId: string
  articleId: string
  nom: string
  action: "approve" | "reject"
}

// ─── Article list sidebar ─────────────────────────────────────────────────────

interface ArticleListProps {
  articleIds: string[]
  selectedId: string | null
  onSelect: (id: string) => void
  articleData: Map<string, PoiMentionArticleResponse>
  sessionReviews: SessionReview[]
}

function ArticleListItem({
  articleId,
  isSelected,
  onSelect,
  data,
  sessionReviews,
}: {
  articleId: string
  isSelected: boolean
  onSelect: () => void
  data?: PoiMentionArticleResponse
  sessionReviews: SessionReview[]
}) {
  const sessionCount = sessionReviews.filter((r) => r.articleId === articleId).length
  const title = data?.article?.title ?? articleId
  const stats = data?.stats

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all border",
        isSelected
          ? "bg-orange-50 border-orange-200 text-orange-900"
          : "border-transparent hover:bg-stone-50 text-stone-700"
      )}
    >
      <div className="font-medium leading-snug line-clamp-2">{title}</div>
      {stats && (
        <div className="mt-1 flex items-center gap-2 text-xs text-stone-400">
          <span>{stats.total} mentions</span>
          {sessionCount > 0 && (
            <span className="text-orange-500 font-medium">{sessionCount} revues</span>
          )}
        </div>
      )}
      {isSelected && <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-orange-400" />}
    </button>
  )
}

// ─── Mention card ─────────────────────────────────────────────────────────────

interface MentionCardProps {
  mention: PoiMention
  sessionReview?: SessionReview
  onReview: (mentionId: string, action: "approve" | "reject") => void
  isLoading: boolean
}

function MentionCard({ mention, sessionReview, onReview, isLoading }: MentionCardProps) {
  const st = statusLabel(mention.match_status)
  const reviewed = sessionReview ?? (mention.review ? { action: mention.review.action } : null)

  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-3 transition-all",
        reviewed?.action === "approve"
          ? "border-emerald-200 bg-emerald-50/40"
          : reviewed?.action === "reject"
          ? "border-red-200 bg-red-50/30"
          : "border-stone-200 bg-white"
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-stone-900">{mention.nom_dans_article}</span>
            <span className={cn("text-xs px-1.5 py-0.5 rounded border", st.cls)}>{st.label}</span>
          </div>
          <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {placeTypeLabel(mention.place_type)}
            </span>
            {mention.match_confidence != null && (
              <span className={cn("font-medium", confidenceColor(mention.match_confidence))}>
                {Math.round(mention.match_confidence * 100)}% confiance
              </span>
            )}
          </div>
        </div>

        {/* Approve / Reject */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {reviewed ? (
            <span
              className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg",
                reviewed.action === "approve"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              )}
            >
              {reviewed.action === "approve" ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              {reviewed.action === "approve" ? "Approuvé" : "Rejeté"}
            </span>
          ) : (
            <>
              <button
                disabled={isLoading}
                onClick={() => onReview(mention._id, "approve")}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                Approuver
              </button>
              <button
                disabled={isLoading}
                onClick={() => onReview(mention._id, "reject")}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                Rejeter
              </button>
            </>
          )}
        </div>
      </div>

      {/* POI match */}
      {mention.rl_poi_name && (
        <div className="text-xs bg-stone-50 rounded-lg px-3 py-2 border border-stone-100">
          <span className="text-stone-400">POI associé : </span>
          <span className="text-stone-700 font-medium">{mention.rl_poi_name}</span>
          {mention.rl_poi_id && (
            <span className="ml-2 text-stone-400 font-mono text-[10px]">{mention.rl_poi_id}</span>
          )}
        </div>
      )}

      {/* Extrait */}
      {mention.extrait && (
        <blockquote className="border-l-2 border-stone-200 pl-3 text-xs text-stone-500 italic leading-relaxed">
          {mention.extrait}
        </blockquote>
      )}

      {/* Infos présentes */}
      {mention.infos_presentes?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {mention.infos_presentes.map((info) => (
            <span key={info} className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
              {info}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Article detail panel ──────────────────────────────────────────────────────

interface ArticleDetailProps {
  articleId: string
  sessionReviews: SessionReview[]
  onReview: (mentionId: string, articleId: string, nom: string, action: "approve" | "reject") => void
}

function ArticleDetail({ articleId, sessionReviews, onReview }: ArticleDetailProps) {
  const { data: mentionData, isLoading: loadingMentions, error: mentionError } = usePoiMentionsByArticle(articleId)
  const { data: content, isLoading: loadingContent } = usePoiArticleContent(articleId)
  const reviewMutation = useReviewPoiMention()

  const handleReview = (mentionId: string, action: "approve" | "reject") => {
    const mention = mentionData?.mentions.find((m) => m._id === mentionId)
    onReview(mentionId, articleId, mention?.nom_dans_article ?? mentionId, action)
    reviewMutation.mutate({ mentionId, action })
  }

  if (loadingMentions) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Chargement…
      </div>
    )
  }

  if (mentionError || !mentionData) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500 gap-2">
        <AlertCircle className="h-5 w-5" />
        Impossible de charger les mentions
      </div>
    )
  }

  const { article, stats, mentions } = mentionData

  return (
    <div className="flex-1 flex min-h-0 gap-4 overflow-hidden">
      {/* Left: article content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50/60">
          <BookOpen className="h-4 w-4 text-stone-400" />
          <span className="text-sm font-medium text-stone-700">Contenu de l'article</span>
          {article.url_fr && (
            <a
              href={article.url_fr}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-orange-600 hover:underline"
            >
              Ouvrir ↗
            </a>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loadingContent ? (
            <div className="flex items-center justify-center h-24 text-stone-400">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Chargement du contenu…
            </div>
          ) : content?.markdown ? (
            <div className="prose prose-sm prose-stone max-w-none text-xs leading-relaxed whitespace-pre-wrap font-mono">
              {content.markdown}
            </div>
          ) : (
            <div className="text-stone-400 text-sm italic">Contenu Markdown non disponible pour cet article.</div>
          )}
        </div>
      </div>

      {/* Right: mentions */}
      <div className="w-[420px] flex-shrink-0 flex flex-col overflow-hidden">
        {/* Stats bar */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <span className="font-semibold text-stone-800">{stats.total}</span> mentions
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle className="h-3 w-3" />
            {stats.auto} auto
          </div>
          {stats.needs_review > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <Clock className="h-3 w-3" />
              {stats.needs_review} à revoir
            </div>
          )}
          {stats.buffer > 0 && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <Clock className="h-3 w-3" />
              {stats.buffer} buffer
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {mentions.map((mention) => {
            const sessionReview = sessionReviews.find((r) => r.mentionId === mention._id)
            return (
              <MentionCard
                key={mention._id}
                mention={mention}
                sessionReview={sessionReview}
                onReview={handleReview}
                isLoading={reviewMutation.isPending}
              />
            )
          })}
          {mentions.length === 0 && (
            <div className="text-stone-400 text-sm italic text-center py-8">
              Aucune mention POI pour cet article.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Session summary bar ──────────────────────────────────────────────────────

function SessionSummary({ reviews }: { reviews: SessionReview[] }) {
  const approved = reviews.filter((r) => r.action === "approve")
  const rejected = reviews.filter((r) => r.action === "reject")

  if (reviews.length === 0) return null

  return (
    <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm">
      <div className="flex items-center gap-1.5 text-stone-500">
        <BarChart2 className="h-4 w-4" />
        <span className="font-medium text-stone-700">Session :</span>
      </div>
      <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
        <ThumbsUp className="h-4 w-4" />
        {approved.length} approuvé{approved.length !== 1 ? "s" : ""}
      </div>
      <div className="flex items-center gap-1.5 text-red-500 font-medium">
        <ThumbsDown className="h-4 w-4" />
        {rejected.length} rejeté{rejected.length !== 1 ? "s" : ""}
      </div>
      <div className="ml-auto text-xs text-stone-400">
        {reviews.length} revue{reviews.length !== 1 ? "s" : ""} au total
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function PoiMentions() {
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [sessionReviews, setSessionReviews] = useState<SessionReview[]>([])

  const { data: stats, isLoading: loadingStats } = usePoiMentionsStats()
  const { data: articleIds = [], isLoading: loadingIds, error: idsError } = usePoiMentionsArticleIds()

  // Pre-fetch article data for the list
  const articleDataMap = useMemo(() => new Map<string, PoiMentionArticleResponse>(), [])

  const handleReview = (mentionId: string, articleId: string, nom: string, action: "approve" | "reject") => {
    setSessionReviews((prev) => {
      const existing = prev.findIndex((r) => r.mentionId === mentionId)
      const review: SessionReview = { mentionId, articleId, nom, action }
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = review
        return updated
      }
      return [...prev, review]
    })
  }

  return (
    <div className="flex flex-col h-full gap-4 p-6 min-h-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Revue POI</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Validez ou rejetez les mentions de POI détectées dans vos articles
          </p>
        </div>
        {!loadingStats && stats && (
          <div className="flex items-center gap-4 text-sm text-stone-500">
            <span>
              <strong className="text-stone-800">{stats.total_mentions}</strong> mentions
            </span>
            <span>
              <strong className="text-stone-800">{stats.total_articles}</strong> articles
            </span>
            {stats.by_status.needs_review > 0 && (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <AlertCircle className="h-4 w-4" />
                {stats.by_status.needs_review} à revoir
              </span>
            )}
          </div>
        )}
      </div>

      {/* Session summary */}
      <div className="flex-shrink-0">
        <SessionSummary reviews={sessionReviews} />
      </div>

      {/* Main layout */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Article list */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-2 overflow-hidden">
          <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide px-1">
            Articles ({articleIds.length})
          </div>
          {loadingIds ? (
            <div className="flex items-center gap-2 text-stone-400 text-sm px-1">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement…
            </div>
          ) : idsError ? (
            <div className="text-red-500 text-sm px-1 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Erreur de chargement
            </div>
          ) : articleIds.length === 0 ? (
            <div className="text-stone-400 text-sm italic px-1">Aucun article avec des mentions POI.</div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
              {articleIds.map((id) => (
                <div key={id} className="relative">
                  <ArticleListItem
                    articleId={id}
                    isSelected={selectedArticleId === id}
                    onSelect={() => setSelectedArticleId(id)}
                    data={articleDataMap.get(id)}
                    sessionReviews={sessionReviews}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {selectedArticleId ? (
            <ArticleDetailWrapper
              key={selectedArticleId}
              articleId={selectedArticleId}
              sessionReviews={sessionReviews}
              onReview={handleReview}
              onDataLoaded={(data) => articleDataMap.set(selectedArticleId, data)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-stone-400 rounded-xl border border-dashed border-stone-200">
              <MapPin className="h-8 w-8 mb-2 text-stone-300" />
              <p className="text-sm">Sélectionnez un article pour voir ses mentions POI</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Wrapper to handle data-loaded callback for populating the sidebar list
function ArticleDetailWrapper({
  articleId,
  sessionReviews,
  onReview,
  onDataLoaded,
}: ArticleDetailProps & { onDataLoaded: (data: PoiMentionArticleResponse) => void }) {
  const { data } = usePoiMentionsByArticle(articleId)
  if (data) onDataLoaded(data)
  return <ArticleDetail articleId={articleId} sessionReviews={sessionReviews} onReview={onReview} />
}
