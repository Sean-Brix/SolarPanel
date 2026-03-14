import { Router } from 'express'
import { PrismaClient } from '@prisma/client'

const router = Router()
const prisma = new PrismaClient()

/**
 * POST /api/ann
 * ESP32 pushes a new ANN panel reading.
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

  const reading = await prisma.annReading.create({
    data: { voltage, current, power, axisX, axisY, axisZ, ldrTop, ldrBottom, ldrLeft, ldrRight },
  })

  return res.status(201).json(reading)
})

/**
 * GET /api/ann/latest
 * Returns the most recent ANN panel reading.
 */
router.get('/latest', async (_req, res) => {
  const reading = await prisma.annReading.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  if (!reading) {
    return res.status(404).json({ message: 'No readings found' })
  }

  return res.json(reading)
})

/**
 * GET /api/ann/history?limit=50&since=ISO_DATE
 * Returns recent ANN panel readings, newest first.
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

  const readings = await prisma.annReading.findMany({
    where: since ? { createdAt: { gte: since } } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return res.json(readings)
})

export default router
