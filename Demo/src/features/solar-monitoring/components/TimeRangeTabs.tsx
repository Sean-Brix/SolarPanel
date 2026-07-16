import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import type { TimeRange } from '@/shared/types/solar'

type TimeRangeTabsProps = {
  value: TimeRange
  onChange: (value: TimeRange) => void
}

const ranges: TimeRange[] = ['live', 'hourly', 'daily', 'weekly']

const rangeLabels: Record<TimeRange, { mobile: string; desktop: string }> = {
  live: { mobile: 'Live', desktop: 'Live' },
  hourly: { mobile: 'Hour', desktop: 'Hourly' },
  daily: { mobile: 'Day', desktop: 'Daily' },
  weekly: { mobile: 'Week', desktop: 'Weekly' },
}

export function TimeRangeTabs({ value, onChange }: TimeRangeTabsProps) {
  return (
    <Tabs value={value} onValueChange={(nextValue) => onChange(nextValue as TimeRange)}>
      <TabsList className="w-full gap-1 sm:w-auto sm:gap-0">
        {ranges.map((range) => (
          <TabsTrigger key={range} value={range} className="flex-1 text-xs sm:flex-none sm:text-sm">
            <span className="sm:hidden">{rangeLabels[range].mobile}</span>
            <span className="hidden sm:inline">{rangeLabels[range].desktop}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
