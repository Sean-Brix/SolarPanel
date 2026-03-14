/**
 * Seed script — creates the initial admin account.
 * Run once from the project root:
 *   npx tsx server/prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config()
dotenv.config({ path: 'server/.env' })

const prisma = new PrismaClient()

async function main() {
  const passwordHash = await bcrypt.hash('helios123', 12)

  const admin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: { passwordHash },
    create: { username: 'admin', passwordHash },
  })

  const sampleCount = 12
  const intervalMinutes = 10
  const baseTime = new Date(Date.now() - sampleCount * intervalMinutes * 60_000)

  const fixedRows: Array<{
    voltage: number
    current: number
    power: number
    energyKwh: number
    cumulativeEnergyKwh: number
    createdAt: Date
  }> = []

  const conventionalRows: Array<{
    voltage: number
    current: number
    power: number
    energyKwh: number
    cumulativeEnergyKwh: number
    axisX: number
    axisY: number
    axisZ: number
    ldrTop: number
    ldrBottom: number
    ldrLeft: number
    ldrRight: number
    createdAt: Date
  }> = []

  const annRows: Array<{
    voltage: number
    current: number
    power: number
    energyKwh: number
    cumulativeEnergyKwh: number
    axisX: number
    axisY: number
    axisZ: number
    ldrTop: number
    ldrBottom: number
    ldrLeft: number
    ldrRight: number
    createdAt: Date
  }> = []

  let fixedCumulative = 0
  let conventionalCumulative = 0
  let annCumulative = 0

  for (let index = 0; index < sampleCount; index += 1) {
    const createdAt = new Date(baseTime.getTime() + index * intervalMinutes * 60_000)
    const deltaHours = intervalMinutes / 60

    const fixedVoltage = Number((18 + Math.sin(index * 0.3) * 0.6).toFixed(2))
    const fixedCurrent = Number((1.65 + Math.cos(index * 0.25) * 0.08).toFixed(2))
    const fixedPower = Number((fixedVoltage * fixedCurrent).toFixed(2))
    const fixedEnergyKwh = Number(((fixedPower * deltaHours) / 1000).toFixed(6))
    fixedCumulative = Number((fixedCumulative + fixedEnergyKwh).toFixed(6))

    fixedRows.push({
      voltage: fixedVoltage,
      current: fixedCurrent,
      power: fixedPower,
      energyKwh: fixedEnergyKwh,
      cumulativeEnergyKwh: fixedCumulative,
      createdAt,
    })

    const conventionalVoltage = Number((18.8 + Math.sin(index * 0.35) * 0.7).toFixed(2))
    const conventionalCurrent = Number((1.95 + Math.cos(index * 0.2) * 0.1).toFixed(2))
    const conventionalPower = Number((conventionalVoltage * conventionalCurrent).toFixed(2))
    const conventionalEnergyKwh = Number(((conventionalPower * deltaHours) / 1000).toFixed(6))
    conventionalCumulative = Number((conventionalCumulative + conventionalEnergyKwh).toFixed(6))

    conventionalRows.push({
      voltage: conventionalVoltage,
      current: conventionalCurrent,
      power: conventionalPower,
      energyKwh: conventionalEnergyKwh,
      cumulativeEnergyKwh: conventionalCumulative,
      axisX: Number((25 + index * 1.3).toFixed(2)),
      axisY: Number((80 + index * 2.4).toFixed(2)),
      axisZ: Number((0.3 + Math.sin(index * 0.2) * 0.1).toFixed(2)),
      ldrTop: index % 2,
      ldrBottom: (index + 1) % 2,
      ldrLeft: index % 3 === 0 ? 1 : 0,
      ldrRight: index % 4 === 0 ? 1 : 0,
      createdAt,
    })

    const annVoltage = Number((19.2 + Math.sin(index * 0.28) * 0.75).toFixed(2))
    const annCurrent = Number((2.2 + Math.cos(index * 0.22) * 0.11).toFixed(2))
    const annPower = Number((annVoltage * annCurrent).toFixed(2))
    const annEnergyKwh = Number(((annPower * deltaHours) / 1000).toFixed(6))
    annCumulative = Number((annCumulative + annEnergyKwh).toFixed(6))

    annRows.push({
      voltage: annVoltage,
      current: annCurrent,
      power: annPower,
      energyKwh: annEnergyKwh,
      cumulativeEnergyKwh: annCumulative,
      axisX: Number((20 + index * 0.9).toFixed(2)),
      axisY: Number((70 + index * 1.8).toFixed(2)),
      axisZ: Number((0.2 + Math.sin(index * 0.18) * 0.08).toFixed(2)),
      ldrTop: index % 2,
      ldrBottom: (index + 1) % 2,
      ldrLeft: index % 3 === 1 ? 1 : 0,
      ldrRight: index % 4 === 1 ? 1 : 0,
      createdAt,
    })
  }

  await prisma.$transaction([
    prisma.fixedReading.deleteMany(),
    prisma.conventionalReading.deleteMany(),
    prisma.annReading.deleteMany(),
  ])

  await prisma.fixedReading.createMany({ data: fixedRows })
  await prisma.conventionalReading.createMany({ data: conventionalRows })
  await prisma.annReading.createMany({ data: annRows })

  console.log(`✔ Admin ready — id: ${admin.id}, username: ${admin.username}`)
  console.log(`✔ Seeded records — fixed: ${fixedRows.length}, conventional: ${conventionalRows.length}, ann: ${annRows.length}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
