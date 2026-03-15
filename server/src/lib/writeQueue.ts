const maxConcurrency = Math.max(1, Number(process.env.DB_WRITE_CONCURRENCY ?? 2))

let active = 0
const queue: Array<() => void> = []

function schedule() {
  if (active >= maxConcurrency) {
    return
  }

  const next = queue.shift()
  if (!next) {
    return
  }

  active += 1
  next()
}

export function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          active = Math.max(0, active - 1)
          schedule()
        })
    })

    schedule()
  })
}
