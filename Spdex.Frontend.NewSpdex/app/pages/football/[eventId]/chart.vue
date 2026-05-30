<script setup lang="ts">
import { ArrowLeft, Lock, RefreshCw } from '@lucide/vue'
import { CHART_MARKETS } from '~/composables/useChartSeries'

const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))

const market = ref('standard')
const metric = ref('odds')
const timeRange = ref('6h')

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
  { label: '6H', value: '6h' },
  { label: '24H', value: '24h' },
  { label: '全部', value: 'all' },
]

const { detail } = useMatchDetail(eventId)
const match = computed(() => detail.value?.match)

const { points, status, pending, refresh, metricLabel, unit, seriesLabels } = useChartSeries(eventId, graphType)

const statusLabel = computed(() => {
  if (status.value === 'no-access') return '当前会籍未开放此走势'
  if (status.value === 'pending') return '此场赛事暂无该市场数据'
  return null
})

const currentMetricLabel = computed(() =>
  metricLabel.value || metrics.value.find(m => m.value === metric.value)?.label || '')
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
        <button class="refresh-btn focus-ring" aria-label="刷新" :disabled="pending" @click="refresh()">
          <RefreshCw :size="15" :class="{ spinning: pending }" />
        </button>
      </div>
    </section>

    <section class="chart-band">
      <div class="chart-title">
        <h1>{{ chartTitle }}</h1>
        <span class="hint">{{ timeRange.toUpperCase() }} · 自动刷新</span>
      </div>

      <div v-if="statusLabel" class="chart-placeholder">
        <Lock :size="14" />
        <span>{{ statusLabel }}</span>
      </div>
      <StaticTrendChart
        v-else-if="points.length"
        :points="points"
        :series-labels="seriesLabels"
        :unit="unit"
        :height="220"
      />
      <div v-else class="chart-placeholder">
        <span>{{ pending ? '加载中…' : '暂无走势数据' }}</span>
      </div>
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
  background: rgba(26, 140, 211, 0.14);
  color: var(--brand-deep);
  font-size: 0.7rem;
  font-weight: 760;
}
</style>
