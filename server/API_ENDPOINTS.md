# Solar Panel API Endpoints

Base URL: `http://localhost:4000`

---

## Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |

---

## Fixed Panel

Static panel with no movement hardware.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/fixed` | ESP32 — push a new reading |
| GET | `/api/fixed/latest` | Fetch the most recent reading |
| GET | `/api/fixed/history` | Fetch historical readings |

### POST `/api/fixed`

**Request body**
```json
{
  "voltage": 12.4,
  "current": 2.1,
  "power": 26.04
}
```

**Response `201`**
```json
{
  "id": 1,
  "voltage": 12.4,
  "current": 2.1,
  "power": 26.04,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

### GET `/api/fixed/latest`

**Response `200`**
```json
{
  "id": 1,
  "voltage": 12.4,
  "current": 2.1,
  "power": 26.04,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

### GET `/api/fixed/history`

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | `50` | Max records to return (capped at 500) |
| `since` | ISO 8601 string | — | Only return records newer than this timestamp |

**Example:** `GET /api/fixed/history?limit=100&since=2025-01-01T00:00:00Z`

**Response `200`** — array ordered newest first
```json
[
  {
    "id": 2,
    "voltage": 12.5,
    "current": 2.2,
    "power": 27.5,
    "createdAt": "2025-01-01T00:01:00.000Z"
  }
]
```

---

## Conventional Panel

Motorised tracker — follows the sun continuously using IMU + LDR sensors.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/conventional` | ESP32 — push a new reading |
| GET | `/api/conventional/latest` | Fetch the most recent reading |
| GET | `/api/conventional/history` | Fetch historical readings |

### POST `/api/conventional`

**Request body**
```json
{
  "voltage": 13.1,
  "current": 2.5,
  "power": 32.75,
  "axisX": 45.2,
  "axisY": -12.8,
  "axisZ": 0.1,
  "ldrTop": 1,
  "ldrBottom": 0,
  "ldrLeft": 0,
  "ldrRight": 1
}
```

> `ldrTop`, `ldrBottom`, `ldrLeft`, `ldrRight` are **binary** — `1` = light detected, `0` = dark

**Response `201`**
```json
{
  "id": 1,
  "voltage": 13.1,
  "current": 2.5,
  "power": 32.75,
  "axisX": 45.2,
  "axisY": -12.8,
  "axisZ": 0.1,
  "ldrTop": 1,
  "ldrBottom": 0,
  "ldrLeft": 0,
  "ldrRight": 1,
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

### GET `/api/conventional/latest`

**Response `200`** — same shape as POST response above

### GET `/api/conventional/history`

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | `50` | Max records to return (capped at 500) |
| `since` | ISO 8601 string | — | Only return records newer than this timestamp |

**Response `200`** — array ordered newest first, same shape as POST response above

---

## ANN Panel

Smart tracker — moves only when the ANN model predicts a net power gain.
Same physical sensors as the Conventional panel.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ann` | ESP32 — push a new reading |
| GET | `/api/ann/latest` | Fetch the most recent reading |
| GET | `/api/ann/history` | Fetch historical readings |

### POST `/api/ann`

**Request body** *(identical structure to Conventional)*
```json
{
  "voltage": 13.3,
  "current": 2.6,
  "power": 34.58,
  "axisX": 42.0,
  "axisY": -11.5,
  "axisZ": 0.3,
  "ldrTop": 1,
  "ldrBottom": 0,
  "ldrLeft": 1,
  "ldrRight": 0
}
```

**Response `201`** — same shape as Conventional POST response

### GET `/api/ann/latest`

**Response `200`** — same shape as POST response above

### GET `/api/ann/history`

**Query parameters**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | `50` | Max records to return (capped at 500) |
| `since` | ISO 8601 string | — | Only return records newer than this timestamp |

**Response `200`** — array ordered newest first, same shape as POST response above

---

## Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/overview/latest` | Latest reading from all three panels combined |

### GET `/api/overview/latest`

**Response `200`**
```json
{
  "fixed": {
    "id": 5,
    "voltage": 12.4,
    "current": 2.1,
    "power": 26.04,
    "createdAt": "2025-01-01T00:05:00.000Z"
  },
  "conventional": {
    "id": 5,
    "voltage": 13.1,
    "current": 2.5,
    "power": 32.75,
    "axisX": 45.2,
    "axisY": -12.8,
    "axisZ": 0.1,
    "ldrTop": 1,
    "ldrBottom": 0,
    "ldrLeft": 0,
    "ldrRight": 1,
    "createdAt": "2025-01-01T00:05:00.000Z"
  },
  "ann": {
    "id": 5,
    "voltage": 13.3,
    "current": 2.6,
    "power": 34.58,
    "axisX": 42.0,
    "axisY": -11.5,
    "axisZ": 0.3,
    "ldrTop": 1,
    "ldrBottom": 0,
    "ldrLeft": 1,
    "ldrRight": 0,
    "createdAt": "2025-01-01T00:05:00.000Z"
  }
}
```

> Any panel that has no readings yet will return `null` for its field.

---

## Common Error Responses

| Status | Body | Cause |
|--------|------|-------|
| `400` | `{ "message": "..." }` | Missing or invalid fields |
| `404` | `{ "message": "No readings found" }` | Table is empty |
| `500` | `{ "message": "Internal server error" }` | Unexpected server error |

---

## MQTT Topics

The server publishes hourly weather forecasts to devices via MQTT (HiveMQ Cloud broker).

> **Broker Configuration:** See `.env` file for `MQTT_BROKER_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `MQTT_QOS`

### Topic: `helios/forecast`

**Purpose:** Server publishes the current and upcoming weather to guide device decision-making (e.g., whether to move a tracker).

**Publish Schedule:**
- On server startup (warm-up publish)
- Every hour, on the hour (0 minutes past)

**QoS & Retain:** QoS 1 (at-least-once delivery), retain=true (new subscribers receive the latest forecast immediately)

**Payload (JSON):**
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

**Field Descriptions:**
- `timestamp` — ISO 8601 datetime (Asia/Manila timezone) of the weather reading
- `hour` — Hour of the day (0–23, 24-hour format)
- `weatherCode` — WMO code (0–99, mapped to Philippine conditions)
- `weatherLabel` — Human-readable label for `weatherCode`:
  - 0 = Clear
  - 1 = Mostly clear
  - 2 = Partly cloudy
  - 3 = Overcast
  - 45 = Foggy
  - 48 = Rime fog / Depositing rime fog
  - 51 = Light drizzle
  - 53 = Moderate drizzle
  - 55 = Dense drizzle
  - 61 = Slight rain
  - 63 = Moderate rain
  - 65 = Heavy rain
  - 71 = Slight snow
  - 73 = Moderate snow
  - 75 = Heavy snow
  - 77 = Snow grains
  - 80 = Slight rain showers
  - 81 = Moderate rain showers
  - 82 = Violent rain showers
  - 85 = Slight snow showers
  - 86 = Heavy snow showers
  - 95 = Thunderstorm with slight hail
  - 96 = Thunderstorm with moderate hail
  - 99 = Thunderstorm with heavy hail
- `tempC` — Ambient temperature in °C
- `humidityPct` — Relative humidity (0–100 %)
- `windKph` — Wind speed in km/h

**Data Source:** Open-Meteo API (https://api.open-meteo.com/v1/forecast) with coordinates 14.5995°N, 120.9842°E (Manila, Philippines)

**Example Use Case:**
- Device subscribes to `helios/forecast` and caches the most recent message (retained)
- Device checks `weatherCode` or `weatherLabel` before deciding to move tracker
- E.g., skip tracker movement during thunderstorm (code 95+) to conserve power and avoid damage
