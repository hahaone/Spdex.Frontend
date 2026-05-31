<script setup lang="ts">
import type { ChartPoint } from '~/types/market'
import type { ChartSeriesLabels } from '~/composables/useChartSeries'

const props = defineProps<{
  points: ChartPoint[]
  height?: number
  /** 三序列标签；draw 为 null 时只画两条线（如大小盘）。默认 主/平/客。 */
  seriesLabels?: ChartSeriesLabels
  /** 数值单位：odds/index/amount/percent/payout。决定 Y 轴与图例数值格式。默认 odds。 */
  unit?: string
}>()

const width = 320
const height = computed(() => props.height ?? 188)
const pad = { left: 30, right: 8, top: 16, bottom: 32 }
const chartW = width - pad.left - pad.right

const labels = computed<ChartSeriesLabels>(() => props.seriesLabels ?? { home: '主', draw: '平', away: '客' })
const hasDraw = computed(() => labels.value.draw != null)
const unit = computed(() => props.unit ?? 'odds')

type Field = 'home' | 'draw' | 'away'
const fields = computed<Field[]>(() => hasDraw.value ? ['home', 'draw', 'away'] : ['home', 'away'])

/** 0 视为缺失（payout 例外：0/负数有意义）。 */
function isMissing(v: number): boolean {
  return v === 0 && unit.value !== 'payout'
}

// 仅用「实际渲染的序列、去掉缺失值」来定标尺，避免被占位 0 拉扁
const scaleValues = computed(() => {
  const vals = props.points.flatMap(p => fields.value.map(f => p[f]))
  const filtered = vals.filter(v => Number.isFinite(v) && !isMissing(v))
  return filtered.length > 0 ? filtered : [0, 1]
})
const minValue = computed(() => {
  const lo = Math.min(...scaleValues.value)
  const hi = Math.max(...scaleValues.value)
  const span = hi - lo || Math.abs(hi) || 1
  return lo - span * 0.12
})
const maxValue = computed(() => {
  const lo = Math.min(...scaleValues.value)
  const hi = Math.max(...scaleValues.value)
  const span = hi - lo || Math.abs(hi) || 1
  return hi + span * 0.12
})
const maxVolume = computed(() => Math.max(...props.points.map(p => p.volume), 1))
const chartH = computed(() => height.value - pad.top - pad.bottom)

function xAt(index: number): number {
  if (props.points.length <= 1) return pad.left
  return pad.left + (index / (props.points.length - 1)) * chartW
}

function yAt(value: number): number {
  const span = maxValue.value - minValue.value || 1
  return pad.top + (1 - (value - minValue.value) / span) * chartH.value
}

// 缺口感知折线：缺失值断线（M 重新起笔），避免掉到 0
function linePath(field: Field): string {
  let d = ''
  let pen = false
  props.points.forEach((point, index) => {
    const v = point[field]
    if (isMissing(v) || !Number.isFinite(v)) { pen = false; return }
    d += `${pen ? 'L' : 'M'} ${xAt(index).toFixed(2)} ${yAt(v).toFixed(2)} `
    pen = true
  })
  return d.trim()
}

function visibleDots(field: Field) {
  return props.points
    .map((point, index) => ({ index, value: point[field] }))
    .filter(d => !isMissing(d.value) && Number.isFinite(d.value))
}

function barHeight(volume: number): number {
  return Math.max(2, (volume / maxVolume.value) * 34)
}

function fmtAmount(n: number): string {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (a >= 10_000) return `${(n / 10_000).toFixed(1)}万`
  if (a >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

function fmtValue(v: number): string {
  switch (unit.value) {
    case 'index': return v.toFixed(0)
    case 'percent': return `${v.toFixed(0)}%`
    case 'amount': return fmtAmount(v)
    case 'payout': return `${v > 0 ? '+' : ''}${fmtAmount(v)}`
    default: return v.toFixed(2) // odds
  }
}

const yTicks = computed(() => {
  const span = maxValue.value - minValue.value
  const step = span / 3
  return [0, 1, 2, 3].map((i) => {
    const val = minValue.value + step * i
    return { value: val, y: pad.top + (1 - i / 3) * chartH.value }
  })
})

// ── 交互：十字准线 + 悬浮提示（鼠标 hover / 触屏拖动 scrub）──
const svgRef = ref<SVGSVGElement | null>(null)
const hoverIndex = ref<number | null>(null)

const hover = computed(() => {
  const i = hoverIndex.value
  if (i == null) return null
  const p = props.points[i]
  if (!p) return null
  return { i, p, x: xAt(i) }
})

const tooltip = computed(() => {
  const h = hover.value
  if (!h) return null
  const frac = h.x / width
  const anchor = frac > 0.62 ? 'right' : frac < 0.2 ? 'left' : 'mid'
  return {
    time: h.p.time,
    volume: h.p.volume,
    anchor,
    leftPct: Math.max(0, Math.min(100, frac * 100)),
    rows: fields.value.map(f => ({ key: f, label: labels.value[f] ?? '', value: h.p[f], missing: isMissing(h.p[f]) })),
  }
})

function updateFromEvent(e: PointerEvent) {
  const svg = svgRef.value
  const n = props.points.length
  if (!svg || n === 0) return
  const rect = svg.getBoundingClientRect()
  if (rect.width === 0) return
  const vbX = ((e.clientX - rect.left) / rect.width) * width
  const t = (vbX - pad.left) / (chartW || 1)
  hoverIndex.value = Math.max(0, Math.min(n - 1, Math.round(t * (n - 1))))
}
function onMove(e: PointerEvent) { updateFromEvent(e) }
function onLeave() { hoverIndex.value = null }
function onUp(e: PointerEvent) { if (e.pointerType !== 'mouse') hoverIndex.value = null }
</script>

<template>
  <div class="trend-chart">
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      aria-label="走势图"
      @pointerdown="onMove"
      @pointermove="onMove"
      @pointerleave="onLeave"
      @pointerup="onUp"
      @pointercancel="onLeave"
    >
      <g v-for="tick in yTicks" :key="tick.value">
        <line
          :x1="pad.left"
          :x2="width - pad.right"
          :y1="tick.y"
          :y2="tick.y"
          class="grid"
        />
        <text :x="pad.left - 4" :y="tick.y + 3" class="y-tick" text-anchor="end">{{ fmtValue(tick.value) }}</text>
      </g>

      <line :x1="pad.left" :x2="width - pad.right" :y1="height - pad.bottom" :y2="height - pad.bottom" class="axis" />

      <g v-for="(point, index) in points" :key="point.time">
        <rect
          class="volume-bar"
          :x="xAt(index) - 5"
          :y="height - pad.bottom - barHeight(point.volume)"
          width="10"
          :height="barHeight(point.volume)"
          rx="1"
        />
      </g>

      <path class="line home" :d="linePath('home')" />
      <path v-if="hasDraw" class="line draw" :d="linePath('draw')" />
      <path class="line away" :d="linePath('away')" />

      <g>
        <circle v-for="d in visibleDots('home')" :key="`h-${d.index}`" class="dot home" :cx="xAt(d.index)" :cy="yAt(d.value)" r="2.2" />
        <template v-if="hasDraw">
          <circle v-for="d in visibleDots('draw')" :key="`d-${d.index}`" class="dot draw" :cx="xAt(d.index)" :cy="yAt(d.value)" r="2.2" />
        </template>
        <circle v-for="d in visibleDots('away')" :key="`a-${d.index}`" class="dot away" :cx="xAt(d.index)" :cy="yAt(d.value)" r="2.2" />
      </g>

      <text :x="pad.left" :y="height - 8" class="x-tick">{{ points[0]?.time }}</text>
      <text :x="(pad.left + width - pad.right) / 2" :y="height - 8" class="x-tick" text-anchor="middle">{{ points[Math.floor(points.length / 2)]?.time }}</text>
      <text :x="width - pad.right" :y="height - 8" class="x-tick" text-anchor="end">{{ points[points.length - 1]?.time }}</text>

      <g v-if="hover" class="cross">
        <line class="crosshair" :x1="hover.x" :x2="hover.x" :y1="pad.top" :y2="height - pad.bottom" />
        <template v-for="f in fields" :key="`hi-${f}`">
          <circle v-if="!isMissing(hover.p[f])" :class="['dot-hi', f]" :cx="hover.x" :cy="yAt(hover.p[f])" r="3.4" />
        </template>
      </g>
    </svg>

    <div v-if="tooltip" :class="['tip', `a-${tooltip.anchor}`]" :style="{ left: `${tooltip.leftPct}%` }">
      <div class="tip-time">{{ tooltip.time }}</div>
      <div v-for="r in tooltip.rows" :key="r.key" class="tip-row">
        <i :class="r.key" />
        <span class="tl">{{ r.label }}</span>
        <b class="tv">{{ r.missing ? '-' : fmtValue(r.value) }}</b>
      </div>
      <div class="tip-row">
        <i class="volume" />
        <span class="tl">成交量</span>
        <b class="tv">{{ fmtAmount(tooltip.volume) }}</b>
      </div>
    </div>
    <div class="legend">
      <span><i class="home" />{{ labels.home }}</span>
      <span v-if="hasDraw"><i class="draw" />{{ labels.draw }}</span>
      <span><i class="away" />{{ labels.away }}</span>
      <span><i class="volume" />成交量</span>
    </div>
  </div>
</template>

<style scoped>
.trend-chart {
  position: relative;
  width: 100%;
  min-height: 188px;
}

svg {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: linear-gradient(180deg, var(--panel) 0%, var(--surface) 100%);
  cursor: crosshair;
  touch-action: pan-y; /* 纵向滑动滚动页面，横向滑动 scrub 准线 */
}

.crosshair {
  stroke: var(--muted);
  stroke-width: 1;
  stroke-dasharray: 3 3;
  opacity: 0.7;
  pointer-events: none;
}

.dot-hi {
  stroke: var(--panel);
  stroke-width: 1.4;
  pointer-events: none;
}

.dot-hi.home {
  fill: var(--buy);
}

.dot-hi.draw {
  fill: var(--sell);
}

.dot-hi.away {
  fill: var(--brand);
}

.tip {
  position: absolute;
  top: 4px;
  z-index: 3;
  transform: translateX(-50%);
  min-width: 96px;
  padding: 5px 8px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  box-shadow: var(--shadow-elev);
  font-size: 0.66rem;
  pointer-events: none;
}

.tip.a-left {
  transform: translateX(0);
}

.tip.a-right {
  transform: translateX(-100%);
}

.tip-time {
  margin-bottom: 3px;
  color: var(--muted);
  font-weight: 740;
  font-variant-numeric: tabular-nums;
}

.tip-row {
  display: flex;
  align-items: center;
  gap: 5px;
  line-height: 1.55;
}

.tip-row i {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 2px;
  flex: 0 0 auto;
}

.tip-row i.home {
  background: var(--buy);
}

.tip-row i.draw {
  background: var(--sell);
}

.tip-row i.away {
  background: var(--brand);
}

.tip-row i.volume {
  background: rgba(26, 140, 211, 0.4);
}

.tip-row .tl {
  flex: 1;
  color: var(--muted);
}

.tip-row .tv {
  color: var(--ink);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.grid {
  stroke: var(--divider);
  stroke-width: 0.8;
  stroke-dasharray: 2 3;
}

.axis {
  stroke: var(--line);
  stroke-width: 0.8;
}

.y-tick,
.x-tick {
  fill: var(--muted);
  font-size: 9px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  letter-spacing: 0;
}

.volume-bar {
  fill: rgba(26, 140, 211, 0.16);
}

.line {
  fill: none;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.home {
  stroke: var(--buy);
  color: var(--buy);
}

.draw {
  stroke: var(--sell);
  color: var(--sell);
}

.away {
  stroke: var(--brand);
  color: var(--brand);
}

.dot {
  fill: currentColor;
  stroke: #fff;
  stroke-width: 1.2;
}

.legend {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 2px 0;
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 720;
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.legend i {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: currentColor;
}

.legend .volume {
  background: rgba(26, 140, 211, 0.24);
}
</style>
