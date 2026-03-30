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
import { connectMQTT, disconnectMQTT, subscribeToReadings } from './lib/mqtt.js'
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

// ─── Overview ──────────────────────────────────────────────────────────────
// GET /api/overview/latest
// Returns the most recent reading from every panel type in a single response.
app.get('/api/overview/latest', async (_req, res) => {
  const [fixed, conventional, ann] = await Promise.all([
    prisma.fixedReading.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.conventionalReading.findFirst({ orderBy: { createdAt: 'desc' } }),
    prisma.annReading.findFirst({ orderBy: { createdAt: 'desc' } }),
  ])

  return res.json({ fixed, conventional, ann })
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

  console.error(error)
  return res.status(500).json({ message: 'Internal server error' })
})

// ─── MQTT Setup ────────────────────────────────────────────────────────────
let forecastWorkerHandle: ReturnType<typeof setInterval> | null = null

async function startMQTTandForecast() {
  try {
    await connectMQTT()
    await subscribeToReadings()
    forecastWorkerHandle = scheduleHourlyForecast()
    console.log('MQTT and forecast worker initialized successfully')
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
