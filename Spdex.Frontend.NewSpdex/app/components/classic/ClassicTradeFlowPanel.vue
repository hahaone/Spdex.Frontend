<script setup lang="ts">
/**
 * 经典工作台「成交走势图」单方向(只看主/客/平)视图:复用 E1 成交明细通道(useTradeFlow),
 * 按 TradedAttr 拆 买/卖/冲/买+/卖+/换 堆叠柱 + 价位线(还原旧站 dataViz14Home 单株走势图)。
 * 仅在父组件单方向成交时 v-if 挂载 → 此时才发起请求。时段(timeRange)客户端过滤桶。
 */
import TradeFlowChart from '~/components/chart/TradeFlowChart.vue'
import type { TradeFlowResult } from '~/composables/useTradeFlow'
import { isRateLimitedError } from '~/utils/apiError'

type ZoomWindow = { start: string, end: string }

const props = withDefaults(defineProps<{
  eventId: number
  market: string
  selection: string
  timeRange?: string
  height?: number
  refreshKey?: number
  zoomWindow?: ZoomWindow | null
}>(), {
  timeRange: '6h',
  height: 240,
  refreshKey: 0,
  zoomWindow: null,
})
const emit = defineEmits<{
  zoom: [range: ZoomWindow]
  reset: []
}>()

const { data, status, pending, refresh, error } = useTradeFlow(
  computed(() => props.eventId),
  computed(() => props.market),
  computed(() => props.selection),
  computed(() => 'raw'),
)
const rateLimited = computed(() => isRateLimitedError(error.value))

watch(() => props.refreshKey, () => { refresh() })

const RANGE_HOURS: Record<string, number> = { '3h': 3, '6h': 6, '12h': 12, '24h': 24 }
const ATTR_ORDER = ['买', '卖', '冲', '买+', '卖+', '换']

function parseTimeMs(raw?: string): number | null {
  if (!raw) return null
  const ms = new Date(raw).getTime()
  return Number.isFinite(ms) ? ms : null
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

function applyZoomWindow(d: TradeFlowResult): TradeFlowResult {
  const z = props.zoomWindow
  if (!z) return d
  const startMs = parseTimeMs(z.start)
  const endMs = parseTimeMs(z.end)
  if (startMs == null || endMs == null) return d
  const lo = Math.min(startMs, endMs)
  const hi = Math.max(startMs, endMs)
  const buckets = d.buckets.filter((b) => {
    const ms = parseTimeMs(b.time)
    return ms != null && ms >= lo && ms <= hi
  })
  return buckets.length >= 2 ? { ...d, buckets } : d
}

// 单方向只使用 tradeflow raw 原始点；避免在经典列表里为同一图额外请求 timeseries traded。
const filtered = computed<TradeFlowResult | null>(() => {
  const d = data.value
  if (!d) return null
  const base = fallbackFiltered(d)
  return applyZoomWindow({
    ...base,
    attrs: fixedAttrs(base),
    buckets: base.buckets.map(b => ({
      ...b,
      items: normalizeItems(b.items ?? {}),
    })),
  })
})
</script>

<template>
  <div class="ctf-panel">
    <div v-if="status === 'no-access'" class="chart-state">当前会籍未开放此走势</div>
    <div v-else-if="rateLimited" class="chart-state">请求过于频繁，请稍后刷新</div>
    <div v-else-if="pending && !data" class="chart-state">加载中…</div>
    <div v-else-if="!filtered || filtered.buckets.length === 0" class="chart-state">暂无成交明细</div>
    <TradeFlowChart
      v-else
      :result="filtered"
      :height="height"
      zoomable
      @zoom="emit('zoom', $event)"
      @reset="emit('reset')"
    />
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
