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
