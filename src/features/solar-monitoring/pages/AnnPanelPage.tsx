import { useState, useTransition } from 'react'
import {
  BatteryCharging,
  CloudSun,
  Droplets,
  GaugeCircle,
  ThermometerSun,
  Waves,
} from 'lucide-react'
import { ChartCard } from '@/features/solar-monitoring/components/ChartCard'
import { HistoricalLogTable } from '@/features/solar-monitoring/components/HistoricalLogTable'
import { MetricCard } from '@/features/solar-monitoring/components/MetricCard'
import { NotificationPanel } from '@/features/solar-monitoring/components/NotificationPanel'
import { PageHeader } from '@/features/solar-monitoring/components/PageHeader'
import { PredictionCard } from '@/features/solar-monitoring/components/PredictionCard'
import { TimelineCard } from '@/features/solar-monitoring/components/TimelineCard'
import { TrackerPositionCard } from '@/features/solar-monitoring/components/TrackerPositionCard'
import { WeatherCard } from '@/features/solar-monitoring/components/WeatherCard'
import { useMockTelemetry } from '@/features/solar-monitoring/hooks/useMockTelemetry'
import {
  environments,
  getPanelRangeEnergy,
  history,
  notifications,
  panels,
  weather,
} from '@/features/solar-monitoring/data/mock-data'
import type { TimeRange } from '@/shared/types/solar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

export function AnnPanelPage() {
  const panel = panels.ann
  const [range, setRange] = useState<TimeRange>('live')
  const [, startTransition] = useTransition()
  const telemetry = useMockTelemetry(panel.ranges.live)
  const sample = telemetry.sample ?? panel.ranges.live[0]

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow="ANN smart panel"
        title="ANN Smart Panel"
        description="Smart tracking with prediction and weather context."
        connection={panel.connection}
        status={panel.status}
        lastUpdated={telemetry.updatedAt}
        range={range}
        onRangeChange={(nextRange) => startTransition(() => setRange(nextRange))}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          icon={GaugeCircle}
          label="Voltage"
          value={sample.voltage}
          unit="V"
          note="Live predicted-control voltage"
        />
        <MetricCard
          icon={Waves}
          label="Current"
          value={sample.current}
          unit="A"
          note="Current with selective tracking"
          tone="lime"
        />
        <MetricCard
          icon={BatteryCharging}
          label="Power"
          value={sample.power}
          note="Actual output right now"
          tone="amber"
          format="power"
        />
        <MetricCard
          icon={ThermometerSun}
          label="Temperature"
          value={panel.metrics.temperature ?? 0}
          unit="C"
          note="Ambient thermal input"
        />
        <MetricCard
          icon={Droplets}
          label="Humidity"
          value={panel.metrics.humidity ?? 0}
          unit="%"
          note="Moisture context for sensor state"
          tone="rose"
        />
        <MetricCard
          icon={CloudSun}
          label="Irradiance"
          value={sample.irradiance ?? 0}
          unit="W/m2"
          note="Solar resource observed now"
          tone="lime"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <WeatherCard environment={environments.ann} weather={weather} />
        {panel.tracker ? <TrackerPositionCard tracker={panel.tracker} /> : null}
      </div>

      <NotificationPanel items={notifications.ann} />

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Electrical Performance"
          subtitle="Electrical behavior across the selected window."
          data={panel.ranges[range]}
          series={[
            { key: 'voltage', label: 'Voltage', color: '#38bdf8', type: 'line' },
            { key: 'current', label: 'Current', color: '#bef264', type: 'line' },
            { key: 'power', label: 'Power', color: '#fbbf24', type: 'area' },
          ]}
        />
        <ChartCard
          title="Irradiance and Power"
          subtitle="Energy input vs panel output."
          data={panel.ranges[range]}
          series={[
            { key: 'irradiance', label: 'Irradiance', color: '#5eead4', type: 'area' },
            { key: 'power', label: 'Power', color: '#fbbf24', type: 'line' },
          ]}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <ChartCard
          title="Predicted vs Actual Power"
          subtitle="Prediction compared to measured output."
          data={panel.ranges[range]}
          series={[
            { key: 'predictedPower', label: 'Predicted', color: '#38bdf8', type: 'line' },
            { key: 'power', label: 'Actual', color: '#bef264', type: 'line' },
          ]}
          formatValue={(value) => `${value.toFixed(1)} W`}
        />
        <ChartCard
          title="Energy Trend"
          subtitle="Energy accumulation over time."
          data={getPanelRangeEnergy('ann', range)}
          series={[
            { key: 'energy', label: 'Energy', color: '#38bdf8', type: 'bar' },
            { key: 'cumulative', label: 'Cumulative', color: '#bef264', type: 'line' },
          ]}
          formatValue={(value) => `${value.toFixed(2)} kWh`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prediction Analytics</CardTitle>
          <CardDescription>Forecast-backed recommendations.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {panel.intelligence?.predictions.map((item) => (
            <PredictionCard key={item.label} item={item} />
          ))}
        </CardContent>
      </Card>

      <TimelineCard
        title="ANN Decision Timeline"
        description="Forecast-driven control events."
        items={panel.timeline}
      />

      <HistoricalLogTable
        rows={history.ann}
        title="ANN Historical Log"
        description="Prediction snapshots with measured values."
      />
    </div>
  )
}
