import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as React from 'react'
import { cn } from '@/shared/lib/cn'

export function Tabs({
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root {...props} />
}

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex h-auto flex-wrap rounded-2xl border border-slate-200 bg-slate-100/85 p-1 dark:border-white/10 dark:bg-white/5',
      className,
    )}
    {...props}
  />
))

TabsList.displayName = TabsPrimitive.List.displayName

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex min-w-0 flex-1 items-center justify-center rounded-xl px-3 py-2 text-[11px] font-semibold capitalize text-slate-600 transition dark:text-slate-400 sm:min-w-[76px] sm:flex-none sm:text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100',
      className,
    )}
    {...props}
  />
))

TabsTrigger.displayName = TabsPrimitive.Trigger.displayName
