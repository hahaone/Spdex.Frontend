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
  /** 只看某序列（主/平/客）：null=全部。 */
  only?: 'home' | 'draw' | 'away' | null
  /** 固定基线值（模拟盈亏=60、冷热=0），不传则不画。 */
  baseline?: number | null
  /** 柱状模式：序列值用柱子呈现（成交变化）。 */
  barMode?: boolean
  /** 多价位线：同时画 主/平/客 三条价位线（成交「所有」），而非单条。 */
  multiPrice?: boolean
}>()

// viewBox 宽度 = 容器实测宽度 → 1px viewBox = 1px 屏幕。
// 这样字体/线宽/圆点不会随容器变宽被等比放大（修复宽屏下走势图被拉成巨大化）。
// SSR/首帧用 320 兜底，挂载后用 ResizeObserver 同步真实宽度。
const svgRef = ref<SVGSVGElement | null>(null)
const measuredWidth = ref(320)
const width = computed(() => measuredWidth.value)
const height = computed(() => props.height ?? 188)
const pad = { left: 30, right: 8, top: 16, bottom: 32 }

onMounted(() => {
  const el = svgRef.value
  if (!el) return
  const sync = () => {
    const w = el.clientWidth
    if (w > 0) measuredWidth.value = w
  }
  sync()
  const ro = new ResizeObserver(sync)
  ro.observe(el)
  onScopeDispose(() => ro.disconnect())
})

const labels = computed<ChartSeriesLabels>(() => props.seriesLabels ?? { home: '主', draw: '平', away: '客' })
const hasDraw = computed(() => labels.value.draw != null)
const unit = computed(() => props.unit ?? 'odds')
// 点数多时隐藏每点圆点(白描边圆点会糊成一团、遮住折线);稀疏时保留便于读数。十字准线 hover 点不受影响。
const showDots = computed(() => props.points.length <= 60)

type Field = 'home' | 'draw' | 'away'
const fields = computed<Field[]>(() => hasDraw.value ? ['home', 'draw', 'away'] : ['home', 'away'])

/** 只看某序列时只渲染它；否则全部。 */
const activeFields = computed<Field[]>(() => {
  if (props.only && fields.value.includes(props.only)) return [props.only]
  return fields.value
})
function showField(f: Field): boolean {
  if (f === 'draw' && !hasDraw.value) return false
  return !props.only || props.only === f
}

/** 0 视为缺失（payout 例外：0/负数有意义）。 */
function isMissing(v: number): boolean {
  return v === 0 && unit.value !== 'payout'
}

// 仅用「实际渲染的序列、去掉缺失值」来定标尺，避免被占位 0 拉扁
const scaleValues = computed(() => {
  const vals = props.points.flatMap(p => activeFields.value.map(f => p[f]))
  const filtered = vals.filter(v => Number.isFinite(v) && !isMissing(v))
  if (typeof props.baseline === 'number') filtered.push(props.baseline) // 基线纳入标尺，保证可见
  return filtered.length > 0 ? filtered : [0, 1]
})
// 价位/成交/比例等天然非负指标：Y 轴下限不下探到负数（payout/index 可负，不限制）
const NON_NEGATIVE_UNITS = ['odds', 'amount', 'percent']
const minValue = computed(() => {
  const lo = Math.min(...scaleValues.value)
  const hi = Math.max(...scaleValues.value)
  const span = hi - lo || Math.abs(hi) || 1
  const m = lo - span * 0.12
  return NON_NEGATIVE_UNITS.includes(unit.value) ? Math.max(0, m) : m
})
const maxValue = computed(() => {
  const lo = Math.min(...scaleValues.value)
  const hi = Math.max(...scaleValues.value)
  const span = hi - lo || Math.abs(hi) || 1
  return hi + span * 0.12
})
const chartH = computed(() => height.value - pad.top - pad.bottom)

// ── 价位叠加（成交柱图）：柱用左轴（成交量），价位线用右轴，全高单图层双轴叠加（不再上下分带）──
function priceValOf(p: ChartPoint, f: Field): number {
  const v = f === 'home' ? p.priceHome : f === 'draw' ? p.priceDraw : p.priceAway
  return v ?? 0
}
function priceVal(p: ChartPoint): number {
  const f = props.only && fields.value.includes(props.only) ? props.only : 'home'
  return priceValOf(p, f)
}
const priceField = computed<Field>(() => (props.only && fields.value.includes(props.only)) ? props.only : 'home')
const showPrice = computed(() => props.multiPrice
  ? props.points.some(p => fields.value.some(f => priceValOf(p, f) > 0))
  : (!!props.barMode && props.points.some(p => priceVal(p) > 0)))
const priceScaleVals = computed(() => props.multiPrice
  ? props.points.flatMap(p => fields.value.map(f => priceValOf(p, f))).filter(v => v > 0)
  : props.points.map(priceVal).filter(v => v > 0))
// 价位标尺上下各留 12% 余量,避免最小值(如低赔的主价位)贴底、最大值贴顶,折线位置更舒展。
const priceBounds = computed(() => {
  const vals = priceScaleVals.value
  if (!vals.length) return { min: 0, max: 1 }
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const span = hi - lo || Math.abs(hi) || 1
  return { min: lo - span * 0.12, max: hi + span * 0.12 }
})
const priceMin = computed(() => priceBounds.value.min)
const priceMax = computed(() => priceBounds.value.max)
const priceRange = computed(() => priceMax.value - priceMin.value || 1)

const padRight = computed(() => (showPrice.value ? 30 : pad.right))
const chartW = computed(() => width.value - pad.left - padRight.value)

// 柱子（成交量，左轴）始终用全高;价位线（右轴）单图层全高叠加,与柱重叠。
function barTopY(value: number): number {
  const span = maxValue.value - minValue.value || 1
  const frac = Math.max(0, Math.min(1, (value - minValue.value) / span))
  return pad.top + (1 - frac) * chartH.value
}
function priceYAt(p: number): number {
  return pad.top + chartH.value * (1 - (p - priceMin.value) / priceRange.value)
}
const pricePath = computed(() => {
  let d = ''
  let pen = false
  props.points.forEach((point, index) => {
    const v = priceVal(point)
    if (!(v > 0)) { pen = false; return }
    d += `${pen ? 'L' : 'M'} ${xAt(index).toFixed(2)} ${priceYAt(v).toFixed(2)} `
    pen = true
  })
  return d.trim()
})
const priceDots = computed(() =>
  showDots.value ? props.points.map((point, index) => ({ index, v: priceVal(point) })).filter(d => d.v > 0) : [])
function pricePathFor(field: Field): string {
  let d = ''
  let pen = false
  props.points.forEach((point, index) => {
    const v = priceValOf(point, field)
    if (!(v > 0)) { pen = false; return }
    d += `${pen ? 'L' : 'M'} ${xAt(index).toFixed(2)} ${priceYAt(v).toFixed(2)} `
    pen = true
  })
  return d.trim()
}
const priceTicks = computed(() => {
  if (!showPrice.value) return []
  return [0, 0.5, 1].map(f => ({
    y: pad.top + chartH.value * f,
    label: (priceMax.value - priceRange.value * f).toFixed(2),
  }))
})

function xAt(index: number): number {
  if (props.points.length <= 1) return pad.left
  return pad.left + (index / (props.points.length - 1)) * chartW.value
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

const baselineY = computed(() => typeof props.baseline === 'number' ? yAt(props.baseline) : null)

/** 柱状模式：每个可见点一根柱（从轴底到值），多序列横向错开。 */
function barsFor(field: Field) {
  const baseY = pad.top + chartH.value
  const n = activeFields.value.length
  const idx = activeFields.value.indexOf(field)
  const slot = props.points.length > 1 ? chartW.value / (props.points.length - 1) : chartW.value
  const bw = Math.min(6, Math.max(1.4, (slot * 0.7) / n))
  const offset = (idx - (n - 1) / 2) * bw
  return visibleDots(field).map((d) => {
    const y = barTopY(d.value)
    return { x: xAt(d.index) + offset - bw / 2, y: Math.min(y, baseY), h: Math.abs(baseY - y) || 1, w: bw }
  })
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

function timeParts(point?: ChartPoint): { ymd?: string, hm: string } {
  const raw = point?.ts || point?.time || ''
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  if (match?.[1] && match[2]) return { ymd: match[1], hm: match[2] }
  return { hm: point?.time || '' }
}

function fmtAxisTime(point?: ChartPoint): string {
  const p = timeParts(point)
  return p.ymd ? `${p.ymd.slice(5)} ${p.hm}` : p.hm
}

function fmtTipTime(point?: ChartPoint): string {
  const p = timeParts(point)
  return p.ymd ? `${p.ymd} ${p.hm}` : p.hm
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
  const frac = h.x / width.value
  // 框始终移到光标侧旁(左半→框在右、右半→框在左),不再居中盖住十字准线/数据点。
  const anchor = frac > 0.5 ? 'right' : 'left'
  return {
    time: fmtTipTime(h.p),
    volume: h.p.volume,
    price: priceVal(h.p),
    anchor,
    leftPct: Math.max(0, Math.min(100, frac * 100)),
    rows: activeFields.value.map(f => ({ key: f, label: labels.value[f] ?? '', value: h.p[f], missing: isMissing(h.p[f]) })),
    prices: fields.value.map(f => ({ key: f, label: labels.value[f] ?? '', v: priceValOf(h.p, f) })),
  }
})

function updateFromEvent(e: PointerEvent) {
  const svg = svgRef.value
  const n = props.points.length
  if (!svg || n === 0) return
  const rect = svg.getBoundingClientRect()
  if (rect.width === 0) return
  const vbX = ((e.clientX - rect.left) / rect.width) * width.value
  const t = (vbX - pad.left) / (chartW.value || 1)
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
      :style="{ height: `${height}px` }"
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
          :x2="width - padRight"
          :y1="tick.y"
          :y2="tick.y"
          class="grid"
        />
        <text :x="pad.left - 4" :y="tick.y + 3" class="y-tick" text-anchor="end">{{ fmtValue(tick.value) }}</text>
      </g>

      <line :x1="pad.left" :x2="width - padRight" :y1="height - pad.bottom" :y2="height - pad.bottom" class="axis" />

      <!-- 基线（模拟盈亏=60 / 冷热=0）+ 数值标记 -->
      <g v-if="baselineY != null">
        <line class="baseline" :x1="pad.left" :x2="width - padRight" :y1="baselineY" :y2="baselineY" />
        <rect class="bl-badge" :x="width - padRight - 22" :y="baselineY - 7" width="22" height="13" rx="3" />
        <text class="bl-text" :x="width - padRight - 11" :y="baselineY + 2.6" text-anchor="middle">{{ baseline }}</text>
      </g>

      <!-- 柱状模式（成交变化）：序列用柱子 -->
      <template v-if="barMode">
        <template v-for="f in activeFields" :key="`bar-${f}`">
          <rect v-for="(b, bi) in barsFor(f)" :key="`bar-${f}-${bi}`" :class="['series-bar', f]" :x="b.x" :y="b.y" :width="b.w" :height="b.h" rx="0.6" />
        </template>
      </template>

      <!-- 成交变化叠加价位线（上方带，跟随 only 单选项；右轴标价位）-->
      <template v-if="showPrice">
        <template v-if="multiPrice">
          <path v-for="f in fields" :key="`pl-${f}`" :class="['price-line', f]" :d="pricePathFor(f)" />
        </template>
        <template v-else>
          <path class="price-line" :d="pricePath" />
          <circle v-for="(d, i) in priceDots" :key="`pd-${i}`" class="price-dot" :cx="xAt(d.index)" :cy="priceYAt(d.v)" r="1.8" />
        </template>
        <text
          v-for="(t, i) in priceTicks"
          :key="`pt-${i}`"
          :x="width - padRight + 3"
          :y="t.y + 3"
          class="price-tick"
          text-anchor="start"
        >{{ t.label }}</text>
      </template>

      <!-- 折线模式 -->
      <template v-else>
        <path v-if="showField('home')" class="line home" :d="linePath('home')" />
        <path v-if="showField('draw')" class="line draw" :d="linePath('draw')" />
        <path v-if="showField('away')" class="line away" :d="linePath('away')" />

        <g v-if="showDots">
          <template v-if="showField('home')">
            <circle v-for="d in visibleDots('home')" :key="`h-${d.index}`" class="dot home" :cx="xAt(d.index)" :cy="yAt(d.value)" r="2.2" />
          </template>
          <template v-if="showField('draw')">
            <circle v-for="d in visibleDots('draw')" :key="`d-${d.index}`" class="dot draw" :cx="xAt(d.index)" :cy="yAt(d.value)" r="2.2" />
          </template>
          <template v-if="showField('away')">
            <circle v-for="d in visibleDots('away')" :key="`a-${d.index}`" class="dot away" :cx="xAt(d.index)" :cy="yAt(d.value)" r="2.2" />
          </template>
        </g>
      </template>

      <text :x="pad.left" :y="height - 8" class="x-tick">{{ fmtAxisTime(points[0]) }}</text>
      <text :x="(pad.left + width - padRight) / 2" :y="height - 8" class="x-tick" text-anchor="middle">{{ fmtAxisTime(points[Math.floor(points.length / 2)]) }}</text>
      <text :x="width - padRight" :y="height - 8" class="x-tick" text-anchor="end">{{ fmtAxisTime(points[points.length - 1]) }}</text>

      <g v-if="hover" class="cross">
        <line class="crosshair" :x1="hover.x" :x2="hover.x" :y1="pad.top" :y2="height - pad.bottom" />
        <template v-for="f in activeFields" :key="`hi-${f}`">
          <circle v-if="!isMissing(hover.p[f])" :class="['dot-hi', f]" :cx="hover.x" :cy="barMode ? barTopY(hover.p[f]) : yAt(hover.p[f])" r="3.4" />
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
      <template v-if="showPrice">
        <template v-if="multiPrice">
          <div v-for="pr in tooltip.prices" :key="`tp-${pr.key}`" class="tip-row">
            <i :class="['price', pr.key]" />
            <span class="tl">{{ pr.label }}价位</span>
            <b class="tv">{{ pr.v > 0 ? pr.v.toFixed(2) : '-' }}</b>
          </div>
        </template>
        <div v-else class="tip-row">
          <i class="price" />
          <span class="tl">{{ labels[priceField] }}价位</span>
          <b class="tv">{{ tooltip.price > 0 ? tooltip.price.toFixed(2) : '-' }}</b>
        </div>
      </template>
    </div>
    <div class="legend">
      <span><i class="home" />{{ labels.home }}</span>
      <span v-if="hasDraw"><i class="draw" />{{ labels.draw }}</span>
      <span><i class="away" />{{ labels.away }}</span>
      <template v-if="showPrice">
        <template v-if="multiPrice">
          <span><i class="price home" />{{ labels.home }}价位</span>
          <span v-if="hasDraw"><i class="price draw" />{{ labels.draw }}价位</span>
          <span><i class="price away" />{{ labels.away }}价位</span>
        </template>
        <span v-else><i class="price" />{{ labels[priceField] }}价位</span>
      </template>
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

/* 提示框移到光标侧旁并留 9px 间隙,避免盖住十字准线/数据点(原 a-mid 居中会遮挡光标)。 */
.tip.a-left {
  transform: translateX(9px);
}

.tip.a-right {
  transform: translateX(calc(-100% - 9px));
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
  background: rgba(124, 92, 250, 0.4);
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

.baseline {
  stroke: var(--down);
  stroke-width: 1.2;
  stroke-dasharray: 5 3;
  opacity: 0.65;
  pointer-events: none;
}

/* 基线数值标记（模拟盈亏 60 / 冷热 0） */
.bl-badge {
  fill: var(--down);
  opacity: 0.92;
  pointer-events: none;
}

.bl-text {
  fill: #fff;
  font-size: 9px;
  font-weight: 800;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  pointer-events: none;
}

.series-bar { opacity: 0.85; }
.series-bar.home { fill: var(--buy); }
.series-bar.draw { fill: var(--sell); }
.series-bar.away { fill: var(--brand); }

/* 价位线（成交变化叠加，金色与三序列区分） */
.price-line {
  fill: none;
  stroke: #c79320;
  stroke-width: 1.6;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.price-dot {
  fill: #c79320;
}

.price-tick {
  fill: #c79320;
  font-size: 9px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
}

.tip-row i.price,
.legend .price {
  background: #c79320;
}

/* 成交「所有」三条价位线:按方向上色(主/平/客),与柱同色系 */
.price-line.home { stroke: var(--buy); }
.price-line.draw { stroke: var(--sell); }
.price-line.away { stroke: var(--brand); }
.tip-row i.price.home,
.legend .price.home { background: var(--buy); }
.tip-row i.price.draw,
.legend .price.draw { background: var(--sell); }
.tip-row i.price.away,
.legend .price.away { background: var(--brand); }

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
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px 12px;
  padding: 2px 2px 0;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 720;
  line-height: 1.3;
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
</style>
