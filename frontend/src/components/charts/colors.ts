/** 与主题里的 --chart-1 … --chart-5 对应，图例色块和 SVG 描边共用。 */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

export const CHART_SWATCHES = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? CHART_COLORS[0]
}

export function chartSwatch(index: number): string {
  return CHART_SWATCHES[index % CHART_SWATCHES.length] ?? CHART_SWATCHES[0]
}
