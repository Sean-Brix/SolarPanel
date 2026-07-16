import * as React from 'react'
import { cn } from '@/shared/lib/cn'

const variants = {
  neutral: 'border-slate-200 dark:border-white/10 bg-slate-200/70 dark:bg-white/5 text-slate-700 dark:text-slate-200',
  info: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-700 dark:text-cyan-200',
  success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200',
  warning: 'border-amber-400/30 bg-amber-400/10 text-amber-700 dark:text-amber-100',
  danger: 'border-rose-400/30 bg-rose-400/10 text-rose-700 dark:text-rose-100',
}

type BadgeProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: keyof typeof variants
}

export function Badge({
  className,
  variant = 'neutral',
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.24em]',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
