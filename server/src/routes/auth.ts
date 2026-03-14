import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { requireAuth, AuthRequest } from '../middleware/requireAuth.js'

const router = Router()
const prisma = new PrismaClient()

/**
 * POST /api/auth/login
 * Body: { username: string, password: string }
 * Returns a signed JWT on success.
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ message: 'username and password are required' })
  }

  const admin = await prisma.admin.findUnique({ where: { username: username.trim() } })

  // Use constant-time compare even when the admin doesn't exist to prevent timing attacks
  const dummyHash = '$2a$12$invalidhashfortimingprotection000000000000000000000000'
  const hashToCompare = admin ? admin.passwordHash : dummyHash
  const match = await bcrypt.compare(password, hashToCompare)

  if (!admin || !match) {
    return res.status(401).json({ message: 'Invalid username or password' })
  }

  const token = jwt.sign(
    { adminId: admin.id },
    process.env.JWT_SECRET as string,
    { expiresIn: '8h' }
  )

  return res.json({ token, expiresIn: 28800 })
})

/**
 * POST /api/auth/logout
 * Stateless — the client should discard its token.
 * Included for explicit API surface and potential future blocklist support.
 */
router.post('/logout', requireAuth, (_req: AuthRequest, res) => {
  res.json({ message: 'Logged out. Discard your token on the client.' })
})

/**
 * GET /api/auth/me
 * Returns the current admin's id and username. Requires a valid Bearer token.
 */
router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const admin = await prisma.admin.findUnique({
    where: { id: req.adminId },
    select: { id: true, username: true, createdAt: true },
  })

  if (!admin) {
    return res.status(404).json({ message: 'Admin not found' })
  }

  return res.json(admin)
})

export default router
