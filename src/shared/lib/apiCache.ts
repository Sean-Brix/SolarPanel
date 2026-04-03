type CachedJsonResponse<T> = {
  ok: boolean
  status: number
  body: T
}

type CacheEntry = {
  expiresAt: number
  value: CachedJsonResponse<unknown>
}

const responseCache = new Map<string, CacheEntry>()
const inflightRequests = new Map<string, Promise<CachedJsonResponse<unknown>>>()

function buildCacheKey(url: string, init?: RequestInit) {
  return `${init?.method ?? 'GET'}:${url}`
}

async function parseBody(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function fetchJsonCached<T>(
  url: string,
  options?: {
    ttlMs?: number
    init?: RequestInit
    force?: boolean
  },
): Promise<CachedJsonResponse<T>> {
  const ttlMs = options?.ttlMs ?? 30_000
  const cacheKey = buildCacheKey(url, options?.init)
  const now = Date.now()
  const cached = responseCache.get(cacheKey)

  if (!options?.force && cached && cached.expiresAt > now) {
    return cached.value as CachedJsonResponse<T>
  }

  if (!options?.force) {
    const inflight = inflightRequests.get(cacheKey)

    if (inflight) {
      return inflight as Promise<CachedJsonResponse<T>>
    }
  }

  const requestInit: RequestInit = options?.force
    ? {
        ...(options?.init ?? {}),
        cache: 'no-store',
      }
    : (options?.init ?? {})

  const request = fetch(url, requestInit)
    .then(async (response) => {
      const value: CachedJsonResponse<T> = {
        ok: response.ok,
        status: response.status,
        body: (await parseBody(response)) as T,
      }

      responseCache.set(cacheKey, {
        expiresAt: Date.now() + ttlMs,
        value,
      })

      return value
    })
    .finally(() => {
      inflightRequests.delete(cacheKey)
    })

  inflightRequests.set(cacheKey, request as Promise<CachedJsonResponse<unknown>>)

  return request
}

export function clearApiCache(prefix = '/api/') {
  for (const key of responseCache.keys()) {
    if (key.includes(prefix)) {
      responseCache.delete(key)
    }
  }

  for (const key of inflightRequests.keys()) {
    if (key.includes(prefix)) {
      inflightRequests.delete(key)
    }
  }
}