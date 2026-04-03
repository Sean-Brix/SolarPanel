import mqtt, { type IClientOptions, type MqttClient } from 'mqtt'
import { EventEmitter } from 'node:events'
import { prisma } from './prisma.js'
import { enqueueWrite } from './writeQueue.js'
import { parseAnnPredictionPayload, toAnnPredictionCreateData } from './annPrediction.js'

type MQTTConfig = {
  brokerUrl: string
  username: string
  password: string
  qos: 0 | 1 | 2
}

type PanelType = 'fixed' | 'conventional' | 'ann'

export type ReadingIngestEvent = {
  panelType: PanelType
  readingId: number
  createdAt: string
}

let client: MqttClient | null = null
const readingEventBus = new EventEmitter()
readingEventBus.setMaxListeners(0)

interface FixedReadingPayload {
  voltage: number
  current: number
  power: number
}

interface TrackerReadingPayload extends FixedReadingPayload {
  axisX: number
  axisY: number
  axisZ: number
  ldrTop: 0 | 1
  ldrBottom: 0 | 1
  ldrLeft: 0 | 1
  ldrRight: 0 | 1
}

type EnergySeedPanel = 'fixed' | 'conventional'

type EnergySeedState = {
  createdAt: Date
  cumulativeEnergyKwh: number
  loadedAtMs: number
}

const energySeedCache: Partial<Record<EnergySeedPanel, EnergySeedState>> = {}
const ENERGY_SEED_MAX_AGE_MS = 5 * 60 * 1000

function getEnergySeed(panel: EnergySeedPanel) {
  const cached = energySeedCache[panel]
  if (!cached) {
    return null
  }

  if (Date.now() - cached.loadedAtMs > ENERGY_SEED_MAX_AGE_MS) {
    delete energySeedCache[panel]
    return null
  }

  return cached
}

function setEnergySeed(panel: EnergySeedPanel, createdAt: Date, cumulativeEnergyKwh: number) {
  energySeedCache[panel] = {
    createdAt,
    cumulativeEnergyKwh,
    loadedAtMs: Date.now(),
  }
}

function emitReadingIngest(panelType: PanelType, readingId: number, createdAt: Date) {
  const event: ReadingIngestEvent = {
    panelType,
    readingId,
    createdAt: createdAt.toISOString(),
  }
  readingEventBus.emit('reading-ingested', event)
}

export function onReadingIngest(listener: (event: ReadingIngestEvent) => void): () => void {
  readingEventBus.on('reading-ingested', listener)
  return () => {
    readingEventBus.off('reading-ingested', listener)
  }
}

export function getMQTTConfig(): MQTTConfig {
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883'
  const username = process.env.MQTT_USERNAME || 'guest'
  const password = process.env.MQTT_PASSWORD || 'guest'
  const qos = (Number(process.env.MQTT_QOS) || 1) as 0 | 1 | 2

  return { brokerUrl, username, password, qos }
}

export async function connectMQTT(): Promise<MqttClient> {
  if (client && client.connected) {
    return client
  }

  const config = getMQTTConfig()

  return new Promise((resolve, reject) => {
    const options: IClientOptions = {
      username: config.username,
      password: config.password,
      clientId: `solarpanel-api-${Date.now()}`,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      protocolVersion: 4,
    }

    console.log(`[MQTT] Connecting to ${config.brokerUrl} as ${config.username}...`)

    client = mqtt.connect(config.brokerUrl, options)

    client.on('connect', () => {
      console.log('[MQTT] Connected to broker:', config.brokerUrl)
      resolve(client!)
    })

    client.on('error', (err: Error) => {
      const errorMsg = err?.message || err?.toString?.() || String(err) || 'Unknown error'
      console.error('[MQTT] Connection error:', errorMsg)
      reject(new Error(`MQTT connection failed: ${errorMsg}`))
    })

    client.on('disconnect', () => {
      console.log('[MQTT] Disconnected from broker')
    })

    client.on('reconnect', () => {
      console.log('[MQTT] Attempting reconnect...')
    })
  })
}

// ────────────────────────────────────────────────────────────────────────────
// MQTT Subscribe: Panel Readings
// ────────────────────────────────────────────────────────────────────────────

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function toBinary01(value: unknown): 0 | 1 | null {
  if (value === true) return 1
  if (value === false) return 0

  const parsed = toFiniteNumber(value)
  if (parsed === 0 || parsed === 1) {
    return parsed
  }

  return null
}

function parseFixedReading(item: unknown): FixedReadingPayload | null {
  if (!item || typeof item !== 'object') return null
  const obj = item as Record<string, unknown>

  const voltage = toFiniteNumber(obj.voltage)
  const current = toFiniteNumber(obj.current)
  const power = toFiniteNumber(obj.power)

  if (voltage === null || current === null || power === null) {
    return null
  }

  return { voltage, current, power }
}

function parseTrackerReading(item: unknown): TrackerReadingPayload | null {
  const fixed = parseFixedReading(item)
  if (!fixed || !item || typeof item !== 'object') {
    return null
  }

  const obj = item as Record<string, unknown>
  const axisX = toFiniteNumber(obj.axisX)
  const axisY = toFiniteNumber(obj.axisY)
  const axisZ = toFiniteNumber(obj.axisZ)
  const ldrTop = toBinary01(obj.ldrTop)
  const ldrBottom = toBinary01(obj.ldrBottom)
  const ldrLeft = toBinary01(obj.ldrLeft)
  const ldrRight = toBinary01(obj.ldrRight)

  if (
    axisX === null ||
    axisY === null ||
    axisZ === null ||
    ldrTop === null ||
    ldrBottom === null ||
    ldrLeft === null ||
    ldrRight === null
  ) {
    return null
  }

  return {
    ...fixed,
    axisX,
    axisY,
    axisZ,
    ldrTop,
    ldrBottom,
    ldrLeft,
    ldrRight,
  }
}

async function handleFixedReading(payload: FixedReadingPayload) {
  const result = await enqueueWrite(async () => {
    let seed = getEnergySeed('fixed')
    if (!seed) {
      const previous = await prisma.fixedReading.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, cumulativeEnergyKwh: true },
      })

      if (previous) {
        seed = {
          createdAt: previous.createdAt,
          cumulativeEnergyKwh: previous.cumulativeEnergyKwh,
          loadedAtMs: Date.now(),
        }
      }
    }

    let runningCumulative = seed?.cumulativeEnergyKwh ?? 0
    let lastTime = seed?.createdAt ?? new Date(Date.now() - 60_000)

    const currentTime = new Date()
    const deltaHours = Math.max((currentTime.getTime() - lastTime.getTime()) / 3_600_000, 1 / 60)

    const computedPower = payload.voltage * payload.current
    const effectivePower = payload.power > 0 ? (payload.power + computedPower) / 2 : computedPower
    const energyKwh = Number(((effectivePower * deltaHours) / 1000).toFixed(6))

    runningCumulative = Number((runningCumulative + energyKwh).toFixed(6))

    const created = await prisma.fixedReading.create({
      data: {
        voltage: payload.voltage,
        current: payload.current,
        power: payload.power,
        energyKwh,
        cumulativeEnergyKwh: runningCumulative,
      },
    })

    setEnergySeed('fixed', created.createdAt, created.cumulativeEnergyKwh)

    return created
  })

  console.log('[MQTT] Fixed reading saved:', result.id)
  emitReadingIngest('fixed', result.id, result.createdAt)
}

async function handleTrackerReading(panelType: 'conventional', payload: TrackerReadingPayload) {
  const result = await enqueueWrite(async () => {
    let seed = getEnergySeed('conventional')
    if (!seed) {
      const previous = await prisma.conventionalReading.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, cumulativeEnergyKwh: true },
      })

      if (previous) {
        seed = {
          createdAt: previous.createdAt,
          cumulativeEnergyKwh: previous.cumulativeEnergyKwh,
          loadedAtMs: Date.now(),
        }
      }
    }

    let runningCumulative = seed?.cumulativeEnergyKwh ?? 0
    let lastTime = seed?.createdAt ?? new Date(Date.now() - 60_000)

    const currentTime = new Date()
    const deltaHours = Math.max((currentTime.getTime() - lastTime.getTime()) / 3_600_000, 1 / 60)

    const computedPower = payload.voltage * payload.current
    const effectivePower = payload.power > 0 ? (payload.power + computedPower) / 2 : computedPower
    const energyKwh = Number(((effectivePower * deltaHours) / 1000).toFixed(6))

    runningCumulative = Number((runningCumulative + energyKwh).toFixed(6))

    const created = await prisma.conventionalReading.create({
      data: {
        voltage: payload.voltage,
        current: payload.current,
        power: payload.power,
        energyKwh,
        cumulativeEnergyKwh: runningCumulative,
        axisX: payload.axisX,
        axisY: payload.axisY,
        axisZ: payload.axisZ,
        ldrTop: payload.ldrTop,
        ldrBottom: payload.ldrBottom,
        ldrLeft: payload.ldrLeft,
        ldrRight: payload.ldrRight,
      },
    })

    setEnergySeed('conventional', created.createdAt, created.cumulativeEnergyKwh)
    return created
  })

  console.log(`[MQTT] ${panelType} reading saved:`, result.id)
  emitReadingIngest(panelType, result.id, result.createdAt)
}

async function handleAnnPredictionRun(payload: unknown) {
  const parsed = parseAnnPredictionPayload(payload)
  if (!parsed) {
    console.error('[MQTT] Invalid ANN reading payload:', payload)
    return
  }

  const result = await enqueueWrite(async () => {
    return prisma.annPredictionRun.create({
      data: toAnnPredictionCreateData(parsed),
    })
  })

  console.log('[MQTT] ann prediction run saved:', result.id)
  emitReadingIngest('ann', result.id, result.createdAt)
}

export async function subscribeToReadings(): Promise<void> {
  if (!client || !client.connected) {
    console.warn('[MQTT] Cannot subscribe: client not connected')
    return
  }

  const topics = ['helios/readings/fixed', 'helios/readings/conventional', 'helios/readings/ann']
  const config = getMQTTConfig()

  client.subscribe(topics, { qos: config.qos }, (err: Error | null | undefined) => {
    if (err) {
      console.error('[MQTT] Subscribe error:', err.message)
      return
    }
    console.log('[MQTT] Subscribed to topics:', topics)
  })

  client.on('message', async (topic: string, buffer: Buffer) => {
    try {
      const payload = JSON.parse(buffer.toString())

      if (topic === 'helios/readings/fixed') {
        const parsed = parseFixedReading(payload)
        if (!parsed) {
          console.error('[MQTT] Invalid fixed reading payload:', payload)
          return
        }
        await handleFixedReading(parsed)
      } else if (topic === 'helios/readings/conventional') {
        const parsed = parseTrackerReading(payload)
        if (!parsed) {
          console.error('[MQTT] Invalid conventional reading payload:', payload)
          return
        }
        await handleTrackerReading('conventional', parsed)
      } else if (topic === 'helios/readings/ann') {
        await handleAnnPredictionRun(payload)
      }
    } catch (err) {
      console.error('[MQTT] Message processing error on', topic, ':', err instanceof Error ? err.message : String(err))
    }
  })
}

export async function publishForecast(payload: object): Promise<void> {
  if (!client || !client.connected) {
    throw new Error('MQTT client not connected')
  }

  const config = getMQTTConfig()
  const topic = 'helios/forecast'

  return new Promise((resolve, reject) => {
    client!.publish(
      topic,
      JSON.stringify(payload),
      { qos: config.qos, retain: true },
      (err: Error | null | undefined) => {
        if (err) {
          console.error(`[MQTT] Publish error on ${topic}:`, err.message)
          reject(err)
        } else {
          console.log(`[MQTT] Published to ${topic}`)
          resolve()
        }
      }
    )
  })
}

export async function disconnectMQTT(): Promise<void> {
  if (!client) {
    return
  }

  return new Promise((resolve) => {
    client!.end(true, () => {
      console.log('[MQTT] Disconnected')
      client = null
      resolve()
    })
  })
}

export function getMQTTClient(): MqttClient | null {
  return client
}
