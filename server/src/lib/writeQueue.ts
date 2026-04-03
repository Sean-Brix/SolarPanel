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

function inferConnectionLimit(): number | null {
  const explicitLimit = parsePositiveInt(process.env.PRISMA_CONNECTION_LIMIT)
  if (explicitLimit) {
    return explicitLimit
  }

  const autoPoolMin = parsePositiveInt(process.env.PRISMA_AUTO_POOL_MIN) ?? 4
  const autoPoolEnabled = process.env.PRISMA_AUTO_POOL !== 'false'

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return autoPoolEnabled ? autoPoolMin : null
  }

  try {
    const url = new URL(databaseUrl)
    const configuredLimit = parsePositiveInt(url.searchParams.get('connection_limit'))

    if (!autoPoolEnabled) {
      return configuredLimit
    }

    return Math.max(configuredLimit ?? autoPoolMin, autoPoolMin)
  } catch {
    return autoPoolEnabled ? autoPoolMin : null
  }
}

function defaultWriteConcurrency(): number {
  const inferredLimit = inferConnectionLimit()
  if (!inferredLimit || inferredLimit <= 1) {
    return 1
  }

  // Keep one pooled connection available for read endpoints.
  return Math.max(1, Math.min(inferredLimit - 1, 4))
}

const maxConcurrency = parsePositiveInt(process.env.DB_WRITE_CONCURRENCY) ?? defaultWriteConcurrency()

let active = 0
let scheduleQueued = false
const queue: Array<() => void> = []

function schedule() {
  scheduleQueued = false

  if (active >= maxConcurrency) {
    return
  }

  const next = queue.shift()
  if (!next) {
    return
  }

  active += 1
  next()
}

function scheduleSoon() {
  if (scheduleQueued) {
    return
  }

  scheduleQueued = true
  setImmediate(schedule)
}

export function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          active = Math.max(0, active - 1)
          scheduleSoon()
        })
    })

    scheduleSoon()
  })
}
