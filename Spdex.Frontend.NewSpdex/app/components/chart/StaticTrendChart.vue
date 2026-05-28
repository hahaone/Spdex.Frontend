<script setup lang="ts">
import type { ChartPoint } from '~/types/market'

const props = defineProps<{
  points: ChartPoint[]
  height?: number
}>()

const width = 320
const height = computed(() => props.height ?? 188)
const pad = { left: 26, right: 8, top: 16, bottom: 32 }
const chartW = width - pad.left - pad.right

const allValues = computed(() => props.points.flatMap(p => [p.home, p.draw, p.away]))
const minValue = computed(() => Math.min(...allValues.value) - 0.18)
const maxValue = computed(() => Math.max(...allValues.value) + 0.18)
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

function linePath(field: 'home' | 'draw' | 'away'): string {
  return props.points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yAt(point[field]).toFixed(2)}`)
    .join(' ')
}

function barHeight(volume: number): number {
  return Math.max(3, (volume / maxVolume.value) * 34)
}

const yTicks = computed(() => {
  const span = maxValue.value - minValue.value
  const step = span / 3
  return [0, 1, 2, 3].map(i => {
    const val = minValue.value + step * i
    return { value: val, y: pad.top + (1 - i / 3) * chartH.value }
  })
})
</script>

<template>
  <div class="trend-chart">
    <svg :viewBox="`0 0 ${width} ${height}`" role="img" aria-label="指数核心走势图">
      <g v-for="tick in yTicks" :key="tick.value">
        <line
          :x1="pad.left"
          :x2="width - pad.right"
          :y1="tick.y"
          :y2="tick.y"
          class="grid"
        />
        <text :x="pad.left - 4" :y="tick.y + 3" class="y-tick" text-anchor="end">{{ tick.value.toFixed(2) }}</text>
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
      <path class="line draw" :d="linePath('draw')" />
      <path class="line away" :d="linePath('away')" />

      <g v-for="(point, index) in points" :key="`${point.time}-dots`">
        <circle class="dot home" :cx="xAt(index)" :cy="yAt(point.home)" r="2.2" />
        <circle class="dot draw" :cx="xAt(index)" :cy="yAt(point.draw)" r="2.2" />
        <circle class="dot away" :cx="xAt(index)" :cy="yAt(point.away)" r="2.2" />
      </g>

      <text :x="pad.left" :y="height - 8" class="x-tick">{{ points[0]?.time }}</text>
      <text :x="(pad.left + width - pad.right) / 2" :y="height - 8" class="x-tick" text-anchor="middle">{{ points[Math.floor(points.length / 2)]?.time }}</text>
      <text :x="width - pad.right" :y="height - 8" class="x-tick" text-anchor="end">{{ points[points.length - 1]?.time }}</text>
    </svg>
    <div class="legend">
      <span><i class="home" />主</span>
      <span><i class="draw" />平</span>
      <span><i class="away" />客</span>
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
