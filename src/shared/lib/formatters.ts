export function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatPercent(value: number, digits = 0) {
  return `${formatNumber(value, digits)}%`
}

export function formatEnergy(value: number, digits = 2) {
  return `${formatNumber(value, digits)} kWh`
}

export function formatPower(value: number, digits = 1) {
  return `${formatNumber(value, digits)} W`
}

export function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

export function titleCase(value: string) {
  return value
    .split(' ')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}
