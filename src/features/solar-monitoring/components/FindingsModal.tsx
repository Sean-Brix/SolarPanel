import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { X, FileSpreadsheet, LineChart as LineChartIcon, Table2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type RawSheetData = Record<string, any[][]>
type PanelKind = 'fixed' | 'conventional' | 'ann'

interface SheetDataset {
  name: string
  headers: string[]
  rows: any[][]
  dayDate: Date | null
}

interface ElectricalTimelinePoint {
  timestamp: number
  displayX: string
  day: string
  powerW?: number
  voltageV?: number
  currentA?: number
  intervalEnergyWh?: number
  cumulativeEnergyWh?: number
  axisXDeg?: number
  axisYDeg?: number
  axisZDeg?: number
  movementDeltaDeg?: number
  movementCount?: number
  cumulativeMovementEnergyWh?: number
}

interface ElectricalDailySummary {
  day: string
  dayTs: number
  dailyEnergyWh: number
  peakPowerW: number
  avgVoltageV: number
  avgCurrentA: number
  movementEnergyUsedWh: number
  maxMovementDeltaDeg: number
}

interface ElectricalSeries {
  timeline: ElectricalTimelinePoint[]
  daily: ElectricalDailySummary[]
}

interface AnnTimelinePoint {
  timestamp: number
  displayX: string
  day: string
  powerPredicted?: number
  powerActual?: number
  powerAbsError?: number
  mismatchCount?: number
  okCount?: number
}

interface AnnDailySummary {
  day: string
  dayTs: number
  samples: number
  mismatchRate: number
  avgAbsPowerError: number
  totalPredictedPower: number
  totalActualPower: number
}

interface NamedMetric {
  name: string
  value: number
}

interface AnnSeries {
  timeline: AnnTimelinePoint[]
  daily: AnnDailySummary[]
  worstFieldFrequency: NamedMetric[]
  sensorMeanAbsError: NamedMetric[]
}

interface GraphCardProps {
  title: string
  subtitle?: string
  children: ReactNode
}

function isFilledRow(row: any[]): boolean {
  return Array.isArray(row) && row.some((v) => v !== undefined && v !== null && v !== '')
}

function parseSheetDate(sheetName: string): Date | null {
  const match = sheetName.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  const year = Number(match[3])
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toTimestamp(value: unknown, fallbackDay: Date | null, rowIndex: number): number {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime()
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime()
    }
  }
  if (fallbackDay) {
    return fallbackDay.getTime() + rowIndex * 5 * 60 * 1000
  }
  return rowIndex * 1000
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMetric(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function tooltipFormatter(value: any): string {
  if (typeof value === 'number') return formatMetric(value)
  if (value === undefined || value === null) return ''
  return String(value)
}

function tooltipPercentFormatter(value: any): string {
  const n = Number(value)
  if (!Number.isNaN(n)) return `${formatMetric(n)}%`
  if (value === undefined || value === null) return ''
  return String(value)
}

function getSheetDatasets(allSheetsData: RawSheetData): SheetDataset[] {
  const datasets: SheetDataset[] = []

  Object.entries(allSheetsData).forEach(([sheetName, sheetData]) => {
    if (sheetName.toLowerCase() === 'overview') return
    if (!Array.isArray(sheetData) || sheetData.length < 2) return

    const headers = (sheetData[0] ?? []).map((h) => String(h ?? ''))
    const rows = sheetData.slice(1).filter((row) => isFilledRow(row))
    if (!headers.length || !rows.length) return

    datasets.push({
      name: sheetName,
      headers,
      rows,
      dayDate: parseSheetDate(sheetName),
    })
  })

  datasets.sort((a, b) => {
    if (a.dayDate && b.dayDate) {
      return a.dayDate.getTime() - b.dayDate.getTime()
    }
    return a.name.localeCompare(b.name)
  })

  return datasets
}

function detectPanelKind(title: string, sheets: SheetDataset[]): PanelKind {
  const lowerTitle = title.toLowerCase()
  const firstHeaders = sheets[0]?.headers ?? []

  if (lowerTitle.includes('ann') || firstHeaders.includes('fields[0].name')) {
    return 'ann'
  }
  if (lowerTitle.includes('conventional') || firstHeaders.includes('AxisX_deg')) {
    return 'conventional'
  }
  return 'fixed'
}

function buildElectricalSeries(sheets: SheetDataset[]): ElectricalSeries {
  const timeline: ElectricalTimelinePoint[] = []
  const daily: ElectricalDailySummary[] = []
  let previousDayMovementEnd = 0

  sheets.forEach((sheet) => {
    const headerIndex = new Map<string, number>()
    sheet.headers.forEach((header, idx) => headerIndex.set(header, idx))

    const timestampIdx = headerIndex.get('Timestamp') ?? 0
    const voltageIdx = headerIndex.get('Voltage_V')
    const currentIdx = headerIndex.get('Current_A')
    const powerIdx = headerIndex.get('Power_W')
    const intervalEnergyIdx = headerIndex.get('IntervalEnergy_Wh')
    const axisXIdx = headerIndex.get('AxisX_deg')
    const axisYIdx = headerIndex.get('AxisY_deg')
    const axisZIdx = headerIndex.get('AxisZ_deg')
    const movementDeltaIdx = headerIndex.get('MovementDelta_deg')
    const movementCountIdx = headerIndex.get('MovementCount')
    const cumulativeMovementEnergyIdx = headerIndex.get('CumulativeMovementEnergy_Wh')

    let energySum = 0
    let powerPeak = 0
    let voltageSum = 0
    let voltageCount = 0
    let currentSum = 0
    let currentCount = 0
    let maxMovementDelta = 0
    let dayMovementEnd = previousDayMovementEnd

    sheet.rows.forEach((row, rowIdx) => {
      const timestamp = toTimestamp(row[timestampIdx], sheet.dayDate, rowIdx)
      const voltage = voltageIdx !== undefined ? toNumber(row[voltageIdx]) : null
      const current = currentIdx !== undefined ? toNumber(row[currentIdx]) : null
      const power = powerIdx !== undefined ? toNumber(row[powerIdx]) : null
      const intervalEnergy = intervalEnergyIdx !== undefined ? toNumber(row[intervalEnergyIdx]) : null
      const axisX = axisXIdx !== undefined ? toNumber(row[axisXIdx]) : null
      const axisY = axisYIdx !== undefined ? toNumber(row[axisYIdx]) : null
      const axisZ = axisZIdx !== undefined ? toNumber(row[axisZIdx]) : null
      const movementDelta = movementDeltaIdx !== undefined ? toNumber(row[movementDeltaIdx]) : null
      const movementCount = movementCountIdx !== undefined ? toNumber(row[movementCountIdx]) : null
      const cumulativeMovementEnergy =
        cumulativeMovementEnergyIdx !== undefined ? toNumber(row[cumulativeMovementEnergyIdx]) : null

      if (intervalEnergy !== null) {
        energySum += intervalEnergy
      }
      if (power !== null) {
        powerPeak = Math.max(powerPeak, power)
      }
      if (voltage !== null) {
        voltageSum += voltage
        voltageCount += 1
      }
      if (current !== null) {
        currentSum += current
        currentCount += 1
      }
      if (movementDelta !== null) {
        maxMovementDelta = Math.max(maxMovementDelta, Math.abs(movementDelta))
      }
      if (cumulativeMovementEnergy !== null) {
        dayMovementEnd = cumulativeMovementEnergy
      }

      timeline.push({
        timestamp,
        displayX: formatTimestamp(timestamp),
        day: sheet.name,
        powerW: power ?? undefined,
        voltageV: voltage ?? undefined,
        currentA: current ?? undefined,
        intervalEnergyWh: intervalEnergy ?? undefined,
        axisXDeg: axisX ?? undefined,
        axisYDeg: axisY ?? undefined,
        axisZDeg: axisZ ?? undefined,
        movementDeltaDeg: movementDelta ?? undefined,
        movementCount: movementCount ?? undefined,
        cumulativeMovementEnergyWh: cumulativeMovementEnergy ?? undefined,
      })
    })

    daily.push({
      day: sheet.name,
      dayTs: sheet.dayDate?.getTime() ?? 0,
      dailyEnergyWh: energySum,
      peakPowerW: powerPeak,
      avgVoltageV: voltageCount ? voltageSum / voltageCount : 0,
      avgCurrentA: currentCount ? currentSum / currentCount : 0,
      movementEnergyUsedWh: Math.max(0, dayMovementEnd - previousDayMovementEnd),
      maxMovementDeltaDeg: maxMovementDelta,
    })

    previousDayMovementEnd = dayMovementEnd
  })

  timeline.sort((a, b) => a.timestamp - b.timestamp)
  daily.sort((a, b) => a.dayTs - b.dayTs)

  let runningEnergy = 0
  timeline.forEach((point) => {
    runningEnergy += point.intervalEnergyWh ?? 0
    point.cumulativeEnergyWh = runningEnergy
  })

  return { timeline, daily }
}

function buildAnnSeries(sheets: SheetDataset[]): AnnSeries {
  const timeline: AnnTimelinePoint[] = []
  const daily: AnnDailySummary[] = []
  const worstFieldCount = new Map<string, number>()
  const sensorError = new Map<string, { sum: number; count: number }>()

  sheets.forEach((sheet) => {
    const headerIndex = new Map<string, number>()
    sheet.headers.forEach((header, idx) => headerIndex.set(header, idx))

    const timestampIdx = headerIndex.get('Timestamp') ?? 0
    const mismatchIdx = headerIndex.get('mismatchCount')
    const okIdx = headerIndex.get('okCount')
    const worstFieldIdx = headerIndex.get('worstField.name')

    const fieldPrefixes = sheet.headers
      .filter((h) => h.endsWith('.name'))
      .map((h) => h.slice(0, h.length - '.name'.length))

    const prefixMeta = fieldPrefixes.map((prefix) => ({
      nameIdx: headerIndex.get(`${prefix}.name`) ?? -1,
      predictedIdx: headerIndex.get(`${prefix}.predicted`) ?? -1,
      actualIdx: headerIndex.get(`${prefix}.actual`) ?? -1,
      differenceIdx: headerIndex.get(`${prefix}.difference`) ?? -1,
    }))

    let sampleCount = 0
    let mismatchTotal = 0
    let okTotal = 0
    let absPowerErrorTotal = 0
    let absPowerErrorCount = 0
    let predictedPowerTotal = 0
    let actualPowerTotal = 0

    sheet.rows.forEach((row, rowIdx) => {
      const timestamp = toTimestamp(row[timestampIdx], sheet.dayDate, rowIdx)
      const point: AnnTimelinePoint = {
        timestamp,
        displayX: formatTimestamp(timestamp),
        day: sheet.name,
      }

      const mismatch = mismatchIdx !== undefined ? toNumber(row[mismatchIdx]) : null
      const ok = okIdx !== undefined ? toNumber(row[okIdx]) : null
      if (mismatch !== null) {
        point.mismatchCount = mismatch
        mismatchTotal += mismatch
      }
      if (ok !== null) {
        point.okCount = ok
        okTotal += ok
      }

      let powerMapped = false
      prefixMeta.forEach((meta) => {
        if (meta.nameIdx < 0) return

        const sensorNameRaw = row[meta.nameIdx]
        const sensorName = String(sensorNameRaw ?? '').trim()
        if (!sensorName) return

        const predicted = meta.predictedIdx >= 0 ? toNumber(row[meta.predictedIdx]) : null
        const actual = meta.actualIdx >= 0 ? toNumber(row[meta.actualIdx]) : null
        const difference = meta.differenceIdx >= 0 ? toNumber(row[meta.differenceIdx]) : null

        if (difference !== null) {
          const prev = sensorError.get(sensorName) ?? { sum: 0, count: 0 }
          prev.sum += Math.abs(difference)
          prev.count += 1
          sensorError.set(sensorName, prev)
        }

        if (!powerMapped && sensorName.toUpperCase() === 'POWER_MW') {
          if (predicted !== null) {
            point.powerPredicted = predicted
          }
          if (actual !== null) {
            point.powerActual = actual
          }
          if (difference !== null) {
            point.powerAbsError = Math.abs(difference)
          } else if (predicted !== null && actual !== null) {
            point.powerAbsError = Math.abs(predicted - actual)
          }
          powerMapped = true
        }
      })

      if (point.powerPredicted !== undefined) {
        predictedPowerTotal += point.powerPredicted
      }
      if (point.powerActual !== undefined) {
        actualPowerTotal += point.powerActual
      }
      if (point.powerAbsError !== undefined) {
        absPowerErrorTotal += point.powerAbsError
        absPowerErrorCount += 1
      }

      if (worstFieldIdx !== undefined) {
        const worstField = String(row[worstFieldIdx] ?? '').trim()
        if (worstField) {
          worstFieldCount.set(worstField, (worstFieldCount.get(worstField) ?? 0) + 1)
        }
      }

      sampleCount += 1
      timeline.push(point)
    })

    const totalChecks = mismatchTotal + okTotal
    daily.push({
      day: sheet.name,
      dayTs: sheet.dayDate?.getTime() ?? 0,
      samples: sampleCount,
      mismatchRate: totalChecks ? (mismatchTotal / totalChecks) * 100 : 0,
      avgAbsPowerError: absPowerErrorCount ? absPowerErrorTotal / absPowerErrorCount : 0,
      totalPredictedPower: predictedPowerTotal,
      totalActualPower: actualPowerTotal,
    })
  })

  timeline.sort((a, b) => a.timestamp - b.timestamp)
  daily.sort((a, b) => a.dayTs - b.dayTs)

  const worstFieldFrequency = Array.from(worstFieldCount.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const sensorMeanAbsError = Array.from(sensorError.entries())
    .map(([name, data]) => ({ name, value: data.count ? data.sum / data.count : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  return { timeline, daily, worstFieldFrequency, sensorMeanAbsError }
}

function GraphCard({ title, subtitle, children }: GraphCardProps) {
  return (
    <section className="bg-card border rounded-lg p-4 shadow-sm">
      <header className="mb-3">
        <h3 className="text-sm font-semibold leading-none">{title}</h3>
        {subtitle ? <p className="text-xs text-muted-foreground mt-1">{subtitle}</p> : null}
      </header>
      <div className="h-[320px] w-full">{children}</div>
    </section>
  )
}

function SheetGraphRender({ allSheetsData, title }: { allSheetsData: RawSheetData; title: string }) {
  const datasets = useMemo(() => getSheetDatasets(allSheetsData), [allSheetsData])
  const panelKind = useMemo(() => detectPanelKind(title, datasets), [title, datasets])

  const electricalSeries = useMemo(
    () => (panelKind === 'ann' ? null : buildElectricalSeries(datasets)),
    [panelKind, datasets],
  )

  const annSeries = useMemo(
    () => (panelKind === 'ann' ? buildAnnSeries(datasets) : null),
    [panelKind, datasets],
  )

  if (!datasets.length) {
    return (
      <div className="h-full flex items-center justify-center p-12 text-muted-foreground bg-card border rounded-lg">
        No dated sheets were found to graph.
      </div>
    )
  }

  if (panelKind === 'ann') {
    if (!annSeries || !annSeries.timeline.length) {
      return (
        <div className="h-full flex items-center justify-center p-12 text-muted-foreground bg-card border rounded-lg">
          No ANN time-series data available for graphing.
        </div>
      )
    }

    const avgMismatchRate =
      annSeries.daily.reduce((sum, row) => sum + row.mismatchRate, 0) / Math.max(annSeries.daily.length, 1)
    const avgPowerError =
      annSeries.daily.reduce((sum, row) => sum + row.avgAbsPowerError, 0) / Math.max(annSeries.daily.length, 1)

    return (
      <div className="h-full overflow-y-auto pr-1 pb-6">
        <p className="text-xs text-muted-foreground mb-3">
          Graph view aggregates all dated tabs into one ANN performance timeline.
        </p>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
          <div className="bg-card border rounded-md p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Days</p>
            <p className="text-sm font-semibold mt-1">{annSeries.daily.length}</p>
          </div>
          <div className="bg-card border rounded-md p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Samples</p>
            <p className="text-sm font-semibold mt-1">{annSeries.timeline.length}</p>
          </div>
          <div className="bg-card border rounded-md p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Avg Mismatch Rate</p>
            <p className="text-sm font-semibold mt-1">{formatMetric(avgMismatchRate)}%</p>
          </div>
          <div className="bg-card border rounded-md p-3">
            <p className="text-[11px] uppercase text-muted-foreground">Avg Abs Power Error</p>
            <p className="text-sm font-semibold mt-1">{formatMetric(avgPowerError)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <GraphCard title="Power Prediction vs Actual" subtitle="POWER_MW across all tabs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={annSeries.timeline}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="displayX" minTickGap={35} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={tooltipFormatter} />
                <Legend />
                <Line type="monotone" dataKey="powerPredicted" name="Predicted" stroke="#2563eb" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="powerActual" name="Actual" stroke="#16a34a" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </GraphCard>

          <GraphCard title="Power Error Over Time" subtitle="Absolute POWER_MW difference per timestamp">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={annSeries.timeline}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="displayX" minTickGap={35} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={tooltipFormatter} />
                <Line type="monotone" dataKey="powerAbsError" name="Abs Error" stroke="#dc2626" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </GraphCard>

          <GraphCard title="Daily Mismatch Rate" subtitle="Lower is better">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={annSeries.daily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={tooltipPercentFormatter} />
                <Line type="monotone" dataKey="mismatchRate" name="Mismatch Rate %" stroke="#ea580c" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </GraphCard>

          <GraphCard title="Daily Avg Abs Power Error" subtitle="Model quality trend by day">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={annSeries.daily}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={tooltipFormatter} />
                <Line type="monotone" dataKey="avgAbsPowerError" name="Avg Abs Error" stroke="#7c3aed" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </GraphCard>

          <GraphCard title="Worst Field Frequency" subtitle="How often each field was the worst mismatch">
            {annSeries.worstFieldFrequency.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annSeries.worstFieldFrequency} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Bar dataKey="value" name="Count" fill="#0284c7" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No worst-field data available.</div>
            )}
          </GraphCard>

          <GraphCard title="Sensor Mean Absolute Error" subtitle="Top contributors to mismatch">
            {annSeries.sensorMeanAbsError.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annSeries.sensorMeanAbsError} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Bar dataKey="value" name="Mean Abs Error" fill="#d97706" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No sensor error data available.</div>
            )}
          </GraphCard>
        </div>
      </div>
    )
  }

  if (!electricalSeries || !electricalSeries.timeline.length) {
    return (
      <div className="h-full flex items-center justify-center p-12 text-muted-foreground bg-card border rounded-lg">
        No panel time-series data available for graphing.
      </div>
    )
  }

  const isConventional = panelKind === 'conventional'
  const totalEnergyWh = electricalSeries.daily.reduce((sum, row) => sum + row.dailyEnergyWh, 0)
  const avgDailyEnergyWh = totalEnergyWh / Math.max(electricalSeries.daily.length, 1)
  const overallPeakPower = Math.max(...electricalSeries.daily.map((row) => row.peakPowerW), 0)
  const movementEnergyTotal = electricalSeries.daily.reduce((sum, row) => sum + row.movementEnergyUsedWh, 0)

  return (
    <div className="h-full overflow-y-auto pr-1 pb-6">
      <p className="text-xs text-muted-foreground mb-3">
        Graph view aggregates all dated tabs into one time series and daily trend summaries.
      </p>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        <div className="bg-card border rounded-md p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Days</p>
          <p className="text-sm font-semibold mt-1">{electricalSeries.daily.length}</p>
        </div>
        <div className="bg-card border rounded-md p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Total Energy (Wh)</p>
          <p className="text-sm font-semibold mt-1">{formatMetric(totalEnergyWh)}</p>
        </div>
        <div className="bg-card border rounded-md p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Avg Daily Energy (Wh)</p>
          <p className="text-sm font-semibold mt-1">{formatMetric(avgDailyEnergyWh)}</p>
        </div>
        <div className="bg-card border rounded-md p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Peak Power (W)</p>
          <p className="text-sm font-semibold mt-1">{formatMetric(overallPeakPower)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <GraphCard
          title={isConventional ? 'Daily Energy vs Movement Cost' : 'Daily Energy Trend'}
          subtitle={isConventional ? 'Generation against tracker movement energy' : 'Energy generated by day'}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={electricalSeries.daily}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Bar dataKey="dailyEnergyWh" name="Daily Energy (Wh)" fill="#16a34a" />
              {isConventional ? <Bar dataKey="movementEnergyUsedWh" name="Movement Energy (Wh)" fill="#ea580c" /> : null}
            </BarChart>
          </ResponsiveContainer>
        </GraphCard>

        <GraphCard title="Power Time Series" subtitle="All-day power output profile">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={electricalSeries.timeline}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="displayX" minTickGap={35} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Line type="monotone" dataKey="powerW" name="Power (W)" stroke="#2563eb" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </GraphCard>

        <GraphCard title="Voltage and Current" subtitle="Electrical profile over the full timeline">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={electricalSeries.timeline}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="displayX" minTickGap={35} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="voltageV" name="Voltage (V)" stroke="#7c3aed" dot={false} strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="currentA" name="Current (A)" stroke="#f59e0b" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </GraphCard>

        <GraphCard title="Cumulative Energy" subtitle="Running generated energy across all tabs">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={electricalSeries.timeline}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="displayX" minTickGap={35} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={tooltipFormatter} />
              <Area type="monotone" dataKey="cumulativeEnergyWh" name="Cumulative Energy (Wh)" stroke="#16a34a" fill="#86efac" fillOpacity={0.4} />
            </AreaChart>
          </ResponsiveContainer>
        </GraphCard>

        {isConventional ? (
          <>
            <GraphCard title="Tracker Axis Positions" subtitle="Axis X, Y, and Z movement over time">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={electricalSeries.timeline}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="displayX" minTickGap={35} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Legend />
                  <Line type="monotone" dataKey="axisXDeg" name="Axis X (deg)" stroke="#2563eb" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="axisYDeg" name="Axis Y (deg)" stroke="#7c3aed" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="axisZDeg" name="Axis Z (deg)" stroke="#0891b2" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </GraphCard>

            <GraphCard
              title="Movement Delta Time Series"
              subtitle={`Total movement energy across period: ${formatMetric(movementEnergyTotal)} Wh`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={electricalSeries.timeline}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="displayX" minTickGap={35} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Line type="monotone" dataKey="movementDeltaDeg" name="Movement Delta (deg)" stroke="#dc2626" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </GraphCard>
          </>
        ) : null}
      </div>
    </div>
  )
}

interface FindingsModalProps {
  isOpen: boolean
  onClose: () => void
  excelUrl: string
  title: string
}

export function FindingsModal({ isOpen, onClose, excelUrl, title }: FindingsModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState<string>('')
  const [sheetData, setSheetData] = useState<Record<string, any[][]>>({})
  const [viewMode, setViewMode] = useState<'table' | 'graphs'>('table')

  useEffect(() => {
    setSheets([])
    setSheetData({})
    setError(null)
    setViewMode('table')
  }, [excelUrl])

  useEffect(() => {
    if (isOpen && excelUrl && !sheets.length && !error) {
      setLoading(true)
      fetch(excelUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
          return res.arrayBuffer()
        })
        .then((ab) => {
          try {
            const wb = XLSX.read(ab, { type: 'array', cellDates: true })
            const newSheetData: Record<string, any[][]> = {}
            let sheetNames = wb.SheetNames

            // Sort sheets with Overview first and dated sheets in ascending order.
            sheetNames.sort((a, b) => {
              const aLower = a.toLowerCase()
              const bLower = b.toLowerCase()
              if (aLower === 'overview') return -1
              if (bLower === 'overview') return 1
              const aDate = parseSheetDate(a)
              const bDate = parseSheetDate(b)
              if (aDate && bDate) return aDate.getTime() - bDate.getTime()
              return a.localeCompare(b)
            })

            sheetNames.forEach((name) => {
              const ws = wb.Sheets[name]
              const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][]
              newSheetData[name] = data
            })
            setSheetData(newSheetData)
            setSheets(sheetNames)
            if (sheetNames.length > 0) {
              setActiveSheet(sheetNames[0])
            }
            setLoading(false)
          } catch (e: any) {
            console.error("Excel parse error:", e)
            setError(e.message || "Failed to parse Excel file")
            setLoading(false)
          }
        })
        .catch((err) => {
          console.error("Error fetching Excel file:", err)
          setError(err.message || "Failed to load Excel file")
          setLoading(false)
        })
    }
  }, [isOpen, excelUrl, sheets.length, error])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-xl shadow-2xl border w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden opacity-100">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b shrink-0 bg-background">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold truncate">{title} Findings Data</h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                 {viewMode === 'graphs' ? 'Aggregated Time-Series Insights' : 'Raw Excel Data View'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={() => setViewMode(v => v === 'table' ? 'graphs' : 'table')}
              className={`p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
                viewMode === 'graphs' 
                  ? 'bg-primary/10 text-primary border border-primary/20' 
                  : 'hover:bg-muted text-muted-foreground border border-transparent'
              }`}
              title="Toggle view mode"
            >
              {viewMode === 'graphs' ? (
                <>
                  <Table2 className="w-5 h-5" />
                  <span className="hidden sm:inline">Table View</span>
                </>
              ) : (
                <>
                  <LineChartIcon className="w-5 h-5" />
                  <span className="hidden sm:inline">Graph View</span>
                </>
              )}
            </button>
            <div className="w-px h-6 bg-border mx-1" />
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-background">
          {loading ? (
            <div className="flex items-center justify-center p-12 h-full">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-muted-foreground">Loading Excel data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center p-12 h-full">
              <div className="bg-destructive/10 text-destructive px-6 py-4 rounded-lg flex flex-col items-center gap-2 text-center max-w-md">
                <p className="font-bold">Error loading data</p>
                <p className="text-sm">{error}</p>
                <button 
                  onClick={() => { setError(null); setLoading(true); }}
                  className="mt-4 px-4 py-2 bg-background border rounded-md text-foreground hover:bg-muted transition"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex overflow-x-auto border-b px-2 sm:px-4 shrink-0 bg-muted/10">
                {sheets.map((sheet) => {
                  const isActive = activeSheet === sheet;
                  return (
                    <button
                      key={sheet}
                      onClick={() => setActiveSheet(sheet)}
                      className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors focus:outline-none ${
                        isActive
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      {sheet}
                    </button>
                  );
                })}
              </div>

              {/* Content Area */}
              <div className="flex-1 min-h-0 overflow-hidden p-4 flex flex-col bg-muted/5 relative">
                {viewMode === 'graphs' ? (
                  <SheetGraphRender allSheetsData={sheetData} title={title} />
                ) : sheetData[activeSheet] && sheetData[activeSheet].length > 0 ? (
                  <div className="bg-card border rounded-lg overflow-hidden flex-1 flex flex-col shadow-sm min-h-0">
                      <div className="overflow-auto flex-1">
                        <table className="w-full text-sm text-left border-collapse min-w-max">
                          <thead className="bg-muted text-muted-foreground uppercase sticky top-0 z-10 shadow-sm border-b">
                            <tr>
                              {sheetData[activeSheet][0].map((header: any, idx: number) => (
                                <th key={idx} className="px-4 py-3 font-semibold border-r last:border-r-0 max-w-[300px] truncate bg-muted">
                                  {header?.toString() || ''}
                                </th>
                              ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y relative z-0">
                          {sheetData[activeSheet].slice(1).map((row: any[], rowIdx: number) => {
                            if (!row || row.length === 0 || row.every(cell => cell === undefined || cell === null || cell === '')) {
                              return null;
                            }
                            return (
                              <tr key={rowIdx} className="hover:bg-muted/30 transition-colors group">
                                {Array.from({ length: sheetData[activeSheet][0].length }).map((_, colIdx) => {
                                  const cellValue = row[colIdx];
                                  const displayValue = cellValue?.toString() || '';
                                  return (
                                    <td key={colIdx} className="px-4 py-2 border-r last:border-r-0 whitespace-nowrap overflow-hidden text-ellipsis max-w-[400px] group-hover:text-foreground text-muted-foreground">
                                      {displayValue}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-12 text-muted-foreground bg-card border rounded-lg">
                    No data found in this sheet.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
