declare module 'mqtt' {
  export interface IClientOptions {
    username?: string
    password?: string
    clientId?: string
    reconnectPeriod?: number
    connectTimeout?: number
    protocolVersion?: number
  }

  export interface MqttClient {
    connected: boolean
    on(event: 'connect', listener: () => void): this
    on(event: 'disconnect', listener: () => void): this
    on(event: 'reconnect', listener: () => void): this
    on(event: 'error', listener: (error: Error) => void): this
    on(event: 'message', listener: (topic: string, payload: Buffer) => void): this
    subscribe(
      topics: string[],
      options: { qos: 0 | 1 | 2 },
      callback: (error?: Error | null) => void,
    ): void
    publish(
      topic: string,
      message: string,
      options: { qos: 0 | 1 | 2; retain?: boolean },
      callback: (error?: Error | null) => void,
    ): void
    end(force?: boolean, callback?: () => void): void
  }

  export function connect(url: string, options?: IClientOptions): MqttClient

  const mqtt: {
    connect: typeof connect
  }

  export default mqtt
}
