import mqtt from 'mqtt'

type MQTTConfig = {
  brokerUrl: string
  username: string
  password: string
  qos: 0 | 1 | 2
}

let client: mqtt.MqttClient | null = null

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
