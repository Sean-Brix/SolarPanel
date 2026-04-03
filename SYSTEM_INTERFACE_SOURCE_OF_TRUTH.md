# SolarPanel Runtime Interface Reference

Last verified against code on 2026-04-03.

This file is the source of truth for what the system actually uses today.
It replaces older overlapping docs.

## 1) MQTT Ingestion Paths (Actual Runtime)

Telemetry and ANN prediction runs are ingested through MQTT, not REST panel POST routes.

Runtime ingest flow:

1. Device publishes JSON to MQTT topic.
2. Server subscribes and validates payload shape.
3. Server transforms payload:
	 - Fixed/conventional: computes interval energy and cumulative energy.
	 - ANN: parses nested prediction payload and computes ANN summary metrics.
4. Server enqueues writes through the write queue.
5. Prisma writes to MySQL tables.
6. Frontend reads through REST GET endpoints and SSE.

### MQTT topics subscribed by the server

| Purpose | Topic | Stored in table/model | Payload shape |
|---|---|---|---|
| Fixed panel ingest | helios/readings/fixed | fixed_readings / FixedReading | { voltage, current, power } |
| Conventional tracker ingest | helios/readings/conventional | conventional_readings / ConventionalReading | { voltage, current, power, axisX, axisY, axisZ, ldrTop, ldrBottom, ldrLeft, ldrRight } |
| ANN prediction run ingest | helios/readings/ann | ann_prediction_runs / AnnPredictionRun | set-based payload with samples[], predicted/actual weather, predicted/actual next sample, checks |

### Sample payloads

1) Fixed panel reading (helios/readings/fixed):

```json
{
	"voltage": 18.62,
	"current": 1.73,
	"power": 32.2
}
```

2) Conventional panel reading (helios/readings/conventional):

```json
{
	"voltage": 17.94,
	"current": 1.56,
	"power": 28.5,
	"axisX": -3.2,
	"axisY": 1.1,
	"axisZ": 87.4,
	"ldrTop": 1,
	"ldrBottom": 0,
	"ldrLeft": 1,
	"ldrRight": 0
}
```

3) ANN prediction run payload (helios/readings/ann):

```json
{
	"setId": 1,
	"samples": [
		{
			"sampleNo": 1,
			"ldr1": 1008.0,
			"ldr2": 1015.0,
			"ldr3": 975.0,
			"ldr4": 1000.0,
			"accx": 4160.0,
			"accy": 5832.0,
			"accz": -13940.0,
			"gyrox": -328.0,
			"gyroy": 298.0,
			"gyroz": 232.0,
			"voltage": 21.92,
			"current_ma": -0.50,
			"power_mw": 0.00,
			"relay1": 0,
			"relay2": 0,
			"relay3": 0,
			"relay4": 0
		},
		{
			"sampleNo": 2,
			"ldr1": 1010.0,
			"ldr2": 1015.0,
			"ldr3": 972.0,
			"ldr4": 999.0,
			"accx": 4452.0,
			"accy": 6212.0,
			"accz": -14412.0,
			"gyrox": -367.0,
			"gyroy": 233.0,
			"gyroz": 216.0,
			"voltage": 21.77,
			"current_ma": -0.60,
			"power_mw": 0.00,
			"relay1": 0,
			"relay2": 0,
			"relay3": 0,
			"relay4": 0
		},
		{
			"sampleNo": 3,
			"ldr1": 1008.0,
			"ldr2": 1013.0,
			"ldr3": 978.0,
			"ldr4": 998.0,
			"accx": 4312.0,
			"accy": 6248.0,
			"accz": -14520.0,
			"gyrox": -401.0,
			"gyroy": 254.0,
			"gyroz": 214.0,
			"voltage": 21.82,
			"current_ma": -0.90,
			"power_mw": 0.00,
			"relay1": 0,
			"relay2": 0,
			"relay3": 0,
			"relay4": 0
		},
		{
			"sampleNo": 4,
			"ldr1": 1011.0,
			"ldr2": 1018.0,
			"ldr3": 980.0,
			"ldr4": 1005.0,
			"accx": 4428.0,
			"accy": 6548.0,
			"accz": -14680.0,
			"gyrox": -261.0,
			"gyroy": 340.0,
			"gyroz": 299.0,
			"voltage": 21.90,
			"current_ma": -1.00,
			"power_mw": 0.00,
			"relay1": 0,
			"relay2": 0,
			"relay3": 0,
			"relay4": 0
		}
	],
	"predictedWeather": {
		"timestamp": "2026-04-03T20:00",
		"hour": 20,
		"weatherCode": 1,
		"weather": "Mainly clear",
		"tempC": 29.1,
		"humidityPct": 67
	},
	"predictedNextSample": {
		"ldr1": 1012.0,
		"ldr2": 1019.0,
		"ldr3": 981.67,
		"ldr4": 1006.67,
		"accx": 4517.33,
		"accy": 6786.67,
		"accz": -14926.67,
		"gyrox": -238.67,
		"gyroy": 354.0,
		"gyroz": 321.33,
		"voltage": 21.89,
		"current_ma": -1.17,
		"power_mw": 0.00,
		"relay1": 0,
		"relay2": 0,
		"relay3": 0,
		"relay4": 0
	},
	"actualWeather": {
		"timestamp": "2026-04-03T20:00",
		"hour": 20,
		"weatherCode": 1,
		"weather": "Mainly clear",
		"tempC": 29.1,
		"humidityPct": 67
	},
	"actualNextSample": {
		"ldr1": 1011.0,
		"ldr2": 1017.0,
		"ldr3": 980.0,
		"ldr4": 1004.0,
		"accx": 4372.0,
		"accy": 5884.0,
		"accz": -13808.0,
		"gyrox": -413.0,
		"gyroy": 139.0,
		"gyroz": 210.0,
		"voltage": 21.87,
		"current_ma": -0.80,
		"power_mw": 0.00,
		"relay1": 0,
		"relay2": 0,
		"relay3": 0,
		"relay4": 0
	},
	"weatherCheck": {
		"weatherCodeResult": "CORRECT",
		"timeResult": "CORRECT",
		"tempResult": "CORRECT",
		"humidityResult": "CORRECT"
	},
	"predictionCheck": {
		"sensorResult": "NOT CORRECT",
		"overallResult": "NOT CORRECT",
		"details": [
			{
				"field": "GYROX",
				"predicted": -238.67,
				"actual": -413.0,
				"diff": 174.33,
				"tol": 120.0,
				"result": "NO"
			}
		]
	}
}
```

### Validation rules in code

Fixed and conventional:

- voltage/current/power must be finite numbers.
- axisX/axisY/axisZ must be finite numbers for conventional payloads.
- ldrTop/ldrBottom/ldrLeft/ldrRight must normalize to binary 0 or 1.

ANN prediction payload (helios/readings/ann):

- accepted top-level weather forms:
	- weather.predicted / weather.actual / weather.check
	- predictedWeather / actualWeather / weatherCheck
- accepted sample forms:
	- samples.history + samples.predictedNext + samples.actualNext
	- samples[] + predictedNextSample + actualNextSample
- sample keys support both forms:
	- accX/accY/accZ and accx/accy/accz
	- gyroX/gyroY/gyroZ and gyrox/gyroy/gyroz
	- currentMa and current_ma
	- powerMw and power_mw
- relay entries can be object ({ value, state }) or scalar (0/1).
- prediction check fields support both forms:
	- fields[] with name/difference/tolerance/status
	- details[] with field/diff/tol/result
- deviceId/source/mode/relayMemory may be omitted; server applies fallback defaults.
- timestamp is resolved from top-level timestamp or weather timestamps and must parse as date.

### Derived fields on ingest

For fixed and conventional rows:

- computedPower = voltage * current
- effectivePower = payload.power > 0 ? average(payload.power, computedPower) : computedPower
- deltaHours = max((now - lastReadingCreatedAt) / 3600000, 1/60)
- energyKwh = round((effectivePower * deltaHours) / 1000, 6)
- cumulativeEnergyKwh = previousCumulative + energyKwh (rounded to 6)

For ANN prediction runs:

- fieldCount, okCount, mismatchCount from predictionCheck.fields.
- weatherMatchCount/weatherCheckCount from weather check statuses.
- worstField* metrics based on max difference/tolerance ratio.
- summary fields plus raw nested JSON are stored in AnnPredictionRun.

## 2) MQTT Forecast Publishing (Server to Devices)

- Topic: helios/forecast
- QoS: from MQTT_QOS env var (default 1)
- Retain: true
- Enabled only when MQTT_FORECAST_ENABLED=true
- Default state: disabled
- Schedule when enabled: one publish on startup, then every 60 minutes
- Data source: Open-Meteo API (latitude 14.5995, longitude 120.9842, timezone Asia/Manila)

Payload fields:

- timestamp
- hour
- weatherCode
- weatherLabel
- tempC
- humidityPct
- windKph

## 3) HTTP API Actually Implemented

Base URL: http://localhost:4000

| Method | Endpoint | Auth | Notes |
|---|---|---|---|
| GET | /api/health | No | Service health metadata |
| GET | /api/events/readings | No | SSE stream with live ingest events |
| GET | /api/fixed/latest | No | Latest fixed reading |
| GET | /api/fixed/history | No | Query: limit, since |
| GET | /api/conventional/latest | No | Latest conventional reading |
| GET | /api/conventional/history | No | Query: limit, since |
| GET | /api/ann/latest | No | Latest ANN prediction run (detail shape) |
| GET | /api/ann/history | No | Query: range, resolution, limit, filters |
| GET | /api/ann/:id | No | ANN prediction run detail by numeric id |
| GET | /api/overview/latest | No | Latest fixed + conventional + ANN summary |
| POST | /api/auth/login | No | Body: { username, password }, returns JWT |
| POST | /api/auth/logout | Bearer | Stateless logout endpoint |
| GET | /api/auth/me | Bearer | Returns current admin profile |
| POST | /api/dev/generate-demo | Bearer | Body: { preset: quick|demo|extended } |
| DELETE | /api/dev/panel-logs/:panel | Bearer | panel = fixed\|conventional\|ann\|all |
| DELETE | /api/dev/panel-logs | Bearer | Compatibility alias for all-panel reset |

Fixed/conventional history endpoint query behavior:

- limit default is 50.
- limit maximum is 100000.
- limit must be a positive integer.
- since must be a valid ISO 8601 date string.
- since filter uses createdAt >= since.
- order is newest first.

ANN history endpoint query behavior:

- range default is 1h.
- range values: 1h, 24h, 7d, 30d.
- resolution defaults by range:
	- 1h -> raw
	- 24h -> 5m
	- 7d -> 1h
	- 30d -> 1d
- resolution values: raw, 5m, 1h, 1d.
- limit default is 200.
- limit is clamped to 1..500.
- optional filters:
	- overallResult
	- sensorResult
	- weatherMismatch (boolean)
	- fieldGroup (ldr|accelerometer|gyroscope|electrical|relay|other)
	- relayApplied (boolean)
- data window uses createdAt >= now - range (ingest recency).
- latest/history ordering is ingest-recency first (createdAt).
- response still includes device timestamp fields from the MQTT payload.
- response shape includes meta, runs, trend.

SSE endpoint behavior (/api/events/readings):

- emits ready event once on connect with { ok, ts }.
- emits reading event on ingest with { panelType, readingId, createdAt }.
- panelType values are fixed, conventional, ann.
- heartbeat comment is sent every 15 seconds.

### Not implemented anymore

These panel POST routes are not present in runtime code:

- POST /api/fixed
- POST /api/conventional
- POST /api/ann

Panel writes now come from MQTT subscribers only.

## 4) ANN Runtime Notes (Important)

Current ANN runtime has two storage paths in code:

1) Active ANN path used by MQTT ingest and ANN APIs:

- MQTT topic helios/readings/ann writes AnnPredictionRun.
- /api/ann/latest, /api/ann/history, /api/ann/:id read AnnPredictionRun.
- /api/overview/latest ANN data also reads AnnPredictionRun.

2) Legacy ANN reading path still used by dev dataset tools:

- /api/dev/generate-demo inserts into both AnnReading and AnnPredictionRun.
- /api/dev/panel-logs/:panel and /api/dev/panel-logs clear targeted data, including AnnPredictionRun for ann/all resets.

Implication:

- ANN dev tooling now stays aligned with the active ANN runtime model.

## 5) Endpoints Actually Called by the Frontend

Called by main app flows:

- POST /api/auth/login
- POST /api/auth/logout
- GET /api/fixed/history
- GET /api/conventional/history
- GET /api/ann/latest
- GET /api/ann/history
- GET /api/ann/:id
- GET /api/events/readings

Called by dev page:

- POST /api/dev/generate-demo
- DELETE /api/dev/panel-logs/:panel
- DELETE /api/dev/panel-logs/all
- GET /api/health
- GET /api/overview/latest

Implemented on server but not currently called by main frontend flows:

- GET /api/fixed/latest
- GET /api/conventional/latest
- GET /api/auth/me

## 6) MQTT Defaults and Startup Fallback

If env vars are missing, server defaults are:

- MQTT_BROKER_URL: mqtt://localhost:1883
- MQTT_USERNAME: guest
- MQTT_PASSWORD: guest
- MQTT_QOS: 1
- MQTT_FORECAST_ENABLED: false

Write queue default:

- DB_WRITE_CONCURRENCY: 2

Startup behavior:

- REST API starts regardless.
- MQTT connect/subscribe is attempted in a try/catch block.
- forecast worker starts only when MQTT_FORECAST_ENABLED=true.
- if MQTT init fails, server logs warning and continues running REST endpoints.

## 7) Source Files Used for This Reference

- server/src/index.ts
- server/src/lib/mqtt.ts
- server/src/lib/forecastWorker.ts
- server/src/lib/annPrediction.ts
- server/src/lib/writeQueue.ts
- server/src/middleware/requireAuth.ts
- server/src/routes/fixed.ts
- server/src/routes/conventional.ts
- server/src/routes/ann.ts
- server/src/routes/auth.ts
- server/src/routes/dev.ts
- server/prisma/schema.prisma
- src/features/auth/pages/LoginPage.tsx
- src/app/layout/AppShell.tsx
- src/features/solar-monitoring/hooks/usePanelTrackerData.ts
- src/features/solar-monitoring/hooks/useAnnDashboardData.ts
- src/features/solar-monitoring/pages/AnnPanelPage.tsx
- src/features/solar-monitoring/pages/OverviewPage.tsx
- src/features/solar-monitoring/pages/DevPage.tsx
- src/shared/types/ann.ts
