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
const PAD_BOTTOM = 24 // 底部留白:x 轴时间标签落在 0 线下方,不与柱/0 线重叠(对齐 StaticTrendChart)
const BUCKET_W_FLOOR = 1.2

const buckets = computed(() => props.result?.buckets ?? [])
const attrs = computed(() => props.result?.attrs ?? [])

// 图例点击切换:隐藏的成交方向(买/卖/冲/买+/卖+/换)与价位线。切换选项(主/客/平)时自动清空。
const hiddenAttrs = ref<Set<string>>(new Set())
const priceHidden = ref(false)
const visibleAttrs = computed(() => attrs.value.filter(a => !hiddenAttrs.value.has(a)))
function isAttrHidden(a: string): boolean { return hiddenAttrs.value.has(a) }
function toggleAttr(a: string) {
  const next = new Set(hiddenAttrs.value)
  if (next.has(a)) next.delete(a)
  else next.add(a)
  hiddenAttrs.value = next
}
watch(() => props.result?.selectionLabel, () => { hiddenAttrs.value = new Set(); priceHidden.value = false })

// 测量中部可视宽度：旧站成交图会把原始点压进当前图宽，不能按固定最小桶宽横向滚动，
// 否则 raw 明细点虽然返回了，当前视口里仍只看到稀疏的一小段。
const scrollRef = ref<HTMLElement | null>(null)
const measuredWidth = ref(320)
onMounted(() => {
  const el = scrollRef.value
  if (!el) return
  const sync = () => { const w = el.clientWidth; if (w > 0) measuredWidth.value = w }
  sync()
  const ro = new ResizeObserver(sync)
  ro.observe(el)
  document.addEventListener('pointerdown', onDocPointerDown, true)
  onScopeDispose(() => {
    ro.disconnect()
    document.removeEventListener('pointerdown', onDocPointerDown, true)
  })
})
const bucketW = computed(() => {
  const n = buckets.value.length
  return n > 0 ? Math.max(BUCKET_W_FLOOR, measuredWidth.value / n) : 8
})

const chartH = computed(() => Math.max(props.height - PAD_TOP - PAD_BOTTOM, 40))
const svgW = computed(() => Math.max(buckets.value.length * bucketW.value, measuredWidth.value, 10))

const maxVol = computed(() => {
  let m = 0
  for (const b of buckets.value) {
    for (const a of visibleAttrs.value) {
      const v = b.items[a] ?? 0
      if (v > m) m = v
    }
  }
  return m > 0 ? m : 1
})

const prices = computed(() =>
  buckets.value.map(b => b.price).filter((p): p is number => p != null && p > 0))
// 价位标尺上下各留 12% 余量(对齐 StaticTrendChart),避免折线触顶/触底。
const priceBounds = computed(() => {
  if (!prices.value.length) return { min: 0, max: 1 }
  const lo = Math.min(...prices.value)
  const hi = Math.max(...prices.value)
  const span = hi - lo || Math.abs(hi) || 1
  return { min: lo - span * 0.12, max: hi + span * 0.12 }
})
const priceMin = computed(() => priceBounds.value.min)
const priceMax = computed(() => priceBounds.value.max)
const priceRange = computed(() => priceMax.value - priceMin.value || 1)
const hasPrice = computed(() => prices.value.length > 0)
const showPrice = computed(() => hasPrice.value && !priceHidden.value)

/**
 * 价位 + 成交「全高叠加」(双轴,与经典 StaticTrendChart 统一):成交柱与价位线同占整图高、上下叠加;
 * 左轴=成交、右轴=价位。成交柱用「平方根标度」——单笔大单常是普通桶 10×+,线性会把普通柱压成贴地短条,
 * sqrt 让中小柱清晰可见且大单仍最高、顺序不变。
 */
const volBandH = computed(() => chartH.value) // 成交柱占整图高(与价位线叠加)
const volBase = computed(() => PAD_TOP + chartH.value) // 柱底 = 图底
const volTop = computed(() => PAD_TOP) // 柱区顶 = 图顶(全高)

function volH(v: number): number {
  if (v <= 0) return 0
  return volBandH.value * Math.sqrt(v) / Math.sqrt(maxVol.value)
}
function priceY(p: number): number {
  return PAD_TOP + chartH.value * (1 - (p - priceMin.value) / priceRange.value)
}

interface Bar { x: number, y: number, w: number, h: number, color: string }
const bars = computed<Bar[]>(() => {
  const out: Bar[] = []
  const vis = visibleAttrs.value
  const aN = Math.max(vis.length, 1)
  const bw = bucketW.value
  const gap = bw >= 6 ? 5 : Math.max(0.2, bw * 0.18)
  const groupW = Math.max(bw - gap, 0.8)
  const barW = groupW / aN
  buckets.value.forEach((b, i) => {
    const x0 = i * bw + gap / 2
    vis.forEach((a, j) => {
      const v = b.items[a] ?? 0
      if (v <= 0) return
      const h = volH(v)
      out.push({
        x: x0 + j * barW,
        y: volBase.value - h,
        w: Math.max(barW - 0.15, 0.45),
        h,
        color: attrColor(a),
      })
    })
  })
  return out
})

const pricePts = computed(() => {
  const pts: { x: number, y: number }[] = []
  const bw = bucketW.value
  buckets.value.forEach((b, i) => {
    if (b.price != null && b.price > 0)
      pts.push({ x: i * bw + bw / 2, y: priceY(b.price) })
  })
  return pts
})
const priceLine = computed(() => pricePts.value.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
const pointRadius = computed(() => bucketW.value < 4 ? 0.8 : 1.6)

/** 成交（左轴，下方带）刻度：等视觉高度处的真实成交量（sqrt 标度 → 量值非线性，向下收窄）。 */
const volTicks = computed(() =>
  [0, 0.5, 1].map((frac) => ({ // 0=带顶
    y: volTop.value + volBandH.value * frac,
    label: fmtVol(maxVol.value * (1 - frac) ** 2),
  })))
function fmtVol(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(1)}万`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`
  return Math.round(v).toString()
}

/** 价位（右轴，上方带）刻度：max / mid / min。 */
const priceTicks = computed(() => {
  if (!showPrice.value) return []
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
  const bw = bucketW.value
  return idxs.map(i => ({ x: i * bw + bw / 2, label: hm(bs[i]!.time) }))
})
function hm(iso: string): string {
  const t = iso.indexOf('T')
  return t < 0 ? iso : iso.slice(t + 1, t + 6)
}

const totalH = computed(() => props.height)

// ── 交互:十字准线 + 悬浮提示(对齐旧站成交走势图) ──
const chartRef = ref<HTMLElement | null>(null)
const hoverIndex = ref<number | null>(null)
const tipLeft = ref(0)
// 触屏「钉住」:点一下后 tooltip 常显(手指离开不消失),点图表外才取消;鼠标不钉(沿用 hover / leave)。
const pinned = ref(false)
function setHoverAt(e: PointerEvent) {
  const el = scrollRef.value
  const n = buckets.value.length
  if (!el || n === 0) return
  const rect = el.getBoundingClientRect()
  if (rect.width === 0) return
  const svgX = (e.clientX - rect.left) + el.scrollLeft
  hoverIndex.value = Math.max(0, Math.min(n - 1, Math.floor(svgX / bucketW.value)))
  const chartRect = chartRef.value?.getBoundingClientRect()
  tipLeft.value = chartRect ? e.clientX - chartRect.left : 0
}
function onDown(e: PointerEvent) {
  setHoverAt(e)
  if (e.pointerType === 'mouse') pinned.value = false
}
function onMove(e: PointerEvent) { setHoverAt(e) }
function onUp(e: PointerEvent) {
  if (e.pointerType !== 'mouse') pinned.value = hoverIndex.value != null
}
function onLeave() { if (!pinned.value) hoverIndex.value = null }
// 触屏钉住后:点击图表外任意处取消 tooltip(点图表内则保留/移动)。
function onDocPointerDown(e: PointerEvent) {
  if (!pinned.value) return
  const el = chartRef.value
  if (el && e.target instanceof Node && el.contains(e.target)) return
  pinned.value = false
  hoverIndex.value = null
}
const crosshairX = computed(() => (hoverIndex.value == null ? 0 : hoverIndex.value * bucketW.value + bucketW.value / 2))
const tip = computed(() => {
  const i = hoverIndex.value
  if (i == null) return null
  const b = buckets.value[i]
  if (!b) return null
  const chartW = chartRef.value?.clientWidth ?? 320
  return {
    time: hm(b.time),
    rows: visibleAttrs.value.map(a => ({ label: a, value: b.items[a] ?? 0, color: attrColor(a) })).filter(r => r.value > 0),
    price: showPrice.value ? b.price : null,
    rightSide: tipLeft.value > chartW * 0.58,
  }
})
</script>

<template>
  <div ref="chartRef" class="tf-chart">
    <div class="tf-body" :style="{ height: `${totalH}px` }">
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
      <div ref="scrollRef" class="tf-scroll scrollbar-thin">
        <svg :width="svgW" :height="totalH" :viewBox="`0 0 ${svgW} ${totalH}`" preserveAspectRatio="none" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointerleave="onLeave" @pointercancel="onLeave">
          <!-- 网格线：成交带 + 价位带 -->
          <line
            v-for="(t, i) in volTicks"
            :key="`gv${i}`"
            x1="0"
            :x2="svgW"
            :y1="t.y"
            :y2="t.y"
            class="tf-grid"
          />
          <line
            v-for="(t, i) in priceTicks"
            :key="`gp${i}`"
            x1="0"
            :x2="svgW"
            :y1="t.y"
            :y2="t.y"
            class="tf-grid price"
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
          <!-- 价位线（图例可隐藏） -->
          <template v-if="showPrice">
            <polyline v-if="priceLine" :points="priceLine" class="tf-price-line" :stroke="PRICE_COLOR" />
            <circle
              v-for="(p, i) in pricePts"
              :key="`p${i}`"
              :cx="p.x"
              :cy="p.y"
              :r="pointRadius"
              :fill="PRICE_COLOR"
            />
          </template>
          <!-- x 轴时间 -->
          <text
            v-for="(t, i) in timeLabels"
            :key="`t${i}`"
            :x="t.x"
            :y="totalH - 8"
            class="tf-axis-text"
            text-anchor="middle"
          >{{ t.label }}</text>
          <!-- 十字准线 -->
          <line v-if="hoverIndex != null" :x1="crosshairX" :x2="crosshairX" :y1="PAD_TOP" :y2="volBase" class="tf-crosshair" />
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

    <!-- 悬浮提示 -->
    <div v-if="tip" class="tf-tip" :class="{ right: tip.rightSide }" :style="{ left: `${tipLeft}px` }">
      <div class="tf-tip-time">{{ tip.time }}</div>
      <div v-for="r in tip.rows" :key="r.label" class="tf-tip-row">
        <i class="sw" :style="{ background: r.color }" />
        <span>{{ result?.selectionLabel }}-{{ r.label }}</span>
        <b>{{ fmtVol(r.value) }}</b>
      </div>
      <div v-if="tip.price" class="tf-tip-row">
        <i class="sw line" :style="{ background: PRICE_COLOR }" />
        <span>{{ result?.selectionLabel }}价位</span>
        <b>{{ tip.price.toFixed(2) }}</b>
      </div>
    </div>

    <!-- 图例 -->
    <div class="tf-legend scrollbar-none">
      <button v-for="a in attrs" :key="a" type="button" class="tf-lg" :class="{ off: isAttrHidden(a) }" @click="toggleAttr(a)">
        <i class="sw" :style="{ background: attrColor(a) }" />{{ result?.selectionLabel }}-{{ a }}
      </button>
      <button v-if="hasPrice" type="button" class="tf-lg" :class="{ off: priceHidden }" @click="priceHidden = !priceHidden">
        <i class="sw line" :style="{ background: PRICE_COLOR }" />{{ result?.selectionLabel }}价位
      </button>
    </div>
  </div>
</template>

<style scoped>
.tf-chart {
  position: relative;
  display: grid;
  gap: 2px;
}

.tf-crosshair {
  stroke: #9aa3af;
  stroke-width: 1;
  stroke-dasharray: 3 3;
  pointer-events: none;
}

.tf-tip {
  position: absolute;
  top: 4px;
  z-index: 6;
  min-width: 92px;
  transform: translateX(8px);
  padding: 5px 8px;
  border: 1px solid var(--classic-border, #dce1e8);
  border-radius: 4px;
  background: var(--classic-panel, #fff);
  box-shadow: 0 2px 10px rgba(20, 30, 50, 0.16);
  font-size: 0.7rem;
  pointer-events: none;
}

.tf-tip.right {
  transform: translateX(calc(-100% - 8px));
}

.tf-tip-time {
  margin-bottom: 3px;
  color: var(--classic-title-muted, #8f8f8f);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.tf-tip-row {
  display: flex;
  align-items: center;
  gap: 5px;
  line-height: 1.55;
  color: var(--classic-text, #444);
}

.tf-tip-row .sw {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex: 0 0 auto;
}

.tf-tip-row .sw.line {
  height: 3px;
}

.tf-tip-row b {
  margin-left: auto;
  padding-left: 10px;
  font-variant-numeric: tabular-nums;
}

.tf-body {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 32px;
  align-items: stretch;
  /* 与其他图表统一:浅灰渐变背景 + 细边框圆角。 */
  border: 1px solid var(--line);
  border-radius: 4px;
  background: linear-gradient(180deg, var(--panel) 0%, var(--surface) 100%);
  overflow: hidden;
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

/* 价位带网格线：浅蓝细线，与成交带区分 */
.tf-grid.price {
  stroke: rgba(91, 155, 213, 0.2);
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
  align-items: center;
  justify-content: center;
  gap: 2px 12px;
  padding: 2px 2px 0;
  line-height: 1.3;
}

.tf-lg {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 3px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--muted);
  white-space: nowrap;
  cursor: pointer;
  transition: opacity 0.12s ease, background 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}

.tf-lg:hover {
  background: var(--surface);
}

.tf-lg.off {
  opacity: 0.36;
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
