import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getAnnLatest, getAnnRunById, queryAnnHistory } from '@/features/solar-monitoring/data/ann-source'
import type {
  AnnFieldGroup,
  AnnHistoryResponse,
  AnnRange,
  AnnResolution,
  AnnRunDetail,
} from '@/shared/types/ann'

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

export type AnnDashboardTimeFilter = {
  enabled: boolean
  startAtLocal: string
  endAtLocal: string
}

const DEFAULT_FILTERS: AnnDashboardFilters = {
  overallResult: 'all',
  sensorResult: 'all',
  weatherMismatch: 'all',
  fieldGroup: 'all',
  relayApplied: 'all',
}

const DEFAULT_TIME_FILTER: AnnDashboardTimeFilter = {
  enabled: false,
  startAtLocal: '',
  endAtLocal: '',
}

function toIsoDateOrNull(value: string) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
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

function resolveSelectedRunId(
  currentSelection: number | null,
  previousLatestRunId: number | null,
  nextLatestRunId: number | null,
  firstHistoryRunId: number | null,
) {
  if (currentSelection === null) {
    return nextLatestRunId ?? firstHistoryRunId ?? null
  }

  // Keep following latest if user had latest selected before the refresh.
  if (previousLatestRunId !== null && currentSelection === previousLatestRunId) {
    return nextLatestRunId ?? firstHistoryRunId ?? null
  }

  // Otherwise preserve explicit user-selected history row.
  return currentSelection
}

type AnnDashboardDataOptions = {
  includeTrend?: boolean
}

export function useAnnDashboardData(options: AnnDashboardDataOptions = {}) {
  const [range, setRange] = useState<AnnRange>('1h')
  const [filters, setFilters] = useState<AnnDashboardFilters>(DEFAULT_FILTERS)
  const [timeFilter, setTimeFilter] = useState<AnnDashboardTimeFilter>(DEFAULT_TIME_FILTER)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(ANN_DEFAULT_PAGE_SIZE)
  const [selectedField, setSelectedField] = useState('VOLTAGE')
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [history, setHistory] = useState<AnnHistoryResponse | null>(null)
  const [latestRun, setLatestRun] = useState<AnnRunDetail | null>(null)
  const [selectedRun, setSelectedRun] = useState<AnnRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error] = useState<string | null>(null)
  const latestRunIdRef = useRef<number | null>(null)

  const includeTrend = options.includeTrend ?? true
  const resolution = DEFAULT_RESOLUTION[range]

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
  }, [range, filters, timeFilter])

  useEffect(() => {
    setLoading(true)

    const startAt = timeFilter.enabled ? toIsoDateOrNull(timeFilter.startAtLocal) : null
    const endAt = timeFilter.enabled ? toIsoDateOrNull(timeFilter.endAtLocal) : null

    const nextHistory = queryAnnHistory({
      range,
      resolution,
      page: historyPage,
      pageSize: historyPageSize,
      includeTrend,
      filters,
      startAt,
      endAt,
    })
    const nextLatest = getAnnLatest()
    const previousLatestRunId = latestRunIdRef.current
    const nextLatestRunId = nextLatest?.id ?? null
    const firstHistoryRunId = nextHistory.runs[0]?.id ?? null

    setHistory(nextHistory)
    setLatestRun(nextLatest)
    setSelectedField((current) => {
      const availableFieldNames = new Set<string>()

      nextLatest?.predictionCheck.fields.forEach((field) => availableFieldNames.add(field.name))
      nextHistory.runs.forEach((run) => {
        run.fields.forEach((field) => availableFieldNames.add(field.name))
      })

      return availableFieldNames.has(current) ? current : preferredField(nextHistory, nextLatest)
    })

    setSelectedRunId((current) =>
      resolveSelectedRunId(current, previousLatestRunId, nextLatestRunId, firstHistoryRunId),
    )
    latestRunIdRef.current = nextLatestRunId
    setLoading(false)
  }, [includeTrend, historyPage, historyPageSize, range, resolution, filters, timeFilter])

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null)
      return
    }

    if (latestRun?.id === selectedRunId) {
      setSelectedRun(latestRun)
      return
    }

    setDetailLoading(true)
    setSelectedRun(getAnnRunById(selectedRunId))
    setDetailLoading(false)
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
    timeFilter,
    setTimeFilter,
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
