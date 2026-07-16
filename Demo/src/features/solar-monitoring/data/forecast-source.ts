export type ForecastSeries = {
  times: number[]
  weatherCodes: number[]
}

const HOURLY_PATTERN = [0, 0, 0, 1, 1, 2, 3, 1, 0, 0, 61, 61, 2, 1, 0, 0, 0, 1, 2, 0, 0, 0, 1, 0]

function buildForecastSeries(): ForecastSeries {
  const times: number[] = []
  const weatherCodes: number[] = []
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)

  for (let hourOffset = 0; hourOffset < 24 * 7; hourOffset += 1) {
    const at = new Date(start.getTime() + hourOffset * 3_600_000)
    times.push(at.getTime())

    const dayIndex = Math.floor(hourOffset / 24)
    const hourOfDay = hourOffset % 24
    const base = HOURLY_PATTERN[hourOfDay] ?? 1
    const dayShift = dayIndex % 3 === 2 ? 1 : 0
    weatherCodes.push(base + dayShift)
  }

  return { times, weatherCodes }
}

let cachedForecast: ForecastSeries | null = null

export function getStaticForecastSeries(): ForecastSeries {
  if (!cachedForecast) {
    cachedForecast = buildForecastSeries()
  }

  return cachedForecast
}
