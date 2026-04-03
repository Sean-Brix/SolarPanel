import { Router } from 'express'
import { prisma } from '../lib/prisma.js'

const router = Router()

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return Math.trunc(parsed)
}
/**
 * GET /api/conventional/latest
 * Data source: MQTT topic helios/readings/conventional
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
 * GET /api/conventional/history?page=1&pageSize=50&since=ISO_DATE
 * Data source: MQTT topic helios/readings/conventional
 * Returns paginated Conventional panel readings, newest first.
 * Query params:
 *   page      – 1-based page index (default 1)
 *   pageSize  – max records per page (default 50, max 500)
 *   since     – ISO 8601 date string; only return records after this timestamp
 *
 * Backward compatibility:
 *   limit maps to pageSize when pageSize is omitted.
 */
router.get('/history', async (req, res) => {
  const page = parsePositiveInteger(req.query.page, 1)
  const requestedPageSize = req.query.pageSize ?? req.query.limit ?? 50
  const pageSize = Math.min(parsePositiveInteger(requestedPageSize, 50), 500)
  const since = typeof req.query.since === 'string' ? new Date(req.query.since) : undefined

  if (since && isNaN(since.getTime())) {
    return res.status(400).json({ message: 'since must be a valid ISO 8601 date string' })
  }

  const where = since ? { createdAt: { gte: since } } : undefined

  const totalCount = await prisma.conventionalReading.count({ where })
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const currentPage = Math.min(page, totalPages)
  const skip = (currentPage - 1) * pageSize

  const readings = await prisma.conventionalReading.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip,
    take: pageSize,
  })

  return res.json({
    items: readings,
    pagination: {
      page: currentPage,
      pageSize,
      totalCount,
      totalPages,
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages,
    },
  })
})

export default router
