<script setup lang="ts">
import type { PolymarketMarketTradesAggregate, PolymarketMarketBookAggregate } from '~/types/polymarket'

const props = defineProps<{
  market: PolymarketMarketTradesAggregate | null
  book: PolymarketMarketBookAggregate | null
}>()

function fmt(val: number | null | undefined): string {
  if (val == null) return '-'
  return `${Math.round(val * 100)}%`
}

function fmtDollar(val: number | null | undefined): string {
  if (val == null) return '-'
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`
  return `$${Math.round(val)}`
}

function fmtPrice(val: number | null | undefined): string {
  if (val == null) return '-'
  return val.toFixed(2)
}

const yesBook = computed(() => props.book?.yesBook ?? null)
</script>

<template>
  <div v-if="market" class="metrics-grid">
    <div class="metric-item">
      <span class="metric-label">成交笔数</span>
      <span class="metric-value">{{ market.tradeCount }}</span>
    </div>
    <div class="metric-item">
      <span class="metric-label">成交量</span>
      <span class="metric-value">{{ fmtDollar(market.totalNotional) }}</span>
    </div>
    <div class="metric-item">
      <span class="metric-label">最新成交</span>
      <span class="metric-value">
        {{ market.lastTradeAtUtc ? new Date(market.lastTradeAtUtc).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-' }}
      </span>
    </div>
    <div class="metric-item">
      <span class="metric-label">最新价</span>
      <span class="metric-value text-blue-600">{{ fmtPrice(market.lastPrice) }}</span>
    </div>
    <div class="metric-item">
      <span class="metric-label">VWAP</span>
      <span class="metric-value">{{ fmtPrice(market.vwapPrice) }}</span>
    </div>
    <div class="metric-item">
      <span class="metric-label">价格区间</span>
      <span class="metric-value">{{ fmtPrice(market.minPrice) }} — {{ fmtPrice(market.maxPrice) }}</span>
    </div>
    <div class="metric-item">
      <span class="metric-label">名义成交额</span>
      <span class="metric-value">{{ fmtDollar(market.totalNotional) }}</span>
    </div>
    <div class="metric-item">
      <span class="metric-label">买/卖笔数</span>
      <span class="metric-value">
        <span class="text-green-600">{{ market.buyCount }}</span>
        <span class="text-gray-400"> / </span>
        <span class="text-red-500">{{ market.sellCount }}</span>
      </span>
    </div>

    <!-- Order Book -->
    <template v-if="yesBook">
      <div class="metric-item">
        <span class="metric-label">最优买</span>
        <span class="metric-value text-green-600">{{ fmtPrice(yesBook.bestBid) }}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">最优卖</span>
        <span class="metric-value text-red-500">{{ fmtPrice(yesBook.bestAsk) }}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">价差</span>
        <span class="metric-value">{{ fmtPrice(yesBook.spread) }}</span>
      </div>
      <div class="metric-item">
        <span class="metric-label">中间价</span>
        <span class="metric-value">{{ fmt(yesBook.midPrice) }}</span>
      </div>
    </template>
  </div>

  <div v-else class="text-center text-gray-400 text-sm py-6">暂无交易数据</div>
</template>

<style scoped>
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: #e5e7eb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 6px;
  background: #fff;
}

.metric-label {
  font-size: 0.7rem;
  color: #9ca3af;
  white-space: nowrap;
}

.metric-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: #111827;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
