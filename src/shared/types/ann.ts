export type AnnRange = '1h' | '24h' | '7d' | '30d'
export type AnnResolution = 'raw' | '5m' | '1h' | '1d'
export type AnnFieldGroup =
  | 'ldr'
  | 'accelerometer'
  | 'gyroscope'
  | 'electrical'
  | 'relay'
  | 'other'

export type AnnRelayState = {
  value: number
  state: string
}

export type AnnSample = {
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
  relay1: AnnRelayState
  relay2: AnnRelayState
  relay3: AnnRelayState
  relay4: AnnRelayState
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

export type AnnWeatherSnapshot = {
  timestamp: string
  hour: number
  weatherCode: number
  weather: string
  temperatureC: number
  humidity: number
}

export type AnnRunSummary = {
  id: number
  deviceId: string
  predictionId: number | null
  verifiedId: number | null
  timestamp: string
  createdAt: string
  source: string
  mode: string
  overallResult: string
  sensorResult: string
  weatherCheck: {
    weatherCodeResult: string
    timeResult: string
    tempResult: string
    humidityResult: string
    matchCount: number
    total: number
  }
  fieldCount: number
  okCount: number
  mismatchCount: number
  accuracyPct: number
  worstField: {
    name: string
    difference: number
    tolerance: number
    ratio: number
  } | null
  relayMemory: {
    applied: boolean
    message: string | null
  }
  fields: AnnFieldResult[]
}

export type AnnRunDetail = AnnRunSummary & {
  weather: {
    predicted: AnnWeatherSnapshot
    actual: AnnWeatherSnapshot
    check: {
      weatherCodeResult: string
      timeResult: string
      tempResult: string
      humidityResult: string
    }
  }
  samples: {
    history: AnnSample[]
    predictedNext: AnnSample
    actualNext: AnnSample
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

export type AnnTrendFieldStat = {
  predicted: number
  actual: number
  difference: number
  tolerance: number
  okCount: number
  mismatchCount: number
  runCount: number
}

export type AnnTrendPoint = {
  timestamp: string
  label: string
  runCount: number
  latestRunId: number
  latestRunTimestamp: string
  accuracyPct: number
  overallCorrectPct: number
  sensorCorrectPct: number
  weatherCodePassPct: number
  timePassPct: number
  tempPassPct: number
  humidityPassPct: number
  mismatchGroups: Record<AnnFieldGroup, number>
  fieldStats: Record<string, AnnTrendFieldStat>
}

export type AnnFieldSummary = {
  name: string
  group: AnnFieldGroup
  sampleCount: number
  okCount: number
  mismatchCount: number
  passRatePct: number
  predictedAvg: number
  actualAvg: number
  differenceAvg: number
  toleranceAvg: number
  worstDifference: number
  worstRatio: number
}

export type AnnHistoryResponse = {
  meta: {
    range: AnnRange
    resolution: AnnResolution
    totalRuns: number
    historyLimit: number
    page: number
    pageSize: number
    totalPages: number
    hasPrev: boolean
    hasNext: boolean
    includeTrend: boolean
    generatedAt: string
    timeFilter: {
      startAt: string
      endAt: string
      custom: boolean
    }
    activeFilters: {
      overallResult: string | null
      sensorResult: string | null
      weatherMismatch: boolean | null
      fieldGroup: AnnFieldGroup | null
      relayApplied: boolean | null
      startAt: string | null
      endAt: string | null
    }
  }
  runs: AnnRunSummary[]
  trend: AnnTrendPoint[]
  fieldSummary: AnnFieldSummary[]
}
