<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  type TrendChartSeries,
  type ChartLayout,
  DEFAULT_LAYOUT,
  catmullRomToBezier,
  buildFillPath,
  mapX as tsToX,
  mapY as priceToY,
  chartWidth as cw,
  totalHeight as th,
  findNearestByTs,
} from '~/utils/polymarketChart'

// ─── Props ───

export interface VolumeBucket {
  index: number
  x: number
  width: number
  totalNotional: number
  buyNotional: number
  sellNotional: number
  tradeCount: number
}

const props = withDefaults(
  defineProps<{
    series: TrendChartSeries[]
    volumeBuckets: VolumeBucket[]
    volumeMax: number
    timeRange: { minTs: number; maxTs: number; start: string; end: string }
    chartScale: { min: number; max: number; ticks: number[] }
    height?: number
  }>(),
  { height: 224 },
)

// ─── Layout ───

const layout = computed<ChartLayout>(() => ({
  ...DEFAULT_LAYOUT,
  priceHeight: props.height,
}))

const viewWidth = computed(() => layout.value.viewWidth)
const viewHeight = computed(() => th(layout.value))
const chartW = computed(() => cw(layout.value))
const priceBottom = computed(() => layout.value.padTop + layout.value.priceHeight)
const volumeTop = computed(() => priceBottom.value)
const volumeBottom = computed(() => volumeTop.value + layout.value.volumeHeight)

// ─── Helpers ───

function formatPercent(raw: number | null): string {
  if (raw == null) return '-'
  return `${Math.round(raw * 100)}%`
}

function formatCompact(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`
  return `$${Math.round(val)}`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${min}:${ss}`
}

function formatHour(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function mx(ts: number): number {
  return tsToX(ts, props.timeRange.minTs, props.timeRange.maxTs, layout.value)
}

function my(price: number): number {
  return priceToY(price, props.chartScale.min, props.chartScale.max, layout.value)
}

// ─── Rendered series ───

interface RenderedSeries {
  key: string
  label: string
  color: string
  curvePath: string
  firstX: number
  lastX: number
  lastY: number
  lastPct: number | null
}

const isSingleSeries = computed(() => props.series.length === 1)

const renderedSeries = computed<RenderedSeries[]>(() => {
  return props.series.map((s) => {
    const pts = s.dataPoints.map(dp => ({
      x: mx(dp.ts),
      y: my(dp.price),
    }))

    const curvePath = catmullRomToBezier(pts)

    let firstX = layout.value.padLeft
    let lastX = layout.value.padLeft + cw(layout.value)
    let lastY = layout.value.padTop + layout.value.priceHeight / 2

    if (pts.length > 0) {
      firstX = pts[0]!.x
      lastX = pts[pts.length - 1]!.x
      lastY = pts[pts.length - 1]!.y
    }

    return { key: s.key, label: s.label, color: s.color, curvePath, firstX, lastX, lastY, lastPct: s.lastPct }
  })
})

// ─── End labels (collision-avoided) ───

const endLabels = computed(() => {
  const labels = renderedSeries.value.map(s => ({
    key: s.key,
    label: formatPercent(s.lastPct),
    color: s.color,
    x: s.lastX + 6,
    y: s.lastY,
  }))
  labels.sort((a, b) => a.y - b.y)
  const minGap = 11
  for (let i = 1; i < labels.length; i++) {
    if (labels[i]!.y - labels[i - 1]!.y < minGap) {
      labels[i]!.y = labels[i - 1]!.y + minGap
    }
  }
  return labels
})

// ─── Grid ticks ───

const gridLines = computed(() =>
  props.chartScale.ticks.map(tick => ({
    tick,
    y: my(tick),
    label: formatPercent(tick),
  })),
)

// ─── Volume bars ───

const volumeBarsRendered = computed(() => {
  const vMax = props.volumeMax || 1
  const vH = layout.value.volumeHeight
  const sqrtMax = Math.sqrt(vMax)
  return props.volumeBuckets
    .filter(b => b.totalNotional > 0)
    .map(b => {
      const barX = layout.value.padLeft + (b.x / 100) * chartW.value
      const barW = (b.width / 100) * chartW.value
      const barH = Math.max(2, (Math.sqrt(b.totalNotional) / sqrtMax) * vH)
      return {
        ...b,
        svgX: barX + barW * 0.1,
        svgWidth: barW * 0.8,
        svgY: vH - barH,
        svgHeight: barH,
        isBuy: b.buyNotional >= b.sellNotional,
      }
    })
})

// ─── Time axis labels ───

const timeLabels = computed(() => {
  const { minTs, maxTs } = props.timeRange
  if (!minTs || !maxTs) return []
  const span = maxTs - minTs
  if (span <= 0) return [{ x: layout.value.padLeft + chartW.value / 2, label: formatHour(minTs), anchor: 'middle' as const }]

  const count = 4
  const labels: { x: number; label: string; anchor: 'start' | 'middle' | 'end' }[] = []
  for (let i = 0; i <= count; i++) {
    const frac = i / count
    const ts = minTs + frac * span
    const x = layout.value.padLeft + frac * chartW.value
    const anchor: 'start' | 'middle' | 'end' = i === 0 ? 'start' : i === count ? 'end' : 'middle'
    labels.push({ x, label: formatHour(ts), anchor })
  }
  return labels
})

// ─── Hover / Crosshair ───

const chartContainer = ref<HTMLDivElement | null>(null)
const hoverTs = ref<number | null>(null)

function onMouseMove(event: MouseEvent) {
  if (!chartContainer.value) return
  const rect = chartContainer.value.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const svgFraction = mouseX / rect.width
  const svgX = svgFraction * viewWidth.value
  const ly = layout.value
  const chartLeft = ly.padLeft
  const chartRight = ly.padLeft + cw(ly)

  if (svgX < chartLeft || svgX > chartRight) {
    hoverTs.value = null
    return
  }

  const timeFraction = (svgX - chartLeft) / cw(ly)
  const { minTs, maxTs } = props.timeRange
  hoverTs.value = minTs + timeFraction * (maxTs - minTs)
}

function onMouseLeave() {
  hoverTs.value = null
}

const hoverSeriesValues = computed(() => {
  if (hoverTs.value === null) return []
  return props.series.map(s => {
    const idx = findNearestByTs(s.dataPoints, hoverTs.value!)
    if (idx < 0) return { key: s.key, label: s.label, color: s.color, price: null, y: 0 }
    const dp = s.dataPoints[idx]!
    return { key: s.key, label: s.label, color: s.color, price: dp.price, y: my(dp.price) }
  }).filter(v => v.price !== null)
})

const hoverX = computed(() => {
  if (hoverTs.value === null) return 0
  return mx(hoverTs.value)
})

const hoverTimeLabel = computed(() => {
  if (hoverTs.value === null) return ''
  return formatTime(hoverTs.value)
})

const hoveredBucketIndex = computed<number | null>(() => {
  if (hoverTs.value === null) return null
  const { minTs, maxTs } = props.timeRange
  const span = maxTs - minTs
  if (span <= 0) return 0
  const count = props.volumeBuckets.length
  if (count === 0) return null
  const idx = Math.floor(((hoverTs.value - minTs) / span) * count)
  return Math.max(0, Math.min(count - 1, idx))
})

const hoveredBucket = computed(() => {
  if (hoveredBucketIndex.value === null) return null
  return props.volumeBuckets[hoveredBucketIndex.value] ?? null
})

const tooltipStyle = computed(() => {
  if (hoverTs.value === null || !chartContainer.value) return { display: 'none' as const }
  const rect = chartContainer.value.getBoundingClientRect()
  const fraction = (hoverTs.value - props.timeRange.minTs) / (props.timeRange.maxTs - props.timeRange.minTs || 1)
  const pixelX = fraction * rect.width
  const left = fraction > 0.7 ? Math.max(8, pixelX - 170) : pixelX + 16
  return { left: `${left}px`, top: '8px' }
})
</script>

<template>
  <div ref="chartContainer" class="relative select-none">
    <svg
      :viewBox="`0 0 ${viewWidth} ${viewHeight}`"
      class="w-full"
      style="max-height: 320px; height: auto"
      xmlns="http://www.w3.org/2000/svg"
      @mousemove="onMouseMove"
      @mouseleave="onMouseLeave"
    >
      <!-- Grid lines -->
      <line
        v-for="gl in gridLines" :key="`grid-${gl.tick}`"
        :x1="layout.padLeft" :x2="layout.padLeft + chartW" :y1="gl.y" :y2="gl.y"
        stroke="#e5e7eb" stroke-dasharray="4 3" stroke-width="0.5"
      />

      <!-- Y-axis labels -->
      <text
        v-for="gl in gridLines" :key="`ylabel-${gl.tick}`"
        :x="layout.padLeft - 6" :y="gl.y + 3.5"
        text-anchor="end" font-size="10" fill="#9ca3af" class="tabular-nums"
      >
        {{ gl.label }}
      </text>

      <!-- Single-series fill -->
      <path
        v-if="isSingleSeries && renderedSeries.length > 0"
        :d="buildFillPath(renderedSeries[0]!.curvePath, renderedSeries[0]!.firstX, renderedSeries[0]!.lastX, priceBottom)"
        :fill="renderedSeries[0]!.color" fill-opacity="0.08"
      />

      <!-- Curve paths -->
      <path
        v-for="s in renderedSeries" :key="`curve-${s.key}`"
        :d="s.curvePath" :stroke="s.color" fill="none"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"
      />

      <!-- Endpoint dots -->
      <circle
        v-for="s in renderedSeries" :key="`dot-${s.key}`"
        :cx="s.lastX" :cy="s.lastY" r="3.5" :fill="s.color" stroke="#fff" stroke-width="1.5"
      />

      <!-- End labels -->
      <text
        v-for="el in endLabels" :key="`endlabel-${el.key}`"
        :x="el.x" :y="el.y + 3.5"
        text-anchor="start" font-size="10" font-weight="600" :fill="el.color" class="tabular-nums"
      >
        {{ el.label }}
      </text>

      <!-- Volume area -->
      <g :transform="`translate(0, ${volumeTop})`">
        <line :x1="layout.padLeft" :x2="layout.padLeft + chartW" y1="0" y2="0" stroke="#e5e7eb" stroke-width="0.5" />
        <rect
          v-for="bar in volumeBarsRendered" :key="`vol-${bar.index}`"
          :x="bar.svgX" :width="bar.svgWidth" :y="bar.svgY" :height="bar.svgHeight"
          :fill="bar.isBuy ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'"
          :opacity="hoveredBucketIndex === bar.index ? 0.85 : 0.55"
        />
      </g>

      <!-- Volume labels -->
      <text v-if="volumeBarsRendered.length > 0" :x="layout.padLeft + 2" :y="volumeTop + 9" text-anchor="start" font-size="8" fill="#9ca3af">Vol</text>
      <text v-if="volumeBarsRendered.length > 0" :x="layout.padLeft + chartW - 2" :y="volumeTop + 9" text-anchor="end" font-size="8" fill="#9ca3af" class="tabular-nums">
        {{ formatCompact(volumeMax) }}
      </text>

      <!-- Time axis labels -->
      <text
        v-for="(tl, i) in timeLabels" :key="`time-${i}`"
        :x="tl.x" :y="volumeBottom + 12" :text-anchor="tl.anchor"
        font-size="9" fill="#9ca3af" class="tabular-nums"
      >
        {{ tl.label }}
      </text>

      <!-- Crosshair overlay -->
      <template v-if="hoverTs !== null">
        <line :x1="hoverX" :y1="layout.padTop" :x2="hoverX" :y2="volumeBottom" stroke="#9ca3af" stroke-width="0.8" stroke-dasharray="3 2" opacity="0.5" />
        <circle
          v-for="hv in hoverSeriesValues" :key="`hover-dot-${hv.key}`"
          :cx="hoverX" :cy="hv.y" r="3.5" :fill="hv.color" stroke="#fff" stroke-width="1.5"
        />
      </template>

      <!-- Invisible capture rect -->
      <rect :x="layout.padLeft" :y="layout.padTop" :width="chartW" :height="layout.priceHeight + layout.volumeHeight" fill="transparent" class="cursor-crosshair" />
    </svg>

    <!-- Tooltip -->
    <div
      v-if="hoverTs !== null && hoverSeriesValues.length > 0"
      class="absolute z-30 pointer-events-none rounded-lg border border-gray-200 bg-white shadow-lg px-3 py-2 min-w-[140px]"
      :style="tooltipStyle"
    >
      <div class="text-[10px] text-gray-400 tabular-nums mb-1">{{ hoverTimeLabel }}</div>
      <div v-for="hv in hoverSeriesValues" :key="`tt-${hv.key}`" class="flex items-center gap-1.5 py-0.5">
        <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: hv.color }" />
        <span class="text-xs text-gray-500 truncate">{{ hv.label }}</span>
        <span class="ml-auto text-xs font-semibold tabular-nums text-gray-900">{{ formatPercent(hv.price) }}</span>
      </div>
      <div v-if="hoveredBucket" class="mt-1 pt-1 border-t border-gray-200 flex items-center gap-2 text-[10px] text-gray-400 tabular-nums">
        <span>Vol {{ formatCompact(hoveredBucket.totalNotional) }}</span>
        <span>{{ hoveredBucket.tradeCount }} 笔</span>
      </div>
    </div>
  </div>
</template>
