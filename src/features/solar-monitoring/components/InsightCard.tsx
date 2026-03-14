import { Card, CardContent } from '@/shared/ui/card'

type InsightCardProps = {
  title: string
  detail: string
  tone: 'success' | 'info' | 'warning'
}

const toneClasses = {
  success: 'border-lime-200 bg-lime-50/90 dark:border-lime-300/20 dark:bg-lime-300/8',
  info: 'border-cyan-200 bg-cyan-50/90 dark:border-cyan-300/20 dark:bg-cyan-300/8',
  warning: 'border-amber-200 bg-amber-50/90 dark:border-amber-300/20 dark:bg-amber-300/8',
}

export function InsightCard({ title, detail, tone }: InsightCardProps) {
  return (
    <Card className={toneClasses[tone]}>
      <CardContent className="pt-6">
        <p className="text-sm font-medium text-slate-900 dark:text-white">{title}</p>
        <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{detail}</p>
      </CardContent>
    </Card>
  )
}
