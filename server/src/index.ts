import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fixedRouter from './routes/fixed.js'
import conventionalRouter from './routes/conventional.js'
import annRouter from './routes/ann.js'
import authRouter from './routes/auth.js'
import devRouter from './routes/dev.js'
import { prisma } from './lib/prisma.js'
import { ANN_RUN_SUMMARY_SELECT, toAnnRunSummary } from './lib/annPrediction.js'
import { connectMQTT, disconnectMQTT, onReadingIngest, subscribeToReadings } from './lib/mqtt.js'
import { scheduleHourlyForecast } from './lib/forecastWorker.js'

// Support both run modes:
// 1) `npm run dev` inside `server/` (loads `.env`)
// 2) root scripts like `npm run server:dev` (loads `server/.env`)
dotenv.config()
dotenv.config({ path: 'server/.env' })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = Number(process.env.PORT ?? 4000)

function flushSseResponse(response: express.Response) {
  const maybeFlush = (response as unknown as { flush?: () => void }).flush
  if (typeof maybeFlush === 'function') {
    maybeFlush.call(response)
  }
}

function isTruthyEnv(value: string | undefined, fallback = false): boolean {
  if (!value) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

const isForecastPublishingEnabled = isTruthyEnv(process.env.MQTT_FORECAST_ENABLED, false)

app.use(cors())
app.use(express.json())

// ─── Health ────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'solarpanel-api' })
})

// ─── Panel routes ──────────────────────────────────────────────────────────
app.use('/api/fixed', fixedRouter)
app.use('/api/conventional', conventionalRouter)
app.use('/api/ann', annRouter)

// ─── Auth routes ───────────────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/dev', devRouter)

// ─── Live reading events (SSE) ─────────────────────────────────────────────
app.get('/api/events/readings', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, no-transform')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Connection', 'keep-alive')
  // Prevent buffering in common reverse proxies so events are delivered immediately.
  res.setHeader('X-Accel-Buffering', 'no')

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  res.write('event: ready\n')
  res.write(`data: ${JSON.stringify({ ok: true, ts: new Date().toISOString() })}\n\n`)
  flushSseResponse(res)

  const unsubscribe = onReadingIngest((event) => {
    setImmediate(() => {
      if (res.writableEnded || req.destroyed) {
        return
      }

      res.write('event: reading\n')
      res.write(`data: ${JSON.stringify(event)}\n\n`)
      flushSseResponse(res)
    })
  })

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n')
    flushSseResponse(res)
  }, 15_000)

  req.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
    res.end()
  })
})

// ─── Overview ──────────────────────────────────────────────────────────────
// GET /api/overview/latest
// Returns the most recent reading from every panel type in a single response.
app.get('/api/overview/latest', async (_req, res) => {
  const [fixed, conventional, ann] = await Promise.all([
    prisma.fixedReading.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.conventionalReading.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.annPredictionRun.findFirst({
      orderBy: { createdAt: 'desc' },
      select: ANN_RUN_SUMMARY_SELECT,
    }),
  ])

  return res.json({ fixed, conventional, ann: ann ? toAnnRunSummary(ann) : null })
})

// ─── React SPA static serving ────────────────────────────────────────────
// Serve the Vite build output (written to server/public by `npm run build`).
// Must come AFTER all /api routes.
const uiDir = path.resolve(__dirname, '../public')
app.use(express.static(uiDir))

// SPA catch-all: any non-API, non-file request returns index.html so React
// Router can handle client-side navigation.
app.use((_req, res) => {
  res.sendFile(path.join(uiDir, 'index.html'))
})

// ─── Error handler ─────────────────────────────────────────────────────────
app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  void next

  const errorCode =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined

  if (errorCode === 'P2025') {
    return res.status(404).json({ message: 'Resource not found' })
  }

  if (errorCode === 'P2002') {
    return res.status(409).json({ message: 'Unique constraint violation' })
  }

  if (errorCode === 'P2024') {
    return res.status(503).json({
      message:
        'Database connection pool is currently saturated. Increase connection_limit or reduce ingest throughput and retry.',
    })
  }

  console.error(error)
  return res.status(500).json({ message: 'Internal server error' })
})

// ─── MQTT Setup ────────────────────────────────────────────────────────────
let forecastWorkerHandle: ReturnType<typeof setInterval> | null = null

async function startMQTTandForecast() {
  try {
    await connectMQTT()
    await subscribeToReadings()

    if (isForecastPublishingEnabled) {
      forecastWorkerHandle = scheduleHourlyForecast()
      console.log('MQTT and forecast worker initialized successfully')
    } else {
      console.log('MQTT initialized (forecast publishing disabled)')
    }
  } catch (error) {
    console.warn(
      'MQTT initialization failed (continuing without MQTT):',
      error instanceof Error ? error.message : String(error)
    )
    // Non-fatal: system continues with REST API only
  }
}

app.listen(port, async () => {
  console.log(`REST API running on http://localhost:${port}`)
  await startMQTTandForecast()
})

process.on('SIGINT', async () => {
  console.log('Shutting down...')

  if (forecastWorkerHandle) {
    clearInterval(forecastWorkerHandle)
  }

  await disconnectMQTT()
  await prisma.$disconnect()
  process.exit(0)
})
