<script setup lang="ts">
import { ArrowLeft, Lock, RefreshCw } from '@lucide/vue'
import type { ChartSeriesType } from '~/composables/useChartSeries'

const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))

// 篮球 type 列表与足球一致，部分类型可能后端未实现（返回 pending）
const graphType = ref<ChartSeriesType>('1X2')
const timeRange = ref('6h')

const graphGroups = [
  { label: '标盘', items: [
    { label: '胜负', value: '1X2' as ChartSeriesType },
    { label: '势能', value: 'momentum' as ChartSeriesType },
  ] },
  { label: '让/分', items: [
    { label: '让分', value: 'handicap' as ChartSeriesType },
    { label: '大小', value: 'goals' as ChartSeriesType },
  ] },
]

const timeOptions = [
  { label: '6H', value: '6h' },
  { label: '24H', value: '24h' },
  { label: '全部', value: 'all' },
]

const { detail } = useMatchDetail(eventId)
const match = computed(() => detail.value?.match)

const { points, status, pending, refresh } = useChartSeries(eventId, graphType)

const statusLabel = computed(() => {
  if (status.value === 'no-access') return '当前会籍未开放此走势'
  if (status.value === 'pending') return '此场赛事暂无该市场数据'
  return null
})
</script>

<template>
  <div class="chart-page">
    <section class="header">
      <NuxtLink :to="`/basketball/${eventId}`" class="back focus-ring">
        <ArrowLeft :size="15" />
        <span>返回详情</span>
      </NuxtLink>
      <div class="teams">
        <span class="num">{{ match?.homeTeam ?? '—' }}</span>
        <b class="line">{{ match?.handicap || 'VS' }}</b>
        <span class="num">{{ match?.awayTeam ?? '—' }}</span>
      </div>
    </section>

    <section class="controls">
      <div v-for="group in graphGroups" :key="group.label" class="group-row">
        <span class="group-label">{{ group.label }}</span>
        <div class="group-buttons scrollbar-none">
          <button
            v-for="item in group.items"
            :key="item.value"
            type="button"
            :class="['group-btn focus-ring', { active: graphType === item.value }]"
            @click="graphType = item.value"
          >
            {{ item.label }}
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
        <h1>{{ graphType }} 走势</h1>
        <span class="hint">{{ timeRange.toUpperCase() }} · 自动刷新</span>
      </div>

      <div v-if="statusLabel" class="chart-placeholder">
        <Lock :size="14" />
        <span>{{ statusLabel }}</span>
      </div>
      <StaticTrendChart v-else-if="points.length" :points="points" :height="220" />
      <div v-else class="chart-placeholder">
        <span>{{ pending ? '加载中…' : '暂无走势数据' }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.chart-page { display: grid; }
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
.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

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
  background: var(--sell);
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
  background: var(--draw-bg);
  color: var(--sell);
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
  border-color: var(--sell);
  background: var(--sell);
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
  background: var(--draw-bg);
  color: var(--sell);
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
