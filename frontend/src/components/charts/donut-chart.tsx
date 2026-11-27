import { useLayoutEffect, useRef } from "react"
import { arc, interpolate, pie, select, type PieArcDatum } from "d3"
import { useReducedMotion } from "motion/react"

import { chartColor, chartSwatch } from "@/components/charts/colors"
import { cn } from "cn"

export type DonutSlice = {
  id: string
  label: string
  value: number
}

type ArcSlice = PieArcDatum<DonutSlice>

const SIZE = 160
const RADIUS = 68
const INNER = 46

/**
 * 环形图。d3 只改空的弧线组，React 负责中心数字和图例，
 * 这样重绘不会被彼此清掉。扇区从上次角度补间过来。
 */
export function DonutChart({
  slices,
  centerLabel,
  empty,
}: {
  slices: DonutSlice[]
  centerLabel: string
  empty?: string
}) {
  const arcsRef = useRef<SVGGElement>(null)
  const previous = useRef(new WeakMap<SVGPathElement, ArcSlice>())
  const reduced = useReducedMotion()
  const drawn = slices.filter((slice) => slice.value > 0)
  const total = drawn.reduce((sum, slice) => sum + slice.value, 0)

  useLayoutEffect(() => {
    const node = arcsRef.current
    if (!node) {
      return
    }
    const visible = slices.filter((slice) => slice.value > 0)
    const root = select(node)
    const shape = arc<ArcSlice>()
      .innerRadius(INNER)
      .outerRadius(RADIUS)
      .cornerRadius(visible.length > 1 ? 4 : 0)
    const track = arc().innerRadius(INNER).outerRadius(RADIUS)
    let base = root.select<SVGPathElement>("path.track")
    if (base.empty()) {
      base = root
        .append("path")
        .attr("class", "track")
        .attr("fill", "var(--muted)")
    }
    base.attr(
      "d",
      track({
        innerRadius: INNER,
        outerRadius: RADIUS,
        startAngle: 0,
        endAngle: Math.PI * 2,
      }) ?? ""
    )

    const layout = pie<DonutSlice>()
      .value((slice) => slice.value)
      .sort(null)
      .padAngle(visible.length > 1 ? 0.03 : 0)(visible)
    const paths = root
      .selectAll<SVGPathElement, ArcSlice>("path.slice")
      .data(layout, (item) => item.data.id)
    paths.exit().remove()
    const entered = paths
      .enter()
      .append("path")
      .attr("class", "slice")
      .each(function (datum) {
        previous.current.set(this, { ...datum, endAngle: datum.startAngle })
      })

    entered
      .merge(paths)
      .transition()
      .duration(reduced ? 0 : 560)
      .attr("fill", (datum) =>
        chartColor(visible.findIndex((slice) => slice.id === datum.data.id))
      )
      .attrTween("d", function (datum) {
        const from = previous.current.get(this) ?? {
          ...datum,
          endAngle: datum.startAngle,
        }
        const tween = interpolate(from, datum)
        previous.current.set(this, datum)
        return (time) => shape(tween(time)) ?? ""
      })

    return () => {
      root.selectAll("path.slice").interrupt()
    }
  }, [previous, reduced, slices])

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="size-36 shrink-0"
        role="img"
        aria-label={
          drawn.length === 0
            ? (empty ?? centerLabel)
            : drawn.map((slice) => `${slice.label} ${slice.value}`).join(", ")
        }
      >
        <g ref={arcsRef} transform={`translate(${SIZE / 2} ${SIZE / 2})`} />
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 2}
          textAnchor="middle"
          className="fill-foreground font-semibold"
          style={{ fontSize: 22 }}
        >
          {total}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 16}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 10 }}
        >
          {centerLabel}
        </text>
      </svg>
      {drawn.length === 0 ? (
        empty ? (
          <p className="text-xs text-pretty text-muted-foreground">{empty}</p>
        ) : null
      ) : (
        <ul className="flex w-full min-w-0 flex-col gap-1.5">
          {drawn.map((slice, index) => (
            <li key={slice.id} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  chartSwatch(index)
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {slice.label}
              </span>
              <span className="tabular-nums">{slice.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
