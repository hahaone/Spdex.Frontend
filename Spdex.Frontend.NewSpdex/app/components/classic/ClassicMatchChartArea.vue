<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'
import type { RouteLocationRaw } from 'vue-router'

/**
 * 经典工作台内嵌走势区(还原旧站 dcon):
 * - 默认「重大成交提示」(标准盘 + 大小球大单列表,来自 useBigTrades);
 * - 点右侧「走势图表」指标矩阵 → 切到对应走势图(useChartSeries/useTradeFlow,与详情页同一真实通道);
 * - 「明细图表」走真实详情路由 / 就地切图。
 * 仅在赛事块滚入视口后由父组件 v-if 挂载,此时才发起这些请求。
 */
const props = defineProps<{
  eventId: number
  homeTeam: string
  awayTeam: string
  detailTo: RouteLocationRaw
}>()

const eventIdRef = computed(() => props.eventId)

// 默认「成交」走势图(tradeflow);chart=走势图 / tips=重大成交提示(点「← 重大成交」切换)
const view = ref<'tips' | 'chart'>('chart')

const market = ref('standard')
const metric = ref('tradeflow')
const timeRange = ref('6h')
const seriesOnly = ref<'home' | 'draw' | 'away' | 'all' | null>('home')

const graphType = computed(() => `${market.value}.${metric.value}`)
const { points, status, pending, refresh, metricLabel, unit, seriesLabels } = useChartSeries(eventIdRef, graphType)

const RANGE_HOURS: Record<string, number> = { '3h': 3, '6h': 6, '12h': 12, '24h': 24 }
const timeOptions = [
  { label: '3小时', value: '3h' },
  { label: '6小时', value: '6h' },
  { label: '12小时', value: '12h' },
  { label: '24小时', value: '24h' },
  { label: '全部', value: 'all' },
]

const displayPoints = computed(() => {
  const all = points.value
  const h = RANGE_HOURS[timeRange.value]
  const lastTs = all.at(-1)?.ts
  if (!h || all.length === 0 || !lastTs) return all
  const cutoff = new Date(lastTs).getTime() - h * 3600_000
  const filtered = all.filter(p => p.ts && new Date(p.ts).getTime() >= cutoff)
  return filtered.length >= 2 ? filtered : all
})

const baseline = computed<number | null>(() => {
  if (metric.value === 'payout') return 60
  if (metric.value === 'hotcold') return 0
  return null
})
const barMode = computed(() => metric.value === 'traded')

const isTradeFlow = computed(() => metric.value === 'tradeflow')
const tradeSelection = computed<string>(() => seriesOnly.value ?? 'home')
// 折线图(非 tradeflow)的方向：'all' 视作全部(null=三线)。非 tradeflow 时 seriesOnly 已被强制为 null。
const trendOnly = computed<'home' | 'draw' | 'away' | null>(() => (seriesOnly.value === 'all' ? null : seriesOnly.value))
const tfGranularity = computed(() => (timeRange.value === '3h' ? '5m' : timeRange.value === '6h' || timeRange.value === '12h' ? '15m' : '30m'))
const { data: tradeFlow, status: tfStatus, pending: tfPending } = useTradeFlow(eventIdRef, market, tradeSelection, tfGranularity)

// 仅「成交 / 让分成交」(tradeflow) 有方向选择;其余指标默认全部方向(主/平/客三条线同呈现),不给方向下拉。
watch(isTradeFlow, (on) => { seriesOnly.value = on ? (seriesOnly.value ?? 'home') : null }, { immediate: true })
watch(seriesLabels, (l) => { if (seriesOnly.value === 'draw' && !l.draw) seriesOnly.value = 'home' })

const seriesOptions = computed(() => {
  const l = seriesLabels.value
  const opts: { label: string, value: 'home' | 'draw' | 'away' | 'all' }[] = [
    { label: '所有', value: 'all' },
    { label: `只看${l.home}`, value: 'home' },
  ]
  if (l.draw) opts.push({ label: `只看${l.draw}`, value: 'draw' })
  opts.push({ label: `只看${l.away}`, value: 'away' })
  return opts
})

const statusLabel = computed(() => {
  if (status.value === 'no-access') return '当前会籍未开放此走势'
  if (status.value === 'pending') return '此场赛事暂无该市场数据'
  return null
})
const tfStatusLabel = computed(() => {
  if (tfStatus.value === 'no-access') return '成交明细为专家版及以上专属'
  if (tfStatus.value === 'pending') return '此场赛事暂无成交明细数据'
  return null
})
const chartTitle = computed(() => {
  if (isTradeFlow.value) return market.value === 'handicap' ? '让分成交' : '成交'
  return metricLabel.value || '走势'
})

// ── 重大成交提示(默认视图)──
const { data: btData, group: bigGroup, pending: btPending } = useBigTrades(eventIdRef, 6)
const stdTips = computed(() => bigGroup('std-all'))
const ouTips = computed(() => bigGroup('ou-all'))
function fmtAmt(n: number) { return Math.round(n).toLocaleString('en-US') }
function fmtPer(p: number) { return `${(p * 100).toFixed(2)}%` }

// ── 走势图表矩阵:旧站标签 → 后端复合 type(market.metric)。无对应指标的置 disabled。──
interface MetricBtn { label: string, market: string, metric: string, disabled?: boolean }
const metricButtons: MetricBtn[] = [
  { label: '指数', market: 'standard', metric: 'bfindex' },
  { label: '成交', market: 'standard', metric: 'tradeflow' },
  { label: '比例', market: 'standard', metric: 'ratio' },
  { label: '模拟盈亏', market: 'standard', metric: 'payout' },
  { label: '价位', market: 'standard', metric: 'odds' },
  { label: '挂牌倾向', market: 'standard', metric: 'exchange' },
  { label: '冷热', market: 'standard', metric: 'hotcold' },
  { label: '凯利', market: 'euro', metric: 'kelly' },
  { label: '欧洲平均', market: 'euro', metric: 'europe' },
  { label: '进球成交', market: 'goals', metric: 'tradeflow' },
  { label: '进球比例', market: 'goals', metric: 'ratio' },
  { label: '进球指数', market: 'goals', metric: 'bfindex' },
  { label: '进球挂牌', market: 'goals', metric: 'exchange' },
  { label: '让分成交', market: 'handicap', metric: 'tradeflow' },
  { label: '让分指数', market: 'handicap', metric: 'bfindex' },
  { label: '让分比例', market: 'handicap', metric: 'ratio' },
  { label: '让分价位', market: 'handicap', metric: 'odds' },
  { label: '让分挂牌', market: 'handicap', metric: 'exchange' },
  { label: '进球均衡', market: '', metric: '', disabled: true },
  { label: '亚洲指数', market: 'handicap', metric: 'bfindex' },
  { label: '比分指数', market: 'cs', metric: 'bfindex' },
]

function pickMetric(b: MetricBtn) {
  if (b.disabled) return
  market.value = b.market
  metric.value = b.metric
  view.value = 'chart'
}
function isActive(b: MetricBtn) {
  return view.value === 'chart' && !b.disabled && market.value === b.market && metric.value === b.metric
}
function showChart(mk: string, mt: string) {
  market.value = mk
  metric.value = mt
  view.value = 'chart'
}

const tradesTo = computed(() => `/football/${props.eventId}/trades`)
const chartTo = computed(() => `/football/${props.eventId}/chart`)
</script>

<template>
  <div class="classic-chart-area">
    <!-- 左:重大成交提示(默认) / 走势图 -->
    <section class="left-dock">
      <!-- 重大成交提示 -->
      <div v-if="view === 'tips'" class="tips-wrap">
        <div v-if="btData?.accessLocked" class="tips-locked">{{ btData.lockMessage || '交易明细为专家版及以上专属' }}</div>
        <template v-else>
          <div class="tips-col">
            <h5>标准盘重大成交提示</h5>
            <div v-if="!stdTips || !stdTips.trades.length" class="tips-empty">{{ btPending ? '加载中…' : '暂无重大成交' }}</div>
            <ul v-else class="tips-list">
              <li v-for="(t, i) in stdTips.trades" :key="i">
                <b class="t-sel">{{ t.sel }}:{{ fmtAmt(t.amount) }}</b>
                <span>价位:{{ t.price.toFixed(2) }}</span>
                <span>属性:{{ t.side }}</span>
                <span :class="['t-per', `hl-${t.highlight}`]">交易时占:{{ fmtPer(t.per) }}</span>
                <span class="t-time">{{ t.time }}</span>
              </li>
            </ul>
          </div>
          <div class="tips-col">
            <h5>大小球重大成交提示</h5>
            <div v-if="!ouTips || !ouTips.trades.length" class="tips-empty">{{ btPending ? '加载中…' : '暂无重大成交' }}</div>
            <ul v-else class="tips-list">
              <li v-for="(t, i) in ouTips.trades" :key="i">
                <b class="t-sel">{{ t.sel }}:{{ fmtAmt(t.amount) }}</b>
                <span>价位:{{ t.price.toFixed(2) }}</span>
                <span>属性:{{ t.side }}</span>
                <span :class="['t-per', `hl-${t.highlight}`]">交易时占:{{ fmtPer(t.per) }}</span>
                <span class="t-time">{{ t.time }}</span>
              </li>
            </ul>
          </div>
        </template>
      </div>

      <!-- 走势图 -->
      <div v-else class="chart-dock">
        <div class="chart-tools">
          <button type="button" class="back-tips" @click="view = 'tips'">← 重大成交</button>
          <select v-model="timeRange" class="cd-select" aria-label="时间段">
            <option v-for="o in timeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <select v-if="isTradeFlow" v-model="seriesOnly" class="cd-select" aria-label="方向筛选">
            <option v-for="o in seriesOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <button type="button" class="cd-refresh" :disabled="pending" aria-label="刷新" @click="refresh()">
            <RefreshCw :size="13" :class="{ spinning: pending }" />
          </button>
          <span class="chart-title num">{{ chartTitle }}走势图</span>
        </div>

        <div class="chart-canvas">
          <template v-if="isTradeFlow">
            <div v-if="tfStatusLabel" class="chart-state">{{ tfStatusLabel }}</div>
            <LazyTradeFlowChart v-else-if="tradeFlow && tradeFlow.buckets.length" :result="tradeFlow" :height="200" />
            <div v-else class="chart-state">{{ tfPending ? '加载中…' : '暂无成交明细数据' }}</div>
          </template>
          <template v-else>
            <div v-if="statusLabel" class="chart-state">{{ statusLabel }}</div>
            <LazyStaticTrendChart
              v-else-if="displayPoints.length"
              :points="displayPoints"
              :series-labels="seriesLabels"
              :unit="unit"
              :only="trendOnly"
              :baseline="baseline"
              :bar-mode="barMode"
              :height="200"
            />
            <div v-else class="chart-state">{{ pending ? '加载中…' : '暂无走势数据' }}</div>
          </template>
        </div>
      </div>
    </section>

    <!-- 右:走势图表指标矩阵 + 明细图表入口 -->
    <section class="side-panels">
      <div class="panel">
        <h4>走势图表</h4>
        <div class="metric-grid">
          <button
            v-for="b in metricButtons"
            :key="b.label"
            type="button"
            :class="['metric-btn', { active: isActive(b), disabled: b.disabled }]"
            :disabled="b.disabled"
            @click="pickMetric(b)"
          >
            {{ b.label }}
          </button>
        </div>
      </div>

      <div class="panel">
        <h4>明细图表</h4>
        <div class="detail-grid">
          <NuxtLink :to="detailTo" class="detail-btn grey">完整明细</NuxtLink>
          <NuxtLink :to="tradesTo" class="detail-btn grey">成交明细</NuxtLink>
          <NuxtLink :to="chartTo" class="detail-btn blue">独立走势图</NuxtLink>
          <button type="button" class="detail-btn green" @click="showChart('euro', 'europe')">欧洲指数</button>
          <button type="button" class="detail-btn blue" @click="showChart('standard', 'tradeflow')">标盘</button>
          <button type="button" class="detail-btn blue" @click="showChart('goals', 'tradeflow')">进球</button>
          <button type="button" class="detail-btn blue" @click="showChart('cs', 'bfindex')">正确比分</button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.classic-chart-area {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 392px;
  gap: 12px;
  padding: 10px 12px 12px;
}

.left-dock {
  min-width: 0;
  border: 1px solid var(--classic-grid);
  background: var(--classic-panel);
}

/* 重大成交提示 */
.tips-wrap {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
}

.tips-col {
  min-width: 0;
  padding: 8px 10px 10px;
  border-right: 1px solid var(--classic-grid);
}

.tips-col:last-child {
  border-right: 0;
}

.tips-col h5 {
  margin: 0 0 6px;
  color: var(--classic-text);
  font-size: 0.82rem;
  font-weight: 840;
}

.tips-list {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tips-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
  color: var(--classic-text);
}

.t-sel {
  color: var(--classic-link);
  font-weight: 820;
}

.t-per.hl-1 { color: #c0700f; font-weight: 800; }
.t-per.hl-2 { color: #d62b2b; font-weight: 840; }

.t-time {
  color: var(--classic-title-muted);
}

.tips-empty,
.tips-locked {
  display: grid;
  place-items: center;
  min-height: 80px;
  padding: 12px;
  color: var(--classic-title-muted);
  font-size: 0.78rem;
  font-weight: 720;
}

.tips-locked {
  min-height: 120px;
  color: var(--warn);
}

/* 走势图 */
.chart-dock {
  min-width: 0;
}

.chart-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 10px;
  border-bottom: 1px solid var(--classic-grid);
}

.back-tips {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--classic-border);
  border-radius: 2px;
  background: var(--classic-purple-soft);
  color: var(--accent-deep);
  font-size: 0.74rem;
  font-weight: 800;
}

.cd-select {
  height: 24px;
  padding: 0 6px;
  border: 1px solid var(--classic-border);
  border-radius: 2px;
  background: var(--classic-panel);
  color: var(--classic-text);
  font-size: 0.74rem;
  font-weight: 720;
}

.cd-refresh {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 24px;
  border: 1px solid var(--classic-border);
  border-radius: 2px;
  background: var(--classic-panel);
  color: var(--classic-text);
}

.chart-title {
  margin-left: auto;
  color: var(--classic-text);
  font-size: 0.78rem;
  font-weight: 820;
}

.chart-canvas {
  min-height: 200px;
}

.chart-state {
  display: grid;
  place-items: center;
  min-height: 200px;
  color: var(--classic-title-muted);
  font-size: 0.78rem;
  font-weight: 720;
}

.side-panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 124px;
  gap: 10px;
  align-content: start;
}

.panel h4 {
  display: grid;
  place-items: center;
  min-height: 30px;
  margin: 0 0 6px;
  background: var(--classic-purple-soft);
  color: var(--accent-deep);
  font-size: 0.82rem;
  font-weight: 840;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}

.metric-btn {
  min-height: 30px;
  padding: 0 4px;
  border: 1px solid var(--classic-border);
  border-radius: var(--classic-radius);
  background: #eef1f5;
  color: var(--classic-text);
  font-size: 0.74rem;
  font-weight: 740;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.metric-btn:hover:not(.active):not(.disabled) {
  background: var(--classic-row-hover);
  border-color: var(--classic-green);
  color: var(--classic-green);
}

.metric-btn.active {
  background: var(--classic-green);
  border-color: var(--classic-green);
  color: #fff;
  font-weight: 820;
}

.metric-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.detail-grid {
  display: grid;
  gap: 6px;
}

.detail-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 8px;
  border: 1px solid var(--classic-border);
  border-radius: var(--classic-radius);
  font-size: 0.75rem;
  font-weight: 760;
  transition: filter 0.12s ease, border-color 0.12s ease;
}

.detail-btn:hover { filter: brightness(0.96); }

.detail-btn.grey { background: #e7ebf0; color: #46586c; }
.detail-btn.green { background: var(--classic-green-soft); color: #2d7e64; }
.detail-btn.blue { background: var(--classic-blue-soft); color: #2e6b93; }

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.dark .metric-btn,
.dark .detail-btn.grey {
  background: var(--surface);
  color: var(--classic-text);
}

@media (max-width: 1080px) {
  .classic-chart-area {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
