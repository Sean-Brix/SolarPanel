# SolarPanel

Frontend: React + TypeScript + Vite

Backend: Express + MySQL + Prisma REST API

## Backend Quick Start

1. Update server env values in `server/.env`.
2. Create database in MySQL (example: `solarpanel_demo`).
3. Run migration:

```bash
npm run prisma:migrate -- --name init
```

4. Install dependencies:

```bash
cd server && npm install
```

5. Start backend server:

```bash
npm run server:dev
```

The API runs at `http://localhost:4000` by default.

## MQTT Configuration (Forecast Publishing)

Forecast publishing is now opt-in. Configure these environment variables in `server/.env`:

```env
# MQTT Broker (HiveMQ Cloud or local Mosquitto)
MQTT_BROKER_URL=mqtts://your-broker-host:8883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password
MQTT_QOS=1
MQTT_FORECAST_ENABLED=false
```

Set `MQTT_FORECAST_ENABLED=true` only when you want the server to publish to `helios/forecast`.

## Prisma Pool Tuning (MQTT Burst Stability)

If ANN MQTT traffic is high, very small Prisma pools can starve read endpoints.

Recommended env controls in `server/.env`:

```env
# Auto-raise very low connection_limit values in DATABASE_URL
PRISMA_AUTO_POOL=true
PRISMA_AUTO_POOL_MIN=4

# Optional explicit override
# PRISMA_CONNECTION_LIMIT=4

# Optional write queue cap (if omitted, inferred from connection_limit)
# DB_WRITE_CONCURRENCY=3
```

If you intentionally want the original URL pool settings, set `PRISMA_AUTO_POOL=false`.

**Default Setup (HiveMQ Cloud):**
- Broker: `mqtts://8c8f0dbc419240d09dfc75c1cfff9c78.s1.eu.hivemq.cloud:8883` (TLS enabled)
- Username: `helios`
- Password: `Helios123`
- QoS: `1` (at-least-once delivery)

**Data Flow:**
1. Server connects to MQTT broker on startup
2. If `MQTT_FORECAST_ENABLED=true`, server fetches Open-Meteo weather API (Manila coordinates)
3. If enabled, server publishes forecast payload to topic `helios/forecast` with retain flag
4. ESP32 devices subscribe to `helios/forecast` and cache latest message
5. Devices use weather code to decide tracker movements (e.g., skip during thunderstorms)

**Forecast Payload:**
```json
{
  "timestamp": "2026-03-30T10:00:00+08:00",
  "hour": 10,
  "weatherCode": 2,
  "weatherLabel": "Partly cloudy",
  "tempC": 33.4,
  "humidityPct": 62,
  "windKph": 14.2
}
```

See [SYSTEM_INTERFACE_SOURCE_OF_TRUTH.md](SYSTEM_INTERFACE_SOURCE_OF_TRUTH.md) for the full runtime interface reference.

## CORS Configuration

The Express API uses:

```ts
app.use(cors())
```

This allows requests from any origin, which is fine for demo usage.

## REST Endpoints

The active API surface is documented in:

- [SYSTEM_INTERFACE_SOURCE_OF_TRUTH.md](SYSTEM_INTERFACE_SOURCE_OF_TRUTH.md)

This avoids drift between docs and the current Express routes.


## Useful Scripts

- `npm run dev` - start frontend
- `npm run server:dev` - run backend in watch mode
- `npm run server:build` - build backend TypeScript
- `npm run prisma:generate` - generate Prisma client
- `npm run prisma:migrate` - run Prisma migrations
