import { Activity, Clock3, Cpu } from 'lucide-react'
import { formatDateTime } from '@/shared/lib/formatters'
import type { TimeRange } from '@/shared/types/solar'
import { StatusBadge } from './StatusBadge'
import { TimeRangeTabs } from './TimeRangeTabs'
import { Card, CardContent } from '@/shared/ui/card'

type PageHeaderProps = {
  eyebrow: string
  title: string
  description?: string
  connection: string
  status: string
  lastUpdated: Date
  range: TimeRange
  onRangeChange: (value: TimeRange) => void
}

export function PageHeader({
  eyebrow,
  title,
  description,
  connection,
  status,
  lastUpdated,
  range,
  onRangeChange,
}: PageHeaderProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-200/80">
              {eyebrow}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h2 className="text-wrap-anywhere text-2xl font-semibold text-slate-900 dark:text-white sm:text-4xl">
                {title}
              </h2>
              <StatusBadge value={status} />
            </div>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700 dark:text-slate-300">
                {description}
              </p>
            ) : null}
          </div>

          <div className="grid w-full min-w-0 gap-3 sm:grid-cols-2 xl:min-w-[360px] xl:max-w-[460px]">
            <div className="min-w-0 rounded-[24px] border border-slate-200 dark:border-white/10 bg-slate-100/85 dark:bg-white/5 p-4">
              <div className="flex min-w-0 items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                <Cpu className="h-4 w-4 text-cyan-300" />
                <span className="text-wrap-anywhere">{connection}</span>
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                Device link
              </p>
            </div>
            <div className="min-w-0 rounded-[24px] border border-slate-200 dark:border-white/10 bg-slate-100/85 dark:bg-white/5 p-4">
              <div className="flex min-w-0 items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                <Clock3 className="h-4 w-4 text-lime-300" />
                <span className="text-wrap-anywhere">{formatDateTime(lastUpdated)}</span>
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                Last updated
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 rounded-[24px] border border-slate-200 dark:border-white/10 bg-white/85 dark:bg-slate-950/55 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
            <Activity className="h-4 w-4 text-cyan-300" />
            <span>Time window</span>
          </div>
          <TimeRangeTabs value={range} onChange={onRangeChange} />
        </div>
      </CardContent>
    </Card>
  )
}
