import { useEffect, useState } from 'react'

export function useMockTelemetry<T>(records: T[], intervalMs = 4500) {
  const [index, setIndex] = useState(0)
  const [updatedAt, setUpdatedAt] = useState(() => new Date())

  useEffect(() => {
    if (records.length <= 1) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % records.length)
      setUpdatedAt(new Date())
    }, intervalMs)

    return () => window.clearInterval(timer)
  }, [intervalMs, records.length])

  return {
    index,
    sample: records[index] ?? records[0],
    updatedAt,
  }
}
