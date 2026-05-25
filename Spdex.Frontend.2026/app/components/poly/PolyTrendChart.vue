<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { createChart, LineSeries, type IChartApi, type LineData, type Time, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts'
import type { TrendChartSeries, TrendDataPoint } from '~/utils/polymarketChart'
import dayjs from 'dayjs'

export interface VolumeBucket {
  index: number; x: number; width: number
  totalNotional: number; buyNotional: number; sellNotional: number; tradeCount: number
}

const props = withDefaults(
  defineProps<{
    series: TrendChartSeries[]
    volumeBuckets?: VolumeBucket[]
    volumeMax?: number
    timeRange: { minTs: number; maxTs: number; start: string; end: string }
    chartScale: { min: number; max: number; ticks: number[] }
    height?: number
  }>(),
  { height: 400, volumeMax: 0 },
)

// ─── Hover state ───
interface LabelInfo { label: string; color: string; pct: number }
interface FloatInfo { label: string; color: string; pct: number; x: number; y: number }
const hoverTime = ref<string | null>(null)
const hoverLabels = reactive<LabelInfo[]>([])
const floats = reactive<FloatInfo[]>([])
const isHovering = ref(false)
const fadeLeft = ref(0)

// ─── Time range presets ───
type TimePreset = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL'
const TIME_PRESETS: TimePreset[] = ['1H', '6H', '1D', '1W', '1M', 'ALL']
const activePreset = ref<TimePreset>('ALL')

const PRESET_MS: Record<TimePreset, number> = {
  '1H': 3600000, '6H': 21600000, '1D': 86400000,
  '1W': 604800000, '1M': 2592000000, 'ALL': 0,
}

function selectPreset(p: TimePreset) { activePreset.value = p; applyTimeRange() }

// ─── Chart ───
const chartContainer = ref<HTMLDivElement | null>(null)
let chart: IChartApi | null = null
let seriesList: { api: any; meta: TrendChartSeries; points: TrendDataPoint[] }[] = []

function dedupeByTime(pts: { time: Time; value: number }[]): LineData[] {
  if (!pts.length) return []
  const s = [...pts].sort((a, b) => (a.time as number) - (b.time as number))
  const r: LineData[] = [s[0]! as LineData]
  for (let i = 1; i < s.length; i++) {
    if ((s[i]!.time as number) > (r[r.length - 1]!.time as number)) r.push(s[i]! as LineData)
    else r[r.length - 1] = s[i]! as LineData
  }
  return r
}

function findPriceAtTime(points: TrendDataPoint[], targetMs: number): number | null {
  if (!points.length) return null
  if (targetMs <= points[0]!.ts) return points[0]!.price
  if (targetMs >= points[points.length - 1]!.ts) return points[points.length - 1]!.price
  let lo = 0, hi = points.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (points[mid]!.ts <= targetMs) lo = mid
    else hi = mid - 1
  }
  return points[lo]!.price
}

const tzOffsetSec = -new Date().getTimezoneOffset() * 60

function buildChart() {
  if (!chartContainer.value || !props.series.length) return
  if (chart) { chart.remove(); chart = null; seriesList = [] }

  chart = createChart(chartContainer.value, {
    width: chartContainer.value.clientWidth,
    height: props.height,
    layout: {
      background: { type: ColorType.Solid, color: '#ffffff' },
      textColor: 'rgba(0,0,0,0.35)',
      fontFamily: "'Inter', sans-serif",
      fontSize: 11,
      attributionLogo: false,
    },
    grid: {
      vertLines: { visible: false },
      horzLines: { color: 'rgba(0,0,0,0.05)', style: LineStyle.Dotted },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: 'rgba(0,0,0,0.12)', style: LineStyle.Solid, width: 1, labelVisible: false },
      horzLine: { visible: false, labelVisible: false },
    },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.05, bottom: 0.05 } },
    timeScale: { borderVisible: false, rightOffset: 8, fixLeftEdge: true, fixRightEdge: true, timeVisible: true, secondsVisible: false },
    handleScroll: { mouseWheel: false, pressedMouseMove: false },
    handleScale: { mouseWheel: false, pinch: false },
  } as any)

  let hasData = false
  for (const s of props.series) {
    const validPoints = s.dataPoints
      .filter(p => p.ts > 0 && p.price >= 0 && p.price <= 1)
      .sort((a, b) => a.ts - b.ts)

    const chartData = dedupeByTime(
      validPoints.map(p => ({
        time: (Math.floor(p.ts / 1000) + tzOffsetSec) as Time,
        value: Math.round(p.price * 10000) / 100,
      })),
    )
    if (!chartData.length) continue

    try {
      const line = chart.addSeries(LineSeries, {
        color: s.color, lineWidth: 2, lineType: 0,
        priceFormat: { type: 'custom', formatter: (v: number) => `${Math.round(v)}%` },
        crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
        crosshairMarkerBorderColor: '#ffffff', crosshairMarkerBorderWidth: 2,
        lastValueVisible: false, priceLineVisible: false, title: '',
      })
      line.setData(chartData)
      seriesList.push({ api: line, meta: s, points: validPoints })
      hasData = true
    }
    catch (e) { console.warn('[Chart]', s.label, e) }
  }

  if (hasData) applyTimeRange()

  const localChart = chart
  chart.subscribeCrosshairMove((param: any) => {
    if (!param?.time) {
      isHovering.value = false
      hoverTime.value = null
      hoverLabels.length = 0
      floats.length = 0
      fadeLeft.value = 0
      return
    }

    const chartSec = param.time as number
    const realMs = (chartSec - tzOffsetSec) * 1000
    isHovering.value = true
    hoverTime.value = dayjs(realMs).format('MMM D, HH:mm')

    const xCoord = localChart.timeScale().timeToCoordinate(param.time)
    const px = typeof xCoord === 'number' ? xCoord : 0
    fadeLeft.value = px

    hoverLabels.length = 0
    floats.length = 0
    for (const sr of seriesList) {
      const price = findPriceAtTime(sr.points, realMs)
      if (price !== null) {
        const pct = Math.round(price * 100)
        hoverLabels.push({ label: sr.meta.label, color: sr.meta.color, pct })

        const pctValue = Math.round(price * 10000) / 100
        const yCoord = sr.api.priceToCoordinate(pctValue)
        const py = typeof yCoord === 'number' ? yCoord : 0
        floats.push({ label: sr.meta.label, color: sr.meta.color, pct, x: px, y: py })
      }
    }
  })

  const obs = new ResizeObserver(() => {
    if (chart && chartContainer.value) chart.applyOptions({ width: chartContainer.value.clientWidth })
  })
  obs.observe(chartContainer.value)
  ;(chartContainer.value as any).__ro = obs
}

function applyTimeRange() {
  if (!chart || !seriesList.length) return
  if (activePreset.value === 'ALL') { chart.timeScale().fitContent(); return }
  const ms = PRESET_MS[activePreset.value]
  const now = Date.now()
  try {
    chart.timeScale().setVisibleRange({
      from: (Math.floor((now - ms) / 1000) + tzOffsetSec) as Time,
      to: (Math.floor(now / 1000) + tzOffsetSec) as Time,
    })
  }
  catch { chart.timeScale().fitContent() }
}

onMounted(() => nextTick(buildChart))
onUnmounted(() => {
  if (chartContainer.value) { const o = (chartContainer.value as any).__ro; if (o) o.disconnect() }
  if (chart) { chart.remove(); chart = null }
})
watch(() => [props.series, props.timeRange], () => nextTick(buildChart), { deep: true })
</script>

<template>
  <div class="w-full">
    <!-- Header: hover time (left) + labels (right) -->
    <div class="flex items-center justify-between mb-1 min-h-[48px]">
      <div class="text-xs text-gray-400 tabular-nums min-w-[100px]">
        {{ isHovering && hoverTime ? hoverTime : '' }}
      </div>
      <div class="flex items-end gap-5">
        <template v-if="isHovering && hoverLabels.length > 0">
          <div v-for="h in hoverLabels" :key="h.label" class="text-right leading-tight">
            <div class="text-[10px] font-medium" :style="{ color: h.color }">{{ h.label }}</div>
            <div class="text-xl font-bold tabular-nums" :style="{ color: h.color }">{{ h.pct }}%</div>
          </div>
        </template>
        <template v-else>
          <div v-for="s in series" :key="s.key" class="text-right leading-tight">
            <div class="text-[10px] font-medium" :style="{ color: s.color }">{{ s.label }}</div>
            <div class="text-xl font-bold tabular-nums" :style="{ color: s.color }">
              {{ Math.round((s.lastPct ?? 0) * 100) }}%
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Chart wrapper -->
    <div class="relative">
      <div
        ref="chartContainer"
        class="w-full rounded-lg overflow-hidden"
        :style="{ height: `${height}px` }"
      />

      <!-- Fade overlay -->
      <div
        v-show="isHovering && fadeLeft > 0"
        class="absolute top-0 bottom-0 z-[5] pointer-events-none transition-[left] duration-75"
        :style="{ left: `${fadeLeft}px`, right: '0', background: 'rgba(255,255,255,0.55)' }"
      />

      <!-- Floating labels at crosshair Y -->
      <div
        v-for="fl in floats"
        :key="fl.label"
        v-show="isHovering && fl.y > 0"
        class="absolute z-10 pointer-events-none text-[11px] font-bold whitespace-nowrap leading-none"
        :style="{
          left: `${fl.x + 10}px`,
          top: `${fl.y - 7}px`,
          color: fl.color,
          textShadow: '0 0 4px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,0.9)',
        }"
      >
        {{ fl.label }} <span class="text-sm">{{ fl.pct }}%</span>
      </div>
    </div>

    <!-- Time range presets -->
    <div class="flex items-center justify-end gap-1 mt-2">
      <button
        v-for="preset in TIME_PRESETS"
        :key="preset"
        class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
        :class="activePreset === preset
          ? 'bg-blue-500 text-white'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'"
        @click="selectPreset(preset)"
      >{{ preset }}</button>
    </div>
  </div>
</template>
