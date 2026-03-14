import { useState, useTransition } from 'react'
import { BatteryCharging, GaugeCircle, LineChart, SunMedium, Waves } from 'lucide-react'
import { ChartCard } from '@/features/solar-monitoring/components/ChartCard'
import { HistoricalLogTable } from '@/features/solar-monitoring/components/HistoricalLogTable'
import { MetricCard } from '@/features/solar-monitoring/components/MetricCard'
import { PageHeader } from '@/features/solar-monitoring/components/PageHeader'
import { TimelineCard } from '@/features/solar-monitoring/components/TimelineCard'
import { usePanelTrackerData } from '@/features/solar-monitoring/hooks/usePanelTrackerData'
import { panels } from '@/features/solar-monitoring/data/mock-data'
import type { TimeRange } from '@/shared/types/solar'

export function FixedPanelPage() {
  const panel = panels.fixed
  const [range, setRange] = useState<TimeRange>('live')
  const [, startTransition] = useTransition()
  const telemetry = usePanelTrackerData('fixed', range)
  const sample = telemetry.sample ?? {
    label: 'N/A',
    voltage: 0,
    current: 0,
    power: 0,
    energy: 0,
  }

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow="Fixed panel"
        title="Fixed Panel"
        description="Baseline output and stability."
        connection={panel.connection}
        status={panel.status}
        lastUpdated={telemetry.lastUpdated}
        range={range}
        onRangeChange={(nextRange) => startTransition(() => setRange(nextRange))}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <MetricCard icon={GaugeCircle} label="Voltage" value={sample.voltage} unit="V" note="Stable electrical potential" />
        <MetricCard icon={Waves} label="Current" value={sample.current} unit="A" note="Smooth midday current band" tone="lime" />
        <MetricCard icon={BatteryCharging} label="Power" value={sample.power} note="Current live output" tone="amber" format="power" />
        <MetricCard icon={SunMedium} label="Energy today" value={telemetry.energyToday} note="Accumulated from tracker log" format="energy" />
        <MetricCard icon={LineChart} label="Efficiency" value={telemetry.efficiency} note="Calculated from live DB telemetry" tone="rose" format="percent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <ChartCard
          title="Electrical Performance"
          subtitle="Voltage, current, and power."
          data={telemetry.series}
          series={[
            { key: 'voltage', label: 'Voltage', color: '#38bdf8', type: 'line' },
            { key: 'current', label: 'Current', color: '#bef264', type: 'line' },
            { key: 'power', label: 'Power', color: '#fbbf24', type: 'area' },
          ]}
        />
        <TimelineCard
          title="Reference Timeline"
          description="Simple, low-variance activity supports its role as the control system."
          items={panel.timeline}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <ChartCard
          title="Energy Generation Trend"
          subtitle="Energy and cumulative production."
          data={telemetry.energySeries}
          series={[
            { key: 'energy', label: 'Energy', color: '#38bdf8', type: 'bar' },
            { key: 'cumulative', label: 'Cumulative', color: '#bef264', type: 'line' },
          ]}
          formatValue={(value) => `${value.toFixed(2)} kWh`}
        />
        <div className="grid gap-4">
          <MetricCard icon={SunMedium} label="Peak power" value={telemetry.peakPower} note="Best observed output in tracker logs" tone="amber" format="power" />
          <MetricCard icon={LineChart} label="System role" value={84} note="Used as the baseline for all comparative analysis" tone="cyan" format="percent" />
        </div>
      </div>

      <HistoricalLogTable
        rows={telemetry.historyRows}
        title="Fixed Panel Historical Log"
        description="Live measurements from the Fixed panel database logs."
      />
    </div>
  )
}
