import { Compass, MoveUpRight, Orbit, TimerReset } from 'lucide-react'
import type { TrackerStatus } from '@/shared/types/solar'
import { formatNumber } from '@/shared/lib/formatters'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

type TrackerPositionCardProps = {
  tracker: TrackerStatus
}

function StatPanel({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: string
  hint: string
  icon: typeof Compass
}) {
  return (
    <div className="min-w-0 rounded-[24px] border border-slate-200 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <Icon className="h-4 w-4 text-cyan-300" />
        <span className="text-wrap-anywhere">{label}</span>
      </div>
      <p className="text-wrap-anywhere mt-3 text-2xl font-semibold text-slate-900 dark:text-white sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{hint}</p>
    </div>
  )
}

function DetailPanel({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0 rounded-[22px] border border-slate-200 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-slate-950/55">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="text-wrap-anywhere mt-2 text-base font-medium text-slate-900 dark:text-white">
        {value}
      </p>
    </div>
  )
}

export function TrackerPositionCard({ tracker }: TrackerPositionCardProps) {
  const compassSize = 240
  const center = compassSize / 2
  const outerRadius = 88
  const innerRadius = 68

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tracker Orientation</CardTitle>
        <CardDescription>
          Current pointing direction with the movement details that matter most.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
        <div className="mx-auto w-full max-w-[280px]">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50/90 p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="mx-auto flex aspect-square w-full max-w-[240px] items-center justify-center rounded-full border border-slate-200 bg-white/90 dark:border-white/10 dark:bg-slate-950/60">
              <svg
                viewBox={`0 0 ${compassSize} ${compassSize}`}
                className="h-[80%] w-[80%]"
                aria-label={`Compass pointing ${tracker.heading} at ${tracker.azimuth} degrees`}
                role="img"
              >
                <circle
                  cx={center}
                  cy={center}
                  r={outerRadius}
                  className="fill-slate-100 stroke-slate-300 dark:fill-slate-950/80 dark:stroke-white/10"
                  strokeWidth="2"
                />
                <circle
                  cx={center}
                  cy={center}
                  r={innerRadius}
                  fill="none"
                  strokeDasharray="5 7"
                  className="stroke-slate-300 dark:stroke-white/10"
                  strokeWidth="2"
                />

                <g transform={`rotate(${tracker.azimuth} ${center} ${center})`}>
                  <line
                    x1={center}
                    y1={center + 14}
                    x2={center}
                    y2={center - 52}
                    stroke="#38bdf8"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  <polygon
                    points={`${center},${center - 78} ${center - 12},${center - 48} ${center + 12},${center - 48}`}
                    fill="#38bdf8"
                  />
                  <line
                    x1={center}
                    y1={center + 8}
                    x2={center}
                    y2={center + 34}
                    stroke="#94a3b8"
                    strokeWidth="4"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                </g>

                <circle
                  cx={center}
                  cy={center}
                  r="10"
                  className="fill-white stroke-slate-300 dark:fill-slate-100 dark:stroke-white/20"
                  strokeWidth="2"
                />

                <text
                  x={center}
                  y="28"
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-semibold tracking-[0.18em]"
                >
                  N
                </text>
                <text
                  x={center}
                  y={compassSize - 16}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-semibold tracking-[0.18em]"
                >
                  S
                </text>
                <text
                  x="24"
                  y={center + 4}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-semibold tracking-[0.18em]"
                >
                  W
                </text>
                <text
                  x={compassSize - 24}
                  y={center + 4}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-semibold tracking-[0.18em]"
                >
                  E
                </text>
              </svg>
            </div>
            <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
              Heading {tracker.heading}
            </p>
          </div>
        </div>

        <div className="grid min-w-0 gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <StatPanel
              label="Azimuth"
              value={`${formatNumber(tracker.azimuth, 0)} deg`}
              hint={tracker.heading}
              icon={Compass}
            />
            <StatPanel
              label="Elevation"
              value={`${formatNumber(tracker.elevation, 0)} deg`}
              hint="Current tilt above horizon"
              icon={MoveUpRight}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DetailPanel label="Mode" value={tracker.mode} />
            <DetailPanel label="Moves today" value={`${tracker.movementCount}`} />
            <DetailPanel
              label="Travel span"
              value={`${formatNumber(tracker.travelDegrees, 0)} deg`}
            />
            <DetailPanel label="Next adjustment" value={tracker.nextAdjustment} />
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100/85 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
              <Orbit className="h-4 w-4 text-lime-300" />
              Controlled travel window
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100/85 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
              <TimerReset className="h-4 w-4 text-amber-300" />
              Next move {tracker.nextAdjustment}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
