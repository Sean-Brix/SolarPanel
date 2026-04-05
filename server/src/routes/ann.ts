import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import {
  ANN_DEFAULT_RESOLUTION,
  ANN_RANGE_TO_MS,
  ANN_RUN_DETAIL_SELECT,
  ANN_RUN_SUMMARY_SELECT,
  buildAnnHistoryResponse,
  parseAnnHistoryFilters,
  toAnnRunDetail,
} from '../lib/annPrediction.js'
import type { AnnRange, AnnResolution } from '../lib/annPrediction.js'

const router = Router()

const VALID_RANGES: AnnRange[] = ['1h', '24h', '7d', '30d']
const VALID_RESOLUTIONS: AnnResolution[] = ['raw', '5m', '1h', '1d']

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return Math.trunc(parsed)
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false
  }

  return fallback
}

function parseIsoDate(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

router.get('/latest', async (_req, res) => {
  const record = await prisma.annPredictionRun.findFirst({
    // Latest should reflect newest MQTT-ingested run, even if the device timestamp is older.
    orderBy: { createdAt: 'desc' },
    select: ANN_RUN_DETAIL_SELECT,
  })

  if (!record) {
    return res.status(404).json({ message: 'No ANN prediction runs found' })
  }

  return res.json(toAnnRunDetail(record))
})

router.get('/history', async (req, res) => {
  const requestedRange = typeof req.query.range === 'string' ? req.query.range : '1h'
  if (!VALID_RANGES.includes(requestedRange as AnnRange)) {
    return res.status(400).json({ message: 'range must be one of 1h, 24h, 7d, 30d' })
  }

  const range = requestedRange as AnnRange
  const requestedResolution =
    typeof req.query.resolution === 'string' ? req.query.resolution : ANN_DEFAULT_RESOLUTION[range]

  if (!VALID_RESOLUTIONS.includes(requestedResolution as AnnResolution)) {
    return res.status(400).json({ message: 'resolution must be one of raw, 5m, 1h, 1d' })
  }

  const resolution = requestedResolution as AnnResolution
  const page = parsePositiveInteger(req.query.page, 1)
  const requestedPageSize = req.query.pageSize ?? req.query.limit ?? 200
  const pageSize = Math.min(parsePositiveInteger(requestedPageSize, 200), 500)
  const includeTrend = parseBoolean(req.query.includeTrend, true)

  const filters = parseAnnHistoryFilters(req.query as Record<string, unknown>)
  const requestedStartAt = parseIsoDate(req.query.startAt)
  const requestedEndAt = parseIsoDate(req.query.endAt)

  if (typeof req.query.startAt === 'string' && !requestedStartAt) {
    return res.status(400).json({ message: 'startAt must be a valid ISO date/time' })
  }

  if (typeof req.query.endAt === 'string' && !requestedEndAt) {
    return res.status(400).json({ message: 'endAt must be a valid ISO date/time' })
  }

  const customTimeFilter = Boolean(requestedStartAt || requestedEndAt)
  const fallbackStartAt = new Date(Date.now() - ANN_RANGE_TO_MS[range])
  const startAt = requestedStartAt ?? fallbackStartAt
  const endAt = requestedEndAt ?? new Date()

  if (startAt.getTime() > endAt.getTime()) {
    return res.status(400).json({ message: 'startAt must be earlier than or equal to endAt' })
  }

  const records = await prisma.annPredictionRun.findMany({
    where: {
      // Windowing on ingestion time keeps the dashboard realtime for delayed/static device clocks.
      createdAt: {
        gte: startAt,
        lte: endAt,
      },
    },
    orderBy: { createdAt: 'asc' },
    select: ANN_RUN_SUMMARY_SELECT,
  })

  return res.json(
    buildAnnHistoryResponse({
      records,
      range,
      resolution,
      page,
      pageSize,
      includeTrend,
      filters,
      timeFilter: {
        startAt,
        endAt,
        custom: customTimeFilter,
      },
      requestedTimeFilter: {
        startAt: typeof req.query.startAt === 'string' ? req.query.startAt : null,
        endAt: typeof req.query.endAt === 'string' ? req.query.endAt : null,
      },
    }),
  )
})

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ message: 'id must be a positive integer' })
  }

  const record = await prisma.annPredictionRun.findUnique({
    where: { id },
    select: ANN_RUN_DETAIL_SELECT,
  })

  if (!record) {
    return res.status(404).json({ message: 'ANN prediction run not found' })
  }

  return res.json(toAnnRunDetail(record))
})

export default router
