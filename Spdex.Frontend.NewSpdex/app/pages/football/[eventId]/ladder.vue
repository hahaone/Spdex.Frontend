<script setup lang="ts">
import { ArrowLeft, Lock, RefreshCw } from '@lucide/vue'
import { useMatchLadder, LADDER_MARKETS, type LadderPoint } from '~/composables/useMatchLadder'

// 经典版盘口明细（还原旧站 Match/View/BetFair）：某市场选一个选项 → 已成交汇总 + 价格/成交量走势 + 价位/买/卖/成交 阶梯。
// 标盘 / 进球 / 正确比分 由 ?market= 决定。
// 入口：分类列表赛事卡「明细图表」面板的 标盘 / 进球 / 正确比分 按钮（已在经典模式 → 满宽渲染）。
const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))
const queryMarket = computed(() => (typeof route.query.market === 'string' ? route.query.market : 'standard'))

const { data, market, activeKey, setMarket, setSelection, pending, refresh } = useMatchLadder(eventId)

watch(queryMarket, (m) => {
  if (m && LADDER_MARKETS.some(item => item.value === m)) setMarket(m)
}, { immediate: true })

const active = computed(() => data.value?.active ?? null)
const selections = computed(() => data.value?.selections ?? [])
const locked = computed(() => data.value?.accessLocked === true)

const MARKET_CN: Record<string, string> = { standard: '标准盘', goals: '大小球', cs: '正确比分' }
const marketLabel = computed(() => MARKET_CN[market.value] ?? data.value?.marketLabel ?? '标准盘')

function money(n: number | undefined): string {
  if (!n || n <= 0) return '–'
  return `HK$ ${Math.round(n).toLocaleString('en-US')}`
}
function raw(n: number | undefined): string {
  if (!n || n <= 0) return ''
  return `HK$ ${Math.round(n).toLocaleString('en-US')}`
}
function price(n: number | undefined): string {
  return typeof n === 'number' && n > 0 ? n.toFixed(2) : '–'
}
function onSelectionChange(e: Event) { setSelection((e.target as HTMLSelectElement).value) }

// ── 价格/成交量走势（价格折线全高 + 成交量柱底部,双轴 + 刻度标签）──
const CW = 460
const CH = 300
const PAD = { left: 44, right: 48, top: 26, bottom: 26 }
const plotW = CW - PAD.left - PAD.right
const plotH = CH - PAD.top - PAD.bottom
const VOL_FRAC = 0.42 // 成交量柱占绘图区底部比例

const series = computed<LadderPoint[]>(() => active.value?.series ?? [])
const priceBounds = computed(() => {
  const vals = series.value.map(p => p.price).filter((v): v is number => typeof v === 'number' && v > 0)
  if (vals.length === 0) return null
  let min = Math.min(...vals)
  let max = Math.max(...vals)
  if (max - min < 1e-6) { min -= 0.05; max += 0.05 }
  const padv = (max - min) * 0.12
  return { min: min - padv, max: max + padv }
})
const maxVol = computed(() => Math.max(...series.value.map(p => p.volume), 1))
function xAt(i: number, n: number): number { return n <= 1 ? PAD.left + plotW / 2 : PAD.left + (i / (n - 1)) * plotW }
function priceY(p: number): number {
  const b = priceBounds.value!
  return PAD.top + (1 - (p - b.min) / (b.max - b.min)) * plotH
}
const pricePath = computed(() => {
  const b = priceBounds.value
  const n = series.value.length
  if (!b || n === 0) return ''
  const segs: string[] = []
  let pen = false
  series.value.forEach((p, i) => {
    if (typeof p.price !== 'number' || p.price <= 0) { pen = false; return }
    segs.push(`${pen ? 'L' : 'M'}${xAt(i, n).toFixed(1)} ${priceY(p.price).toFixed(1)}`)
    pen = true
  })
  return segs.join(' ')
})
const volBars = computed(() => {
  const n = series.value.length
  if (n === 0) return [] as { x: number, y: number, w: number, h: number }[]
  const slot = plotW / n
  const w = Math.min(10, Math.max(1.2, slot * 0.6))
  const volH = plotH * VOL_FRAC
  const baseY = PAD.top + plotH
  return series.value.map((p, i) => {
    const h = p.volume > 0 ? Math.max(1.5, (p.volume / maxVol.value) * volH) : 0
    return { x: xAt(i, n) - w / 2, y: baseY - h, w, h }
  })
})
const hasChart = computed(() => series.value.length >= 2 && priceBounds.value !== null)
const priceTicks = computed(() => {
  const b = priceBounds.value
  if (!b) return []
  return [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: PAD.top + f * plotH, label: (b.max - f * (b.max - b.min)) }))
})
const volTicks = computed(() => {
  const mv = maxVol.value
  const volH = plotH * VOL_FRAC
  const baseY = PAD.top + plotH
  return [0, 0.5, 1].map(f => ({ y: baseY - f * volH, label: Math.round(mv * f) }))
})
function fmtTick(v: number): string { return v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2) }
function fmtClock(t: string): string { const i = t.indexOf('T'); return i >= 0 ? t.slice(i + 1, i + 6) : t.slice(0, 5) }

// 阶梯表：切选项后滚到买卖分界
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
    const el = wrap.querySelectorAll<HTMLElement>('tbody tr')[Math.max(0, boundaryIndex.value)]
    if (el) wrap.scrollTop = Math.max(0, el.offsetTop - wrap.clientHeight / 2)
  })
})
</script>

<template>
  <div class="ld-page classic-desktop">
    <section class="ld-card">
      <div class="ld-head">
        <div class="ld-head-left">
          <NuxtLink to="/football?view=classic" class="ld-back"><ArrowLeft :size="14" /><span>返回列表</span></NuxtLink>
          <h1>{{ data?.homeTeam ?? '—' }} VS {{ data?.awayTeam ?? '—' }}</h1>
          <span class="ld-mk">{{ marketLabel }}</span>
        </div>
        <button type="button" class="ld-refresh" :disabled="pending" aria-label="刷新" @click="refresh()">
          <RefreshCw :size="13" :class="{ spinning: pending }" />
        </button>
      </div>

      <div v-if="locked" class="ld-state lock">
        <Lock :size="14" /><span>{{ data?.lockMessage || '盘口明细为专家版及以上会籍专属' }}</span>
      </div>
      <div v-else-if="!selections.length" class="ld-state">{{ pending ? '加载中…' : '本场该市场暂无盘口数据' }}</div>

      <div v-else class="ld-body">
        <!-- 左：选项 + 汇总 + 走势 -->
        <div class="ld-left">
          <select class="ld-select" :value="activeKey" @change="onSelectionChange">
            <option v-for="s in selections" :key="s.key" :value="s.key">{{ s.label }}</option>
          </select>

          <template v-if="active">
            <div class="ld-sum">
              <div class="sum-title"><b>已成交</b><span>低:{{ price(active.tradedLow) }} &nbsp; 高:{{ price(active.tradedHigh) }}</span></div>
              <div class="sum-row"><span>此市场:</span><b class="num">{{ money(active.marketTotal) }}</b></div>
              <div class="sum-row"><span>此选项:</span><b class="num">{{ money(active.selectionTotal) }}</b></div>
              <div class="sum-row"><span>最近成交价:</span><b class="num hot">{{ price(active.lastPrice) }}</b></div>
            </div>

            <div class="ld-chart">
              <div class="ld-chart-title">Price/Volume over time</div>
              <svg v-if="hasChart" :viewBox="`0 0 ${CW} ${CH}`" class="ld-svg" preserveAspectRatio="xMidYMid meet">
                <g v-for="(t, i) in priceTicks" :key="`pt${i}`">
                  <line :x1="PAD.left" :x2="CW - PAD.right" :y1="t.y" :y2="t.y" class="grid" />
                  <text :x="PAD.left - 5" :y="t.y + 3" class="ax price" text-anchor="end">{{ fmtTick(t.label) }}</text>
                </g>
                <text v-for="(t, i) in volTicks" :key="`vt${i}`" :x="CW - PAD.right + 5" :y="t.y + 3" class="ax vol" text-anchor="start">{{ t.label }}</text>
                <rect v-for="(b, i) in volBars" :key="`v${i}`" :x="b.x" :y="b.y" :width="b.w" :height="b.h" class="vol-bar" />
                <path :d="pricePath" class="price-line" fill="none" />
                <text :x="PAD.left" :y="CH - 8" class="ax t" text-anchor="start">{{ fmtClock(series[0]?.time ?? '') }}</text>
                <text :x="CW - PAD.right" :y="CH - 8" class="ax t" text-anchor="end">{{ fmtClock(series[series.length - 1]?.time ?? '') }}</text>
              </svg>
              <div v-else class="ld-chart-empty">暂无走势数据</div>
            </div>
          </template>
        </div>

        <!-- 右：阶梯表 -->
        <div v-if="active" class="ld-right">
          <div class="ld-right-title">价位、可交易额及成交量</div>
          <div ref="tableWrap" class="ld-table-wrap">
            <table class="ld-table">
              <thead>
                <tr><th class="c-price">价位</th><th>买</th><th>卖</th><th>成交</th></tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in active.rows" :key="i" :class="['ld-row', r.side]">
                  <td class="c-price num">{{ r.price.toFixed(2) }}</td>
                  <td class="back num">{{ raw(r.back) }}</td>
                  <td class="lay num">{{ raw(r.lay) }}</td>
                  <td class="traded num">{{ raw(r.traded) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ld-page { min-height: 100vh; padding: 12px; background: var(--classic-bg, #eceff3); }
.ld-card {
  max-width: 1320px; margin: 0 auto;
  border: 1px solid var(--classic-border); border-radius: var(--classic-radius);
  background: var(--classic-panel); box-shadow: var(--classic-shadow); overflow: hidden;
}

.ld-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 10px 14px; background: var(--classic-title); color: #fff;
}
.ld-head-left { display: flex; align-items: center; gap: 12px; min-width: 0; flex-wrap: wrap; }
.ld-back { display: inline-flex; align-items: center; gap: 3px; color: #cfe0ff; font-size: 0.78rem; font-weight: 760; }
.ld-head-left h1 { margin: 0; font-size: 1rem; font-weight: 840; color: #fff; }
.ld-mk { padding: 1px 8px; border-radius: 3px; background: rgba(255,255,255,0.18); font-size: 0.78rem; font-weight: 760; }
.ld-refresh {
  display: inline-grid; place-items: center; width: 26px; height: 24px;
  border: 1px solid rgba(255,255,255,0.3); border-radius: 2px; background: transparent; color: #fff; cursor: pointer;
}
.spinning { animation: ld-spin 0.8s linear infinite; }
@keyframes ld-spin { to { transform: rotate(360deg); } }

.ld-state {
  display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 160px;
  color: var(--classic-title-muted); font-size: 0.84rem; font-weight: 720;
}
.ld-state.lock { margin: 16px; padding: 28px; border: 1px dashed var(--classic-border); border-radius: 6px; background: var(--classic-blue-soft); color: #8a6212; }

.ld-body {
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 16px; padding: 16px;
}

.ld-select {
  width: 100%; height: 38px; padding: 0 10px; margin-bottom: 12px;
  border: 1px solid var(--classic-border); border-radius: 4px;
  background: var(--classic-panel); color: var(--classic-text); font-size: 0.9rem; font-weight: 760;
}

.ld-sum { border: 1px solid var(--classic-border); border-radius: 4px; overflow: hidden; margin-bottom: 14px; }
.sum-title {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 9px 12px; background: var(--classic-blue-soft); font-size: 0.84rem; color: var(--classic-title);
}
.sum-title b { font-weight: 840; }
.sum-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border-top: 1px solid var(--classic-grid); font-size: 0.84rem;
}
.sum-row span { color: var(--classic-text); font-weight: 720; }
.sum-row b { color: var(--classic-title); font-weight: 820; }
.sum-row b.hot { color: #d62b2b; }

.ld-chart { border: 1px solid var(--classic-border); border-radius: 4px; padding: 8px; }
.ld-chart-title { text-align: center; font-weight: 840; font-size: 0.92rem; color: var(--classic-title); margin: 2px 0 6px; font-family: 'JetBrains Mono', monospace; }
.ld-svg { display: block; width: 100%; height: auto; }
.ld-svg .grid { stroke: var(--classic-grid); stroke-width: 0.8; }
.ld-svg .ax { font-size: 9px; font-family: 'JetBrains Mono', monospace; }
.ld-svg .ax.price { fill: #d62b2b; }
.ld-svg .ax.vol { fill: var(--classic-title-muted); }
.ld-svg .ax.t { fill: var(--classic-title-muted); }
.ld-svg .vol-bar { fill: #9aa3af; opacity: 0.7; }
.ld-svg .price-line { stroke: #d62b2b; stroke-width: 1.4; stroke-linejoin: round; }
.ld-chart-empty { display: grid; place-items: center; min-height: 120px; color: var(--classic-title-muted); font-size: 0.8rem; }

.ld-right { min-width: 0; }
.ld-right-title {
  padding: 9px 12px; text-align: center; background: var(--classic-blue-soft);
  border: 1px solid var(--classic-border); border-bottom: 0; border-radius: 4px 4px 0 0;
  font-size: 0.86rem; font-weight: 840; color: var(--classic-title);
}
.ld-table-wrap { max-height: 560px; overflow-y: auto; border: 1px solid var(--classic-border); border-radius: 0 0 4px 4px; }
.ld-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; font-variant-numeric: tabular-nums; }
.ld-table thead th {
  position: sticky; top: 0; z-index: 1; padding: 7px 12px; text-align: left;
  background: var(--classic-panel); border-bottom: 1px solid var(--classic-border);
  color: var(--classic-title); font-size: 0.78rem; font-weight: 800;
}
.ld-table td { padding: 6px 12px; text-align: left; border-bottom: 1px solid var(--classic-grid); color: var(--classic-text); }
.ld-table td.c-price { font-weight: 780; color: var(--classic-title); }
.ld-row.back { background: #d6e6fa; }
.ld-row.back td.c-price { background: #c5dbf6; }
.ld-row.lay { background: #fbdde4; }
.ld-row.lay td.c-price { background: #f7ccd6; }
.ld-table td.traded { color: var(--classic-title-muted); }

@media (max-width: 920px) {
  .ld-body { grid-template-columns: minmax(0, 1fr); }
}
.dark .ld-row.back { background: rgba(36,86,166,0.18); }
.dark .ld-row.lay { background: rgba(214,43,43,0.16); }
.dark .ld-svg .vol-bar { fill: #5a6472; }
</style>
