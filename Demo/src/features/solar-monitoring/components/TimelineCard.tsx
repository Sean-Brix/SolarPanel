import type { TimelineEntry } from '@/shared/types/solar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

type TimelineCardProps = {
  title?: string
  description?: string
  items: TimelineEntry[]
}

const accentMap = {
  metric: 'bg-cyan-300',
  movement: 'bg-amber-300',
  system: 'bg-lime-300',
  forecast: 'bg-rose-300',
}

export function TimelineCard({
  title = 'Activity Timeline',
  description = 'Key events generated from the mock telemetry stream.',
  items,
}: TimelineCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div
            key={`${item.time}-${item.title}`}
            className="flex gap-4 rounded-[22px] border border-slate-200 bg-slate-100/80 p-4 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className="shrink-0 text-center">
              <span className={`mt-1 h-3 w-3 rounded-full ${accentMap[item.type]}`} />
              <span className="mt-3 block text-xs uppercase tracking-[0.16em] text-slate-500">
                {item.time}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-wrap-anywhere text-sm font-medium text-slate-900 dark:text-white">
                {item.title}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{item.detail}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
