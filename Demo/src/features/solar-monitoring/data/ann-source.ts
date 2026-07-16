import type {
  AnnFieldGroup,
  AnnFieldResult,
  AnnFieldSummary,
  AnnHistoryResponse,
  AnnRange,
  AnnResolution,
  AnnRunDetail,
  AnnSample,
  AnnTrendFieldStat,
  AnnTrendPoint,
  AnnWeatherSnapshot,
} from '@/shared/types/ann'

export type AnnDashboardFiltersInput = {
  overallResult: 'all' | 'CORRECT' | 'INCORRECT'
  sensorResult: 'all' | 'CORRECT' | 'INCORRECT'
  weatherMismatch: 'all' | 'true' | 'false'
  fieldGroup: 'all' | AnnFieldGroup
  relayApplied: 'all' | 'true' | 'false'
}

type FieldDef = {
  name: string
  group: AnnFieldGroup
  base: number
  spread: number
  tolerance: number
  digits: number
  isRelay?: boolean
}

const FIELD_DEFS: FieldDef[] = [
  { name: 'LDR1', group: 'ldr', base: 950, spread: 130, tolerance: 60, digits: 0 },
  { name: 'LDR2', group: 'ldr', base: 260, spread: 100, tolerance: 60, digits: 0 },
  { name: 'LDR3', group: 'ldr', base: 1010, spread: 60, tolerance: 60, digits: 0 },
  { name: 'LDR4', group: 'ldr', base: 1000, spread: 60, tolerance: 60, digits: 0 },
  { name: 'ACCX', group: 'accelerometer', base: 4300, spread: 420, tolerance: 250, digits: 0 },
  { name: 'ACCY', group: 'accelerometer', base: 6100, spread: 420, tolerance: 250, digits: 0 },
  { name: 'ACCZ', group: 'accelerometer', base: -14000, spread: 320, tolerance: 250, digits: 0 },
  { name: 'GYROX', group: 'gyroscope', base: -280, spread: 90, tolerance: 120, digits: 0 },
  { name: 'GYROY', group: 'gyroscope', base: 280, spread: 90, tolerance: 120, digits: 0 },
  { name: 'GYROZ', group: 'gyroscope', base: 180, spread: 45, tolerance: 120, digits: 0 },
  { name: 'VOLTAGE', group: 'electrical', base: 21.9, spread: 1.1, tolerance: 1.5, digits: 2 },
  { name: 'CURRENT_MA', group: 'electrical', base: 1150, spread: 130, tolerance: 150, digits: 0 },
  { name: 'POWER_MW', group: 'electrical', base: 25200, spread: 2300, tolerance: 2500, digits: 0 },
  { name: 'RELAY1', group: 'relay', base: 1, spread: 0, tolerance: 0, digits: 0, isRelay: true },
  { name: 'RELAY2', group: 'relay', base: 0, spread: 0, tolerance: 0, digits: 0, isRelay: true },
  { name: 'RELAY3', group: 'relay', base: 1, spread: 0, tolerance: 0, digits: 0, isRelay: true },
  { name: 'RELAY4', group: 'relay', base: 0, spread: 0, tolerance: 0, digits: 0, isRelay: true },
]

const WEATHER_OPTIONS: Array<{ code: number; label: string }> = [
  { code: 0, label: 'Clear sky' },
  { code: 1, label: 'Mainly clear' },
  { code: 2, label: 'Partly cloudy' },
  { code: 3, label: 'Overcast' },
  { code: 61, label: 'Light rain' },
]

const INTERVAL_MINUTES = 20
const DAYS_OF_HISTORY = 20
const RUN_COUNT = Math.floor((DAYS_OF_HISTORY * 24 * 60) / INTERVAL_MINUTES)

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function buildRelayState(value: number) {
  return { value, state: value === 1 ? 'CLOSED' : 'OPEN' }
}

function buildSample(index: number, fieldValues: Record<string, number>): AnnSample {
  return {
    sampleNo: index,
    ldr1: fieldValues.LDR1,
    ldr2: fieldValues.LDR2,
    ldr3: fieldValues.LDR3,
    ldr4: fieldValues.LDR4,
    accX: fieldValues.ACCX,
    accY: fieldValues.ACCY,
    accZ: fieldValues.ACCZ,
    gyroX: fieldValues.GYROX,
    gyroY: fieldValues.GYROY,
    gyroZ: fieldValues.GYROZ,
    voltage: fieldValues.VOLTAGE,
    currentMa: fieldValues.CURRENT_MA,
    powerMw: fieldValues.POWER_MW,
    relay1: buildRelayState(fieldValues.RELAY1),
    relay2: buildRelayState(fieldValues.RELAY2),
    relay3: buildRelayState(fieldValues.RELAY3),
    relay4: buildRelayState(fieldValues.RELAY4),
  }
}

function buildRun(index: number, timestampMs: number): AnnRunDetail {
  const at = new Date(timestampMs)
  const isoTimestamp = at.toISOString()

  const predictedValues: Record<string, number> = {}
  const actualValues: Record<string, number> = {}
  const fields: AnnFieldResult[] = FIELD_DEFS.map((def) => {
    if (def.isRelay) {
      const predicted = def.base
      const actual = Math.random() < 0.92 ? predicted : predicted === 1 ? 0 : 1
      predictedValues[def.name] = predicted
      actualValues[def.name] = actual
      const difference = Math.abs(predicted - actual)

      return {
        name: def.name,
        group: def.group,
        predicted,
        actual,
        difference,
        tolerance: def.tolerance,
        status: difference <= def.tolerance ? 'OK' : 'NO',
      }
    }

    const predicted = round(def.base + rand(-def.spread, def.spread) * 0.35, def.digits)
    const actual = round(predicted + rand(-def.spread, def.spread) * 0.55, def.digits)
    predictedValues[def.name] = predicted
    actualValues[def.name] = actual
    const difference = round(Math.abs(predicted - actual), def.digits)

    return {
      name: def.name,
      group: def.group,
      predicted,
      actual,
      difference,
      tolerance: def.tolerance,
      status: difference <= def.tolerance ? 'OK' : 'NO',
    }
  })

  const mismatchCount = fields.filter((field) => field.status !== 'OK').length
  const okCount = fields.length - mismatchCount
  const accuracyPct = round((okCount / fields.length) * 100, 1)
  const sensorResult = mismatchCount <= 1 ? 'CORRECT' : 'INCORRECT'

  const worstField = [...fields]
    .map((field) => ({
      name: field.name,
      difference: field.difference,
      tolerance: field.tolerance,
      ratio: field.tolerance > 0 ? field.difference / field.tolerance : field.difference > 0 ? 2 : 0,
    }))
    .sort((left, right) => right.ratio - left.ratio)[0]

  const predictedWeather = pick(WEATHER_OPTIONS)
  const weatherMatches = Math.random() < 0.82
  const actualWeather = weatherMatches ? predictedWeather : pick(WEATHER_OPTIONS)
  const timeResult = Math.random() < 0.94 ? 'CORRECT' : 'INCORRECT'
  const tempPredicted = round(26 + rand(-3, 6), 1)
  const tempActual = round(tempPredicted + rand(-1.4, 1.4), 1)
  const tempResult = Math.abs(tempPredicted - tempActual) <= 2 ? 'CORRECT' : 'INCORRECT'
  const humidityPredicted = Math.round(clampPct(60 + rand(-15, 20)))
  const humidityActual = Math.round(clampPct(humidityPredicted + rand(-8, 8)))
  const humidityResult = Math.abs(humidityPredicted - humidityActual) <= 8 ? 'CORRECT' : 'INCORRECT'
  const weatherCodeResult = actualWeather.code === predictedWeather.code ? 'CORRECT' : 'INCORRECT'

  const weatherResults = [weatherCodeResult, timeResult, tempResult, humidityResult]
  const matchCount = weatherResults.filter((result) => result === 'CORRECT').length

  const overallResult = sensorResult === 'CORRECT' && matchCount >= 3 ? 'CORRECT' : 'INCORRECT'
  const relayApplied = mismatchCount > 0 && Math.random() < 0.72

  const predictedWeatherSnapshot: AnnWeatherSnapshot = {
    timestamp: isoTimestamp,
    hour: at.getHours(),
    weatherCode: predictedWeather.code,
    weather: predictedWeather.label,
    temperatureC: tempPredicted,
    humidity: humidityPredicted,
  }

  const actualWeatherSnapshot: AnnWeatherSnapshot = {
    timestamp: isoTimestamp,
    hour: at.getHours(),
    weatherCode: actualWeather.code,
    weather: actualWeather.label,
    temperatureC: tempActual,
    humidity: humidityActual,
  }

  const historySamples: AnnSample[] = [1, 2, 3, 4].map((sampleNo) => {
    const jitter = (value: number, spread: number) => value + rand(-spread, spread) * 0.15
    const values: Record<string, number> = {}
    FIELD_DEFS.forEach((def) => {
      const base = actualValues[def.name]
      values[def.name] = def.isRelay ? base : round(jitter(base, def.spread), def.digits)
    })
    return buildSample(sampleNo, values)
  })

  const run: AnnRunDetail = {
    id: index + 1,
    deviceId: 'ESP32-ANN-01',
    predictionId: index + 1,
    verifiedId: index + 1,
    timestamp: isoTimestamp,
    createdAt: isoTimestamp,
    source: 'mqtt',
    mode: 'auto',
    overallResult,
    sensorResult,
    weatherCheck: {
      weatherCodeResult,
      timeResult,
      tempResult,
      humidityResult,
      matchCount,
      total: 4,
    },
    fieldCount: fields.length,
    okCount,
    mismatchCount,
    accuracyPct,
    worstField: worstField ?? null,
    fields,
    weather: {
      predicted: predictedWeatherSnapshot,
      actual: actualWeatherSnapshot,
      check: {
        weatherCodeResult,
        timeResult,
        tempResult,
        humidityResult,
      },
    },
    samples: {
      history: historySamples,
      predictedNext: buildSample(5, predictedValues),
      actualNext: buildSample(5, actualValues),
    },
    predictionCheck: {
      sensorResult,
      overallResult,
      fields,
    },
    relayMemory: {
      applied: relayApplied,
      message: relayApplied
        ? 'Relay memory correction applied from previous verified run.'
        : 'No relay correction required for this run.',
    },
    rawPayload: {
      runId: index + 1,
      predicted: predictedValues,
      actual: actualValues,
    },
  }

  return run
}

function clampPct(value: number) {
  return Math.min(100, Math.max(0, value))
}

function generateAnnRuns(): AnnRunDetail[] {
  const runs: AnnRunDetail[] = []
  const now = Date.now()
  const startTime = now - (RUN_COUNT - 1) * INTERVAL_MINUTES * 60_000

  for (let index = 0; index < RUN_COUNT; index += 1) {
    const timestampMs = startTime + index * INTERVAL_MINUTES * 60_000
    runs.push(buildRun(index, timestampMs))
  }

  return runs
}

export const annRuns: AnnRunDetail[] = generateAnnRuns()

export function getAnnLatest(): AnnRunDetail | null {
  return annRuns.length ? annRuns[annRuns.length - 1] : null
}

export function getAnnRunById(id: number): AnnRunDetail | null {
  return annRuns.find((run) => run.id === id) ?? null
}

const RANGE_DURATION_MS: Record<AnnRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

function resolveTimeWindow(range: AnnRange, customStartAt?: string | null, customEndAt?: string | null) {
  const latest = getAnnLatest()
  const referenceTime = latest ? new Date(latest.createdAt).getTime() : Date.now()
  const rangeStartMs = referenceTime - RANGE_DURATION_MS[range]

  const parsedStart = customStartAt ? new Date(customStartAt).getTime() : NaN
  const parsedEnd = customEndAt ? new Date(customEndAt).getTime() : NaN
  const hasCustomStart = Number.isFinite(parsedStart)
  const hasCustomEnd = Number.isFinite(parsedEnd)
  const custom = hasCustomStart || hasCustomEnd

  const startAtMs = hasCustomStart ? parsedStart : rangeStartMs
  const endAtMs = hasCustomEnd ? parsedEnd : referenceTime

  return {
    startAtMs,
    endAtMs,
    custom,
    startAtIso: new Date(startAtMs).toISOString(),
    endAtIso: new Date(endAtMs).toISOString(),
  }
}

function runsWithinWindow(startAtMs: number, endAtMs: number): AnnRunDetail[] {
  return annRuns.filter((run) => {
    const timestampMs = new Date(run.createdAt).getTime()
    return timestampMs >= startAtMs && timestampMs <= endAtMs
  })
}

function matchesFilters(run: AnnRunDetail, filters: AnnDashboardFiltersInput) {
  if (filters.overallResult !== 'all' && run.overallResult !== filters.overallResult) {
    return false
  }

  if (filters.sensorResult !== 'all' && run.sensorResult !== filters.sensorResult) {
    return false
  }

  if (filters.weatherMismatch !== 'all') {
    const hasMismatch = run.weatherCheck.matchCount < run.weatherCheck.total
    if (filters.weatherMismatch === 'true' && !hasMismatch) return false
    if (filters.weatherMismatch === 'false' && hasMismatch) return false
  }

  if (filters.fieldGroup !== 'all') {
    const hasGroupMismatch = run.fields.some(
      (field) => field.group === filters.fieldGroup && field.status !== 'OK',
    )
    if (!hasGroupMismatch) return false
  }

  if (filters.relayApplied !== 'all') {
    if (filters.relayApplied === 'true' && !run.relayMemory.applied) return false
    if (filters.relayApplied === 'false' && run.relayMemory.applied) return false
  }

  return true
}

function bucketDurationMs(resolution: AnnResolution) {
  if (resolution === '5m') return 5 * 60 * 1000
  if (resolution === '1h') return 60 * 60 * 1000
  if (resolution === '1d') return 24 * 60 * 60 * 1000
  return INTERVAL_MINUTES * 60 * 1000
}

function formatTrendLabel(date: Date, resolution: AnnResolution) {
  if (resolution === '1d') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (resolution === '1h') {
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' })
  }

  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function buildTrend(runsInRange: AnnRunDetail[], resolution: AnnResolution): AnnTrendPoint[] {
  if (!runsInRange.length) {
    return []
  }

  const bucketMs = bucketDurationMs(resolution)
  const buckets = new Map<number, AnnRunDetail[]>()

  for (const run of runsInRange) {
    const timestampMs = new Date(run.createdAt).getTime()
    const bucketKey = Math.floor(timestampMs / bucketMs) * bucketMs
    const existing = buckets.get(bucketKey)

    if (existing) {
      existing.push(run)
    } else {
      buckets.set(bucketKey, [run])
    }
  }

  const sortedKeys = [...buckets.keys()].sort((left, right) => left - right)

  return sortedKeys.map((bucketKey) => {
    const bucketRuns = buckets.get(bucketKey)!
    const latestInBucket = bucketRuns[bucketRuns.length - 1]

    const overallCorrectCount = bucketRuns.filter((run) => run.overallResult === 'CORRECT').length
    const sensorCorrectCount = bucketRuns.filter((run) => run.sensorResult === 'CORRECT').length
    const weatherCodePassCount = bucketRuns.filter((run) => run.weather.check.weatherCodeResult === 'CORRECT').length
    const timePassCount = bucketRuns.filter((run) => run.weather.check.timeResult === 'CORRECT').length
    const tempPassCount = bucketRuns.filter((run) => run.weather.check.tempResult === 'CORRECT').length
    const humidityPassCount = bucketRuns.filter((run) => run.weather.check.humidityResult === 'CORRECT').length
    const accuracyAvg = bucketRuns.reduce((sum, run) => sum + run.accuracyPct, 0) / bucketRuns.length

    const mismatchGroups: Record<AnnFieldGroup, number> = {
      ldr: 0,
      accelerometer: 0,
      gyroscope: 0,
      electrical: 0,
      relay: 0,
      other: 0,
    }

    const fieldStats: Record<string, AnnTrendFieldStat> = {}

    FIELD_DEFS.forEach((def) => {
      let predictedSum = 0
      let actualSum = 0
      let differenceSum = 0
      let okCount = 0
      let mismatchCount = 0

      bucketRuns.forEach((run) => {
        const field = run.fields.find((item) => item.name === def.name)
        if (!field) return
        predictedSum += field.predicted
        actualSum += field.actual
        differenceSum += field.difference
        if (field.status === 'OK') {
          okCount += 1
        } else {
          mismatchCount += 1
          mismatchGroups[def.group] += 1
        }
      })

      fieldStats[def.name] = {
        predicted: round(predictedSum / bucketRuns.length, def.digits),
        actual: round(actualSum / bucketRuns.length, def.digits),
        difference: round(differenceSum / bucketRuns.length, def.digits),
        tolerance: def.tolerance,
        okCount,
        mismatchCount,
        runCount: bucketRuns.length,
      }
    })

    return {
      timestamp: new Date(bucketKey).toISOString(),
      label: formatTrendLabel(new Date(bucketKey), resolution),
      runCount: bucketRuns.length,
      latestRunId: latestInBucket.id,
      latestRunTimestamp: latestInBucket.createdAt,
      accuracyPct: round(accuracyAvg, 1),
      overallCorrectPct: round((overallCorrectCount / bucketRuns.length) * 100, 1),
      sensorCorrectPct: round((sensorCorrectCount / bucketRuns.length) * 100, 1),
      weatherCodePassPct: round((weatherCodePassCount / bucketRuns.length) * 100, 1),
      timePassPct: round((timePassCount / bucketRuns.length) * 100, 1),
      tempPassPct: round((tempPassCount / bucketRuns.length) * 100, 1),
      humidityPassPct: round((humidityPassCount / bucketRuns.length) * 100, 1),
      mismatchGroups,
      fieldStats,
    }
  })
}

function buildFieldSummary(matched: AnnRunDetail[]): AnnFieldSummary[] {
  return FIELD_DEFS.map((def) => {
    let sampleCount = 0
    let okCount = 0
    let mismatchCount = 0
    let predictedSum = 0
    let actualSum = 0
    let differenceSum = 0
    let toleranceSum = 0
    let worstDifference = 0
    let worstRatio = 0

    matched.forEach((run) => {
      const field = run.fields.find((item) => item.name === def.name)
      if (!field) return

      sampleCount += 1
      predictedSum += field.predicted
      actualSum += field.actual
      differenceSum += field.difference
      toleranceSum += field.tolerance

      if (field.status === 'OK') {
        okCount += 1
      } else {
        mismatchCount += 1
      }

      const ratio = field.tolerance > 0 ? field.difference / field.tolerance : field.difference > 0 ? 2 : 0
      if (field.difference > worstDifference) {
        worstDifference = field.difference
      }
      if (ratio > worstRatio) {
        worstRatio = ratio
      }
    })

    return {
      name: def.name,
      group: def.group,
      sampleCount,
      okCount,
      mismatchCount,
      passRatePct: sampleCount > 0 ? round((okCount / sampleCount) * 100, 1) : 0,
      predictedAvg: sampleCount > 0 ? round(predictedSum / sampleCount, def.digits) : 0,
      actualAvg: sampleCount > 0 ? round(actualSum / sampleCount, def.digits) : 0,
      differenceAvg: sampleCount > 0 ? round(differenceSum / sampleCount, def.digits) : 0,
      toleranceAvg: sampleCount > 0 ? round(toleranceSum / sampleCount, def.digits) : 0,
      worstDifference: round(worstDifference, def.digits),
      worstRatio: round(worstRatio, 2),
    }
  })
}

export function queryAnnHistory(params: {
  range: AnnRange
  resolution: AnnResolution
  page: number
  pageSize: number
  includeTrend: boolean
  filters: AnnDashboardFiltersInput
  startAt?: string | null
  endAt?: string | null
}): AnnHistoryResponse {
  const window = resolveTimeWindow(params.range, params.startAt, params.endAt)
  const inRange = runsWithinWindow(window.startAtMs, window.endAtMs)
  const matched = inRange.filter((run) => matchesFilters(run, params.filters))
  const sortedDesc = [...matched].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )

  const totalRuns = sortedDesc.length
  const totalPages = Math.max(1, Math.ceil(totalRuns / params.pageSize))
  const page = Math.min(Math.max(1, params.page), totalPages)
  const start = (page - 1) * params.pageSize
  const runs = sortedDesc.slice(start, start + params.pageSize)

  const trend = params.includeTrend ? buildTrend(inRange, params.resolution) : []
  const fieldSummary = buildFieldSummary(matched)

  return {
    meta: {
      range: params.range,
      resolution: params.resolution,
      totalRuns,
      historyLimit: inRange.length,
      page,
      pageSize: params.pageSize,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      includeTrend: params.includeTrend,
      generatedAt: new Date().toISOString(),
      timeFilter: {
        startAt: window.startAtIso,
        endAt: window.endAtIso,
        custom: window.custom,
      },
      activeFilters: {
        overallResult: params.filters.overallResult === 'all' ? null : params.filters.overallResult,
        sensorResult: params.filters.sensorResult === 'all' ? null : params.filters.sensorResult,
        weatherMismatch:
          params.filters.weatherMismatch === 'all' ? null : params.filters.weatherMismatch === 'true',
        fieldGroup: params.filters.fieldGroup === 'all' ? null : params.filters.fieldGroup,
        relayApplied: params.filters.relayApplied === 'all' ? null : params.filters.relayApplied === 'true',
        startAt: params.startAt ?? null,
        endAt: params.endAt ?? null,
      },
    },
    runs,
    trend,
    fieldSummary,
  }
}

export function getAllAnnRunsForExport(
  range: AnnRange,
  filters: AnnDashboardFiltersInput,
  startAt?: string | null,
  endAt?: string | null,
): AnnRunDetail[] {
  const window = resolveTimeWindow(range, startAt, endAt)
  const inRange = runsWithinWindow(window.startAtMs, window.endAtMs)
  const matched = inRange.filter((run) => matchesFilters(run, filters))

  return [...matched].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
}
