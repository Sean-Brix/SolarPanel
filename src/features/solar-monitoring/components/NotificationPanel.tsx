import { AlertTriangle, CheckCircle2, X, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { NotificationRecord } from '@/shared/types/solar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

type NotificationPanelProps = {
  items: NotificationRecord[]
}

const iconMap = {
  normal: CheckCircle2,
  warning: AlertTriangle,
  critical: Zap,
}

const toneMap = {
  normal: 'border-emerald-400/15 bg-emerald-400/8',
  warning: 'border-amber-400/20 bg-amber-400/8',
  critical: 'border-rose-400/20 bg-rose-400/8',
}

export function NotificationPanel({ items }: NotificationPanelProps) {
  const [visibleItems, setVisibleItems] = useState(items)

  useEffect(() => {
    setVisibleItems(items)
  }, [items])

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Health</CardTitle>
        <CardDescription>
          Alerting surface for sensor, motor, forecast, and power-state anomalies.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleItems.length ? (
          visibleItems.map((item) => {
            const Icon = iconMap[item.severity]

            return (
              <div key={item.id} className={`rounded-[24px] border p-4 ${toneMap[item.severity]}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="mt-0.5 rounded-2xl border border-slate-200 bg-slate-100/85 p-2 dark:border-white/10 dark:bg-white/5">
                      <Icon className="h-4 w-4 text-slate-900 dark:text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-wrap-anywhere text-sm font-medium text-slate-900 dark:text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">
                        {item.message}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500">
                        {item.source} | {item.time}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Dismiss ${item.title}`}
                    onClick={() =>
                      setVisibleItems((current) => current.filter((entry) => entry.id !== item.id))
                    }
                    className="self-end rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-slate-400 dark:hover:border-white/20 dark:hover:text-white sm:self-start"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-100/80 p-6 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
            All notifications dismissed for this view.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
