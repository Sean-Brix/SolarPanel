export type TimeRange = 'live' | 'hourly' | 'daily' | 'weekly'
export type Severity = 'normal' | 'warning' | 'critical'
export type PanelKey = 'fixed' | 'conventional' | 'ann'
export type TrendDirection = 'up' | 'down' | 'steady'

export interface MetricSnapshot {
  voltage: number
  current: number
  power: number
  energyToday: number
  efficiency: number
  peakPower: number
  movementEnergy?: number
  temperature?: number
  humidity?: number
  irradiance?: number
}

export interface TimeSeriesPoint {
  label: string
  voltage: number
  current: number
  power: number
  energy: number
  efficiency?: number
  irradiance?: number
  predictedPower?: number
  movementCount?: number
  movementCost?: number
}

export interface EnergyPoint {
  label: string
  energy: number
  cumulative: number
}

export interface TimelineEntry {
  time: string
  title: string
  detail: string
  type: 'metric' | 'movement' | 'system' | 'forecast'
}

export interface TrackerStatus {
  azimuth: number
  elevation: number
  heading: string
  mode: string
  movementCount: number
  travelDegrees: number
  nextAdjustment: string
}

export interface PredictionInsight {
  label: string
  value: string
  context: string
  confidence: number
  trend: TrendDirection
}

export interface IntelligenceState {
  predictionAccuracy: number
  movementSavings: number
  projectedEnergy: number
  adaptiveMode: string
  predictions: PredictionInsight[]
}

export interface PanelRecord {
  key: PanelKey
  name: string
  shortName: string
  description: string
  status: string
  summary: string
  connection: string
  metrics: MetricSnapshot
  ranges: Record<TimeRange, TimeSeriesPoint[]>
  energy: Record<'hourly' | 'daily' | 'weekly', EnergyPoint[]>
  timeline: TimelineEntry[]
  tracker?: TrackerStatus
  intelligence?: IntelligenceState
}

export interface EnvironmentSnapshot {
  temperature: number
  humidity: number
  irradiance: number
  windKph: number
  condition: string
  sunlightIndex: number
}

export interface WeatherCurrent {
  condition: string
  summary: string
  temp: number
  sunrise: string
  sunset: string
  uv: string
  cloudiness: number
}

export interface WeatherForecast {
  day: string
  condition: string
  sunlight: number
  cloudiness: number
  confidence: number
}

export interface WeatherPayload {
  current: WeatherCurrent
  forecast: WeatherForecast[]
}

export interface NotificationRecord {
  id: string
  title: string
  message: string
  severity: Severity
  time: string
  source: string
}

export interface HistoryRow {
  timestamp: string
  panel: PanelKey
  voltage: number
  current: number
  power: number
  energy: number
  azimuth?: number
  elevation?: number
  forecast?: string
  status: string
}

export interface ComparisonSummary {
  panel: PanelKey
  currentPower: number
  energyToday: number
  efficiency: number
  status: string
  movementFrequency: string
}

export interface ComparisonMetricRow {
  metric: string
  fixed: string
  conventional: string
  ann: string
  emphasis?: PanelKey
}

export interface Insight {
  title: string
  detail: string
  tone: 'success' | 'info' | 'warning'
}

export interface Ranking {
  label: string
  winner: PanelKey
  reason: string
}

export interface ComparisonPayload {
  summaries: ComparisonSummary[]
  table: ComparisonMetricRow[]
  insights: Insight[]
  rankings: Ranking[]
}
