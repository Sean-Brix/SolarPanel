import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { PredictionInsight } from '@/shared/types/solar'
import { Card, CardContent } from '@/shared/ui/card'

type PredictionCardProps = {
  item: PredictionInsight
}

const iconMap = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  steady: ArrowRight,
}

export function PredictionCard({ item }: PredictionCardProps) {
  const Icon = iconMap[item.trend]

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className="text-wrap-anywhere mt-3 text-lg font-semibold text-slate-900 dark:text-white sm:text-xl">
              {item.value}
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-2 text-cyan-700 dark:text-cyan-100">
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-300">{item.context}</p>
        <p className="mt-4 text-xs uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
          Confidence {item.confidence}%
        </p>
      </CardContent>
    </Card>
  )
}
