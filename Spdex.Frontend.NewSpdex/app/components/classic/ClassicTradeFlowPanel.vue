<script setup lang="ts">
/**
 * 经典工作台「成交走势图」单方向(只看主/客/平)视图:复用 E1 成交明细通道(useTradeFlow),
 * 按 TradedAttr 拆 买/卖/冲/买+/卖+/换 堆叠柱 + 价位线(还原旧站 dataViz14Home 单株走势图)。
 * 仅在父组件单方向成交时 v-if 挂载 → 此时才发起请求。时段(timeRange)客户端过滤桶。
 */
import TradeFlowChart from '~/components/chart/TradeFlowChart.vue'

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

watch(() => props.refreshKey, () => { refresh() })

const RANGE_HOURS: Record<string, number> = { '3h': 3, '6h': 6, '12h': 12, '24h': 24 }

// 按时段过滤桶(与方向走势图一致):末桶时间往前 N 小时;不足两桶则回退全部。
const filtered = computed(() => {
  const d = data.value
  if (!d) return null
  const h = RANGE_HOURS[props.timeRange]
  const last = d.buckets[d.buckets.length - 1]
  if (!h || !last) return d
  const cutoff = new Date(last.time).getTime() - h * 3600_000
  const buckets = d.buckets.filter(b => new Date(b.time).getTime() >= cutoff)
  return buckets.length >= 2 ? { ...d, buckets } : d
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
