import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { AuthRequest, requireAuth } from '../middleware/requireAuth.js'

type DemoPreset = 'quick' | 'demo' | 'extended'

type PresetConfig = {
  pointsPerPanel: number
  stepMinutes: number
}

const PRESETS: Record<DemoPreset, PresetConfig> = {
  quick: { pointsPerPanel: 96, stepMinutes: 15 },
  demo: { pointsPerPanel: 240, stepMinutes: 30 },
  extended: { pointsPerPanel: 420, stepMinutes: 30 },
}

const router = Router()

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

  const [latestFixed, latestConventional, latestAnn] = await Promise.all([
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
  let annCumulative = latestAnn?.cumulativeEnergyKwh ?? 0

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
  }

  await prisma.$transaction([
    prisma.fixedReading.createMany({ data: fixedRows }),
    prisma.conventionalReading.createMany({ data: conventionalRows }),
    prisma.annReading.createMany({ data: annRows }),
  ])

  return res.status(201).json({
    message: 'Demo dataset generated',
    preset,
    pointsPerPanel: config.pointsPerPanel,
    inserted: {
      fixed: fixedRows.length,
      conventional: conventionalRows.length,
      ann: annRows.length,
      total: fixedRows.length + conventionalRows.length + annRows.length,
    },
    range: {
      from: fixedRows[0]?.createdAt ?? null,
      to: fixedRows[fixedRows.length - 1]?.createdAt ?? null,
      stepMinutes: config.stepMinutes,
    },
  })
})

router.delete('/panel-logs', requireAuth, async (_req: AuthRequest, res) => {
  const [fixed, conventional, ann] = await prisma.$transaction([
    prisma.fixedReading.deleteMany({}),
    prisma.conventionalReading.deleteMany({}),
    prisma.annReading.deleteMany({}),
  ])

  return res.json({
    message: 'All panel logs cleared',
    deleted: {
      fixed: fixed.count,
      conventional: conventional.count,
      ann: ann.count,
      total: fixed.count + conventional.count + ann.count,
    },
  })
})

export default router
