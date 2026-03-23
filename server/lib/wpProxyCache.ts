/** Cache mémoire TTL pour réponses proxy WP (réduit charge WordPress). */

const DEFAULT_TTL_MS = 5 * 60 * 1000

interface CacheEntry<T> {
  value: T
  expires: number
}

const store = new Map<string, CacheEntry<unknown>>()

export function getWpProxyTtlMs(): number {
  const raw = process.env.WP_PROXY_CACHE_TTL_MS
  if (raw) {
    const n = parseInt(raw, 10)
    if (!Number.isNaN(n) && n >= 0) return n
  }
  return DEFAULT_TTL_MS
}

export async function getOrSetCache<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  if (ttlMs <= 0) {
    return factory()
  }
  const now = Date.now()
  const hit = store.get(key)
  if (hit && hit.expires > now) {
    return hit.value as T
  }
  const value = await factory()
  store.set(key, { value, expires: now + ttlMs })
  return value
}

export function deleteCacheKey(key: string): void {
  store.delete(key)
}
