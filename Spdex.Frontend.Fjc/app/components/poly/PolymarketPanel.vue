<script setup lang="ts">
import { ref, computed, provide } from 'vue'
import type {
  PolymarketSoccerMatchLink,
  PolymarketEventTradesAggregate,
  PolymarketEventBookAggregate,
  PolymarketMarketTradesAggregate,
} from '~/types/polymarket'
import { ODDS_FORMATS, ODDS_FORMAT_KEY, formatCompactCurrency, type OddsFormat } from '~/composables/usePolymarketMetrics'
import { useMarketSelection, clampPrice } from '~/composables/useMarketSelection'
import { type TrendChartSeries, type TrendDataPoint, compactTimeSeries } from '~/utils/polymarketChart'
import dayjs from 'dayjs'

const props = defineProps<{
  links: PolymarketSoccerMatchLink[]
  trades: PolymarketEventTradesAggregate | null
  book: PolymarketEventBookAggregate | null
  loading: boolean
  cnHome?: string | null
  cnAway?: string | null
}>()

// ─── 中文队名本地化 ───
/** 将 Polymarket 英文队名替换为 Spdex 中文名（如果提供了的话） */
function localizeName(name: string | null | undefined): string {
  const raw = (name ?? '').trim()
  if (!raw) return raw
  const link = props.links?.[0]
  if (!link) return raw
  const home = link.polymarketHomeTeam ?? ''
  const away = link.polymarketAwayTeam ?? ''
  // 完全匹配
  if (props.cnHome && home && raw.toLowerCase() === home.toLowerCase()) return props.cnHome
  if (props.cnAway && away && raw.toLowerCase() === away.toLowerCase()) return props.cnAway
  // 部分匹配：optionLabel 可能包含队名（如 "FC Botoșani +1.5"）
  let result = raw
  if (props.cnHome && home) {
    const idx = result.toLowerCase().indexOf(home.toLowerCase())
    if (idx >= 0) result = result.slice(0, idx) + props.cnHome + result.slice(idx + home.length)
  }
  if (props.cnAway && away) {
    const idx = result.toLowerCase().indexOf(away.toLowerCase())
    if (idx >= 0) result = result.slice(0, idx) + props.cnAway + result.slice(idx + away.length)
  }
  return result
}

// ─── Odds format ───
const oddsFormat = ref<OddsFormat>('decimal')
provide(ODDS_FORMAT_KEY, oddsFormat)
const showFormatMenu = ref(false)
function selectFormat(fmt: OddsFormat) { oddsFormat.value = fmt; showFormatMenu.value = false }

// ─── Polymarket external link ───
const polymarketUrl = computed(() => {
  const slug = props.trades?.slug ?? props.book?.slug ?? props.links?.[0]?.polymarketSlug
  if (!slug) return null
  return `https://polymarket.com/event/${slug}`
})

// ─── Market selection (composable) ───
const {
  activeMarketKey, activeCategoryKey, activeFamilyKey, activeLineKey, activeViewTab,
  primaryLink, kickoffTimeLabel, kickoffDateLabel,
  categoryTabs, familyTabs, lineTabs, lineScopedMarkets,
  activeMarketSide, activeTradeMarket, activeBookMarket, recentTrades,
  activeMarketLabel, activeOptionLabel, activeMarketNotional, activeMarketTradeCount,
  activeMarketQuestion, activeMarketId, activeConditionId,
  marketViewTabs, findTradeMarketByKey, resolveDisplayProbability, optionOddsLabel,
} = useMarketSelection(
  computed(() => props.trades),
  computed(() => props.book),
  computed(() => props.links),
  oddsFormat,
)

// ─── Graph helpers ───

function formatPercent(raw: number | null): string {
  if (raw == null) return '-'
  return `${Math.round(raw * 100)}%`
}

function teamShortCode(name: string | null | undefined): string {
  const raw = (name ?? '').trim()
  if (!raw) return '--'
  // 中文名：取前2个字符
  if (/[\u4e00-\u9fff]/.test(raw)) return raw.slice(0, 2)
  const tokens = raw.split(/\s+/).filter(Boolean)
  if (tokens.length >= 2) return `${tokens[0]![0] ?? ''}${tokens[tokens.length - 1]![0] ?? ''}`.toUpperCase()
  return raw.slice(0, 3).toUpperCase()
}

function isYesOutcome(outcome: string): boolean {
  return outcome.trim().toLowerCase() === 'yes'
}

function yesOutcomeTimeSeries(market: PolymarketMarketTradesAggregate): TrendDataPoint[] {
  const yesTrades = (market.recentTrades ?? [])
    .filter(tick => isYesOutcome(tick.outcome))
    .sort((a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime())
    .map(tick => ({ ts: new Date(tick.timestampUtc).getTime(), price: clampPrice(tick.price) }))
  if (yesTrades.length > 0) return yesTrades
  return [...(market.recentTrades ?? [])]
    .sort((a, b) => new Date(a.timestampUtc).getTime() - new Date(b.timestampUtc).getTime())
    .map(tick => ({ ts: new Date(tick.timestampUtc).getTime(), price: clampPrice(tick.price) }))
}

// 主队蓝 / 平局灰 / 客队红（与双红列表一致）
const graphColors = ['#3B82F6', '#6B7280', '#EF4444', '#0F766E', '#B45309']

const graphTimeline = computed(() => {
  const timestamps: number[] = []
  for (const entry of lineScopedMarkets.value) {
    const market = findTradeMarketByKey(entry.key)
    if (!market) continue
    for (const trade of market.recentTrades ?? []) {
      const stamp = new Date(trade.timestampUtc).getTime()
      if (Number.isFinite(stamp)) timestamps.push(stamp)
    }
  }
  if (timestamps.length === 0) return { start: '-', end: '-', minTs: 0, maxTs: 0 }
  const min = Math.min(...timestamps)
  const max = Math.max(...timestamps)
  return { start: dayjs(min).format('MM-DD HH:mm'), end: dayjs(max).format('MM-DD HH:mm'), minTs: min, maxTs: max }
})

const graphSeries = computed<TrendChartSeries[]>(() => {
  const { minTs, maxTs } = graphTimeline.value
  const series: TrendChartSeries[] = []
  for (let index = 0; index < lineScopedMarkets.value.length; index += 1) {
    const entry = lineScopedMarkets.value[index]!
    const market = findTradeMarketByKey(entry.key)
    if (!market) continue
    const dataPoints = compactTimeSeries(yesOutcomeTimeSeries(market), 60)
    const displayPrice = resolveDisplayProbability(entry.key, market)
    if (dataPoints.length === 0 && displayPrice != null) {
      dataPoints.push({ ts: minTs || Date.now(), price: displayPrice })
    }
    if (dataPoints.length === 0) continue
    if (minTs && dataPoints[0]!.ts > minTs) dataPoints.unshift({ ts: minTs, price: dataPoints[0]!.price })
    if (maxTs && dataPoints[dataPoints.length - 1]!.ts < maxTs) {
      const lastPrice = displayPrice ?? dataPoints[dataPoints.length - 1]!.price
      dataPoints.push({ ts: maxTs, price: lastPrice })
    }
    const lastPct = displayPrice ?? (dataPoints.length > 0 ? dataPoints[dataPoints.length - 1]!.price : null)
    series.push({ key: entry.key, label: localizeName(entry.optionLabel), color: graphColors[index % graphColors.length]!, dataPoints, lastPct })
  }
  return series
})

const topSeries = computed(() => [...graphSeries.value].sort((a, b) => (b.lastPct ?? -1) - (a.lastPct ?? -1)))
const isExactScoreFamily = computed(() => activeFamilyKey.value === 'exact')
const maxVisibleSeriesCount = computed(() => isExactScoreFamily.value ? 8 : 12)
const visibleSeries = computed(() => topSeries.value.slice(0, maxVisibleSeriesCount.value))
const hiddenSeriesCount = computed(() => Math.max(0, topSeries.value.length - visibleSeries.value.length))

const chartScale = computed(() => {
  const values: number[] = []
  for (const s of visibleSeries.value) {
    for (const dp of s.dataPoints) values.push(dp.price)
    if (s.lastPct != null) values.push(s.lastPct)
  }
  if (values.length === 0) return { min: 0, max: 1, ticks: [0.8, 0.6, 0.4, 0.2, 0.0] }
  let min = Math.min(...values), max = Math.max(...values)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [0.8, 0.6, 0.4, 0.2, 0.0] }
  if (max - min < 0.04) { min -= 0.03; max += 0.03 } else { const padding = (max - min) * 0.12; min -= padding; max += padding }
  min = Math.max(0, min); max = Math.min(1, max)
  if (max <= min) { min = Math.max(0, min - 0.05); max = Math.min(1, max + 0.05) }
  const ticks: number[] = []
  const step = (max - min) / 4
  for (let i = 0; i < 5; i += 1) ticks.push(max - step * i)
  return { min, max, ticks }
})

// ─── Volume bar chart ───
interface VolumeBucket { index: number; x: number; width: number; totalNotional: number; buyNotional: number; sellNotional: number; tradeCount: number }
const VOLUME_BUCKET_COUNT = 20

function tradeNotional(price: number, size: number): number {
  const safePrice = clampPrice(price)
  const safeSize = Number.isFinite(size) && size > 0 ? size : 0
  return safePrice * safeSize
}

function marketIndexBase(market: PolymarketMarketTradesAggregate): number {
  const base = market.marketVolume ?? market.totalNotional ?? 0
  return Number.isFinite(base) && base > 0 ? base : 0
}

const volumeBuckets = computed<VolumeBucket[]>(() => {
  const { minTs, maxTs } = graphTimeline.value
  if (!minTs || !maxTs) return []
  const allTrades: { ts: number; notional: number; isBuy: boolean }[] = []
  for (const entry of lineScopedMarkets.value) {
    const market = findTradeMarketByKey(entry.key)
    if (!market) continue
    for (const t of market.recentTrades ?? []) {
      const ts = new Date(t.timestampUtc).getTime()
      if (!Number.isFinite(ts)) continue
      allTrades.push({ ts, notional: t.price * t.size, isBuy: t.side.toUpperCase() === 'BUY' })
    }
  }
  if (allTrades.length === 0) return []
  const span = maxTs - minTs
  if (span === 0) {
    let buyN = 0, sellN = 0
    for (const t of allTrades) { if (t.isBuy) buyN += t.notional; else sellN += t.notional }
    return [{ index: 0, x: 0, width: 100, totalNotional: buyN + sellN, buyNotional: buyN, sellNotional: sellN, tradeCount: allTrades.length }]
  }
  const count = Math.min(VOLUME_BUCKET_COUNT, allTrades.length)
  const w = 100 / count
  const buckets: VolumeBucket[] = Array.from({ length: count }, (_, i) => ({ index: i, x: i * w, width: w, totalNotional: 0, buyNotional: 0, sellNotional: 0, tradeCount: 0 }))
  for (const t of allTrades) {
    let idx = Math.floor(((t.ts - minTs) / span) * count)
    if (idx >= count) idx = count - 1
    if (idx < 0) idx = 0
    buckets[idx]!.totalNotional += t.notional
    if (t.isBuy) buckets[idx]!.buyNotional += t.notional; else buckets[idx]!.sellNotional += t.notional
    buckets[idx]!.tradeCount += 1
  }
  return buckets
})

const volumeMaxNotional = computed(() => {
  if (volumeBuckets.value.length === 0) return 1
  return Math.max(...volumeBuckets.value.map(b => b.totalNotional), 1)
})

// ─── Poly Index (moneyline only) ───
interface PolyIndexEntry { key: string; label: string; color: string; base: number; index: number }
const polyIndex = computed<PolyIndexEntry[]>(() => {
  if (activeFamilyKey.value !== 'moneyline') return []
  const entries: PolyIndexEntry[] = []
  for (let i = 0; i < lineScopedMarkets.value.length; i++) {
    const entry = lineScopedMarkets.value[i]!
    const market = findTradeMarketByKey(entry.key)
    if (!market) continue
    entries.push({ key: entry.key, label: localizeName(entry.optionLabel), color: graphColors[i % graphColors.length]!, base: marketIndexBase(market), index: 0 })
  }
  const total = entries.reduce((s, e) => s + e.base, 0)
  if (total > 0) for (const e of entries) e.index = (e.base / total) * 100
  return entries
})

// ─── Poly Index 走势图 ───
// 基于全时成交数据，计算每个时间点的累计成交量归一化指数
const polyIndexTrendData = computed(() => {
  if (activeFamilyKey.value !== 'moneyline') return { series: [] as TrendChartSeries[], timeline: { start: '-', end: '-', minTs: 0, maxTs: 0 } }

  // 收集每个 moneyline market 的全部成交记录
  interface MarketMeta {
    key: string
    label: string
    color: string
    aggregateTotal: number
    seededTotal: number
    recentTotal: number
    scale: number
  }
  const marketsMeta: MarketMeta[] = []
  const allEvents: { ts: number; marketIdx: number; notional: number }[] = []

  for (let i = 0; i < lineScopedMarkets.value.length; i++) {
    const entry = lineScopedMarkets.value[i]!
    const market = findTradeMarketByKey(entry.key)
    if (!market) continue

    const aggregateTotal = marketIndexBase(market)
    const recentTotal = (market.recentTrades ?? []).reduce((sum, trade) => sum + tradeNotional(trade.price, trade.size), 0)
    const scale = recentTotal > aggregateTotal && recentTotal > 0 ? aggregateTotal / recentTotal : 1
    const seededTotal = Math.max(0, aggregateTotal - recentTotal * scale)

    const mIdx = marketsMeta.length
    marketsMeta.push({
      key: entry.key,
      label: localizeName(entry.optionLabel),
      color: graphColors[i % graphColors.length]!,
      aggregateTotal,
      seededTotal,
      recentTotal,
      scale,
    })
    for (const t of market.recentTrades ?? []) {
      const ts = new Date(t.timestampUtc).getTime()
      if (!Number.isFinite(ts)) continue
      allEvents.push({ ts, marketIdx: mIdx, notional: tradeNotional(t.price, t.size) * scale })
    }
  }

  if (marketsMeta.length === 0) return { series: [] as TrendChartSeries[], timeline: { start: '-', end: '-', minTs: 0, maxTs: 0 } }
  if (allEvents.length === 0) {
    const total = marketsMeta.reduce((sum, meta) => sum + meta.aggregateTotal, 0)
    if (total <= 0) return { series: [] as TrendChartSeries[], timeline: { start: '-', end: '-', minTs: 0, maxTs: 0 } }
    const nowTs = Date.now()
    const series: TrendChartSeries[] = marketsMeta
      .filter(meta => meta.aggregateTotal > 0)
      .map(meta => ({
        key: meta.key,
        label: meta.label,
        color: meta.color,
        dataPoints: [{ ts: nowTs, price: meta.aggregateTotal / total }],
        lastPct: meta.aggregateTotal / total,
      }))
    return {
      series,
      timeline: { start: dayjs(nowTs).format('MM-DD HH:mm'), end: dayjs(nowTs).format('MM-DD HH:mm'), minTs: nowTs, maxTs: nowTs },
    }
  }

  // 按时间排序
  allEvents.sort((a, b) => a.ts - b.ts)
  const minTs = allEvents[0]!.ts
  const maxTs = allEvents[allEvents.length - 1]!.ts

  // 先注入聚合基数，让终点与当前指数一致；recentTrades 只描述最近一段时间的变化分布。
  const cumVol = marketsMeta.map(meta => meta.seededTotal)
  // 为每个 market 收集数据点 (ts, indexValue 0~1)
  const rawPoints: TrendDataPoint[][] = marketsMeta.map(() => [])

  const initialTotal = cumVol.reduce((sum, value) => sum + value, 0)
  if (initialTotal > 0) {
    for (let m = 0; m < marketsMeta.length; m++) {
      rawPoints[m]!.push({ ts: minTs, price: cumVol[m]! / initialTotal })
    }
  }

  // 按时间桶采样避免数据量过大
  const SAMPLE_BUCKETS = 80
  const span = maxTs - minTs
  const bucketSize = span > 0 ? span / SAMPLE_BUCKETS : 1
  let nextBucketTs = minTs + bucketSize

  for (const ev of allEvents) {
    cumVol[ev.marketIdx]! += ev.notional
    // 到达桶边界时采样
    if (ev.ts >= nextBucketTs || ev === allEvents[allEvents.length - 1]) {
      const totalCum = cumVol.reduce((s, v) => s + v, 0)
      if (totalCum > 0) {
        for (let m = 0; m < marketsMeta.length; m++) {
          rawPoints[m]!.push({ ts: ev.ts, price: cumVol[m]! / totalCum })
        }
      }
      nextBucketTs = ev.ts + bucketSize
    }
  }

  const series: TrendChartSeries[] = marketsMeta.map((meta, m) => {
    const pts = rawPoints[m]!
    const lastPct = pts.length > 0 ? pts[pts.length - 1]!.price : null
    return { key: meta.key, label: meta.label, color: meta.color, dataPoints: pts, lastPct }
  }).filter(s => s.dataPoints.length > 0)

  return {
    series,
    timeline: { start: dayjs(minTs).format('MM-DD HH:mm'), end: dayjs(maxTs).format('MM-DD HH:mm'), minTs, maxTs },
  }
})

const polyIndexSeries = computed(() => polyIndexTrendData.value.series)
const polyIndexTimeline = computed(() => polyIndexTrendData.value.timeline)

const polyIndexScale = computed(() => {
  const values: number[] = []
  for (const s of polyIndexSeries.value) {
    for (const dp of s.dataPoints) values.push(dp.price)
  }
  if (values.length === 0) return { min: 0, max: 1, ticks: [1.0, 0.8, 0.6, 0.4, 0.2, 0.0] }
  let min = Math.min(...values), max = Math.max(...values)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1, ticks: [1.0, 0.8, 0.6, 0.4, 0.2, 0.0] }
  const padding = Math.max((max - min) * 0.1, 0.02)
  min = Math.max(0, min - padding); max = Math.min(1, max + padding)
  if (max <= min) { min = 0; max = 1 }
  const ticks: number[] = []
  const step = (max - min) / 4
  for (let i = 0; i < 5; i++) ticks.push(max - step * i)
  return { min, max, ticks }
})

// Poly Index 不需要 volume buckets，传空数组
const emptyVolumeBuckets: VolumeBucket[] = []
</script>

<template>
  <!-- Loading -->
  <div v-if="loading" class="text-center py-8 text-gray-400">加载预测市场数据...</div>

  <div v-else-if="primaryLink || trades || book" class="space-y-4">
    <!-- Header -->
    <div class="flex items-center gap-2 flex-wrap">
      <template v-if="primaryLink">
        <span class="text-xs text-gray-400 truncate">{{ primaryLink.polymarketTitle }}</span>
      </template>
      <div class="flex-1" />
      <a v-if="polymarketUrl" :href="polymarketUrl" target="_blank" rel="noopener noreferrer" class="text-xs text-blue-500 hover:underline shrink-0" @click.stop>
        ↗ Polymarket
      </a>
      <!-- Odds format selector -->
      <div class="relative shrink-0">
        <button class="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md border border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors" @click.stop="showFormatMenu = !showFormatMenu">
          赔率: {{ ODDS_FORMATS.find(f => f.key === oddsFormat)?.label }}
          <svg class="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M3 5L6 8L9 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" /></svg>
        </button>
        <Transition name="menu-fade">
          <div v-if="showFormatMenu" class="absolute right-0 top-full mt-1 z-50 min-w-[110px] rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
            <button
              v-for="fmt in ODDS_FORMATS" :key="fmt.key"
              class="w-full text-left px-3 py-1.5 text-xs transition-colors"
              :class="oddsFormat === fmt.key ? 'bg-blue-500/10 text-blue-500 font-semibold' : 'text-gray-500 hover:bg-gray-50'"
              @click="selectFormat(fmt.key)"
            >{{ fmt.label }}</button>
          </div>
        </Transition>
      </div>
    </div>
    <!-- Click-away -->
    <Teleport to="body"><div v-if="showFormatMenu" class="fixed inset-0 z-40" @click="showFormatMenu = false" /></Teleport>

    <!-- Top Overview Card -->
    <div class="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
      <div class="grid grid-cols-3 items-center gap-3">
        <div class="flex flex-col items-center">
          <div class="w-12 h-12 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-sm font-bold text-blue-500">
            {{ teamShortCode(localizeName(primaryLink?.polymarketHomeTeam) || 'Home') }}
          </div>
          <div class="mt-1.5 text-xs font-semibold text-gray-600 text-center">{{ localizeName(primaryLink?.polymarketHomeTeam) || 'Home' }}</div>
        </div>
        <div class="text-center">
          <div class="text-xl font-semibold text-gray-900 tabular-nums">{{ kickoffTimeLabel }}</div>
          <div class="text-sm text-gray-400 mt-0.5">{{ kickoffDateLabel }}</div>
        </div>
        <div class="flex flex-col items-center">
          <div class="w-12 h-12 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-sm font-bold text-red-500">
            {{ teamShortCode(localizeName(primaryLink?.polymarketAwayTeam) || 'Away') }}
          </div>
          <div class="mt-1.5 text-xs font-semibold text-gray-600 text-center">{{ localizeName(primaryLink?.polymarketAwayTeam) || 'Away' }}</div>
        </div>
      </div>

      <div class="text-sm font-semibold text-gray-400 tabular-nums">{{ formatCompactCurrency(activeMarketNotional) }} Vol.</div>

      <div v-if="visibleSeries.length > 0" class="grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-3">
        <div class="rounded-xl border border-gray-200 bg-gray-50/40 p-3">
          <PolyTrendChart :series="visibleSeries" :volume-buckets="volumeBuckets" :volume-max="volumeMaxNotional" :time-range="graphTimeline" :chart-scale="chartScale" :height="160" />
        </div>
        <div class="rounded-xl border border-gray-200 bg-gray-50/35 p-3 flex flex-col gap-2">
          <div v-for="s in visibleSeries" :key="`top-side-${s.key}`" class="rounded-lg bg-white px-3 py-2">
            <div class="text-xs font-semibold" :style="{ color: s.color }">{{ s.label }}</div>
            <div class="text-3xl leading-tight font-bold tabular-nums text-gray-900">{{ formatPercent(s.lastPct) }}</div>
          </div>
          <div v-if="hiddenSeriesCount > 0" class="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400">
            其余 {{ hiddenSeriesCount }} 个选项已折叠
          </div>
        </div>
      </div>

      <!-- Poly Index (moneyline only) -->
      <div v-if="polyIndex.length > 0" class="rounded-xl border border-gray-200 bg-gray-50/40 p-3 space-y-3">
        <div class="text-xs font-semibold text-gray-900">Poly 指数</div>
        <!-- 当前指数柱状图 -->
        <div class="flex items-end gap-3">
          <div v-for="entry in polyIndex" :key="`pidx-${entry.key}`" class="flex-1 text-center">
            <div class="mx-auto w-full max-w-[60px] h-16 flex items-end justify-center">
              <div class="w-full rounded-t" :style="{ height: `${Math.max(entry.index, 2)}%`, backgroundColor: entry.color, opacity: 0.5 }" />
            </div>
            <div class="text-lg font-bold tabular-nums text-gray-900 mt-1">{{ entry.index.toFixed(1) }}</div>
            <div class="text-[10px] text-gray-400 truncate" :title="entry.label">{{ entry.label }}</div>
            <div class="text-[9px] text-gray-400 tabular-nums">{{ formatCompactCurrency(entry.base) }}</div>
          </div>
        </div>
        <!-- 指数走势图 -->
        <div v-if="polyIndexSeries.length > 0">
          <div class="text-[10px] text-gray-400 mb-1">指数走势（基于近期成交分布，终点对齐当前指数）</div>
          <div class="flex items-center gap-3 flex-wrap mb-1">
            <div v-for="s in polyIndexSeries" :key="`pidx-legend-${s.key}`" class="inline-flex items-center gap-1 text-[11px] text-gray-500">
              <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: s.color }" />
              <span>{{ s.label }}</span>
              <span class="font-semibold tabular-nums text-gray-900">{{ formatPercent(s.lastPct) }}</span>
            </div>
          </div>
          <PolyTrendChart :series="polyIndexSeries" :volume-buckets="emptyVolumeBuckets" :volume-max="0" :time-range="polyIndexTimeline" :chart-scale="polyIndexScale" :height="120" />
        </div>
        <div class="text-[9px] text-gray-400">当前值使用市场聚合成交量，曲线使用近期成交分布回放</div>
      </div>

      <div v-if="!visibleSeries.length" class="text-sm text-gray-400 text-center py-4 border border-gray-200 rounded-xl bg-gray-50/30">
        当前市场暂无可展示的趋势数据
      </div>
    </div>

    <!-- Category Tabs -->
    <div v-if="categoryTabs.length > 1" class="flex items-center gap-1 flex-wrap pb-1">
      <button
        v-for="category in categoryTabs" :key="category.key"
        class="px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap"
        :class="activeCategoryKey === category.key ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 bg-gray-50'"
        @click="activeCategoryKey = category.key"
      >{{ category.label }} <span class="ml-1 opacity-70 tabular-nums">({{ category.count }})</span></button>
    </div>

    <!-- Family Tabs -->
    <div v-if="familyTabs.length > 1" class="flex items-center gap-1 flex-wrap pb-1">
      <button
        v-for="family in familyTabs" :key="family.key"
        class="px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap"
        :class="activeFamilyKey === family.key ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 bg-gray-50'"
        @click="activeFamilyKey = family.key"
      >{{ family.label }} <span class="ml-1 opacity-70 tabular-nums">({{ family.count }})</span></button>
    </div>

    <!-- Line Tabs -->
    <div v-if="lineTabs.length > 1" class="flex items-center gap-1 flex-wrap pb-1">
      <span class="text-[10px] text-gray-400 shrink-0 mr-1">盘口</span>
      <button
        v-for="line in lineTabs" :key="line.key"
        class="px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap"
        :class="activeLineKey === line.key ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 bg-gray-50'"
        @click="activeLineKey = line.key"
      >{{ line.label }}</button>
    </div>

    <!-- Market Card -->
    <div v-if="lineScopedMarkets.length > 0" class="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div class="p-4 border-b border-gray-200">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div class="text-2xl font-semibold text-gray-900">{{ localizeName(activeMarketLabel) }}</div>
            <div class="text-sm text-gray-400 tabular-nums mt-0.5">{{ formatCompactCurrency(activeMarketNotional) }} 交易量 · {{ activeMarketTradeCount }} 笔</div>
          </div>
        </div>
        <div class="mt-3 flex items-center gap-2 flex-wrap">
          <button
            v-for="market in lineScopedMarkets" :key="market.key"
            class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-150 border"
            :class="activeMarketKey === market.key ? 'bg-blue-500 text-white border-blue-500 shadow-sm' : 'text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100'"
            @click="activeMarketKey = market.key"
          >
            <span>{{ localizeName(market.optionLabel) }}</span>
            <span class="tabular-nums opacity-85">{{ optionOddsLabel(market.key) }}</span>
          </button>
        </div>
      </div>

      <div class="px-4">
        <div class="flex items-center gap-5 border-b border-gray-200">
          <button
            v-for="tab in marketViewTabs" :key="tab.key"
            class="py-3 text-sm font-semibold border-b-2 transition-colors"
            :class="activeViewTab === tab.key ? 'text-gray-900 border-blue-500' : 'text-gray-400 border-transparent hover:text-gray-500'"
            @click="activeViewTab = tab.key"
          >{{ tab.label }}</button>
        </div>

        <div class="py-4 space-y-4">
          <template v-if="activeViewTab === 'orderbook'">
            <PolymarketMarketSummary :trades="trades" :market="activeTradeMarket" />
            <div v-if="activeBookMarket" class="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <div class="text-[11px] text-gray-400 mb-1">{{ activeMarketSide === 'yes' ? 'Yes' : 'No' }}</div>
                <PolymarketOrderBook :book="activeBookMarket" :side="activeMarketSide" />
              </div>
              <div>
                <div class="text-[11px] text-gray-400 mb-1">{{ activeMarketSide === 'yes' ? 'No' : 'Yes' }}</div>
                <PolymarketOrderBook :book="activeBookMarket" :side="activeMarketSide === 'yes' ? 'no' : 'yes'" />
              </div>
            </div>
            <div v-if="recentTrades.length > 0">
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">成交量 Top {{ recentTrades.length }}</div>
              <PolymarketRecentTrades :trades="recentTrades" :limit="50" />
            </div>
          </template>

          <template v-else-if="activeViewTab === 'graph'">
            <div v-if="visibleSeries.length > 0" class="space-y-3">
              <div class="flex items-center gap-4 flex-wrap">
                <div v-for="s in visibleSeries" :key="s.key" class="inline-flex items-center gap-1.5 text-sm text-gray-500">
                  <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: s.color }" />
                  <span>{{ s.label }}</span>
                  <span class="font-semibold tabular-nums text-gray-900">{{ formatPercent(s.lastPct) }}</span>
                </div>
              </div>
              <div class="rounded-xl border border-gray-200 bg-gray-50/40 p-3">
                <PolyTrendChart :series="visibleSeries" :volume-buckets="volumeBuckets" :volume-max="volumeMaxNotional" :time-range="graphTimeline" :chart-scale="chartScale" :height="180" />
              </div>
              <div v-if="hiddenSeriesCount > 0" class="text-[11px] text-gray-400">已显示前 {{ visibleSeries.length }} 个选项，其余 {{ hiddenSeriesCount }} 个已折叠。</div>
            </div>
            <div v-else class="text-sm text-gray-400 text-center py-4">当前市场暂无可绘制的价格曲线</div>
          </template>

          <template v-else>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div class="rounded-lg bg-gray-50 p-3">
                <div class="text-[10px] text-gray-400 uppercase tracking-wider">问题</div>
                <div class="text-sm text-gray-900 mt-1 break-all">{{ activeMarketQuestion }}</div>
              </div>
              <div class="rounded-lg bg-gray-50 p-3">
                <div class="text-[10px] text-gray-400 uppercase tracking-wider">Market ID</div>
                <div class="text-xs text-gray-500 mt-1 break-all">{{ activeMarketId }}</div>
              </div>
              <div class="rounded-lg bg-gray-50 p-3">
                <div class="text-[10px] text-gray-400 uppercase tracking-wider">Condition ID</div>
                <div class="text-xs text-gray-500 mt-1 break-all">{{ activeConditionId }}</div>
              </div>
              <div class="rounded-lg bg-gray-50 p-3">
                <div class="text-[10px] text-gray-400 uppercase tracking-wider">最近成交</div>
                <div class="text-sm text-gray-500 mt-1 tabular-nums">{{ activeTradeMarket?.lastTradeAtUtc ? dayjs(activeTradeMarket.lastTradeAtUtc).format('MM-DD HH:mm:ss') : '-' }}</div>
              </div>
            </div>
            <div class="space-y-2">
              <div class="text-xs font-semibold text-gray-400 uppercase tracking-wider">分析指标</div>
              <PolymarketMetrics :trades="trades" :market="activeTradeMarket" :book-market="activeBookMarket" />
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="!trades && !book" class="text-sm text-gray-400 text-center py-4">赛事已匹配，但暂无成交和盘口数据</div>
  </div>

  <div v-else class="text-sm text-gray-400 text-center py-4">暂无预测市场数据</div>
</template>

<style scoped>
.menu-fade-enter-active, .menu-fade-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.menu-fade-enter-from, .menu-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
