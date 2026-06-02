<script setup lang="ts">
import type { TradeFlowResult } from '~/composables/useTradeFlow'

const props = withDefaults(defineProps<{
  result: TradeFlowResult | null
  height?: number
}>(), {
  height: 230,
})

/** D3/A7 配色（对照旧站 成交走势图）：买=红 卖=绿 冲=teal 买+=粉 卖+=蓝 换=黑，价位=浅蓝。 */
const ATTR_COLORS: Record<string, string> = {
  买: '#e23b2e',
  卖: '#36a85b',
  冲: '#2f8f86',
  '买+': '#e89ab5',
  '卖+': '#3f6fd1',
  换: '#1c1c1c',
}
const PRICE_COLOR = '#5b9bd5'
function attrColor(a: string): string {
  return ATTR_COLORS[a] ?? '#9aa3af'
}

const PAD_TOP = 8
const PAD_BOTTOM = 4
const BUCKET_W = 22

const buckets = computed(() => props.result?.buckets ?? [])
const attrs = computed(() => props.result?.attrs ?? [])

const chartH = computed(() => Math.max(props.height - PAD_TOP - PAD_BOTTOM, 40))
const svgW = computed(() => Math.max(buckets.value.length * BUCKET_W, 10))

const maxVol = computed(() => {
  let m = 0
  for (const b of buckets.value) {
    for (const a of attrs.value) {
      const v = b.items[a] ?? 0
      if (v > m) m = v
    }
  }
  return m > 0 ? m : 1
})

const prices = computed(() =>
  buckets.value.map(b => b.price).filter((p): p is number => p != null && p > 0))
const priceMin = computed(() => (prices.value.length ? Math.min(...prices.value) : 0))
const priceMax = computed(() => (prices.value.length ? Math.max(...prices.value) : 1))
const priceRange = computed(() => priceMax.value - priceMin.value || 1)
const hasPrice = computed(() => prices.value.length > 0)

function volY(v: number): number {
  return PAD_TOP + chartH.value * (1 - v / maxVol.value)
}
function priceY(p: number): number {
  return PAD_TOP + chartH.value * (1 - (p - priceMin.value) / priceRange.value)
}

interface Bar { x: number, y: number, w: number, h: number, color: string }
const bars = computed<Bar[]>(() => {
  const out: Bar[] = []
  const aN = Math.max(attrs.value.length, 1)
  const groupW = BUCKET_W - 5
  const barW = groupW / aN
  buckets.value.forEach((b, i) => {
    const x0 = i * BUCKET_W + 2.5
    attrs.value.forEach((a, j) => {
      const v = b.items[a] ?? 0
      if (v <= 0) return
      const y = volY(v)
      out.push({
        x: x0 + j * barW,
        y,
        w: Math.max(barW - 0.6, 1),
        h: PAD_TOP + chartH.value - y,
        color: attrColor(a),
      })
    })
  })
  return out
})

const pricePts = computed(() => {
  const pts: { x: number, y: number }[] = []
  buckets.value.forEach((b, i) => {
    if (b.price != null && b.price > 0)
      pts.push({ x: i * BUCKET_W + BUCKET_W / 2, y: priceY(b.price) })
  })
  return pts
})
const priceLine = computed(() => pricePts.value.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))

/** 成交（左轴）刻度。 */
const volTicks = computed(() => {
  const n = 4
  return Array.from({ length: n + 1 }, (_, i) => ({
    y: PAD_TOP + chartH.value * (i / n),
    label: fmtVol(maxVol.value * (1 - i / n)),
  }))
})
function fmtVol(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(1)}万`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`
  return Math.round(v).toString()
}

/** 价位（右轴）刻度：max / mid / min。 */
const priceTicks = computed(() => {
  if (!hasPrice.value) return []
  return [0, 0.5, 1].map(f => ({
    y: PAD_TOP + chartH.value * f,
    label: (priceMax.value - priceRange.value * f).toFixed(2),
  }))
})

/** x 轴时间标签（首/中/末）。 */
const timeLabels = computed(() => {
  const bs = buckets.value
  if (!bs.length) return []
  const idxs = bs.length <= 3 ? bs.map((_, i) => i) : [0, Math.floor(bs.length / 2), bs.length - 1]
  return idxs.map(i => ({ x: i * BUCKET_W + BUCKET_W / 2, label: hm(bs[i]!.time) }))
})
function hm(iso: string): string {
  const t = iso.indexOf('T')
  return t < 0 ? iso : iso.slice(t + 1, t + 6)
}

const totalH = computed(() => props.height)
</script>

<template>
  <div class="tf-chart">
    <div class="tf-body" :style="{ height: `${totalH + 16}px` }">
      <!-- 左轴：成交 -->
      <svg class="tf-axis tf-axis-l" :width="36" :height="totalH" :viewBox="`0 0 36 ${totalH}`">
        <text
          v-for="(t, i) in volTicks"
          :key="i"
          :x="33"
          :y="t.y + 3"
          class="tf-axis-text"
          text-anchor="end"
        >{{ t.label }}</text>
      </svg>

      <!-- 中部：可横向滚动的柱状 + 价位线 -->
      <div class="tf-scroll scrollbar-thin">
        <svg :width="svgW" :height="totalH" :viewBox="`0 0 ${svgW} ${totalH}`" preserveAspectRatio="none">
          <!-- 网格线 -->
          <line
            v-for="(t, i) in volTicks"
            :key="`g${i}`"
            x1="0"
            :x2="svgW"
            :y1="t.y"
            :y2="t.y"
            class="tf-grid"
          />
          <!-- 成交柱 -->
          <rect
            v-for="(b, i) in bars"
            :key="`b${i}`"
            :x="b.x"
            :y="b.y"
            :width="b.w"
            :height="b.h"
            :fill="b.color"
          />
          <!-- 价位线 -->
          <polyline v-if="priceLine" :points="priceLine" class="tf-price-line" :stroke="PRICE_COLOR" />
          <circle
            v-for="(p, i) in pricePts"
            :key="`p${i}`"
            :cx="p.x"
            :cy="p.y"
            r="1.6"
            :fill="PRICE_COLOR"
          />
          <!-- x 轴时间 -->
          <text
            v-for="(t, i) in timeLabels"
            :key="`t${i}`"
            :x="t.x"
            :y="totalH - 2"
            class="tf-axis-text"
            text-anchor="middle"
          >{{ t.label }}</text>
        </svg>
      </div>

      <!-- 右轴：价位 -->
      <svg class="tf-axis tf-axis-r" :width="32" :height="totalH" :viewBox="`0 0 32 ${totalH}`">
        <text
          v-for="(t, i) in priceTicks"
          :key="i"
          :x="3"
          :y="t.y + 3"
          class="tf-axis-text price"
          text-anchor="start"
        >{{ t.label }}</text>
      </svg>
    </div>

    <!-- 图例 -->
    <div class="tf-legend scrollbar-none">
      <span v-for="a in attrs" :key="a" class="tf-lg">
        <i class="sw" :style="{ background: attrColor(a) }" />{{ result?.selectionLabel }}-{{ a }}
      </span>
      <span v-if="hasPrice" class="tf-lg">
        <i class="sw line" :style="{ background: PRICE_COLOR }" />{{ result?.selectionLabel }}价位
      </span>
    </div>
  </div>
</template>

<style scoped>
.tf-chart {
  display: grid;
  gap: 6px;
}

.tf-body {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 32px;
  align-items: stretch;
}

.tf-axis {
  flex: 0 0 auto;
}

.tf-scroll {
  overflow-x: auto;
  overflow-y: hidden;
}

.tf-grid {
  stroke: var(--divider);
  stroke-width: 1;
  shape-rendering: crispEdges;
}

.tf-axis-text {
  fill: var(--soft);
  font-size: 9px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.tf-axis-text.price {
  fill: #5b9bd5;
}

.tf-price-line {
  fill: none;
  stroke-width: 1.4;
}

.tf-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  padding-top: 2px;
}

.tf-lg {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--muted);
  white-space: nowrap;
}

.tf-lg .sw {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex: 0 0 auto;
}

.tf-lg .sw.line {
  height: 3px;
  border-radius: 2px;
}

.scrollbar-thin {
  scrollbar-width: thin;
}
</style>
