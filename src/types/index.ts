export type ArticleStatus =
  | "to_update"
  | "in_progress"
  | "done"
  | "blocked"
  | "needs_review"
  | "archived"

export type ArticleType =
  | "editorial"
  | "hebergement"
  | "restaurant"
  | "activite"
  | "bon_plan"

export type SignalType =
  | "closure"
  | "price_change"
  | "new_info"
  | "suspicious"

export type ChecklistCategory =
  | "liens"
  | "contenu"
  | "technique"
  | "traduction"
  | "structure"

export type DraftStatus =
  | "editing"
  | "ready_to_push"
  | "pushed"

export type Actualiseur =
  | "Julie"
  | "Myriam"
  | "Claire"
  | "Emmanuel"

export interface AffiliateLinks {
  booking: number
  gyg: number
  viator: number
}

export interface Site {
  id: string
  name: string
  url: string
  wpApiUrl: string
  languageCount: number
  maxArticlesPerDay: number
  todayUpdateCount: number
  clusterIds: string[]
}

export interface Cluster {
  id: string
  name: string
  siteId: string
  articleIds: string[]
  isBestOf: boolean
}

export interface Article {
  id: string
  siteId: string
  clusterId: string
  wpPostId: number
  title: string
  url: string
  type: ArticleType
  author: Actualiseur
  publishedAt: string
  lastModifiedAt: string
  score: number
  status: ArticleStatus
  assignedTo: Actualiseur | null
  checks: Record<string, boolean | null>
  affiliateLinks: AffiliateLinks
  internalLinksCount: number
  hasDraft: boolean
  hasSignals: boolean
}

export interface ChecklistItem {
  id: string
  label: string
  description: string
  applicableTo: ArticleType[] | "all"
  order: number
  active: boolean
  category: ChecklistCategory
}

export interface Signal {
  id: string
  entityName: string
  type: SignalType
  note: string
  siteId: string
  clusterIds: string[]
  detectedAt: string
  detectedBy: Actualiseur | "gpt"
  status: "open" | "dismissed"
  expiresAt: string
}

export interface Draft {
  id: string
  articleId: string
  siteId: string
  clusterId: string
  content: string
  checksSnapshot: Record<string, boolean | null>
  createdAt: string
  updatedAt: string
  author: Actualiseur
  status: DraftStatus
}
