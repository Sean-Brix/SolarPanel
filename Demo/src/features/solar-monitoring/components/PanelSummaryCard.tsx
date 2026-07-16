import { BrainCircuit, Orbit, SunMedium } from 'lucide-react'
import { formatEnergy, formatPercent, formatPower } from '@/shared/lib/formatters'
import type { ComparisonSummary } from '@/shared/types/solar'
import { StatusBadge } from './StatusBadge'
import { Card, CardContent } from '@/shared/ui/card'

type PanelSummaryCardProps = {
  summary: ComparisonSummary
}

const iconMap = {
  fixed: SunMedium,
  conventional: Orbit,
  ann: BrainCircuit,
}

export function PanelSummaryCard({ summary }: PanelSummaryCardProps) {
  const Icon = iconMap[summary.panel]

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100/85 dark:bg-white/5 p-3">
            <Icon className="h-5 w-5 text-slate-900 dark:text-white" />
          </div>
          <StatusBadge value={summary.status} />
        </div>

        <p className="mt-6 text-xs uppercase tracking-[0.18em] text-slate-500">
          {summary.panel}
        </p>
        <p className="text-wrap-anywhere mt-2 text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl">
          {formatPower(summary.currentPower)}
        </p>
        <div className="mt-5 grid gap-3 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-slate-950/60 p-3">
            <p>Energy today</p>
            <p className="text-wrap-anywhere mt-2 text-slate-900 dark:text-white">
              {formatEnergy(summary.energyToday)}
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-slate-950/60 p-3">
            <p>Efficiency</p>
            <p className="text-wrap-anywhere mt-2 text-slate-900 dark:text-white">
              {formatPercent(summary.efficiency)}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Movement: {summary.movementFrequency}</p>
      </CardContent>
    </Card>
  )
}
