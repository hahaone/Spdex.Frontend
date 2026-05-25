<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import type { PolymarketMarketBookAggregate } from '~/types/polymarket'
import { formatPrice, formatPolyOdds, formatCompactCurrency, ODDS_FORMAT_KEY, type OddsFormat } from '~/composables/usePolymarketMetrics'

const props = withDefaults(
  defineProps<{
    book: PolymarketMarketBookAggregate | null
    side?: 'yes' | 'no'
  }>(),
  { side: 'yes' },
)

const oddsFormat = inject(ODDS_FORMAT_KEY, ref<OddsFormat>('decimal'))

const tokenBook = computed(() => props.side === 'yes' ? props.book?.yesBook : props.book?.noBook)

const maxSize = computed(() => {
  const b = tokenBook.value
  if (!b) return 1
  const allSizes = [...b.bids.map(l => l.size), ...b.asks.map(l => l.size)]
  return Math.max(...allSizes, 1)
})

function barWidth(size: number): string {
  return `${Math.min((size / maxSize.value) * 100, 100)}%`
}

const DISPLAY_LEVELS = 10

function fmt(price: number | null | undefined): string {
  return formatPolyOdds(price, oddsFormat.value)
}
function fmtSize(size: number): string {
  return Math.round(size).toLocaleString()
}
</script>

<template>
  <div v-if="tokenBook" class="space-y-2">
    <!-- Header stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
      <div class="rounded-lg bg-gray-50 p-2">
        <span class="text-gray-400">Best Bid</span>
        <div class="font-bold text-green-500 tabular-nums">{{ fmt(tokenBook.bestBid) }}</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2">
        <span class="text-gray-400">Best Ask</span>
        <div class="font-bold text-red-500 tabular-nums">{{ fmt(tokenBook.bestAsk) }}</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2">
        <span class="text-gray-400">Spread</span>
        <div class="font-bold text-gray-900 tabular-nums">{{ formatPrice(tokenBook.spread) }}</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2">
        <span class="text-gray-400">Mid</span>
        <div class="font-bold text-gray-900 tabular-nums">{{ fmt(tokenBook.midPrice) }}</div>
      </div>
    </div>

    <!-- Depth table -->
    <div class="grid grid-cols-2 gap-1">
      <!-- Bids -->
      <div>
        <div class="text-[10px] text-gray-400 uppercase tracking-wider mb-1 px-1">Bids (买盘)</div>
        <div class="space-y-0.5">
          <div
            v-for="(level, i) in tokenBook.bids.slice(0, DISPLAY_LEVELS)"
            :key="'bid-' + i"
            class="relative flex items-center justify-between px-2 py-1 rounded text-xs"
          >
            <div class="absolute inset-0 bg-green-500/10 rounded" :style="{ width: barWidth(level.size) }" />
            <span class="relative tabular-nums font-semibold text-green-600">{{ fmt(level.price) }}</span>
            <span class="relative tabular-nums text-gray-600">{{ fmtSize(level.size) }}</span>
          </div>
          <div v-if="tokenBook.bids.length === 0" class="text-xs text-gray-400 text-center py-2">—</div>
        </div>
        <div class="text-[10px] text-gray-400 px-1 mt-1">合计: {{ formatCompactCurrency(tokenBook.totalBidSize) }}</div>
      </div>

      <!-- Asks -->
      <div>
        <div class="text-[10px] text-gray-400 uppercase tracking-wider mb-1 px-1">Asks (卖盘)</div>
        <div class="space-y-0.5">
          <div
            v-for="(level, i) in tokenBook.asks.slice(0, DISPLAY_LEVELS)"
            :key="'ask-' + i"
            class="relative flex items-center justify-between px-2 py-1 rounded text-xs"
          >
            <div class="absolute inset-0 bg-red-500/10 rounded" :style="{ width: barWidth(level.size) }" />
            <span class="relative tabular-nums font-semibold text-red-600">{{ fmt(level.price) }}</span>
            <span class="relative tabular-nums text-gray-600">{{ fmtSize(level.size) }}</span>
          </div>
          <div v-if="tokenBook.asks.length === 0" class="text-xs text-gray-400 text-center py-2">—</div>
        </div>
        <div class="text-[10px] text-gray-400 px-1 mt-1">合计: {{ formatCompactCurrency(tokenBook.totalAskSize) }}</div>
      </div>
    </div>
  </div>

  <div v-else class="text-sm text-gray-400 text-center py-4">暂无深度数据</div>
</template>
