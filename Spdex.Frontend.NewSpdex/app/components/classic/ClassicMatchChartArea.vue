<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'
import type { RouteLocationRaw } from 'vue-router'

/**
 * 经典工作台内嵌走势区(还原旧站 dcon):
 * - 默认「重大成交提示」(标准盘 + 大小球大单列表,来自 useBigTrades);
 * - 点右侧「走势图表」指标矩阵 → 切到对应走势图(useChartSeries,与详情页同一真实通道):成交系=柱+价位线叠加 / 比例=堆叠面积 / 其余=折线;
 * - 「明细图表」走真实详情路由 / 就地切图。
 * 仅在赛事块滚入视口后由父组件 v-if 挂载,此时才发起这些请求。
 */
const props = withDefaults(defineProps<{
  eventId: number
  homeTeam: string
  awayTeam: string
  detailTo: RouteLocationRaw
  sport?: 'football' | 'basketball'
}>(), {
  sport: 'football',
})

const eventIdRef = computed(() => props.eventId)
const isBasket = computed(() => props.sport === 'basketball')
const basePath = computed(() => `/${props.sport}`)
// 篮球走势矩阵按钮更少 → 右侧标签组更矮;走势图相应压低,与右侧高度看齐。足球保持 240。
const chartHeight = computed(() => (isBasket.value ? 180 : 240))
const { entitlements } = useAuth()
const canViewScoreMarkets = computed(() =>
  entitlements.value?.csData === true && entitlements.value?.correctScoreIndex === true)

// 默认「成交」走势图(tradeflow);chart=走势图 / tips=重大成交提示(点「← 重大成交」切换)
const view = ref<'tips' | 'chart'>('chart')

const market = ref('standard')
const metric = ref('tradeflow')
const timeRange = ref('6h')
const seriesOnly = ref<'home' | 'draw' | 'away' | 'all' | null>('all')

// 渲染类别:traded(成交系=成交柱 + 价位线全高叠加) / ratio(比例=百分比堆叠面积) / line(其余=纯折线)
const chartKind = computed<'traded' | 'ratio' | 'line'>(() =>
  metric.value === 'tradeflow' ? 'traded' : metric.value === 'ratio' ? 'ratio' : 'line')
const graphType = computed(() => `${market.value}.${metric.value}`)
// 成交系(成交/进球成交/让分成交)统一走后端 .traded(全方向成交柱 + 主/平/客价位),柱线在同区双轴全高叠加。
const chartType = computed(() => (chartKind.value === 'traded' ? `${market.value}.traded` : graphType.value))
const { points, status, pending, refresh, metricLabel, unit, seriesLabels, loadedType } = useChartSeries(eventIdRef, chartType)
// 已加载数据是否对应当前请求类型;切指标时旧数据 type 不匹配 → 先显「加载中」,不渲染陈旧序列。
const chartReady = computed(() => loadedType.value === chartType.value)

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
// 成交系=成交柱(全方向);比例=堆叠面积、其余=折线,均无柱。
const barMode = computed(() => chartKind.value === 'traded')
// 成交系选「所有」→ 主/平/客三条价位线;单方向→单条价位线。
const multiPrice = computed(() => chartKind.value === 'traded' && seriesOnly.value === 'all')
// 仅成交系有方向下拉(所有/主/平/客);比例与折线默认全部方向同呈现。
const hasDirection = computed(() => chartKind.value === 'traded')
// StaticTrendChart 的 only:成交系单方向取该方向,「所有」=null(全方向柱+多价位);非成交系恒 null(全部序列)。
const trendOnly = computed<'home' | 'draw' | 'away' | null>(() =>
  (chartKind.value === 'traded' && seriesOnly.value && seriesOnly.value !== 'all') ? seriesOnly.value : null)

// 仅成交系保留方向(默认「所有」=柱线全高叠加);其余指标 seriesOnly 置 null。
watch(hasDirection, (on) => { seriesOnly.value = on ? (seriesOnly.value ?? 'all') : null }, { immediate: true })
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
const chartTitle = computed(() => {
  if (chartKind.value === 'traded') return market.value === 'handicap' ? '让分成交' : market.value === 'goals' ? '进球成交' : '成交'
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
const allMetricButtons: MetricBtn[] = [
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
  { label: '进球均衡', market: 'goals', metric: 'balance' },
  { label: '亚洲指数', market: 'asianindex', metric: 'index' },
  { label: '比分指数', market: 'cs', metric: 'bfindex' },
]
// 篮球走势矩阵对齐旧站:去掉 凯利/欧洲平均(euro,无博彩数据)、比分指数(cs)、冷热、进球均衡(balance)、
// 亚洲指数(足球专属,源 Win007 亚盘+欧赔;篮球用亚盘让球/总分)。保留 标盘/进球/让分 各指标。
const metricButtons = computed<MetricBtn[]>(() => {
  let buttons = allMetricButtons
  if (isBasket.value) {
    buttons = buttons.filter(b =>
      b.market !== 'euro' && b.market !== 'cs' && b.market !== 'asianindex'
      && b.metric !== 'hotcold' && b.metric !== 'balance')
  }
  if (!canViewScoreMarkets.value)
    buttons = buttons.filter(b => b.market !== 'cs')
  return buttons
})

watch(canViewScoreMarkets, (canView) => {
  if (!canView && market.value === 'cs') {
    market.value = 'standard'
    metric.value = 'tradeflow'
  }
}, { immediate: true })

function pickMetric(b: MetricBtn) {
  if (b.disabled) return
  market.value = b.market
  metric.value = b.metric
  view.value = 'chart'
}
function isActive(b: MetricBtn) {
  return view.value === 'chart' && !b.disabled && market.value === b.market && metric.value === b.metric
}

// 由父级「交易所重大成交提示」标题点击触发,切回重大成交提示视图(替代原图表区「← 重大成交」按钮)。
function showTips() { view.value = 'tips' }
defineExpose({ showTips })

// 经典版「明细图表」入口(还原旧站),按运动分流:
// 足球:明细 / 进球明细 / 比分明细 / 欧洲指数 / 标盘 / 进球 / 正确比分;
// 篮球:明细 / 大球明细 / 小球明细 / 标盘 / 进球(2-way、总分大小;无欧赔/比分/正确比分)。
interface DetailBtn { label: string, to: string, tone: 'grey' | 'green' | 'blue' }
const detailButtons = computed<DetailBtn[]>(() => {
  const base = `${basePath.value}/${props.eventId}`
  if (isBasket.value) {
    return [
      { label: '明细', to: `${base}/detail`, tone: 'grey' },
      { label: '大球明细', to: `${base}/detail?market=goals&side=over`, tone: 'grey' },
      { label: '小球明细', to: `${base}/detail?market=goals&side=under`, tone: 'grey' },
      { label: '标盘', to: `${base}/ladder?market=standard`, tone: 'blue' },
      { label: '进球', to: `${base}/ladder?market=goals`, tone: 'blue' },
    ]
  }
  const buttons: DetailBtn[] = [
    { label: '明细', to: `${base}/detail`, tone: 'grey' },
    { label: '进球明细', to: `${base}/detail?market=goals`, tone: 'grey' },
    { label: '欧洲指数', to: `${base}/euro-odds`, tone: 'green' },
    { label: '标盘', to: `${base}/ladder?market=standard`, tone: 'blue' },
    { label: '进球', to: `${base}/ladder?market=goals`, tone: 'blue' },
  ]
  if (canViewScoreMarkets.value) {
    buttons.splice(2, 0, { label: '比分明细', to: `${base}/correct-score`, tone: 'grey' })
    buttons.push({ label: '正确比分', to: `${base}/ladder?market=cs`, tone: 'blue' })
  }
  return buttons
})
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
          <select v-model="timeRange" class="cd-select" aria-label="时间段">
            <option v-for="o in timeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <select v-if="hasDirection" v-model="seriesOnly" class="cd-select" aria-label="方向筛选">
            <option v-for="o in seriesOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <button type="button" class="cd-refresh" :disabled="pending" aria-label="刷新" @click="refresh()">
            <RefreshCw :size="13" :class="{ spinning: pending }" />
          </button>
          <span class="chart-title num">{{ chartTitle }}走势图</span>
        </div>

        <div class="chart-canvas" :style="{ '--cc-h': `${chartHeight}px` }">
          <div v-if="statusLabel" class="chart-state">{{ statusLabel }}</div>
          <div v-else-if="!chartReady" class="chart-state">加载中…</div>
          <template v-else-if="displayPoints.length">
            <!-- 比例 → 百分比堆叠面积图;成交系/折线 → StaticTrendChart(成交=柱+价位线全高叠加,其余=纯折线) -->
            <LazyStackedRatioChart
              v-if="chartKind === 'ratio'"
              :points="displayPoints"
              :series-labels="seriesLabels"
              :height="chartHeight"
            />
            <LazyStaticTrendChart
              v-else
              :points="displayPoints"
              :series-labels="seriesLabels"
              :unit="unit"
              :only="trendOnly"
              :baseline="baseline"
              :bar-mode="barMode"
              :multi-price="multiPrice"
              :height="chartHeight"
            />
          </template>
          <div v-else class="chart-state">暂无走势数据</div>
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
          <NuxtLink v-for="b in detailButtons" :key="b.label" :to="b.to" :class="['detail-btn', b.tone]">{{ b.label }}</NuxtLink>
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
  /* #7 两个按钮区(走势图表/明细图表)标题下加分隔线,便于定位不同数据(复刻旧站 section 分隔)。 */
  border-bottom: 2px solid var(--classic-green);
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
  font-weight: 520;
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
  font-weight: 640;
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
  font-weight: 520;
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
