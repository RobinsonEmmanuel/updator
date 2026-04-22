export interface CreateRlBody {
  siteId: string
  regionId?: string
  candidateId?: string
  name?: string
  placeName?: string
  placeType?: string
  clusterId?: string
  clusterName?: string
  blocks?: Record<string, unknown>[]
  payload?: Record<string, unknown>
}

export interface ManualLinkResponse {
  success: boolean
  articleId: string
  rlPlaceId: string
  status: string
  duplicate_link_prevented: boolean
  existingCandidateId?: string
}

export interface CreateRlResponse {
  success: boolean
  articleId: string
  createdRlPlaceId?: string
  createdRlPlaceInstanceId?: string
  rl_write_target?: string
  rl_read_target?: string
  duplicate_link_prevented?: boolean
  existingCandidateId?: string
}
