import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchJsonCached } from '@/shared/lib/apiCache'
import type {
  EnergyPoint,
  HistoryRow,
  PaginatedResponse,
  PaginationInfo,
  PanelKey,
  TimeRange,
  TimeSeriesPoint,
  TrackerStatus,
} from '@/shared/types/solar'

type FixedReading = {
  id: number
  voltage: number
  current: number
  power: number
  createdAt: string
}

type TrackerReading = FixedReading & {
  axisX: number
  axisY: number
  axisZ: number
  ldrTop: number
  ldrBottom: number
  ldrLeft: number
  ldrRight: number
}

type ApiReading = FixedReading | TrackerReading

type ForecastSeries = {
  times: number[]
  weatherCodes: number[]
}

type PanelTrackerData = {
  sample: TimeSeriesPoint | null
  series: TimeSeriesPoint[]
  energySeries: EnergyPoint[]
  historyRows: HistoryRow[]
  tracker: TrackerStatus | null
  energyToday: number
  peakPower: number
  efficiency: number
  movementEnergy: number
  movementCount: number
  lastUpdated: Date
  loading: boolean
  error: string | null
}

type PanelTrackerResult = PanelTrackerData & {
  pagination: PaginationInfo
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
}

let weatherCache: { expiresAt: number; data: ForecastSeries } | null = null

const WEATHER_CACHE_MS = 30 * 60 * 1000
const PANEL_HISTORY_CACHE_MS = 30 * 1000
const PANEL_LATEST_CACHE_MS = 5 * 1000
const FORECAST_LATITUDE = 13.7787
const FORECAST_LONGITUDE = 121.024

const DEFAULT_PAGE_SIZES: Record<TimeRange, number> = {
  live: 20,
  hourly: 25,
  daily: 25,
  weekly: 50,
}

function isTrackerReading(reading: ApiReading): reading is TrackerReading {
  return 'axisX' in reading
}

function mapWeatherCodeToLabel(code: number) {
  if (code === 0) return 'Clear sky'
  if (code === 1) return 'Mainly clear'
  if (code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if ([45, 48].includes(code)) return 'Foggy'
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle'
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow'
  if ([95, 96, 99].includes(code)) return 'Thunderstorm'
  return 'Forecast unavailable'
}

async function getForecastSeries(): Promise<ForecastSeries | null> {
  if (weatherCache && weatherCache.expiresAt > Date.now()) {
    return weatherCache.data
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${FORECAST_LATITUDE}` +
      `&longitude=${FORECAST_LONGITUDE}&hourly=weathercode&forecast_days=7&timezone=auto`

    const response = await fetch(url)

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as {
      hourly?: { time?: string[]; weathercode?: number[] }
    }

    const time = payload.hourly?.time ?? []
    const weathercode = payload.hourly?.weathercode ?? []

    if (!time.length || time.length !== weathercode.length) {
      return null
    }

    const data: ForecastSeries = {
      times: time.map((entry) => new Date(entry).getTime()),
      weatherCodes: weathercode,
    }

    weatherCache = {
      expiresAt: Date.now() + WEATHER_CACHE_MS,
      data,
    }

    return data
  } catch {
    return null
  }
}

function forecastForDate(value: Date, forecastSeries: ForecastSeries | null) {
  if (!forecastSeries) {
    return 'Forecast unavailable'
  }

  const target = value.getTime()
  let nearestIndex = 0
  let nearestDiff = Number.POSITIVE_INFINITY

  for (let index = 0; index < forecastSeries.times.length; index += 1) {
    const diff = Math.abs(forecastSeries.times[index] - target)

    if (diff < nearestDiff) {
      nearestDiff = diff
      nearestIndex = index
    }
  }

  return mapWeatherCodeToLabel(forecastSeries.weatherCodes[nearestIndex] ?? -1)
}

function formatLabel(date: Date, range: TimeRange) {
  if (range === 'weekly') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (range === 'daily') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })
  }

  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function headingFromAzimuth(azimuth: number) {
  const normalized = ((azimuth % 360) + 360) % 360

  if (normalized < 22.5 || normalized >= 337.5) return 'N'
  if (normalized < 67.5) return 'NE'
  if (normalized < 112.5) return 'E'
  if (normalized < 157.5) return 'SE'
  if (normalized < 202.5) return 'S'
  if (normalized < 247.5) return 'SW'
  if (normalized < 292.5) return 'W'
  return 'NW'
}

function buildData(
  panelKey: PanelKey,
  range: TimeRange,
  readings: ApiReading[],
  forecastSeries: ForecastSeries | null,
  latestReading: ApiReading | null,
): PanelTrackerData {
  const normalizedReadings =
    readings.length > 0 ? readings : latestReading ? [latestReading] : []

  if (!normalizedReadings.length) {
    return {
      sample: null,
      series: [],
      energySeries: [],
      historyRows: [],
      tracker: null,
      energyToday: 0,
      peakPower: 0,
      efficiency: 0,
      movementEnergy: 0,
      movementCount: 0,
      lastUpdated: new Date(),
      loading: false,
      error: null,
    }
  }

  const series: TimeSeriesPoint[] = []
  const energySeries: EnergyPoint[] = []
  const historyRows: HistoryRow[] = []

  let cumulativeEnergyKwh = 0
  let movementCount = 0
  let movementEnergy = 0
  let travelDegrees = 0

  for (let index = 0; index < normalizedReadings.length; index += 1) {
    const current = normalizedReadings[index]
    const previous = index > 0 ? normalizedReadings[index - 1] : undefined

    const currentAt = new Date(current.createdAt)
    const previousAt = previous ? new Date(previous.createdAt) : null

    const deltaHours =
      previousAt && currentAt.getTime() > previousAt.getTime()
        ? (currentAt.getTime() - previousAt.getTime()) / 3_600_000
        : 1 / 60

    const computedPower = current.voltage * current.current
    const effectivePower = current.power > 0 ? (current.power + computedPower) / 2 : computedPower
    const intervalEnergyKwh = (effectivePower * deltaHours) / 1000
    cumulativeEnergyKwh += intervalEnergyKwh

    let irradiance = 0
    let predictedPower = current.power
    let movementDelta = 0

    if (isTrackerReading(current)) {
      const ldrAverage =
        (current.ldrTop + current.ldrBottom + current.ldrLeft + current.ldrRight) / 4
      irradiance = Math.round(250 + ldrAverage * 750)
      predictedPower = Number((current.power * (0.97 + ldrAverage * 0.06)).toFixed(2))

      if (previous && isTrackerReading(previous)) {
        movementDelta =
          Math.abs(current.axisX - previous.axisX) +
          Math.abs(current.axisY - previous.axisY) +
          Math.abs(current.axisZ - previous.axisZ)
      }

      if (movementDelta > 1) {
        movementCount += 1
      }

      travelDegrees += movementDelta
      movementEnergy += movementDelta * 0.002
    }

    const point: TimeSeriesPoint = {
      label: formatLabel(currentAt, range),
      voltage: current.voltage,
      current: current.current,
      power: current.power,
      energy: intervalEnergyKwh,
      efficiency: current.power > 0 ? Math.min(100, (current.power / 40) * 100) : 0,
      irradiance,
      predictedPower,
      movementCount,
      movementCost: movementEnergy,
    }

    series.push(point)
    energySeries.push({
      label: point.label,
      energy: intervalEnergyKwh,
      cumulative: cumulativeEnergyKwh,
    })

    historyRows.push({
      id: `${panelKey}-${current.id}`,
      timestamp: currentAt.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
      panel: panelKey,
      voltage: current.voltage,
      current: current.current,
      power: current.power,
      energy: cumulativeEnergyKwh,
      azimuth: isTrackerReading(current) ? Number(current.axisY.toFixed(0)) : undefined,
      elevation: isTrackerReading(current) ? Number(current.axisX.toFixed(0)) : undefined,
      forecast: forecastForDate(currentAt, forecastSeries),
    })
  }

  const latest = latestReading ?? normalizedReadings[normalizedReadings.length - 1]
  const latestAt = new Date(latest.createdAt)

  const latestSample: TimeSeriesPoint = {
    label: formatLabel(latestAt, range),
    voltage: latest.voltage,
    current: latest.current,
    power: latest.power,
    energy: energySeries[energySeries.length - 1]?.energy ?? 0,
    efficiency: latest.power > 0 ? Math.min(100, (latest.power / 40) * 100) : 0,
    movementCount,
    movementCost: movementEnergy,
  }

  if (isTrackerReading(latest)) {
    const latestLdrAverage =
      (latest.ldrTop + latest.ldrBottom + latest.ldrLeft + latest.ldrRight) / 4
    latestSample.irradiance = Math.round(250 + latestLdrAverage * 750)
    latestSample.predictedPower = Number((latest.power * (0.97 + latestLdrAverage * 0.06)).toFixed(2))
  }

  const peakPower = Math.max(...normalizedReadings.map((item) => item.power))

  const tracker = isTrackerReading(latest)
    ? {
        azimuth: Number(latest.axisY.toFixed(0)),
        elevation: Number(latest.axisX.toFixed(0)),
        heading: headingFromAzimuth(latest.axisY),
        mode: panelKey === 'ann' ? 'ANN selective' : 'Continuous tracking',
        movementCount,
        travelDegrees: Number(travelDegrees.toFixed(0)),
        nextAdjustment: 'in 3 min',
      }
    : null

  return {
    sample: latestSample,
    series,
    energySeries,
    historyRows: [...historyRows].reverse(),
    tracker,
    energyToday: Number(cumulativeEnergyKwh.toFixed(3)),
    peakPower: Number(peakPower.toFixed(2)),
    efficiency:
      series.length > 0
        ? Number(
            (
              series.reduce((sum, item) => sum + (item.efficiency ?? 0), 0) /
              series.length
            ).toFixed(1),
          )
        : 0,
    movementEnergy: Number(movementEnergy.toFixed(3)),
    movementCount,
    lastUpdated: latestAt,
    loading: false,
    error: null,
  }
}

function initialData(): PanelTrackerData {
  return {
    sample: null,
    series: [],
    energySeries: [],
    historyRows: [],
    tracker: null,
    energyToday: 0,
    peakPower: 0,
    efficiency: 0,
    movementEnergy: 0,
    movementCount: 0,
    lastUpdated: new Date(),
    loading: true,
    error: null,
  }
}

export function usePanelTrackerData(panelKey: PanelKey, range: TimeRange): PanelTrackerResult {
  const defaultPageSize = useMemo(() => DEFAULT_PAGE_SIZES[range], [range])
  const [currentPage, setCurrentPage] = useState(1)
  const [currentPageSize, setCurrentPageSize] = useState(defaultPageSize)
  const [data, setData] = useState<PanelTrackerData>(() => initialData())
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    pageSize: defaultPageSize,
    totalCount: 0,
    totalPages: 1,
    hasPrev: false,
    hasNext: false,
  })

  const setPage = useCallback((page: number) => {
    const normalizedPage = Math.max(1, Math.trunc(page || 1))
    setCurrentPage(normalizedPage)
  }, [])

  const setPageSize = useCallback(
    (pageSize: number) => {
      const normalizedPageSize = Math.min(Math.max(Math.trunc(pageSize || defaultPageSize), 1), 500)
      setCurrentPageSize(normalizedPageSize)
      setCurrentPage(1)
    },
    [defaultPageSize],
  )

  useEffect(() => {
    setCurrentPage(1)
    setCurrentPageSize(defaultPageSize)
  }, [panelKey, defaultPageSize])

  useEffect(() => {
    let active = true

    const load = async (force = false) => {
      setData((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const historyUrl = `/api/${panelKey}/history?page=${currentPage}&pageSize=${currentPageSize}`
        const [historyResponse, latestResponse, forecastSeries] = await Promise.all([
          fetchJsonCached<PaginatedResponse<ApiReading>>(historyUrl, {
            ttlMs: PANEL_HISTORY_CACHE_MS,
            force,
          }),
          fetchJsonCached<ApiReading>(`/api/${panelKey}/latest`, {
            ttlMs: PANEL_LATEST_CACHE_MS,
            force,
          }),
          getForecastSeries(),
        ])

        if (!historyResponse.ok) {
          throw new Error(`Failed to load ${panelKey} history (${historyResponse.status})`)
        }

        let latestReading: ApiReading | null = null
        if (latestResponse.ok) {
          latestReading = latestResponse.body
        } else if (latestResponse.status !== 404) {
          throw new Error(`Failed to load ${panelKey} latest (${latestResponse.status})`)
        }

        if (!active) {
          return
        }

        const payload = historyResponse.body
        const sorted = [...payload.items].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )

        setData(buildData(panelKey, range, sorted, forecastSeries, latestReading))
        setPagination(payload.pagination)

        if (payload.pagination.page !== currentPage) {
          setCurrentPage(payload.pagination.page)
        }

        if (payload.pagination.pageSize !== currentPageSize) {
          setCurrentPageSize(payload.pagination.pageSize)
        }
      } catch (error) {
        if (!active) {
          return
        }

        setData((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to fetch panel history',
        }))
      }
    }

    void load()

    const events = new EventSource('/api/events/readings')
    const onReadingEvent = (message: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(message.data) as { panelType?: PanelKey }

        if (payload.panelType === panelKey && document.visibilityState === 'visible') {
          void load(true)
        }
      } catch {
        if (document.visibilityState === 'visible') {
          void load(true)
        }
      }
    }

    events.addEventListener('reading', onReadingEvent as EventListener)

    return () => {
      active = false
      events.removeEventListener('reading', onReadingEvent as EventListener)
      events.close()
    }
  }, [panelKey, range, currentPage, currentPageSize])

  return {
    ...data,
    pagination,
    setPage,
    setPageSize,
  }
}
