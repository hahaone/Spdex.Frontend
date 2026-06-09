<script setup lang="ts">
import type { ChartPoint } from '~/types/market'
import type { ChartSeriesLabels } from '~/composables/useChartSeries'

/**
 * 比例走势图（百分比堆叠面积图）：每个时间点把 主/平/客 占比堆叠到 100%。
 * 底→顶：客队(灰) / 平局(绿) / 主队(紫)，边界带标记点。还原旧站「比例走势图」。
 * 2 路盘（大小/让分，draw=null）时仅 2 层堆叠。
 */
const props = defineProps<{
  points: ChartPoint[]
  height?: number
  seriesLabels?: ChartSeriesLabels
}>()

const svgRef = ref<SVGSVGElement | null>(null)
const measuredWidth = ref(320)
const width = computed(() => measuredWidth.value)
const height = computed(() => props.height ?? 240)
const pad = { left: 30, right: 10, top: 14, bottom: 32 }

onMounted(() => {
  const el = svgRef.value
  if (!el) return
  const sync = () => { const w = el.clientWidth; if (w > 0) measuredWidth.value = w }
  sync()
  const ro = new ResizeObserver(sync)
  ro.observe(el)
  onScopeDispose(() => ro.disconnect())
})

const labels = computed<ChartSeriesLabels>(() => props.seriesLabels ?? { home: '主', draw: '平', away: '客' })
const hasDraw = computed(() => labels.value.draw != null)
const chartW = computed(() => width.value - pad.left - pad.right)
const chartH = computed(() => height.value - pad.top - pad.bottom)

interface Norm { i: number, home: number, draw: number, away: number }
// 每点归一化为百分比（和=100）；sum<=0（无成交）视为缺口跳过。
const norm = computed<Norm[]>(() => {
  const out: Norm[] = []
  props.points.forEach((p, i) => {
    const h = Math.max(0, p.home)
    const d = hasDraw.value ? Math.max(0, p.draw) : 0
    const a = Math.max(0, p.away)
    const sum = h + d + a
    if (sum <= 0) return
    out.push({ i, home: (h / sum) * 100, draw: (d / sum) * 100, away: (a / sum) * 100 })
  })
  return out
})

function xAt(i: number): number {
  const n = props.points.length
  if (n <= 1) return pad.left
  return pad.left + (i / (n - 1)) * chartW.value
}
function yAt(pct: number): number {
  return pad.top + (1 - pct / 100) * chartH.value
}

// 累计上边界（底→顶）：客队 away%；平局 away+draw%；主队 100%。
function cumAway(n: Norm): number { return n.away }
function cumDraw(n: Norm): number { return n.away + n.draw }

function areaPath(lower: (n: Norm) => number, upper: (n: Norm) => number): string {
  const vs = norm.value
  if (!vs.length) return ''
  let top = ''
  vs.forEach((n, k) => { top += `${k ? 'L' : 'M'} ${xAt(n.i).toFixed(2)} ${yAt(upper(n)).toFixed(2)} ` })
  let bot = ''
  ;[...vs].reverse().forEach((n) => { bot += `L ${xAt(n.i).toFixed(2)} ${yAt(lower(n)).toFixed(2)} ` })
  return `${top}${bot}Z`.trim()
}

const awayArea = computed(() => areaPath(() => 0, cumAway))
const drawArea = computed(() => areaPath(cumAway, cumDraw))
const homeArea = computed(() => areaPath(cumDraw, () => 100))

function boundaryLine(at: (n: Norm) => number): string {
  let d = ''
  norm.value.forEach((n, k) => { d += `${k ? 'L' : 'M'} ${xAt(n.i).toFixed(2)} ${yAt(at(n)).toFixed(2)} ` })
  return d.trim()
}
const awayBoundary = computed(() => boundaryLine(cumAway))
const drawBoundary = computed(() => boundaryLine(cumDraw))

// 标记采样，避免过密（最多 ~40 个）。
const markerStep = computed(() => Math.max(1, Math.ceil(norm.value.length / 40)))
const sampled = computed(() => norm.value.filter((_, k) => k % markerStep.value === 0))
const awayMarkers = computed(() => sampled.value.map(n => ({ x: xAt(n.i), y: yAt(cumAway(n)) })))
const drawMarkers = computed(() => (hasDraw.value ? sampled.value.map(n => ({ x: xAt(n.i), y: yAt(cumDraw(n)) })) : []))

const yTicks = [0, 25, 50, 75, 100]

// ── 交互：十字准线 + 悬浮提示 ──
const hoverIndex = ref<number | null>(null)
const hover = computed(() => {
  const i = hoverIndex.value
  if (i == null) return null
  if (!props.points[i]) return null
  return { i, n: norm.value.find(x => x.i === i) ?? null, x: xAt(i) }
})
const tooltip = computed(() => {
  const h = hover.value
  if (!h || !h.n) return null
  const frac = h.x / width.value
  const anchor = frac > 0.5 ? 'right' : 'left' // 框移到光标侧旁,不居中盖住光标列/数据点
  return {
    time: fmtTime(props.points[h.i]),
    anchor,
    leftPct: Math.max(0, Math.min(100, frac * 100)),
    rows: [
      { key: 'home', label: labels.value.home, v: h.n.home },
      ...(hasDraw.value ? [{ key: 'draw', label: labels.value.draw ?? '', v: h.n.draw }] : []),
      { key: 'away', label: labels.value.away, v: h.n.away },
    ],
  }
})

function fmtTime(p?: ChartPoint): string {
  const raw = p?.ts || p?.time || ''
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  return m?.[1] && m[2] ? `${m[1]} ${m[2]}` : (p?.time || '')
}
function fmtAxisTime(p?: ChartPoint): string {
  const raw = p?.ts || p?.time || ''
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  return m?.[1] && m[2] ? `${m[1].slice(5)} ${m[2]}` : (p?.time || '')
}

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
  <div class="ratio-chart">
    <svg
      ref="svgRef"
      :viewBox="`0 0 ${width} ${height}`"
      :style="{ height: `${height}px` }"
      role="img"
      aria-label="比例走势图"
      @pointerdown="onMove"
      @pointermove="onMove"
      @pointerleave="onLeave"
      @pointerup="onUp"
      @pointercancel="onLeave"
    >
      <g v-for="t in yTicks" :key="t">
        <line :x1="pad.left" :x2="width - pad.right" :y1="yAt(t)" :y2="yAt(t)" class="grid" />
        <text :x="pad.left - 4" :y="yAt(t) + 3" class="y-tick" text-anchor="end">{{ t }}</text>
      </g>

      <!-- 堆叠面积：底→顶 客/平/主 -->
      <path class="area away" :d="awayArea" />
      <path v-if="hasDraw" class="area draw" :d="drawArea" />
      <path class="area home" :d="homeArea" />

      <!-- 边界线 + 标记点 -->
      <path class="boundary" :d="awayBoundary" />
      <path v-if="hasDraw" class="boundary" :d="drawBoundary" />
      <rect v-for="(m, i) in awayMarkers" :key="`as-${i}`" class="mk square" :x="m.x - 2.1" :y="m.y - 2.1" width="4.2" height="4.2" />
      <rect
        v-for="(m, i) in drawMarkers"
        :key="`dd-${i}`"
        class="mk diamond"
        :x="m.x - 2.3"
        :y="m.y - 2.3"
        width="4.6"
        height="4.6"
        :transform="`rotate(45 ${m.x} ${m.y})`"
      />

      <text :x="pad.left" :y="height - 8" class="x-tick">{{ fmtAxisTime(points[0]) }}</text>
      <text :x="(pad.left + width - pad.right) / 2" :y="height - 8" class="x-tick" text-anchor="middle">{{ fmtAxisTime(points[Math.floor(points.length / 2)]) }}</text>
      <text :x="width - pad.right" :y="height - 8" class="x-tick" text-anchor="end">{{ fmtAxisTime(points[points.length - 1]) }}</text>

      <line v-if="hover" class="crosshair" :x1="hover.x" :x2="hover.x" :y1="pad.top" :y2="height - pad.bottom" />
    </svg>

    <div v-if="tooltip" :class="['tip', `a-${tooltip.anchor}`]" :style="{ left: `${tooltip.leftPct}%` }">
      <div class="tip-time">{{ tooltip.time }}</div>
      <div v-for="r in tooltip.rows" :key="r.key" class="tip-row">
        <i :class="r.key" />
        <span class="tl">{{ r.label }}</span>
        <b class="tv">{{ r.v.toFixed(1) }}%</b>
      </div>
    </div>

    <div class="legend">
      <span><i class="home" />{{ labels.home }}</span>
      <span v-if="hasDraw"><i class="draw" />{{ labels.draw }}</span>
      <span><i class="away" />{{ labels.away }}</span>
    </div>
  </div>
</template>

<style scoped>
.ratio-chart {
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
  touch-action: pan-y;
}

.grid {
  stroke: var(--divider);
  stroke-width: 0.8;
  stroke-dasharray: 2 3;
}

.y-tick,
.x-tick {
  fill: var(--muted);
  font-size: 9px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
}

/* 堆叠面积色（对齐旧站：主队紫 / 平局绿 / 客队灰） */
.area { stroke: none; }
.area.home { fill: #7e5aa8; }
.area.draw { fill: #a9d6b5; }
.area.away { fill: #8b919c; }

.boundary {
  fill: none;
  stroke: rgba(255, 255, 255, 0.92);
  stroke-width: 1.1;
  stroke-linejoin: round;
}

.mk {
  fill: #fff;
  stroke: rgba(70, 80, 95, 0.7);
  stroke-width: 0.7;
}

.crosshair {
  stroke: rgba(20, 28, 45, 0.5);
  stroke-width: 1;
  stroke-dasharray: 3 3;
  pointer-events: none;
}

.tip {
  position: absolute;
  top: 4px;
  z-index: 3;
  transform: translateX(-50%);
  min-width: 92px;
  padding: 5px 8px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  box-shadow: var(--shadow-elev);
  font-size: 0.66rem;
  pointer-events: none;
}

/* 提示框移到光标侧旁留 9px 间隙,避免盖住十字准线/数据点。 */
.tip.a-left { transform: translateX(9px); }
.tip.a-right { transform: translateX(calc(-100% - 9px)); }

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

.tip-row .tl { flex: 1; color: var(--muted); }
.tip-row .tv { color: var(--ink); font-weight: 800; font-variant-numeric: tabular-nums; }

.tip-row i.home,
.legend i.home { background: #7e5aa8; }
.tip-row i.draw,
.legend i.draw { background: #a9d6b5; }
.tip-row i.away,
.legend i.away { background: #8b919c; }

.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 2px 14px;
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
}
</style>
