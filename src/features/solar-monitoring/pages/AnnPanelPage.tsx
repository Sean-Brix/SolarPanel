import { useDeferredValue, useMemo, useState } from 'react'
import { BrainCircuit, CheckCircle2, Clock3, Download, Waves } from 'lucide-react'
import { ChartCard } from '@/features/solar-monitoring/components/ChartCard'
import { PageHeader } from '@/features/solar-monitoring/components/PageHeader'
import {
  useAnnDashboardData,
  type AnnDashboardFilters,
} from '@/features/solar-monitoring/hooks/useAnnDashboardData'
import { cn } from '@/shared/lib/cn'
import { fetchJsonCached } from '@/shared/lib/apiCache'
import { buildDaySheets, exportWorkbookByDay } from '@/shared/lib/excelExport'
import { formatDateTime, formatNumber } from '@/shared/lib/formatters'
import type {
  AnnFieldResult,
  AnnHistoryResponse,
  AnnRange,
  AnnResolution,
  AnnRunSummary,
  AnnSample,
} from '@/shared/types/ann'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { ScrollArea } from '@/shared/ui/scroll-area'

type AnnView = 'accuracy' | 'weather' | 'field' | 'history' | 'detail'

const ANN_RANGE_LABELS: Record<AnnRange, string> = {
  '1h': 'Last hour',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
}

const ANN_VIEW_OPTIONS: Array<{ value: AnnView; label: string }> = [
  { value: 'accuracy', label: 'Accuracy over time' },
  { value: 'weather', label: 'Weather checks over time' },
  { value: 'field', label: 'Field compare over time' },
  { value: 'history', label: 'Run history' },
  { value: 'detail', label: 'Selected run detail' },
]

type AnnPayloadExportRow = {
  timestampIso: string
  Timestamp: string
  RunId: number
  Payload?: string
  [key: string]: string | number | boolean | null | undefined
}

function formatPrimitive(value: unknown) {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function flattenAnnPayload(
  value: unknown,
  path = '',
  output: Record<string, string> = {},
): Record<string, string> {
  if (Array.isArray(value)) {
    if (!value.length) {
      output[path || 'value'] = '[]'
      return output
    }

    value.forEach((item, index) => {
      const nextPath = path ? `${path}[${index}]` : `[${index}]`
      flattenAnnPayload(item, nextPath, output)
    })

    return output
  }

  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>
    const keys = Object.keys(input).sort((left, right) => left.localeCompare(right))

    if (!keys.length) {
      output[path || 'value'] = '{}'
      return output
    }

    for (const key of keys) {
      const nextPath = path ? `${path}.${key}` : key
      flattenAnnPayload(input[key], nextPath, output)
    }

    return output
  }

  output[path || 'value'] = formatPrimitive(value)
  return output
}

function buildAnnPayloadColumns(run: AnnRunSummary) {
  const flat = flattenAnnPayload(run)
  const entries = Object.entries(flat).sort(([left], [right]) => left.localeCompare(right))

  return Object.fromEntries(entries)
}

const ANN_EXPORT_PAGE_SIZE = 500

const ANN_DEFAULT_RESOLUTION: Record<AnnRange, AnnResolution> = {
  '1h': 'raw',
  '24h': '5m',
  '7d': '1h',
  '30d': '1d',
}

function buildAnnExportHistoryQuery(
  range: AnnRange,
  resolution: AnnResolution,
  page: number,
  pageSize: number,
  filters: AnnDashboardFilters,
) {
  const params = new URLSearchParams({
    range,
    resolution,
    page: String(page),
    pageSize: String(pageSize),
    includeTrend: 'false',
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

async function fetchAllAnnRuns(range: AnnRange, filters: AnnDashboardFilters) {
  const resolution = ANN_DEFAULT_RESOLUTION[range]
  const runs: AnnRunSummary[] = []
  let page = 1

  while (true) {
    const query = buildAnnExportHistoryQuery(range, resolution, page, ANN_EXPORT_PAGE_SIZE, filters)
    const response = await fetchJsonCached<AnnHistoryResponse>(`/api/ann/history?${query}`, {
      ttlMs: 30_000,
      force: true,
    })

    if (!response.ok) {
      throw new Error(`Failed to load ANN export data (${response.status})`)
    }

    runs.push(...response.body.runs)

    if (!response.body.meta.hasNext) {
      break
    }

    page += 1
  }

  return runs
}

function statusVariant(value: string) {
  const normalized = value.toUpperCase()

  if (normalized === 'CORRECT' || normalized === 'OK') return 'success' as const
  if (normalized === 'INCORRECT' || normalized === 'MISMATCH') return 'danger' as const
  if (normalized === 'UNKNOWN') return 'neutral' as const
  return 'warning' as const
}

function formatRelativeTime(isoTimestamp: string) {
  const deltaSeconds = Math.max(0, Math.round((Date.now() - new Date(isoTimestamp).getTime()) / 1000))

  if (deltaSeconds < 60) return `${deltaSeconds}s ago`

  const deltaMinutes = Math.round(deltaSeconds / 60)
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`

  const deltaHours = Math.round(deltaMinutes / 60)
  if (deltaHours < 24) return `${deltaHours}h ago`

  return `${Math.round(deltaHours / 24)}d ago`
}

function formatFieldValue(fieldName: string, value: number) {
  const normalized = fieldName.toUpperCase()

  if (normalized === 'VOLTAGE') return `${formatNumber(value, 2)} V`
  if (normalized === 'CURRENT_MA') return `${formatNumber(value, 2)} mA`
  if (normalized === 'POWER_MW') return `${formatNumber(value, 2)} mW`
  if (normalized.startsWith('RELAY')) return formatNumber(value, 0)
  return formatNumber(value, 2)
}

function mismatchRatio(field: AnnFieldResult) {
  if (field.tolerance > 0) {
    return field.difference / field.tolerance
  }

  return field.difference === 0 ? 0 : 1
}

function formatAnnResultLabel(value: string) {
  const normalized = value.toUpperCase().replace(/_/g, ' ')
  if (normalized === 'INCORRECT' || normalized === 'MISMATCH') {
    return 'NOT CORRECT'
  }

  return normalized
}

function toRelayStateLabel(value: number, state?: string) {
  const normalized = (state ?? '').toUpperCase()

  if (normalized.includes('CLOSE') || normalized === 'OFF' || value === 0) {
    return 'CLOSED'
  }

  if (normalized.includes('OPEN') || normalized === 'ON' || value === 1) {
    return 'OPEN'
  }

  return normalized || (value === 0 ? 'CLOSED' : 'OPEN')
}

function formatRelaySampleValue(sampleRelay: AnnSample['relay1']) {
  return `${formatNumber(sampleRelay.value, 0)} (${toRelayStateLabel(sampleRelay.value, sampleRelay.state)})`
}

function formatRelayFieldValue(value: number) {
  return `${formatNumber(value, 0)} (${toRelayStateLabel(value)})`
}

const ANN_SAMPLE_FIELDS: Array<{ label: string; read: (sample: AnnSample) => string }> = [
  { label: 'LDR1', read: (sample) => formatNumber(sample.ldr1, 2) },
  { label: 'LDR2', read: (sample) => formatNumber(sample.ldr2, 2) },
  { label: 'LDR3', read: (sample) => formatNumber(sample.ldr3, 2) },
  { label: 'LDR4', read: (sample) => formatNumber(sample.ldr4, 2) },
  { label: 'ACCX', read: (sample) => formatNumber(sample.accX, 2) },
  { label: 'ACCY', read: (sample) => formatNumber(sample.accY, 2) },
  { label: 'ACCZ', read: (sample) => formatNumber(sample.accZ, 2) },
  { label: 'GYROX', read: (sample) => formatNumber(sample.gyroX, 2) },
  { label: 'GYROY', read: (sample) => formatNumber(sample.gyroY, 2) },
  { label: 'GYROZ', read: (sample) => formatNumber(sample.gyroZ, 2) },
  { label: 'VOLTAGE', read: (sample) => formatNumber(sample.voltage, 2) },
  { label: 'CURRENT_MA', read: (sample) => formatNumber(sample.currentMa, 2) },
  { label: 'POWER_MW', read: (sample) => formatNumber(sample.powerMw, 2) },
  { label: 'RELAY1', read: (sample) => formatRelaySampleValue(sample.relay1) },
  { label: 'RELAY2', read: (sample) => formatRelaySampleValue(sample.relay2) },
  { label: 'RELAY3', read: (sample) => formatRelaySampleValue(sample.relay3) },
  { label: 'RELAY4', read: (sample) => formatRelaySampleValue(sample.relay4) },
]

function SampleReportTable({ sample }: { sample: AnnSample }) {
  return (
    <table className="w-full text-left text-xs sm:text-sm">
      <tbody>
        {ANN_SAMPLE_FIELDS.map((field) => (
          <tr key={field.label} className="border-b border-slate-200/80 dark:border-white/10">
            <th className="w-[180px] px-4 py-1.5 font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100 sm:w-[220px]">
              {field.label}
            </th>
            <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">: {field.read(sample)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function WeatherReportTable({
  timestamp,
  hour,
  weatherCode,
  weather,
  temperatureC,
  humidity,
}: {
  timestamp: string
  hour: number
  weatherCode: number
  weather: string
  temperatureC: number
  humidity: number
}) {
  return (
    <table className="w-full text-left text-xs sm:text-sm">
      <tbody>
        <tr className="border-b border-slate-200/80 dark:border-white/10">
          <th className="w-[180px] px-4 py-1.5 font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100 sm:w-[220px]">TIMESTAMP</th>
          <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">: {timestamp}</td>
        </tr>
        <tr className="border-b border-slate-200/80 dark:border-white/10">
          <th className="px-4 py-1.5 font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100">HOUR</th>
          <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">: {formatNumber(hour, 0)}</td>
        </tr>
        <tr className="border-b border-slate-200/80 dark:border-white/10">
          <th className="px-4 py-1.5 font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100">WEATHER CODE</th>
          <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">: {formatNumber(weatherCode, 0)}</td>
        </tr>
        <tr className="border-b border-slate-200/80 dark:border-white/10">
          <th className="px-4 py-1.5 font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100">WEATHER</th>
          <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">: {weather}</td>
        </tr>
        <tr className="border-b border-slate-200/80 dark:border-white/10">
          <th className="px-4 py-1.5 font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100">TEMP C</th>
          <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">: {formatNumber(temperatureC, 1)}</td>
        </tr>
        <tr>
          <th className="px-4 py-1.5 font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100">HUMIDITY %</th>
          <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">: {formatNumber(humidity, 0)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  note,
  variant = 'neutral',
}: {
  icon: typeof CheckCircle2
  label: string
  value: string
  note: string
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const toneClasses = {
    neutral: 'border-slate-200 bg-slate-100/80 dark:border-white/10 dark:bg-white/[0.03]',
    info: 'border-cyan-400/20 bg-cyan-400/10',
    success: 'border-emerald-400/20 bg-emerald-400/10',
    warning: 'border-amber-400/20 bg-amber-400/10',
    danger: 'border-rose-400/20 bg-rose-400/10',
  }

  return (
    <Card className={cn('overflow-hidden', toneClasses[variant])}>
      <CardContent className="pt-4 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl">{value}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/85 p-3 dark:border-white/10 dark:bg-slate-950/50">
            <Icon className="h-5 w-5 text-slate-900 dark:text-white" />
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{note}</p>
      </CardContent>
    </Card>
  )
}

type AnnHistoryTableProps = {
  runs: AnnRunSummary[]
  selectedRunId: number | null
  onSelectRun: (runId: number) => void
  page: number
  pageSize: number
  totalPages: number
  totalRuns: number
  hasPrev: boolean
  hasNext: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  loading: boolean
}

function AnnHistoryTable({
  runs,
  selectedRunId,
  onSelectRun,
  page,
  pageSize,
  totalPages,
  totalRuns,
  hasPrev,
  hasNext,
  onPageChange,
  onPageSizeChange,
  loading,
}: AnnHistoryTableProps) {
  const safeTotalPages = Math.max(totalPages, 1)
  const safePage = Math.min(Math.max(page, 1), safeTotalPages)
  const firstRunIndex = totalRuns === 0 ? 0 : (safePage - 1) * pageSize + 1
  const lastRunIndex = Math.min(safePage * pageSize, totalRuns)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run History</CardTitle>
        <CardDescription>
          Server-paginated ANN run summaries. Click a row to open exact record payload.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Showing {firstRunIndex}-{lastRunIndex} of {totalRuns}
          </p>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <label className="flex items-center gap-2 text-xs text-slate-600 sm:text-sm dark:text-slate-300">
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              disabled={!hasPrev}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Prev
            </button>
            <span className="text-xs text-slate-600 sm:text-sm dark:text-slate-300">
              Page {safePage} / {safeTotalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))}
              disabled={!hasNext}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>

        {loading ? (
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Loading page...</p>
        ) : null}

        <ScrollArea className="w-full">
          <div className="min-w-[940px]">
            <table className="w-full border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Overall</th>
                  <th className="pb-2">Sensor</th>
                  <th className="pb-2">Weather</th>
                  <th className="pb-2">Accuracy</th>
                  <th className="pb-2">Worst Field</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => onSelectRun(run.id)}
                    className={cn(
                      'cursor-pointer rounded-2xl text-slate-700 transition dark:text-slate-300',
                      selectedRunId === run.id
                        ? 'bg-cyan-400/10'
                        : 'bg-slate-100/80 hover:bg-slate-200/80 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]',
                    )}
                  >
                    <td className="rounded-l-2xl border-y border-l border-slate-200/90 px-4 py-3 dark:border-white/8">
                      {formatDateTime(new Date(run.createdAt))}
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">
                      <Badge variant={statusVariant(run.overallResult)}>{run.overallResult}</Badge>
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">
                      <Badge variant={statusVariant(run.sensorResult)}>{run.sensorResult}</Badge>
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">
                      {run.weatherCheck.matchCount}/{run.weatherCheck.total}
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">
                      {formatNumber(run.accuracyPct, 1)}%
                    </td>
                    <td className="rounded-r-2xl border-y border-r border-slate-200/90 px-4 py-3 dark:border-white/8">
                      {run.worstField ? `${run.worstField.name} (${formatNumber(run.worstField.ratio, 2)}x)` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export function AnnPanelPage() {
  const [view, setView] = useState<AnnView>('accuracy')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [isPayloadModalOpen, setIsPayloadModalOpen] = useState(false)
  const includeTrend = view === 'accuracy' || view === 'weather' || view === 'field'

  const {
    range,
    setRange,
    resolution,
    filters,
    setFilters,
    historyPage,
    historyPageSize,
    setHistoryPage,
    setHistoryPageSize,
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
  } = useAnnDashboardData({ includeTrend })

  const trend = useDeferredValue(history?.trend ?? [])
  const detailRun = selectedRun ?? latestRun
  const runs = history?.runs ?? []
  const currentHistoryPage = history?.meta.page ?? historyPage
  const currentHistoryPageSize = history?.meta.pageSize ?? historyPageSize
  const historyTotalPages = history?.meta.totalPages ?? 1
  const historyTotalRuns = history?.meta.totalRuns ?? 0
  const historyHasPrev = history?.meta.hasPrev ?? false
  const historyHasNext = history?.meta.hasNext ?? false

  const fieldName = fieldOptions.includes(selectedField)
    ? selectedField
    : fieldOptions[0] ?? 'VOLTAGE'

  const accuracyData = useMemo(
    () =>
      trend.map((point) => ({
        label: point.label,
        accuracyPct: point.accuracyPct,
        overallCorrectPct: point.overallCorrectPct,
        latestRunId: point.latestRunId,
      })),
    [trend],
  )

  const weatherTrendData = useMemo(
    () =>
      trend.map((point) => ({
        label: point.label,
        weatherCode: point.weatherCodePassPct,
        time: point.timePassPct,
        temperature: point.tempPassPct,
        humidity: point.humidityPassPct,
        latestRunId: point.latestRunId,
      })),
    [trend],
  )

  const fieldCompareData = useMemo(
    () =>
      trend.map((point) => {
        const stat = point.fieldStats[fieldName]

        return {
          label: point.label,
          predicted: stat?.predicted,
          actual: stat?.actual,
          latestRunId: point.latestRunId,
        }
      }),
    [fieldName, trend],
  )

  const topMismatches = useMemo(() => {
    if (!detailRun) {
      return []
    }

    return [...detailRun.predictionCheck.fields]
      .sort((left, right) => mismatchRatio(right) - mismatchRatio(left))
      .slice(0, 6)
  }, [detailRun])

  const handleFilterChange = <K extends keyof AnnDashboardFilters>(
    key: K,
    value: AnnDashboardFilters[K],
  ) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const openRun = (runId: number) => {
    setSelectedRunId(runId)
    setIsPayloadModalOpen(true)
  }

  const closePayloadModal = () => {
    setIsPayloadModalOpen(false)
  }

  const handleExportExcel = async () => {
    setIsExporting(true)
    setExportError(null)

    try {
      const runsForExport = await fetchAllAnnRuns(range, filters)
      const rows: AnnPayloadExportRow[] = runsForExport.map((run) => ({
        timestampIso: run.createdAt,
        Timestamp: new Date(run.createdAt).toLocaleString('en-US'),
        RunId: run.id,
        ...buildAnnPayloadColumns(run),
      }))

      const daySheets = buildDaySheets(rows, (row) => new Date(row.timestampIso)).map((sheet) => ({
        ...sheet,
        rows: sheet.rows.map(({ timestampIso: _timestampIso, ...row }) => row),
      }))

      const activeFilterSummary = [
        `overall=${filters.overallResult}`,
        `sensor=${filters.sensorResult}`,
        `weatherMismatch=${filters.weatherMismatch}`,
        `fieldGroup=${filters.fieldGroup}`,
        `relayApplied=${filters.relayApplied}`,
      ].join(', ')

      const overviewRows = [
        { Metric: 'Panel', Value: 'ANN' },
        { Metric: 'Range', Value: ANN_RANGE_LABELS[range] },
        { Metric: 'Overall status', Value: latestRun?.overallResult ?? 'WAITING' },
        { Metric: 'Sensor status', Value: latestRun?.sensorResult ?? 'WAITING' },
        {
          Metric: 'Weather match',
          Value: latestRun ? `${latestRun.weatherCheck.matchCount}/${latestRun.weatherCheck.total}` : 'N/A',
        },
        { Metric: 'Last update', Value: latestRun ? formatDateTime(new Date(latestRun.createdAt)) : 'N/A' },
        { Metric: 'Active filters', Value: activeFilterSummary },
        { Metric: 'Exported rows', Value: rows.length },
      ]

      await exportWorkbookByDay({
        fileName: `ann-panel-${range}-${new Date().toISOString().slice(0, 10)}.xlsx`,
        overviewRows,
        daySheets,
      })
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Failed to export ANN workbook')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow="ANN prediction monitor"
        title="ANN Smart Panel"
        description="Time-series monitoring of ANN prediction accuracy using persisted run history."
        connection={latestRun ? `${latestRun.deviceId} | ${latestRun.source}` : 'Awaiting ANN data'}
        status={latestRun ? (latestRun.overallResult === 'CORRECT' ? 'normal' : 'warning') : 'warning'}
        lastUpdated={latestRun ? new Date(latestRun.createdAt) : new Date()}
      />

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => {
            void handleExportExcel()
          }}
          disabled={isExporting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Download className="h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export Excel'}
        </button>
      </div>

      {exportError ? (
        <Card>
          <CardContent className="pt-4 sm:pt-5">
            <p className="text-sm text-rose-700 dark:text-rose-200">{exportError}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile
          icon={CheckCircle2}
          label="Overall"
          value={latestRun?.overallResult ?? 'WAITING'}
          note="Latest run verdict"
          variant={latestRun ? statusVariant(latestRun.overallResult) : 'neutral'}
        />
        <SummaryTile
          icon={BrainCircuit}
          label="Sensor"
          value={latestRun?.sensorResult ?? 'WAITING'}
          note="Sensor agreement"
          variant={latestRun ? statusVariant(latestRun.sensorResult) : 'neutral'}
        />
        <SummaryTile
          icon={Waves}
          label="Weather Match"
          value={
            latestRun
              ? `${latestRun.weatherCheck.matchCount}/${latestRun.weatherCheck.total}`
              : 'N/A'
          }
          note="Code, time, temp, humidity"
          variant={
            latestRun
              ? latestRun.weatherCheck.matchCount === latestRun.weatherCheck.total
                ? 'success'
                : 'warning'
              : 'neutral'
          }
        />
        <SummaryTile
          icon={Clock3}
          label="Last Update"
          value={latestRun ? formatRelativeTime(latestRun.createdAt) : 'Waiting'}
          note={latestRun ? formatDateTime(new Date(latestRun.createdAt)) : 'No runs yet'}
          variant={latestRun ? 'info' : 'neutral'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ANN Data View</CardTitle>
          <CardDescription>
            Switch datasets from one dropdown to avoid long scrolling and focus on one signal at a time.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">View</span>
            <select
              value={view}
              onChange={(event) => setView(event.target.value as AnnView)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            >
              {ANN_VIEW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Range</span>
            <select
              value={range}
              onChange={(event) => setRange(event.target.value as AnnRange)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            >
              {Object.entries(ANN_RANGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Overall Filter</span>
            <select
              value={filters.overallResult}
              onChange={(event) =>
                handleFilterChange(
                  'overallResult',
                  event.target.value as AnnDashboardFilters['overallResult'],
                )
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="all">All runs</option>
              <option value="CORRECT">Correct only</option>
              <option value="INCORRECT">Incorrect only</option>
            </select>
          </label>

          <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Sensor Filter</span>
            <select
              value={filters.sensorResult}
              onChange={(event) =>
                handleFilterChange(
                  'sensorResult',
                  event.target.value as AnnDashboardFilters['sensorResult'],
                )
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="all">All states</option>
              <option value="CORRECT">Correct only</option>
              <option value="INCORRECT">Incorrect only</option>
            </select>
          </label>

          {view === 'field' ? (
            <label className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Field</span>
              <select
                value={fieldName}
                onChange={(event) => setSelectedField(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
              >
                {fieldOptions.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
              Resolution: {resolution}
            </div>
          )}
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="pt-4 sm:pt-5">
            <p className="text-sm text-rose-700 dark:text-rose-200">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {view === 'accuracy' ? (
        <ChartCard
          title="Prediction Accuracy Time Series"
          subtitle="ANN historical accuracy derived from persisted run history buckets."
          data={accuracyData}
          series={[
            { key: 'accuracyPct', label: 'Accuracy', color: '#22c55e', type: 'line' },
            { key: 'overallCorrectPct', label: 'Overall Correct', color: '#38bdf8', type: 'area' },
          ]}
          formatValue={(value) => `${formatNumber(value, 1)}%`}
          onPointClick={(payload) => openRun(payload.latestRunId)}
        />
      ) : null}

      {view === 'weather' ? (
        <ChartCard
          title="Weather Check Time Series"
          subtitle="Pass rates for weather code, time, temperature, and humidity checks over history."
          data={weatherTrendData}
          series={[
            { key: 'weatherCode', label: 'Weather Code', color: '#38bdf8', type: 'line' },
            { key: 'time', label: 'Time', color: '#a3e635', type: 'line' },
            { key: 'temperature', label: 'Temperature', color: '#f59e0b', type: 'line' },
            { key: 'humidity', label: 'Humidity', color: '#f43f5e', type: 'line' },
          ]}
          formatValue={(value) => `${formatNumber(value, 1)}%`}
          onPointClick={(payload) => openRun(payload.latestRunId)}
        />
      ) : null}

      {view === 'field' ? (
        <ChartCard
          title={`Field History: ${fieldName}`}
          subtitle="Predicted vs actual values over ANN history buckets."
          data={fieldCompareData}
          series={[
            { key: 'predicted', label: 'Predicted', color: '#38bdf8', type: 'line' },
            { key: 'actual', label: 'Actual', color: '#22c55e', type: 'line' },
          ]}
          formatValue={(value) => formatFieldValue(fieldName, value)}
          onPointClick={(payload) => openRun(payload.latestRunId)}
        />
      ) : null}

      {view === 'history' ? (
        <AnnHistoryTable
          runs={runs}
          selectedRunId={selectedRunId}
          onSelectRun={openRun}
          page={currentHistoryPage}
          pageSize={currentHistoryPageSize}
          totalPages={historyTotalPages}
          totalRuns={historyTotalRuns}
          hasPrev={historyHasPrev}
          hasNext={historyHasNext}
          onPageChange={setHistoryPage}
          onPageSizeChange={setHistoryPageSize}
          loading={loading}
        />
      ) : null}

      {view === 'detail' ? (
        detailRun ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Run Detail</CardTitle>
                <CardDescription>Selected ANN prediction run summary and mismatch highlights.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="neutral">Run ID {detailRun.id}</Badge>
                  <Badge variant="neutral">Prediction ID {detailRun.predictionId ?? 'N/A'}</Badge>
                  <Badge variant={statusVariant(detailRun.overallResult)}>{detailRun.overallResult}</Badge>
                  <Badge variant={statusVariant(detailRun.sensorResult)}>{detailRun.sensorResult}</Badge>
                  <Badge variant="info">{formatDateTime(new Date(detailRun.createdAt))}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Weather</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {detailRun.weather.actual.weather}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Weather Checks</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {detailRun.weatherCheck.matchCount}/{detailRun.weatherCheck.total}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Accuracy</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {formatNumber(detailRun.accuracyPct, 1)}%
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Relay Memory</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {detailRun.relayMemory.applied ? 'Applied' : 'Not applied'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Mismatches</CardTitle>
                <CardDescription>Largest difference-to-tolerance ratios in this run.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topMismatches.map((field) => (
                  <div
                    key={field.name}
                    className="rounded-2xl border border-slate-200 bg-slate-100/80 p-4 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{field.name}</p>
                      <Badge variant={statusVariant(field.status)}>{field.status}</Badge>
                    </div>
                    <div className="mt-2 grid gap-2 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2">
                      <p>Predicted: {formatFieldValue(field.name, field.predicted)}</p>
                      <p>Actual: {formatFieldValue(field.name, field.actual)}</p>
                      <p>Difference: {formatFieldValue(field.name, field.difference)}</p>
                      <p>Tolerance: {formatFieldValue(field.name, field.tolerance)}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-4 sm:pt-5">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Select a run from a chart point or history row to open detail view.
              </p>
            </CardContent>
          </Card>
        )
      ) : null}

      {(loading || detailLoading) && !error ? (
        <Card>
          <CardContent className="pt-4 sm:pt-5">
            <p className="text-sm text-slate-600 dark:text-slate-300">Refreshing ANN data...</p>
          </CardContent>
        </Card>
      ) : null}

      {isPayloadModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">ANN Record Payload</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {detailRun ? `Run ID ${detailRun.id} • ${formatDateTime(new Date(detailRun.createdAt))}` : 'Loading selected record...'}
                </p>
              </div>
              <button
                type="button"
                onClick={closePayloadModal}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto p-4">
              {detailLoading ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">Loading payload...</p>
              ) : null}

              {detailRun ? (
                <div className="space-y-4 font-mono">
                  <div className="rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-center text-xs font-semibold tracking-[0.08em] text-slate-800 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 sm:text-sm">
                    ########## ALL {detailRun.samples.history.length} SAMPLES | SET {detailRun.predictionId ?? detailRun.id} ##########
                  </div>

                  {detailRun.samples.history.map((sample, index) => (
                    <div key={sample.sampleNo ?? index} className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                      <div className="border-b border-slate-200 bg-slate-100/80 px-4 py-2 text-center text-xs font-semibold tracking-[0.08em] text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 sm:text-sm">
                        -------------- SAMPLE {index + 1} --------------
                      </div>
                      <SampleReportTable sample={sample} />
                    </div>
                  ))}

                  <div className="rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-2 text-center text-xs font-semibold tracking-[0.08em] text-slate-800 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-100 sm:text-sm">
                    ######################################################
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                    <div className="border-b border-slate-200 bg-slate-100/80 px-4 py-2 text-center text-xs font-semibold tracking-[0.08em] text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 sm:text-sm">
                      ============= PREDICTED WEATHER / TIME / TEMP / HUMIDITY =============
                    </div>
                    <WeatherReportTable
                      timestamp={detailRun.weather.predicted.timestamp}
                      hour={detailRun.weather.predicted.hour}
                      weatherCode={detailRun.weather.predicted.weatherCode}
                      weather={detailRun.weather.predicted.weather}
                      temperatureC={detailRun.weather.predicted.temperatureC}
                      humidity={detailRun.weather.predicted.humidity}
                    />
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                    <div className="border-b border-slate-200 bg-slate-100/80 px-4 py-2 text-center text-xs font-semibold tracking-[0.08em] text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 sm:text-sm">
                      ========== PREDICTED NEXT SAMPLE ==========
                    </div>
                    <SampleReportTable sample={detailRun.samples.predictedNext} />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-3 text-center text-xs text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 sm:text-sm">
                    <p>==============================================</p>
                    <p className="font-semibold">NEW SET SAVED AS SET ID {detailRun.predictionId ?? detailRun.id}</p>
                    <p>{detailRun.samples.history.length} samples and prediction saved successfully.</p>
                    <p>==============================================</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 sm:text-sm">
                    Waiting for next accepted fresh sample to validate prediction...
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                    <div className="border-b border-slate-200 bg-slate-100/80 px-4 py-2 text-center text-xs font-semibold tracking-[0.08em] text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 sm:text-sm">
                      ============= ACTUAL WEATHER / TIME / TEMP / HUMIDITY =============
                    </div>
                    <WeatherReportTable
                      timestamp={detailRun.weather.actual.timestamp}
                      hour={detailRun.weather.actual.hour}
                      weatherCode={detailRun.weather.actual.weatherCode}
                      weather={detailRun.weather.actual.weather}
                      temperatureC={detailRun.weather.actual.temperatureC}
                      humidity={detailRun.weather.actual.humidity}
                    />
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                    <div className="border-b border-slate-200 bg-slate-100/80 px-4 py-2 text-center text-xs font-semibold tracking-[0.08em] text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 sm:text-sm">
                      ============ ACTUAL NEXT SAMPLE FOR CHECK ============
                    </div>
                    <SampleReportTable sample={detailRun.samples.actualNext} />
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                    <div className="border-b border-slate-200 bg-slate-100/80 px-4 py-2 text-center text-xs font-semibold tracking-[0.08em] text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 sm:text-sm">
                      ========== PREDICTED WEATHER CHECK ==========
                    </div>
                    <table className="w-full text-left text-xs sm:text-sm">
                      <tbody>
                        <tr className="border-b border-slate-200/80 dark:border-white/10">
                          <th className="w-[280px] px-4 py-1.5 font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100">WEATHER CODE RESULT</th>
                          <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">: {formatAnnResultLabel(detailRun.weather.check.weatherCodeResult)}</td>
                        </tr>
                        <tr className="border-b border-slate-200/80 dark:border-white/10">
                          <th className="px-4 py-1.5 font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100">TIME RESULT</th>
                          <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">: {formatAnnResultLabel(detailRun.weather.check.timeResult)}</td>
                        </tr>
                        <tr className="border-b border-slate-200/80 dark:border-white/10">
                          <th className="px-4 py-1.5 font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100">TEMP RESULT</th>
                          <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">: {formatAnnResultLabel(detailRun.weather.check.tempResult)}</td>
                        </tr>
                        <tr>
                          <th className="px-4 py-1.5 font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100">HUMIDITY RESULT</th>
                          <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">: {formatAnnResultLabel(detailRun.weather.check.humidityResult)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                    <div className="border-b border-slate-200 bg-slate-100/80 px-4 py-2 text-center text-xs font-semibold tracking-[0.08em] text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 sm:text-sm">
                      ========== PREDICTION CHECK ==========
                    </div>
                    <table className="w-full text-left text-xs sm:text-sm">
                      <tbody>
                        <tr className="border-b border-slate-200/80 dark:border-white/10">
                          <th className="w-[220px] px-4 py-1.5 font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100">SENSOR RESULT</th>
                          <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">: {formatAnnResultLabel(detailRun.predictionCheck.sensorResult)}</td>
                        </tr>
                        <tr>
                          <th className="px-4 py-1.5 font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100">OVERALL RESULT</th>
                          <td className="px-4 py-1.5 text-slate-700 dark:text-slate-300">: {formatAnnResultLabel(detailRun.predictionCheck.overallResult)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                    <div className="border-b border-slate-200 bg-slate-100/80 px-4 py-2 text-center text-xs font-semibold tracking-[0.08em] text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200 sm:text-sm">
                      ========== FIELD-BY-FIELD CHECK ==========
                    </div>
                    <div className="overflow-auto">
                      <table className="w-full min-w-[920px] text-left text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
                            <th className="px-4 py-2 font-semibold tracking-[0.08em]">FIELD</th>
                            <th className="px-4 py-2 font-semibold tracking-[0.08em]">PRED</th>
                            <th className="px-4 py-2 font-semibold tracking-[0.08em]">ACTUAL</th>
                            <th className="px-4 py-2 font-semibold tracking-[0.08em]">DIFF</th>
                            <th className="px-4 py-2 font-semibold tracking-[0.08em]">TOL</th>
                            <th className="px-4 py-2 font-semibold tracking-[0.08em]">RESULT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailRun.predictionCheck.fields.map((field) => {
                            const isRelay = field.name.toUpperCase().startsWith('RELAY')
                            const displayPred = isRelay
                              ? formatRelayFieldValue(field.predicted)
                              : formatNumber(field.predicted, 2)
                            const displayActual = isRelay
                              ? formatRelayFieldValue(field.actual)
                              : formatNumber(field.actual, 2)

                            return (
                              <tr key={field.name} className="border-b border-slate-200/80 dark:border-white/10">
                                <td className="px-4 py-2 font-semibold tracking-[0.06em] text-slate-800 dark:text-slate-100">{field.name}</td>
                                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{displayPred}</td>
                                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{displayActual}</td>
                                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{formatNumber(field.difference, 2)}</td>
                                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{formatNumber(field.tolerance, 2)}</td>
                                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{field.status.toUpperCase() === 'OK' ? 'OK' : 'NO'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 sm:text-sm">
                    Prediction check saved as Prediction ID {detailRun.predictionId ?? 'N/A'}.
                  </div>
                </div>
              ) : null}

              {!detailLoading && !detailRun ? (
                <p className="text-sm text-slate-600 dark:text-slate-300">No payload available for this record.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
