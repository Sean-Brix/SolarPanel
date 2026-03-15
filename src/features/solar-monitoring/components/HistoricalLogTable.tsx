import { useEffect, useMemo, useState } from 'react'
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const hasPositionColumn = rows.some(
    (row) => row.azimuth !== undefined && row.elevation !== undefined,
  )

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))

  useEffect(() => {
    setPage(1)
  }, [rows, pageSize])

  const visibleRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return rows.slice(start, start + pageSize)
  }, [page, pageSize, rows])

  const firstRowIndex = rows.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRowIndex = Math.min(page * pageSize, rows.length)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Showing {firstRowIndex}-{lastRowIndex} of {rows.length}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Prev
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>

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
                  {hasPositionColumn ? <th className="pb-2 font-medium">Position</th> : null}
                  <th className="pb-2 font-medium">Forecast</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
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
                    {hasPositionColumn ? (
                      <td className="border-y border-slate-200/90 px-4 py-3 dark:border-white/8">
                        {row.azimuth !== undefined && row.elevation !== undefined
                          ? `${row.azimuth} deg / ${row.elevation} deg`
                          : 'Not tracked'}
                      </td>
                    ) : null}
                    <td className="rounded-r-2xl border-y border-r border-slate-200/90 px-4 py-3 dark:border-white/8">
                      {row.forecast ?? 'N/A'}
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
