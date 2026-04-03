import type { Prisma } from '@prisma/client'

export const ANN_RANGE_TO_MS = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
} as const

export const ANN_DEFAULT_RESOLUTION = {
  '1h': 'raw',
  '24h': '5m',
  '7d': '1h',
  '30d': '1d',
} as const

export type AnnRange = keyof typeof ANN_RANGE_TO_MS
export type AnnResolution = 'raw' | '5m' | '1h' | '1d'
export type AnnFieldGroup =
  | 'ldr'
  | 'accelerometer'
  | 'gyroscope'
  | 'electrical'
  | 'relay'
  | 'other'

type ParsedAnnRelayState = {
  value: number
  state: string
}

type ParsedAnnSample = {
  sampleNo?: number
  ldr1: number
  ldr2: number
  ldr3: number
  ldr4: number
  accX: number
  accY: number
  accZ: number
  gyroX: number
  gyroY: number
  gyroZ: number
  voltage: number
  currentMa: number
  powerMw: number
  relay1: ParsedAnnRelayState
  relay2: ParsedAnnRelayState
  relay3: ParsedAnnRelayState
  relay4: ParsedAnnRelayState
}

type ParsedAnnWeatherSnapshot = {
  timestamp: string
  hour: number
  weatherCode: number
  weather: string
  temperatureC: number
  humidity: number
}

type ParsedAnnWeatherCheck = {
  weatherCodeResult: string
  timeResult: string
  tempResult: string
  humidityResult: string
}

export type AnnFieldResult = {
  name: string
  group: AnnFieldGroup
  predicted: number
  actual: number
  difference: number
  tolerance: number
  status: string
}

export type ParsedAnnPredictionPayload = {
  deviceId: string
  predictionId: number | null
  verifiedId: number | null
  timestamp: string
  source: string
  mode: string
  weather: {
    predicted: ParsedAnnWeatherSnapshot
    actual: ParsedAnnWeatherSnapshot
    check: ParsedAnnWeatherCheck
  }
  samples: {
    history: ParsedAnnSample[]
    predictedNext: ParsedAnnSample
    actualNext: ParsedAnnSample
  }
  predictionCheck: {
    sensorResult: string
    overallResult: string
    fields: AnnFieldResult[]
  }
  relayMemory: {
    applied: boolean
    message: string
  }
  rawPayload: unknown
}

type SummaryRecord = {
  id: number
  deviceId: string
  predictionId: number | null
  verifiedId: number | null
  deviceTimestamp: Date
  source: string
  mode: string
  overallResult: string
  sensorResult: string
  weatherCodeResult: string
  timeResult: string
  tempResult: string
  humidityResult: string
  weatherMatchCount: number
  weatherCheckCount: number
  fieldCount: number
  okCount: number
  mismatchCount: number
  worstFieldName: string | null
  worstFieldDifference: number | null
  worstFieldTolerance: number | null
  worstFieldDiffRatio: number | null
  relayApplied: boolean
  relayMessage: string | null
  fieldResults: Prisma.JsonValue
  createdAt: Date
}

type DetailRecord = SummaryRecord & {
  weather: Prisma.JsonValue
  samples: Prisma.JsonValue
  predictionCheck: Prisma.JsonValue
  relayMemory: Prisma.JsonValue
  rawPayload: Prisma.JsonValue
}

type TrendAccumulator = {
  bucketStartMs: number
  runCount: number
  okCount: number
  fieldCount: number
  overallCorrectCount: number
  sensorCorrectCount: number
  weatherCodeCorrectCount: number
  timeCorrectCount: number
  tempCorrectCount: number
  humidityCorrectCount: number
  latestRunId: number
  latestRunTimestampMs: number
  mismatchGroups: Record<AnnFieldGroup, number>
  fieldStats: Map<
    string,
    {
      predictedSum: number
      actualSum: number
      differenceSum: number
      toleranceSum: number
      okCount: number
      mismatchCount: number
      runCount: number
    }
  >
}

type ParsedHistoryFilters = {
  overallResult?: string
  sensorResult?: string
  weatherMismatch?: boolean
  fieldGroup?: AnnFieldGroup
  relayApplied?: boolean
}

const SAMPLE_NUMERIC_KEYS = [
  'ldr1',
  'ldr2',
  'ldr3',
  'ldr4',
  'accX',
  'accY',
  'accZ',
  'gyroX',
  'gyroY',
  'gyroZ',
  'voltage',
  'currentMa',
  'powerMw',
] as const

const RELAY_KEYS = ['relay1', 'relay2', 'relay3', 'relay4'] as const

const GROUP_ZERO: Record<AnnFieldGroup, number> = {
  ldr: 0,
  accelerometer: 0,
  gyroscope: 0,
  electrical: 0,
  relay: 0,
  other: 0,
}

export const WEATHER_CODE_LABELS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
}

export const ANN_RUN_SUMMARY_SELECT = {
  id: true,
  deviceId: true,
  predictionId: true,
  verifiedId: true,
  deviceTimestamp: true,
  source: true,
  mode: true,
  overallResult: true,
  sensorResult: true,
  weatherCodeResult: true,
  timeResult: true,
  tempResult: true,
  humidityResult: true,
  weatherMatchCount: true,
  weatherCheckCount: true,
  fieldCount: true,
  okCount: true,
  mismatchCount: true,
  worstFieldName: true,
  worstFieldDifference: true,
  worstFieldTolerance: true,
  worstFieldDiffRatio: true,
  relayApplied: true,
  relayMessage: true,
  fieldResults: true,
  createdAt: true,
} as const

export const ANN_RUN_DETAIL_SELECT = {
  ...ANN_RUN_SUMMARY_SELECT,
  weather: true,
  samples: true,
  predictionCheck: true,
  relayMemory: true,
  rawPayload: true,
} as const

function recordFrom(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toInteger(value: unknown): number | null {
  const parsed = toFiniteNumber(value)
  if (parsed === null) {
    return null
  }

  return Math.trunc(parsed)
}

function toStringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim()
  }

  return null
}

function toBooleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value
  }

  if (value === 'true' || value === '1' || value === 1) {
    return true
  }

  if (value === 'false' || value === '0' || value === 0) {
    return false
  }

  return null
}

function normalizeResult(value: unknown, fallback = 'UNKNOWN') {
  const stringValue = toStringValue(value)
  if (!stringValue) {
    return fallback
  }

  const canonical = stringValue.toUpperCase().replace(/[\s-]+/g, '_')

  if (canonical === 'CORRECT' || canonical === 'YES') return 'CORRECT'
  if (canonical === 'INCORRECT' || canonical === 'NOT_CORRECT') return 'INCORRECT'
  if (canonical === 'NO' || canonical === 'MISMATCH' || canonical === 'NOT_OK') return 'MISMATCH'

  return stringValue.toUpperCase()
}

function normalizeWeatherLabel(code: number, fallback?: string) {
  return WEATHER_CODE_LABELS[code] ?? fallback ?? `Code ${code}`
}

function isCorrectResult(value: string) {
  return normalizeResult(value) === 'CORRECT'
}

function isFieldOkStatus(value: string) {
  const normalized = normalizeResult(value)
  return normalized === 'OK' || normalized === 'CORRECT'
}

function getWorstFieldRatio(difference: number, tolerance: number) {
  if (tolerance > 0) {
    return difference / tolerance
  }

  return difference === 0 ? 0 : 1
}

export function inferAnnFieldGroup(name: string): AnnFieldGroup {
  const normalized = name.toUpperCase()

  if (normalized.startsWith('LDR')) return 'ldr'
  if (normalized.startsWith('ACC')) return 'accelerometer'
  if (normalized.startsWith('GYRO')) return 'gyroscope'
  if (normalized === 'VOLTAGE' || normalized === 'CURRENT_MA' || normalized === 'POWER_MW') {
    return 'electrical'
  }
  if (normalized.startsWith('RELAY')) return 'relay'
  return 'other'
}

function parseRelayState(value: unknown): ParsedAnnRelayState | null {
  const scalarRelayValue = toInteger(value)
  if (scalarRelayValue !== null) {
    return {
      value: scalarRelayValue,
      state: scalarRelayValue === 1 ? 'ON' : 'OFF',
    }
  }

  const record = recordFrom(value)
  if (!record) {
    return null
  }

  const relayValue = toInteger(record.value)
  const relayState = toStringValue(record.state)

  if (relayValue === null && relayState === null) {
    return null
  }

  const inferredRelayValue = relayValue ?? (relayState?.toUpperCase() === 'ON' ? 1 : relayState?.toUpperCase() === 'OFF' ? 0 : null)
  if (inferredRelayValue === null) {
    return null
  }

  const inferredRelayState = relayState?.toUpperCase() ?? (inferredRelayValue === 1 ? 'ON' : 'OFF')

  return {
    value: inferredRelayValue,
    state: inferredRelayState,
  }
}

function pickRecordValue(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key]
    }
  }

  return undefined
}

function parseSample(value: unknown, includeSampleNo: boolean): ParsedAnnSample | null {
  const record = recordFrom(value)
  if (!record) {
    return null
  }

  const numberValueMap: Record<(typeof SAMPLE_NUMERIC_KEYS)[number], number | null> = {
    ldr1: toFiniteNumber(pickRecordValue(record, ['ldr1'])),
    ldr2: toFiniteNumber(pickRecordValue(record, ['ldr2'])),
    ldr3: toFiniteNumber(pickRecordValue(record, ['ldr3'])),
    ldr4: toFiniteNumber(pickRecordValue(record, ['ldr4'])),
    accX: toFiniteNumber(pickRecordValue(record, ['accX', 'accx'])),
    accY: toFiniteNumber(pickRecordValue(record, ['accY', 'accy'])),
    accZ: toFiniteNumber(pickRecordValue(record, ['accZ', 'accz'])),
    gyroX: toFiniteNumber(pickRecordValue(record, ['gyroX', 'gyrox'])),
    gyroY: toFiniteNumber(pickRecordValue(record, ['gyroY', 'gyroy'])),
    gyroZ: toFiniteNumber(pickRecordValue(record, ['gyroZ', 'gyroz'])),
    voltage: toFiniteNumber(pickRecordValue(record, ['voltage'])),
    currentMa: toFiniteNumber(pickRecordValue(record, ['currentMa', 'current_ma'])),
    powerMw: toFiniteNumber(pickRecordValue(record, ['powerMw', 'power_mw'])),
  }

  if (Object.values(numberValueMap).some((entry) => entry === null)) {
    return null
  }

  const relayStates = Object.fromEntries(
    RELAY_KEYS.map((key) => [key, parseRelayState(pickRecordValue(record, [key]))]),
  ) as Record<(typeof RELAY_KEYS)[number], ParsedAnnRelayState | null>

  if (Object.values(relayStates).some((entry) => entry === null)) {
    return null
  }

  const sampleNo = includeSampleNo ? toInteger(record.sampleNo) : null
  if (includeSampleNo && sampleNo === null) {
    return null
  }

  return {
    ...(sampleNo !== null ? { sampleNo } : {}),
    ldr1: numberValueMap.ldr1!,
    ldr2: numberValueMap.ldr2!,
    ldr3: numberValueMap.ldr3!,
    ldr4: numberValueMap.ldr4!,
    accX: numberValueMap.accX!,
    accY: numberValueMap.accY!,
    accZ: numberValueMap.accZ!,
    gyroX: numberValueMap.gyroX!,
    gyroY: numberValueMap.gyroY!,
    gyroZ: numberValueMap.gyroZ!,
    voltage: numberValueMap.voltage!,
    currentMa: numberValueMap.currentMa!,
    powerMw: numberValueMap.powerMw!,
    relay1: relayStates.relay1!,
    relay2: relayStates.relay2!,
    relay3: relayStates.relay3!,
    relay4: relayStates.relay4!,
  }
}

function parseWeatherSnapshot(value: unknown): ParsedAnnWeatherSnapshot | null {
  const record = recordFrom(value)
  if (!record) {
    return null
  }

  const timestamp = toStringValue(record.timestamp)
  const hour = toInteger(record.hour)
  const weatherCode = toInteger(record.weatherCode)
  const temperatureC = toFiniteNumber(pickRecordValue(record, ['temperatureC', 'tempC']))
  const humidity = toInteger(pickRecordValue(record, ['humidity', 'humidityPct']))

  if (
    timestamp === null ||
    hour === null ||
    weatherCode === null ||
    temperatureC === null ||
    humidity === null
  ) {
    return null
  }

  return {
    timestamp,
    hour,
    weatherCode,
    weather: normalizeWeatherLabel(weatherCode, toStringValue(record.weather) ?? undefined),
    temperatureC,
    humidity,
  }
}

function parseWeatherCheck(value: unknown): ParsedAnnWeatherCheck | null {
  const record = recordFrom(value)
  if (!record) {
    return null
  }

  return {
    weatherCodeResult: normalizeResult(record.weatherCodeResult),
    timeResult: normalizeResult(record.timeResult),
    tempResult: normalizeResult(record.tempResult),
    humidityResult: normalizeResult(record.humidityResult),
  }
}

function parseFieldResult(value: unknown): AnnFieldResult | null {
  const record = recordFrom(value)
  if (!record) {
    return null
  }

  const name = toStringValue(pickRecordValue(record, ['name', 'field']))
  const predicted = toFiniteNumber(record.predicted)
  const actual = toFiniteNumber(record.actual)
  const difference = toFiniteNumber(pickRecordValue(record, ['difference', 'diff']))
  const tolerance = toFiniteNumber(pickRecordValue(record, ['tolerance', 'tol']))
  const status = normalizeResult(pickRecordValue(record, ['status', 'result']))

  if (
    name === null ||
    predicted === null ||
    actual === null ||
    difference === null ||
    tolerance === null
  ) {
    return null
  }

  const normalizedName = name.toUpperCase()

  return {
    name: normalizedName,
    group: inferAnnFieldGroup(normalizedName),
    predicted,
    actual,
    difference,
    tolerance,
    status,
  }
}

function parseFieldResults(value: unknown): AnnFieldResult[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const fields: AnnFieldResult[] = []

  for (const item of value) {
    const parsed = parseFieldResult(item)
    if (!parsed) {
      return null
    }
    fields.push(parsed)
  }

  return fields
}

export function parseAnnPredictionPayload(value: unknown): ParsedAnnPredictionPayload | null {
  const record = recordFrom(value)
  if (!record) {
    return null
  }

  const setId = toInteger(record.setId)
  const deviceId = toStringValue(record.deviceId) ?? (setId !== null ? `set-${setId}` : 'ann-device')
  const source = toStringValue(record.source) ?? 'esp32'
  const mode = toStringValue(record.mode) ?? 'predictive'
  const predictionId = toInteger(record.predictionId ?? record.setId)
  const verifiedId = toInteger(record.verifiedId)

  const weather = recordFrom(record.weather)
  const predictionCheck = recordFrom(record.predictionCheck)

  if (!predictionCheck) {
    return null
  }

  const predictedWeather = parseWeatherSnapshot(weather?.predicted ?? record.predictedWeather)
  const actualWeather = parseWeatherSnapshot(weather?.actual ?? record.actualWeather)
  const weatherCheck = parseWeatherCheck(weather?.check ?? record.weatherCheck)

  if (!predictedWeather || !actualWeather || !weatherCheck) {
    return null
  }

  const timestamp =
    toStringValue(record.timestamp) ??
    predictedWeather.timestamp ??
    actualWeather.timestamp

  if (!timestamp) {
    return null
  }

  const timestampDate = new Date(timestamp)
  if (Number.isNaN(timestampDate.getTime())) {
    return null
  }

  const samplesValue = record.samples
  const samplesRecord = recordFrom(samplesValue)
  const historySource = Array.isArray(samplesValue)
    ? samplesValue
    : Array.isArray(samplesRecord?.history)
      ? samplesRecord.history
      : null

  if (!historySource) {
    return null
  }

  const history = historySource
    .map((entry) => parseSample(entry, true))
    .filter((entry): entry is ParsedAnnSample => entry !== null)

  if (history.length !== historySource.length || history.length === 0) {
    return null
  }

  const predictedNext = parseSample(
    samplesRecord?.predictedNext ?? record.predictedNextSample,
    false,
  )
  const actualNext = parseSample(
    samplesRecord?.actualNext ?? record.actualNextSample,
    false,
  )

  if (!predictedNext || !actualNext) {
    return null
  }

  const sensorResult = normalizeResult(predictionCheck.sensorResult)
  const overallResult = normalizeResult(predictionCheck.overallResult)
  const fields = parseFieldResults(predictionCheck.fields ?? predictionCheck.details)

  if (!fields) {
    return null
  }

  const relayMemory = recordFrom(record.relayMemory)
  const relayApplied = toBooleanValue(relayMemory?.applied)
  const relayMessage = toStringValue(relayMemory?.message)

  const normalizedRelayMemory = {
    applied: relayApplied ?? false,
    message: relayMessage ?? 'No relay memory payload provided',
  }

  return {
    deviceId,
    predictionId,
    verifiedId,
    timestamp,
    source,
    mode,
    weather: {
      predicted: predictedWeather,
      actual: actualWeather,
      check: weatherCheck,
    },
    samples: {
      history,
      predictedNext,
      actualNext,
    },
    predictionCheck: {
      sensorResult,
      overallResult,
      fields,
    },
    relayMemory: normalizedRelayMemory,
    rawPayload: record,
  }
}

export function toAnnPredictionCreateData(
  payload: ParsedAnnPredictionPayload,
): Prisma.AnnPredictionRunCreateInput {
  const fieldCount = payload.predictionCheck.fields.length
  const okCount = payload.predictionCheck.fields.filter((field) => isFieldOkStatus(field.status)).length
  const mismatchCount = fieldCount - okCount

  const weatherStatuses = [
    payload.weather.check.weatherCodeResult,
    payload.weather.check.timeResult,
    payload.weather.check.tempResult,
    payload.weather.check.humidityResult,
  ]
  const weatherMatchCount = weatherStatuses.filter((value) => isCorrectResult(value)).length

  const worstField = payload.predictionCheck.fields.reduce<AnnFieldResult | null>((current, field) => {
    if (!current) {
      return field
    }

    const currentRatio = getWorstFieldRatio(current.difference, current.tolerance)
    const nextRatio = getWorstFieldRatio(field.difference, field.tolerance)
    return nextRatio > currentRatio ? field : current
  }, null)

  return {
    deviceId: payload.deviceId,
    predictionId: payload.predictionId,
    verifiedId: payload.verifiedId,
    deviceTimestamp: new Date(payload.timestamp),
    source: payload.source,
    mode: payload.mode,
    overallResult: payload.predictionCheck.overallResult,
    sensorResult: payload.predictionCheck.sensorResult,
    weatherCodeResult: payload.weather.check.weatherCodeResult,
    timeResult: payload.weather.check.timeResult,
    tempResult: payload.weather.check.tempResult,
    humidityResult: payload.weather.check.humidityResult,
    weatherMatchCount,
    weatherCheckCount: weatherStatuses.length,
    fieldCount,
    okCount,
    mismatchCount,
    worstFieldName: worstField?.name ?? null,
    worstFieldDifference: worstField?.difference ?? null,
    worstFieldTolerance: worstField?.tolerance ?? null,
    worstFieldDiffRatio: worstField
      ? Number(getWorstFieldRatio(worstField.difference, worstField.tolerance).toFixed(6))
      : null,
    relayApplied: payload.relayMemory.applied,
    relayMessage: payload.relayMemory.message,
    weather: payload.weather as Prisma.InputJsonValue,
    samples: payload.samples as Prisma.InputJsonValue,
    predictionCheck: payload.predictionCheck as Prisma.InputJsonValue,
    relayMemory: payload.relayMemory as Prisma.InputJsonValue,
    fieldResults: payload.predictionCheck.fields as Prisma.InputJsonValue,
    rawPayload: payload.rawPayload as Prisma.InputJsonValue,
  }
}

function parseStoredFieldResults(value: Prisma.JsonValue): AnnFieldResult[] {
  const parsed = parseFieldResults(value)
  return parsed ?? []
}

function summaryFromRecord(record: SummaryRecord, parsedFields?: AnnFieldResult[]) {
  const accuracyPct = record.fieldCount > 0 ? (record.okCount / record.fieldCount) * 100 : 0

  return {
    id: record.id,
    deviceId: record.deviceId,
    predictionId: record.predictionId,
    verifiedId: record.verifiedId,
    timestamp: record.deviceTimestamp.toISOString(),
    createdAt: record.createdAt.toISOString(),
    source: record.source,
    mode: record.mode,
    overallResult: record.overallResult,
    sensorResult: record.sensorResult,
    weatherCheck: {
      weatherCodeResult: record.weatherCodeResult,
      timeResult: record.timeResult,
      tempResult: record.tempResult,
      humidityResult: record.humidityResult,
      matchCount: record.weatherMatchCount,
      total: record.weatherCheckCount,
    },
    fieldCount: record.fieldCount,
    okCount: record.okCount,
    mismatchCount: record.mismatchCount,
    accuracyPct: Number(accuracyPct.toFixed(2)),
    worstField: record.worstFieldName
      ? {
          name: record.worstFieldName,
          difference: record.worstFieldDifference ?? 0,
          tolerance: record.worstFieldTolerance ?? 0,
          ratio: Number((record.worstFieldDiffRatio ?? 0).toFixed(4)),
        }
      : null,
    relayMemory: {
      applied: record.relayApplied,
      message: record.relayMessage,
    },
    fields: parsedFields ?? parseStoredFieldResults(record.fieldResults),
  }
}

export function toAnnRunSummary(record: SummaryRecord, parsedFields?: AnnFieldResult[]) {
  return summaryFromRecord(record, parsedFields)
}

export function toAnnRunDetail(record: DetailRecord) {
  const summary = summaryFromRecord(record)

  return {
    ...summary,
    weather: record.weather,
    samples: record.samples,
    predictionCheck: {
      ...(recordFrom(record.predictionCheck) ?? {}),
      fields: summary.fields,
    },
    relayMemory: record.relayMemory,
    rawPayload: record.rawPayload,
  }
}

function resolutionToMs(resolution: AnnResolution) {
  if (resolution === '5m') return 5 * 60 * 1000
  if (resolution === '1h') return 60 * 60 * 1000
  if (resolution === '1d') return 24 * 60 * 60 * 1000
  return null
}

function formatTrendLabel(timestamp: Date, resolution: AnnResolution) {
  if (resolution === '1d') {
    return timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (resolution === '1h') {
    return timestamp.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
    })
  }

  return timestamp.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function buildRawTrendPoint(record: SummaryRecord, parsedFields?: AnnFieldResult[]) {
  const fields = parsedFields ?? parseStoredFieldResults(record.fieldResults)
  const mismatchGroups = { ...GROUP_ZERO }

  for (const field of fields) {
    if (!isFieldOkStatus(field.status)) {
      mismatchGroups[field.group] += 1
    }
  }

  return {
    timestamp: record.createdAt.toISOString(),
    label: formatTrendLabel(record.createdAt, 'raw'),
    runCount: 1,
    latestRunId: record.id,
    latestRunTimestamp: record.createdAt.toISOString(),
    accuracyPct: Number((record.fieldCount > 0 ? (record.okCount / record.fieldCount) * 100 : 0).toFixed(2)),
    overallCorrectPct: isCorrectResult(record.overallResult) ? 100 : 0,
    sensorCorrectPct: isCorrectResult(record.sensorResult) ? 100 : 0,
    weatherCodePassPct: isCorrectResult(record.weatherCodeResult) ? 100 : 0,
    timePassPct: isCorrectResult(record.timeResult) ? 100 : 0,
    tempPassPct: isCorrectResult(record.tempResult) ? 100 : 0,
    humidityPassPct: isCorrectResult(record.humidityResult) ? 100 : 0,
    mismatchGroups,
    fieldStats: Object.fromEntries(
      fields.map((field) => [
        field.name,
        {
          predicted: field.predicted,
          actual: field.actual,
          difference: field.difference,
          tolerance: field.tolerance,
          okCount: isFieldOkStatus(field.status) ? 1 : 0,
          mismatchCount: isFieldOkStatus(field.status) ? 0 : 1,
          runCount: 1,
        },
      ]),
    ),
  }
}

function createTrendAccumulator(bucketStartMs: number, record: SummaryRecord): TrendAccumulator {
  return {
    bucketStartMs,
    runCount: 0,
    okCount: 0,
    fieldCount: 0,
    overallCorrectCount: 0,
    sensorCorrectCount: 0,
    weatherCodeCorrectCount: 0,
    timeCorrectCount: 0,
    tempCorrectCount: 0,
    humidityCorrectCount: 0,
    latestRunId: record.id,
    latestRunTimestampMs: record.createdAt.getTime(),
    mismatchGroups: { ...GROUP_ZERO },
    fieldStats: new Map(),
  }
}

function accumulateTrendPoint(
  accumulator: TrendAccumulator,
  record: SummaryRecord,
  parsedFields?: AnnFieldResult[],
) {
  const timestampMs = record.createdAt.getTime()
  const fields = parsedFields ?? parseStoredFieldResults(record.fieldResults)

  accumulator.runCount += 1
  accumulator.okCount += record.okCount
  accumulator.fieldCount += record.fieldCount
  accumulator.overallCorrectCount += isCorrectResult(record.overallResult) ? 1 : 0
  accumulator.sensorCorrectCount += isCorrectResult(record.sensorResult) ? 1 : 0
  accumulator.weatherCodeCorrectCount += isCorrectResult(record.weatherCodeResult) ? 1 : 0
  accumulator.timeCorrectCount += isCorrectResult(record.timeResult) ? 1 : 0
  accumulator.tempCorrectCount += isCorrectResult(record.tempResult) ? 1 : 0
  accumulator.humidityCorrectCount += isCorrectResult(record.humidityResult) ? 1 : 0

  if (timestampMs >= accumulator.latestRunTimestampMs) {
    accumulator.latestRunId = record.id
    accumulator.latestRunTimestampMs = timestampMs
  }

  for (const field of fields) {
    if (!isFieldOkStatus(field.status)) {
      accumulator.mismatchGroups[field.group] += 1
    }

    const current = accumulator.fieldStats.get(field.name) ?? {
      predictedSum: 0,
      actualSum: 0,
      differenceSum: 0,
      toleranceSum: 0,
      okCount: 0,
      mismatchCount: 0,
      runCount: 0,
    }

    current.predictedSum += field.predicted
    current.actualSum += field.actual
    current.differenceSum += field.difference
    current.toleranceSum += field.tolerance
    current.okCount += isFieldOkStatus(field.status) ? 1 : 0
    current.mismatchCount += isFieldOkStatus(field.status) ? 0 : 1
    current.runCount += 1

    accumulator.fieldStats.set(field.name, current)
  }
}

function finalizeTrendAccumulator(accumulator: TrendAccumulator, resolution: AnnResolution) {
  return {
    timestamp: new Date(accumulator.bucketStartMs).toISOString(),
    label: formatTrendLabel(new Date(accumulator.bucketStartMs), resolution),
    runCount: accumulator.runCount,
    latestRunId: accumulator.latestRunId,
    latestRunTimestamp: new Date(accumulator.latestRunTimestampMs).toISOString(),
    accuracyPct:
      accumulator.fieldCount > 0
        ? Number(((accumulator.okCount / accumulator.fieldCount) * 100).toFixed(2))
        : 0,
    overallCorrectPct: Number(((accumulator.overallCorrectCount / accumulator.runCount) * 100).toFixed(2)),
    sensorCorrectPct: Number(((accumulator.sensorCorrectCount / accumulator.runCount) * 100).toFixed(2)),
    weatherCodePassPct: Number(((accumulator.weatherCodeCorrectCount / accumulator.runCount) * 100).toFixed(2)),
    timePassPct: Number(((accumulator.timeCorrectCount / accumulator.runCount) * 100).toFixed(2)),
    tempPassPct: Number(((accumulator.tempCorrectCount / accumulator.runCount) * 100).toFixed(2)),
    humidityPassPct: Number(((accumulator.humidityCorrectCount / accumulator.runCount) * 100).toFixed(2)),
    mismatchGroups: accumulator.mismatchGroups,
    fieldStats: Object.fromEntries(
      Array.from(accumulator.fieldStats.entries()).map(([fieldName, fieldStats]) => [
        fieldName,
        {
          predicted: Number((fieldStats.predictedSum / fieldStats.runCount).toFixed(4)),
          actual: Number((fieldStats.actualSum / fieldStats.runCount).toFixed(4)),
          difference: Number((fieldStats.differenceSum / fieldStats.runCount).toFixed(4)),
          tolerance: Number((fieldStats.toleranceSum / fieldStats.runCount).toFixed(4)),
          okCount: fieldStats.okCount,
          mismatchCount: fieldStats.mismatchCount,
          runCount: fieldStats.runCount,
        },
      ]),
    ),
  }
}

function applyHistoryFilters(
  records: SummaryRecord[],
  filters: ParsedHistoryFilters,
  getFields: (record: SummaryRecord) => AnnFieldResult[] = (record) =>
    parseStoredFieldResults(record.fieldResults),
) {
  return records.filter((record) => {
    const fields = getFields(record)

    if (filters.overallResult && normalizeResult(record.overallResult) !== filters.overallResult) {
      return false
    }

    if (filters.sensorResult && normalizeResult(record.sensorResult) !== filters.sensorResult) {
      return false
    }

    if (
      typeof filters.weatherMismatch === 'boolean' &&
      (record.weatherMatchCount < record.weatherCheckCount) !== filters.weatherMismatch
    ) {
      return false
    }

    if (
      filters.fieldGroup &&
      !fields.some((field) => field.group === filters.fieldGroup && !isFieldOkStatus(field.status))
    ) {
      return false
    }

    if (
      typeof filters.relayApplied === 'boolean' &&
      record.relayApplied !== filters.relayApplied
    ) {
      return false
    }

    return true
  })
}

export function parseAnnHistoryFilters(query: Record<string, unknown>): ParsedHistoryFilters {
  const overallResult = toStringValue(query.overallResult)
  const sensorResult = toStringValue(query.sensorResult)
  const weatherMismatch = toBooleanValue(query.weatherMismatch)
  const relayApplied = toBooleanValue(query.relayApplied)
  const requestedGroup = toStringValue(query.fieldGroup)?.toLowerCase()

  const allowedGroups: AnnFieldGroup[] = [
    'ldr',
    'accelerometer',
    'gyroscope',
    'electrical',
    'relay',
    'other',
  ]

  return {
    overallResult: overallResult ? normalizeResult(overallResult) : undefined,
    sensorResult: sensorResult ? normalizeResult(sensorResult) : undefined,
    weatherMismatch: weatherMismatch ?? undefined,
    fieldGroup: requestedGroup && allowedGroups.includes(requestedGroup as AnnFieldGroup)
      ? (requestedGroup as AnnFieldGroup)
      : undefined,
    relayApplied: relayApplied ?? undefined,
  }
}

export function buildAnnHistoryResponse(args: {
  records: SummaryRecord[]
  range: AnnRange
  resolution: AnnResolution
  page: number
  pageSize: number
  includeTrend: boolean
  filters: ParsedHistoryFilters
}) {
  const fieldResultsCache = new Map<number, AnnFieldResult[]>()
  const getFields = (record: SummaryRecord) => {
    const cached = fieldResultsCache.get(record.id)
    if (cached) {
      return cached
    }

    const parsed = parseStoredFieldResults(record.fieldResults)
    fieldResultsCache.set(record.id, parsed)
    return parsed
  }

  const filtered = applyHistoryFilters(args.records, args.filters, getFields)
  const ordered = [...filtered].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const newestFirstRuns = [...ordered]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  const totalRuns = newestFirstRuns.length
  const totalPages = Math.max(1, Math.ceil(totalRuns / args.pageSize))
  const page = Math.min(Math.max(args.page, 1), totalPages)
  const startIndex = (page - 1) * args.pageSize
  const endIndex = startIndex + args.pageSize

  const historyRuns = newestFirstRuns
    .slice(startIndex, endIndex)
    .map((record) => toAnnRunSummary(record, getFields(record)))

  const resolutionMs = resolutionToMs(args.resolution)

  const trend = args.includeTrend
    ? args.resolution === 'raw' || resolutionMs === null
      ? ordered.map((record) => buildRawTrendPoint(record, getFields(record)))
      : Array.from(
          ordered.reduce((buckets, record) => {
            const bucketStartMs =
              Math.floor(record.createdAt.getTime() / resolutionMs) * resolutionMs
            const accumulator =
              buckets.get(bucketStartMs) ?? createTrendAccumulator(bucketStartMs, record)

            accumulateTrendPoint(accumulator, record, getFields(record))
            buckets.set(bucketStartMs, accumulator)

            return buckets
          }, new Map<number, TrendAccumulator>()),
        )
          .sort((a, b) => a[0] - b[0])
          .map(([, accumulator]) => finalizeTrendAccumulator(accumulator, args.resolution))
    : []

  return {
    meta: {
      range: args.range,
      resolution: args.resolution,
      totalRuns,
      historyLimit: args.pageSize,
      page,
      pageSize: args.pageSize,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
      includeTrend: args.includeTrend,
      generatedAt: new Date().toISOString(),
      activeFilters: {
        overallResult: args.filters.overallResult ?? null,
        sensorResult: args.filters.sensorResult ?? null,
        weatherMismatch: args.filters.weatherMismatch ?? null,
        fieldGroup: args.filters.fieldGroup ?? null,
        relayApplied: args.filters.relayApplied ?? null,
      },
    },
    runs: historyRuns,
    trend,
  }
}
