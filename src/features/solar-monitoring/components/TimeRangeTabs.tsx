import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import type { TimeRange } from '@/shared/types/solar'

type TimeRangeTabsProps = {
  value: TimeRange
  onChange: (value: TimeRange) => void
}

const ranges: TimeRange[] = ['live', 'hourly', 'daily', 'weekly']

export function TimeRangeTabs({ value, onChange }: TimeRangeTabsProps) {
  return (
    <Tabs value={value} onValueChange={(nextValue) => onChange(nextValue as TimeRange)}>
      <TabsList className="w-full gap-1 sm:w-auto sm:gap-0">
        {ranges.map((range) => (
          <TabsTrigger key={range} value={range} className="flex-1 sm:flex-none">
            {range}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
