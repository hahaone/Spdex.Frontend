<script setup lang="ts">
import { ArrowLeft, Lock, RefreshCw } from '@lucide/vue'
import { CHART_MARKETS } from '~/composables/useChartSeries'

const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))

const market = ref('standard')
const metric = ref('odds')
const timeRange = ref('6h')
const seriesOnly = ref<'home' | 'draw' | 'away' | null>(null)

const currentMarket = computed(() => CHART_MARKETS.find(m => m.value === market.value) ?? CHART_MARKETS[0]!)
const metrics = computed(() => currentMarket.value.metrics)

// 切换盘口后，若当前指标不在新盘口的指标集合里，回退到第一个
watch(market, () => {
  if (!metrics.value.some(m => m.value === metric.value))
    metric.value = metrics.value[0]?.value ?? 'odds'
})

// 组合成后端的复合 type："standard.bfindex" 等
const graphType = computed(() => `${market.value}.${metric.value}`)

const timeOptions = [
  { label: '2H', value: '2h' },
  { label: '6H', value: '6h' },
  { label: '24H', value: '24h' },
  { label: '全部', value: 'all' },
]

const { detail } = useMatchDetail(eventId)
const match = computed(() => detail.value?.match)

const { points, status, pending, refresh, metricLabel, unit, seriesLabels } = useChartSeries(eventId, graphType)

// 桌面加高图表画布(移动端保持 220)
const isDesktop = useIsDesktop()
const chartHeight = computed(() => (isDesktop.value ? 360 : 220))

// 时间范围过滤（按最后一个点往前推 N 小时；不足 2 点退回全部）
const RANGE_HOURS: Record<string, number> = { '2h': 2, '6h': 6, '24h': 24 }
const displayPoints = computed(() => {
  const all = points.value
  const h = RANGE_HOURS[timeRange.value]
  const lastTs = all.at(-1)?.ts
  if (!h || all.length === 0 || !lastTs) return all
  const cutoff = new Date(lastTs).getTime() - h * 3600_000
  const filtered = all.filter(p => p.ts && new Date(p.ts).getTime() >= cutoff)
  return filtered.length >= 2 ? filtered : all
})

// 模拟盈亏固定 60 基线、冷热固定 0 基线
const baseline = computed<number | null>(() => {
  if (metric.value === 'payout') return 60
  if (metric.value === 'hotcold') return 0
  return null
})
// 成交变化用柱状图
const barMode = computed(() => metric.value === 'traded')

// ── E1 成交明细（原始成交走势）：单独走 tradeflow 通道 ──
const isTradeFlow = computed(() => metric.value === 'tradeflow')
// 成交明细必须单选项；"全部"(null) 视为主/大
const tradeSelection = computed<'home' | 'draw' | 'away'>(() => seriesOnly.value ?? 'home')
// 时间档 → 粒度：窗口越大粒度越粗，控制桶数
const tfGranularity = computed(() => (timeRange.value === '2h' ? '5m' : timeRange.value === '6h' ? '15m' : '30m'))
const { data: tradeFlow, status: tfStatus, pending: tfPending, refresh: tfRefresh } = useTradeFlow(
  eventId, market, tradeSelection, tfGranularity,
)
// 进入成交明细且当前为"全部"时，回退到单选项
watch(isTradeFlow, (on) => {
  if (on && seriesOnly.value === null) seriesOnly.value = 'home'
})
const tfStatusLabel = computed(() => {
  if (tfStatus.value === 'no-access') return '成交明细为专家版及以上专属'
  if (tfStatus.value === 'pending') return '此场赛事暂无成交明细数据'
  return null
})

// 只看 主/平/客 筛选项（按当前盘口的序列标签）
const seriesOptions = computed(() => {
  const l = seriesLabels.value
  // 成交明细必须单选项，不提供"全部"
  const opts: { label: string, value: 'home' | 'draw' | 'away' | null }[] = isTradeFlow.value
    ? [{ label: `只看${l.home}`, value: 'home' }]
    : [{ label: '全部', value: null }, { label: `只看${l.home}`, value: 'home' }]
  if (l.draw) opts.push({ label: `只看${l.draw}`, value: 'draw' })
  opts.push({ label: `只看${l.away}`, value: 'away' })
  return opts
})

// 盘口切换后若当前"只看平"但新盘口无平局，回退到全部
watch(seriesLabels, (l) => {
  if (seriesOnly.value === 'draw' && !l.draw) seriesOnly.value = null
})

const statusLabel = computed(() => {
  if (status.value === 'no-access') return '当前会籍未开放此走势'
  if (status.value === 'pending') return '此场赛事暂无该市场数据'
  return null
})

const currentMetricLabel = computed(() => {
  // 成交明细走独立通道，标题用本地标签（避免被 timeseries 的"价位"标签污染）
  if (isTradeFlow.value)
    return metrics.value.find(m => m.value === 'tradeflow')?.label || '成交明细'
  return metricLabel.value || metrics.value.find(m => m.value === metric.value)?.label || ''
})
const chartTitle = computed(() => `${currentMarket.value.label} · ${currentMetricLabel.value}`)
</script>

<template>
  <div class="chart-page">
    <section class="header">
      <NuxtLink :to="`/football/${eventId}`" class="back focus-ring">
        <ArrowLeft :size="15" />
        <span>返回详情</span>
      </NuxtLink>
      <div class="teams">
        <span class="num">{{ match?.homeTeam ?? '—' }}</span>
        <b class="line">{{ match?.handicap || '—' }}</b>
        <span class="num">{{ match?.awayTeam ?? '—' }}</span>
      </div>
    </section>

    <section class="controls">
      <div class="group-row">
        <span class="group-label">盘口</span>
        <div class="group-buttons scrollbar-none">
          <button
            v-for="m in CHART_MARKETS"
            :key="m.value"
            type="button"
            :class="['group-btn focus-ring', { active: market === m.value }]"
            @click="market = m.value"
          >
            {{ m.label }}
          </button>
        </div>
      </div>

      <div class="group-row">
        <span class="group-label">指标</span>
        <div class="group-buttons scrollbar-none">
          <button
            v-for="mt in metrics"
            :key="mt.value"
            type="button"
            :class="['group-btn focus-ring', { active: metric === mt.value }]"
            @click="metric = mt.value"
          >
            {{ mt.label }}
          </button>
        </div>
      </div>

      <div class="time-row">
        <SegmentedControl v-model="timeRange" :options="timeOptions" dense tone="ink" />
        <button
          class="refresh-btn focus-ring"
          aria-label="刷新"
          :disabled="isTradeFlow ? tfPending : pending"
          @click="isTradeFlow ? tfRefresh() : refresh()"
        >
          <RefreshCw :size="15" :class="{ spinning: isTradeFlow ? tfPending : pending }" />
        </button>
      </div>

      <div class="series-row scrollbar-none">
        <button
          v-for="s in seriesOptions"
          :key="String(s.value)"
          type="button"
          :class="['series-btn focus-ring', { active: seriesOnly === s.value }]"
          @click="seriesOnly = s.value"
        >
          {{ s.label }}
        </button>
      </div>
    </section>

    <section class="chart-band">
      <div class="chart-title">
        <h1>{{ chartTitle }}</h1>
        <span class="hint">{{ timeRange.toUpperCase() }} · 自动刷新</span>
      </div>

      <!-- E1 成交明细：独立 tradeflow 通道 -->
      <template v-if="isTradeFlow">
        <div v-if="tfStatusLabel" class="chart-placeholder">
          <Lock :size="14" />
          <span>{{ tfStatusLabel }}</span>
        </div>
        <LazyTradeFlowChart
          v-else-if="tradeFlow && tradeFlow.buckets.length"
          :result="tradeFlow"
          :height="chartHeight"
        />
        <div v-else class="chart-placeholder">
          <span>{{ tfPending ? '加载中…' : '暂无成交明细数据' }}</span>
        </div>
      </template>

      <!-- 其余指标：折线/柱状走势 -->
      <template v-else>
        <div v-if="statusLabel" class="chart-placeholder">
          <Lock :size="14" />
          <span>{{ statusLabel }}</span>
        </div>
        <LazyStaticTrendChart
          v-else-if="displayPoints.length"
          :points="displayPoints"
          :series-labels="seriesLabels"
          :unit="unit"
          :only="seriesOnly"
          :baseline="baseline"
          :bar-mode="barMode"
          :height="chartHeight"
        />
        <div v-else class="chart-placeholder">
          <span>{{ pending ? '加载中…' : '暂无走势数据' }}</span>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.chart-page {
  display: grid;
}

.chart-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 220px;
  border: 1px dashed var(--line);
  border-radius: 4px;
  background: #f9fafc;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 720;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.header {
  display: grid;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(180deg, var(--panel) 0%, var(--surface) 100%);
  border-bottom: 1px solid var(--divider);
}

.back {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 4px;
  color: var(--brand);
  font-size: 0.78rem;
  font-weight: 740;
}

.teams {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink);
  font-size: 0.92rem;
  font-weight: 780;
}

.line {
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--brand);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 800;
}

.controls {
  display: grid;
  gap: 7px;
  padding: 8px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
}

.group-row {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
}

.group-label {
  padding: 3px 5px;
  border-radius: 3px;
  background: var(--lavender);
  color: var(--accent-deep);
  font-size: 0.7rem;
  font-weight: 800;
  text-align: center;
  letter-spacing: 0.02em;
}

.group-buttons {
  display: flex;
  overflow-x: auto;
  gap: 4px;
}

.group-btn {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 740;
  white-space: nowrap;
}

.group-btn.active {
  border-color: var(--brand);
  background: var(--brand);
  color: #fff;
}

.time-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px;
  gap: 6px;
  align-items: center;
}

.refresh-btn {
  display: inline-grid;
  min-height: 28px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--muted);
}

.series-row {
  display: flex;
  gap: 4px;
  overflow-x: auto;
}

.series-btn {
  flex: 0 0 auto;
  min-height: 26px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 720;
  white-space: nowrap;
}

.series-btn.active {
  border-color: var(--brand);
  background: var(--brand-tint);
  color: var(--brand-deep);
}

.chart-band {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  background: var(--panel);
}

.chart-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

h1 {
  margin: 0;
  font-size: 0.94rem;
  font-weight: 820;
}

.hint {
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(124, 92, 250, 0.14);
  color: var(--brand-deep);
  font-size: 0.7rem;
  font-weight: 760;
}

/* 桌面：图表工作区居中，避免全宽拉伸；区块卡片化 */
@media (min-width: 1024px) {
  .chart-page {
    max-width: 1040px;
    margin: 16px auto 24px;
    gap: 10px;
  }

  .header,
  .controls,
  .chart-band {
    border: 1px solid var(--line);
    border-radius: 8px;
  }
}
</style>
