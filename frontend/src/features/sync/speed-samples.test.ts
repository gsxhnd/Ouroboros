import assert from "node:assert/strict"
import { test } from "node:test"

import {
  recordSpeeds,
  visibleSeries,
  type SpeedSeries,
} from "./speed-samples.ts"

const job = {
  id: "job-1",
  label: "copy",
  speed: 100,
  active: true,
}

test("recordSpeeds appends a point and ignores a burst inside the gap", () => {
  const first = recordSpeeds([], [job], 1_000)
  assert.equal(first[0]?.points.length, 1)
  assert.equal(first[0]?.points[0]?.y, 100)
  const burst = recordSpeeds(first, [{ ...job, speed: 999 }], 1_400)
  assert.equal(burst[0]?.points.length, 1)
  assert.equal(burst[0]?.points[0]?.y, 100)
  const later = recordSpeeds(burst, [{ ...job, speed: 250 }], 2_000)
  assert.deepEqual(
    later[0]?.points.map((point) => point.y),
    [100, 250]
  )
})

test("recordSpeeds skips inactive jobs and treats a bad speed as zero", () => {
  const series = recordSpeeds(
    [],
    [
      { ...job, active: false },
      { ...job, id: "job-2", speed: Number.NaN },
    ],
    5_000
  )
  assert.equal(series.length, 1)
  assert.equal(series[0]?.id, "job-2")
  assert.equal(series[0]?.points[0]?.y, 0)
})

test("visibleSeries drops points outside the window and empty series", () => {
  const series: SpeedSeries[] = [
    {
      id: "old",
      label: "old",
      points: [{ t: 0, y: 1 }],
    },
    {
      id: "fresh",
      label: "fresh",
      points: [
        { t: 0, y: 1 },
        { t: 10_000, y: 2 },
      ],
    },
  ]
  const visible = visibleSeries(series, 10_000, 5_000)
  assert.deepEqual(
    visible.map((item) => item.id),
    ["fresh"]
  )
  assert.deepEqual(
    visible[0]?.points.map((point) => point.y),
    [2]
  )
})
