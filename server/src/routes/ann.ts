import { Router } from 'express'
import { enqueueWrite } from '../lib/writeQueue.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
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
  const payload = Array.isArray(req.body) ? req.body : [req.body]

  if (payload.length < 1 || payload.length > 100) {
    return res.status(400).json({ message: 'request body must contain 1 to 100 readings' })
  }

  for (const item of payload) {
    if (
      !item ||
      typeof item.voltage !== 'number' ||
      typeof item.current !== 'number' ||
      typeof item.power !== 'number' ||
      typeof item.axisX !== 'number' ||
      typeof item.axisY !== 'number' ||
      typeof item.axisZ !== 'number' ||
      ![0, 1].includes(item.ldrTop) ||
      ![0, 1].includes(item.ldrBottom) ||
      ![0, 1].includes(item.ldrLeft) ||
      ![0, 1].includes(item.ldrRight)
    ) {
      return res.status(400).json({
        message:
          'each reading requires voltage/current/power/axisX/axisY/axisZ numbers and ldrTop/Bottom/Left/Right as 0 or 1',
      })
    }
  }

  const result = await enqueueWrite(async () => {
    const previous = await prisma.annReading.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, cumulativeEnergyKwh: true },
    })

    let runningCumulative = previous?.cumulativeEnergyKwh ?? 0
    let lastTime = previous?.createdAt ?? new Date(Date.now() - 60_000)

    const rows = payload.map((item, index) => {
      const currentTime = new Date(lastTime.getTime() + (index > 0 ? 60_000 : 0))
      const deltaHours = Math.max((currentTime.getTime() - lastTime.getTime()) / 3_600_000, 1 / 60)

      const computedPower = item.voltage * item.current
      const effectivePower = item.power > 0 ? (item.power + computedPower) / 2 : computedPower
      const energyKwh = Number(((effectivePower * deltaHours) / 1000).toFixed(6))

      runningCumulative = Number((runningCumulative + energyKwh).toFixed(6))
      lastTime = currentTime

      return {
        voltage: item.voltage,
        current: item.current,
        power: item.power,
        energyKwh,
        cumulativeEnergyKwh: runningCumulative,
        axisX: item.axisX,
        axisY: item.axisY,
        axisZ: item.axisZ,
        ldrTop: item.ldrTop,
        ldrBottom: item.ldrBottom,
        ldrLeft: item.ldrLeft,
        ldrRight: item.ldrRight,
      }
    })

    if (rows.length === 1) {
      const created = await prisma.annReading.create({ data: rows[0] })
      return { type: 'single' as const, created }
    }

    await prisma.annReading.createMany({ data: rows })
    return { type: 'batch' as const, count: rows.length }
  })

  if (result.type === 'single') {
    return res.status(201).json(result.created)
  }

  return res.status(201).json({ message: 'batch accepted', inserted: result.count })
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
 *   limit  – max records to return (default 50, max 100000)
 *   since  – ISO 8601 date string; only return records after this timestamp
 */
router.get('/history', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 100000)
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
