<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'
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

const barWidth = (value: number, max: number) => `${Math.max(3, Math.min(100, Math.round((Math.abs(value) / max) * 100)))}%`
const percentText = (value: number) => `${Math.round(value * 100)}%`
</script>

<template>
  <section class="workspace-panel report-workspace">
    <div class="panel-title report-title">
      <div>
        <span class="eyebrow">ModelReportV2.aspx</span>
        <h3>回测报告</h3>
        <p>{{ model.name }} / {{ model.objectId }}</p>
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
      <div v-for="period in reportPeriods" :key="period.label" class="period-card">
        <span>{{ period.label }}</span>
        <strong class="num">{{ period.hit }}</strong>
        <em>{{ period.selection }} / {{ Math.round(period.yearReturn * 100) }}% / {{ Math.round(period.distribution * 100) }}%</em>
      </div>
    </div>

    <div class="report-tabs">
      <button type="button" :class="['tab-button focus-ring', { active: reportView === 'final' }]" @click="emit('changeReportView', 'final')">全场统计</button>
      <button type="button" :class="['tab-button focus-ring', { active: reportView === 'half' }]" @click="emit('changeReportView', 'half')">半场统计</button>
      <button type="button" :class="['tab-button focus-ring', { active: reportView === 'goals' }]" @click="emit('changeReportView', 'goals')">比分分布</button>
    </div>

    <div v-if="reportView !== 'goals'" class="report-table" aria-label="Model report market statistics">
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

    <div v-else class="goal-distribution">
      <div v-for="goal in goalRows" :key="goal.label" class="goal-bar">
        <span>{{ goal.label }}</span>
        <i :style="{ width: barWidth(goal.value, goalMax) }" />
        <strong class="num">{{ goal.value }}</strong>
      </div>
    </div>

    <div class="timeline-panel">
      <div class="panel-title">
        <div>
          <span class="eyebrow">YearReturnHolder</span>
          <h3>一年样本时间轴</h3>
        </div>
        <span class="status-chip good">{{ model.bestSelection }}</span>
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

@media (max-width: 760px) {
  .report-title {
    display: grid;
  }

  .toolbar {
    justify-content: flex-start;
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
}
</style>
