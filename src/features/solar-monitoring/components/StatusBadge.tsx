import { Badge } from '@/shared/ui/badge'

type StatusBadgeProps = {
  value: string
}

const variantMap: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  optimal: 'success',
  adaptive: 'info',
  tracking: 'warning',
  normal: 'success',
  warning: 'warning',
  critical: 'danger',
}

export function StatusBadge({ value }: StatusBadgeProps) {
  const normalized = value.toLowerCase()
  const variant = variantMap[normalized] ?? 'neutral'

  return <Badge variant={variant}>{value}</Badge>
}
