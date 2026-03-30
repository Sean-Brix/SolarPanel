# MQTT Migration Implementation Guide

## Overview
The SolarPanel system has been successfully migrated from REST POST endpoints to MQTT pub/sub architecture for ESP32 panel data ingestion.

## Architecture Changes

### Before (REST)
```
ESP32 → HTTP POST /api/{panel} → Route handler → Database
```

### After (MQTT)
```
ESP32 → MQTT Publish helios/readings/{panel} → Server Subscriber → Validation → Database
```

## MQTT Topics

All ESP32 devices publish readings to one of three topics:

| Panel Type | Topic | Payload |
|-----------|-------|---------|
| Fixed | `helios/readings/fixed` | `{voltage, current, power}` |
| Conventional | `helios/readings/conventional` | `{voltage, current, power, axisX, axisY, axisZ, ldrTop, ldrBottom, ldrLeft, ldrRight}` |
| ANN | `helios/readings/ann` | `{voltage, current, power, axisX, axisY, axisZ, ldrTop, ldrBottom, ldrLeft, ldrRight}` |

## Message Format

### Fixed Panel Example
```json
{
  "voltage": 12.4,
  "current": 2.1,
  "power": 26.04
}
```

### Conventional/ANN Panel Example
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

## MQTT Configuration

- **Broker:** HiveMQ Cloud (configured via environment variables)
- **QoS:** 1 (at-least-once delivery)
- **Retain:** true (messages retained on broker)
- **Authentication:** Username/password (helios/Helios123)

## Testing MQTT Messages

Use mosquitto_pub to test publishing messages:

```bash
# Fixed panel test
mosquitto_pub -h 8c8f0dbc419240d09dfc75c1cfff9c78.s1.eu.hivemq.cloud \
  -p 8883 --tls-version tlsv1.2 -u helios -P Helios123 \
  -t "helios/readings/fixed" \
  -m '{"voltage":12.4,"current":2.1,"power":26.04}'

# Conventional panel test
mosquitto_pub -h 8c8f0dbc419240d09dfc75c1cfff9c78.s1.eu.hivemq.cloud \
  -p 8883 --tls-version tlsv1.2 -u helios -P Helios123 \
  -t "helios/readings/conventional" \
  -m '{"voltage":13.3,"current":2.6,"power":34.58,"axisX":42.0,"axisY":-11.5,"axisZ":0.3,"ldrTop":1,"ldrBottom":0,"ldrLeft":1,"ldrRight":0}'
```

## Data Flow

1. **Receive:** ESP32 publishes JSON message to MQTT topic
2. **Subscribe:** Server subscription handler receives message
3. **Validate:** TypeScript type guards validate payload structure
4. **Calculate:** Energy values computed from voltage/current/power
5. **Cumulative:** Running cumulative energy total calculated
6. **Write Queue:** Data enqueued for batched database writes
7. **Database:** Entry created in appropriate table (FixedReading, ConventionalReading, AnnReading)
8. **Query:** Data accessible via REST GET endpoints (`/api/{panel}/history`, `/api/{panel}/latest`)

## REST Endpoints (Unchanged)

All GET endpoints remain unchanged and work with MQTT-sourced data:

```
GET /api/fixed/latest
GET /api/fixed/history?limit=50&since=ISO_DATE

GET /api/conventional/latest
GET /api/conventional/history?limit=50&since=ISO_DATE

GET /api/ann/latest
GET /api/ann/history?limit=50&since=ISO_DATE

GET /api/overview/latest
```

## Server Startup

Start the server normally:

```bash
npm run dev        # Development with hot reload
npm run build      # Production build
npm start          # Production server
```

The server will:
1. Connect to MQTT broker
2. Subscribe to 3 panel reading topics
3. Schedule hourly forecast updates
4. Log successful initialization

## Verification

Check server logs for successful initialization:

```
[MQTT] Connected to broker: mqtts://...
[MQTT] Subscribed to topics: [
  'helios/readings/fixed',
  'helios/readings/conventional',
  'helios/readings/ann'
]
MQTT and forecast worker initialized successfully
```

## Files Modified

- `server/src/lib/mqtt.ts` - MQTT subscription handlers and validators
- `server/src/routes/fixed.ts` - Removed POST, kept GET endpoints
- `server/src/routes/conventional.ts` - Removed POST, kept GET endpoints
- `server/src/routes/ann.ts` - Removed POST, kept GET endpoints
- `server/src/index.ts` - Added subscription startup
- `src/features/solar-monitoring/pages/DevPage.tsx` - Updated DevPage documentation

## Benefits

1. **Lower Power:** Fire-and-forget MQTT vs HTTP roundtrips
2. **Reduced CPU:** No HTTP parsing overhead
3. **Reduced I/O:** Batched database writes via write queue
4. **Scalable:** Asynchronous message processing
5. **Reliable:** QoS 1 ensures message delivery
6. **Persistent:** Message retention for new subscribers
