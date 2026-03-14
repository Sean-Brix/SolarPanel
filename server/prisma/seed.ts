/**
 * Seed script — creates the initial admin account.
 * Run once from the project root:
 *   npx tsx server/prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config({ path: 'server/.env' })

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('helios123', 12)

  const admin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: { passwordHash },
    create: { username: 'admin', passwordHash },
  })

  console.log(`✔ Admin ready — id: ${admin.id}, username: ${admin.username}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
