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
</script>

<template>
  <div class="trend-chart">
    <svg :viewBox="`0 0 ${width} ${height}`" role="img" aria-label="走势图">
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
    </svg>
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
  width: 100%;
  min-height: 188px;
}

svg {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid #dde2eb;
  border-radius: 4px;
  background: linear-gradient(180deg, #ffffff 0%, #f7fafd 100%);
}

.grid {
  stroke: #eaeef4;
  stroke-width: 0.8;
  stroke-dasharray: 2 3;
}

.axis {
  stroke: #c4ccd9;
  stroke-width: 0.8;
}

.y-tick,
.x-tick {
  fill: #6b7280;
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
  stroke: #d6324c;
  color: #d6324c;
}

.draw {
  stroke: #2e9c5f;
  color: #2e9c5f;
}

.away {
  stroke: #1a8cd3;
  color: #1a8cd3;
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
  color: #4a5364;
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
