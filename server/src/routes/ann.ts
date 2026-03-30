import { Router } from 'express'
import { enqueueWrite } from '../lib/writeQueue.js'
import { prisma } from '../lib/prisma.js'

const router = Router()
/**
 * GET /api/ann/latest
 * Data source: MQTT topic helios/readings/ann
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
 * Data source: MQTT topic helios/readings/ann
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
