import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatNumber } from '@/shared/lib/formatters'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

export type ChartSeries = {
  key: string
  label: string
  color: string
  type?: 'line' | 'area' | 'bar'
}

type ChartCardProps<T extends object> = {
  title: string
  subtitle: string
  data: T[]
  series: ChartSeries[]
  formatValue?: (value: number) => string
  footer?: string
  height?: number
}

type TooltipPayload = {
  value?: number
  name?: string
  color?: string
}

function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
  formatValue: (value: number) => string
}) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur-xl dark:bg-slate-950/90">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <div className="mt-3 space-y-2">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-5 text-sm">
            <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color ?? '#fff' }}
              />
              {item.name}
            </span>
            <span className="font-medium text-slate-900 dark:text-white">
              {formatValue(item.value ?? 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChartCard<T extends object>({
  title,
  subtitle,
  data,
  series,
  formatValue = (value) => formatNumber(value, 1),
  footer,
  height = 280,
}: ChartCardProps<T>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="min-w-0" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="rgba(148, 163, 184, 0.5)"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                minTickGap={24}
                tickMargin={8}
              />
              <YAxis
                stroke="rgba(148, 163, 184, 0.5)"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                tickMargin={8}
                width={42}
                tickFormatter={(value) => formatNumber(Number(value), 0)}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    formatValue={formatValue}
                  />
                }
              />
              {series.map((item) => {
                if (item.type === 'bar') {
                  return (
                    <Bar
                      key={item.key}
                      dataKey={item.key}
                      name={item.label}
                      fill={item.color}
                      radius={[8, 8, 0, 0]}
                      fillOpacity={0.92}
                    />
                  )
                }

                if (item.type === 'area') {
                  return (
                    <Area
                      key={item.key}
                      dataKey={item.key}
                      name={item.label}
                      type="monotone"
                      stroke={item.color}
                      fill={item.color}
                      fillOpacity={0.18}
                      strokeWidth={2}
                    />
                  )
                }

                return (
                  <Line
                    key={item.key}
                    dataKey={item.key}
                    name={item.label}
                    type="monotone"
                    stroke={item.color}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                )
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
          {series.map((item) => (
            <div
              key={item.key}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100/85 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-wrap-anywhere">{item.label}</span>
            </div>
          ))}
        </div>
        {footer ? <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">{footer}</p> : null}
      </CardContent>
    </Card>
  )
}
