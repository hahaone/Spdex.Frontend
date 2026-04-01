<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import type { PolymarketTradeTick } from '~/types/polymarket'
import { formatPolyOdds, ODDS_FORMAT_KEY, type OddsFormat } from '~/composables/usePolymarketMetrics'
import dayjs from 'dayjs'

const props = withDefaults(
  defineProps<{
    trades: PolymarketTradeTick[]
  }>(),
  {},
)

const oddsFormat = inject(ODDS_FORMAT_KEY, ref<OddsFormat>('decimal'))

// ── 筛选 ──
type FilterKey = 'all' | 'yes' | 'no'
const activeFilter = ref<FilterKey>('all')

const filteredTrades = computed(() => {
  if (activeFilter.value === 'all') return props.trades
  const outcome = activeFilter.value === 'yes' ? 'Yes' : 'No'
  return props.trades.filter(t => t.outcome === outcome)
})

// ── 分页 ──
const displayLimit = ref(50)
const visibleTrades = computed(() => filteredTrades.value.slice(0, displayLimit.value))
const hasMore = computed(() => filteredTrades.value.length > displayLimit.value)
function showMore() { displayLimit.value += 50 }

// ── 统计 ──
interface ChipStats {
  count: number
  buyCount: number
  sellCount: number
  buyAmount: number
  sellAmount: number
}

function computeStats(trades: PolymarketTradeTick[]): ChipStats {
  let buyCount = 0, sellCount = 0, buyAmount = 0, sellAmount = 0
  for (const t of trades) {
    const notional = t.price * t.size
    if (t.side === 'BUY') { buyCount++; buyAmount += notional }
    else { sellCount++; sellAmount += notional }
  }
  return { count: trades.length, buyCount, sellCount, buyAmount, sellAmount }
}

// 全量统计（不受筛选影响）
const allStats = computed(() => computeStats(props.trades))

function formatStatsSummary(s: ChipStats): string {
  if (s.count === 0) return '0 笔'
  return `共 ${s.count} 笔；买 ${s.buyCount} 笔 ${formatAmount(s.buyAmount)}；卖 ${s.sellCount} 笔 ${formatAmount(s.sellAmount)}`
}

// ── Yes/No 统计 ──
const yesStats = computed(() => computeStats(props.trades.filter(t => t.outcome === 'Yes')))
const noStats = computed(() => computeStats(props.trades.filter(t => t.outcome === 'No')))

// ── 格式化 ──
function fmt(price: number | null | undefined): string {
  return formatPolyOdds(price, oddsFormat.value)
}
function formatTime(utc: string): string {
  return dayjs(utc).format('MM-DD HH:mm:ss')
}
function formatSize(size: number): string {
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(1)}M`
  if (size >= 1000) return `${(size / 1000).toFixed(1)}K`
  return Math.round(size).toLocaleString()
}
function formatAmount(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`
  return `$${Math.round(amount).toLocaleString()}`
}
function traderDisplay(t: PolymarketTradeTick): string {
  if (t.traderPseudonym) return t.traderPseudonym
  if (t.traderName) return t.traderName
  if (t.proxyWallet) return `${t.proxyWallet.slice(0, 6)}…${t.proxyWallet.slice(-4)}`
  return '-'
}
</script>

<template>
  <div class="space-y-3">
    <!-- 筛选 chips + 统计 -->
    <div class="flex flex-wrap items-center gap-1.5">
      <button
        class="px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
        :class="activeFilter === 'all'
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
        @click="activeFilter = 'all'"
      >
        全部
      </button>
      <button
        class="px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
        :class="activeFilter === 'yes'
          ? 'bg-green-600 text-white'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
        @click="activeFilter = activeFilter === 'yes' ? 'all' : 'yes'"
      >
        Yes ({{ yesStats.count }})
      </button>
      <button
        class="px-2.5 py-1 rounded text-[11px] font-medium transition-colors"
        :class="activeFilter === 'no'
          ? 'bg-red-600 text-white'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
        @click="activeFilter = activeFilter === 'no' ? 'all' : 'no'"
      >
        No ({{ noStats.count }})
      </button>
      <span class="text-[11px] text-gray-400 tabular-nums ml-1">
        {{ formatStatsSummary(allStats) }}
      </span>
    </div>

    <!-- 数据表格 -->
    <div v-if="visibleTrades.length > 0" class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-gray-200 text-gray-400">
            <th class="text-left px-2 py-2 font-medium">时间</th>
            <th class="text-left px-2 py-2 font-medium">方向</th>
            <th class="text-left px-2 py-2 font-medium">结果</th>
            <th class="text-right px-2 py-2 font-medium">价格</th>
            <th class="text-right px-2 py-2 font-medium">数量</th>
            <th class="text-right px-2 py-2 font-medium">金额</th>
            <th class="text-left px-2 py-2 font-medium">交易者</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(t, i) in visibleTrades"
            :key="i"
            class="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 transition-colors"
          >
            <td class="px-2 py-1.5 tabular-nums text-gray-500 whitespace-nowrap">{{ formatTime(t.timestampUtc) }}</td>
            <td class="px-2 py-1.5">
              <span
                class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold"
                :class="t.side === 'BUY'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'"
              >{{ t.side }}</span>
            </td>
            <td class="px-2 py-1.5">
              <span
                class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                :class="t.outcome === 'Yes'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'"
              >{{ t.outcome }}</span>
            </td>
            <td class="px-2 py-1.5 text-right tabular-nums font-medium text-gray-900">{{ (t.price * 100).toFixed(1) }}%</td>
            <td class="px-2 py-1.5 text-right tabular-nums text-gray-600">{{ formatSize(t.size) }}</td>
            <td class="px-2 py-1.5 text-right tabular-nums font-medium text-gray-900">{{ formatAmount(t.price * t.size) }}</td>
            <td class="px-2 py-1.5 text-gray-400 max-w-[120px] truncate">
              <a
                v-if="t.proxyWallet"
                :href="`https://polymarket.com/profile/${t.proxyWallet}`"
                target="_blank"
                rel="noopener"
                class="text-blue-400 hover:underline"
              >{{ traderDisplay(t) }}</a>
              <span v-else>{{ traderDisplay(t) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="text-sm text-gray-400 text-center py-4">暂无成交数据</div>

    <!-- 加载更多 -->
    <div v-if="hasMore" class="text-center">
      <button
        class="px-4 py-1.5 text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
        @click="showMore"
      >
        加载更多（已显示 {{ visibleTrades.length }} / {{ filteredTrades.length }}）
      </button>
    </div>
  </div>
</template>
