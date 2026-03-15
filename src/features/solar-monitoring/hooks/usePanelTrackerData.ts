import { useEffect, useMemo, useState } from 'react'
import { fetchJsonCached } from '@/shared/lib/apiCache'
import type {
  EnergyPoint,
  HistoryRow,
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

let weatherCache: { expiresAt: number; data: ForecastSeries } | null = null

const WEATHER_CACHE_MS = 30 * 60 * 1000
const PANEL_HISTORY_CACHE_MS = 30 * 1000
const PANEL_REFRESH_MS = 30 * 1000
const FORECAST_LATITUDE = 14.5995
const FORECAST_LONGITUDE = 120.9842

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

const RANGE_LIMITS: Record<TimeRange, number> = {
  live: 40,
  hourly: 120,
  daily: 300,
  weekly: 700,
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
): PanelTrackerData {
  if (!readings.length) {
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

  for (let index = 0; index < readings.length; index += 1) {
    const current = readings[index]
    const previous = index > 0 ? readings[index - 1] : undefined

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

  const latest = readings[readings.length - 1]
  const latestAt = new Date(latest.createdAt)
  const peakPower = Math.max(...readings.map((item) => item.power))

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
    sample: series[series.length - 1] ?? null,
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

export function usePanelTrackerData(panelKey: PanelKey, range: TimeRange) {
  const [data, setData] = useState<PanelTrackerData>({
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
  })

  const limit = useMemo(() => RANGE_LIMITS[range], [range])

  useEffect(() => {
    let active = true

    const load = async () => {
      setData((prev) => ({ ...prev, loading: true, error: null }))

      try {
        const [response, forecastSeries] = await Promise.all([
          fetchJsonCached<ApiReading[]>(`/api/${panelKey}/history?limit=${limit}`, {
            ttlMs: PANEL_HISTORY_CACHE_MS,
          }),
          getForecastSeries(),
        ])

        if (!response.ok) {
          throw new Error(`Failed to load ${panelKey} history (${response.status})`)
        }

        const payload = response.body
        const sorted = [...payload].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )

        if (!active) {
          return
        }

        setData(buildData(panelKey, range, sorted, forecastSeries))
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
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load()
      }
    }, PANEL_REFRESH_MS)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [panelKey, range, limit])

  return data
}
