<script setup lang="ts">
import dayjs from 'dayjs'
import type { KalshiMarketTradesAggregate, KalshiOutcomeTradeSeries, KalshiTradeDeltaTick } from '~/types/kalshi'
import { formatCompactCurrency, formatCompactNumber } from '~/composables/usePolymarketMetrics'
import { type TrendChartSeries, type TrendDataPoint, compactTimeSeries } from '~/utils/polymarketChart'

const route = useRoute()

const spdexEventId = computed(() => {
  const raw = route.query.id
  const num = Number(raw)
  return Number.isFinite(num) && num > 0 ? num : null
})

const {
  primaryLink,
  kalshiEventTicker,
  trades,
  orderbook,
  loading,
  orderbookLoading,
  error,
  orderbookError,
  refresh,
  fetchOrderbook,
} = useKalshiData(spdexEventId)

const cnHome = computed(() => route.query.home ? String(route.query.home) : null)
const cnAway = computed(() => route.query.away ? String(route.query.away) : null)
const cnLeague = computed(() => route.query.league ? String(route.query.league) : null)

const selectedMarketTicker = ref('')

const eventTrades = computed(() => trades.value?.trades ?? null)
const markets = computed<KalshiMarketTradesAggregate[]>(() => eventTrades.value?.markets ?? [])
const outcomeSeries = computed<KalshiOutcomeTradeSeries[]>(() => eventTrades.value?.outcomeSeries ?? [])

const selectedMarket = computed(() => {
  return markets.value.find(m => m.marketTicker === selectedMarketTicker.value) ?? markets.value[0] ?? null
})

const selectedYesSeries = computed(() => findOutcomeSeries(selectedMarket.value?.marketTicker, 'Yes'))
const selectedNoSeries = computed(() => findOutcomeSeries(selectedMarket.value?.marketTicker, 'No'))

const kickoffUtc = computed(() => {
  const link = primaryLink.value
  return link?.betsapiKickoffUtc ?? link?.kalshiKickoffUtc ?? eventTrades.value?.kickoffUtc ?? null
})

const selectedTrades = computed(() => {
  const all = [
    ...(selectedYesSeries.value?.trades ?? []),
    ...(selectedNoSeries.value?.trades ?? []),
  ]
  return all
    .sort((a, b) => (b.notional - a.notional) || (new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime()))
    .slice(0, 50)
})

watch(markets, (items) => {
  if (!selectedMarketTicker.value || !items.some(m => m.marketTicker === selectedMarketTicker.value)) {
    selectedMarketTicker.value = items[0]?.marketTicker ?? ''
  }
}, { immediate: true })

watch(selectedMarketTicker, (ticker) => {
  if (ticker) {
    fetchOrderbook(ticker)
  }
})

const matchTitle = computed(() => {
  if (cnHome.value && cnAway.value) {
    return `${cnHome.value}  vs  ${cnAway.value}`
  }
  const link = primaryLink.value
  if (!link) return eventTrades.value?.title ?? '加载中...'
  const home = link.betsapiHomeTeam ?? link.kalshiHomeTeam ?? '?'
  const away = link.betsapiAwayTeam ?? link.kalshiAwayTeam ?? '?'
  return `${home}  vs  ${away}`
})

const matchMeta = computed(() => {
  const link = primaryLink.value
  const parts: string[] = []
  if (cnLeague.value) parts.push(cnLeague.value)
  else if (link?.betsapiLeagueName) parts.push(link.betsapiLeagueName)

  const kickoff = kickoffUtc.value
  if (kickoff) parts.push(dayjs(kickoff).format('MM-DD HH:mm'))
  if (link && link.matchConfidence > 0) parts.push(`匹配度 ${Math.round(link.matchConfidence * 100)}%`)
  return parts.join(' · ')
})

const kalshiUrl = computed(() => {
  const ticker = kalshiEventTicker.value ?? eventTrades.value?.eventTicker
  return ticker ? `https://kalshi.com/markets/${encodeURIComponent(ticker)}` : null
})

const graphColors = ['#2563eb', '#6b7280', '#dc2626']

const graphSeries = computed<TrendChartSeries[]>(() => {
  const series: TrendChartSeries[] = []
  const yesSeries = outcomeSeries.value.filter(s => s.outcomeSide.toLowerCase() === 'yes')
  for (let index = 0; index < yesSeries.length; index += 1) {
    const item = yesSeries[index]!
    const dataPoints = compactTimeSeries(toTrendPoints(item.trades), 180)
    const lastPct = item.lastPrice ?? dataPoints[dataPoints.length - 1]?.price ?? null
    if (dataPoints.length === 0 && lastPct == null) continue
    if (dataPoints.length === 0 && lastPct != null) {
      dataPoints.push({ ts: Date.now(), price: clampProbability(lastPct) })
    }
    series.push({
      key: item.key,
      label: localizeRunner(item.runner),
      color: graphColors[index % graphColors.length]!,
      dataPoints,
      lastPct: lastPct == null ? null : clampProbability(lastPct),
    })
  }
  return series
})

const graphTimeline = computed(() => {
  const timestamps = graphSeries.value.flatMap(series => series.dataPoints.map(point => point.ts))
  if (timestamps.length === 0) return { start: '-', end: '-', minTs: 0, maxTs: 0 }
  const minTs = Math.min(...timestamps)
  const maxTs = Math.max(...timestamps)
  return {
    start: dayjs(minTs).format('MM-DD HH:mm'),
    end: dayjs(maxTs).format('MM-DD HH:mm'),
    minTs,
    maxTs,
  }
})

const chartScale = computed(() => {
  const values = graphSeries.value.flatMap(series => [
    ...(series.lastPct == null ? [] : [series.lastPct]),
    ...series.dataPoints.map(point => point.price),
  ])
  if (values.length === 0) return { min: 0, max: 1, ticks: [0.8, 0.6, 0.4, 0.2, 0] }
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < 0.04) {
    min -= 0.03
    max += 0.03
  } else {
    const padding = (max - min) * 0.12
    min -= padding
    max += padding
  }
  min = Math.max(0, min)
  max = Math.min(1, max)
  if (max <= min) {
    min = Math.max(0, min - 0.05)
    max = Math.min(1, max + 0.05)
  }
  const step = (max - min) / 4
  return {
    min,
    max,
    ticks: Array.from({ length: 5 }, (_, index) => max - step * index),
  }
})

const eventVolume = computed(() => {
  const totalSize = eventTrades.value?.totalSize
  if (totalSize != null && totalSize > 0) return totalSize
  const marketTotal = markets.value.reduce((sum, market) => sum + marketVolume(market), 0)
  return marketTotal > 0 ? marketTotal : (eventTrades.value?.totalNotional ?? 0)
})

const ksIndex = computed(() => {
  const rows = markets.value.map((market, index) => {
    const volume = marketVolume(market)
    return {
      market,
      label: localizeRunner(market.label),
      color: graphColors[index % graphColors.length]!,
      volume,
      index: 0,
    }
  })
  const total = rows.reduce((sum, row) => sum + row.volume, 0)
  return rows.map(row => ({
    ...row,
    index: total > 0 ? row.volume / total * 100 : 0,
  }))
})

function marketVolume(market: KalshiMarketTradesAggregate | null | undefined): number {
  if (!market) return 0
  if (market.totalSize > 0) return market.totalSize
  return market.totalNotional
}

function findOutcomeSeries(marketTicker: string | undefined, side: 'Yes' | 'No'): KalshiOutcomeTradeSeries | null {
  if (!marketTicker) return null
  return outcomeSeries.value.find(s =>
    s.marketTicker === marketTicker && s.outcomeSide.toLowerCase() === side.toLowerCase(),
  ) ?? null
}

function toTrendPoints(items: KalshiTradeDeltaTick[]): TrendDataPoint[] {
  return [...items]
    .sort((a, b) => new Date(a.createdAtUtc).getTime() - new Date(b.createdAtUtc).getTime())
    .map(t => ({ ts: new Date(t.createdAtUtc).getTime(), price: clampProbability(t.price) }))
    .filter(p => Number.isFinite(p.ts))
}

function clampProbability(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function localizeRunner(name: string | null | undefined): string {
  const raw = (name ?? '').trim()
  if (!raw) return raw
  const link = primaryLink.value
  if (!link) return raw
  if (cnHome.value && link.kalshiHomeTeam && raw.toLowerCase() === link.kalshiHomeTeam.toLowerCase()) return cnHome.value
  if (cnAway.value && link.kalshiAwayTeam && raw.toLowerCase() === link.kalshiAwayTeam.toLowerCase()) return cnAway.value
  if (raw.toLowerCase() === 'draw') return '平局'
  return raw
}

function formatDecimalOdds(value: number | null | undefined): string {
  if (value == null) return '-'
  const price = clampProbability(value)
  if (price <= 0) return '-'
  return (1 / price).toFixed(2)
}

function formatProbability(value: number | null | undefined): string {
  if (value == null) return '-'
  return `${(clampProbability(value) * 100).toFixed(1)}%`
}

function formatSideProbability(value: number | null | undefined): string {
  if (value == null) return '-'
  return `${Math.round(clampProbability(value) * 100)}%`
}

function formatSignedDelta(value: number | null | undefined): string {
  if (value == null) return '-'
  const signed = value >= 0 ? '+' : ''
  return `${signed}${(value * 100).toFixed(2)}`
}

function deltaClass(value: number | null | undefined): string {
  if (value == null || value === 0) return 'delta-neutral'
  return value > 0 ? 'delta-positive' : 'delta-negative'
}

function formatTime(value: string | null | undefined): string {
  return value ? dayjs(value).format('MM-DD HH:mm:ss') : '-'
}

function getTimeMark(tradeUtc: string | null | undefined): string {
  if (!tradeUtc || !kickoffUtc.value) return ''
  const tradeMs = new Date(tradeUtc).getTime()
  const kickoffMs = new Date(kickoffUtc.value).getTime()
  if (!Number.isFinite(tradeMs) || !Number.isFinite(kickoffMs)) return ''
  const diffMin = (kickoffMs - tradeMs) / 60000
  if (diffMin < 0) return 'LIVE'
  if (diffMin <= 2) return 'PP'
  if (diffMin < 30) return 'P'
  if (diffMin >= 50 && diffMin <= 65) return 'PS'
  if (diffMin < 60) return 'P0'
  if (diffMin < 120) return 'P1'
  if (diffMin < 180) return 'P2'
  if (diffMin < 360) return 'P3'
  if (diffMin < 720) return 'P6'
  if (diffMin < 1440) return 'P12'
  if (diffMin < 2880) return 'P24'
  return 'P48'
}

function teamShortCode(name: string | null | undefined): string {
  const raw = (name ?? '').trim()
  if (!raw) return '--'
  if (/[\u4e00-\u9fff]/.test(raw)) return raw.slice(0, 2)
  const tokens = raw.split(/\s+/).filter(Boolean)
  if (tokens.length >= 2) return `${tokens[0]![0] ?? ''}${tokens[tokens.length - 1]![0] ?? ''}`.toUpperCase()
  return raw.slice(0, 3).toUpperCase()
}

useHead({
  title: computed(() => `Ks ${matchTitle.value}`),
})
</script>

<template>
  <div class="kalshi-detail-page">
    <div class="page-header">
      <NuxtLink to="/" class="back-link">← 返回列表</NuxtLink>
      <button class="refresh-btn" :disabled="loading" @click="refresh">
        {{ loading ? '刷新中...' : '刷新' }}
      </button>
    </div>

    <div class="match-info">
      <h1 class="match-title">{{ matchTitle }}</h1>
      <div class="match-meta">
        {{ matchMeta }}
        <a v-if="kalshiUrl" :href="kalshiUrl" target="_blank" rel="noopener" class="kalshi-link">
          ↗ Kalshi
        </a>
      </div>
    </div>

    <div v-if="error && !trades && !loading" class="status-box text-amber-600">{{ error }}</div>
    <div v-if="loading" class="status-box">加载 Kalshi 数据...</div>

    <template v-if="!loading && (primaryLink || trades)">
      <div class="overview-card">
        <div class="teams-grid">
          <div class="team-card home">
            <div class="team-badge">{{ teamShortCode(cnHome || primaryLink?.kalshiHomeTeam || 'Home') }}</div>
            <div class="team-name">{{ cnHome || primaryLink?.kalshiHomeTeam || 'Home' }}</div>
          </div>
          <div class="event-stat">
            <div class="event-volume">{{ formatCompactNumber(eventVolume) }}</div>
            <div class="event-label">Ks Vol. · {{ eventTrades?.tradeCount ?? 0 }} 笔</div>
          </div>
          <div class="team-card away">
            <div class="team-badge">{{ teamShortCode(cnAway || primaryLink?.kalshiAwayTeam || 'Away') }}</div>
            <div class="team-name">{{ cnAway || primaryLink?.kalshiAwayTeam || 'Away' }}</div>
          </div>
        </div>

        <div v-if="graphSeries.length > 0" class="chart-grid">
          <div class="chart-panel">
            <div class="panel-label">概率及走势</div>
            <PolyTrendChart
              :series="graphSeries"
              :time-range="graphTimeline"
              :chart-scale="chartScale"
              :height="180"
            />
          </div>
          <div class="side-stack">
            <div v-for="s in graphSeries" :key="s.key" class="side-card">
              <div class="side-label" :style="{ color: s.color }">{{ s.label }}</div>
              <div class="side-price">{{ formatSideProbability(s.lastPct) }}</div>
            </div>
          </div>
        </div>

        <div v-if="ksIndex.length > 0" class="index-panel">
          <div class="panel-label dark">Ks 指数</div>
          <div class="index-bars">
            <div v-for="entry in ksIndex" :key="entry.market.marketTicker" class="index-item">
              <div class="bar-shell">
                <div class="bar-fill" :style="{ height: `${Math.max(entry.index, 2)}%`, backgroundColor: entry.color }" />
              </div>
              <div class="bar-value">{{ Math.round(entry.index) }}</div>
              <div class="bar-label" :title="entry.label">{{ entry.label }}</div>
              <div class="bar-volume">{{ formatCompactNumber(entry.volume) }}</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="markets.length > 0" class="market-card">
        <div class="market-head">
          <div>
            <div class="market-title">{{ localizeRunner(selectedMarket?.label) }}</div>
            <div class="market-subtitle">
              {{ formatCompactNumber(marketVolume(selectedMarket)) }} 交易量 · {{ selectedMarket?.tradeCount ?? 0 }} 笔
            </div>
          </div>
          <span v-if="orderbookLoading" class="loading-pill">盘口加载中...</span>
          <span v-else-if="orderbookError" class="error-pill">{{ orderbookError }}</span>
        </div>

        <div class="market-tabs">
          <button
            v-for="(market, index) in markets"
            :key="market.marketTicker"
            class="market-tab"
            :class="{ active: selectedMarketTicker === market.marketTicker }"
            :style="selectedMarketTicker === market.marketTicker ? { backgroundColor: graphColors[index % graphColors.length] } : undefined"
            @click="selectedMarketTicker = market.marketTicker"
          >
            <span>{{ localizeRunner(market.label) }}</span>
            <span>{{ formatDecimalOdds(market.lastYesPrice) }}</span>
          </button>
        </div>

        <div class="market-body">
          <div class="book-panel">
            <div class="section-title">盘口深度</div>
            <div v-if="orderbook" class="book-grid">
              <div>
                <div class="book-side-title">Yes</div>
                <table class="book-table">
                  <thead><tr><th>价格</th><th>数量</th></tr></thead>
                  <tbody>
                    <tr v-for="level in orderbook.yesBids" :key="`yes-${level.price}-${level.size}`">
                      <td>{{ formatProbability(level.price) }}</td>
                      <td>{{ level.size.toFixed(0) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <div class="book-side-title">No</div>
                <table class="book-table">
                  <thead><tr><th>价格</th><th>数量</th></tr></thead>
                  <tbody>
                    <tr v-for="level in orderbook.noBids" :key="`no-${level.price}-${level.size}`">
                      <td>{{ formatProbability(level.price) }}</td>
                      <td>{{ level.size.toFixed(0) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div v-else class="empty-line">暂无盘口深度</div>
          </div>

          <div class="trades-panel">
            <div class="section-title">成交量 Top {{ selectedTrades.length }}</div>
            <table v-if="selectedTrades.length > 0" class="trades-table">
              <thead>
                <tr>
                  <th>方向</th>
                  <th>价格</th>
                  <th>数量</th>
                  <th>金额</th>
                  <th>价差</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="trade in selectedTrades" :key="trade.tradeId">
                  <td :class="trade.outcomeSide.toLowerCase() === 'yes' ? 'yes-cell' : 'no-cell'">{{ trade.outcomeSide }}</td>
                  <td>{{ formatProbability(trade.price) }}</td>
                  <td>{{ trade.count.toFixed(0) }}</td>
                  <td>{{ formatCompactCurrency(trade.notional) }}</td>
                  <td :class="deltaClass(trade.priceDelta)">{{ formatSignedDelta(trade.priceDelta) }}</td>
                  <td>
                    <span class="trade-time-cell">
                      <span v-if="getTimeMark(trade.createdAtUtc)" class="time-mark">{{ getTimeMark(trade.createdAtUtc) }}</span>
                      <span>{{ formatTime(trade.createdAtUtc) }}</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty-line">暂无成交明细</div>
          </div>
        </div>
      </div>

      <div v-if="!trades" class="status-box">赛事已匹配，但暂无 Kalshi 成交数据</div>
    </template>
  </div>
</template>

<style scoped>
.kalshi-detail-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 16px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.back-link,
.kalshi-link {
  font-size: 0.85rem;
  color: #047857;
  text-decoration: none;
}
.back-link:hover,
.kalshi-link:hover {
  text-decoration: underline;
}
.refresh-btn {
  font-size: 0.8rem;
  padding: 4px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  color: #374151;
  cursor: pointer;
}
.refresh-btn:hover { background: #f9fafb; }
.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.match-info {
  margin-bottom: 20px;
}
.match-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
}
.match-meta {
  font-size: 0.8rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.status-box {
  text-align: center;
  padding: 40px 16px;
  color: #9ca3af;
  font-size: 0.9rem;
}
.overview-card,
.market-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  padding: 16px;
  margin-bottom: 16px;
}
.teams-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}
.team-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.team-badge {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid #d1d5db;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.team-card.home .team-badge { color: #2563eb; }
.team-card.away .team-badge { color: #dc2626; }
.team-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #4b5563;
  text-align: center;
}
.event-stat {
  text-align: center;
  min-width: 130px;
}
.event-volume {
  font-size: 1.35rem;
  font-weight: 700;
  color: #111827;
}
.event-label {
  font-size: 0.75rem;
  color: #9ca3af;
}
.chart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 180px;
  gap: 12px;
}
.chart-panel,
.side-card,
.index-panel,
.book-panel,
.trades-panel {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  padding: 12px;
}
.panel-label,
.section-title {
  font-size: 0.75rem;
  font-weight: 700;
  color: #6b7280;
  margin-bottom: 8px;
}
.panel-label.dark {
  color: #111827;
}
.side-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.side-card {
  background: #fff;
}
.side-label {
  font-size: 0.75rem;
  font-weight: 700;
}
.side-price {
  font-size: 1.8rem;
  line-height: 1.1;
  font-weight: 800;
  color: #111827;
  font-variant-numeric: tabular-nums;
}
.index-panel {
  margin-top: 12px;
}
.index-bars {
  display: flex;
  align-items: end;
  gap: 12px;
}
.index-item {
  flex: 1;
  text-align: center;
  min-width: 0;
}
.bar-shell {
  height: 64px;
  max-width: 60px;
  margin: 0 auto;
  display: flex;
  align-items: flex-end;
}
.bar-fill {
  width: 100%;
  border-radius: 4px 4px 0 0;
  opacity: 0.55;
}
.bar-value {
  margin-top: 4px;
  font-size: 1.1rem;
  font-weight: 700;
  color: #111827;
}
.bar-label,
.bar-volume {
  font-size: 0.65rem;
  color: #9ca3af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.market-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.market-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #111827;
}
.market-subtitle {
  color: #9ca3af;
  font-size: 0.8rem;
}
.loading-pill,
.error-pill {
  align-self: flex-start;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.7rem;
}
.loading-pill {
  color: #047857;
  background: #d1fae5;
}
.error-pill {
  color: #b91c1c;
  background: #fee2e2;
}
.market-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.market-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 6px 12px;
  background: #f9fafb;
  color: #4b5563;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}
.market-tab.active {
  color: #fff;
  border-color: transparent;
}
.market-body {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 12px;
}
.book-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.book-side-title {
  font-size: 0.7rem;
  color: #6b7280;
  margin-bottom: 4px;
}
.book-table,
.trades-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}
.book-table th,
.book-table td,
.trades-table th,
.trades-table td {
  border-bottom: 1px solid #e5e7eb;
  padding: 5px 6px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.book-table th:first-child,
.book-table td:first-child,
.trades-table th:first-child,
.trades-table td:first-child {
  text-align: left;
}
.yes-cell {
  color: #047857;
  font-weight: 700;
}
.no-cell {
  color: #b91c1c;
  font-weight: 700;
}
.delta-positive {
  color: #16a34a;
  font-weight: 700;
}
.delta-negative {
  color: #dc2626;
  font-weight: 700;
}
.delta-neutral {
  color: #9ca3af;
}
.trade-time-cell {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
}
.time-mark {
  min-width: 24px;
  border-radius: 999px;
  background: #ecfdf5;
  color: #047857;
  padding: 1px 4px;
  text-align: center;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1.35;
}
.empty-line {
  padding: 20px 8px;
  text-align: center;
  color: #9ca3af;
  font-size: 0.8rem;
}

@media (max-width: 760px) {
  .kalshi-detail-page {
    padding: 10px;
  }
  .teams-grid,
  .chart-grid,
  .market-body {
    grid-template-columns: 1fr;
  }
  .event-stat {
    order: -1;
  }
  .book-grid {
    grid-template-columns: 1fr;
  }
}
</style>
