import { useMemo, useState } from 'react'
import { PageHeader } from '@/features/solar-monitoring/components/PageHeader'
import { cn } from '@/shared/lib/cn'

type PanelKey = 'fixed' | 'conventional' | 'ann'

type PanelPayloads = Record<PanelKey, string>
type ApiResults = Record<string, string>
type ApiLoading = Record<string, boolean>

const defaultPayloads: PanelPayloads = {
  fixed: JSON.stringify(
    {
      voltage: 12.4,
      current: 2.1,
      power: 26.04,
    },
    null,
    2,
  ),
  conventional: JSON.stringify(
    {
      voltage: 13.1,
      current: 2.5,
      power: 32.75,
      axisX: 45.2,
      axisY: -12.8,
      axisZ: 0.1,
      ldrTop: 1,
      ldrBottom: 0,
      ldrLeft: 0,
      ldrRight: 1,
    },
    null,
    2,
  ),
  ann: JSON.stringify(
    {
      voltage: 13.3,
      current: 2.6,
      power: 34.58,
      axisX: 42,
      axisY: -11.5,
      axisZ: 0.3,
      ldrTop: 1,
      ldrBottom: 0,
      ldrLeft: 1,
      ldrRight: 0,
    },
    null,
    2,
  ),
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
  const [payloads, setPayloads] = useState<PanelPayloads>(defaultPayloads)
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

  async function postPanel(panel: PanelKey) {
    const raw = payloads[panel]

    let parsed: unknown

    try {
      parsed = JSON.parse(raw)
    } catch {
      setResults((prev) => ({
        ...prev,
        [`${panel}-post`]: JSON.stringify(
          {
            status: 'INVALID_JSON',
            ok: false,
            endpoint: `/api/${panel}`,
            body: 'Payload is not valid JSON',
          },
          null,
          2,
        ),
      }))
      return
    }

    await callEndpoint(`${panel}-post`, `/api/${panel}`, {
      method: 'POST',
      body: JSON.stringify(parsed),
    })
  }

  function sectionTitle(panel: PanelKey) {
    if (panel === 'ann') return 'ANN Panel'
    if (panel === 'conventional') return 'Conventional Panel'
    return 'Fixed Panel'
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

      <div className="grid gap-4 xl:grid-cols-3">
        {(['fixed', 'conventional', 'ann'] as PanelKey[]).map((panel) => (
          <section key={panel} className="rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{sectionTitle(panel)}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Test POST, latest, and history for <span className="font-medium">/api/{panel}</span>.
            </p>

            <label className="mt-3 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Payload JSON
            </label>
            <textarea
              value={payloads[panel]}
              onChange={(event) =>
                setPayloads((prev) => ({
                  ...prev,
                  [panel]: event.target.value,
                }))
              }
              className="mt-2 h-48 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            />

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => void postPanel(panel)}
                disabled={loading[`${panel}-post`]}
                className={cn(
                  'rounded-xl px-3 py-2 text-xs font-semibold',
                  'bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-60',
                )}
              >
                {loading[`${panel}-post`] ? 'Posting...' : 'POST'}
              </button>
              <button
                type="button"
                onClick={() => void callEndpoint(`${panel}-latest`, `/api/${panel}/latest`)}
                disabled={loading[`${panel}-latest`]}
                className={cn(
                  'rounded-xl px-3 py-2 text-xs font-semibold',
                  'bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-slate-700 dark:hover:bg-slate-600',
                )}
              >
                {loading[`${panel}-latest`] ? 'Loading...' : 'Latest'}
              </button>
              <button
                type="button"
                onClick={() => void callEndpoint(`${panel}-history`, `/api/${panel}/history?limit=5`)}
                disabled={loading[`${panel}-history`]}
                className={cn(
                  'rounded-xl px-3 py-2 text-xs font-semibold',
                  'bg-slate-100 text-slate-800 hover:bg-slate-200 disabled:opacity-60 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
                )}
              >
                {loading[`${panel}-history`] ? 'Loading...' : 'History'}
              </button>
            </div>

            <pre className="mt-3 max-h-56 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
              {results[`${panel}-post`] || results[`${panel}-latest`] || results[`${panel}-history`] || '{\n  "info": "No request yet"\n}'}
            </pre>
          </section>
        ))}
      </div>

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
    </div>
  )
}
