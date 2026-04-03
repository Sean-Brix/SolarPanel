import { useState } from 'react'
import type { HistoryRow } from '@/shared/types/solar'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

type HistoricalLogTableProps = {
  rows: HistoryRow[]
  title?: string
  description?: string
  page: number
  pageSize: number
  totalPages: number
  totalCount: number
  hasPrev: boolean
  hasNext: boolean
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  loading?: boolean
}

export function HistoricalLogTable({
  rows,
  title = 'Historical Logs',
  description = 'Recorded values prepared for later backend persistence.',
  page,
  pageSize,
  totalPages,
  totalCount,
  hasPrev,
  hasNext,
  onPageChange,
  onPageSizeChange,
  loading = false,
}: HistoricalLogTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const getRowKey = (row: HistoryRow, index: number) =>
    row.id !== undefined ? String(row.id) : `${row.panel}-${row.timestamp}-${index}`

  const hasPositionColumn = rows.some(
    (row) => row.azimuth !== undefined && row.elevation !== undefined,
  )

  const safeTotalPages = Math.max(totalPages, 1)
  const safePage = Math.min(Math.max(page, 1), safeTotalPages)
  const firstRowIndex = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1
  const lastRowIndex = Math.min(safePage * pageSize, totalCount)

  const toggleRow = (id: string) => {
    setExpandedRowId((current) => (current === id ? null : id))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Showing {firstRowIndex}-{lastRowIndex} of {totalCount}
          </p>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <label className="flex items-center gap-2 text-xs text-slate-600 sm:text-sm dark:text-slate-300">
              <span>Rows</span>
              <select
                value={pageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              disabled={!hasPrev}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Prev
            </button>
            <span className="text-xs text-slate-600 sm:text-sm dark:text-slate-300">
              Page {safePage} / {safeTotalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))}
              disabled={!hasNext}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>

        {loading ? (
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Loading page...</p>
        ) : null}

        <div className="space-y-2 md:hidden">
          {rows.map((row, index) => {
            const rowId = getRowKey(row, index)
            const isExpanded = expandedRowId === rowId

            return (
              <div
                key={rowId}
                className="rounded-2xl border border-slate-200 bg-slate-100/80 dark:border-white/10 dark:bg-white/[0.03]"
              >
                <button
                  type="button"
                  onClick={() => toggleRow(rowId)}
                  className="w-full px-4 py-3 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-wrap-anywhere text-sm font-medium text-slate-900 dark:text-white">
                      {row.timestamp}
                    </p>
                    <span className="text-xs uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
                      {isExpanded ? 'Hide' : 'Details'}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
                    <p>Power: {row.power.toFixed(1)} W</p>
                    <p>Energy: {row.energy.toFixed(2)} kWh</p>
                  </div>
                </button>

                {isExpanded ? (
                  <div className="grid gap-2 border-t border-slate-200/90 px-4 py-3 text-xs text-slate-700 dark:border-white/8 dark:text-slate-300">
                    <p>Panel: {row.panel}</p>
                    <p>Voltage: {row.voltage.toFixed(1)} V</p>
                    <p>Current: {row.current.toFixed(1)} A</p>
                    <p>
                      Position:{' '}
                      {row.azimuth !== undefined && row.elevation !== undefined
                        ? `${row.azimuth} deg / ${row.elevation} deg`
                        : 'Not tracked'}
                    </p>
                    <p>Forecast: {row.forecast ?? 'N/A'}</p>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <ScrollArea className="hidden w-full md:block">
          <div className="min-w-[680px] lg:min-w-[760px]">
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
                {rows.map((row, index) => (
                  <tr
                    key={getRowKey(row, index)}
                    className="rounded-2xl bg-slate-100/80 text-sm text-slate-700 dark:bg-white/[0.03] dark:text-slate-300"
                  >
                    <td className="rounded-l-2xl border-y border-l border-slate-200/90 px-4 py-2.5 sm:py-3 dark:border-white/8">
                      {row.timestamp}
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-2.5 sm:py-3 dark:border-white/8">
                      {row.voltage.toFixed(1)} V
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-2.5 sm:py-3 dark:border-white/8">
                      {row.current.toFixed(1)} A
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-2.5 sm:py-3 dark:border-white/8">
                      {row.power.toFixed(1)} W
                    </td>
                    <td className="border-y border-slate-200/90 px-4 py-2.5 sm:py-3 dark:border-white/8">
                      {row.energy.toFixed(2)} kWh
                    </td>
                    {hasPositionColumn ? (
                      <td className="border-y border-slate-200/90 px-4 py-2.5 sm:py-3 dark:border-white/8">
                        {row.azimuth !== undefined && row.elevation !== undefined
                          ? `${row.azimuth} deg / ${row.elevation} deg`
                          : 'Not tracked'}
                      </td>
                    ) : null}
                    <td className="rounded-r-2xl border-y border-r border-slate-200/90 px-4 py-2.5 sm:py-3 dark:border-white/8">
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
