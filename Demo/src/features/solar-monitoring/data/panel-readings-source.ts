export type RawFixedReading = {
  id: number
  voltage: number
  current: number
  power: number
  createdAt: string
}

export type RawTrackerReading = RawFixedReading & {
  axisX: number
  axisY: number
  axisZ: number
  ldrTop: number
  ldrBottom: number
  ldrLeft: number
  ldrRight: number
}

export type PaginationInfo = {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasPrev: boolean
  hasNext: boolean
}

export type PaginatedResult<T> = {
  items: T[]
  pagination: PaginationInfo
}

const INTERVAL_MINUTES = 15
const DAYS_OF_HISTORY = 18
const READINGS_PER_DAY = (24 * 60) / INTERVAL_MINUTES
const READING_COUNT = DAYS_OF_HISTORY * READINGS_PER_DAY

const FIXED_PEAK_POWER = 322
const CONVENTIONAL_PEAK_POWER = 356

function round(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function dayCurve(hourFloat: number) {
  const sunrise = 5.6
  const sunset = 18.6

  if (hourFloat <= sunrise || hourFloat >= sunset) {
    return 0
  }

  const t = (hourFloat - sunrise) / (sunset - sunrise)
  return Math.sin(Math.PI * t)
}

export function estimateIrradianceForTimestamp(at: Date) {
  const hourFloat = at.getHours() + at.getMinutes() / 60
  const curve = dayCurve(hourFloat)
  return Math.round(curve * 950)
}

export function estimateTemperatureForTimestamp(at: Date) {
  const hourFloat = at.getHours() + at.getMinutes() / 60
  const curve = dayCurve(hourFloat)
  return round(24 + curve * 9, 1)
}

export function estimateHumidityForTimestamp(at: Date) {
  const hourFloat = at.getHours() + at.getMinutes() / 60
  const curve = dayCurve(hourFloat)
  return Math.round(78 - curve * 22)
}

function buildDayFactors(days: number) {
  const factors: number[] = []

  for (let day = 0; day < days; day += 1) {
    const isCloudyDay = Math.random() < 0.22
    factors.push(isCloudyDay ? rand(0.52, 0.74) : rand(0.86, 1.0))
  }

  return factors
}

const dayFactors = buildDayFactors(DAYS_OF_HISTORY)
const GENERATION_TIME = Date.now()

function generateFixedReadings(): RawFixedReading[] {
  const readings: RawFixedReading[] = []
  const now = GENERATION_TIME
  const startTime = now - (READING_COUNT - 1) * INTERVAL_MINUTES * 60_000

  for (let index = 0; index < READING_COUNT; index += 1) {
    const timestampMs = startTime + index * INTERVAL_MINUTES * 60_000
    const at = new Date(timestampMs)
    const dayIndex = Math.floor(index / READINGS_PER_DAY)
    const hourFloat = at.getHours() + at.getMinutes() / 60
    const curve = dayCurve(hourFloat)
    const dayFactor = dayFactors[dayIndex] ?? 0.9

    const voltage = curve > 0 ? round(28.6 + curve * 7.8 + rand(-0.25, 0.25), 2) : round(rand(0, 1.2), 2)
    const targetPower = Math.max(0, curve * FIXED_PEAK_POWER * dayFactor + rand(-5, 5))
    const current = voltage > 1 && targetPower > 0.5 ? round(targetPower / voltage, 2) : round(rand(0, 0.03), 2)
    const power = round(voltage * current, 2)

    readings.push({
      id: index + 1,
      voltage,
      current,
      power,
      createdAt: at.toISOString(),
    })
  }

  return readings
}

function generateConventionalReadings(): RawTrackerReading[] {
  const readings: RawTrackerReading[] = []
  const now = GENERATION_TIME
  const startTime = now - (READING_COUNT - 1) * INTERVAL_MINUTES * 60_000

  let azimuth = 180
  let elevation = 0

  for (let index = 0; index < READING_COUNT; index += 1) {
    const timestampMs = startTime + index * INTERVAL_MINUTES * 60_000
    const at = new Date(timestampMs)
    const dayIndex = Math.floor(index / READINGS_PER_DAY)
    const hourFloat = at.getHours() + at.getMinutes() / 60
    const curve = dayCurve(hourFloat)
    const dayFactor = dayFactors[dayIndex] ?? 0.9

    const voltage = curve > 0 ? round(29.4 + curve * 8.6 + rand(-0.2, 0.2), 2) : round(rand(0, 1.2), 2)
    const targetPower = Math.max(0, curve * CONVENTIONAL_PEAK_POWER * dayFactor + rand(-5, 5))
    const current = voltage > 1 && targetPower > 0.5 ? round(targetPower / voltage, 2) : round(rand(0, 0.03), 2)
    const power = round(voltage * current, 2)

    if (curve > 0) {
      const targetAzimuth = 75 + curve * 210 + rand(-3, 3)
      const targetElevation = curve * 82 + rand(-2, 2)
      azimuth = azimuth + (targetAzimuth - azimuth) * 0.6
      elevation = elevation + (targetElevation - elevation) * 0.6
    } else {
      azimuth = azimuth + (180 - azimuth) * 0.1
      elevation = elevation + (0 - elevation) * 0.3
    }

    const lightDetected = curve > 0.05
    const ldrTop = lightDetected && Math.random() > 0.08 ? 1 : 0
    const ldrBottom = lightDetected && Math.random() > 0.12 ? 1 : 0
    const ldrLeft = lightDetected && Math.random() > 0.1 ? 1 : 0
    const ldrRight = lightDetected && Math.random() > 0.1 ? 1 : 0

    readings.push({
      id: index + 1,
      voltage,
      current,
      power,
      axisX: round(clamp(elevation, 0, 90), 1),
      axisY: round(((azimuth % 360) + 360) % 360, 1),
      axisZ: round(rand(-0.6, 0.6), 2),
      ldrTop,
      ldrBottom,
      ldrLeft,
      ldrRight,
      createdAt: at.toISOString(),
    })
  }

  return readings
}

export const fixedReadings: RawFixedReading[] = generateFixedReadings()
export const conventionalReadings: RawTrackerReading[] = generateConventionalReadings()

export function getLatestReading<T>(readings: T[]): T | null {
  return readings.length ? readings[readings.length - 1] : null
}

export function queryReadings<T extends { createdAt: string }>(
  all: T[],
  options: { page: number; pageSize: number; since?: Date },
): PaginatedResult<T> {
  const filtered = options.since
    ? all.filter((item) => new Date(item.createdAt).getTime() >= options.since!.getTime())
    : all

  const sortedDesc = [...filtered].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )

  const totalCount = sortedDesc.length
  const totalPages = Math.max(1, Math.ceil(totalCount / options.pageSize))
  const page = Math.min(Math.max(1, options.page), totalPages)
  const start = (page - 1) * options.pageSize
  const items = sortedDesc.slice(start, start + options.pageSize)

  return {
    items,
    pagination: {
      page,
      pageSize: options.pageSize,
      totalCount,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages,
    },
  }
}

export function getAllReadingsSince<T extends { createdAt: string }>(all: T[], since?: Date): T[] {
  const filtered = since
    ? all.filter((item) => new Date(item.createdAt).getTime() >= since.getTime())
    : all

  return [...filtered].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
}
