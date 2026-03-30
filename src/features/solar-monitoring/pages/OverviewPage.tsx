import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { ChartCard } from '@/features/solar-monitoring/components/ChartCard'
import { HistoricalLogTable } from '@/features/solar-monitoring/components/HistoricalLogTable'
import { PageHeader } from '@/features/solar-monitoring/components/PageHeader'
import { fetchJsonCached } from '@/shared/lib/apiCache'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import type { HistoryRow, PanelKey } from '@/shared/types/solar'

type BackendReading = {
  createdAt?: string
  timestamp?: string
  panel_type?: PanelKey
  voltage: number
  current: number
  irradiance?: number
  temperature?: number
  humidity?: number
  azimuth_angle?: number
  elevation_angle?: number
  axisX?: number
  axisY?: number
}

type NormalizedReading = {
  timestamp: Date
  panelType: PanelKey
  voltage: number
  current: number
  power: number
  irradiance: number
  temperature: number
  humidity: number
  azimuthAngle?: number
  elevationAngle?: number
}

type TrendMetric = 'energy' | 'efficiency' | 'power'

type PanelMetrics = {
  panel: PanelKey
  averagePower: number
  maximumPower: number
  totalEnergyWh: number
  averageEnergyWh: number
  maximumEnergyWh: number
  efficiencyPct: number
  averageIrradiance: number
  averageTemperature: number
  trackerMovementDeg: number
}

const PANEL_LABEL: Record<PanelKey, string> = {
  fixed: 'Fixed',
  conventional: 'Conventional',
  ann: 'ANN',
}

const PANEL_AREA_M2 = 1.6

type OverviewRange = 'hour' | 'day' | 'week' | 'month' | 'all'

const RANGE_CONFIG: Record<OverviewRange, { label: string; sinceMs?: number; limit: number }> = {
  all: { label: 'All time', limit: 100_000 },
  hour: { label: 'Last hour', sinceMs: 60 * 60 * 1000, limit: 120 },
  day: { label: 'Last 24 hours', sinceMs: 24 * 60 * 60 * 1000, limit: 2_000 },
  week: { label: 'Last 7 days', sinceMs: 7 * 24 * 60 * 60 * 1000, limit: 10_000 },
  month: { label: 'Last 30 days', sinceMs: 30 * 24 * 60 * 60 * 1000, limit: 10_000 },
}

const OVERVIEW_HISTORY_CACHE_MS = 30 * 1000
const OVERVIEW_REFRESH_MS = 30 * 1000

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function estimateIrradiance(power: number, panelType: PanelKey) {
  const assumedEfficiency = panelType === 'ann' ? 0.22 : panelType === 'conventional' ? 0.2 : 0.18
  const estimated = power / (PANEL_AREA_M2 * assumedEfficiency)

  return Math.max(0, Math.min(1100, estimated))
}

function estimateTemperature(timestamp: Date, irradiance: number) {
  const hour = timestamp.getHours() + timestamp.getMinutes() / 60
  const diurnalOffset = Math.sin(((hour - 6) / 12) * Math.PI)
  const ambientBase = 25 + Math.max(0, diurnalOffset) * 7
  const irradianceBoost = irradiance / 140

  return Math.min(52, Math.max(20, ambientBase + irradianceBoost))
}

function computeMetrics(panel: PanelKey, rows: NormalizedReading[]): PanelMetrics {
  if (!rows.length) {
    return {
      panel,
      averagePower: 0,
      maximumPower: 0,
      totalEnergyWh: 0,
      averageEnergyWh: 0,
      maximumEnergyWh: 0,
      efficiencyPct: 0,
      averageIrradiance: 0,
      averageTemperature: 0,
      trackerMovementDeg: 0,
    }
  }

  const energyWhSamples: number[] = []
  const powerValues: number[] = []
  const irradianceValues: number[] = []
  const temperatureValues: number[] = []
  let trackerMovementDeg = 0
  let solarInputWh = 0

  for (let index = 0; index < rows.length; index += 1) {
    const current = rows[index]
    const previous = index > 0 ? rows[index - 1] : null

    const deltaHours = previous
      ? Math.max((current.timestamp.getTime() - previous.timestamp.getTime()) / 3_600_000, 0)
      : 1 / 60

    const energyWh = current.power * deltaHours
    energyWhSamples.push(energyWh)
    powerValues.push(current.power)
    irradianceValues.push(current.irradiance)
    temperatureValues.push(current.temperature)
    solarInputWh += current.irradiance * PANEL_AREA_M2 * deltaHours

    if (
      previous &&
      current.azimuthAngle !== undefined &&
      current.elevationAngle !== undefined &&
      previous.azimuthAngle !== undefined &&
      previous.elevationAngle !== undefined
    ) {
      const deltaAzimuth = current.azimuthAngle - previous.azimuthAngle
      const deltaElevation = current.elevationAngle - previous.elevationAngle
      trackerMovementDeg += Math.sqrt(deltaAzimuth ** 2 + deltaElevation ** 2)
    }
  }

  const totalEnergyWh = energyWhSamples.reduce((sum, value) => sum + value, 0)

  return {
    panel,
    averagePower: average(powerValues),
    maximumPower: Math.max(...powerValues),
    totalEnergyWh,
    averageEnergyWh: average(energyWhSamples),
    maximumEnergyWh: Math.max(...energyWhSamples),
    efficiencyPct: solarInputWh > 0 ? (totalEnergyWh / solarInputWh) * 100 : 0,
    averageIrradiance: average(irradianceValues),
    averageTemperature: average(temperatureValues),
    trackerMovementDeg,
  }
}

function toHistoryRows(rows: NormalizedReading[]): HistoryRow[] {
  return [...rows]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .map((row, index, sorted) => {
      const previous = index + 1 < sorted.length ? sorted[index + 1] : null
      const deltaHours = previous
        ? Math.max((row.timestamp.getTime() - previous.timestamp.getTime()) / 3_600_000, 0)
        : 1 / 60

      return {
        timestamp: row.timestamp.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
        panel: row.panelType,
        voltage: row.voltage,
        current: row.current,
        power: row.power,
        energy: row.power * deltaHours,
        azimuth: row.azimuthAngle,
        elevation: row.elevationAngle,
        forecast: undefined,
      }
    })
}

function formatTrendLabel(timestamp: Date, range: OverviewRange) {
  if (range === 'all' || range === 'month' || range === 'week') {
    return timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return timestamp.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function buildPanelTrend(rows: NormalizedReading[]) {
  const ordered = [...rows].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  const result = new Map<number, { energyWh: number; efficiencyPct: number; averagePower: number }>()

  let cumulativeEnergyWh = 0
  let cumulativeSolarInputWh = 0
  let cumulativePower = 0

  for (let index = 0; index < ordered.length; index += 1) {
    const current = ordered[index]
    const previous = index > 0 ? ordered[index - 1] : null

    const deltaHours = previous
      ? Math.max((current.timestamp.getTime() - previous.timestamp.getTime()) / 3_600_000, 0)
      : 1 / 60

    const energyWh = current.power * deltaHours
    cumulativeEnergyWh += energyWh
    cumulativeSolarInputWh += current.irradiance * PANEL_AREA_M2 * deltaHours
    cumulativePower += current.power

    result.set(current.timestamp.getTime(), {
      energyWh: cumulativeEnergyWh,
      efficiencyPct: cumulativeSolarInputWh > 0 ? (cumulativeEnergyWh / cumulativeSolarInputWh) * 100 : 0,
      averagePower: cumulativePower / (index + 1),
    })
  }

  return result
}

export function OverviewPage() {
  const [range, setRange] = useState<OverviewRange>('all')
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('energy')
  const [activeLogPanel, setActiveLogPanel] = useState<PanelKey>('fixed')
  const [expandedComparisonPanel, setExpandedComparisonPanel] = useState<PanelKey | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readingsByPanel, setReadingsByPanel] = useState<Record<PanelKey, NormalizedReading[]>>({
    fixed: [],
    conventional: [],
    ann: [],
  })

  useEffect(() => {
    let active = true

    const fetchPanelReadings = async (panel: PanelKey, limit: number, since?: Date) => {
      const query = new URLSearchParams({ limit: String(limit) })
      if (since) {
        query.set('since', since.toISOString())
      }
      const response = await fetchJsonCached<BackendReading[]>(
        `/api/${panel}/history?${query.toString()}`,
        { ttlMs: OVERVIEW_HISTORY_CACHE_MS },
      )

      if (!response.ok) {
        if (response.status === 404) {
          return [] as NormalizedReading[]
        }

        throw new Error(`Failed to load ${panel} readings (${response.status})`)
      }

      const payload = response.body

      return payload
        .map((item) => {
          const timestampValue = item.timestamp ?? item.createdAt
          const timestamp = timestampValue ? new Date(timestampValue) : new Date()
          const voltage = Number(item.voltage ?? 0)
          const current = Number(item.current ?? 0)
          const power = voltage * current
          const rawIrradiance = Number(item.irradiance ?? 0)
          const irradiance = rawIrradiance > 0 ? rawIrradiance : estimateIrradiance(power, panel)
          const rawTemperature = Number(item.temperature ?? 0)

          return {
            timestamp,
            panelType: panel,
            voltage,
            current,
            power,
            irradiance,
            temperature: rawTemperature > 0 ? rawTemperature : estimateTemperature(timestamp, irradiance),
            humidity: Number(item.humidity ?? 0),
            azimuthAngle: item.azimuth_angle ?? item.axisY,
            elevationAngle: item.elevation_angle ?? item.axisX,
          } satisfies NormalizedReading
        })
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    }

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const config = RANGE_CONFIG[range]
        const since = config.sinceMs ? new Date(Date.now() - config.sinceMs) : undefined
        const [fixed, conventional, ann] = await Promise.all([
          fetchPanelReadings('fixed', config.limit, since),
          fetchPanelReadings('conventional', config.limit, since),
          fetchPanelReadings('ann', config.limit, since),
        ])

        if (!active) {
          return
        }

        setReadingsByPanel({ fixed, conventional, ann })
      } catch (loadError) {
        if (!active) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Failed to load overview data')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load()
      }
    }, OVERVIEW_REFRESH_MS)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [range])

  const metrics = useMemo(() => {
    const fixed = computeMetrics('fixed', readingsByPanel.fixed)
    const conventional = computeMetrics('conventional', readingsByPanel.conventional)
    const ann = computeMetrics('ann', readingsByPanel.ann)
    const list = [fixed, conventional, ann]

    const maxEnergy = Math.max(...list.map((item) => item.totalEnergyWh), 0)
    const withRelativeEfficiency = list.map((item) => ({
      ...item,
      efficiencyPct:
        item.efficiencyPct > 0
          ? item.efficiencyPct
          : maxEnergy > 0
            ? (item.totalEnergyWh / maxEnergy) * 100
            : 0,
    }))

    return {
      fixed: withRelativeEfficiency[0],
      conventional: withRelativeEfficiency[1],
      ann: withRelativeEfficiency[2],
      list: withRelativeEfficiency,
    }
  }, [readingsByPanel])

  const topEnergy = useMemo(() => {
    return metrics.list.reduce(
      (best, item) => (item.totalEnergyWh > best.totalEnergyWh ? item : best),
      metrics.list[0],
    )
  }, [metrics])

  const topEfficiency = useMemo(() => {
    return metrics.list.reduce(
      (best, item) => (item.efficiencyPct > best.efficiencyPct ? item : best),
      metrics.list[0],
    )
  }, [metrics])

  const conventionalGain =
    metrics.fixed.totalEnergyWh > 0
      ? ((metrics.conventional.totalEnergyWh - metrics.fixed.totalEnergyWh) /
          metrics.fixed.totalEnergyWh) *
        100
      : 0

  const annGain =
    metrics.fixed.totalEnergyWh > 0
      ? ((metrics.ann.totalEnergyWh - metrics.fixed.totalEnergyWh) / metrics.fixed.totalEnergyWh) *
        100
      : 0

  const latestTimestamp = useMemo(() => {
    const all = [...readingsByPanel.fixed, ...readingsByPanel.conventional, ...readingsByPanel.ann]

    if (!all.length) {
      return new Date()
    }

    return all.reduce(
      (latest, item) => (item.timestamp.getTime() > latest.getTime() ? item.timestamp : latest),
      all[0].timestamp,
    )
  }, [readingsByPanel])

  const comparisonChartData = useMemo(() => {
    const fixedTrend = buildPanelTrend(readingsByPanel.fixed)
    const conventionalTrend = buildPanelTrend(readingsByPanel.conventional)
    const annTrend = buildPanelTrend(readingsByPanel.ann)

    const allTimestamps = Array.from(
      new Set<number>([
        ...fixedTrend.keys(),
        ...conventionalTrend.keys(),
        ...annTrend.keys(),
      ]),
    ).sort((a, b) => a - b)

    return allTimestamps.map((timestamp) => {
      const at = new Date(timestamp)
      const fixedPoint = fixedTrend.get(timestamp)
      const conventionalPoint = conventionalTrend.get(timestamp)
      const annPoint = annTrend.get(timestamp)

      return {
        label: formatTrendLabel(at, range),
        fixedEnergyWh: fixedPoint?.energyWh,
        conventionalEnergyWh: conventionalPoint?.energyWh,
        annEnergyWh: annPoint?.energyWh,
        fixedEfficiencyPct: fixedPoint?.efficiencyPct,
        conventionalEfficiencyPct: conventionalPoint?.efficiencyPct,
        annEfficiencyPct: annPoint?.efficiencyPct,
        fixedAveragePower: fixedPoint?.averagePower,
        conventionalAveragePower: conventionalPoint?.averagePower,
        annAveragePower: annPoint?.averagePower,
      }
    })
  }, [readingsByPanel, range])

  const trendChartConfig = useMemo(() => {
    if (trendMetric === 'efficiency') {
      return {
        title: 'Efficiency Trend by Panel',
        subtitle: `Efficiency trajectory over ${RANGE_CONFIG[range].label.toLowerCase()}.`,
        formatValue: (value: number) => `${value.toFixed(2)}%`,
        series: [
          { key: 'fixedEfficiencyPct', label: 'Fixed Efficiency (%)', color: '#38bdf8', type: 'line' as const },
          { key: 'conventionalEfficiencyPct', label: 'Conventional Efficiency (%)', color: '#f59e0b', type: 'line' as const },
          { key: 'annEfficiencyPct', label: 'ANN Efficiency (%)', color: '#84cc16', type: 'line' as const },
        ],
      }
    }

    if (trendMetric === 'power') {
      return {
        title: 'Average Power Trend by Panel',
        subtitle: `Running average power over ${RANGE_CONFIG[range].label.toLowerCase()}.`,
        formatValue: (value: number) => `${value.toFixed(2)} W`,
        series: [
          { key: 'fixedAveragePower', label: 'Fixed Avg Power (W)', color: '#38bdf8', type: 'line' as const },
          { key: 'conventionalAveragePower', label: 'Conventional Avg Power (W)', color: '#f59e0b', type: 'line' as const },
          { key: 'annAveragePower', label: 'ANN Avg Power (W)', color: '#84cc16', type: 'line' as const },
        ],
      }
    }

    return {
      title: 'Total Energy Trend by Panel',
      subtitle: `Cumulative generated energy over ${RANGE_CONFIG[range].label.toLowerCase()}.`,
      formatValue: (value: number) => `${value.toFixed(2)} Wh`,
      series: [
        { key: 'fixedEnergyWh', label: 'Fixed Total Energy (Wh)', color: '#38bdf8', type: 'line' as const },
        { key: 'conventionalEnergyWh', label: 'Conventional Total Energy (Wh)', color: '#f59e0b', type: 'line' as const },
        { key: 'annEnergyWh', label: 'ANN Total Energy (Wh)', color: '#84cc16', type: 'line' as const },
      ],
    }
  }, [trendMetric, range])

  const historyRows = useMemo(() => {
    return toHistoryRows(readingsByPanel[activeLogPanel])
  }, [activeLogPanel, readingsByPanel])

  const totalGeneratedKwh = useMemo(() => {
    return metrics.list.reduce((sum, item) => sum + item.totalEnergyWh, 0) / 1000
  }, [metrics])

  async function handleExportExcel() {
    const xlsx = await import('xlsx')
    const fixedLogs = toHistoryRows(readingsByPanel.fixed)
    const conventionalLogs = toHistoryRows(readingsByPanel.conventional)
    const annLogs = toHistoryRows(readingsByPanel.ann)

    const summaryRows = [
      { Metric: 'Range', Value: RANGE_CONFIG[range].label },
      { Metric: 'Total Generated (kWh)', Value: totalGeneratedKwh.toFixed(3) },
      ...metrics.list.map((item) => ({
        Metric: `${PANEL_LABEL[item.panel]} Generated (kWh)`,
        Value: (item.totalEnergyWh / 1000).toFixed(3),
      })),
    ]

    const comparisonRows = metrics.list.map((item) => ({
      Panel: PANEL_LABEL[item.panel],
      'Avg Power (W)': item.averagePower.toFixed(2),
      'Max Power (W)': item.maximumPower.toFixed(2),
      'Avg Energy (Wh)': item.averageEnergyWh.toFixed(4),
      'Max Energy (Wh)': item.maximumEnergyWh.toFixed(4),
      'Total Energy (Wh)': item.totalEnergyWh.toFixed(2),
      'Efficiency (%)': item.efficiencyPct.toFixed(2),
      'Avg Irradiance (W/m2)': item.averageIrradiance.toFixed(2),
      'Avg Temp (C)': item.averageTemperature.toFixed(2),
      'Tracker Movement (deg)': item.panel === 'fixed' ? 'N/A' : item.trackerMovementDeg.toFixed(2),
    }))

    const workbook = xlsx.utils.book_new()
    const summarySheet = xlsx.utils.json_to_sheet(summaryRows)
    const comparisonSheet = xlsx.utils.json_to_sheet(comparisonRows)
    const fixedLogSheet = xlsx.utils.json_to_sheet(fixedLogs)
    const conventionalLogSheet = xlsx.utils.json_to_sheet(conventionalLogs)
    const annLogSheet = xlsx.utils.json_to_sheet(annLogs)

    xlsx.utils.book_append_sheet(workbook, summarySheet, 'Summary')
    xlsx.utils.book_append_sheet(workbook, comparisonSheet, 'Comparison')
    xlsx.utils.book_append_sheet(workbook, fixedLogSheet, 'Fixed Logs')
    xlsx.utils.book_append_sheet(workbook, conventionalLogSheet, 'Conventional Logs')
    xlsx.utils.book_append_sheet(workbook, annLogSheet, 'ANN Logs')

    xlsx.writeFile(workbook, `overview-${range}-report.xlsx`)
  }

  async function handleExportPdf() {
    const { default: jsPDF } = await import('jspdf')
    const autoTable = (await import('jspdf-autotable/es')).default
    const fixedLogs = toHistoryRows(readingsByPanel.fixed)
    const conventionalLogs = toHistoryRows(readingsByPanel.conventional)
    const annLogs = toHistoryRows(readingsByPanel.ann)

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const generatedAt = new Date().toLocaleString('en-US')

    doc.setFontSize(16)
    doc.text('HelioScope Overview Report', 40, 40)
    doc.setFontSize(10)
    doc.text(`Range: ${RANGE_CONFIG[range].label}`, 40, 60)
    doc.text(`Generated: ${generatedAt}`, 40, 74)

    autoTable(doc, {
      startY: 92,
      head: [['Metric', 'Value']],
      body: [
        ['Total Generated (kWh)', totalGeneratedKwh.toFixed(3)],
        ...metrics.list.map((item) => [
          `${PANEL_LABEL[item.panel]} Generated (kWh)`,
          (item.totalEnergyWh / 1000).toFixed(3),
        ]),
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [15, 23, 42] },
    })

    const lastTableY = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY

    autoTable(doc, {
      startY: lastTableY ? lastTableY + 18 : 180,
      head: [[
        'Panel',
        'Avg Power (W)',
        'Max Power (W)',
        'Avg Energy (Wh)',
        'Max Energy (Wh)',
        'Total Energy (Wh)',
        'Efficiency (%)',
      ]],
      body: metrics.list.map((item) => [
        PANEL_LABEL[item.panel],
        item.averagePower.toFixed(2),
        item.maximumPower.toFixed(2),
        item.averageEnergyWh.toFixed(4),
        item.maximumEnergyWh.toFixed(4),
        item.totalEnergyWh.toFixed(2),
        item.efficiencyPct.toFixed(2),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [8, 145, 178] },
    })

    const logSections: Array<{ title: string; rows: HistoryRow[] }> = [
      { title: 'Fixed Historical Logs', rows: fixedLogs },
      { title: 'Conventional Historical Logs', rows: conventionalLogs },
      { title: 'ANN Historical Logs', rows: annLogs },
    ]

    logSections.forEach((section) => {
      doc.addPage()
      doc.setFontSize(14)
      doc.text(section.title, 40, 40)

      autoTable(doc, {
        startY: 56,
        head: [[
          'Timestamp',
          'Panel',
          'Voltage',
          'Current',
          'Power',
          'Energy',
          'Azimuth',
          'Elevation',
        ]],
        body: section.rows.map((row) => [
          row.timestamp,
          PANEL_LABEL[row.panel],
          row.voltage.toFixed(2),
          row.current.toFixed(2),
          row.power.toFixed(2),
          row.energy.toFixed(4),
          row.azimuth !== undefined ? row.azimuth.toFixed(2) : 'N/A',
          row.elevation !== undefined ? row.elevation.toFixed(2) : 'N/A',
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [15, 23, 42] },
      })
    })

    doc.save(`overview-${range}-report.pdf`)
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow="Performance comparison"
        title="Panel Performance Overview"
        description={`Compare output and efficiency metrics for ${RANGE_CONFIG[range].label.toLowerCase()}.`}
        connection={`${readingsByPanel.fixed.length + readingsByPanel.conventional.length + readingsByPanel.ann.length} readings aggregated`}
        status={error ? 'warning' : 'optimal'}
        lastUpdated={latestTimestamp}
      />

      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
          <CardDescription>
            Select a period to view total generated energy and performance metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={range} onValueChange={(nextValue) => setRange(nextValue as OverviewRange)}>
              <TabsList className="w-full gap-1 sm:w-auto sm:gap-0">
                {Object.keys(RANGE_CONFIG).map((value) => (
                  <TabsTrigger key={value} value={value} className="flex-1 sm:flex-none">
                    {value}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  void handleExportPdf()
                }}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto sm:text-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleExportExcel()
                }}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto sm:text-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                Export Excel
              </button>
            </div>
          </div>

          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            <div className="rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Total Generated</p>
              <p className="mt-2 text-base font-medium text-slate-900 dark:text-white">{totalGeneratedKwh.toFixed(3)} kWh</p>
            </div>

            {metrics.list.map((item) => (
              <div
                key={item.panel}
                className="rounded-2xl border border-slate-200 bg-slate-100/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{PANEL_LABEL[item.panel]} Generated</p>
                <p className="mt-2 text-base font-medium text-slate-900 dark:text-white">{(item.totalEnergyWh / 1000).toFixed(3)} kWh</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <ChartCard
          title={trendChartConfig.title}
          subtitle={trendChartConfig.subtitle}
          data={comparisonChartData}
          series={trendChartConfig.series}
          formatValue={trendChartConfig.formatValue}
          showVerticalGrid
          headerAction={
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="whitespace-nowrap">Metric</span>
              <select
                value={trendMetric}
                onChange={(event) => setTrendMetric(event.target.value as TrendMetric)}
                className="h-10 min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="energy">Total Energy</option>
                <option value="efficiency">Efficiency</option>
                <option value="power">Avg Power</option>
              </select>
            </label>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Comparison Metrics</CardTitle>
            <CardDescription>
              Average/maximum power, average/maximum/total energy, efficiency, irradiance, temperature, and tracker movement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 md:hidden">
              {metrics.list.map((item) => {
                const isExpanded = expandedComparisonPanel === item.panel

                return (
                  <div
                    key={item.panel}
                    className="rounded-2xl border border-slate-200 bg-slate-100/80 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedComparisonPanel((current) =>
                          current === item.panel ? null : item.panel,
                        )
                      }
                      className="w-full px-4 py-3 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {PANEL_LABEL[item.panel]}
                        </p>
                        <span className="text-xs uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
                          {isExpanded ? 'Hide' : 'Details'}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <p>Avg Power: {item.averagePower.toFixed(2)} W</p>
                        <p>Total: {item.totalEnergyWh.toFixed(2)} Wh</p>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="grid gap-1 border-t border-slate-200/90 px-4 py-3 text-xs text-slate-700 dark:border-white/8 dark:text-slate-300">
                        <p>Max Power: {item.maximumPower.toFixed(2)} W</p>
                        <p>Avg Energy: {item.averageEnergyWh.toFixed(4)} Wh</p>
                        <p>Max Energy: {item.maximumEnergyWh.toFixed(4)} Wh</p>
                        <p>Efficiency: {item.efficiencyPct.toFixed(2)}%</p>
                        <p>Avg Irradiance: {item.averageIrradiance.toFixed(2)} W/m2</p>
                        <p>Avg Temp: {item.averageTemperature.toFixed(2)} C</p>
                        <p>
                          Tracker Movement:{' '}
                          {item.panel === 'fixed' ? 'N/A' : item.trackerMovementDeg.toFixed(2)} deg
                        </p>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    <th className="pb-2">Panel</th>
                    <th className="pb-2">Avg Power (W)</th>
                    <th className="pb-2">Max Power (W)</th>
                    <th className="pb-2">Avg Energy (Wh)</th>
                    <th className="pb-2">Max Energy (Wh)</th>
                    <th className="pb-2">Total Energy (Wh)</th>
                    <th className="pb-2">Efficiency (%)</th>
                    <th className="pb-2">Avg Irradiance (W/m2)</th>
                    <th className="pb-2">Avg Temp (C)</th>
                    <th className="pb-2">Tracker Movement (deg)</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.list.map((item) => (
                    <tr
                      key={item.panel}
                      className="rounded-2xl bg-slate-100/80 text-slate-700 dark:bg-white/[0.03] dark:text-slate-300"
                    >
                      <td className="rounded-l-2xl border-y border-l border-slate-200/90 px-4 py-3 dark:border-white/8">
                        {PANEL_LABEL[item.panel]}
                      </td>
                      <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">{item.averagePower.toFixed(2)}</td>
                      <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">{item.maximumPower.toFixed(2)}</td>
                      <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">{item.averageEnergyWh.toFixed(4)}</td>
                      <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">{item.maximumEnergyWh.toFixed(4)}</td>
                      <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">{item.totalEnergyWh.toFixed(2)}</td>
                      <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">{item.efficiencyPct.toFixed(2)}</td>
                      <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">{item.averageIrradiance.toFixed(2)}</td>
                      <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">{item.averageTemperature.toFixed(2)}</td>
                      <td className="rounded-r-2xl border-y border-r border-slate-200/90 px-4 py-3 dark:border-white/8">
                        {item.panel === 'fixed' ? 'N/A' : item.trackerMovementDeg.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="h-full">
          <CardHeader className="min-h-[112px] sm:min-h-[130px]">
            <CardTitle>Which Panel Produces Most Energy?</CardTitle>
            <CardDescription>Total energy winner for the selected range.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xl font-semibold text-slate-900 dark:text-white">
              {PANEL_LABEL[topEnergy.panel]}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {topEnergy.totalEnergyWh.toFixed(2)} Wh total
            </p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="min-h-[112px] sm:min-h-[130px]">
            <CardTitle>Which Panel Is Most Efficient?</CardTitle>
            <CardDescription>Efficiency computed from energy and irradiance input.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xl font-semibold text-slate-900 dark:text-white">
              {PANEL_LABEL[topEfficiency.panel]}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {topEfficiency.efficiencyPct.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="min-h-[112px] sm:min-h-[130px]">
            <CardTitle>Tracking Improvement vs Fixed</CardTitle>
            <CardDescription>Gain (%) = ((Energy_tracker - Energy_fixed) / Energy_fixed) * 100</CardDescription>
          </CardHeader>
          <CardContent className="pt-0 space-y-1 text-sm">
            <p className="text-slate-700 dark:text-slate-300">
              Conventional: <span className="font-semibold">{conventionalGain.toFixed(2)}%</span>
            </p>
            <p className="text-slate-700 dark:text-slate-300">
              ANN: <span className="font-semibold">{annGain.toFixed(2)}%</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Historical Logs</CardTitle>
            <CardDescription>Select one panel and view its historical readings.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full max-w-[280px]">
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-slate-500">
                Panel
              </label>
              <select
                value={activeLogPanel}
                onChange={(event) => setActiveLogPanel(event.target.value as PanelKey)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="fixed">Fixed</option>
                <option value="conventional">Conventional</option>
                <option value="ann">ANN</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <HistoricalLogTable
          rows={historyRows}
          title={`${PANEL_LABEL[activeLogPanel]} Historical Log`}
          description={loading ? 'Loading logs...' : error ? error : 'Telemetry table for selected panel.'}
        />
      </section>
    </div>
  )
}
