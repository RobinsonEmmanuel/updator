import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSiteContext } from "@/lib/SiteContext"
import { CheckCircle, XCircle, Clock, ChevronRight, Loader2, BookOpen, MapPin, AlertCircle, ThumbsUp, ThumbsDown, BarChart2, RefreshCw, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  formatPoiEntityKind,
  formatPoiExtractionAction,
  formatPoiRelevance,
} from "@/features/article-poi-catchup/poiExtractionContract"
import {
  usePoiMentionsStats,
  usePoiMentionsArticleIds,
  usePoiMentionsByArticle,
  usePoiMentionArticleSummaries,
  usePoiArticleContent,
  useReviewPoiMention,
  useReingestPoiArticle,
} from "@/hooks/usePoiMentions"
import type { PoiMention, PoiMentionArticleResponse, PoiMentionArticleSummary, PoiArticleReingestResult } from "@/hooks/usePoiMentions"
import { useArticlePoiRecompute } from "@/hooks/useArticlePoiCatchup"
import { useQueryClient } from "@tanstack/react-query"

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

function normalizeSearchChar(char: string) {
  return char.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function findLooseRange(source: string, needle?: string): { start: number; end: number } | null {
  const trimmedNeedle = needle?.trim()
  if (!trimmedNeedle) return null

  let normalizedSource = ""
  const sourceIndexByNormalizedIndex: number[] = []
  let previousWasWhitespace = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (/\s/.test(char)) {
      if (!previousWasWhitespace) {
        normalizedSource += " "
        sourceIndexByNormalizedIndex.push(index)
        previousWasWhitespace = true
      }
      continue
    }
    normalizedSource += normalizeSearchChar(char)
    sourceIndexByNormalizedIndex.push(index)
    previousWasWhitespace = false
  }

  const normalizedNeedle = trimmedNeedle
    .replace(/\s+/g, " ")
    .split("")
    .map(normalizeSearchChar)
    .join("")

  const startInNormalized = normalizedSource.indexOf(normalizedNeedle)
  if (startInNormalized < 0) return null

  const endInNormalized = startInNormalized + normalizedNeedle.length - 1
  return {
    start: sourceIndexByNormalizedIndex[startInNormalized],
    end: sourceIndexByNormalizedIndex[endInNormalized] + 1,
  }
}

function getMentionHighlightRange(markdown: string, mention: PoiMention | null) {
  if (!mention) return null
  return (
    findLooseRange(markdown, mention.evidence_text) ??
    findLooseRange(markdown, mention.extrait) ??
    findLooseRange(markdown, mention.nom_dans_article) ??
    findLooseRange(markdown, mention.rl_poi_name)
  )
}

function sortMentionsByArticleOrder(mentions: PoiMention[], markdown?: string) {
  if (!markdown) return mentions
  return mentions
    .map((mention, index) => ({
      mention,
      index,
      position: getMentionHighlightRange(markdown, mention)?.start ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.position - b.position || a.index - b.index)
    .map(({ mention }) => mention)
}

function HighlightedArticleContent({
  markdown,
  activeMention,
}: {
  markdown: string
  activeMention: PoiMention | null
}) {
  const highlightRef = useRef<HTMLElement | null>(null)
  const range = useMemo(() => getMentionHighlightRange(markdown, activeMention), [markdown, activeMention])

  useEffect(() => {
    if (!range) return
    window.requestAnimationFrame(() => {
      highlightRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
    })
  }, [range, activeMention?._id])

  if (!range) return <>{markdown}</>

  return (
    <>
      {markdown.slice(0, range.start)}
      <mark
        ref={highlightRef}
        className="rounded bg-orange-200 px-0.5 text-stone-950 ring-1 ring-orange-300"
      >
        {markdown.slice(range.start, range.end)}
      </mark>
      {markdown.slice(range.end)}
    </>
  )
}

// ─── Session summary (local state) ───────────────────────────────────────────

interface SessionReview {
  mentionId: string
  articleId: string
  nom: string
  action: "approve" | "reject"
}

// ─── Article list sidebar ─────────────────────────────────────────────────────

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
  data?: PoiMentionArticleResponse | PoiMentionArticleSummary
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
  isSelected: boolean
  onSelect: () => void
}

function MentionCard({
  mention,
  sessionReview,
  onReview,
  isLoading,
  isSelected,
  onSelect,
}: MentionCardProps) {
  const st = statusLabel(mention.match_status)
  const reviewed = sessionReview ?? (mention.review ? { action: mention.review.action } : null)
  const isToCreate = mention.extraction_action === "candidate_to_create" && !mention.rl_poi_id

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
      className={cn(
        "w-full cursor-pointer rounded-xl border p-4 space-y-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-200",
        reviewed?.action === "approve"
          ? "border-emerald-200 bg-emerald-50/40"
          : reviewed?.action === "reject"
          ? "border-red-200 bg-red-50/30"
          : isToCreate
          ? "border-amber-200 bg-amber-50/30"
          : "border-stone-200 bg-white",
        isSelected && "border-orange-300 bg-orange-50/50 shadow-sm ring-2 ring-orange-100"
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-stone-900">{mention.nom_dans_article}</span>
            <span className={cn("text-xs px-1.5 py-0.5 rounded border", st.cls)}>{st.label}</span>
          </div>
          <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {placeTypeLabel(mention.place_type || mention.entity_kind)}
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
          ) : isToCreate ? (
            <>
              <button
                type="button"
                disabled
                onClick={(event) => { event.stopPropagation() }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-amber-300 text-amber-700 opacity-60 cursor-not-allowed"
                title="Création dans la base — disponible prochainement"
              >
                <MapPin className="h-3.5 w-3.5" />
                Créer dans la base
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={(event) => { event.stopPropagation(); onReview(mention._id, "reject") }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                Rejeter
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isLoading}
                onClick={(event) => { event.stopPropagation(); onReview(mention._id, "approve") }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                Approuver
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={(event) => { event.stopPropagation(); onReview(mention._id, "reject") }}
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
      {(mention.entity_kind || mention.tourism_relevance || mention.extraction_action || mention.suggested_place_type) && (
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {mention.entity_kind && (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700 border border-blue-100">
              {formatPoiEntityKind(mention.entity_kind)}
            </span>
          )}
          {mention.suggested_place_type && (
            <span className="rounded bg-stone-50 px-1.5 py-0.5 text-stone-600 border border-stone-100">
              type: {placeTypeLabel(mention.suggested_place_type)}
            </span>
          )}
          {mention.tourism_relevance && (
            <span className="rounded bg-orange-50 px-1.5 py-0.5 text-orange-700 border border-orange-100">
              {formatPoiRelevance(mention.tourism_relevance)}
            </span>
          )}
          {mention.extraction_action && (
            <span className="rounded bg-purple-50 px-1.5 py-0.5 text-purple-700 border border-purple-100">
              {formatPoiExtractionAction(mention.extraction_action)}
            </span>
          )}
          {mention.is_geolocatable === false && (
            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-500 border border-stone-200">
              non geolocalisable
            </span>
          )}
        </div>
      )}

      {mention.rl_poi_name ? (
        <div className="text-xs bg-stone-50 rounded-lg px-3 py-2 border border-stone-100 flex items-center gap-2 flex-wrap">
          <span className="text-stone-400">POI associé :</span>
          <span className="text-stone-700 font-medium">{mention.rl_poi_name}</span>
          {mention.place_type && (
            <span className="text-stone-400 text-[10px] bg-stone-100 rounded px-1.5 py-0.5 border border-stone-200">
              {mention.place_type.replace(/_/g, ' ')}
            </span>
          )}
          {mention.match_confidence != null && (
            <span className={cn("ml-auto font-medium text-[11px]", confidenceColor(mention.match_confidence))}>
              {Math.round(mention.match_confidence * 100)}% similarité nom
            </span>
          )}
        </div>
      ) : (
        <div className="text-xs bg-amber-50 rounded-lg px-3 py-2 border border-amber-100 text-amber-700 font-medium">
          Absent de la base RL — à créer
        </div>
      )}

      {mention.extraction_reason && (
        <div className="text-[11px] text-stone-500 leading-relaxed">
          {mention.extraction_reason}
        </div>
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
  const reingestMutation = useReingestPoiArticle()
  const [selectedMentionId, setSelectedMentionId] = useState<string | null>(null)
  const [reingestError, setReingestError] = useState<string | null>(null)
  const [reingestResult, setReingestResult] = useState<PoiArticleReingestResult | null>(null)
  const sortedMentions = useMemo(
    () => sortMentionsByArticleOrder(mentionData?.mentions ?? [], content?.markdown),
    [content?.markdown, mentionData?.mentions]
  )

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

  const handleReingest = () => {
    setReingestError(null)
    setReingestResult(null)
    reingestMutation.mutate(
      { articleId },
      {
        onSuccess: (result) => {
          setReingestResult(result)
        },
        onError: (error) => {
          setReingestError(error instanceof Error ? error.message : "Impossible de relancer la détection de l'article")
        },
      }
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

  const { article, stats } = mentionData
  const activeMentionId = sortedMentions.some((mention) => mention._id === selectedMentionId)
    ? selectedMentionId
    : sortedMentions[0]?._id ?? null
  const selectedMention = sortedMentions.find((mention) => mention._id === activeMentionId) ?? null

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
              <HighlightedArticleContent markdown={content.markdown} activeMention={selectedMention} />
            </div>
          ) : (
            <div className="text-stone-400 text-sm italic">Contenu Markdown non disponible pour cet article.</div>
          )}
        </div>
      </div>

      {/* Right: mentions */}
      <div className="w-[420px] flex-shrink-0 flex flex-col overflow-hidden">
        {/* Stats bar */}
        <div className="mb-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5">
          <div className="flex items-center gap-3 flex-wrap">
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
            <button
              type="button"
              disabled={reingestMutation.isPending}
              onClick={handleReingest}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-medium text-orange-700 transition hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", reingestMutation.isPending && "animate-spin")} />
              {reingestMutation.isPending ? "Relance..." : "Relancer l'article"}
            </button>
          </div>
          <div className="mt-2 text-xs text-stone-500">
            Relance de la détection POI pour l'article affiché.
          </div>
          {reingestError && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {reingestError}
            </div>
          )}
          {reingestResult && (
            <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700">
              <div className="flex items-center gap-1.5 font-medium">
                <CheckCircle className="h-3.5 w-3.5" />
                Détection relancée
              </div>
              <div className="mt-1 text-emerald-700/80">
                {reingestResult.result || "Article recalculé"}
                {typeof reingestResult.rlPlacesLoaded === "number" && (
                  <> · {reingestResult.rlPlacesLoaded} POI RL lus</>
                )}
                <> · WP {reingestResult.refreshed ? "rafraîchi" : "inchangé"}</>
              </div>
              {reingestResult.detectionStats && (
                <div className="mt-1.5 text-emerald-700/70 text-[11px] leading-relaxed">
                  {reingestResult.detectionStats.stored} détectés
                  {reingestResult.detectionStats.locked > 0 && (
                    <> · {reingestResult.detectionStats.locked} approuvés conservés</>
                  )}
                  <> · {reingestResult.detectionStats.rlSeeds} RL
                  · {reingestResult.detectionStats.headingSeeds} titres
                  · {reingestResult.detectionStats.wideSeeds} patterns
                  · {reingestResult.detectionStats.llmSeeds} Haiku</>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {sortedMentions.map((mention) => {
            const sessionReview = sessionReviews.find((r) => r.mentionId === mention._id)
            return (
              <MentionCard
                key={mention._id}
                mention={mention}
                sessionReview={sessionReview}
                onReview={handleReview}
                isLoading={reviewMutation.isPending}
                isSelected={activeMentionId === mention._id}
                onSelect={() => setSelectedMentionId(mention._id)}
              />
            )
          })}
          {sortedMentions.length === 0 && (
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
  const { selectedSite } = useSiteContext()
  const siteId = selectedSite?._id ?? null

  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [sessionReviews, setSessionReviews] = useState<SessionReview[]>([])
  const [articleSearch, setArticleSearch] = useState("")

  // Reset article selection and search when site changes
  useEffect(() => {
    setSelectedArticleId(null)
    setSessionReviews([])
    setArticleSearch("")
  }, [siteId])

  const queryClient = useQueryClient()
  const { data: stats, isLoading: loadingStats } = usePoiMentionsStats(siteId)
  const { data: articleIds = [], isLoading: loadingIds, error: idsError } = usePoiMentionsArticleIds(siteId)

  const [scanResult, setScanResult] = useState<{ articlesScanned: number; updated: number; needsReview: number } | null>(null)
  const recomputeSite = useArticlePoiRecompute(siteId ?? undefined)

  const handleScanAllArticles = () => {
    setScanResult(null)
    recomputeSite.mutate({ force: false }, {
      onSuccess: (res) => {
        setScanResult({
          articlesScanned: res.summary.articlesScanned,
          updated: res.summary.updated,
          needsReview: res.summary.needsReview,
        })
        queryClient.invalidateQueries({ queryKey: ["poi-mentions-article-ids", siteId ?? "all"] })
        queryClient.invalidateQueries({ queryKey: ["poi-mentions-stats", siteId ?? "all"] })
      },
    })
  }
  const articleSummaryQueries = usePoiMentionArticleSummaries(articleIds)

  // Pre-fetch article data for the list
  const articleSummaryMap = useMemo(() => {
    const next = new Map<string, PoiMentionArticleSummary>()
    articleSummaryQueries.forEach((query) => {
      if (query.data) next.set(query.data.articleId, query.data)
    })
    return next
  }, [articleSummaryQueries])

  const [articleDataMap, setArticleDataMap] = useState(() => new Map<string, PoiMentionArticleResponse>())

  const filteredArticleIds = useMemo(() => {
    const q = articleSearch.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    if (!q) return articleIds
    return articleIds.filter((id) => {
      const data = articleDataMap.get(id) ?? articleSummaryMap.get(id)
      const title = (data?.article?.title ?? id).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      return title.includes(q)
    })
  }, [articleIds, articleSearch, articleSummaryMap, articleDataMap])

  const handleArticleDataLoaded = useCallback((articleId: string, data: PoiMentionArticleResponse) => {
    setArticleDataMap((prev) => {
      if (prev.get(articleId) === data) return prev
      const next = new Map(prev)
      next.set(articleId, data)
      return next
    })
  }, [])

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
        <div className="flex flex-col items-end gap-2">
          {!loadingStats && stats && (
            <div className="flex items-center gap-4 text-sm text-stone-500">
              <span>
                <strong className="text-stone-800">{stats.total_mentions}</strong> mentions
              </span>
              <span>
                <strong className="text-stone-800">{stats.total_articles}</strong> articles scannés
              </span>
              {stats.by_status.needs_review > 0 && (
                <span className="flex items-center gap-1 text-amber-600 font-medium">
                  <AlertCircle className="h-4 w-4" />
                  {stats.by_status.needs_review} à revoir
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleScanAllArticles}
              disabled={recomputeSite.isPending || !siteId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition"
              title="Scanner tous les articles du site pour détecter les POI"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", recomputeSite.isPending && "animate-spin")} />
              {recomputeSite.isPending ? "Scan en cours…" : "Scanner tous les articles"}
            </button>
          </div>
          {scanResult && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
              ✓ {scanResult.articlesScanned} articles scannés · {scanResult.updated} mis à jour · {scanResult.needsReview} à revoir
            </div>
          )}
          {recomputeSite.isError && (
            <div className="text-xs text-red-600">
              Erreur : {recomputeSite.error?.message}
            </div>
          )}
        </div>
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
            Articles ({filteredArticleIds.length}{articleSearch && articleIds.length !== filteredArticleIds.length ? ` / ${articleIds.length}` : ""})
          </div>
          {/* Search bar */}
          <div className="relative px-0.5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
            <input
              type="text"
              value={articleSearch}
              onChange={(e) => setArticleSearch(e.target.value)}
              placeholder="Rechercher un article…"
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-stone-200 bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-orange-300 focus:border-orange-300"
            />
            {articleSearch && (
              <button
                type="button"
                onClick={() => setArticleSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
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
          ) : filteredArticleIds.length === 0 ? (
            <div className="text-stone-400 text-sm italic px-1">Aucun résultat pour "{articleSearch}".</div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
              {filteredArticleIds.map((id) => (
                <div key={id} className="relative">
                  <ArticleListItem
                    articleId={id}
                    isSelected={selectedArticleId === id}
                    onSelect={() => setSelectedArticleId(id)}
                    data={articleDataMap.get(id) ?? articleSummaryMap.get(id)}
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
              onDataLoaded={handleArticleDataLoaded}
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
}: ArticleDetailProps & { onDataLoaded: (articleId: string, data: PoiMentionArticleResponse) => void }) {
  const { data } = usePoiMentionsByArticle(articleId)
  useEffect(() => {
    if (data) onDataLoaded(articleId, data)
  }, [articleId, data, onDataLoaded])
  return <ArticleDetail articleId={articleId} sessionReviews={sessionReviews} onReview={onReview} />
}
