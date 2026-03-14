import { useState, useTransition } from 'react'
import { buildEfficiencyComparison, buildPowerComparison, comparison, notifications, panelList } from '@/features/solar-monitoring/data/mock-data'
import type { TimeRange } from '@/shared/types/solar'
import { useMockTelemetry } from '@/features/solar-monitoring/hooks/useMockTelemetry'
import { ChartCard } from '@/features/solar-monitoring/components/ChartCard'
import { InsightCard } from '@/features/solar-monitoring/components/InsightCard'
import { NotificationPanel } from '@/features/solar-monitoring/components/NotificationPanel'
import { PageHeader } from '@/features/solar-monitoring/components/PageHeader'
import { PanelSummaryCard } from '@/features/solar-monitoring/components/PanelSummaryCard'

export function OverviewPage() {
  const [range, setRange] = useState<TimeRange>('hourly')
  const [, startTransition] = useTransition()
  const telemetry = useMockTelemetry(panelList[2].ranges.live)
  const combinedNotifications = [
    ...notifications.fixed,
    ...notifications.conventional,
    ...notifications.ann,
  ]

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow="System overview"
        title="Solar Dashboard"
        description="Compare fixed, tracking, and ANN panels in one view."
        connection="3 mock devices synced"
        status="optimal"
        lastUpdated={telemetry.updatedAt}
        range={range}
        onRangeChange={(nextRange) => startTransition(() => setRange(nextRange))}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {comparison.summaries.map((summary) => (
          <PanelSummaryCard key={summary.panel} summary={summary} />
        ))}
      </div>

      <ChartCard
        title="Portfolio Power Comparison"
        subtitle="Output profile for the selected window."
        data={buildPowerComparison(range)}
        series={[
          { key: 'fixed', label: 'Fixed', color: '#38bdf8', type: 'line' },
          { key: 'conventional', label: 'Conventional', color: '#fbbf24', type: 'line' },
          { key: 'ann', label: 'ANN', color: '#bef264', type: 'line' },
        ]}
        formatValue={(value) => `${value.toFixed(1)} W`}
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <ChartCard
          title="Efficiency Profile"
          subtitle="ANN stays close to tracker output with strong efficiency."
          data={buildEfficiencyComparison(range)}
          series={[
            { key: 'fixed', label: 'Fixed', color: '#38bdf8', type: 'area' },
            { key: 'conventional', label: 'Conventional', color: '#fbbf24', type: 'line' },
            { key: 'ann', label: 'ANN', color: '#bef264', type: 'line' },
          ]}
          formatValue={(value) => `${value.toFixed(0)}%`}
        />
        <NotificationPanel items={combinedNotifications} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {comparison.insights.map((item) => (
          <InsightCard key={item.title} title={item.title} detail={item.detail} tone={item.tone} />
        ))}
      </div>
    </div>
  )
}
