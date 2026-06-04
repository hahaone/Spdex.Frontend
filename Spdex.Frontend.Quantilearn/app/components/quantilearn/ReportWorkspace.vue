<script setup lang="ts">
import { BarChart3, ListChecks, PieChart, RefreshCw, Target, TrendingUp } from '@lucide/vue'
import type {
  GoalRow,
  LeagueScope,
  MarketRow,
  QuantModel,
  ReportPeriod,
  ReportView,
  TimelinePoint,
} from '~/data/quantilearnPrototype'
import { leagueScopes } from '~/data/quantilearnPrototype'

const chartModes = [
  { id: 'return', label: '年化', icon: TrendingUp },
  { id: 'distribution', label: '分布', icon: BarChart3 },
  { id: 'probability', label: '概率', icon: PieChart },
] as const

type ReportChartMode = typeof chartModes[number]['id']

const props = defineProps<{
  model: QuantModel
  leagueScope: LeagueScope
  reportView: ReportView
  reportPeriods: ReportPeriod[]
  marketRows: MarketRow[]
  goalRows: GoalRow[]
  timeline: TimelinePoint[]
  loading?: boolean
  error?: string
  sourceLabel?: string
}>()

const emit = defineEmits<{
  changeLeagueScope: [scope: LeagueScope]
  changeReportView: [view: ReportView]
  refreshReport: []
}>()

const goalMax = computed(() => Math.max(...props.goalRows.map(row => row.value), 1))
const returnMax = computed(() => Math.max(...props.marketRows.map(row => Math.abs(row.yearReturn)), 0.01))
const chartMode = ref<ReportChartMode>('return')
const activePeriodLabel = ref('')

const barWidth = (value: number, max: number) => `${Math.max(3, Math.min(100, Math.round((Math.abs(value) / max) * 100)))}%`
const percentText = (value: number) => `${Math.round(value * 100)}%`

watch(
  () => props.reportPeriods.map(period => period.label).join('|'),
  () => {
    if (!props.reportPeriods.length) {
      activePeriodLabel.value = ''
      return
    }

    if (!props.reportPeriods.some(period => period.label === activePeriodLabel.value)) {
      activePeriodLabel.value = props.reportPeriods.at(-1)?.label ?? props.reportPeriods[0]!.label
    }
  },
  { immediate: true },
)

const activePeriod = computed(() => (
  props.reportPeriods.find(period => period.label === activePeriodLabel.value)
  ?? props.reportPeriods.at(-1)
  ?? null
))

const bestMarket = computed(() => {
  if (!props.marketRows.length) return null
  return [...props.marketRows].sort((left, right) => right.yearReturn - left.yearReturn)[0] ?? null
})

const chartMetric = (row: MarketRow) => {
  if (chartMode.value === 'distribution') return row.distribution
  if (chartMode.value === 'probability') return row.probability
  return row.yearReturn
}

const chartMetricText = (value: number) => percentText(value)

const chartRows = computed(() => (
  props.marketRows
    .map(row => ({
      key: `${row.market}-${row.selection}`,
      label: `${row.market} ${row.selection}`.trim(),
      count: row.count,
      value: chartMetric(row),
      average: row.average,
      negative: chartMetric(row) < 0,
    }))
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
))

const chartMax = computed(() => {
  const max = Math.max(...chartRows.value.map(row => Math.abs(row.value)), 0.01)
  return chartMode.value === 'return' ? max : Math.max(max, 1)
})

const chartModeLabel = computed(() => chartModes.find(mode => mode.id === chartMode.value)?.label ?? '年化')

const activePeriodMeta = computed(() => {
  const period = activePeriod.value
  if (!period) return '暂无周期样本'

  return `${period.selection} / 年化 ${percentText(period.yearReturn)} / 分布 ${percentText(period.distribution)}`
})
</script>

<template>
  <section class="workspace-panel report-workspace">
    <div class="panel-title report-title">
      <div>
        <span class="eyebrow">ModelReportV2.aspx</span>
        <h3>回测报告</h3>
        <p>{{ model.name }} / {{ model.hasStatistics ? '已有统计样本' : '待回测' }}</p>
      </div>
      <div class="toolbar">
        <button
          v-for="scope in leagueScopes"
          :key="scope.id"
          type="button"
          :class="['tab-button focus-ring', { active: leagueScope === scope.id }]"
          @click="emit('changeLeagueScope', scope.id)"
        >
          {{ scope.label }}
        </button>
        <span :class="['report-source', { error }]">{{ error || (loading ? '读取回测...' : sourceLabel || '实时统计') }}</span>
        <button type="button" class="ghost-button focus-ring" @click="emit('refreshReport')">
          <RefreshCw :size="15" />
          <span>更新回测</span>
        </button>
      </div>
    </div>

    <div class="report-periods">
      <button
        v-for="period in reportPeriods"
        :key="period.label"
        type="button"
        :class="['period-card', 'focus-ring', { active: activePeriod?.label === period.label }]"
        @click="activePeriodLabel = period.label"
      >
        <span>{{ period.label }}</span>
        <strong class="num">{{ period.hit }}</strong>
        <em>{{ period.selection }} / {{ Math.round(period.yearReturn * 100) }}% / {{ Math.round(period.distribution * 100) }}%</em>
      </button>
    </div>

    <div class="report-tabs">
      <button type="button" :class="['tab-button focus-ring', { active: reportView === 'final' }]" @click="emit('changeReportView', 'final')">全场统计</button>
      <button type="button" :class="['tab-button focus-ring', { active: reportView === 'half' }]" @click="emit('changeReportView', 'half')">半场统计</button>
      <button type="button" :class="['tab-button focus-ring', { active: reportView === 'goals' }]" @click="emit('changeReportView', 'goals')">比分分布</button>
    </div>

    <div class="report-summary">
      <div>
        <ListChecks :size="15" />
        <span>当前周期</span>
        <strong>{{ activePeriod?.label ?? '-' }}</strong>
        <em>{{ activePeriodMeta }}</em>
      </div>
      <div>
        <Target :size="15" />
        <span>最佳方向</span>
        <strong>{{ bestMarket ? `${bestMarket.market} ${bestMarket.selection}` : '-' }}</strong>
        <em>{{ bestMarket ? `均赔 ${bestMarket.average.toFixed(2)} / 样本 ${bestMarket.count}` : '暂无市场统计' }}</em>
      </div>
      <div>
        <TrendingUp :size="15" />
        <span>当前图表</span>
        <strong>{{ chartModeLabel }}</strong>
        <em>{{ reportView === 'goals' ? '比分分布按样本量排序' : '市场条形图支持切换指标' }}</em>
      </div>
    </div>

    <template v-if="reportView !== 'goals'">
      <section class="chart-panel" aria-label="市场统计图表">
        <div class="chart-head">
          <div>
            <span class="eyebrow">CHART</span>
            <h3>市场表现</h3>
          </div>
          <div class="chart-switch">
            <button
              v-for="mode in chartModes"
              :key="mode.id"
              type="button"
              :class="['chart-mode-button', 'focus-ring', { active: chartMode === mode.id }]"
              @click="chartMode = mode.id"
            >
              <component :is="mode.icon" :size="14" />
              <span>{{ mode.label }}</span>
            </button>
          </div>
        </div>
        <div class="market-chart">
          <div v-for="row in chartRows" :key="row.key" class="market-chart-row">
            <div>
              <strong>{{ row.label }}</strong>
              <span>命中 {{ row.count }} / 均赔 {{ row.average.toFixed(2) }}</span>
            </div>
            <i><em :class="{ negative: row.negative }" :style="{ width: barWidth(row.value, chartMax) }" /></i>
            <strong :class="['num', { negative: row.negative }]">{{ chartMetricText(row.value) }}</strong>
          </div>
        </div>
      </section>

      <div class="report-table" aria-label="Model report market statistics">
        <div class="report-grid table-head">
          <span>市场</span>
          <span>方向</span>
          <span>命中</span>
          <span>分布</span>
          <span>均赔</span>
          <span>概率</span>
          <span>年化</span>
        </div>
        <div v-for="row in marketRows" :key="`${row.market}-${row.selection}`" class="report-grid report-row">
          <span>{{ row.market }}</span>
          <strong>{{ row.selection }}</strong>
          <span class="num">{{ row.count }}</span>
          <span class="metric-cell">
            <b class="num">{{ percentText(row.distribution) }}</b>
            <i><em :style="{ width: barWidth(row.distribution, 1) }" /></i>
          </span>
          <span class="num">{{ row.average.toFixed(2) }}</span>
          <span class="num">{{ percentText(row.probability) }}</span>
          <strong :class="['metric-cell', 'return-cell', { negative: row.yearReturn < 0 }]">
            <b class="num">{{ percentText(row.yearReturn) }}</b>
            <i><em :style="{ width: barWidth(row.yearReturn, returnMax) }" /></i>
          </strong>
        </div>
      </div>
    </template>

    <section v-else class="goal-distribution" aria-label="比分分布图表">
      <div class="chart-head">
        <div>
          <span class="eyebrow">GOALS</span>
          <h3>比分分布</h3>
        </div>
        <span class="status-chip plain">样本峰值 {{ goalMax }}</span>
      </div>
      <div v-for="goal in goalRows" :key="goal.label" class="goal-bar">
        <span>{{ goal.label }}</span>
        <i :style="{ width: barWidth(goal.value, goalMax) }" />
        <strong class="num">{{ goal.value }}</strong>
      </div>
    </section>

    <div class="timeline-panel">
      <div class="panel-title">
        <div>
          <span class="eyebrow">YearReturnHolder</span>
          <h3>一年样本时间轴</h3>
        </div>
        <div class="timeline-legend">
          <span><i class="positive" />正向</span>
          <span><i class="negative" />回撤</span>
          <strong class="status-chip good">{{ model.bestSelection }}</strong>
        </div>
      </div>
      <div class="timeline-bars">
        <div v-for="point in timeline" :key="point.label" class="timeline-item">
          <span class="positive" :style="{ height: `${point.positive}%` }" />
          <span class="negative" :style="{ height: `${point.negative}%` }" />
          <em>{{ point.label }}</em>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.report-workspace {
  display: grid;
  gap: 10px;
}

.report-title {
  align-items: start;
}

.toolbar,
.report-tabs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.tab-button {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--muted);
  font-weight: 780;
}

.tab-button.active {
  border-color: #132331;
  background: #132331;
  color: #ffffff;
}

.report-source {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 9px;
  border-radius: 6px;
  background: var(--teal-soft);
  color: #0b6f67;
  font-size: 0.72rem;
  font-weight: 780;
}

.report-source.error {
  background: var(--rose-soft);
  color: var(--rose);
}

.report-periods {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.period-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto auto;
  gap: 1px 8px;
  align-items: baseline;
  min-height: 58px;
  min-width: 0;
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: inherit;
  text-align: left;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
}

.period-card:hover,
.period-card.active {
  border-color: rgba(54, 151, 142, 0.58);
  background: #f5fbfa;
}

.period-card.active {
  box-shadow: inset 0 0 0 1px rgba(54, 151, 142, 0.2);
}

.period-card span {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 780;
}

.period-card strong {
  text-align: right;
  color: var(--ink);
  font-size: 1.12rem;
  line-height: 1.05;
}

.period-card em {
  grid-column: 1 / 3;
  overflow: hidden;
  color: var(--subtle);
  font-size: 0.74rem;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.report-summary div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 2px 8px;
  align-items: center;
  min-width: 0;
  min-height: 62px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}

.report-summary svg {
  grid-row: 1 / 4;
  color: var(--teal);
}

.report-summary span {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.report-summary strong,
.report-summary em {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-summary strong {
  color: var(--ink);
  font-size: 0.92rem;
  font-weight: 860;
}

.report-summary em {
  color: var(--subtle);
  font-size: 0.72rem;
  font-style: normal;
}

.chart-panel {
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chart-head h3 {
  color: var(--ink);
  font-size: 0.95rem;
  font-weight: 860;
}

.chart-switch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.chart-mode-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 820;
}

.chart-mode-button.active {
  background: #132331;
  color: #ffffff;
}

.market-chart {
  display: grid;
  gap: 7px;
}

.market-chart-row {
  display: grid;
  grid-template-columns: minmax(88px, 0.88fr) minmax(0, 1.5fr) 52px;
  gap: 8px;
  align-items: center;
  min-height: 34px;
}

.market-chart-row > div {
  display: grid;
  min-width: 0;
}

.market-chart-row strong,
.market-chart-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-chart-row > div strong {
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 820;
}

.market-chart-row > div span {
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 720;
}

.market-chart-row > i {
  display: block;
  min-width: 0;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #e6edf3;
}

.market-chart-row > i em {
  display: block;
  height: 100%;
  min-width: 3px;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--teal), #66c8bd);
}

.market-chart-row > i em.negative {
  background: linear-gradient(90deg, var(--rose), #f2a0ae);
}

.market-chart-row > .num {
  color: var(--teal);
  text-align: right;
  font-size: 0.78rem;
  font-weight: 860;
}

.market-chart-row > .num.negative {
  color: var(--rose);
}

.report-table {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}

.report-grid {
  display: grid;
  grid-template-columns:
    minmax(58px, 1.2fr)
    minmax(42px, 0.9fr)
    minmax(38px, 0.72fr)
    minmax(38px, 0.72fr)
    minmax(42px, 0.76fr)
    minmax(42px, 0.76fr)
    minmax(48px, 0.86fr);
  min-width: 414px;
  column-gap: 6px;
  padding: 0 9px;
}

.report-row {
  min-height: 38px;
  align-items: center;
  border-top: 1px solid rgba(220, 227, 235, 0.72);
  color: var(--ink);
  font-size: 0.78rem;
}

.report-row strong {
  font-weight: 820;
}

.return-cell {
  color: var(--teal);
  text-align: right;
}

.return-cell.negative {
  color: var(--rose);
}

.report-grid > span,
.report-grid > strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-cell {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.metric-cell b {
  font-weight: 820;
}

.metric-cell i {
  display: block;
  height: 5px;
  min-width: 0;
  border-radius: 999px;
  background: #e1e8ef;
}

.metric-cell em {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--teal);
}

.return-cell.negative em {
  background: var(--rose);
}

.goal-distribution,
.timeline-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.goal-distribution .chart-head {
  margin-bottom: 2px;
}

.goal-bar {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) 44px;
  gap: 8px;
  align-items: center;
  min-height: 28px;
}

.goal-bar i {
  display: block;
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--teal), #70c9bf);
}

.timeline-bars {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  height: 132px;
  align-items: end;
}

.timeline-item {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 3px;
  height: 100%;
  align-items: end;
  justify-items: center;
}

.timeline-item span {
  width: 100%;
  min-height: 8px;
  border-radius: 6px 6px 0 0;
}

.timeline-item .positive {
  background: var(--teal);
}

.timeline-item .negative {
  background: var(--rose);
}

.timeline-item em {
  grid-column: 1 / 3;
  color: var(--muted);
  font-size: 0.7rem;
  font-style: normal;
}

.timeline-legend {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.timeline-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 780;
}

.timeline-legend i {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.timeline-legend i.positive {
  background: var(--teal);
}

.timeline-legend i.negative {
  background: var(--rose);
}

@media (max-width: 760px) {
  .report-title {
    display: grid;
  }

  .toolbar {
    justify-content: flex-start;
  }

  .report-summary {
    grid-template-columns: 1fr;
  }

  .chart-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .chart-switch {
    width: 100%;
  }

  .chart-mode-button {
    flex: 1;
  }

  .market-chart-row {
    grid-template-columns: minmax(78px, 0.85fr) minmax(0, 1.3fr) 48px;
  }
}

@media (max-width: 430px) {
  .report-periods {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .period-card {
    padding: 7px;
  }

  .period-card em {
    display: none;
  }

  .report-summary div {
    min-height: 54px;
  }

  .market-chart-row {
    grid-template-columns: 1fr 48px;
  }

  .market-chart-row > i {
    grid-column: 1 / 3;
    order: 3;
  }
}
</style>
