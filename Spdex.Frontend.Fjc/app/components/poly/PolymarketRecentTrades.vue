<script setup lang="ts">
import { ref, computed, inject, nextTick } from 'vue'
import type { PolymarketTradeTick } from '~/types/polymarket'
import { formatPolyOdds, ODDS_FORMAT_KEY, type OddsFormat } from '~/composables/usePolymarketMetrics'
import dayjs from 'dayjs'

const props = withDefaults(
  defineProps<{
    trades: PolymarketTradeTick[]
    limit?: number
  }>(),
  { limit: 50 },
)

const oddsFormat = inject(ODDS_FORMAT_KEY, ref<OddsFormat>('decimal'))
const displayLimit = ref(props.limit)
const visibleTrades = computed(() => props.trades.slice(0, displayLimit.value))
const hasMore = computed(() => props.trades.length > displayLimit.value)

function showMore() { displayLimit.value += 50 }
function fmt(price: number | null | undefined): string { return formatPolyOdds(price, oddsFormat.value) }
function formatTime(utc: string): string { return dayjs(utc).format('HH:mm:ss') }

const maxSize = computed(() => Math.max(...props.trades.map(t => t.size), 1))

const buySellSummary = computed(() => {
  let buySize = 0, sellSize = 0, buyCount = 0, sellCount = 0
  for (const t of props.trades) {
    if (t.side === 'BUY') { buySize += t.size; buyCount++ }
    else { sellSize += t.size; sellCount++ }
  }
  const total = buySize + sellSize || 1
  return { buySize, sellSize, buyCount, sellCount, buyPct: buySize / total * 100, sellPct: sellSize / total * 100 }
})

function barWidth(size: number): string { return `${Math.min((size / maxSize.value) * 100, 100)}%` }
function formatSize(size: number): string { return size >= 1000 ? `${(size / 1000).toFixed(1)}K` : size.toFixed(1) }
function formatSizeTotal(size: number): string {
  if (size >= 1_000_000) return `$${(size / 1_000_000).toFixed(1)}M`
  if (size >= 1000) return `$${(size / 1000).toFixed(1)}K`
  return `$${size.toFixed(0)}`
}

function traderDisplayName(t: PolymarketTradeTick): string | null {
  if (t.traderName) return t.traderName
  if (t.traderPseudonym) return t.traderPseudonym
  if (t.proxyWallet) return `${t.proxyWallet.slice(0, 6)}…${t.proxyWallet.slice(-4)}`
  return null
}

function traderProfileUrl(t: PolymarketTradeTick): string | null {
  if (t.proxyWallet) return `https://polymarket.com/profile/${t.proxyWallet}`
  return null
}

const hoveredTradeKey = ref<string | null>(null)
function tradeKey(t: PolymarketTradeTick): string { return `${t.timestampUtc}_${t.price}_${t.size}` }
function onHover(t: PolymarketTradeTick | null) { hoveredTradeKey.value = t ? tradeKey(t) : null }
function isHighlighted(t: PolymarketTradeTick): boolean { return hoveredTradeKey.value !== null && hoveredTradeKey.value === tradeKey(t) }

// Scatter bubble chart
interface BubblePoint { x: number; y: number; r: number; side: string; size: number; price: number; time: string; trade: PolymarketTradeTick }

const tooltip = ref<{ x: number; y: number; trade: PolymarketTradeTick } | null>(null)
const chartContainer = ref<HTMLDivElement | null>(null)

function onBubbleEnter(event: MouseEvent, trade: PolymarketTradeTick) { onHover(trade); updateTooltipPosition(event, trade) }
function onBubbleMove(event: MouseEvent, trade: PolymarketTradeTick) { updateTooltipPosition(event, trade) }
function onBubbleLeave() { onHover(null); tooltip.value = null }
function updateTooltipPosition(event: MouseEvent, trade: PolymarketTradeTick) {
  if (!chartContainer.value) return
  const rect = chartContainer.value.getBoundingClientRect()
  tooltip.value = { x: event.clientX - rect.left, y: event.clientY - rect.top, trade }
}
function onBubbleClick(trade: PolymarketTradeTick) {
  const key = tradeKey(trade)
  const idx = props.trades.findIndex(t => tradeKey(t) === key)
  if (idx === -1 || idx >= displayLimit.value) return
  nextTick(() => {
    const row = document.querySelector(`[data-trade-key="${key}"]`)
    if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

const bubbleChart = computed(() => {
  const trades = props.trades
  if (trades.length < 2) return null
  const byTime = [...trades].sort((a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime())
  const timestamps = byTime.map(t => new Date(t.timestampUtc).getTime())
  const prices = byTime.map(t => t.price)
  const sizes = byTime.map(t => t.size)

  const tMin = Math.min(...timestamps), tMax = Math.max(...timestamps)
  const tSpan = tMax - tMin || 1
  let pMin = Math.min(...prices), pMax = Math.max(...prices)
  if (pMax - pMin < 0.02) { pMin -= 0.02; pMax += 0.02 } else { const pad = (pMax - pMin) * 0.15; pMin -= pad; pMax += pad }
  pMin = Math.max(0, pMin); pMax = Math.min(1, pMax)
  const pSpan = pMax - pMin || 0.1
  const sMax = Math.max(...sizes, 1)

  const ticks: number[] = []
  const step = pSpan / 3
  for (let i = 0; i < 4; i++) ticks.push(pMax - step * i)

  const points: BubblePoint[] = byTime.map((t, i) => ({
    x: ((timestamps[i]! - tMin) / tSpan) * 100,
    y: ((pMax - prices[i]!) / pSpan) * 100,
    r: 4 + Math.sqrt(sizes[i]! / sMax) * 14,
    side: t.side, size: t.size, price: t.price,
    time: dayjs(t.timestampUtc).format('HH:mm:ss'), trade: t,
  }))
  return { points, ticks, pMin, pMax, pSpan, timeStart: dayjs(tMin).format('HH:mm'), timeEnd: dayjs(tMax).format('HH:mm') }
})

function tickLabel(value: number): string { return `${Math.round(value * 100)}%` }
function tickY(value: number): number {
  if (!bubbleChart.value) return 0
  return ((bubbleChart.value.pMax - value) / bubbleChart.value.pSpan) * 100
}
</script>

<template>
  <div v-if="trades.length > 0" class="space-y-2">
    <!-- BUY/SELL Summary Bar -->
    <div class="space-y-1">
      <div class="flex items-center justify-between text-[10px]">
        <span class="text-green-600 font-medium">BUY {{ buySellSummary.buyCount }}笔 · {{ formatSizeTotal(buySellSummary.buySize) }}</span>
        <span class="text-red-600 font-medium">SELL {{ buySellSummary.sellCount }}笔 · {{ formatSizeTotal(buySellSummary.sellSize) }}</span>
      </div>
      <div class="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
        <div class="bg-green-500/40 transition-all duration-300" :style="{ width: `${buySellSummary.buyPct}%` }" />
        <div class="bg-red-500/40 transition-all duration-300" :style="{ width: `${buySellSummary.sellPct}%` }" />
      </div>
    </div>

    <!-- Scatter Bubble Chart -->
    <div v-if="bubbleChart" ref="chartContainer" class="rounded-xl border border-gray-200 bg-gray-50/40 p-3">
      <div class="relative h-36">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 w-full h-full">
          <line v-for="tick in bubbleChart.ticks" :key="`grid-${tick}`" x1="0" x2="100" :y1="tickY(tick)" :y2="tickY(tick)" stroke="#e5e7eb" stroke-dasharray="1 2" stroke-width="0.3" />
        </svg>
        <div
          v-for="(pt, i) in bubbleChart.points" :key="i"
          class="bubble absolute rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer"
          :class="[
            pt.side === 'BUY' ? 'bg-green-500/30 border-green-500/60' : 'bg-red-500/30 border-red-500/60',
            isHighlighted(pt.trade) ? 'bubble-active ring-2 ring-white/50' : '',
          ]"
          :style="{ left: `${pt.x}%`, top: `${pt.y}%`, width: `${pt.r * 2}px`, height: `${pt.r * 2}px`, borderWidth: '1px', borderStyle: 'solid', zIndex: isHighlighted(pt.trade) ? 20 : 10 }"
          @mouseenter="onBubbleEnter($event, pt.trade)" @mousemove="onBubbleMove($event, pt.trade)"
          @mouseleave="onBubbleLeave" @click="onBubbleClick(pt.trade)"
        />
        <!-- Tooltip -->
        <Transition name="tooltip-fade">
          <div
            v-if="tooltip"
            class="absolute z-30 pointer-events-none px-2.5 py-1.5 rounded-lg shadow-lg border text-[11px] whitespace-nowrap bg-gray-900/95 text-gray-100"
            :class="tooltip.trade.side === 'BUY' ? 'border-green-500/40' : 'border-red-500/40'"
            :style="{ left: `${tooltip.x}px`, top: `${tooltip.y - 8}px`, transform: 'translate(-50%, -100%)' }"
          >
            <div class="flex items-center gap-2">
              <span class="font-bold" :class="tooltip.trade.side === 'BUY' ? 'text-green-400' : 'text-red-400'">{{ tooltip.trade.side }}</span>
              <span class="text-gray-400">{{ tooltip.trade.outcome }}</span>
              <span v-if="traderDisplayName(tooltip.trade)" class="text-blue-400 truncate max-w-[120px]">{{ traderDisplayName(tooltip.trade) }}</span>
            </div>
            <div class="flex items-center gap-3 mt-0.5">
              <span class="tabular-nums">{{ formatTime(tooltip.trade.timestampUtc) }}</span>
              <span class="font-semibold tabular-nums">{{ fmt(tooltip.trade.price) }}</span>
              <span class="tabular-nums text-gray-300">{{ formatSize(tooltip.trade.size) }}</span>
            </div>
          </div>
        </Transition>
        <div class="pointer-events-none absolute inset-y-0 right-0 flex flex-col justify-between py-0.5 text-[10px] text-gray-400 tabular-nums">
          <span v-for="tick in bubbleChart.ticks" :key="`label-${tick}`">{{ tickLabel(tick) }}</span>
        </div>
      </div>
      <div class="flex items-center justify-between mt-1 text-[10px] text-gray-400 tabular-nums">
        <span>{{ bubbleChart.timeStart }}</span>
        <span class="text-gray-400/60">气泡大小 = 成交量 · 点击定位</span>
        <span>{{ bubbleChart.timeEnd }}</span>
      </div>
    </div>

    <!-- Trade table -->
    <div class="trade-grid px-2 py-1 text-[10px] text-gray-400 uppercase tracking-wider">
      <span>时间</span><span>方向</span><span>交易者</span><span class="text-right">价格</span><span class="text-right">成交量</span>
    </div>
    <div
      v-for="(trade, i) in visibleTrades" :key="i"
      :data-trade-key="tradeKey(trade)"
      class="trade-grid relative px-2 py-1.5 rounded text-xs transition-colors"
      :class="isHighlighted(trade) ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : 'hover:bg-gray-50'"
      @mouseenter="onHover(trade)" @mouseleave="onHover(null)"
    >
      <div class="absolute right-0 top-0 bottom-0 rounded-r transition-all duration-200" :class="trade.side === 'BUY' ? 'bg-green-500/[0.08]' : 'bg-red-500/[0.08]'" :style="{ width: barWidth(trade.size) }" />
      <span class="relative tabular-nums text-gray-400">{{ formatTime(trade.timestampUtc) }}</span>
      <span class="relative">
        <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold" :class="trade.side === 'BUY' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">{{ trade.side }}</span>
        <span class="ml-1 text-gray-400">{{ trade.outcome }}</span>
      </span>
      <span class="relative truncate">
        <a v-if="traderDisplayName(trade)" :href="traderProfileUrl(trade) ?? '#'" target="_blank" rel="noopener" class="text-[11px] text-blue-500 hover:underline" @click.stop>{{ traderDisplayName(trade) }}</a>
        <span v-else class="text-[11px] text-gray-400">—</span>
      </span>
      <span class="relative text-right tabular-nums font-semibold text-gray-900">{{ fmt(trade.price) }}</span>
      <span class="relative text-right tabular-nums font-medium text-gray-600">{{ formatSize(trade.size) }}</span>
    </div>

    <button v-if="hasMore" class="w-full text-center text-xs text-blue-500 hover:underline py-2" @click="showMore">
      显示更多 ({{ trades.length - displayLimit }} 条)
    </button>
  </div>

  <div v-else class="text-sm text-gray-400 text-center py-4">暂无成交记录</div>
</template>

<style scoped>
.trade-grid { display: grid; grid-template-columns: 64px 1fr minmax(0, 100px) 56px 56px; gap: 4px; align-items: center; }
.bubble { transition: transform 0.15s ease, box-shadow 0.15s ease; }
.bubble:hover, .bubble-active { transform: translate(-50%, -50%) scale(1.25); }
.tooltip-fade-enter-active { transition: opacity 0.1s ease; }
.tooltip-fade-leave-active { transition: opacity 0.08s ease; }
.tooltip-fade-enter-from, .tooltip-fade-leave-to { opacity: 0; }
</style>
