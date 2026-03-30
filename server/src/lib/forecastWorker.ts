import { publishForecast } from './mqtt.js'

// Manila coordinates (same as usePanelTrackerData)
const FORECAST_LATITUDE = 14.5995
const FORECAST_LONGITUDE = 120.9842
const FORECAST_TIMEZONE = 'Asia/Manila'

// Weather code mappings (Philippines-focused)
const WEATHER_LABELS: Record<number, string> = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Cloudy',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  80: 'Light showers',
  81: 'Showers',
  82: 'Strong showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with light hail',
  99: 'Thunderstorm with heavy hail',
}

type ForecastResponse = {
  latitude: number
  longitude: number
  timezone: string
  hourly?: {
    time?: string[]
    weathercode?: number[]
    temperature_2m?: number[]
    relative_humidity_2m?: number[]
    windspeed_10m?: number[]
  }
}

export async function fetchAndPublishForecast(): Promise<void> {
  try {
    // Fetch from Open-Meteo
    const url =
      `https://api.open-meteo.com/v1/forecast?` +
      `latitude=${FORECAST_LATITUDE}` +
      `&longitude=${FORECAST_LONGITUDE}` +
      `&hourly=weathercode,temperature_2m,relative_humidity_2m,windspeed_10m` +
      `&timezone=${FORECAST_TIMEZONE}` +
      `&forecast_days=1`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`)
    }

    const data = (await response.json()) as ForecastResponse

    // Extract current hour (index 0 is now, assuming timezone=auto aligns correctly)
    const time = data.hourly?.time ?? []
    const weathercode = data.hourly?.weathercode ?? []
    const temperature = data.hourly?.temperature_2m ?? []
    const humidity = data.hourly?.relative_humidity_2m ?? []
    const windspeed = data.hourly?.windspeed_10m ?? []

    if (!time.length || time.length === 0) {
      throw new Error('No forecast data returned')
    }

    // Get current hour (first element)
    const thisHourIndex = 0
    const timestamp = time[thisHourIndex]
    const code = weathercode[thisHourIndex] ?? -1
    const label = WEATHER_LABELS[code] || 'Unknown'
    const tempC = temperature[thisHourIndex] ?? 0
    const humidityPct = humidity[thisHourIndex] ?? 0
    const windKph = windspeed[thisHourIndex] ?? 0

    // Build payload matching device expectations
    const payload = {
      timestamp,
      hour: new Date(timestamp).getHours(),
      weatherCode: code,
      weatherLabel: label,
      tempC: Math.round(tempC * 10) / 10,
      humidityPct: Math.round(humidityPct),
      windKph: Math.round(windKph * 10) / 10,
    }

    // Publish to MQTT
    await publishForecast(payload)

    console.log('[Forecast] Published hourly update:', payload)
  } catch (error) {
    console.error('[Forecast] Error:', error instanceof Error ? error.message : String(error))
    // Do not throw—allow worker to continue on error
  }
}

export function scheduleHourlyForecast(): ReturnType<typeof setInterval> {
  // Publish immediately on startup
  void fetchAndPublishForecast()

  // Schedule hourly updates
  const handle = setInterval(() => {
    void fetchAndPublishForecast()
  }, 60 * 60 * 1000) // 1 hour

  console.log('[Forecast] Scheduled hourly updates')
  return handle
}
