import { useDeferredValue, useState, useTransition } from 'react'
import { BrainCircuit, Search, Trophy } from 'lucide-react'
import { ChartCard } from '@/features/solar-monitoring/components/ChartCard'
import { ComparisonTable } from '@/features/solar-monitoring/components/ComparisonTable'
import { InsightCard } from '@/features/solar-monitoring/components/InsightCard'
import { PageHeader } from '@/features/solar-monitoring/components/PageHeader'
import { PanelSummaryCard } from '@/features/solar-monitoring/components/PanelSummaryCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import {
  buildEfficiencyComparison,
  buildEnergyComparison,
  buildMovementComparison,
  buildPowerComparison,
  comparison,
  panels,
} from '@/features/solar-monitoring/data/mock-data'
import type { TimeRange } from '@/shared/types/solar'
import { useMockTelemetry } from '@/features/solar-monitoring/hooks/useMockTelemetry'

export function ComparisonPage() {
  const [range, setRange] = useState<TimeRange>('hourly')
  const [query, setQuery] = useState('')
  const [, startTransition] = useTransition()
  const deferredQuery = useDeferredValue(query)
  const telemetry = useMockTelemetry(panels.ann.ranges.live)
  const filteredRows = comparison.table.filter((row) =>
    row.metric.toLowerCase().includes(deferredQuery.trim().toLowerCase()),
  )

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        eyebrow="Comparison dashboard"
        title="Performance Comparison"
        description="Side-by-side comparison of all three systems."
        connection="Cross-panel sync active"
        status="optimal"
        lastUpdated={telemetry.updatedAt}
        range={range}
        onRangeChange={(nextRange) => startTransition(() => setRange(nextRange))}
      />

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {comparison.summaries.map((summary) => (
          <PanelSummaryCard key={summary.panel} summary={summary} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>Metric Filter</CardTitle>
            <CardDescription>Search metrics in the table.</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex items-center gap-3 rounded-[24px] border border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-white/[0.03] px-4 py-3">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter metrics like efficiency, movement, alerts..."
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500 dark:text-white dark:placeholder:text-slate-500"
              />
            </label>
          </CardContent>
        </Card>

        <ChartCard
          title="Power Output Comparison"
          subtitle="All systems in one chart."
          data={buildPowerComparison(range)}
          series={[
            { key: 'fixed', label: 'Fixed', color: '#38bdf8', type: 'line' },
            { key: 'conventional', label: 'Conventional', color: '#fbbf24', type: 'line' },
            { key: 'ann', label: 'ANN', color: '#bef264', type: 'line' },
          ]}
          formatValue={(value) => `${value.toFixed(1)} W`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title="Energy Generated"
          subtitle="Energy comparison over time."
          data={buildEnergyComparison(range)}
          series={[
            { key: 'fixed', label: 'Fixed', color: '#38bdf8', type: 'bar' },
            { key: 'conventional', label: 'Conventional', color: '#fbbf24', type: 'bar' },
            { key: 'ann', label: 'ANN', color: '#bef264', type: 'bar' },
          ]}
          formatValue={(value) => `${value.toFixed(2)} kWh`}
        />
        <ChartCard
          title="Efficiency Comparison"
          subtitle="Efficiency across the same conditions."
          data={buildEfficiencyComparison(range)}
          series={[
            { key: 'fixed', label: 'Fixed', color: '#38bdf8', type: 'line' },
            { key: 'conventional', label: 'Conventional', color: '#fbbf24', type: 'line' },
            { key: 'ann', label: 'ANN', color: '#bef264', type: 'line' },
          ]}
          formatValue={(value) => `${value.toFixed(0)}%`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <ChartCard
          title="Movement Frequency"
          subtitle="Adjustment frequency by system."
          data={buildMovementComparison(range)}
          series={[
            { key: 'conventional', label: 'Conventional moves', color: '#fbbf24', type: 'bar' },
            { key: 'ann', label: 'ANN moves', color: '#bef264', type: 'bar' },
          ]}
          formatValue={(value) => `${value.toFixed(0)} moves`}
        />
        <ChartCard
          title="Movement Cost Estimate"
          subtitle="Estimated energy spent on movement."
          data={buildMovementComparison(range)}
          series={[
            { key: 'conventionalCost', label: 'Conventional cost', color: '#fb7185', type: 'line' },
            { key: 'annCost', label: 'ANN cost', color: '#38bdf8', type: 'line' },
          ]}
          formatValue={(value) => `${value.toFixed(2)} kWh`}
        />
      </div>

      <ChartCard
        title="ANN Predicted vs Actual"
        subtitle="ANN forecast accuracy in context."
        data={panels.ann.ranges[range]}
        series={[
          { key: 'predictedPower', label: 'ANN predicted', color: '#38bdf8', type: 'line' },
          { key: 'power', label: 'ANN actual', color: '#bef264', type: 'line' },
        ]}
        formatValue={(value) => `${value.toFixed(1)} W`}
      />

      <ComparisonTable rows={filteredRows.length ? filteredRows : comparison.table} />

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {comparison.insights.map((item) => (
          <InsightCard key={item.title} title={item.title} detail={item.detail} tone={item.tone} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranking and Recommendation</CardTitle>
          <CardDescription>Winner by category.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {comparison.rankings.map((item) => (
            <div key={item.label} className="min-w-0 rounded-[24px] border border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                {item.winner === 'ann' ? (
                  <BrainCircuit className="h-5 w-5 text-lime-300" />
                ) : (
                  <Trophy className="h-5 w-5 text-amber-300" />
                )}
                <p className="text-wrap-anywhere text-sm font-medium text-slate-900 dark:text-white">{item.label}</p>
              </div>
              <p className="text-wrap-anywhere mt-4 text-xl font-semibold text-slate-900 dark:text-white">{item.winner.toUpperCase()}</p>
              <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{item.reason}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
