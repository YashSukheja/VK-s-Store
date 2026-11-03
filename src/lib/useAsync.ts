import { useCallback, useEffect, useState } from 'react'

type AsyncState<T> = {
  data: T | undefined
  error: string | null
  loading: boolean
  reload: () => void
}

// Last results of loaders given a cache key, so coming back to a page shows it at once.
const cache = new Map<string, unknown>()

/**
 * Runs a loader on mount (and when deps change) and tracks loading and error.
 * With a `cacheKey`, a page you come back to shows the last result straight away
 * and quietly refreshes it in the background.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[], cacheKey?: string): AsyncState<T> {
  const key = cacheKey ? `${cacheKey}:${JSON.stringify(deps)}` : null
  const cached = key && cache.has(key) ? (cache.get(key) as T) : undefined
  const [data, setData] = useState<T | undefined>(cached)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(cached === undefined)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    const quiet = key !== null && cache.has(key) && tick === 0
    if (!quiet) setLoading(true)
    setError(null)
    loader()
      .then((value) => {
        if (key) cache.set(key, value)
        if (alive) setData(value)
      })
      .catch((e: unknown) => {
        // A failed background refresh keeps showing what we had.
        if (alive && !quiet) setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}
