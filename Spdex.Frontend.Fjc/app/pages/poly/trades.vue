<script setup lang="ts">
import type { PolymarketTradeTick, PolymarketMarketTradesAggregate } from '~/types/polymarket'
import dayjs from 'dayjs'

// ── 路由参数 ──
const route = useRoute()
const polymarketEventId = computed(() => (route.query.eventId as string) || null)
const cnHome = computed(() => (route.query.home as string) || null)
const cnAway = computed(() => (route.query.away as string) || null)
const leagueName = computed(() => (route.query.league as string) || null)

// ── 数据 ──
const { ticks, meta, loading, error, page, pageSize, goToPage, setPageSize } = usePolyTradeTicks(polymarketEventId)

useHead({ title: computed(() => {
  if (cnHome.value && cnAway.value) return `Poly 成交 ${cnHome.value} vs ${cnAway.value}`
  return 'Poly 成交明细'
}) })

// ── Runner 元数据映射 ──
interface RunnerInfo { conditionId: string; label: string; question: string }
const runnerMap = computed<Map<string, RunnerInfo>>(() => {
  const map = new Map<string, RunnerInfo>()
  if (!meta.value?.markets) return map
  for (const m of meta.value.markets) {
    if (m.sportsMarketType !== 'winner') continue
    // BSW 的 question 通常是 "Will X win?" 这种形式
    const label = extractRunnerLabel(m)
    map.set(m.conditionId, { conditionId: m.conditionId, label, question: m.question })
  }
  return map
})

function extractRunnerLabel(m: PolymarketMarketTradesAggregate): string {
  // 尝试从 question 提取队名
  const q = m.question ?? ''
  const match = q.match(/^Will (.+?) win/)
  if (match) return localizeName(match[1]!)
  return m.conditionId.slice(0, 8)
}

function localizeName(name: string): string {
  if (!name) return name
  const link = meta.value?.markets?.[0]
  if (!link) return name
  // 简单本地化：如果能匹配到中文队名就替换
  if (cnHome.value) {
    // 检查所有 markets 的 question 来找到对应
    for (const m of meta.value?.markets ?? []) {
      if (m.question?.toLowerCase().includes(name.toLowerCase()) && cnHome.value) {
        // 看 name 更接近哪个队
      }
    }
  }
  return name
}

// ── 筛选 ──
type OutcomeFilter = 'all' | 'yes' | 'no'
const activeConditionFilter = ref<string>('all')
const activeOutcomeFilter = ref<OutcomeFilter>('all')

const filteredItems = computed(() => {
  const items = ticks.value?.items ?? []
  return items.filter((t) => {
    if (activeConditionFilter.value !== 'all' && t.conditionId !== activeConditionFilter.value) return false
    if (activeOutcomeFilter.value !== 'all') {
      const want = activeOutcomeFilter.value === 'yes' ? 'Yes' : 'No'
      if (t.outcome !== want) return false
    }
    return true
  })
})

// ── 统计 ──
interface TradeStats {
  count: number
  buyCount: number
  sellCount: number
  buyAmount: number
  sellAmount: number
}

function computeStats(trades: PolymarketTradeTick[]): TradeStats {
  let buyCount = 0, sellCount = 0, buyAmount = 0, sellAmount = 0
  for (const t of trades) {
    const notional = t.price * t.size
    if (t.side === 'BUY') { buyCount++; buyAmount += notional }
    else { sellCount++; sellAmount += notional }
  }
  return { count: trades.length, buyCount, sellCount, buyAmount, sellAmount }
}

// 全量统计（来自 meta 聚合 API，非当前页）
const globalStats = computed(() => {
  if (!meta.value?.markets) return { count: 0, buyCount: 0, sellCount: 0, buyAmount: 0, sellAmount: 0 }
  let buyCount = 0, sellCount = 0, buyAmount = 0, sellAmount = 0, count = 0
  for (const m of meta.value.markets) {
    count += m.tradeCount
    buyCount += m.buyCount
    sellCount += m.sellCount
    buyAmount += m.buySize  // buySize = sum of (price * size) for buys
    sellAmount += m.sellSize
  }
  return { count, buyCount, sellCount, buyAmount, sellAmount }
})

// ── 分页 ──
const totalCount = computed(() => ticks.value?.totalCount ?? 0)
const totalPages = computed(() => Math.ceil(totalCount.value / pageSize.value) || 1)

const pageSizeOptions = [30, 50, 100]

// ── 格式化 ──
function formatTime(utc: string): string { return dayjs(utc).format('MM-DD HH:mm:ss') }
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
function runnerLabel(conditionId: string): string {
  return runnerMap.value.get(conditionId)?.label ?? conditionId.slice(0, 8)
}

// ── 价差 (Price Delta) ──
function tradeKey(t: PolymarketTradeTick): string { return `${t.timestampUtc}_${t.price}_${t.size}_${t.conditionId}` }

const priceDeltaMap = computed(() => {
  const map = new Map<string, number | null>()
  const items = ticks.value?.items ?? []
  const grouped = new Map<string, PolymarketTradeTick[]>()
  for (const t of items) {
    const key = `${t.conditionId}_${t.outcome}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(t)
  }
  for (const [, trades] of grouped) {
    const sorted = [...trades].sort((a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime())
    for (let i = 0; i < sorted.length; i++) {
      const k = tradeKey(sorted[i])
      if (i === 0) { map.set(k, null); continue }
      map.set(k, Math.round((sorted[i].price - sorted[i - 1].price) * 10000) / 10000)
    }
  }
  return map
})

function getDelta(t: PolymarketTradeTick): number | null { return priceDeltaMap.value.get(tradeKey(t)) ?? null }
function deltaColor(d: number | null): string {
  if (d == null || d === 0) return 'color:#9ca3af'
  return d > 0 ? 'color:#16a34a' : 'color:#dc2626'
}
function formatDelta(d: number | null): string {
  if (d == null) return ''
  if (d === 0) return '0'
  const pct = (d * 100).toFixed(1)
  return d > 0 ? `+${pct}` : pct
}
</script>

<template>
  <div class="trades-page">
    <!-- 页头 -->
    <div class="page-header">
      <NuxtLink :to="{ path: '/poly/details', query: { id: route.query.spdexEventId, home: cnHome, away: cnAway, league: leagueName } }" class="back-link">&larr; 返回 Poly 详情</NuxtLink>
      <h2 class="page-title">
        Poly 成交明细
        <template v-if="cnHome && cnAway"> — {{ cnHome }} vs {{ cnAway }}</template>
      </h2>
      <div v-if="totalCount > 0" class="page-meta">共 {{ totalCount.toLocaleString() }} 笔成交</div>
    </div>

    <!-- 加载/错误 -->
    <div v-if="loading && !ticks" class="loading">加载中...</div>
    <div v-else-if="error" class="error-msg">{{ error }}</div>

    <template v-else-if="ticks">
      <!-- 筛选栏 -->
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">结果</span>
          <button
            :class="['filter-chip', { active: activeOutcomeFilter === 'all' }]"
            @click="activeOutcomeFilter = 'all'"
          >全部</button>
          <button
            :class="['filter-chip chip-yes', { active: activeOutcomeFilter === 'yes' }]"
            @click="activeOutcomeFilter = activeOutcomeFilter === 'yes' ? 'all' : 'yes'"
          >Yes</button>
          <button
            :class="['filter-chip chip-no', { active: activeOutcomeFilter === 'no' }]"
            @click="activeOutcomeFilter = activeOutcomeFilter === 'no' ? 'all' : 'no'"
          >No</button>
        </div>

        <div v-if="runnerMap.size > 0" class="filter-group">
          <span class="filter-label">选项</span>
          <button
            :class="['filter-chip', { active: activeConditionFilter === 'all' }]"
            @click="activeConditionFilter = 'all'"
          >全部</button>
          <button
            v-for="[cid, info] in runnerMap" :key="cid"
            :class="['filter-chip', { active: activeConditionFilter === cid }]"
            @click="activeConditionFilter = activeConditionFilter === cid ? 'all' : cid"
          >{{ info.label }}</button>
        </div>

        <div class="filter-group">
          <span class="filter-label">每页</span>
          <button
            v-for="ps in pageSizeOptions" :key="ps"
            :class="['filter-chip', { active: pageSize === ps }]"
            @click="setPageSize(ps)"
          >{{ ps }}</button>
        </div>
      </div>

      <!-- 统计摘要（全量） -->
      <div class="stats-bar">
        <span>共 {{ globalStats.count.toLocaleString() }} 笔</span>
        <span class="stat-buy">买 {{ globalStats.buyCount.toLocaleString() }} 笔 {{ formatAmount(globalStats.buyAmount) }}</span>
        <span class="stat-sell">卖 {{ globalStats.sellCount.toLocaleString() }} 笔 {{ formatAmount(globalStats.sellAmount) }}</span>
      </div>

      <!-- 数据表格 -->
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th class="col-time">时间</th>
              <th class="col-runner">选项</th>
              <th class="col-side">方向</th>
              <th class="col-outcome">结果</th>
              <th class="col-price">价格</th>
              <th class="col-delta">价差</th>
              <th class="col-size">数量</th>
              <th class="col-amount">金额</th>
              <th class="col-trader">交易者</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(t, idx) in filteredItems" :key="idx">
              <td class="col-time">{{ formatTime(t.timestampUtc) }}</td>
              <td class="col-runner">{{ runnerLabel(t.conditionId) }}</td>
              <td class="col-side">
                <span :class="['side-badge', t.side === 'BUY' ? 'side-buy' : 'side-sell']">{{ t.side }}</span>
              </td>
              <td class="col-outcome">
                <span :class="['outcome-badge', t.outcome === 'Yes' ? 'outcome-yes' : 'outcome-no']">{{ t.outcome }}</span>
              </td>
              <td class="col-price">{{ (t.price * 100).toFixed(1) }}%</td>
              <td class="col-delta" :style="deltaColor(getDelta(t))">{{ formatDelta(getDelta(t)) }}</td>
              <td class="col-size">{{ formatSize(t.size) }}</td>
              <td class="col-amount">{{ formatAmount(t.price * t.size) }}</td>
              <td class="col-trader">
                <a
                  v-if="t.proxyWallet"
                  :href="`https://polymarket.com/profile/${t.proxyWallet}`"
                  target="_blank" rel="noopener"
                  class="trader-link"
                >{{ traderDisplay(t) }}</a>
                <span v-else>{{ traderDisplay(t) }}</span>
              </td>
            </tr>
            <tr v-if="filteredItems.length === 0">
              <td colspan="9" class="no-data">暂无成交数据</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div class="pagination">
        <button :disabled="page <= 1" @click="goToPage(page - 1)">&laquo; 上一页</button>
        <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
        <button :disabled="page >= totalPages" @click="goToPage(page + 1)">下一页 &raquo;</button>
      </div>
    </template>

    <!-- 加载遮罩 -->
    <div v-if="loading && ticks" class="loading-overlay">
      <span class="spinner" /> 加载中...
    </div>
  </div>
</template>

<style scoped>
.trades-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
  position: relative;
}

/* ── 页头 ── */
.page-header { margin-bottom: 16px; }
.back-link { color: #3b82f6; text-decoration: none; font-size: 13px; }
.back-link:hover { text-decoration: underline; }
.page-title { font-size: 1.3rem; font-weight: 700; margin: 6px 0 2px; color: #111; }
.page-meta { font-size: 12px; color: #888; }

/* ── 筛选栏 ── */
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  padding: 10px 14px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 10px;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.filter-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 600;
}
.filter-chip {
  padding: 3px 10px;
  font-size: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
}
.filter-chip:hover { background: #f3f4f6; }
.filter-chip.active {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}
.chip-yes.active { background: #16a34a; border-color: #16a34a; }
.chip-no.active { background: #dc2626; border-color: #dc2626; }

/* ── 统计栏 ── */
.stats-bar {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #6b7280;
  padding: 6px 0;
}
.stat-buy { color: #16a34a; font-weight: 600; }
.stat-sell { color: #dc2626; font-weight: 600; }

/* ── 数据表格 ── */
.table-wrapper { overflow-x: auto; }
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.data-table th {
  background: #f5f5f5;
  border-bottom: 2px solid #ddd;
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  font-size: 12px;
  color: #555;
  white-space: nowrap;
}
.data-table td {
  padding: 6px 12px;
  border-bottom: 1px solid #f0f0f0;
  white-space: nowrap;
}
.data-table tbody tr:hover { background: #fafafa; }

.col-time { font-variant-numeric: tabular-nums; color: #6b7280; }
.col-price, .col-delta, .col-size, .col-amount { text-align: right; font-variant-numeric: tabular-nums; }
.col-delta { font-size: 11px; font-weight: 500; }
.col-amount { font-weight: 600; }
.col-trader { max-width: 120px; overflow: hidden; text-overflow: ellipsis; color: #9ca3af; }

.side-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
}
.side-buy { background: #dcfce7; color: #166534; }
.side-sell { background: #fee2e2; color: #991b1b; }

.outcome-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
}
.outcome-yes { background: #dcfce7; color: #166534; }
.outcome-no { background: #fee2e2; color: #991b1b; }

.trader-link { color: #3b82f6; text-decoration: none; }
.trader-link:hover { text-decoration: underline; }

/* ── 分页 ── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 14px 0;
}
.pagination button {
  padding: 6px 14px;
  font-size: 13px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
}
.pagination button:hover:not(:disabled) { background: #f3f4f6; }
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 13px; color: #6b7280; font-variant-numeric: tabular-nums; }

/* ── 其他 ── */
.loading { text-align: center; padding: 40px 0; color: #9ca3af; }
.error-msg { text-align: center; padding: 20px 0; color: #dc2626; }
.no-data { text-align: center; padding: 30px 0; color: #9ca3af; }

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #6b7280;
  z-index: 10;
}
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #d1d5db;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 6px;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
