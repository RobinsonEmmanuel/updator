export const POI_ENTITY_KIND_OPTIONS = [
  "tourist_attraction",
  "museum",
  "religious_site",
  "public_artwork",
  "historic_building",
  "urban_landmark",
  "street_or_square",
  "waterfront",
  "park_or_garden",
  "beach",
  "port_or_marina",
  "transport_hub",
  "hotel",
  "restaurant",
  "cafe",
  "food_shop",
  "market",
  "shop",
  "activity_provider",
  "region_or_area",
  "concept_or_label",
] as const

export type PoiEntityKind = (typeof POI_ENTITY_KIND_OPTIONS)[number]

export type PoiTourismRelevance = "primary" | "secondary" | "contextual" | "ignore"

export type PoiExtractionAction = "candidate_to_match" | "candidate_to_review" | "candidate_to_create" | "ignore"

export interface PoiExtractionFields {
  entity_kind?: PoiEntityKind | string
  suggested_place_type?: string
  is_geolocatable?: boolean
  tourism_relevance?: PoiTourismRelevance | string
  evidence_text?: string
  detection_confidence?: number
  extraction_action?: PoiExtractionAction | string
  extraction_reason?: string
}

export const POI_ENTITY_KIND_LABELS: Record<PoiEntityKind, string> = {
  tourist_attraction: "Attraction touristique",
  museum: "Musee",
  religious_site: "Site religieux",
  public_artwork: "Oeuvre d'art publique",
  historic_building: "Batiment historique",
  urban_landmark: "Repere urbain",
  street_or_square: "Rue / place",
  waterfront: "Front de mer",
  park_or_garden: "Parc / jardin",
  beach: "Plage",
  port_or_marina: "Port / marina",
  transport_hub: "Transport",
  hotel: "Hotel",
  restaurant: "Restaurant",
  cafe: "Cafe",
  food_shop: "Commerce alimentaire",
  market: "Marche",
  shop: "Commerce",
  activity_provider: "Activite",
  region_or_area: "Territoire",
  concept_or_label: "Concept / label",
}

export const POI_RELEVANCE_LABELS: Record<PoiTourismRelevance, string> = {
  primary: "Principal",
  secondary: "Secondaire",
  contextual: "Contexte",
  ignore: "A ignorer",
}

export const POI_EXTRACTION_ACTION_LABELS: Record<PoiExtractionAction, string> = {
  candidate_to_match: "A matcher",
  candidate_to_review: "A revoir",
  candidate_to_create: "A creer",
  ignore: "Ignorer",
}

export const ENTITY_KIND_TO_PLACE_TYPE: Partial<Record<PoiEntityKind, string>> = {
  tourist_attraction: "monument",
  museum: "museum",
  religious_site: "religious_building",
  public_artwork: "monument",
  historic_building: "castle_historic_building",
  urban_landmark: "monument",
  street_or_square: "picturesque_area",
  waterfront: "hiking_trail",
  park_or_garden: "park_garden",
  beach: "beach",
  port_or_marina: "ferry_terminal",
  transport_hub: "train_station",
  hotel: "hotel",
  restaurant: "restaurant_bar_cafe",
  cafe: "restaurant_bar_cafe",
  food_shop: "store",
  market: "market",
  shop: "store",
  activity_provider: "experience",
  region_or_area: "region",
}

export function formatPoiEntityKind(kind?: string) {
  if (!kind) return ""
  return POI_ENTITY_KIND_LABELS[kind as PoiEntityKind] || kind.replace(/_/g, " ")
}

export function formatPoiRelevance(relevance?: string) {
  if (!relevance) return ""
  return POI_RELEVANCE_LABELS[relevance as PoiTourismRelevance] || relevance.replace(/_/g, " ")
}

export function formatPoiExtractionAction(action?: string) {
  if (!action) return ""
  return POI_EXTRACTION_ACTION_LABELS[action as PoiExtractionAction] || action.replace(/_/g, " ")
}
