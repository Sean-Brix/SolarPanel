import { useMemo, useState } from 'react'
import { PageHeader } from '@/features/solar-monitoring/components/PageHeader'

type PanelKey = 'fixed' | 'conventional' | 'ann'
type DemoPreset = 'quick' | 'demo' | 'extended'

type ApiResults = Record<string, string>
type ApiLoading = Record<string, boolean>

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
                    {panel === 'fixed'
                      ? JSON.stringify(
                          {
                            voltage: 12.4,
                            current: 2.1,
                            power: 26.04,
                          },
                          null,
                          2
                        )
                      : JSON.stringify(
                          {
                            voltage: 13.3,
                            current: 2.6,
                            power: 34.58,
                            axisX: 42.0,
                            axisY: -11.5,
                            axisZ: 0.3,
                            ldrTop: 1,
                            ldrBottom: 0,
                            ldrLeft: 1,
                            ldrRight: 0,
                          },
                          null,
                          2
                        )}
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
                    {`mosquitto_pub -h 8c8f0dbc419240d09dfc75c1cfff9c78.s1.eu.hivemq.cloud -p 8883 --tls-version tlsv1.2 -u helios -P Helios123 -t "helios/readings/${panel}" -m '{${
                      panel === 'fixed'
                        ? 'voltage: 12.4, current: 2.1, power: 26.04'
                        : 'voltage: 13.3, current: 2.6, power: 34.58, axisX: 42.0, axisY: -11.5, axisZ: 0.3, ldrTop: 1, ldrBottom: 0, ldrLeft: 1, ldrRight: 0'
                    }}'`}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-green-300 bg-green-50 p-3 dark:border-green-400/30 dark:bg-green-950/30">
          <p className="text-xs text-green-800 dark:text-green-200">
            ✓ Readings published to these topics are automatically validated and stored in the database. Query them with <span className="font-mono">/api/{'{panel}'}/history</span>
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Dataset Tools</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Create realistic demo telemetry for all panels in one request, or wipe everything and start from zero.
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
            onClick={() =>
              void callEndpoint('demo-generate', '/api/dev/generate-demo', {
                method: 'POST',
                body: JSON.stringify({ preset: demoPreset }),
              })
            }
            disabled={loading['demo-generate']}
            className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-60"
          >
            {loading['demo-generate'] ? 'Generating dataset...' : 'Generate realistic demo data'}
          </button>

          <button
            type="button"
            onClick={() => {
              const approved = window.confirm(
                'Delete all fixed, conventional, and ANN records? This cannot be undone.',
              )

              if (!approved) {
                return
              }

              void callEndpoint('demo-wipe', '/api/dev/panel-logs', {
                method: 'DELETE',
              })
            }}
            disabled={loading['demo-wipe']}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-60"
          >
            {loading['demo-wipe'] ? 'Deleting all records...' : 'Delete all panel logs'}
          </button>
        </div>

        <pre className="mt-3 max-h-64 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
          {results['demo-generate'] || results['demo-wipe'] || '{\n  "info": "No dataset action yet"\n}'}
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
          Real-time message broker configuration and published topics for ESP32 devices.
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
            <div className="mt-3 space-y-3">
              <div className="rounded-xl border border-cyan-300 bg-cyan-50 p-3 dark:border-cyan-400/30 dark:bg-cyan-950/30">
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-lg bg-cyan-600 px-2 py-1 font-mono text-xs font-semibold text-white">
                    PUB
                  </span>
                  <span className="font-mono font-semibold text-cyan-900 dark:text-cyan-100">helios/forecast</span>
                </div>
                <p className="mt-2 text-xs text-cyan-800 dark:text-cyan-200">
                  Hourly weather forecasts published to guide device decision-making (e.g., tracker movement, power conservation).
                </p>
                <div className="mt-3 rounded-lg bg-white p-2 dark:bg-slate-900">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Payload Example:</p>
                  <pre className="mt-1 overflow-auto text-xs text-slate-600 dark:text-slate-400">
{`{
  "timestamp": "2026-03-30T10:00:00+08:00",
  "hour": 10,
  "weatherCode": 2,
  "weatherLabel": "Partly cloudy",
  "tempC": 33.4,
  "humidityPct": 62,
  "windKph": 14.2
}`}
                  </pre>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-cyan-800 dark:text-cyan-200">
                  <div>
                    <span className="font-semibold">Publish Schedule:</span> On startup + every hour (0 min past)
                  </div>
                  <div>
                    <span className="font-semibold">Retain:</span> ✓ Yes (new subscribers receive latest)
                  </div>
                  <div>
                    <span className="font-semibold">Data Source:</span> Open-Meteo API (Manila, Philippines)
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-slate-50 p-3 dark:border-white/10 dark:bg-slate-900">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">
              Weather Codes Reference
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              WMO codes used in <span className="font-mono">weatherCode</span> field:
            </p>
            <div className="mt-2 grid gap-1 font-mono text-xs text-slate-700 dark:text-slate-300">
              <div><span className="inline-block w-6 text-right text-slate-600 dark:text-slate-400">0</span> — Clear</div>
              <div><span className="inline-block w-6 text-right text-slate-600 dark:text-slate-400">1</span> — Mostly clear</div>
              <div><span className="inline-block w-6 text-right text-slate-600 dark:text-slate-400">2</span> — Partly cloudy</div>
              <div><span className="inline-block w-6 text-right text-slate-600 dark:text-slate-400">3</span> — Overcast</div>
              <div><span className="inline-block w-6 text-right text-slate-600 dark:text-slate-400">45</span> — Foggy</div>
              <div><span className="inline-block w-6 text-right text-slate-600 dark:text-slate-400">51–55</span> — Drizzle</div>
              <div><span className="inline-block w-6 text-right text-slate-600 dark:text-slate-400">61–65</span> — Rain</div>
              <div><span className="inline-block w-6 text-right text-slate-600 dark:text-slate-400">71–77</span> — Snow</div>
              <div><span className="inline-block w-6 text-right text-slate-600 dark:text-slate-400">80–82</span> — Rain showers</div>
              <div><span className="inline-block w-6 text-right text-slate-600 dark:text-slate-400">95–99</span> — Thunderstorm</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
