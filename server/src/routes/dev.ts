import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import {
  inferAnnFieldGroup,
  toAnnPredictionCreateData,
  type ParsedAnnPredictionPayload,
} from '../lib/annPrediction.js'
import { prisma } from '../lib/prisma.js'
import { AuthRequest, requireAuth } from '../middleware/requireAuth.js'

type DemoPreset = 'quick' | 'demo' | 'extended'

type PresetConfig = {
  pointsPerPanel: number
  stepMinutes: number
}

type ResetTarget = 'fixed' | 'conventional' | 'ann' | 'all'

type PanelDeleteCounts = {
  fixed: number
  conventional: number
  annLegacy: number
  annRuns: number
  total: number
}

const PRESETS: Record<DemoPreset, PresetConfig> = {
  quick: { pointsPerPanel: 96, stepMinutes: 15 },
  demo: { pointsPerPanel: 240, stepMinutes: 30 },
  extended: { pointsPerPanel: 420, stepMinutes: 30 },
}

const router = Router()

const RESET_TARGETS: ReadonlySet<ResetTarget> = new Set(['fixed', 'conventional', 'ann', 'all'])

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function round(value: number, decimals = 3) {
  const multiplier = 10 ** decimals
  return Math.round(value * multiplier) / multiplier
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function daylightFactorAt(date: Date) {
  const hour = date.getHours() + date.getMinutes() / 60
  const sun = Math.sin(((hour - 6) / 12) * Math.PI)
  return clamp(sun, 0, 1)
}

function relayState(value: number) {
  return {
    value,
    state: value === 1 ? 'ON' : 'OFF',
  }
}

function minutePrecisionIso(date: Date) {
  return new Date(Math.round(date.getTime() / 60_000) * 60_000).toISOString()
}

type DemoSampleSource = {
  voltage: number
  current: number
  power: number
  axisX: number
  axisY: number
  axisZ: number
  ldrTop: number
  ldrBottom: number
  ldrLeft: number
  ldrRight: number
}

function buildDemoAnnSample(
  source: DemoSampleSource,
  driftFactor: number,
  sampleNo?: number,
): ParsedAnnPredictionPayload['samples']['history'][number] {
  const ldrTopValue = source.ldrTop === 1 ? randomBetween(930, 1220) : randomBetween(120, 360)
  const ldrBottomValue = source.ldrBottom === 1 ? randomBetween(930, 1220) : randomBetween(120, 360)
  const ldrLeftValue = source.ldrLeft === 1 ? randomBetween(910, 1180) : randomBetween(150, 390)
  const ldrRightValue = source.ldrRight === 1 ? randomBetween(910, 1180) : randomBetween(150, 390)

  const normalizedCurrentMa = source.current * 1000
  const normalizedPowerMw = source.power * 1000

  return {
    ...(typeof sampleNo === 'number' ? { sampleNo } : {}),
    ldr1: round(ldrTopValue * driftFactor + randomBetween(-18, 18), 2),
    ldr2: round(ldrBottomValue * driftFactor + randomBetween(-18, 18), 2),
    ldr3: round(ldrLeftValue * driftFactor + randomBetween(-16, 16), 2),
    ldr4: round(ldrRightValue * driftFactor + randomBetween(-16, 16), 2),
    accX: round((3800 + source.axisX * 22) * driftFactor + randomBetween(-45, 45), 2),
    accY: round((5200 + source.axisY * 19) * driftFactor + randomBetween(-45, 45), 2),
    accZ: round((-14100 + source.axisZ * 210) * driftFactor + randomBetween(-40, 40), 2),
    gyroX: round((-260 + source.axisX * 1.7) * driftFactor + randomBetween(-9, 9), 2),
    gyroY: round((220 + source.axisY * 2.1) * driftFactor + randomBetween(-9, 9), 2),
    gyroZ: round((130 + source.axisZ * 18) * driftFactor + randomBetween(-8, 8), 2),
    voltage: round(source.voltage * driftFactor + randomBetween(-0.05, 0.05), 2),
    currentMa: round(normalizedCurrentMa * driftFactor + randomBetween(-25, 25), 2),
    powerMw: round(normalizedPowerMw * driftFactor + randomBetween(-20, 20), 2),
    relay1: relayState(source.ldrTop === 1 ? 1 : 0),
    relay2: relayState(source.ldrBottom === 1 ? 1 : 0),
    relay3: relayState(source.ldrLeft === 1 ? 1 : 0),
    relay4: relayState(source.ldrRight === 1 ? 1 : 0),
  }
}

function buildAnnFieldResults(
  predicted: ParsedAnnPredictionPayload['samples']['predictedNext'],
  actual: ParsedAnnPredictionPayload['samples']['actualNext'],
) {
  const comparisons: Array<[string, number, number, number]> = [
    ['LDR1', predicted.ldr1, actual.ldr1, 60],
    ['LDR2', predicted.ldr2, actual.ldr2, 60],
    ['LDR3', predicted.ldr3, actual.ldr3, 60],
    ['LDR4', predicted.ldr4, actual.ldr4, 60],
    ['ACCX', predicted.accX, actual.accX, 1500],
    ['ACCY', predicted.accY, actual.accY, 1500],
    ['ACCZ', predicted.accZ, actual.accZ, 1500],
    ['GYROX', predicted.gyroX, actual.gyroX, 120],
    ['GYROY', predicted.gyroY, actual.gyroY, 120],
    ['GYROZ', predicted.gyroZ, actual.gyroZ, 120],
    ['VOLTAGE', predicted.voltage, actual.voltage, 1.5],
    ['CURRENT_MA', predicted.currentMa, actual.currentMa, 55],
    ['POWER_MW', predicted.powerMw, actual.powerMw, 100],
    ['RELAY1', predicted.relay1.value, actual.relay1.value, 0],
    ['RELAY2', predicted.relay2.value, actual.relay2.value, 0],
    ['RELAY3', predicted.relay3.value, actual.relay3.value, 0],
    ['RELAY4', predicted.relay4.value, actual.relay4.value, 0],
  ]

  return comparisons.map(([name, predictedValue, actualValue, tolerance]) => {
    const difference = round(Math.abs(predictedValue - actualValue), 2)
    const status = difference <= tolerance ? 'OK' : 'MISMATCH'

    return {
      name,
      group: inferAnnFieldGroup(name),
      predicted: round(predictedValue, 2),
      actual: round(actualValue, 2),
      difference,
      tolerance,
      status,
    }
  })
}

async function clearPanelLogs(target: ResetTarget): Promise<PanelDeleteCounts> {
  if (target === 'fixed') {
    const fixed = await prisma.fixedReading.deleteMany({})
    return {
      fixed: fixed.count,
      conventional: 0,
      annLegacy: 0,
      annRuns: 0,
      total: fixed.count,
    }
  }

  if (target === 'conventional') {
    const conventional = await prisma.conventionalReading.deleteMany({})
    return {
      fixed: 0,
      conventional: conventional.count,
      annLegacy: 0,
      annRuns: 0,
      total: conventional.count,
    }
  }

  if (target === 'ann') {
    const [annLegacy, annRuns] = await prisma.$transaction([
      prisma.annReading.deleteMany({}),
      prisma.annPredictionRun.deleteMany({}),
    ])

    return {
      fixed: 0,
      conventional: 0,
      annLegacy: annLegacy.count,
      annRuns: annRuns.count,
      total: annLegacy.count + annRuns.count,
    }
  }

  const [fixed, conventional, annLegacy, annRuns] = await prisma.$transaction([
    prisma.fixedReading.deleteMany({}),
    prisma.conventionalReading.deleteMany({}),
    prisma.annReading.deleteMany({}),
    prisma.annPredictionRun.deleteMany({}),
  ])

  return {
    fixed: fixed.count,
    conventional: conventional.count,
    annLegacy: annLegacy.count,
    annRuns: annRuns.count,
    total: fixed.count + conventional.count + annLegacy.count + annRuns.count,
  }
}

router.post('/generate-demo', requireAuth, async (req: AuthRequest, res) => {
  const body = (req.body ?? {}) as { preset?: DemoPreset }
  const preset = body.preset ?? 'demo'

  if (!(preset in PRESETS)) {
    return res.status(400).json({
      message: 'preset must be one of: quick, demo, extended',
    })
  }

  const config = PRESETS[preset]
  const stepHours = config.stepMinutes / 60

  const [latestFixed, latestConventional, latestAnnLegacy] = await Promise.all([
    prisma.fixedReading.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { cumulativeEnergyKwh: true },
    }),
    prisma.conventionalReading.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { cumulativeEnergyKwh: true },
    }),
    prisma.annReading.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { cumulativeEnergyKwh: true },
    }),
  ])

  let fixedCumulative = latestFixed?.cumulativeEnergyKwh ?? 0
  let conventionalCumulative = latestConventional?.cumulativeEnergyKwh ?? 0
  let annCumulative = latestAnnLegacy?.cumulativeEnergyKwh ?? 0

  const now = Date.now()
  const start = now - config.pointsPerPanel * config.stepMinutes * 60_000

  const fixedRows: Array<{
    voltage: number
    current: number
    power: number
    createdAt: Date
    energyKwh: number
    cumulativeEnergyKwh: number
  }> = []

  const conventionalRows: Array<{
    voltage: number
    current: number
    power: number
    axisX: number
    axisY: number
    axisZ: number
    ldrTop: number
    ldrBottom: number
    ldrLeft: number
    ldrRight: number
    createdAt: Date
    energyKwh: number
    cumulativeEnergyKwh: number
  }> = []

  const annRows: Array<{
    voltage: number
    current: number
    power: number
    axisX: number
    axisY: number
    axisZ: number
    ldrTop: number
    ldrBottom: number
    ldrLeft: number
    ldrRight: number
    createdAt: Date
    energyKwh: number
    cumulativeEnergyKwh: number
  }> = []

  const annRunRows: Prisma.AnnPredictionRunCreateManyInput[] = []

  for (let index = 0; index < config.pointsPerPanel; index += 1) {
    const createdAt = new Date(start + index * config.stepMinutes * 60_000)
    const daylight = daylightFactorAt(createdAt)
    const weather = randomBetween(0.72, 1.04)

    const fixedVoltage = round(randomBetween(12.1, 14.4), 3)
    const fixedBasePower = Math.max(0.15, daylight * weather * randomBetween(28, 46) + randomBetween(-1.4, 1.4))
    const fixedPower = round(fixedBasePower, 3)
    const fixedCurrent = round(Math.max(0.02, fixedPower / fixedVoltage), 3)
    const fixedEnergy = round((fixedPower * stepHours) / 1000, 6)
    fixedCumulative = round(fixedCumulative + fixedEnergy, 6)

    fixedRows.push({
      voltage: fixedVoltage,
      current: fixedCurrent,
      power: fixedPower,
      createdAt,
      energyKwh: fixedEnergy,
      cumulativeEnergyKwh: fixedCumulative,
    })

    const sunHour = createdAt.getHours() + createdAt.getMinutes() / 60
    const azimuthCurve = ((sunHour - 12) / 6) * 70
    const elevationCurve = daylight * 72

    const conventionalBoost = randomBetween(1.05, 1.14)
    const conventionalVoltage = round(randomBetween(12.2, 14.7), 3)
    const conventionalPower = round(Math.max(0.2, fixedPower * conventionalBoost + randomBetween(-0.7, 1.1)), 3)
    const conventionalCurrent = round(Math.max(0.02, conventionalPower / conventionalVoltage), 3)
    const conventionalEnergy = round((conventionalPower * stepHours) / 1000, 6)
    conventionalCumulative = round(conventionalCumulative + conventionalEnergy, 6)

    const conventionalAxisX = round(clamp(elevationCurve + randomBetween(-4, 4), 5, 88), 2)
    const conventionalAxisY = round(clamp(azimuthCurve + randomBetween(-6, 6), -90, 90), 2)
    const conventionalAxisZ = round(randomBetween(-1.2, 1.2), 2)

    conventionalRows.push({
      voltage: conventionalVoltage,
      current: conventionalCurrent,
      power: conventionalPower,
      axisX: conventionalAxisX,
      axisY: conventionalAxisY,
      axisZ: conventionalAxisZ,
      ldrTop: daylight > 0.58 ? 1 : 0,
      ldrBottom: daylight > 0.58 ? 0 : 1,
      ldrLeft: conventionalAxisY < 0 ? 1 : 0,
      ldrRight: conventionalAxisY >= 0 ? 1 : 0,
      createdAt,
      energyKwh: conventionalEnergy,
      cumulativeEnergyKwh: conventionalCumulative,
    })

    const annBoost = randomBetween(1.12, 1.24)
    const annVoltage = round(randomBetween(12.3, 14.9), 3)
    const annPower = round(Math.max(0.25, fixedPower * annBoost + randomBetween(-0.5, 1.5)), 3)
    const annCurrent = round(Math.max(0.02, annPower / annVoltage), 3)
    const annEnergy = round((annPower * stepHours) / 1000, 6)
    annCumulative = round(annCumulative + annEnergy, 6)

    const annAxisX = round(clamp(elevationCurve + randomBetween(-2.5, 2.5), 8, 89), 2)
    const annAxisY = round(clamp(azimuthCurve + randomBetween(-3.5, 3.5), -85, 85), 2)
    const annAxisZ = round(randomBetween(-0.8, 0.8), 2)

    annRows.push({
      voltage: annVoltage,
      current: annCurrent,
      power: annPower,
      axisX: annAxisX,
      axisY: annAxisY,
      axisZ: annAxisZ,
      ldrTop: daylight > 0.52 ? 1 : 0,
      ldrBottom: daylight > 0.52 ? 0 : 1,
      ldrLeft: annAxisY < 0 ? 1 : 0,
      ldrRight: annAxisY >= 0 ? 1 : 0,
      createdAt,
      energyKwh: annEnergy,
      cumulativeEnergyKwh: annCumulative,
    })

    const annSampleSource: DemoSampleSource = {
      voltage: annVoltage,
      current: annCurrent,
      power: annPower,
      axisX: annAxisX,
      axisY: annAxisY,
      axisZ: annAxisZ,
      ldrTop: daylight > 0.52 ? 1 : 0,
      ldrBottom: daylight > 0.52 ? 0 : 1,
      ldrLeft: annAxisY < 0 ? 1 : 0,
      ldrRight: annAxisY >= 0 ? 1 : 0,
    }

    const historySamples = [
      buildDemoAnnSample(annSampleSource, 0.94, 1),
      buildDemoAnnSample(annSampleSource, 0.97, 2),
      buildDemoAnnSample(annSampleSource, 1.01, 3),
      buildDemoAnnSample(annSampleSource, 1.04, 4),
    ]

    const predictedNext = buildDemoAnnSample(annSampleSource, 1.08)
    const actualDrift = index % 8 === 0 ? 0.92 : 1.03
    const actualNext = buildDemoAnnSample(annSampleSource, actualDrift)

    const fieldResults = buildAnnFieldResults(predictedNext, actualNext)
    const mismatchCount = fieldResults.filter((field) => field.status !== 'OK').length
    const sensorResult = mismatchCount === 0 ? 'CORRECT' : 'INCORRECT'

    const weatherCode = daylight > 0.66 ? 1 : daylight > 0.4 ? 2 : 3
    const predictedTemp = round(26 + daylight * 9 + randomBetween(-0.6, 0.6), 1)
    const predictedHumidity = Math.round(clamp(78 - daylight * 22 + randomBetween(-3, 3), 48, 93))

    const weatherMismatch = index % 10 === 0
    const actualWeatherCode = weatherMismatch ? (weatherCode === 1 ? 2 : 1) : weatherCode
    const actualTemp = round(predictedTemp + (weatherMismatch ? 1.8 : randomBetween(-0.4, 0.4)), 1)
    const actualHumidity = Math.round(
      clamp(predictedHumidity + (weatherMismatch ? 7 : randomBetween(-2, 2)), 45, 95),
    )

    const predictedWeather = {
      timestamp: minutePrecisionIso(createdAt),
      hour: createdAt.getHours(),
      weatherCode,
      weather: weatherCode === 1 ? 'Mainly clear' : weatherCode === 2 ? 'Partly cloudy' : 'Overcast',
      temperatureC: predictedTemp,
      humidity: predictedHumidity,
    }

    const actualWeather = {
      timestamp: minutePrecisionIso(createdAt),
      hour: createdAt.getHours(),
      weatherCode: actualWeatherCode,
      weather:
        actualWeatherCode === 1
          ? 'Mainly clear'
          : actualWeatherCode === 2
            ? 'Partly cloudy'
            : 'Overcast',
      temperatureC: actualTemp,
      humidity: actualHumidity,
    }

    const weatherCheck = {
      weatherCodeResult: predictedWeather.weatherCode === actualWeather.weatherCode ? 'CORRECT' : 'INCORRECT',
      timeResult: predictedWeather.hour === actualWeather.hour ? 'CORRECT' : 'INCORRECT',
      tempResult: Math.abs(predictedWeather.temperatureC - actualWeather.temperatureC) <= 1 ? 'CORRECT' : 'INCORRECT',
      humidityResult: Math.abs(predictedWeather.humidity - actualWeather.humidity) <= 4 ? 'CORRECT' : 'INCORRECT',
    }

    const weatherMatchCount = Object.values(weatherCheck).filter((status) => status === 'CORRECT').length
    const overallResult =
      sensorResult === 'CORRECT' && weatherMatchCount === 4 ? 'CORRECT' : 'INCORRECT'
    const relayApplied = index % 4 === 0

    const annPayload: ParsedAnnPredictionPayload = {
      deviceId: 'demo-ann-panel',
      predictionId: index + 1,
      verifiedId: index,
      timestamp: createdAt.toISOString(),
      source: 'dev-generator',
      mode: 'predictive',
      weather: {
        predicted: predictedWeather,
        actual: actualWeather,
        check: weatherCheck,
      },
      samples: {
        history: historySamples,
        predictedNext,
        actualNext,
      },
      predictionCheck: {
        sensorResult,
        overallResult,
        fields: fieldResults,
      },
      relayMemory: {
        applied: relayApplied,
        message: relayApplied
          ? 'Applied relay memory state from previous sample window'
          : 'No relay memory payload provided',
      },
      rawPayload: {
        setId: index + 1,
        samples: historySamples,
        predictedWeather: {
          ...predictedWeather,
          tempC: predictedWeather.temperatureC,
          humidityPct: predictedWeather.humidity,
        },
        predictedNextSample: predictedNext,
        actualWeather: {
          ...actualWeather,
          tempC: actualWeather.temperatureC,
          humidityPct: actualWeather.humidity,
        },
        actualNextSample: actualNext,
        weatherCheck,
        predictionCheck: {
          sensorResult: sensorResult === 'CORRECT' ? 'CORRECT' : 'NOT CORRECT',
          overallResult: overallResult === 'CORRECT' ? 'CORRECT' : 'NOT CORRECT',
          details: fieldResults.map((field) => ({
            field: field.name,
            predicted: field.predicted,
            actual: field.actual,
            diff: field.difference,
            tol: field.tolerance,
            result: field.status === 'OK' ? 'OK' : 'NO',
          })),
        },
      },
    }

    annRunRows.push(
      toAnnPredictionCreateData(annPayload) as unknown as Prisma.AnnPredictionRunCreateManyInput,
    )
  }

  await prisma.$transaction([
    prisma.fixedReading.createMany({ data: fixedRows }),
    prisma.conventionalReading.createMany({ data: conventionalRows }),
    prisma.annReading.createMany({ data: annRows }),
    prisma.annPredictionRun.createMany({ data: annRunRows }),
  ])

  return res.status(201).json({
    message: 'Demo dataset generated',
    preset,
    pointsPerPanel: config.pointsPerPanel,
    inserted: {
      fixed: fixedRows.length,
      conventional: conventionalRows.length,
      ann: annRunRows.length,
      annLegacy: annRows.length,
      total: fixedRows.length + conventionalRows.length + annRunRows.length,
    },
    range: {
      from: fixedRows[0]?.createdAt ?? null,
      to: fixedRows[fixedRows.length - 1]?.createdAt ?? null,
      stepMinutes: config.stepMinutes,
    },
  })
})

router.delete('/panel-logs/:panel', requireAuth, async (req: AuthRequest, res) => {
  const panel = String(req.params.panel ?? '').toLowerCase()

  if (!RESET_TARGETS.has(panel as ResetTarget)) {
    return res.status(400).json({
      message: 'panel must be one of: fixed, conventional, ann, all',
    })
  }

  const target = panel as ResetTarget
  const deleted = await clearPanelLogs(target)

  return res.json({
    message: target === 'all' ? 'All panel logs cleared' : `${target} panel logs cleared`,
    target,
    deleted,
  })
})

router.delete('/panel-logs', requireAuth, async (_req: AuthRequest, res) => {
  const deleted = await clearPanelLogs('all')

  return res.json({
    message: 'All panel logs cleared',
    target: 'all',
    deleted,
  })
})

export default router
