import { useMemo, useState } from 'react'
import { PageHeader } from '@/features/solar-monitoring/components/PageHeader'

type PanelKey = 'fixed' | 'conventional' | 'ann'
type DemoPreset = 'quick' | 'demo' | 'extended'
type ResetTarget = PanelKey | 'all'

type ApiResults = Record<string, string>
type ApiLoading = Record<string, boolean>

const MQTT_SAMPLE_PAYLOADS: Record<PanelKey, Record<string, unknown>> = {
  fixed: {
    voltage: 18.62,
    current: 1.34,
    power: 24.95,
  },
  conventional: {
    voltage: 19.11,
    current: 1.73,
    power: 33.06,
    axisX: 47.2,
    axisY: -12.8,
    axisZ: 0.46,
    ldrTop: 1,
    ldrBottom: 0,
    ldrLeft: 1,
    ldrRight: 0,
  },
  ann: {
    setId: 2,
    samples: [
      {
        sampleNo: 1,
        ldr1: 940,
        ldr2: 235,
        ldr3: 1005,
        ldr4: 996,
        accx: 4214,
        accy: 6028,
        accz: -13942,
        gyrox: -305,
        gyroy: 269,
        gyroz: 174,
        voltage: 21.84,
        current_ma: 1124,
        power_mw: 24540,
        relay1: 1,
        relay2: 0,
        relay3: 1,
        relay4: 0,
      },
      {
        sampleNo: 2,
        ldr1: 965,
        ldr2: 221,
        ldr3: 1018,
        ldr4: 1002,
        accx: 4326,
        accy: 6178,
        accz: -14035,
        gyrox: -287,
        gyroy: 281,
        gyroz: 181,
        voltage: 21.91,
        current_ma: 1153,
        power_mw: 25261,
        relay1: 1,
        relay2: 0,
        relay3: 1,
        relay4: 0,
      },
      {
        sampleNo: 3,
        ldr1: 988,
        ldr2: 214,
        ldr3: 1024,
        ldr4: 1009,
        accx: 4382,
        accy: 6249,
        accz: -14084,
        gyrox: -274,
        gyroy: 295,
        gyroz: 188,
        voltage: 21.95,
        current_ma: 1172,
        power_mw: 25735,
        relay1: 1,
        relay2: 0,
        relay3: 1,
        relay4: 0,
      },
      {
        sampleNo: 4,
        ldr1: 1006,
        ldr2: 208,
        ldr3: 1028,
        ldr4: 1015,
        accx: 4441,
        accy: 6336,
        accz: -14121,
        gyrox: -262,
        gyroy: 304,
        gyroz: 192,
        voltage: 22.01,
        current_ma: 1186,
        power_mw: 26103,
        relay1: 1,
        relay2: 0,
        relay3: 1,
        relay4: 0,
      },
    ],
    predictedWeather: {
      timestamp: '2026-04-03T20:00',
      hour: 20,
      weatherCode: 1,
      weather: 'Mainly clear',
      tempC: 28.9,
      humidityPct: 68,
    },
    predictedNextSample: {
      ldr1: 1018,
      ldr2: 202,
      ldr3: 1032,
      ldr4: 1020,
      accx: 4508,
      accy: 6421,
      accz: -14188,
      gyrox: -249,
      gyroy: 312,
      gyroz: 199,
      voltage: 22.04,
      current_ma: 1193,
      power_mw: 26303,
      relay1: 1,
      relay2: 0,
      relay3: 1,
      relay4: 0,
    },
    actualWeather: {
      timestamp: '2026-04-03T20:00',
      hour: 20,
      weatherCode: 2,
      weather: 'Partly cloudy',
      tempC: 29.8,
      humidityPct: 74,
    },
    actualNextSample: {
      ldr1: 952,
      ldr2: 294,
      ldr3: 987,
      ldr4: 1007,
      accx: 4313,
      accy: 5998,
      accz: -13974,
      gyrox: -339,
      gyroy: 266,
      gyroz: 164,
      voltage: 21.72,
      current_ma: 1105,
      power_mw: 23996,
      relay1: 0,
      relay2: 0,
      relay3: 1,
      relay4: 0,
    },
    weatherCheck: {
      weatherCodeResult: 'INCORRECT',
      timeResult: 'CORRECT',
      tempResult: 'CORRECT',
      humidityResult: 'INCORRECT',
    },
    predictionCheck: {
      sensorResult: 'NOT CORRECT',
      overallResult: 'NOT CORRECT',
      details: [
        {
          field: 'LDR1',
          predicted: 1018,
          actual: 952,
          diff: 66,
          tol: 60,
          result: 'NO',
        },
        {
          field: 'LDR2',
          predicted: 202,
          actual: 294,
          diff: 92,
          tol: 60,
          result: 'NO',
        },
        {
          field: 'GYROX',
          predicted: -249,
          actual: -339,
          diff: 90,
          tol: 120,
          result: 'OK',
        },
        {
          field: 'VOLTAGE',
          predicted: 22.04,
          actual: 21.72,
          diff: 0.32,
          tol: 1.5,
          result: 'OK',
        },
        {
          field: 'RELAY1',
          predicted: 1,
          actual: 0,
          diff: 1,
          tol: 0,
          result: 'NO',
        },
      ],
    },
  },
}

const MQTT_SAMPLE_PAYLOAD_STRINGS: Record<PanelKey, string> = {
  fixed: JSON.stringify(MQTT_SAMPLE_PAYLOADS.fixed),
  conventional: JSON.stringify(MQTT_SAMPLE_PAYLOADS.conventional),
  ann: JSON.stringify(MQTT_SAMPLE_PAYLOADS.ann),
}

const RESET_CONFIRM_PHRASES: Record<ResetTarget, string> = {
  fixed: 'RESET FIXED',
  conventional: 'RESET CONVENTIONAL',
  ann: 'RESET ANN',
  all: 'RESET ALL PANELS',
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function DevPage() {
  const [demoPreset, setDemoPreset] = useState<DemoPreset>('demo')
  const [results, setResults] = useState<ApiResults>({})
  const [loading, setLoading] = useState<ApiLoading>({})
  const [datasetResultKey, setDatasetResultKey] = useState('')

  const token = useMemo(() => localStorage.getItem('token'), [])

  async function callEndpoint(key: string, endpoint: string, init?: RequestInit) {
    setLoading((prev) => ({ ...prev, [key]: true }))

    try {
      const headers = new Headers(init?.headers)

      if (!headers.has('Content-Type') && init?.body) {
        headers.set('Content-Type', 'application/json')
      }

      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }

      const response = await fetch(endpoint, { ...init, headers })
      const body = await parseResponseBody(response)

      setResults((prev) => ({
        ...prev,
        [key]: JSON.stringify(
          {
            status: response.status,
            ok: response.ok,
            endpoint,
            body,
          },
          null,
          2,
        ),
      }))
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [key]: JSON.stringify(
          {
            status: 'NETWORK_ERROR',
            ok: false,
            endpoint,
            body: error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        ),
      }))
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }))
    }
  }

  function resetResultKeyFor(target: ResetTarget) {
    return `demo-wipe-${target}`
  }

  async function resetPanelLogs(target: ResetTarget) {
    const key = resetResultKeyFor(target)
    setDatasetResultKey(key)

    const phrase = RESET_CONFIRM_PHRASES[target]
    const message =
      target === 'all'
        ? `Type "${phrase}" to delete FIXED, CONVENTIONAL, and ANN data.`
        : `Type "${phrase}" to delete ${target.toUpperCase()} data.`

    const confirmation = window.prompt(message, '')

    if (confirmation !== phrase) {
      setResults((prev) => ({
        ...prev,
        [key]: JSON.stringify(
          {
            status: 'CONFIRMATION_ABORTED',
            ok: false,
            endpoint: target === 'all' ? '/api/dev/panel-logs/all' : `/api/dev/panel-logs/${target}`,
            body: `Expected exact phrase: ${phrase}`,
          },
          null,
          2,
        ),
      }))
      return
    }

    const endpoint = target === 'all' ? '/api/dev/panel-logs/all' : `/api/dev/panel-logs/${target}`
    await callEndpoint(key, endpoint, { method: 'DELETE' })
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow="Developer Tools"
        title="ESP32 Endpoint Dev Page"
        description="Send sample telemetry and inspect every response from your API."
        connection="Live API testing"
        status="optimal"
        lastUpdated={new Date()}
      />

      <div className="rounded-3xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-slate-700 dark:text-amber-100">
        Dev mode helper: this page calls <span className="font-semibold">/api/*</span> directly. Make sure your Express server is running.
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">MQTT Panel Readings</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          ESP32 devices publish readings directly to MQTT topics. These topics are automatically processed and stored in the database.
        </p>

        <div className="mt-4 space-y-4">
          {(['fixed', 'conventional', 'ann'] as PanelKey[]).map((panel) => (
            <div key={panel} className="rounded-2xl border border-slate-300 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">
                <span className="inline-block rounded-lg bg-violet-600 px-2 py-1 text-white">PUB</span>
                helios/readings/{panel}
              </h3>

              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Example Payload:</p>
                  <pre className="mt-1 overflow-auto rounded-lg bg-white p-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                    {JSON.stringify(MQTT_SAMPLE_PAYLOADS[panel], null, 2)}
                  </pre>
                </div>

                <div className="flex gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex-1">
                    <span className="font-semibold">QoS:</span> 1 (at-least-once)
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold">Retain:</span> true
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Test with mosquitto_pub:</p>
                  <pre className="mt-1 overflow-auto rounded-lg bg-white p-2 font-mono text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">
                    {`mosquitto_pub -h 8c8f0dbc419240d09dfc75c1cfff9c78.s1.eu.hivemq.cloud -p 8883 --tls-version tlsv1.2 -u helios -P Helios123 -t "helios/readings/${panel}" -m '${MQTT_SAMPLE_PAYLOAD_STRINGS[panel]}'`}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-green-300 bg-green-50 p-3 dark:border-green-400/30 dark:bg-green-950/30">
          <p className="text-xs text-green-800 dark:text-green-200">
            Readings published to these topics are validated and stored. Query with <span className="font-mono">/api/{'{panel}'}/history</span> and ANN with <span className="font-mono">/api/ann/history</span>.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dataset Tools</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Create realistic demo telemetry for all panels, then reset panel data individually or wipe all data.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex min-w-[180px] flex-col gap-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Dataset size
            <select
              value={demoPreset}
              onChange={(event) => setDemoPreset(event.target.value as DemoPreset)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="quick">Quick demo (~96 rows/panel, 24h)</option>
              <option value="demo">Balanced demo (~240 rows/panel, 5 days)</option>
              <option value="extended">Extended demo (~420 rows/panel, 9 days)</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setDatasetResultKey('demo-generate')
              void callEndpoint('demo-generate', '/api/dev/generate-demo', {
                method: 'POST',
                body: JSON.stringify({ preset: demoPreset }),
              })
            }}
            disabled={loading['demo-generate']}
            className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
          >
            {loading['demo-generate'] ? 'Generating dataset...' : 'Generate realistic demo data'}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void resetPanelLogs('fixed')}
            disabled={loading['demo-wipe-fixed']}
            className="rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
          >
            {loading['demo-wipe-fixed'] ? 'Resetting fixed...' : 'Reset fixed data'}
          </button>

          <button
            type="button"
            onClick={() => void resetPanelLogs('conventional')}
            disabled={loading['demo-wipe-conventional']}
            className="rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
          >
            {loading['demo-wipe-conventional'] ? 'Resetting conventional...' : 'Reset conventional data'}
          </button>

          <button
            type="button"
            onClick={() => void resetPanelLogs('ann')}
            disabled={loading['demo-wipe-ann']}
            className="rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-400 disabled:opacity-60"
          >
            {loading['demo-wipe-ann'] ? 'Resetting ANN...' : 'Reset ANN data'}
          </button>

          <button
            type="button"
            onClick={() => void resetPanelLogs('all')}
            disabled={loading['demo-wipe-all']}
            className="rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
          >
            {loading['demo-wipe-all'] ? 'Resetting all...' : 'Reset all panel data'}
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
          Every reset action uses a custom typed confirmation phrase before the API call is made.
        </p>

        <pre className="mt-3 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
          {results[datasetResultKey] || '{\n  "info": "No dataset action yet"\n}'}
        </pre>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Global Endpoints</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Quick checks for health and aggregated panel output.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void callEndpoint('health', '/api/health')}
            disabled={loading.health}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading.health ? 'Loading...' : 'GET /api/health'}
          </button>
          <button
            type="button"
            onClick={() => void callEndpoint('overview', '/api/overview/latest')}
            disabled={loading.overview}
            className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
          >
            {loading.overview ? 'Loading...' : 'GET /api/overview/latest'}
          </button>
        </div>

        <pre className="mt-3 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
          {results.overview || results.health || '{\n  "info": "No request yet"\n}'}
        </pre>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">MQTT Topics</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Real-time broker configuration and published topics for ESP32 devices.
        </p>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-slate-300 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">
              Broker Configuration
            </h3>
            <div className="mt-2 space-y-1 font-mono text-xs text-slate-700 dark:text-slate-300">
              <div>
                <span className="font-semibold text-slate-600 dark:text-slate-400">Broker URL:</span> mqtts://8c8f0dbc419240d09dfc75c1cfff9c78.s1.eu.hivemq.cloud:8883
              </div>
              <div>
                <span className="font-semibold text-slate-600 dark:text-slate-400">Username:</span> helios
              </div>
              <div>
                <span className="font-semibold text-slate-600 dark:text-slate-400">QoS:</span> 1 (at-least-once delivery)
              </div>
              <div>
                <span className="font-semibold text-slate-600 dark:text-slate-400">Protocol:</span> MQTT v4 (3.1.1)
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">
              Published Topics
            </h3>
            <div className="mt-2 grid gap-1 font-mono text-xs text-slate-700 dark:text-slate-300">
              <div>helios/readings/fixed</div>
              <div>helios/readings/conventional</div>
              <div>helios/readings/ann</div>
              <div>helios/forecast (only when MQTT_FORECAST_ENABLED=true)</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
