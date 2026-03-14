import { useState, useTransition } from 'react'
import { BatteryCharging, GaugeCircle, Orbit, Repeat2, Waves } from 'lucide-react'
import { ChartCard } from '@/features/solar-monitoring/components/ChartCard'
import { HistoricalLogTable } from '@/features/solar-monitoring/components/HistoricalLogTable'
import { MetricCard } from '@/features/solar-monitoring/components/MetricCard'
import { PageHeader } from '@/features/solar-monitoring/components/PageHeader'
import { TimelineCard } from '@/features/solar-monitoring/components/TimelineCard'
import { TrackerPositionCard } from '@/features/solar-monitoring/components/TrackerPositionCard'
import { useMockTelemetry } from '@/features/solar-monitoring/hooks/useMockTelemetry'
import { getPanelRangeEnergy, history, panels } from '@/features/solar-monitoring/data/mock-data'
import type { TimeRange } from '@/shared/types/solar'

export function ConventionalPanelPage() {
  const panel = panels.conventional
  const [range, setRange] = useState<TimeRange>('live')
  const [, startTransition] = useTransition()
  const telemetry = useMockTelemetry(panel.ranges.live)
  const sample = telemetry.sample ?? panel.ranges.live[0]

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow="Tracking panel"
        title="Conventional Tracker"
        description="Higher output with higher movement cost."
        connection={panel.connection}
        status={panel.status}
        lastUpdated={telemetry.updatedAt}
        range={range}
        onRangeChange={(nextRange) => startTransition(() => setRange(nextRange))}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <MetricCard icon={GaugeCircle} label="Voltage" value={sample.voltage} unit="V" note="Tracker-aligned voltage band" />
        <MetricCard icon={Waves} label="Current" value={sample.current} unit="A" note="Strong current under direct incidence" tone="lime" />
        <MetricCard icon={BatteryCharging} label="Power" value={sample.power} note="Raw tracker output" tone="amber" format="power" />
        <MetricCard icon={Repeat2} label="Movement cost" value={panel.metrics.movementEnergy ?? 0} note="Estimated actuation energy today" tone="rose" format="energy" />
        <MetricCard icon={Orbit} label="Efficiency" value={panel.metrics.efficiency} note="High capture with mechanical overhead" format="percent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        {panel.tracker ? <TrackerPositionCard tracker={panel.tracker} /> : null}
        <TimelineCard
          title="Movement Timeline"
          description="Tracking events and movement cost."
          items={panel.timeline}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Electrical Performance"
          subtitle="Output while tracking the sun path."
          data={panel.ranges[range]}
          series={[
            { key: 'voltage', label: 'Voltage', color: '#38bdf8', type: 'line' },
            { key: 'current', label: 'Current', color: '#bef264', type: 'line' },
            { key: 'power', label: 'Power', color: '#fbbf24', type: 'area' },
          ]}
          formatValue={(value) => `${value.toFixed(1)}`}
        />
        <ChartCard
          title="Movement Activity"
          subtitle="Adjustment count and movement energy."
          data={panel.ranges[range]}
          series={[
            { key: 'movementCount', label: 'Movement count', color: '#fbbf24', type: 'bar' },
            { key: 'movementCost', label: 'Movement cost', color: '#fb7185', type: 'line' },
          ]}
          formatValue={(value) => `${value.toFixed(2)}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <ChartCard
          title="Energy Generation Trend"
          subtitle="Energy trend with actuation overhead."
          data={getPanelRangeEnergy('conventional', range)}
          series={[
            { key: 'energy', label: 'Energy', color: '#38bdf8', type: 'bar' },
            { key: 'cumulative', label: 'Cumulative', color: '#bef264', type: 'line' },
          ]}
          formatValue={(value) => `${value.toFixed(2)} kWh`}
        />
        <div className="grid gap-4">
          <MetricCard icon={Orbit} label="Peak power" value={panel.metrics.peakPower} note="Highest observed conventional spike" tone="amber" format="power" />
          <MetricCard icon={Repeat2} label="Adjustments" value={panel.tracker?.movementCount ?? 0} note="Total tracker steps in the current day" tone="rose" />
        </div>
      </div>

      <HistoricalLogTable
        rows={history.conventional}
        title="Conventional Tracker Log"
        description="Snapshots with tracker position and output."
      />
    </div>
  )
}
