import { useMemo } from 'react'
import { BatteryCharging, GaugeCircle, Orbit, Repeat2, Waves } from 'lucide-react'
import { ChartCard } from '@/features/solar-monitoring/components/ChartCard'
import { HistoricalLogTable } from '@/features/solar-monitoring/components/HistoricalLogTable'
import { MetricCard } from '@/features/solar-monitoring/components/MetricCard'
import { PageHeader } from '@/features/solar-monitoring/components/PageHeader'
import { TimelineCard } from '@/features/solar-monitoring/components/TimelineCard'
import { TrackerPositionCard } from '@/features/solar-monitoring/components/TrackerPositionCard'
import { usePanelTrackerData } from '@/features/solar-monitoring/hooks/usePanelTrackerData'
import { panels } from '@/features/solar-monitoring/data/mock-data'
import type { TimeRange } from '@/shared/types/solar'

export function ConventionalPanelPage() {
  const panel = panels.conventional
  const range = useMemo<TimeRange>(() => 'daily', [])
  const telemetry = usePanelTrackerData('conventional', range)
  const sample = telemetry.sample ?? {
    label: 'N/A',
    voltage: 0,
    current: 0,
    power: 0,
    energy: 0,
    movementCount: 0,
    movementCost: 0,
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow="Tracking panel"
        title="Conventional Tracker"
        description="Higher output with higher movement cost."
        connection={panel.connection}
        status={panel.status}
        lastUpdated={telemetry.lastUpdated}
      />

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3 2xl:grid-cols-5">
        <MetricCard icon={GaugeCircle} label="Voltage" value={sample.voltage} unit="V" note="Tracker-aligned voltage band" />
        <MetricCard icon={Waves} label="Current" value={sample.current} unit="A" note="Strong current under direct incidence" tone="lime" />
        <MetricCard icon={BatteryCharging} label="Power" value={sample.power} note="Raw tracker output" tone="amber" format="power" />
        <MetricCard icon={Repeat2} label="Movement cost" value={telemetry.movementEnergy} note="Calculated from tracker axis changes" tone="rose" format="energy" />
        <MetricCard icon={Orbit} label="Efficiency" value={telemetry.efficiency} note="Computed from DB tracker logs" format="percent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        {telemetry.tracker ? <TrackerPositionCard tracker={telemetry.tracker} /> : null}
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
          data={telemetry.series}
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
          data={telemetry.series}
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
          data={telemetry.energySeries}
          series={[
            { key: 'energy', label: 'Energy', color: '#38bdf8', type: 'bar' },
            { key: 'cumulative', label: 'Cumulative', color: '#bef264', type: 'line' },
          ]}
          formatValue={(value) => `${value.toFixed(2)} kWh`}
        />
        <div className="grid gap-4">
          <MetricCard icon={Orbit} label="Peak power" value={telemetry.peakPower} note="Highest observed conventional spike" tone="amber" format="power" />
          <MetricCard icon={Repeat2} label="Adjustments" value={telemetry.movementCount} note="Total tracker steps from DB logs" tone="rose" />
        </div>
      </div>

      <HistoricalLogTable
        rows={telemetry.historyRows}
        title="Conventional Tracker Log"
        description="Live snapshots with tracker position and output from database telemetry."
      />
    </div>
  )
}
