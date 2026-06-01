<script setup lang="ts">
import { Lock, RefreshCw } from '@lucide/vue'
import { LADDER_MARKETS, useMatchLadder, type LadderPoint } from '~/composables/useMatchLadder'

const props = defineProps<{ eventId: number }>()

const { data, market, activeKey, setMarket, setSelection, pending, refresh } = useMatchLadder(
  computed(() => props.eventId),
)

const active = computed(() => data.value?.active ?? null)
const selections = computed(() => data.value?.selections ?? [])
const locked = computed(() => data.value?.accessLocked === true)

/** 金额：≥1万 用「万」，否则千分位。 */
function money(n: number | undefined): string {
  if (!n || n <= 0) return '–'
  if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}万`
  return Math.round(n).toLocaleString('en-US')
}
function price(n: number | undefined): string {
  return typeof n === 'number' && n > 0 ? n.toFixed(2) : '–'
}

function onMarketTab(m: string) {
  setMarket(m)
}
function onSelectionChange(e: Event) {
  setSelection((e.target as HTMLSelectElement).value)
}

// ── 迷你走势：价格折线（带面积）+ 成交量柱 ──
const CHART_W = 320
const CHART_H = 110
const PRICE_TOP = 5
const PRICE_BAND = 64 // 价格区 y: 5–69
const VOL_BAND = 34 // 成交量区 y: 76–110（柱从底部向上）

const series = computed<LadderPoint[]>(() => active.value?.series ?? [])

const priceBounds = computed(() => {
  const vals = series.value.map(p => p.price).filter((v): v is number => typeof v === 'number' && v > 0)
  if (vals.length === 0) return null
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (max - min < 1e-6) { min -= 0.05; max += 0.05 }
  return { min, max }
})

function xAt(i: number, n: number): number {
  if (n <= 1) return CHART_W / 2
  return (i / (n - 1)) * CHART_W
}

const pricePath = computed(() => {
  const b = priceBounds.value
  const n = series.value.length
  if (!b || n === 0) return ''
  const segs: string[] = []
  let pen = false
  series.value.forEach((p, i) => {
    if (typeof p.price !== 'number' || p.price <= 0) { pen = false; return }
    const x = xAt(i, n)
    const y = PRICE_TOP + (1 - (p.price - b.min) / (b.max - b.min)) * PRICE_BAND
    segs.push(`${pen ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
    pen = true
  })
  return segs.join(' ')
})

/** 价格折线下方的面积（轻微填充，增强可读性）。 */
const priceArea = computed(() => {
  const b = priceBounds.value
  const n = series.value.length
  if (!b || n === 0) return ''
  const pts: Array<[number, number]> = []
  series.value.forEach((p, i) => {
    if (typeof p.price !== 'number' || p.price <= 0) return
    const x = xAt(i, n)
    const y = PRICE_TOP + (1 - (p.price - b.min) / (b.max - b.min)) * PRICE_BAND
    pts.push([x, y])
  })
  if (pts.length < 2) return ''
  const base = PRICE_TOP + PRICE_BAND
  const first = pts[0]!
  const last = pts[pts.length - 1]!
  let d = `M${first[0].toFixed(1)} ${base.toFixed(1)}`
  for (const [x, y] of pts) d += ` L${x.toFixed(1)} ${y.toFixed(1)}`
  d += ` L${last[0].toFixed(1)} ${base.toFixed(1)} Z`
  return d
})

const volBars = computed(() => {
  const n = series.value.length
  if (n === 0) return [] as { x: number, y: number, w: number, h: number }[]
  const maxVol = Math.max(...series.value.map(p => p.volume), 1)
  const slot = CHART_W / n
  const w = Math.min(13, Math.max(1.8, slot * 0.72))
  return series.value.map((p, i) => {
    // sqrt 压缩成交量动态范围（分布极偏，线性会让多数柱≈0）；非零至少 2.4 高，保证可见
    const h = p.volume > 0 ? Math.max(2.4, Math.sqrt(p.volume / maxVol) * VOL_BAND) : 0
    const x = Math.max(0, Math.min(CHART_W - w, xAt(i, n) - w / 2))
    return { x, y: CHART_H - h, w, h }
  })
})

const hasChart = computed(() => series.value.length >= 2 && priceBounds.value !== null)

// ── 交互：十字准线 + 悬浮提示（鼠标 hover / 触屏拖动 scrub）──
const chartSvgRef = ref<SVGSVGElement | null>(null)
const hoverIndex = ref<number | null>(null)

const hover = computed(() => {
  const i = hoverIndex.value
  if (i == null) return null
  const arr = series.value
  const p = arr[i]
  if (!p) return null
  const x = xAt(i, arr.length)
  const b = priceBounds.value
  const hasPrice = typeof p.price === 'number' && p.price > 0 && b !== null
  const y = hasPrice ? PRICE_TOP + (1 - ((p.price as number) - b!.min) / (b!.max - b!.min)) * PRICE_BAND : null
  return { i, p, x, y }
})

const tooltip = computed(() => {
  const h = hover.value
  if (!h) return null
  const frac = h.x / CHART_W
  return {
    time: fmtClock(h.p.time),
    price: h.p.price,
    volume: h.p.volume,
    anchor: frac > 0.6 ? 'right' : frac < 0.2 ? 'left' : 'mid',
    leftPct: Math.max(0, Math.min(100, frac * 100)),
  }
})

function fmtClock(t: string): string {
  if (!t) return ''
  const i = t.indexOf('T')
  if (i >= 0) return t.slice(i + 1, i + 6) // ISO → HH:mm
  return t.length >= 5 ? t.slice(0, 5) : t
}

function updateHover(e: PointerEvent) {
  const svg = chartSvgRef.value
  const n = series.value.length
  if (!svg || n === 0) return
  const rect = svg.getBoundingClientRect()
  if (rect.width === 0) return
  const frac = (e.clientX - rect.left) / rect.width
  hoverIndex.value = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))))
}
function onChartLeave() { hoverIndex.value = null }
function onChartUp(e: PointerEvent) { if (e.pointerType !== 'mouse') hoverIndex.value = null }

// 阶梯表：数据变化后自动滚动到买卖分界（最近成交价附近）
const tableWrap = ref<HTMLElement | null>(null)
const boundaryIndex = computed(() => {
  const rows = active.value?.rows ?? []
  const idx = rows.findIndex(r => r.side === 'lay')
  return idx < 0 ? rows.length - 1 : idx
})
watch(() => active.value?.key, () => {
  nextTick(() => {
    const wrap = tableWrap.value
    if (!wrap) return
    const rowEls = wrap.querySelectorAll<HTMLElement>('tbody tr')
    const el = rowEls[Math.max(0, boundaryIndex.value)]
    if (el) wrap.scrollTop = Math.max(0, el.offsetTop - wrap.clientHeight / 2)
  })
})
</script>

<template>
  <section class="ladder-panel">
    <header class="lp-head">
      <h3>盘口明细</h3>
      <button class="lp-refresh focus-ring" aria-label="刷新" @click="refresh()">
        <RefreshCw :size="14" :class="{ spin: pending }" />
      </button>
    </header>

    <div class="lp-tabs">
      <button
        v-for="m in LADDER_MARKETS"
        :key="m.value"
        type="button"
        :class="['lp-tab focus-ring', { active: market === m.value }]"
        @click="onMarketTab(m.value)"
      >
        {{ m.label }}
      </button>
    </div>

    <!-- 权限锁定 -->
    <div v-if="locked" class="lp-locked">
      <Lock :size="15" />
      <span>{{ data?.lockMessage || '盘口明细未对当前会籍开放' }}</span>
    </div>

    <!-- 无数据 -->
    <div v-else-if="selections.length === 0" class="lp-empty">
      {{ pending ? '加载中…' : '本场该市场暂无盘口数据' }}
    </div>

    <template v-else>
      <!-- 选项下拉 -->
      <div class="lp-select-row">
        <select class="lp-select focus-ring" :value="activeKey" @change="onSelectionChange">
          <option v-for="s in selections" :key="s.key" :value="s.key">
            {{ s.label }}（{{ money(s.matched) }}）
          </option>
        </select>
      </div>

      <template v-if="active">
        <!-- 汇总 -->
        <div class="lp-summary">
          <div class="lp-stat">
            <span class="k">已成交</span>
            <b class="v">{{ price(active.tradedLow) }} ~ {{ price(active.tradedHigh) }}</b>
          </div>
          <div class="lp-stat">
            <span class="k">最近成交价</span>
            <b class="v hot">{{ price(active.lastPrice) }}</b>
          </div>
          <div class="lp-stat">
            <span class="k">此选项</span>
            <b class="v">{{ money(active.selectionTotal) }}</b>
          </div>
          <div class="lp-stat">
            <span class="k">此市场</span>
            <b class="v">{{ money(active.marketTotal) }}</b>
          </div>
        </div>

        <!-- 价格 / 成交量 迷你走势 -->
        <div v-if="hasChart" class="lp-chart">
          <svg
            ref="chartSvgRef"
            :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
            preserveAspectRatio="none"
            class="lp-svg"
            @pointerdown="updateHover"
            @pointermove="updateHover"
            @pointerleave="onChartLeave"
            @pointerup="onChartUp"
            @pointercancel="onChartLeave"
          >
            <rect
              v-for="(b, i) in volBars"
              :key="i"
              :x="b.x" :y="b.y" :width="b.w" :height="b.h"
              rx="0.6"
              class="vol-bar"
            />
            <path :d="priceArea" class="price-area" />
            <path :d="pricePath" class="price-line" fill="none" />
            <g v-if="hover">
              <line class="lp-crosshair" :x1="hover.x" :x2="hover.x" :y1="0" :y2="CHART_H" vector-effect="non-scaling-stroke" />
              <circle v-if="hover.y != null" class="lp-hi-dot" :cx="hover.x" :cy="hover.y" r="2.6" />
            </g>
          </svg>

          <div v-if="tooltip" :class="['lp-tip', `a-${tooltip.anchor}`]" :style="{ left: `${tooltip.leftPct}%` }">
            <div class="lp-tip-time">{{ tooltip.time }}</div>
            <div class="lp-tip-row">
              <i class="price" /><span class="tl">价格</span>
              <b class="tv">{{ tooltip.price != null && tooltip.price > 0 ? tooltip.price.toFixed(2) : '–' }}</b>
            </div>
            <div class="lp-tip-row">
              <i class="vol" /><span class="tl">成交量</span>
              <b class="tv">{{ money(tooltip.volume) }}</b>
            </div>
          </div>

          <div class="lp-chart-cap">
            <span>价格 / 成交量走势</span>
            <span class="muted">{{ priceBounds?.min.toFixed(2) }} – {{ priceBounds?.max.toFixed(2) }}</span>
          </div>
        </div>

        <!-- 阶梯表 -->
        <div ref="tableWrap" class="lp-table-wrap scrollbar-none">
          <table class="lp-table">
            <thead>
              <tr>
                <th class="c-price">价位</th>
                <th>买</th>
                <th>卖</th>
                <th>成交</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in active.rows" :key="i" :class="['lp-row', r.side]">
                <td class="c-price">{{ r.price.toFixed(2) }}</td>
                <td class="back">{{ r.back > 0 ? money(r.back) : '' }}</td>
                <td class="lay">{{ r.lay > 0 ? money(r.lay) : '' }}</td>
                <td class="traded">{{ r.traded > 0 ? money(r.traded) : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="lp-legend">
          <span class="lg back">买侧</span>
          <span class="lg lay">卖侧</span>
          <span class="muted">· 更新 {{ active.updatedTime.slice(11, 16) }}</span>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.ladder-panel {
  min-width: 0;
  padding: 9px 10px 10px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  box-shadow: var(--card-shadow);
}

.lp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 7px;
}

.lp-head h3 {
  margin: 0;
  font-size: 0.86rem;
  font-weight: 820;
}

.lp-refresh {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted);
}

.lp-refresh .spin {
  animation: lp-spin 0.8s linear infinite;
}

@keyframes lp-spin {
  to { transform: rotate(360deg); }
}

.lp-tabs {
  display: flex;
  gap: 5px;
  margin-bottom: 8px;
}

.lp-tab {
  flex: 1;
  padding: 5px 0;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 740;
}

.lp-tab.active {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}

.lp-locked,
.lp-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 22px 10px;
  color: var(--muted);
  font-size: 0.78rem;
  text-align: center;
}

.lp-select-row {
  margin-bottom: 8px;
}

.lp-select {
  width: 100%;
  padding: 6px 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font-size: 0.8rem;
  font-weight: 740;
}

.lp-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  margin-bottom: 8px;
  background: var(--divider);
  border: 1px solid var(--divider);
  border-radius: 6px;
  overflow: hidden;
}

.lp-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 8px;
  background: var(--panel);
}

.lp-stat .k {
  color: var(--muted);
  font-size: 0.68rem;
}

.lp-stat .v {
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--ink);
}

.lp-stat .v.hot {
  color: var(--brand-deep);
}

.lp-chart {
  position: relative;
  margin-bottom: 8px;
}

.lp-svg {
  display: block;
  width: 100%;
  height: 96px;
  border: 1px solid var(--divider);
  border-radius: 6px;
  background: var(--surface);
  cursor: crosshair;
  touch-action: pan-y; /* 纵向滑动滚页，横向拖动 scrub 准线 */
}

.lp-crosshair {
  stroke: var(--muted);
  stroke-dasharray: 3 3;
  opacity: 0.7;
  pointer-events: none;
}

.lp-hi-dot {
  fill: var(--down);
  stroke: var(--panel);
  stroke-width: 1.2;
  pointer-events: none;
}

.lp-tip {
  position: absolute;
  top: 2px;
  z-index: 3;
  transform: translateX(-50%);
  min-width: 84px;
  padding: 4px 7px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  box-shadow: var(--shadow-elev);
  font-size: 0.64rem;
  pointer-events: none;
}

.lp-tip.a-left { transform: translateX(0); }
.lp-tip.a-right { transform: translateX(-100%); }

.lp-tip-time {
  margin-bottom: 2px;
  color: var(--muted);
  font-weight: 740;
  font-variant-numeric: tabular-nums;
}

.lp-tip-row {
  display: flex;
  align-items: center;
  gap: 5px;
  line-height: 1.6;
}

.lp-tip-row i {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 2px;
  flex: 0 0 auto;
}

.lp-tip-row i.price { background: var(--down); }
.lp-tip-row i.vol { background: rgba(26, 140, 211, 0.4); }

.lp-tip-row .tl {
  flex: 1;
  color: var(--muted);
}

.lp-tip-row .tv {
  color: var(--ink);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.vol-bar {
  fill: var(--brand);
  opacity: 0.32;
}

.price-area {
  fill: var(--down);
  opacity: 0.08;
  stroke: none;
}

.price-line {
  stroke: var(--down);
  stroke-width: 1.6;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.lp-chart-cap {
  display: flex;
  justify-content: space-between;
  margin-top: 3px;
  font-size: 0.64rem;
  color: var(--muted);
}

.lp-table-wrap {
  max-height: 290px;
  overflow-y: auto;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 6px;
}

.lp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.74rem;
}

.lp-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 4px 8px;
  background: var(--lavender);
  color: var(--accent-deep);
  font-size: 0.68rem;
  font-weight: 780;
  text-align: right;
}

.lp-table thead th.c-price {
  text-align: left;
}

.lp-table td {
  padding: 3px 8px;
  text-align: right;
  border-bottom: 1px solid var(--divider);
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}

.lp-table td.c-price {
  text-align: left;
  font-weight: 760;
}

.lp-row.back {
  background: var(--home-bg);
}

.lp-row.lay {
  background: var(--red-soft-bg);
}

.lp-table td.traded {
  color: var(--muted);
  font-weight: 700;
}

.lp-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  font-size: 0.66rem;
  color: var(--muted);
}

.lg {
  padding: 1px 7px;
  border-radius: 3px;
  font-weight: 740;
}

.lg.back {
  background: var(--home-bg);
  color: var(--brand-deep);
}

.lg.lay {
  background: var(--red-soft-bg);
  color: var(--red-soft-fg);
}
</style>
