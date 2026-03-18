export interface WpPost {
  id: number
  date: string
  date_gmt: string
  modified: string
  modified_gmt: string
  slug: string
  status: "publish" | "draft" | "pending" | "private" | "future" | "trash"
  type: string
  link: string
  title: {
    rendered: string
  }
  content: {
    rendered: string
    protected: boolean
  }
  excerpt: {
    rendered: string
    protected: boolean
  }
  author: number
  featured_media: number
  categories: number[]
  tags: number[]
}

export interface WpCategory {
  id: number
  count: number
  description: string
  link: string
  name: string
  slug: string
  taxonomy: string
  parent: number
}

export interface WpUser {
  id: number
  name: string
  slug: string
  avatar_urls: Record<string, string>
}

export interface WpApiConfig {
  baseUrl: string
  username?: string
  appPassword?: string
}

export interface WpPostsParams {
  page?: number
  per_page?: number
  search?: string
  after?: string
  before?: string
  categories?: number[]
  status?: string[]
  orderby?: "date" | "modified" | "title" | "id"
  order?: "asc" | "desc"
}

export interface WpPaginatedResponse<T> {
  data: T[]
  total: number
  totalPages: number
}
