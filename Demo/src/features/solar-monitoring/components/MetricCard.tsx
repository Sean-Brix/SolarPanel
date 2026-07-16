import type { LucideIcon } from 'lucide-react'
import { formatEnergy, formatNumber, formatPercent, formatPower } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/cn'
import { Card, CardContent } from '@/shared/ui/card'

type MetricTone = 'cyan' | 'lime' | 'amber' | 'rose'

const toneClasses: Record<MetricTone, string> = {
  cyan: 'from-cyan-300/18 via-cyan-300/4 to-transparent',
  lime: 'from-lime-300/16 via-lime-300/4 to-transparent',
  amber: 'from-amber-300/16 via-amber-300/4 to-transparent',
  rose: 'from-rose-300/16 via-rose-300/4 to-transparent',
}

type MetricCardProps = {
  icon: LucideIcon
  label: string
  value: number
  unit?: string
  note: string
  tone?: MetricTone
  format?: 'number' | 'power' | 'energy' | 'percent'
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  note,
  tone = 'cyan',
  format = 'number',
}: MetricCardProps) {
  const formattedValue =
    format === 'power'
      ? formatPower(value, 1)
      : format === 'energy'
        ? formatEnergy(value, 2)
        : format === 'percent'
          ? formatPercent(value, 0)
          : `${formatNumber(value, 1)}${unit ? ` ${unit}` : ''}`

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-4 sm:pt-6">
        <div className={cn('absolute inset-x-0 top-0 h-24 bg-gradient-to-b', toneClasses[tone])} />
        <div className="relative min-w-0">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-100/85 p-3 dark:border-white/10 dark:bg-white/5">
              <Icon className="h-5 w-5 text-slate-900 dark:text-white" />
            </div>
            <p className="text-wrap-anywhere w-full text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 sm:ml-2 sm:w-auto sm:max-w-[10rem] sm:text-right sm:tracking-[0.16em] dark:text-slate-500">
              {label}
            </p>
          </div>
          <p className="text-wrap-anywhere mt-4 text-2xl font-semibold leading-tight text-slate-900 dark:text-white sm:mt-5 sm:text-3xl">
            {formattedValue}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{note}</p>
        </div>
      </CardContent>
    </Card>
  )
}
