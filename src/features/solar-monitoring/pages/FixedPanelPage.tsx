import { useMemo, useState } from 'react'
import { BatteryCharging, Download, GaugeCircle, LineChart, SunMedium, Waves } from 'lucide-react'
import { ChartCard } from '@/features/solar-monitoring/components/ChartCard'
import { HistoricalLogTable } from '@/features/solar-monitoring/components/HistoricalLogTable'
import { MetricCard } from '@/features/solar-monitoring/components/MetricCard'
import { PageHeader } from '@/features/solar-monitoring/components/PageHeader'
import { TimelineCard } from '@/features/solar-monitoring/components/TimelineCard'
import { usePanelTrackerData } from '@/features/solar-monitoring/hooks/usePanelTrackerData'
import { panels } from '@/features/solar-monitoring/data/mock-data'
import { fetchJsonCached } from '@/shared/lib/apiCache'
import { buildDaySheets, exportWorkbookByDay } from '@/shared/lib/excelExport'
import type { PaginatedResponse, TimeRange } from '@/shared/types/solar'

type FixedHistoryReading = {
  id: number
  voltage: number
  current: number
  power: number
  createdAt: string
}

const EXPORT_PAGE_SIZE = 500

function rangeToSinceDate(range: TimeRange) {
  const now = Date.now()

  if (range === 'live') {
    return new Date(now - 60 * 60 * 1000)
  }

  if (range === 'hourly' || range === 'daily') {
    return new Date(now - 24 * 60 * 60 * 1000)
  }

  if (range === 'weekly') {
    return new Date(now - 7 * 24 * 60 * 60 * 1000)
  }

  return undefined
}

async function fetchAllFixedReadings(range: TimeRange) {
  const since = rangeToSinceDate(range)
  const readings: FixedHistoryReading[] = []
  let page = 1

  while (true) {
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(EXPORT_PAGE_SIZE),
    })

    if (since) {
      query.set('since', since.toISOString())
    }

    const response = await fetchJsonCached<PaginatedResponse<FixedHistoryReading>>(
      `/api/fixed/history?${query.toString()}`,
      {
        ttlMs: 30_000,
        force: true,
      },
    )

    if (!response.ok) {
      throw new Error(`Failed to load fixed panel export data (${response.status})`)
    }

    readings.push(...response.body.items)

    if (!response.body.pagination.hasNext) {
      break
    }

    page += 1
  }

  return readings
}

export function FixedPanelPage() {
  const panel = panels.fixed
  const range = useMemo<TimeRange>(() => 'daily', [])
  const telemetry = usePanelTrackerData('fixed', range)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const sample = telemetry.sample ?? {
    label: 'N/A',
    voltage: 0,
    current: 0,
    power: 0,
    energy: 0,
  }

  const handleExportExcel = async () => {
    setIsExporting(true)
    setExportError(null)

    try {
      const readings = await fetchAllFixedReadings(range)

      const sortedAscending = [...readings].sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      )

      const rows = sortedAscending.map((reading, index) => {
        const currentAt = new Date(reading.createdAt)
        const previous = index > 0 ? sortedAscending[index - 1] : null
        const previousAt = previous ? new Date(previous.createdAt) : null
        const deltaHours =
          previousAt && currentAt.getTime() > previousAt.getTime()
            ? (currentAt.getTime() - previousAt.getTime()) / 3_600_000
            : 1 / 60

        return {
          timestampIso: reading.createdAt,
          Timestamp: currentAt.toLocaleString('en-US'),
          Voltage_V: Number(reading.voltage.toFixed(3)),
          Current_A: Number(reading.current.toFixed(3)),
          Power_W: Number(reading.power.toFixed(3)),
          IntervalEnergy_Wh: Number((reading.power * deltaHours).toFixed(4)),
        }
      })

      const daySheets = buildDaySheets(rows, (row) => new Date(row.timestampIso)).map((sheet) => ({
        ...sheet,
        rows: sheet.rows.map(({ timestampIso: _timestampIso, ...row }) => row),
      }))

      const overviewRows = [
        { Metric: 'Panel', Value: 'Fixed' },
        { Metric: 'Range', Value: 'Daily' },
        { Metric: 'Voltage (V)', Value: sample.voltage.toFixed(2) },
        { Metric: 'Current (A)', Value: sample.current.toFixed(2) },
        { Metric: 'Power (W)', Value: sample.power.toFixed(2) },
        { Metric: 'Energy today (kWh)', Value: telemetry.energyToday.toFixed(3) },
        { Metric: 'Efficiency (%)', Value: telemetry.efficiency.toFixed(2) },
        { Metric: 'Peak power (W)', Value: telemetry.peakPower.toFixed(2) },
        { Metric: 'Exported rows', Value: rows.length },
      ]

      await exportWorkbookByDay({
        fileName: `fixed-panel-${new Date().toISOString().slice(0, 10)}.xlsx`,
        overviewRows,
        daySheets,
      })
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Failed to export Fixed panel workbook')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow="Fixed panel"
        title="Fixed Panel"
        description="Baseline output and stability."
        connection={panel.connection}
        status={panel.status}
        lastUpdated={telemetry.lastUpdated}
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
        <p className="text-sm text-rose-700 dark:text-rose-300">{exportError}</p>
      ) : null}

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-5">
        <MetricCard icon={GaugeCircle} label="Voltage" value={sample.voltage} unit="V" note="Stable electrical potential" />
        <MetricCard icon={Waves} label="Current" value={sample.current} unit="A" note="Smooth midday current band" tone="lime" />
        <MetricCard icon={BatteryCharging} label="Power" value={sample.power} note="Current live output" tone="amber" format="power" />
        <MetricCard icon={SunMedium} label="Energy today" value={telemetry.energyToday} note="Accumulated from tracker log" format="energy" />
        <MetricCard icon={LineChart} label="Efficiency" value={telemetry.efficiency} note="Calculated from live DB telemetry" tone="rose" format="percent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <ChartCard
          title="Electrical Performance"
          subtitle="Voltage, current, and power."
          data={telemetry.series}
          series={[
            { key: 'voltage', label: 'Voltage', color: '#38bdf8', type: 'line' },
            { key: 'current', label: 'Current', color: '#bef264', type: 'line' },
            { key: 'power', label: 'Power', color: '#fbbf24', type: 'area' },
          ]}
        />
        <TimelineCard
          title="Reference Timeline"
          description="Simple, low-variance activity supports its role as the control system."
          items={panel.timeline}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <ChartCard
          title="Energy Generation Trend"
          subtitle="Energy and cumulative production."
          data={telemetry.energySeries}
          series={[
            { key: 'energy', label: 'Energy', color: '#38bdf8', type: 'bar' },
            { key: 'cumulative', label: 'Cumulative', color: '#bef264', type: 'line' },
          ]}
          formatValue={(value) => `${value.toFixed(2)} kWh`}
        />
        <div className="grid gap-4">
          <MetricCard icon={SunMedium} label="Peak power" value={telemetry.peakPower} note="Best observed output in tracker logs" tone="amber" format="power" />
          <MetricCard icon={LineChart} label="System role" value={84} note="Used as the baseline for all comparative analysis" tone="cyan" format="percent" />
        </div>
      </div>

      <HistoricalLogTable
        rows={telemetry.historyRows}
        title="Fixed Panel Historical Log"
        description="Live measurements from the Fixed panel database logs."
        page={telemetry.pagination.page}
        pageSize={telemetry.pagination.pageSize}
        totalPages={telemetry.pagination.totalPages}
        totalCount={telemetry.pagination.totalCount}
        hasPrev={telemetry.pagination.hasPrev}
        hasNext={telemetry.pagination.hasNext}
        onPageChange={telemetry.setPage}
        onPageSizeChange={telemetry.setPageSize}
        loading={telemetry.loading}
      />
    </div>
  )
}
