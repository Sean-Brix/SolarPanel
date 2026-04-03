import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

function parsePositiveInt(value: string | null | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null
  }

  return parsed
}

function getPrismaDatasourceUrl(): string | undefined {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return undefined
  }

  const explicitConnectionLimit = parsePositiveInt(process.env.PRISMA_CONNECTION_LIMIT)
  const autoPoolMin = parsePositiveInt(process.env.PRISMA_AUTO_POOL_MIN) ?? 4
  const autoPoolEnabled = process.env.PRISMA_AUTO_POOL !== 'false'

  try {
    const url = new URL(databaseUrl)

    if (explicitConnectionLimit) {
      url.searchParams.set('connection_limit', String(explicitConnectionLimit))
      return url.toString()
    }

    if (!autoPoolEnabled) {
      return databaseUrl
    }

    const configuredLimit = parsePositiveInt(url.searchParams.get('connection_limit'))
    if (configuredLimit && configuredLimit >= autoPoolMin) {
      return databaseUrl
    }

    url.searchParams.set('connection_limit', String(autoPoolMin))
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '30')
    }

    console.warn(
      `[Prisma] Raised connection_limit to ${autoPoolMin} to avoid pool starvation during MQTT ingest bursts. Set PRISMA_AUTO_POOL=false to disable.`,
    )
    return url.toString()
  } catch {
    return databaseUrl
  }
}

const prismaDatasourceUrl = getPrismaDatasourceUrl()

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
    ...(prismaDatasourceUrl
      ? {
          datasources: {
            db: {
              url: prismaDatasourceUrl,
            },
          },
        }
      : {}),
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
