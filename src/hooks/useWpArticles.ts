import { useQuery, useInfiniteQuery } from "@tanstack/react-query"
import { createWordPressClient } from "@/lib/wordpress"
import type { WpPostsParams } from "@/types/wordpress"

interface UseWpPostsOptions {
  siteUrl: string
  username?: string
  appPassword?: string
  params?: WpPostsParams
  enabled?: boolean
}

export function useWpPosts({ siteUrl, username, appPassword, params, enabled = true }: UseWpPostsOptions) {
  const client = createWordPressClient(siteUrl, username, appPassword)

  return useQuery({
    queryKey: ["wp-posts", siteUrl, params],
    queryFn: () => client.getPosts(params),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function useWpPostsInfinite({ siteUrl, username, appPassword, params, enabled = true }: UseWpPostsOptions) {
  const client = createWordPressClient(siteUrl, username, appPassword)
  const perPage = params?.per_page ?? 20

  return useInfiniteQuery({
    queryKey: ["wp-posts-infinite", siteUrl, params],
    queryFn: ({ pageParam = 1 }) => client.getPosts({ ...params, page: pageParam, per_page: perPage }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = allPages.length + 1
      return nextPage <= lastPage.totalPages ? nextPage : undefined
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export function useWpPost(siteUrl: string, postId: number, credentials?: { username: string; appPassword: string }) {
  const client = createWordPressClient(siteUrl, credentials?.username, credentials?.appPassword)

  return useQuery({
    queryKey: ["wp-post", siteUrl, postId],
    queryFn: () => client.getPost(postId),
    enabled: !!postId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useWpCategories(siteUrl: string, credentials?: { username: string; appPassword: string }) {
  const client = createWordPressClient(siteUrl, credentials?.username, credentials?.appPassword)

  return useQuery({
    queryKey: ["wp-categories", siteUrl],
    queryFn: () => client.getCategories(),
    staleTime: 30 * 60 * 1000,
  })
}
