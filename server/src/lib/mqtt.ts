import mqtt from 'mqtt'
import { prisma } from './prisma.js'
import { enqueueWrite } from './writeQueue.js'

type MQTTConfig = {
  brokerUrl: string
  username: string
  password: string
  qos: 0 | 1 | 2
}

let client: mqtt.MqttClient | null = null

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

export function getMQTTConfig(): MQTTConfig {
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883'
  const username = process.env.MQTT_USERNAME || 'guest'
  const password = process.env.MQTT_PASSWORD || 'guest'
  const qos = (Number(process.env.MQTT_QOS) || 1) as 0 | 1 | 2

  return { brokerUrl, username, password, qos }
}

export async function connectMQTT(): Promise<mqtt.MqttClient> {
  if (client && client.connected) {
    return client
  }

  const config = getMQTTConfig()

  return new Promise((resolve, reject) => {
    const options: mqtt.IClientOptions = {
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

    client.on('error', (err) => {
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

function validateFixedReading(item: unknown): item is FixedReadingPayload {
  if (!item || typeof item !== 'object') return false
  const obj = item as Record<string, unknown>
  return (
    typeof obj.voltage === 'number' &&
    typeof obj.current === 'number' &&
    typeof obj.power === 'number'
  )
}

function validateTrackerReading(item: unknown): item is TrackerReadingPayload {
  if (!validateFixedReading(item)) return false
  const obj = item as unknown as Record<string, unknown>
  return (
    typeof obj.axisX === 'number' &&
    typeof obj.axisY === 'number' &&
    typeof obj.axisZ === 'number' &&
    [0, 1].includes(obj.ldrTop as number) &&
    [0, 1].includes(obj.ldrBottom as number) &&
    [0, 1].includes(obj.ldrLeft as number) &&
    [0, 1].includes(obj.ldrRight as number)
  )
}

async function handleFixedReading(payload: FixedReadingPayload) {
  const result = await enqueueWrite(async () => {
    const previous = await prisma.fixedReading.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, cumulativeEnergyKwh: true },
    })

    let runningCumulative = previous?.cumulativeEnergyKwh ?? 0
    let lastTime = previous?.createdAt ?? new Date(Date.now() - 60_000)

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

    return created
  })

  console.log('[MQTT] Fixed reading saved:', result.id)
}

async function handleTrackerReading(panelType: 'conventional' | 'ann', payload: TrackerReadingPayload) {
  const result = await enqueueWrite(async () => {
    const previousQuery = panelType === 'conventional' 
      ? prisma.conventionalReading.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, cumulativeEnergyKwh: true } })
      : prisma.annReading.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true, cumulativeEnergyKwh: true } })

    const previous = await previousQuery

    let runningCumulative = previous?.cumulativeEnergyKwh ?? 0
    let lastTime = previous?.createdAt ?? new Date(Date.now() - 60_000)

    const currentTime = new Date()
    const deltaHours = Math.max((currentTime.getTime() - lastTime.getTime()) / 3_600_000, 1 / 60)

    const computedPower = payload.voltage * payload.current
    const effectivePower = payload.power > 0 ? (payload.power + computedPower) / 2 : computedPower
    const energyKwh = Number(((effectivePower * deltaHours) / 1000).toFixed(6))

    runningCumulative = Number((runningCumulative + energyKwh).toFixed(6))

    const createQuery = panelType === 'conventional'
      ? prisma.conventionalReading.create({
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
      : prisma.annReading.create({
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

    const created = await createQuery
    return created
  })

  console.log(`[MQTT] ${panelType} reading saved:`, result.id)
}

export async function subscribeToReadings(): Promise<void> {
  if (!client || !client.connected) {
    console.warn('[MQTT] Cannot subscribe: client not connected')
    return
  }

  const topics = ['helios/readings/fixed', 'helios/readings/conventional', 'helios/readings/ann']
  const config = getMQTTConfig()

  client.subscribe(topics, { qos: config.qos }, (err) => {
    if (err) {
      console.error('[MQTT] Subscribe error:', err.message)
      return
    }
    console.log('[MQTT] Subscribed to topics:', topics)
  })

  client.on('message', async (topic, buffer) => {
    try {
      const payload = JSON.parse(buffer.toString())

      if (topic === 'helios/readings/fixed') {
        if (!validateFixedReading(payload)) {
          console.error('[MQTT] Invalid fixed reading payload:', payload)
          return
        }
        await handleFixedReading(payload)
      } else if (topic === 'helios/readings/conventional') {
        if (!validateTrackerReading(payload)) {
          console.error('[MQTT] Invalid conventional reading payload:', payload)
          return
        }
        await handleTrackerReading('conventional', payload)
      } else if (topic === 'helios/readings/ann') {
        if (!validateTrackerReading(payload)) {
          console.error('[MQTT] Invalid ANN reading payload:', payload)
          return
        }
        await handleTrackerReading('ann', payload)
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
      (err) => {
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

export function getMQTTClient(): mqtt.MqttClient | null {
  return client
}
