<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import type { PolymarketEventTradesAggregate, PolymarketMarketTradesAggregate } from '~/types/polymarket'
import { formatPolyOdds, formatCompactCurrency, ODDS_FORMAT_KEY, type OddsFormat } from '~/composables/usePolymarketMetrics'
import dayjs from 'dayjs'

const props = defineProps<{
  trades: PolymarketEventTradesAggregate | null
  market: PolymarketMarketTradesAggregate | null
}>()

const oddsFormat = inject(ODDS_FORMAT_KEY, ref<OddsFormat>('decimal'))
const market = computed(() => props.market)
const selectedTradeCount = computed(() => market.value?.tradeCount ?? props.trades?.tradeCount ?? 0)
const selectedVolume = computed(() => market.value?.marketVolume ?? market.value?.totalSize ?? props.trades?.marketVolume ?? props.trades?.totalSize ?? 0)
const selectedLastTradeAt = computed(() => market.value?.lastTradeAtUtc ?? props.trades?.lastTradeAtUtc ?? null)
const selectedLastPrice = computed(() => market.value?.lastPrice ?? null)

function fmt(price: number | null | undefined): string {
  return formatPolyOdds(price, oddsFormat.value)
}

function formatTime(utc: string | null): string {
  if (!utc) return '-'
  return dayjs(utc).format('MM-DD HH:mm')
}
</script>

<template>
  <div v-if="trades" class="space-y-3">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
      <div class="rounded-lg bg-gray-50 p-2.5">
        <div class="text-[10px] text-gray-400 uppercase tracking-wider">成交笔数</div>
        <div class="text-lg font-bold text-gray-900 tabular-nums">{{ selectedTradeCount }}</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2.5">
        <div class="text-[10px] text-gray-400 uppercase tracking-wider">成交量</div>
        <div class="text-lg font-bold text-gray-900 tabular-nums">{{ formatCompactCurrency(selectedVolume) }}</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2.5">
        <div class="text-[10px] text-gray-400 uppercase tracking-wider">最新成交</div>
        <div class="text-sm font-semibold text-gray-600 tabular-nums">{{ formatTime(selectedLastTradeAt) }}</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2.5">
        <div class="text-[10px] text-gray-400 uppercase tracking-wider">最新价</div>
        <div class="text-base font-bold text-gray-900 tabular-nums">{{ fmt(selectedLastPrice) }}</div>
      </div>
    </div>

    <div v-if="market" class="grid grid-cols-2 md:grid-cols-4 gap-2">
      <div class="rounded-lg bg-gray-50 p-2.5">
        <div class="text-[10px] text-gray-400 uppercase tracking-wider">VWAP</div>
        <div class="text-base font-bold text-blue-500 tabular-nums">{{ fmt(market.vwapPrice) }}</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2.5">
        <div class="text-[10px] text-gray-400 uppercase tracking-wider">价格区间</div>
        <div class="text-sm font-semibold text-gray-900 tabular-nums">{{ fmt(market.minPrice) }} — {{ fmt(market.maxPrice) }}</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2.5">
        <div class="text-[10px] text-gray-400 uppercase tracking-wider">名义成交额</div>
        <div class="text-base font-bold text-gray-900 tabular-nums">{{ formatCompactCurrency(market.totalNotional) }}</div>
      </div>
      <div class="rounded-lg bg-gray-50 p-2.5">
        <div class="text-[10px] text-gray-400 uppercase tracking-wider">买/卖笔数</div>
        <div class="flex items-center gap-1.5">
          <span class="text-sm font-semibold text-green-500 tabular-nums">{{ market.buyCount }}</span>
          <span class="text-gray-400">/</span>
          <span class="text-sm font-semibold text-red-500 tabular-nums">{{ market.sellCount }}</span>
        </div>
      </div>
    </div>

    <div v-if="market && trades" class="text-[11px] text-gray-400">
      赛事总计：{{ trades.tradeCount }} 笔 / {{ formatCompactCurrency(trades.marketVolume ?? trades.totalSize) }}
    </div>
  </div>

  <div v-else class="text-sm text-gray-400 text-center py-4">暂无成交数据</div>
</template>
