/** 一条速度采样。t 是毫秒时间戳，y 是字节/秒。 */
export type SpeedPoint = { t: number; y: number }

export type SpeedSeries = {
  id: string
  label: string
  points: SpeedPoint[]
}

export type SpeedJob = {
  id: string
  label: string
  speed: number
  active: boolean
}

const MIN_GAP_MS = 900
const MAX_POINTS = 80
const WINDOW_MS = 3 * 60 * 1000

/**
 * 把正在运行的任务速度追加进曲线。同一任务 900ms 内的重复采样会被丢掉，
 * 避免 SSE 连发把折线挤成一条竖线。已结束的曲线保留，交给 visibleSeries 裁剪。
 */
export function recordSpeeds(
  current: SpeedSeries[],
  jobs: SpeedJob[],
  now: number
): SpeedSeries[] {
  const next = new Map(current.map((series) => [series.id, series]))
  for (const job of jobs) {
    if (!job.active) {
      continue
    }
    const existing = next.get(job.id)
    const points = existing?.points ?? []
    const last = points[points.length - 1]
    if (last && now - last.t < MIN_GAP_MS) {
      if (existing && existing.label !== job.label) {
        next.set(job.id, { ...existing, label: job.label })
      }
      continue
    }
    const y = Number.isFinite(job.speed) ? Math.max(0, job.speed) : 0
    next.set(job.id, {
      id: job.id,
      label: job.label,
      points: [...points, { t: now, y }].slice(-MAX_POINTS),
    })
  }
  return [...next.values()]
}

/** 只保留时间窗口内还有点的曲线。 */
export function visibleSeries(
  series: SpeedSeries[],
  now: number,
  windowMs = WINDOW_MS
): SpeedSeries[] {
  return series
    .map((item) => ({
      ...item,
      points: item.points.filter((point) => now - point.t <= windowMs),
    }))
    .filter((item) => item.points.length > 0)
}
