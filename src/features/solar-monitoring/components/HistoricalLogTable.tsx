import type { HistoryRow } from '@/shared/types/solar'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

type HistoricalLogTableProps = {
  rows: HistoryRow[]
  title?: string
  description?: string
}

export function HistoricalLogTable({
  rows,
  title = 'Historical Logs',
  description = 'Recorded values prepared for later backend persistence.',
}: HistoricalLogTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <div className="min-w-[720px] sm:min-w-[760px]">
            <table className="w-full border-separate border-spacing-y-2 text-left text-[13px] sm:text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-500">
                  <th className="pb-2 font-medium">Timestamp</th>
                  <th className="pb-2 font-medium">Voltage</th>
                  <th className="pb-2 font-medium">Current</th>
                  <th className="pb-2 font-medium">Power</th>
                  <th className="pb-2 font-medium">Energy</th>
                  <th className="pb-2 font-medium">Position</th>
                  <th className="pb-2 font-medium">Forecast</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.timestamp}-${row.power}`}
                    className="rounded-2xl bg-slate-100/80 text-sm text-slate-700 dark:bg-white/[0.03] dark:text-slate-300"
                  >
                    <td className="rounded-l-2xl border-y border-l border-slate-200/90 px-4 py-3 dark:border-white/8">
                      {row.timestamp}
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">
                      {row.voltage.toFixed(1)} V
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">
                      {row.current.toFixed(1)} A
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">
                      {row.power.toFixed(1)} W
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">
                      {row.energy.toFixed(2)} kWh
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">
                      {row.azimuth !== undefined && row.elevation !== undefined
                        ? `${row.azimuth} deg / ${row.elevation} deg`
                        : 'Not tracked'}
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">
                      {row.forecast ?? 'N/A'}
                    </td>
                    <td className="rounded-r-2xl border-y border-r border-slate-200/90 px-4 py-3 text-slate-900 dark:border-white/8 dark:text-white">
                      {row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
