import type { WpPost, WpCategory, WpApiConfig, WpPostsParams, WpPaginatedResponse } from "@/types/wordpress"

export class WordPressClient {
  private config: WpApiConfig
  private headers: HeadersInit

  constructor(config: WpApiConfig) {
    this.config = config
    this.headers = {
      "Content-Type": "application/json",
    }

    if (config.username && config.appPassword) {
      const credentials = btoa(`${config.username}:${config.appPassword}`)
      this.headers["Authorization"] = `Basic ${credentials}`
    }
  }

  private async fetch<T>(endpoint: string, params?: Record<string, string | number | string[]>): Promise<{ data: T; headers: Headers }> {
    const url = new URL(`${this.config.baseUrl}${endpoint}`)
    
    if (this.config.language) {
      url.searchParams.set("wpml_language", this.config.language)
    }

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => url.searchParams.append(key, String(v)))
          } else {
            url.searchParams.set(key, String(value))
          }
        }
      })
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: this.headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(error.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    return { data, headers: response.headers }
  }

  async getPosts(params?: WpPostsParams): Promise<WpPaginatedResponse<WpPost>> {
    const queryParams: Record<string, string | number | string[]> = {}
    
    if (params?.page) queryParams.page = params.page
    if (params?.per_page) queryParams.per_page = params.per_page
    if (params?.search) queryParams.search = params.search
    if (params?.after) queryParams.after = params.after
    if (params?.before) queryParams.before = params.before
    if (params?.categories) queryParams.categories = params.categories.map(String)
    if (params?.status) queryParams.status = params.status
    if (params?.orderby) queryParams.orderby = params.orderby
    if (params?.order) queryParams.order = params.order

    const { data, headers } = await this.fetch<WpPost[]>("/posts", queryParams)

    return {
      data,
      total: parseInt(headers.get("X-WP-Total") ?? "0", 10),
      totalPages: parseInt(headers.get("X-WP-TotalPages") ?? "0", 10),
    }
  }

  async getPost(id: number): Promise<WpPost> {
    const { data } = await this.fetch<WpPost>(`/posts/${id}`)
    return data
  }

  async getCategories(): Promise<WpCategory[]> {
    const { data } = await this.fetch<WpCategory[]>("/categories", { per_page: 100 })
    return data
  }

  async searchPosts(query: string, perPage = 20): Promise<WpPost[]> {
    const { data } = await this.getPosts({ search: query, per_page: perPage })
    return data
  }
}

export function createWordPressClient(
  siteUrl: string, 
  username?: string, 
  appPassword?: string,
  language?: string
): WordPressClient {
  const baseUrl = siteUrl.endsWith("/wp-json/wp/v2") 
    ? siteUrl 
    : `${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2`
  
  return new WordPressClient({
    baseUrl,
    username,
    appPassword,
    language,
  })
}
