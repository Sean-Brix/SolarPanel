import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

/**
 * POST /api/conventional
 * ESP32 pushes a new Conventional panel reading.
 * Body: {
 *   voltage: number, current: number, power: number,
 *   axisX: number, axisY: number, axisZ: number,
 *   ldrTop: 0|1, ldrBottom: 0|1, ldrLeft: 0|1, ldrRight: 0|1
 * }
 */
router.post('/', async (req, res) => {
  const { voltage, current, power, axisX, axisY, axisZ, ldrTop, ldrBottom, ldrLeft, ldrRight } =
    req.body

  if (
    typeof voltage !== 'number' ||
    typeof current !== 'number' ||
    typeof power !== 'number' ||
    typeof axisX !== 'number' ||
    typeof axisY !== 'number' ||
    typeof axisZ !== 'number' ||
    ![0, 1].includes(ldrTop) ||
    ![0, 1].includes(ldrBottom) ||
    ![0, 1].includes(ldrLeft) ||
    ![0, 1].includes(ldrRight)
  ) {
    return res.status(400).json({
      message:
        'voltage, current, power, axisX, axisY, axisZ are required numbers; ldrTop/Bottom/Left/Right must be 0 or 1',
    })
  }

  const now = new Date()
  const previous = await prisma.conventionalReading.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, cumulativeEnergyKwh: true },
  })

  const deltaHours = previous
    ? Math.max((now.getTime() - previous.createdAt.getTime()) / 3_600_000, 0)
    : 1 / 60

  const computedPower = voltage * current
  const effectivePower = power > 0 ? (power + computedPower) / 2 : computedPower
  const energyKwh = Number(((effectivePower * deltaHours) / 1000).toFixed(6))
  const cumulativeEnergyKwh = Number(((previous?.cumulativeEnergyKwh ?? 0) + energyKwh).toFixed(6))

  const reading = await prisma.conventionalReading.create({
    data: {
      voltage,
      current,
      power,
      energyKwh,
      cumulativeEnergyKwh,
      axisX,
      axisY,
      axisZ,
      ldrTop,
      ldrBottom,
      ldrLeft,
      ldrRight,
    },
  })

  return res.status(201).json(reading)
})

/**
 * GET /api/conventional/latest
 * Returns the most recent Conventional panel reading.
 */
router.get('/latest', async (_req, res) => {
  const reading = await prisma.conventionalReading.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  if (!reading) {
    return res.status(404).json({ message: 'No readings found' })
  }

  return res.json(reading)
})

/**
 * GET /api/conventional/history?limit=50&since=ISO_DATE
 * Returns recent Conventional panel readings, newest first.
 * Query params:
 *   limit  – max records to return (default 50, max 500)
 *   since  – ISO 8601 date string; only return records after this timestamp
 */
router.get('/history', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 500)
  const since = typeof req.query.since === 'string' ? new Date(req.query.since) : undefined

  if (Number.isNaN(limit) || limit < 1) {
    return res.status(400).json({ message: 'limit must be a positive integer' })
  }

  if (since && isNaN(since.getTime())) {
    return res.status(400).json({ message: 'since must be a valid ISO 8601 date string' })
  }

  const readings = await prisma.conventionalReading.findMany({
    where: since ? { createdAt: { gte: since } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return res.json(readings)
})

export default router
