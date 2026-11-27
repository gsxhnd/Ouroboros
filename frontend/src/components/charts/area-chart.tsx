import { useId, useLayoutEffect, useRef, useState } from "react"
import {
  area,
  axisBottom,
  axisLeft,
  curveMonotoneX,
  extent,
  line,
  max,
  pointer,
  scaleLinear,
  scaleTime,
  select,
  type Selection,
} from "d3"
import { useReducedMotion } from "motion/react"

import { chartColor, chartSwatch } from "@/components/charts/colors"
import { cn } from "cn"

export type AreaPoint = { t: number; y: number }

export type AreaSeries = {
  id: string
  label: string
  points: AreaPoint[]
}

const HEIGHT = 176

/**
 * 多系列面积图。横轴是时间，纵轴由调用方格式化（速度用字节/秒）。
 * 鼠标移过时标出该时刻各条曲线的值。
 */
export function AreaChart({
  series,
  formatY,
  ariaLabel,
  empty,
}: {
  series: AreaSeries[]
  formatY: (value: number) => string
  ariaLabel: string
  empty: string
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const reduced = useReducedMotion()
  const gradPrefix = useId().replace(/:/g, "")
  const formatRef = useRef(formatY)
  useLayoutEffect(() => {
    formatRef.current = formatY
  }, [formatY])

  useLayoutEffect(() => {
    const node = svgRef.current
    const tip = tipRef.current
    if (!node || !tip || width < 120) {
      return
    }
    const data = series.filter((item) => item.points.length > 0)
    const svg = select(node)
    svg.attr("viewBox", `0 0 ${width} ${HEIGHT}`)
    if (width < 120 || data.length === 0) {
      svg.selectAll("*").remove()
      tip.style.display = "none"
      return
    }

    const margin = { top: 12, right: 8, bottom: 26, left: 56 }
    const innerW = width - margin.left - margin.right
    const innerH = HEIGHT - margin.top - margin.bottom
    const times = data.flatMap((item) => item.points.map((point) => point.t))
    let [t0, t1] = extent(times) as [number, number]
    if (t1 - t0 < 1000) {
      t0 -= 800
      t1 += 800
    }
    const peak = max(data, (item) => max(item.points, (point) => point.y)) ?? 0
    const x = scaleTime().domain([t0, t1]).range([0, innerW])
    const y = scaleLinear()
      .domain([0, peak > 0 ? peak * 1.18 : 1])
      .nice()
      .range([innerH, 0])
    const areaPath = area<AreaPoint>()
      .x((point) => x(point.t))
      .y0(innerH)
      .y1((point) => y(point.y))
      .curve(curveMonotoneX)
    const linePath = line<AreaPoint>()
      .x((point) => x(point.t))
      .y((point) => y(point.y))
      .curve(curveMonotoneX)

    let plot = svg.select<SVGGElement>("g.plot")
    if (plot.empty()) {
      plot = svg.append("g").attr("class", "plot")
      plot.append("g").attr("class", "y-axis")
      plot.append("g").attr("class", "fills")
      plot.append("g").attr("class", "lines")
      plot
        .append("line")
        .attr("class", "cursor")
        .attr("y1", 0)
        .attr("opacity", 0)
      plot.append("g").attr("class", "x-axis")
      plot.append("rect").attr("class", "overlay").attr("fill", "transparent")
    }
    plot.attr("transform", `translate(${margin.left},${margin.top})`)
    plot.select("line.cursor").attr("y2", innerH)
    plot.select("rect.overlay").attr("width", innerW).attr("height", innerH)

    let defs = svg.select<SVGDefsElement>("defs")
    if (defs.empty()) {
      defs = svg.append("defs")
    }
    defs.selectAll("*").remove()
    data.forEach((_, index) => {
      const gradient = defs
        .append("linearGradient")
        .attr("id", `${gradPrefix}-fill-${index}`)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 0)
        .attr("y2", innerH)
      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", chartColor(index))
        .attr("stop-opacity", 0.45)
      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", chartColor(index))
        .attr("stop-opacity", 0.02)
    })

    const duration = reduced ? 0 : 320
    const yAxis = plot.select<SVGGElement>("g.y-axis")
    yAxis
      .transition()
      .duration(duration)
      .call(axisLeft(y).ticks(4).tickSize(-innerW).tickPadding(8))
    const xAxis = plot.select<SVGGElement>("g.x-axis")
    xAxis.attr("transform", `translate(0,${innerH})`)
    xAxis
      .transition()
      .duration(duration)
      .call(
        axisBottom(x)
          .ticks(4)
          .tickSize(0)
          .tickPadding(8)
          .tickFormat((value) => formatClock(value))
      )

    const colorOf = (id: string) =>
      chartColor(
        Math.max(
          0,
          data.findIndex((item) => item.id === id)
        )
      )
    const fillOf = (id: string) => {
      const index = Math.max(
        0,
        data.findIndex((item) => item.id === id)
      )
      return `url(#${gradPrefix}-fill-${index})`
    }
    bindPaths(
      plot.select("g.fills"),
      data,
      (item) => areaPath(item.points) ?? "",
      fillOf,
      true,
      duration
    )
    bindPaths(
      plot.select("g.lines"),
      data,
      (item) => linePath(item.points) ?? "",
      colorOf,
      false,
      duration
    )

    const cursor = plot.select<SVGLineElement>("line.cursor")
    plot
      .select("rect.overlay")
      .on("mousemove", (event: MouseEvent) => {
        const [px] = pointer(event)
        const when = x.invert(px).getTime()
        cursor.attr("x1", px).attr("x2", px).attr("opacity", 1)
        const rows = data
          .map((item) => {
            const point = nearest(item.points, when)
            return point ? `${item.label}  ${formatRef.current(point.y)}` : null
          })
          .filter((row): row is string => row !== null)
        tip.style.display = "block"
        tip.textContent = [formatClock(new Date(when)), ...rows].join("\n")
      })
      .on("mouseleave", () => {
        cursor.attr("opacity", 0)
        tip.style.display = "none"
      })

    return () => {
      svg.selectAll("*").interrupt()
    }
  }, [formatRef, gradPrefix, reduced, series, width])

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }
    const measure = () => {
      const next = Math.round(host.clientWidth)
      setWidth((current) => (current === next ? current : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={hostRef} className="relative">
      {series.every((item) => item.points.length === 0) ? (
        <p className="flex h-44 items-center justify-center text-sm text-pretty text-muted-foreground">
          {empty}
        </p>
      ) : (
        <>
          <svg
            ref={svgRef}
            className="chart block w-full"
            style={{ height: HEIGHT }}
            role="img"
            aria-label={ariaLabel}
          />
          <div
            ref={tipRef}
            className="pointer-events-none absolute top-1 right-1 max-w-56 rounded-md bg-popover px-2 py-1 text-[11px] leading-relaxed whitespace-pre text-popover-foreground ring-1 ring-foreground/10"
            style={{ display: "none" }}
          />
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {series.map((item, index) => {
              const latest = item.points[item.points.length - 1]
              return (
                <li
                  key={item.id}
                  className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      chartSwatch(index)
                    )}
                    aria-hidden
                  />
                  <span className="max-w-40 truncate">{item.label}</span>
                  {latest ? (
                    <span className="text-foreground tabular-nums">
                      {formatY(latest.y)}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

function bindPaths(
  layer: Selection<SVGGElement, unknown, null, undefined>,
  data: AreaSeries[],
  pathOf: (series: AreaSeries) => string,
  colorOf: (id: string) => string,
  fill: boolean,
  duration: number
) {
  const joined = layer
    .selectAll<SVGPathElement, AreaSeries>("path")
    .data(data, (item) => item.id)
  joined.exit().remove()
  joined
    .enter()
    .append("path")
    .attr("fill", (item) => (fill ? colorOf(item.id) : "none"))
    .attr("fill-opacity", fill ? 1 : null)
    .attr("stroke", (item) => (fill ? "none" : colorOf(item.id)))
    .attr("stroke-width", fill ? null : 1.75)
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round")
    .attr("d", (item) => pathOf(item))
    .merge(joined)
    .transition()
    .duration(duration)
    .attr("fill", (item) => (fill ? colorOf(item.id) : "none"))
    .attr("stroke", (item) => (fill ? "none" : colorOf(item.id)))
    .attr("d", (item) => pathOf(item))
}

function nearest(points: AreaPoint[], time: number): AreaPoint | null {
  let best: AreaPoint | null = null
  let distance = Number.POSITIVE_INFINITY
  for (const point of points) {
    const gap = Math.abs(point.t - time)
    if (gap < distance) {
      distance = gap
      best = point
    }
  }
  return best
}

function formatClock(value: Date | NumberValue): string {
  const date = value instanceof Date ? value : new Date(Number(value))
  if (Number.isNaN(date.getTime())) {
    return ""
  }
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

type NumberValue = number | { valueOf(): number }
