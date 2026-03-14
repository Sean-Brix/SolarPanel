import type { ComparisonMetricRow, PanelKey } from '@/shared/types/solar'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

type ComparisonTableProps = {
  rows: ComparisonMetricRow[]
}

const emphasisTone = {
  fixed: 'text-cyan-700 dark:text-cyan-200',
  conventional: 'text-amber-700 dark:text-amber-100',
  ann: 'text-lime-700 dark:text-lime-200',
}

const panelLabels: Record<PanelKey, string> = {
  fixed: 'Fixed',
  conventional: 'Conventional',
  ann: 'ANN',
}

function ValueCard({
  label,
  value,
  panel,
  emphasis,
}: {
  label: string
  value: string
  panel: PanelKey
  emphasis?: PanelKey
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p
        className={`mt-2 text-sm font-medium text-slate-900 dark:text-white ${
          emphasis === panel ? emphasisTone[panel] : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}

export function ComparisonTable({ rows }: ComparisonTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Side-by-Side Comparison</CardTitle>
        <CardDescription>
          Focused metric table for thesis review, demo walkthroughs, and evaluator scanning.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3 xl:hidden">
          {rows.map((row) => (
            <div
              key={row.metric}
              className="rounded-2xl border border-slate-200 bg-slate-100/80 p-4 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-wrap-anywhere text-sm font-semibold text-slate-900 dark:text-white">
                  {row.metric}
                </p>
                {row.emphasis ? (
                  <span
                    className={`rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 ${emphasisTone[row.emphasis]}`}
                  >
                    Best: {panelLabels[row.emphasis]}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <ValueCard
                  label="Fixed"
                  value={row.fixed}
                  panel="fixed"
                  emphasis={row.emphasis}
                />
                <ValueCard
                  label="Conventional"
                  value={row.conventional}
                  panel="conventional"
                  emphasis={row.emphasis}
                />
                <ValueCard label="ANN" value={row.ann} panel="ann" emphasis={row.emphasis} />
              </div>
            </div>
          ))}
        </div>

        <div className="hidden xl:block">
          <ScrollArea className="w-full">
            <div className="min-w-[720px]">
              <table className="w-full border-separate border-spacing-y-2 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                    <th className="pb-2 font-medium">Metric</th>
                    <th className="pb-2 font-medium">Fixed</th>
                    <th className="pb-2 font-medium">Conventional</th>
                    <th className="pb-2 font-medium">ANN</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.metric} className="text-sm text-slate-700 dark:text-slate-300">
                      <td className="text-wrap-anywhere max-w-[14rem] rounded-l-2xl border-y border-l border-slate-200/90 bg-slate-100/80 px-4 py-3 font-medium text-slate-900 dark:border-white/8 dark:bg-white/[0.03] dark:text-white">
                        {row.metric}
                      </td>
                      <td
                        className={`border-y border-slate-200/90 bg-slate-100/80 px-4 py-3 dark:border-white/8 dark:bg-white/[0.03] ${row.emphasis === 'fixed' ? emphasisTone.fixed : ''}`}
                      >
                        {row.fixed}
                      </td>
                      <td
                        className={`border-y border-slate-200/90 bg-slate-100/80 px-4 py-3 dark:border-white/8 dark:bg-white/[0.03] ${row.emphasis === 'conventional' ? emphasisTone.conventional : ''}`}
                      >
                        {row.conventional}
                      </td>
                      <td
                        className={`rounded-r-2xl border-y border-r border-slate-200/90 bg-slate-100/80 px-4 py-3 dark:border-white/8 dark:bg-white/[0.03] ${row.emphasis === 'ann' ? emphasisTone.ann : ''}`}
                      >
                        {row.ann}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}
