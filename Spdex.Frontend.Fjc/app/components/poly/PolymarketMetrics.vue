<script setup lang="ts">
import { computed } from 'vue'
import type { PolymarketEventTradesAggregate, PolymarketMarketTradesAggregate, PolymarketMarketBookAggregate } from '~/types/polymarket'
import { computeMarketMetrics, formatImbalance, formatSE } from '~/composables/usePolymarketMetrics'

const props = defineProps<{
  trades: PolymarketEventTradesAggregate | null
  market: PolymarketMarketTradesAggregate | null
  bookMarket: PolymarketMarketBookAggregate | null
}>()

const metrics = computed(() => computeMarketMetrics(props.market ?? undefined, props.bookMarket, props.trades))

function ofiColor(val: number | null): string { return val == null ? 'text-gray-400' : val >= 0 ? 'text-green-500' : 'text-red-500' }
function diColor(val: number | null): string { return val == null ? 'text-gray-400' : val >= 0 ? 'text-green-500' : 'text-red-500' }
function seColor(val: number | null): string { return val == null ? 'text-gray-400' : val < 0.02 ? 'text-green-500' : val < 0.05 ? 'text-amber-500' : 'text-red-500' }
function activityColor(label: string): string {
  switch (label) {
    case '高': return 'bg-green-100 text-green-700'
    case '中': return 'bg-amber-100 text-amber-700'
    case '低': return 'bg-slate-100 text-slate-500'
    default: return 'bg-slate-100 text-slate-400'
  }
}
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
    <div class="rounded-lg bg-gray-50 p-2.5">
      <div class="text-[10px] text-gray-400 uppercase tracking-wider">OFI</div>
      <div class="text-base font-bold tabular-nums" :class="ofiColor(metrics.ofi)">{{ formatImbalance(metrics.ofi) }}</div>
      <div v-if="metrics.ofi == null" class="text-[10px] text-gray-400">样本不足</div>
    </div>
    <div class="rounded-lg bg-gray-50 p-2.5">
      <div class="text-[10px] text-gray-400 uppercase tracking-wider">DI</div>
      <div class="text-base font-bold tabular-nums" :class="diColor(metrics.di)">{{ formatImbalance(metrics.di) }}</div>
      <div v-if="metrics.di == null" class="text-[10px] text-gray-400">暂无深度数据</div>
    </div>
    <div class="rounded-lg bg-gray-50 p-2.5">
      <div class="text-[10px] text-gray-400 uppercase tracking-wider">SE</div>
      <div class="text-base font-bold tabular-nums" :class="seColor(metrics.se)">{{ formatSE(metrics.se) }}</div>
      <div v-if="metrics.se == null" class="text-[10px] text-gray-400">暂无深度数据</div>
    </div>
    <div class="rounded-lg bg-gray-50 p-2.5">
      <div class="text-[10px] text-gray-400 uppercase tracking-wider">活跃度</div>
      <div class="flex items-center gap-2">
        <span class="text-base font-bold tabular-nums text-gray-900">{{ metrics.activityScore ?? '-' }}</span>
        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded" :class="activityColor(metrics.activityLabel)">{{ metrics.activityLabel }}</span>
      </div>
    </div>
  </div>
</template>
