/** Polymarket 走势图工具函数 — SVG path 生成、LTTB 降采样、坐标映射 */

// ─── Types ───

export interface TrendDataPoint {
  ts: number
  price: number
}

export interface TrendChartSeries {
  key: string
  label: string
  color: string
  dataPoints: TrendDataPoint[]
  lastPct: number | null
}

interface Point {
  x: number
  y: number
}

// ─── SVG Polyline path ───

/**
 * 将 {x,y} 点数组转为 SVG polyline path 字符串（直线段连接）。
 */
export function catmullRomToBezier(points: Point[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0]!.x.toFixed(2)},${points[0]!.y.toFixed(2)}`

  const d: string[] = [`M ${points[0]!.x.toFixed(2)},${points[0]!.y.toFixed(2)}`]
  for (let k = 1; k < points.length; k++) {
    d.push(`L ${points[k]!.x.toFixed(2)},${points[k]!.y.toFixed(2)}`)
  }
  return d.join(' ')
}

// ─── Fill path ───

/**
 * 闭合曲线路径形成面积填充区域。
 */
export function buildFillPath(
  curvePath: string,
  firstX: number,
  lastX: number,
  bottomY: number,
): string {
  if (!curvePath) return ''
  return `${curvePath} L ${lastX.toFixed(2)},${bottomY.toFixed(2)} L ${firstX.toFixed(2)},${bottomY.toFixed(2)} Z`
}

// ─── LTTB 降采样 ───

/**
 * Largest Triangle Three Buckets (LTTB) 降采样。
 * 将时间序列缩减到最多 maxPoints 个点，同时保留视觉极值。
 */
export function compactTimeSeries(
  raw: TrendDataPoint[],
  maxPoints = 120,
): TrendDataPoint[] {
  if (raw.length <= maxPoints) return raw
  if (maxPoints <= 2) {
    return raw.length >= 2 ? [raw[0]!, raw[raw.length - 1]!] : [...raw]
  }

  const result: TrendDataPoint[] = [raw[0]!]
  const bucketSize = (raw.length - 2) / (maxPoints - 2)

  let prevIndex = 0

  for (let bucket = 0; bucket < maxPoints - 2; bucket++) {
    const bucketStart = Math.floor((bucket + 1) * bucketSize) + 1
    const bucketEnd = Math.min(Math.floor((bucket + 2) * bucketSize) + 1, raw.length - 1)

    let avgTs = 0
    let avgPrice = 0
    let count = 0
    const nextStart = Math.floor((bucket + 2) * bucketSize) + 1
    const nextEnd = Math.min(Math.floor((bucket + 3) * bucketSize) + 1, raw.length - 1)
    for (let j = nextStart; j <= nextEnd && j < raw.length; j++) {
      avgTs += raw[j]!.ts
      avgPrice += raw[j]!.price
      count++
    }
    if (count > 0) {
      avgTs /= count
      avgPrice /= count
    }

    let maxArea = -1
    let bestIndex = bucketStart
    const prev = raw[prevIndex]!

    for (let j = bucketStart; j <= bucketEnd && j < raw.length; j++) {
      const area = Math.abs(
        (prev.ts - avgTs) * (raw[j]!.price - prev.price)
        - (prev.ts - raw[j]!.ts) * (avgPrice - prev.price),
      )
      if (area > maxArea) {
        maxArea = area
        bestIndex = j
      }
    }

    result.push(raw[bestIndex]!)
    prevIndex = bestIndex
  }

  result.push(raw[raw.length - 1]!)
  return result
}

// ─── 坐标映射 ───

export interface ChartLayout {
  viewWidth: number
  padLeft: number
  padRight: number
  padTop: number
  priceHeight: number
  volumeHeight: number
  timeAxisHeight: number
}

export const DEFAULT_LAYOUT: ChartLayout = {
  viewWidth: 600,
  padLeft: 38,
  padRight: 48,
  padTop: 8,
  priceHeight: 224,
  volumeHeight: 40,
  timeAxisHeight: 16,
}

export function chartWidth(layout: ChartLayout): number {
  return layout.viewWidth - layout.padLeft - layout.padRight
}

export function totalHeight(layout: ChartLayout): number {
  return layout.padTop + layout.priceHeight + layout.volumeHeight + layout.timeAxisHeight
}

/**
 * 时间戳 → X 坐标
 */
export function mapX(ts: number, minTs: number, maxTs: number, layout: ChartLayout): number {
  const span = maxTs - minTs
  if (span <= 0) return layout.padLeft + chartWidth(layout) / 2
  return layout.padLeft + ((ts - minTs) / span) * chartWidth(layout)
}

/**
 * 价格 (0–1) → Y 坐标（Y 反转：顶部=最大值）
 */
export function mapY(
  price: number,
  scaleMin: number,
  scaleMax: number,
  layout: ChartLayout,
): number {
  const span = scaleMax - scaleMin
  const normalized = span <= 0 ? 0.5 : (price - scaleMin) / span
  return layout.padTop + layout.priceHeight - Math.max(0, Math.min(1, normalized)) * layout.priceHeight
}

/**
 * 二分查找最近时间戳的数据点索引。
 */
export function findNearestByTs(dataPoints: TrendDataPoint[], targetTs: number): number {
  if (dataPoints.length === 0) return -1
  if (dataPoints.length === 1) return 0

  let lo = 0
  let hi = dataPoints.length - 1

  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (dataPoints[mid]!.ts < targetTs) lo = mid + 1
    else hi = mid
  }

  if (lo > 0) {
    const distLo = Math.abs(dataPoints[lo]!.ts - targetTs)
    const distPrev = Math.abs(dataPoints[lo - 1]!.ts - targetTs)
    if (distPrev < distLo) return lo - 1
  }

  return lo
}
