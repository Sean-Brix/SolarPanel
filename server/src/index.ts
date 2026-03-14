import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import fixedRouter from './routes/fixed.js'
import conventionalRouter from './routes/conventional.js'
import annRouter from './routes/ann.js'

dotenv.config({ path: 'server/.env' })

const prisma = new PrismaClient()
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
const uiDir = path.resolve('server/public')
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

app.listen(port, () => {
  console.log(`REST API running on http://localhost:${port}`)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
