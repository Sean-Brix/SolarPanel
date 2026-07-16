import * as React from 'react'
import { cn } from '@/shared/lib/cn'

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-2xl border border-slate-200/90 bg-white/88 shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/72',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-2 p-4 sm:p-6', className)} {...props} />
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-base leading-snug font-semibold tracking-tight text-slate-900 break-words dark:text-slate-50 sm:text-lg',
        className,
      )}
      {...props}
    />
  )
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'text-sm leading-6 text-slate-600 break-words dark:text-slate-400',
        className,
      )}
      {...props}
    />
  )
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pb-4 sm:px-6 sm:pb-6', className)} {...props} />
}
