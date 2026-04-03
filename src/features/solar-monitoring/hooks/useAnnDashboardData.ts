import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchJsonCached } from '@/shared/lib/apiCache'
import type {
  AnnFieldGroup,
  AnnHistoryResponse,
  AnnRange,
  AnnResolution,
  AnnRunDetail,
} from '@/shared/types/ann'

const ANN_HISTORY_CACHE_MS = 30 * 1000
const ANN_DEFAULT_PAGE_SIZE = 25

const DEFAULT_RESOLUTION: Record<AnnRange, AnnResolution> = {
  '1h': 'raw',
  '24h': '5m',
  '7d': '1h',
  '30d': '1d',
}

export type AnnDashboardFilters = {
  overallResult: 'all' | 'CORRECT' | 'INCORRECT'
  sensorResult: 'all' | 'CORRECT' | 'INCORRECT'
  weatherMismatch: 'all' | 'true' | 'false'
  fieldGroup: 'all' | AnnFieldGroup
  relayApplied: 'all' | 'true' | 'false'
}

const DEFAULT_FILTERS: AnnDashboardFilters = {
  overallResult: 'all',
  sensorResult: 'all',
  weatherMismatch: 'all',
  fieldGroup: 'all',
  relayApplied: 'all',
}

function buildHistoryQuery(
  range: AnnRange,
  resolution: AnnResolution,
  page: number,
  pageSize: number,
  includeTrend: boolean,
  filters: AnnDashboardFilters,
) {
  const params = new URLSearchParams({
    range,
    resolution,
    page: String(page),
    pageSize: String(pageSize),
    includeTrend: includeTrend ? 'true' : 'false',
  })

  if (filters.overallResult !== 'all') {
    params.set('overallResult', filters.overallResult)
  }

  if (filters.sensorResult !== 'all') {
    params.set('sensorResult', filters.sensorResult)
  }

  if (filters.weatherMismatch !== 'all') {
    params.set('weatherMismatch', filters.weatherMismatch)
  }

  if (filters.fieldGroup !== 'all') {
    params.set('fieldGroup', filters.fieldGroup)
  }

  if (filters.relayApplied !== 'all') {
    params.set('relayApplied', filters.relayApplied)
  }

  return params.toString()
}

function preferredField(history: AnnHistoryResponse | null, latestRun: AnnRunDetail | null) {
  if (latestRun?.worstField?.name) {
    return latestRun.worstField.name
  }

  if (history?.runs[0]?.worstField?.name) {
    return history.runs[0].worstField.name
  }

  if (latestRun?.predictionCheck.fields[0]?.name) {
    return latestRun.predictionCheck.fields[0].name
  }

  return 'VOLTAGE'
}

type AnnDashboardDataOptions = {
  includeTrend?: boolean
}

export function useAnnDashboardData(options: AnnDashboardDataOptions = {}) {
  const [range, setRange] = useState<AnnRange>('1h')
  const [filters, setFilters] = useState<AnnDashboardFilters>(DEFAULT_FILTERS)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(ANN_DEFAULT_PAGE_SIZE)
  const [selectedField, setSelectedField] = useState('VOLTAGE')
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [history, setHistory] = useState<AnnHistoryResponse | null>(null)
  const [latestRun, setLatestRun] = useState<AnnRunDetail | null>(null)
  const [selectedRun, setSelectedRun] = useState<AnnRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const includeTrend = options.includeTrend ?? true
  const resolution = DEFAULT_RESOLUTION[range]
  const query = useMemo(
    () => buildHistoryQuery(range, resolution, historyPage, historyPageSize, includeTrend, filters),
    [filters, historyPage, historyPageSize, includeTrend, range, resolution],
  )

  const setPage = useCallback((page: number) => {
    setHistoryPage(Math.max(1, Math.trunc(page || 1)))
  }, [])

  const setPageSize = useCallback((pageSize: number) => {
    const normalized = Math.min(Math.max(Math.trunc(pageSize || ANN_DEFAULT_PAGE_SIZE), 1), 500)
    setHistoryPageSize(normalized)
    setHistoryPage(1)
  }, [])

  useEffect(() => {
    setHistoryPage(1)
  }, [range, filters])

  useEffect(() => {
    let active = true

    const loadLatest = async (force = false) => {
      const latestResponse = await fetchJsonCached<AnnRunDetail | { message: string }>(`/api/ann/latest`, {
        ttlMs: ANN_HISTORY_CACHE_MS,
        force,
      })

      if (!active) {
        return
      }

      const nextLatest =
        latestResponse.ok && latestResponse.status !== 404
          ? (latestResponse.body as AnnRunDetail)
          : null

      setLatestRun(nextLatest)
      setSelectedField((current) => {
        if (!nextLatest) {
          return current
        }

        const availableFieldNames = new Set<string>()
        nextLatest.predictionCheck.fields.forEach((field) => availableFieldNames.add(field.name))

        return availableFieldNames.has(current)
          ? current
          : preferredField(null, nextLatest)
      })
      setSelectedRunId((current) => current ?? nextLatest?.id ?? null)
    }

    const load = async (force = false) => {
      setLoading(true)
      setError(null)

      try {
        const [historyResponse, latestResponse] = await Promise.all([
          fetchJsonCached<AnnHistoryResponse>(`/api/ann/history?${query}`, {
            ttlMs: ANN_HISTORY_CACHE_MS,
            force,
          }),
          fetchJsonCached<AnnRunDetail | { message: string }>(`/api/ann/latest`, {
            ttlMs: ANN_HISTORY_CACHE_MS,
            force,
          }),
        ])

        if (!historyResponse.ok) {
          throw new Error(`Failed to load ANN history (${historyResponse.status})`)
        }

        const nextHistory = historyResponse.body
        const nextLatest =
          latestResponse.ok && latestResponse.status !== 404
            ? (latestResponse.body as AnnRunDetail)
            : null

        if (!active) {
          return
        }

        setHistory(nextHistory)
        setLatestRun(nextLatest)
        setSelectedField((current) => {
          const availableFieldNames = new Set<string>()

          nextLatest?.predictionCheck.fields.forEach((field) => availableFieldNames.add(field.name))
          nextHistory.runs.forEach((run) => {
            run.fields.forEach((field) => availableFieldNames.add(field.name))
          })

          return availableFieldNames.has(current)
            ? current
            : preferredField(nextHistory, nextLatest)
        })

        setSelectedRunId((current) => current ?? nextLatest?.id ?? nextHistory.runs[0]?.id ?? null)
      } catch (loadError) {
        if (!active) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Unable to fetch ANN dashboard')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    const events = new EventSource('/api/events/readings')
    const onReadingEvent = (message: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(message.data) as { panelType?: string }

        if (payload.panelType === 'ann' && document.visibilityState === 'visible') {
          if (includeTrend || historyPage === 1) {
            void load(true)
          } else {
            void loadLatest(true).catch((latestError) => {
              if (!active) {
                return
              }

              setError(
                latestError instanceof Error
                  ? latestError.message
                  : 'Unable to refresh latest ANN run',
              )
            })
          }
        }
      } catch {
        if (document.visibilityState === 'visible') {
          if (includeTrend || historyPage === 1) {
            void load(true)
          } else {
            void loadLatest(true).catch((latestError) => {
              if (!active) {
                return
              }

              setError(
                latestError instanceof Error
                  ? latestError.message
                  : 'Unable to refresh latest ANN run',
              )
            })
          }
        }
      }
    }

    events.addEventListener('reading', onReadingEvent as EventListener)

    return () => {
      active = false
      events.removeEventListener('reading', onReadingEvent as EventListener)
      events.close()
    }
  }, [includeTrend, historyPage, query])

  useEffect(() => {
    let active = true

    if (!selectedRunId) {
      setSelectedRun(null)
      return
    }

    if (latestRun?.id === selectedRunId) {
      setSelectedRun(latestRun)
      return
    }

    const loadDetail = async () => {
      setDetailLoading(true)

      try {
        const response = await fetchJsonCached<AnnRunDetail>(`/api/ann/${selectedRunId}`, {
          ttlMs: ANN_HISTORY_CACHE_MS,
        })

        if (!response.ok) {
          throw new Error(`Failed to load ANN run ${selectedRunId} (${response.status})`)
        }

        if (!active) {
          return
        }

        setSelectedRun(response.body)
      } catch (detailError) {
        if (!active) {
          return
        }

        setError(detailError instanceof Error ? detailError.message : 'Unable to load ANN run')
      } finally {
        if (active) {
          setDetailLoading(false)
        }
      }
    }

    void loadDetail()

    return () => {
      active = false
    }
  }, [latestRun, selectedRunId])

  const fieldOptions = useMemo(() => {
    const values = new Set<string>()

    latestRun?.predictionCheck.fields.forEach((field) => values.add(field.name))
    history?.runs.forEach((run) => {
      run.fields.forEach((field) => values.add(field.name))
    })
    history?.trend.forEach((point) => {
      Object.keys(point.fieldStats).forEach((fieldName) => values.add(fieldName))
    })

    return Array.from(values).sort((left, right) => left.localeCompare(right))
  }, [history, latestRun])

  useEffect(() => {
    if (!history) {
      return
    }

    if (history.meta.page !== historyPage) {
      setHistoryPage(history.meta.page)
    }

    if (history.meta.pageSize !== historyPageSize) {
      setHistoryPageSize(history.meta.pageSize)
    }
  }, [history, historyPage, historyPageSize])

  return {
    range,
    setRange,
    resolution,
    filters,
    setFilters,
    historyPage,
    historyPageSize,
    setHistoryPage: setPage,
    setHistoryPageSize: setPageSize,
    selectedField,
    setSelectedField,
    selectedRunId,
    setSelectedRunId,
    history,
    latestRun,
    selectedRun,
    loading,
    detailLoading,
    error,
    fieldOptions,
  }
}
