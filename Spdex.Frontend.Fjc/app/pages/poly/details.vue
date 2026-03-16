<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePolymarketData } from '~/composables/usePolymarketData'
import type { PolymarketMarketTradesAggregate, PolymarketMarketBookAggregate } from '~/types/polymarket'
import { type TrendChartSeries, type TrendDataPoint, compactTimeSeries } from '~/utils/polymarketChart'
import type { VolumeBucket } from '~/components/poly/PolyTrendChart.vue'

// ─── Route & Data ───

const route = useRoute()
const spdexEventId = computed(() => {
  const raw = route.query.id
  const num = Number(raw)
  return Number.isFinite(num) && num > 0 ? num : null
})

const { primaryLink, trades, book, loading, error, refresh } = usePolymarketData(spdexEventId)

// ─── 比赛信息 ───

const matchTitle = computed(() => {
  const link = primaryLink.value
  if (!link) return trades.value?.title ?? '加载中...'

  const home = link.betsapiHomeTeam ?? link.polymarketHomeTeam ?? '?'
  const away = link.betsapiAwayTeam ?? link.polymarketAwayTeam ?? '?'
  return `${home}  vs  ${away}`
})

const matchMeta = computed(() => {
  const link = primaryLink.value
  if (!link) return ''
  const parts: string[] = []
  if (link.betsapiLeagueName) parts.push(link.betsapiLeagueName)
  const kickoff = link.betsapiKickoffUtc ?? link.polymarketKickoffUtc
  if (kickoff) {
    parts.push(new Date(kickoff).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }))
  }
  if (link.matchConfidence > 0) {
    parts.push(`匹配度 ${Math.round(link.matchConfidence * 100)}%`)
  }
  return parts.join(' · ')
})

// ─── Moneyline 市场选取 ───

const moneylineMarket = computed<PolymarketMarketTradesAggregate | null>(() => {
  if (!trades.value) return null
  // 优先 moneyline 类型
  const ml = trades.value.markets.find(m =>
    m.sportsMarketType?.toLowerCase().includes('moneyline')
    || m.sportsMarketType?.toLowerCase().includes('winner'),
  )
  return ml ?? trades.value.markets[0] ?? null
})

const moneylineBook = computed<PolymarketMarketBookAggregate | null>(() => {
  if (!book.value || !moneylineMarket.value) return null
  return book.value.markets.find(m => m.conditionId === moneylineMarket.value!.conditionId) ?? null
})

// ─── 全市场列表（用于切换） ───

const allMarkets = computed(() => {
  if (!trades.value) return []
  return trades.value.markets.map(m => ({
    key: m.conditionId,
    label: m.question,
    type: m.sportsMarketType,
  }))
})

const selectedMarketKey = ref<string | null>(null)

const activeMarket = computed<PolymarketMarketTradesAggregate | null>(() => {
  if (!trades.value) return null
  if (!selectedMarketKey.value) return moneylineMarket.value
  return trades.value.markets.find(m => m.conditionId === selectedMarketKey.value) ?? moneylineMarket.value
})

const activeBook = computed<PolymarketMarketBookAggregate | null>(() => {
  if (!book.value || !activeMarket.value) return null
  return book.value.markets.find(m => m.conditionId === activeMarket.value!.conditionId) ?? null
})

// ─── 走势图数据 ───

// 颜色：主队蓝 / 平局灰 / 客队红（与双红列表一致）
const GRAPH_COLORS = ['#3B82F6', '#6B7280', '#EF4444', '#0F766E', '#B45309']

function clampPrice(p: number): number {
  return Math.max(0.001, Math.min(0.999, p))
}

function yesOutcomeTimeSeries(market: PolymarketMarketTradesAggregate): TrendDataPoint[] {
  return [...(market.recentTrades ?? [])]
    .filter(t => t.outcome?.toLowerCase() === 'yes' || t.outcomeIndex === 0)
    .sort((a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime())
    .map(tick => ({ ts: new Date(tick.timestampUtc).getTime(), price: clampPrice(tick.price) }))
}

/** 找到所有同一事件下相关市场，构建多条线 */
const graphSeries = computed<TrendChartSeries[]>(() => {
  if (!trades.value) return []

  // 对 moneyline 系列，列出同类型所有市场（主/平/客）
  const marketsToPlot = trades.value.markets.filter(m => {
    const active = activeMarket.value
    if (!active) return false
    // 同类型市场 or 同一选中市场
    return m.sportsMarketType === active.sportsMarketType
  })

  if (marketsToPlot.length === 0 && activeMarket.value) {
    marketsToPlot.push(activeMarket.value)
  }

  const series: TrendChartSeries[] = []
  for (let i = 0; i < marketsToPlot.length; i++) {
    const m = marketsToPlot[i]!
    const raw = yesOutcomeTimeSeries(m)
    const dataPoints = compactTimeSeries(raw, 120)
    if (dataPoints.length === 0) continue

    // 提取选项标签（取 question 中的关键词）
    let label: string = m.question
    if (label.length > 20) {
      // 尝试提取短名
      const match = label.match(/(?:win|胜|Home|Away|Draw|平|主|客|Yes|No)/i)
      label = match ? match[0]! : label.substring(0, 12) + '…'
    }

    series.push({
      key: m.conditionId,
      label,
      color: GRAPH_COLORS[i % GRAPH_COLORS.length]!,
      dataPoints,
      lastPct: m.lastPrice != null ? clampPrice(m.lastPrice) : null,
    })
  }

  return series
})

// ─── 走势图时间范围和刻度 ───

const graphTimeline = computed(() => {
  let minTs = Infinity
  let maxTs = -Infinity
  for (const s of graphSeries.value) {
    for (const dp of s.dataPoints) {
      if (dp.ts < minTs) minTs = dp.ts
      if (dp.ts > maxTs) maxTs = dp.ts
    }
  }
  if (minTs === Infinity) {
    const now = Date.now()
    return { minTs: now - 3600000, maxTs: now, start: '', end: '' }
  }
  // 稍微扩展范围
  const span = maxTs - minTs
  const pad = Math.max(span * 0.02, 60000)
  return {
    minTs: minTs - pad,
    maxTs: maxTs + pad,
    start: new Date(minTs).toISOString(),
    end: new Date(maxTs).toISOString(),
  }
})

const chartScale = computed(() => {
  let min = 1
  let max = 0
  for (const s of graphSeries.value) {
    for (const dp of s.dataPoints) {
      if (dp.price < min) min = dp.price
      if (dp.price > max) max = dp.price
    }
  }
  if (min >= max) { min = 0; max = 1 }

  // 扩展 10% padding
  const range = max - min
  min = Math.max(0, min - range * 0.1)
  max = Math.min(1, max + range * 0.1)

  // 生成 ticks
  const tickCount = 5
  const step = (max - min) / (tickCount - 1)
  const ticks: number[] = []
  for (let i = 0; i < tickCount; i++) {
    ticks.push(min + step * i)
  }

  return { min, max, ticks }
})

// ─── 成交量柱状图 ───

const VOLUME_BUCKET_COUNT = 20

const volumeBuckets = computed<VolumeBucket[]>(() => {
  const { minTs, maxTs } = graphTimeline.value
  const span = maxTs - minTs
  if (span <= 0) return []

  const bucketWidth = 100 / VOLUME_BUCKET_COUNT
  const buckets: VolumeBucket[] = Array.from({ length: VOLUME_BUCKET_COUNT }, (_, i) => ({
    index: i,
    x: i * bucketWidth,
    width: bucketWidth,
    totalNotional: 0,
    buyNotional: 0,
    sellNotional: 0,
    tradeCount: 0,
  }))

  // 收集所有 series 涉及的市场的全部 trades
  const market = activeMarket.value
  if (market) {
    for (const t of market.recentTrades ?? []) {
      const ts = new Date(t.timestampUtc).getTime()
      const idx = Math.min(VOLUME_BUCKET_COUNT - 1, Math.max(0, Math.floor(((ts - minTs) / span) * VOLUME_BUCKET_COUNT)))
      const notional = t.price * t.size
      buckets[idx]!.totalNotional += notional
      buckets[idx]!.tradeCount++
      if (t.side?.toUpperCase() === 'BUY') {
        buckets[idx]!.buyNotional += notional
      }
      else {
        buckets[idx]!.sellNotional += notional
      }
    }
  }

  return buckets
})

const volumeMax = computed(() => {
  let max = 0
  for (const b of volumeBuckets.value) {
    if (b.totalNotional > max) max = b.totalNotional
  }
  return max
})

// ─── Polymarket 外链 ───

const polymarketUrl = computed(() => {
  const slug = trades.value?.slug ?? primaryLink.value?.polymarketSlug
  if (!slug) return null
  return `https://polymarket.com/event/${slug}`
})
</script>

<template>
  <div class="poly-detail-page">
    <!-- 顶部导航 -->
    <div class="page-header">
      <NuxtLink to="/" class="back-link">← 返回列表</NuxtLink>
      <button class="refresh-btn" :disabled="loading" @click="refresh">
        {{ loading ? '刷新中...' : '🔄 刷新' }}
      </button>
    </div>

    <!-- 比赛信息 -->
    <div class="match-info">
      <h1 class="match-title">{{ matchTitle }}</h1>
      <div class="match-meta">
        {{ matchMeta }}
        <a v-if="polymarketUrl" :href="polymarketUrl" target="_blank" rel="noopener" class="poly-link">
          ↗ Polymarket
        </a>
      </div>
    </div>

    <!-- Loading / Error -->
    <div v-if="loading && !trades" class="status-box">加载中...</div>
    <div v-else-if="error && !trades" class="status-box text-amber-600">{{ error }}</div>

    <!-- 主内容 -->
    <template v-if="trades">
      <!-- 市场选择器（多个市场时显示） -->
      <div v-if="allMarkets.length > 1" class="market-tabs">
        <button
          v-for="m in allMarkets" :key="m.key"
          class="market-tab"
          :class="{ active: (selectedMarketKey ?? moneylineMarket?.conditionId) === m.key }"
          @click="selectedMarketKey = m.key"
        >
          {{ m.label.length > 30 ? m.label.substring(0, 28) + '…' : m.label }}
        </button>
      </div>

      <!-- 走势图 -->
      <div class="chart-section">
        <h2 class="section-title">指数走势</h2>
        <div v-if="graphSeries.length > 0" class="chart-legends">
          <span v-for="s in graphSeries" :key="s.key" class="legend-item">
            <span class="legend-dot" :style="{ backgroundColor: s.color }" />
            {{ s.label }}
          </span>
        </div>
        <PolyTrendChart
          v-if="graphSeries.length > 0"
          :series="graphSeries"
          :volume-buckets="volumeBuckets"
          :volume-max="volumeMax"
          :time-range="graphTimeline"
          :chart-scale="chartScale"
        />
        <div v-else class="text-center text-gray-400 text-sm py-8">暂无走势数据</div>
      </div>

      <!-- 指标卡片 -->
      <div class="metrics-section">
        <h2 class="section-title">交易概览</h2>
        <PolyMetricsCard :market="activeMarket" :book="activeBook" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.poly-detail-page {
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

.back-link {
  font-size: 0.85rem;
  color: #6d28d9;
  text-decoration: none;
}
.back-link:hover {
  text-decoration: underline;
}

.refresh-btn {
  font-size: 0.8rem;
  padding: 4px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  color: #374151;
}
.refresh-btn:hover {
  background: #f9fafb;
}
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

.poly-link {
  color: #6d28d9;
  text-decoration: none;
  font-weight: 500;
}
.poly-link:hover {
  text-decoration: underline;
}

.status-box {
  text-align: center;
  padding: 40px 16px;
  color: #9ca3af;
  font-size: 0.9rem;
}

.market-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 4px 0 12px;
}

.market-tab {
  padding: 4px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 0.75rem;
  white-space: nowrap;
  background: #fff;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.15s;
}
.market-tab.active {
  background: #6d28d9;
  color: #fff;
  border-color: #6d28d9;
}
.market-tab:hover:not(.active) {
  background: #f3f4f6;
}

.chart-section,
.metrics-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px;
}

.chart-legends {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  color: #6b7280;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
