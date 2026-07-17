<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'
import type { RouteLocationRaw } from 'vue-router'
import type { ChartPoint } from '~/types/market'
import { isRateLimitedError } from '~/utils/apiError'
import { canUseJcData } from '~/utils/membership'
import { withMatchListContext } from '~/utils/matchNavigation'

type TradeDirection = 'home' | 'draw' | 'away'
type SeriesSelection = TradeDirection | 'all' | null

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
  defaultTradeSelection?: TradeDirection
  showJc?: boolean
}>(), {
  sport: 'football',
  defaultTradeSelection: 'home',
  showJc: false,
})

const eventIdRef = computed(() => props.eventId)
const route = useRoute()
const isBasket = computed(() => props.sport === 'basketball')
const basePath = computed(() => `/${props.sport}`)
const { entitlements, user } = useAuth()
const canViewJc = computed(() => canUseJcData(user.value))
// 篮球走势矩阵按钮更少 → 右侧标签组更矮;竞彩足球多一行明细入口,走势图同步补足 30px 按钮 + 6px 间距。
const chartHeight = computed(() => (isBasket.value ? 180 : props.showJc && canViewJc.value ? 276 : 240))
const canViewScoreMarkets = computed(() =>
  entitlements.value?.csData === true && entitlements.value?.correctScoreIndex === true)

// 默认「成交」走势图(tradeflow);chart=走势图 / tips=重大成交提示(点「← 重大成交」切换)
const view = ref<'tips' | 'chart'>('chart')

const market = ref('standard')
const metric = ref('tradeflow')
const timeRange = ref('6h')
const seriesOnly = ref<SeriesSelection>(props.defaultTradeSelection)
const lastTradeSeries = ref<Exclude<SeriesSelection, null>>(props.defaultTradeSelection)
const userPickedSeries = ref(false)

// 渲染类别:traded(成交系=成交柱 + 价位线全高叠加) / ratio(比例=百分比堆叠面积) / line(其余=纯折线)
const chartKind = computed<'traded' | 'ratio' | 'line'>(() =>
  metric.value === 'tradeflow' ? 'traded' : metric.value === 'ratio' ? 'ratio' : 'line')
const graphType = computed(() => `${market.value}.${metric.value}`)
// 成交系(成交/进球成交/让分成交)统一走后端 .traded(全方向成交柱 + 主/平/客价位),柱线在同区双轴全高叠加。
const chartType = computed(() => (chartKind.value === 'traded' ? `${market.value}.traded` : graphType.value))

const RANGE_HOURS: Record<string, number> = { '3h': 3, '6h': 6, '12h': 12, '24h': 24 }
const FULL_RANGE_HOURS = 14 * 24
const timeOptions = [
  { label: '3小时', value: '3h' },
  { label: '6小时', value: '6h' },
  { label: '12小时', value: '12h' },
  { label: '24小时', value: '24h' },
  { label: '全部', value: 'all' },
]
const chartHoursBack = computed(() => timeRange.value === 'all' ? FULL_RANGE_HOURS : RANGE_HOURS[timeRange.value])
const chartExtraQuery = computed(() => {
  const query: Record<string, string | number> = {}
  if ((market.value === 'asianindex' || metric.value === 'exchange') && chartHoursBack.value)
    query.hoursBack = chartHoursBack.value
  if (metric.value === 'exchange')
    query.granularity = 'raw'
  return query
})

// 「全部」时间段点数可达数千,折线糊成一团 + 圆点云遮挡。超过上限按桶均值抽稀到 ~240 点,
// 既保留趋势形状又去抖动;首尾保留真实时间点,端点不被桶中点偏移。0 视作缺失(payout 例外,0/负有意义)。
const MAX_CHART_POINTS = 240
function aggregateBucket(src: ChartPoint[], s: number, e: number, zeroMissing: boolean): ChartPoint {
  const mid = src[Math.floor((s + e - 1) / 2)] ?? src[s]!
  const avg = (pick: (p: ChartPoint) => number | undefined, skipZero: boolean): number => {
    let sum = 0
    let cnt = 0
    for (let i = s; i < e; i++) {
      const v = pick(src[i]!)
      if (v == null || !Number.isFinite(v) || (skipZero && v === 0)) continue
      sum += v
      cnt++
    }
    return cnt ? sum / cnt : 0
  }
  return {
    time: mid.time,
    ts: mid.ts,
    home: avg(p => p.home, zeroMissing),
    draw: avg(p => p.draw, zeroMissing),
    away: avg(p => p.away, zeroMissing),
    volume: avg(p => p.volume, false),
    priceHome: avg(p => p.priceHome, true),
    priceDraw: avg(p => p.priceDraw, true),
    priceAway: avg(p => p.priceAway, true),
  }
}
function downsamplePoints(src: ChartPoint[], cap: number, zeroMissing: boolean): ChartPoint[] {
  if (src.length <= cap) return src
  const out: ChartPoint[] = []
  const size = src.length / cap
  for (let b = 0; b < cap; b++) {
    const s = Math.floor(b * size)
    const e = Math.min(src.length, Math.floor((b + 1) * size))
    if (e > s) out.push(aggregateBucket(src, s, e, zeroMissing))
  }
  const first = src[0]!
  const last = src[src.length - 1]!
  if (out.length) {
    out[0] = { ...out[0]!, ts: first.ts, time: first.time }
    out[out.length - 1] = { ...out[out.length - 1]!, ts: last.ts, time: last.time }
  }
  return out
}

// 框选缩放窗口(优先于时间段下拉);为空时走时间段过滤。
const zoomWindow = ref<{ start: string, end: string } | null>(null)

const baseline = computed<number | null>(() => {
  if (metric.value === 'payout') return 60
  if (metric.value === 'hotcold') return 0
  return null
})
// 成交系=成交柱(全方向);比例=堆叠面积、其余=折线,均无柱。
const barMode = computed(() => chartKind.value === 'traded')
const showTooltipVolume = computed(() => metric.value === 'tradeflow' || metric.value === 'traded' || metric.value === 'volume')
// 成交系选「所有」→ 主/平/客三条价位线;单方向→单条价位线。
const multiPrice = computed(() => chartKind.value === 'traded' && seriesOnly.value === 'all')
// 仅成交系有方向下拉(所有/主/平/客);比例与折线默认全部方向同呈现。
const hasDirection = computed(() => chartKind.value === 'traded')
// StaticTrendChart 的 only:成交系单方向取该方向,「所有」=null(全方向柱+多价位);非成交系恒 null(全部序列)。
const trendOnly = computed<TradeDirection | null>(() =>
  (chartKind.value === 'traded' && seriesOnly.value && seriesOnly.value !== 'all') ? seriesOnly.value : null)

// 成交系 + 只看单方向(主/客/平)→ 切「成交明细」:买/卖/买+/卖+/冲/换 attr 拆分 + 单价位线。
// 后端 tradeflow 已用整盘口记录补完整时间网格，单方向不会再因为只看目标 selection 而稀疏。
const isTradeFlowDetail = computed(() => trendOnly.value !== null)
const needsSeriesChart = computed(() => view.value === 'chart' && !isTradeFlowDetail.value)
const { points, status, pending, refresh, metricLabel, unit, seriesLabels, loadedType, error: chartError } = useChartSeries(
  eventIdRef,
  chartType,
  chartExtraQuery,
  needsSeriesChart,
)
// 已加载数据是否对应当前请求类型;切指标时旧数据 type 不匹配 → 先显「加载中」,不渲染陈旧序列。
const chartReady = computed(() => loadedType.value === chartType.value)

const displayPoints = computed(() => {
  const all = points.value
  let windowed = all
  if (zoomWindow.value) {
    const { start, end } = zoomWindow.value
    const z = all.filter(p => p.ts && p.ts >= start && p.ts <= end)
    windowed = z.length >= 2 ? z : all
  }
  else {
    const h = RANGE_HOURS[timeRange.value]
    const lastTs = all.at(-1)?.ts
    if (h && all.length > 0 && lastTs) {
      const cutoff = new Date(lastTs).getTime() - h * 3600_000
      windowed = all.filter(p => p.ts && new Date(p.ts).getTime() >= cutoff)
    }
  }
  return downsamplePoints(windowed, MAX_CHART_POINTS, unit.value !== 'payout')
})

function onZoom(range: { start: string, end: string }) { zoomWindow.value = range }
function resetZoom() { zoomWindow.value = null }
// 切时间段 / 切指标 / 切方向 → 清缩放(避免 ts 窗口对不上新序列);轮询刷新不清,保持缩放。
watch([timeRange, chartType, seriesOnly], () => { zoomWindow.value = null })

const directionLabels = computed(() => {
  if (market.value === 'goals') return { home: '大', draw: null, away: '小' }
  if (isBasket.value) return { home: '主', draw: null, away: '客' }
  return { home: '主', draw: '平', away: '客' }
})
const normalizedDefaultTradeSelection = computed<TradeDirection>(() =>
  props.defaultTradeSelection === 'draw' && !directionLabels.value.draw ? 'home' : props.defaultTradeSelection)

// 仅成交系保留方向；默认按该场标准盘成交额最大单项，用户手动改过后保留用户选择。
watch(hasDirection, (on) => {
  seriesOnly.value = on
    ? (userPickedSeries.value ? lastTradeSeries.value : normalizedDefaultTradeSelection.value)
    : null
}, { immediate: true })
watch(normalizedDefaultTradeSelection, (next) => {
  if (userPickedSeries.value || !hasDirection.value) return
  lastTradeSeries.value = next
  seriesOnly.value = next
})
watch(directionLabels, (l) => {
  if (seriesOnly.value === 'draw' && !l.draw) {
    seriesOnly.value = 'home'
    if (lastTradeSeries.value === 'draw') lastTradeSeries.value = 'home'
  }
})
function onSeriesOnlyChange() {
  userPickedSeries.value = true
  if (seriesOnly.value) lastTradeSeries.value = seriesOnly.value
}

const seriesOptions = computed(() => {
  const l = directionLabels.value
  const opts: { label: string, value: 'home' | 'draw' | 'away' | 'all' }[] = [
    { label: '所有', value: 'all' },
    { label: `只看${l.home}`, value: 'home' },
  ]
  if (l.draw) opts.push({ label: `只看${l.draw}`, value: 'draw' })
  if (l.away) opts.push({ label: `只看${l.away}`, value: 'away' })
  return opts
})

const chartRateLimited = computed(() => isRateLimitedError(chartError.value))
const statusLabel = computed(() => {
  if (chartRateLimited.value) return '请求过于频繁，请稍后刷新'
  if (status.value === 'no-access') return '当前会籍未开放此走势'
  if (status.value === 'pending') return '此场赛事暂无该市场数据'
  return null
})
const chartTitle = computed(() => {
  if (chartKind.value === 'traded') return market.value === 'handicap' ? '让分成交' : market.value === 'goals' ? '进球成交' : '成交'
  const active = metricButtons.value.find(b => b.market === market.value && b.metric === metric.value)
  if (active) {
    // 标盘「指数」沿用后端更完整的「必发指数」标题；其它跨盘口复用指标必须显示按钮文案，
    // 例如「进球指数 / 让分指数 / 欧洲平均」，避免图表已切换但标题仍是通用 metricLabel。
    if (active.market === 'standard' && active.metric === 'bfindex') return metricLabel.value || '必发指数'
    return active.label
  }
  return metricLabel.value || '走势'
})

// ── 重大成交提示(默认视图)──
const needsBigTrades = computed(() => view.value === 'tips')
const { data: btData, group: bigGroup, pending: btPending } = useBigTrades(eventIdRef, 6, needsBigTrades)
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
  { label: '进球盈亏', market: 'goals', metric: 'payout' },
  { label: '让分成交', market: 'handicap', metric: 'tradeflow' },
  { label: '让分指数', market: 'handicap', metric: 'bfindex' },
  { label: '让分比例', market: 'handicap', metric: 'ratio' },
  { label: '让分价位', market: 'handicap', metric: 'odds' },
  { label: '让分挂牌', market: 'handicap', metric: 'exchange' },
  { label: '进球均衡', market: 'goals', metric: 'balance' },
  { label: '亚洲指数', market: 'asianindex', metric: 'index' },
  { label: '比分指数', market: 'correctscore', metric: 'bfindex' },
]
// 篮球走势矩阵对齐旧站:去掉 凯利/欧洲平均(euro,无博彩数据)、冷热、进球均衡(balance)、
// 亚洲指数(足球专属,源 Win007 亚盘+欧赔;篮球用亚盘让球/总分)。保留 标盘/进球/让分 各指标。
const metricButtons = computed<MetricBtn[]>(() => {
  let buttons = allMetricButtons
  if (isBasket.value) {
    buttons = buttons.filter(b =>
      b.market !== 'euro' && b.market !== 'correctscore' && b.market !== 'asianindex'
      && b.metric !== 'hotcold' && b.metric !== 'balance')
  }
  if (!canViewScoreMarkets.value)
    buttons = buttons.filter(b => b.market !== 'correctscore')
  return buttons
})

watch(canViewScoreMarkets, (canView) => {
  if (!canView && market.value === 'correctscore') {
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

const tradeFlowRefreshKey = ref(0)
function refreshChart() {
  if (isTradeFlowDetail.value) tradeFlowRefreshKey.value++
  else refresh()
}

// 经典版「明细图表」入口(还原旧站),按运动分流:
// 足球:明细 / 进球明细 / 比分明细 / 欧洲指数 / 竞彩 / 标盘 / 进球 / 正确比分;
// 篮球:明细 / 大球明细 / 小球明细 / 标盘 / 进球(2-way、总分大小;无欧赔/比分/正确比分)。
interface DetailBtn {
  label: string
  to: RouteLocationRaw
  tone: 'grey' | 'green' | 'purple' | 'blue'
  newPage?: boolean
  isNew?: boolean
}
const detailButtons = computed<DetailBtn[]>(() => {
  const base = `${basePath.value}/${props.eventId}`
  const to = (suffix: string, extra: Record<string, string> = {}) =>
    withMatchListContext(`${base}${suffix}`, route.query, extra)
  if (isBasket.value) {
    return [
      { label: '明细', to: to('/detail'), tone: 'grey' },
      { label: '大球明细', to: to('/detail', { market: 'goals', side: 'over' }), tone: 'grey' },
      { label: '小球明细', to: to('/detail', { market: 'goals', side: 'under' }), tone: 'grey' },
      { label: '标盘', to: to('/ladder', { market: 'standard' }), tone: 'blue' },
      { label: '进球', to: to('/ladder', { market: 'goals' }), tone: 'blue' },
    ]
  }
  const buttons: DetailBtn[] = [
    { label: '明细', to: to('/detail'), tone: 'grey' },
    { label: '进球明细', to: to('/detail', { market: 'goals' }), tone: 'grey' },
    { label: '欧洲指数', to: to('/euro-odds'), tone: 'green' },
  ]
  if (props.showJc && canViewJc.value) {
    buttons.push({ label: '竞彩', to: to('', { tab: 'jc' }), tone: 'purple', newPage: true, isNew: true })
  }
  buttons.push(
    { label: '标盘', to: to('/ladder', { market: 'standard' }), tone: 'blue' },
    { label: '进球', to: to('/ladder', { market: 'goals' }), tone: 'blue' },
  )
  if (canViewScoreMarkets.value) {
    buttons.splice(2, 0, { label: '比分明细', to: to('/correct-score'), tone: 'grey' })
    buttons.push({ label: '正确比分', to: to('/ladder', { market: 'cs' }), tone: 'blue' })
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
          <select v-if="hasDirection" v-model="seriesOnly" class="cd-select" aria-label="方向筛选" @change="onSeriesOnlyChange">
            <option v-for="o in seriesOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <button type="button" class="cd-refresh" :disabled="!isTradeFlowDetail && pending" aria-label="刷新" @click="refreshChart">
            <RefreshCw :size="13" :class="{ spinning: !isTradeFlowDetail && pending }" />
          </button>
          <button v-if="zoomWindow" type="button" class="cd-reset" aria-label="还原缩放" @click="resetZoom">还原</button>
          <span v-else class="cd-hint">拖动框选可放大</span>
          <span class="chart-title num">{{ chartTitle }}走势图</span>
        </div>

        <div class="chart-canvas" :style="{ '--cc-h': `${chartHeight}px` }">
          <!-- 单方向成交图保留旧站成交属性柱：买/卖/冲/买+/卖+/换 + 单价位线。 -->
          <ClassicTradeFlowPanel
            v-if="isTradeFlowDetail"
            :event-id="eventId"
            :market="market"
            :selection="seriesOnly || 'home'"
            :time-range="timeRange"
            :height="chartHeight"
            :refresh-key="tradeFlowRefreshKey"
            :zoom-window="zoomWindow"
            @zoom="onZoom"
            @reset="resetZoom"
          />
          <div v-else-if="statusLabel" class="chart-state">{{ statusLabel }}</div>
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
              :show-volume="showTooltipVolume"
              :height="chartHeight"
              zoomable
              @zoom="onZoom"
              @reset="resetZoom"
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
          <NuxtLink
            v-for="b in detailButtons"
            :key="b.label"
            :to="b.to"
            :class="['detail-btn', b.tone]"
            :target="b.newPage ? '_blank' : undefined"
            :rel="b.newPage ? 'noopener' : undefined"
          >
            <span>{{ b.label }}</span>
            <strong v-if="b.isNew" class="detail-new">New!</strong>
          </NuxtLink>
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

.cd-reset {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--classic-green);
  border-radius: 2px;
  background: var(--classic-green-soft);
  color: #2d7e64;
  font-size: 0.74rem;
  font-weight: 800;
}

.cd-hint {
  color: var(--classic-title-muted);
  font-size: 0.7rem;
  font-weight: 700;
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
  gap: 5px;
}

.detail-new {
  color: #dc2f45;
  font-size: 0.64rem;
  font-weight: 900;
  line-height: 1;
}

.detail-btn:hover { filter: brightness(0.96); }

.detail-btn.grey { background: #e7ebf0; color: #46586c; }
.detail-btn.green { background: var(--classic-green-soft); color: #2d7e64; }
.detail-btn.purple { background: var(--classic-purple-soft); color: var(--accent-deep); }
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
