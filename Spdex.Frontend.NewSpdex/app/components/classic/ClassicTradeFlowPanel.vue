<script setup lang="ts">
/**
 * 经典工作台「成交走势图」单方向(只看主/客/平)视图:复用 E1 成交明细通道(useTradeFlow),
 * 按 TradedAttr 拆 买/卖/冲/买+/卖+/换 堆叠柱 + 价位线(还原旧站 dataViz14Home 单株走势图)。
 * 仅在父组件单方向成交时 v-if 挂载 → 此时才发起请求。时段(timeRange)客户端过滤桶。
 */
import TradeFlowChart from '~/components/chart/TradeFlowChart.vue'
import type { TradeFlowBucket, TradeFlowResult } from '~/composables/useTradeFlow'
import type { ChartPoint } from '~/types/market'

const props = withDefaults(defineProps<{
  eventId: number
  market: string
  selection: string
  timeRange?: string
  height?: number
  refreshKey?: number
}>(), {
  timeRange: '6h',
  height: 240,
  refreshKey: 0,
})

const { data, status, pending, refresh } = useTradeFlow(
  computed(() => props.eventId),
  computed(() => props.market),
  computed(() => props.selection),
)
const { points: timelinePoints } = useChartSeries(
  computed(() => props.eventId),
  computed(() => `${props.market}.traded`),
  ref({}),
  computed(() => true),
)

watch(() => props.refreshKey, () => { refresh() })

const RANGE_HOURS: Record<string, number> = { '3h': 3, '6h': 6, '12h': 12, '24h': 24 }
const ATTR_ORDER = ['买', '卖', '冲', '买+', '卖+', '换']
const BUCKET_MS = 5 * 60_000

function parseTimeMs(raw?: string): number | null {
  if (!raw) return null
  const ms = new Date(raw).getTime()
  return Number.isFinite(ms) ? ms : null
}

function bucketKey(raw?: string): number | null {
  const ms = parseTimeMs(raw)
  return ms == null ? null : Math.floor(ms / BUCKET_MS) * BUCKET_MS
}

function pointPrice(p: ChartPoint): number | null {
  const v = props.selection === 'draw'
    ? p.priceDraw
    : props.selection === 'away'
      ? p.priceAway
      : p.priceHome
  return v && v > 0 ? v : null
}

function fixedAttrs(d: TradeFlowResult): string[] {
  const extras = (d.attrs ?? []).filter(a => !ATTR_ORDER.includes(a))
  return [...ATTR_ORDER, ...extras]
}

function normalizeItems(items: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [rawKey, rawValue] of Object.entries(items)) {
    const value = Number(rawValue)
    if (!Number.isFinite(value) || value <= 0) continue
    const key = rawKey.trim() || '换'
    out[key] = (out[key] ?? 0) + value
  }
  return out
}

function fallbackFiltered(d: TradeFlowResult): TradeFlowResult {
  const h = RANGE_HOURS[props.timeRange]
  const last = d.buckets[d.buckets.length - 1]
  if (!h || !last) return { ...d, attrs: fixedAttrs(d) }
  const lastMs = parseTimeMs(last.time)
  if (lastMs == null) return { ...d, attrs: fixedAttrs(d) }
  const cutoff = lastMs - h * 3600_000
  const buckets = d.buckets.filter(b => {
    const ms = parseTimeMs(b.time)
    return ms != null && ms >= cutoff
  })
  return { ...d, attrs: fixedAttrs(d), buckets: buckets.length >= 2 ? buckets : d.buckets }
}

const denseTimeline = computed(() => {
  const all = timelinePoints.value
  const h = RANGE_HOURS[props.timeRange]
  if (!h || all.length === 0) return all
  const lastTs = all.at(-1)?.ts
  if (!lastTs) return all
  const cutoff = new Date(lastTs).getTime() - h * 3600_000
  const filtered = all.filter((p) => {
    const ms = parseTimeMs(p.ts || p.time)
    return ms != null && ms >= cutoff
  })
  return filtered.length >= 2 ? filtered : all
})

// 按密集 .traded 时间轴补齐 tradeflow 空桶：成交属性来自 tradeflow，价位/时间网格来自 timeseries。
// 这样既保留旧站买/卖/冲/买+/卖+/换，又不会因为目标方向无成交而让价位线节点变稀疏。
const filtered = computed<TradeFlowResult | null>(() => {
  const d = data.value
  if (!d) return null
  const timeline = denseTimeline.value
  if (timeline.length < 2) return fallbackFiltered(d)

  const itemMap = new Map<number, Record<string, number>>()
  for (const b of d.buckets) {
    const key = bucketKey(b.time)
    if (key == null) continue
    const normalized = normalizeItems(b.items ?? {})
    const merged = itemMap.get(key) ?? {}
    for (const [attr, value] of Object.entries(normalized))
      merged[attr] = (merged[attr] ?? 0) + value
    itemMap.set(key, merged)
  }

  let carryPrice: number | null = null
  const buckets: TradeFlowBucket[] = timeline.map((p) => {
    const key = bucketKey(p.ts || p.time)
    const price = pointPrice(p)
    if (price != null) carryPrice = price
    return {
      time: p.ts || p.time,
      items: key == null ? {} : (itemMap.get(key) ?? {}),
      price: carryPrice,
    }
  })

  return { ...d, attrs: fixedAttrs(d), buckets }
})
</script>

<template>
  <div class="ctf-panel">
    <div v-if="status === 'no-access'" class="chart-state">当前会籍未开放此走势</div>
    <div v-else-if="pending && !data" class="chart-state">加载中…</div>
    <div v-else-if="!filtered || filtered.buckets.length === 0" class="chart-state">暂无成交明细</div>
    <TradeFlowChart v-else :result="filtered" :height="height" />
  </div>
</template>

<style scoped>
.ctf-panel {
  min-height: var(--cc-h, 240px);
}

.chart-state {
  display: grid;
  place-items: center;
  min-height: var(--cc-h, 240px);
  color: var(--classic-title-muted);
  font-size: 0.78rem;
  font-weight: 720;
}
</style>
