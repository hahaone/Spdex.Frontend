<script setup lang="ts">
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Database,
  LockKeyhole,
  ShieldAlert,
  Table2,
} from '@lucide/vue'
import type { GoodSampleMatchChoice, GoodSampleResponse } from '~/types/good-sample'

const props = defineProps<{ response: GoodSampleResponse }>()
const emit = defineEmits<{
  selectMatch: [match: GoodSampleMatchChoice]
}>()

type JsonRecord = Record<string, unknown>

const data = computed(() => record(props.response.data))
const presentation = computed(() => record(data.value.presentation))
const matches = computed(() => array(data.value.matches).map(record))
const snapshot = computed(() => record(data.value.snapshot))
const snapshotMatch = computed(() => record(snapshot.value.match))
const marketSections = computed(() => Object.entries(record(snapshot.value.markets))
  .filter(([, value]) => value && typeof value === 'object')
  .map(([key, value]) => {
    const section = record(value)
    return {
      key,
      section,
      rows: array(section.rows).map(record),
    }
  })
  .filter(market => market.rows.length > 0))
const points = computed(() => array(data.value.points).slice(-12).map(record))
const seriesColumns = computed(() => {
  const columns = array(presentation.value.series_columns)
    .map(record)
    .map(column => ({
      key: text(column.key, ''),
      label: text(column.label, ''),
      unit: text(column.unit, ''),
    }))
    .filter(column => column.key && column.label)
  return columns.length ? columns : [
    { key: 'home', label: '主', unit: '' },
    { key: 'draw', label: '平', unit: '' },
    { key: 'away', label: '客', unit: '' },
    { key: 'volume', label: '成交', unit: '' },
  ]
})
const seriesGridStyle = computed(() => ({
  gridTemplateColumns: `minmax(145px, 1.5fr) ${seriesColumns.value.map(() => 'minmax(72px, 1fr)').join(' ')}`,
  minWidth: `${145 + seriesColumns.value.length * 86}px`,
}))
const anomalies = computed(() => array(data.value.anomalies).map(record))
const missingFields = computed(() => array(data.value.missing_fields).map(value => String(value)))
const missingFieldLabels = computed(() => uniqueTexts(missingFields.value.map(missingFieldLabel)))
const lockedPermissions = computed(() => Object.entries(record(data.value.permissions))
  .filter(([, value]) => value === false)
  .map(([key]) => key))
const metric = computed(() => {
  const nested = record(data.value.metric)
  return Object.keys(nested).length ? nested : data.value
})
const evidence = computed(() => record(data.value.evidence))
const evidenceSources = computed(() => uniqueTexts([
  evidence.value.source_label,
  sourceLabel(text(evidence.value.source_endpoint, '')),
  ...array(evidence.value.sources).map(item => sourceLabel(text(item, ''))),
]).filter(item => item !== 'SPdex 结构化数据'))
const evidenceFields = computed(() => uniqueTexts([
  ...array(evidence.value.source_inputs),
  ...array(evidence.value.ranking_inputs),
  ...array(data.value.evidence_sections),
].map(value => evidenceFieldLabel(String(value))).filter(Boolean)))
const bigTradeGroups = computed(() => array(data.value.groups)
  .map((value) => {
    const group = record(value)
    return {
      key: text(group.key, ''),
      label: text(group.label, text(group.market_label, '成交分组')),
      marketLabel: text(group.market_label, label(text(group.market, ''))),
      total: group.total,
      tradeCount: number(group.trade_count),
      trades: array(group.trades).map(record).filter(trade => Object.keys(trade).length > 0),
    }
  })
  .filter(group => group.trades.length > 0))
const bigTradeSummary = computed(() => record(data.value.summary))
const largestTrade = computed(() => record(bigTradeSummary.value.largest_trade))
const dominantBigTradeGroup = computed(() => record(bigTradeSummary.value.dominant_group))
const bigTradeInsight = computed(() => {
  const tradeCount = number(bigTradeSummary.value.trade_count)
  if (!tradeCount) {
    return {
      tone: 'neutral',
      title: '未发现明显的大额交易',
      description: '当前窗口没有返回达到重大成交阈值的交易记录。',
      details: ['这不等于比赛没有变化，只表示当前重大成交数据里没有可引用的大单证据。'],
    }
  }

  const maxShareRaw = number(bigTradeSummary.value.max_share)
  const maxShare = maxShareRaw > 1 ? maxShareRaw / 100 : maxShareRaw
  const highlight = number(largestTrade.value.highlight)
  const title = highlight >= 2 || maxShare >= 0.2
    ? '有明显的大额交易信号'
    : highlight >= 1 || maxShare >= 0.1
      ? '有值得关注的大额交易'
      : '有成交记录，但暂未构成明显大额交易'
  const tone = highlight >= 2 || maxShare >= 0.2
    ? 'strong'
    : highlight >= 1 || maxShare >= 0.1
      ? 'watch'
      : 'neutral'
  const details: string[] = []

  if (Object.keys(largestTrade.value).length) {
    details.push([
      `最大单笔出现在${text(largestTrade.value.group_label, '成交分组')}`,
      `${selectionLabel(largestTrade.value.selection)}方向`,
      `成交量 ${fieldValue('amount', largestTrade.value.amount)}`,
      `价位 ${fieldValue('price', largestTrade.value.price)}`,
      `交易时占比 ${fieldValue('share', largestTrade.value.share)}`,
    ].join('，'))
  }

  if (Object.keys(dominantBigTradeGroup.value).length) {
    details.push(
      `成交最集中的分组是${text(dominantBigTradeGroup.value.label, '主要分组')}，共 ${fieldValue('amount', dominantBigTradeGroup.value.amount)}。`,
    )
  }

  details.push('判断依据是单笔成交量、交易时占比和分组集中度，只用于市场观察，不代表赛果判断。')

  return {
    tone,
    title,
    description: `本次共识别 ${tradeCount} 笔重大成交，累计成交量 ${fieldValue('amount', bigTradeSummary.value.total_trade_amount)}。`,
    details,
  }
})
const dataCutoff = computed(() => text(data.value.data_cutoff_at, props.response.generatedAt))

const isMatchList = computed(() => ['search_matches', 'get_top_matches'].includes(props.response.tool))
const isSnapshot = computed(() => props.response.tool === 'get_match_snapshot')
const isSeries = computed(() => ['get_market_series', 'get_market_metric_series'].includes(props.response.tool))
const isAnomaly = computed(() => props.response.tool === 'detect_market_anomalies')
const isBigTrades = computed(() => props.response.tool === 'get_big_trades')
const isMetric = computed(() => props.response.tool === 'explain_metric')

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {}
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) return value.length ? value.map(item => text(item, '')).join(' / ') : fallback
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function number(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function label(key: string): string {
  return knownLabel(key) || fallbackLabel(key)
}

function knownLabel(key: string): string {
  const normalized = normalizeKey(key)
  const labels: Record<string, string> = {
    key: '选项',
    standard: '标盘',
    poly: '预测市场',
    goals: '进球数',
    handicap: '亚洲让球',
    correct_score: '比分',
    corner: '角球',
    jc: '竞彩',
    euro_odds: '欧赔',
    match_odds: '胜平负',
    asian_handicap: '亚洲让球',
    over_under: '大小球',
    trade_volume: '成交量',
    rank_score: '关注分',
    anomaly_score: '异常观察分',
    score_label: '分数口径',
    score_meaning: '分数含义',
    status_label: '比赛状态',
    market_label: '市场',
    display_flags: '信号标签',
    rank_reason_labels: '入选原因',
    reason_labels: '观察原因',
    home: '主',
    draw: '平',
    away: '客',
    over: '大',
    under: '小',
    line: '盘口线',
    volume: '成交量',
    selection: '方向',
    direction: '方向',
    price: '价格',
    index: '指数',
    amount: '成交',
    price_home: '主胜价',
    price_draw: '平局价',
    price_away: '客胜价',
    time: '时间',
    bf_amount: '必发成交量',
    poly_amount: 'POLY 成交量',
    bf_index: '必发指数',
    poly_index: 'POLY 指数',
    turnover: '成交量',
    bfindex: '必发指数',
    polyindex: 'POLY 指数',
    ratio: '成交占比',
    pnl: '盈亏倾向',
    listing: '挂单占比',
    heat: '热度',
    euroavg: '欧赔均值',
    variance: '偏离值',
    matchtime: '比赛时间',
    leaguename: '联赛',
    leaguecode: '联赛',
    hometeam: '主队',
    awayteam: '客队',
    p_mark: 'P 指标',
    share: '成交占比',
    side: '成交属性',
    side_label: '成交属性',
    highlight: '占比提示',
    highlight_label: '占比提示',
    group_label: '成交分组',
  }
  return labels[key] || labels[normalized] || ''
}

function fallbackLabel(key: string): string {
  const raw = text(key, '').trim()
  if (!raw) return '指标'
  return /^[a-z0-9_:-]+$/i.test(raw) ? '指标' : raw
}

function fieldHint(key: string): string {
  const hints: Record<string, string> = {
    key: '市场选项，例如主胜、平局、客胜、大球或小球。',
    direction: '该行对应的投注或交易方向。',
    price: '当前可观察到的价格或赔率。',
    turnover: '该方向的成交活跃度，用于观察市场关注集中在哪里。',
    bfIndex: '必发市场指数，数值越高说明该方向资金或成交更集中。',
    bf_index: '必发市场指数，数值越高说明该方向资金或成交更集中。',
    polyIndex: '外部预测市场指数，用于对照 SPdex 内部市场信号。',
    poly_index: '外部预测市场指数，用于对照 SPdex 内部市场信号。',
    ratio: '该方向成交量占当前市场总成交量的比例。',
    pnl: '市场盈亏倾向，仅用于观察资金结构，不代表赛果判断。',
    listing: '挂单占比，用于观察盘口深度和可交易性。',
    heat: '综合热度，反映价格、成交和市场活跃度。',
    euroAvg: '欧洲平均赔率，可作为主流盘口基准。',
    variance: '当前价格与参考价格之间的偏离程度。',
    line: '大小球或让球盘口的基准线。',
  }
  return hints[key] || hints[normalizeKey(key)] || ''
}

function normalizeKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replaceAll('-', '_').replaceAll(':', '_').toLowerCase()
}

function fieldValue(key: string, value: unknown): string {
  if (key === 'status') return statusLabel(value)
  if (key === 'key' || key === 'selection' || key === 'direction') return selectionLabel(value)
  if (['ratio', 'listing', 'share', 'share_percent'].includes(normalizeKey(key)) && typeof value === 'number') {
    const percent = value > 0 && value <= 1 ? value * 100 : value
    return `${percent.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}%`
  }
  if (typeof value === 'number') {
    return value.toLocaleString('zh-CN', { maximumFractionDigits: 3 })
  }
  return text(value)
}

function selectionLabel(value: unknown): string {
  const raw = text(value, '')
  const labels: Record<string, string> = {
    home: '主',
    draw: '平',
    away: '客',
    over: '大',
    under: '小',
    line: '盘口',
    yes: '是',
    no: '否',
  }
  return labels[raw.toLowerCase()] || raw || '—'
}

function statusLabel(value: unknown): string {
  const status = text(value, '')
  const labels: Record<string, string> = {
    upcoming: '未开赛',
    started: '进行中',
    live: '进行中',
    finished: '已完场',
    pending: '等待数据',
  }
  return labels[status] || status || '—'
}

function severityLabel(value: unknown): string {
  const severity = text(value, '')
  const labels: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
  }
  return labels[severity] || severity || '观察'
}

function uniqueTexts(values: unknown[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const item = text(value, '').trim()
    if (!item || seen.has(item)) continue
    seen.add(item)
    result.push(item)
  }
  return result
}

function signalLabel(value: unknown): string {
  const raw = text(value, '').trim()
  if (!raw) return ''
  const friendly = reasonLabel(raw)
  if (friendly) return friendly
  return /^[a-z0-9_:-]+$/i.test(raw) ? '' : raw
}

function matchTags(item: JsonRecord): string[] {
  return uniqueTexts([
    ...array(item.rank_reason_labels).map(signalLabel),
    ...array(item.display_flags).map(signalLabel),
    ...array(item.rank_reasons).map(reason => reasonLabel(text(reason, ''))),
    ...array(item.flags).map(signalLabel),
  ]).slice(0, 5)
}

function anomalyReasonList(item: JsonRecord): string[] {
  return uniqueTexts([
    ...array(item.reason_labels).map(signalLabel),
    ...array(item.reasons).map(reason => reasonLabel(text(reason, ''))),
    reasonLabel(text(item.reason, '')),
  ])
}

function anomalyReasons(item: JsonRecord): string {
  return anomalyReasonList(item).join(' · ')
}

function anomalySummary(item: JsonRecord): string {
  const reasons = anomalyReasons(item)
  if (reasons) return reasons
  return '当前市场指标触发异常观察阈值，建议结合盘口、成交量和比赛阶段继续核对。'
}

function reasonLabel(reason: string): string {
  const raw = reason.trim()
  if (!raw) return ''
  if (raw.startsWith('flag:')) return signalLabel(raw.slice(5))
  if (reason.startsWith('p_mark:')) return `P 指标：${reason.slice(7)}`
  const labels: Record<string, string> = {
    live_match: '进行中比赛',
    upcoming_match: '即将开赛',
    bf_amount_available: '必发成交可用',
    poly_amount_available: '预测市场成交可用',
    bf_index_60_plus: '必发指数偏斜较高',
    poly_index_60_plus: '预测市场指数偏斜较高',
    bf_index_high: '必发指数偏斜较高',
    poly_index_high: '预测市场指数偏斜较高',
    prediction_market_index_high: '预测市场指数偏斜较高',
    prediction_market_index_bias_high: '预测市场指数偏斜较高',
    bf_index_bias_high: '必发指数偏斜较高',
    poly_index_bias_high: '预测市场指数偏斜较高',
    bf_trade_amount_high: '必发成交量较高',
    poly_trade_amount_high: '预测市场成交量较高',
    trade_amount_high: '成交量较高',
    big_trade_high_share: '大额交易占比较高',
    large_trade_high_share: '大额交易占比较高',
    market_activity_high: '市场活跃度较高',
    rule_threshold_hit: '规则阈值命中',
  }
  const normalized = normalizeKey(raw)
  const friendly = labels[raw] || labels[normalized]
  if (friendly) return friendly
  return /^[a-z0-9_:-]+$/i.test(raw) ? '' : raw.replaceAll('_', ' ')
}

function matchChoice(item: JsonRecord): GoodSampleMatchChoice {
  return {
    matchId: number(item.match_id ?? item.event_id),
    homeTeam: text(item.home_team, '主队'),
    awayTeam: text(item.away_team, '客队'),
    leagueName: text(item.league_name ?? item.league_code, ''),
    matchTime: text(item.match_time, ''),
  }
}

function selectMatch(item: JsonRecord) {
  const match = matchChoice(item)
  if (match.matchId > 0) emit('selectMatch', match)
}

function rowEntries(row: JsonRecord) {
  return Object.entries(row).filter(([, value]) =>
    value !== null
    && value !== undefined
    && typeof value !== 'object')
}

function rowCells(row: JsonRecord) {
  const preferredOrder = [
    'direction',
    'key',
    'price',
    'line',
    'turnover',
    'bfIndex',
    'polyIndex',
    'ratio',
    'pnl',
    'listing',
    'heat',
    'euroAvg',
    'variance',
  ]
  const orderWeight = (key: string) => {
    const index = preferredOrder.findIndex(item => normalizeKey(item) === normalizeKey(key))
    return index >= 0 ? index : preferredOrder.length + 1
  }
  return rowEntries(row)
    .filter(([key]) => !(normalizeKey(key) === 'key' && row.direction !== undefined))
    .sort(([a], [b]) => orderWeight(a) - orderWeight(b))
    .map(([key, value]) => ({
      key,
      label: label(key),
      value: fieldValue(key, value),
      hint: fieldHint(key),
    }))
}

function seriesValue(point: JsonRecord, key: string): unknown {
  if (point[key] !== undefined) return point[key]
  const camel = key.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase())
  return point[camel]
}

function formatTime(value: unknown): string {
  const raw = text(value, '')
  if (!raw) return '—'
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime())
    ? raw
    : parsed.toLocaleString('zh-CN', { hour12: false })
}

function marketTitle(key: string, section: JsonRecord): string {
  const presented = text(record(section.presentation).display_title, '')
  if (presented) return knownLabel(presented) || presented
  const rawTitle = text(section.title, '')
  if (rawTitle) {
    return knownLabel(rawTitle) || rawTitle
  }
  return label(key)
}

function marketDescription(key: string): string {
  const values: Record<string, string> = {
    standard: '胜平负主盘，适合快速判断三方价格、成交量和资金分布。',
    poly: '外部预测市场数据，用于对照 SPdex 内部市场是否出现背离。',
    goals: '大小球方向，用于观察进球数预期和盘口热度。',
    handicap: '亚洲让球方向，用于观察让球盘主客两侧的交易压力。',
    correct_score: '比分相关市场，仅作补充参考。',
    corner: '角球相关市场，仅作补充参考。',
    jc: '竞彩口径数据，用于和交易市场交叉参考。',
    euro_odds: '欧洲赔率参考，用于观察主流赔率变化。',
  }
  return values[key] || '该分区展示当前比赛的结构化市场指标。'
}

function evidenceFieldLabel(key: string): string {
  const labels: Record<string, string> = {
    status: '比赛状态',
    flags: '信号标签',
    bfAmount: '必发成交量',
    polyAmount: '预测市场成交量',
    bfIndex: '必发指数',
    polyIndex: '预测市场指数',
    matchTime: '比赛时间',
    rank_score: '关注分',
    ranking_inputs: '排序依据',
    market_snapshot: '市场快照',
    timeseries: '走势数据',
    trend_points: '走势采样点',
    data_cutoff_at: '数据截止时间',
    source_endpoint: '数据来源',
    source_inputs: '来源字段',
    rank_reason_labels: '入选原因',
    display_flags: '展示标签',
    score: '观察分',
    severity: '严重程度',
    groups: '成交分组',
    trades: '成交明细',
    largest_trade: '最大单笔成交',
    dominant_group: '主要成交分组',
    market_filter_applied: '市场筛选条件',
    min_amount_filter_applied: '最低成交量条件',
    min_share_filter_applied: '最低占比条件',
  }
  return labels[key] || labels[normalizeKey(key)] || knownLabel(key)
}

function missingFieldLabel(key: string): string {
  const normalized = normalizeKey(key)
  const labels: Record<string, string> = {
    groups: '成交分组',
    trades: '重大成交明细',
    big_trades_permission_locked: '重大成交权限',
    big_trades_locked: '重大成交权限',
    permissions: '会籍权限',
  }
  return labels[key] || labels[normalized] || evidenceFieldLabel(key) || fallbackLabel(key)
}

function sourceLabel(endpoint: string): string {
  if (!endpoint) return 'SPdex 结构化数据'
  if (endpoint.includes('/api/newspdex/matches')) return '赛事列表与市场摘要'
  if (endpoint.includes('/api/newspdex/charts') || endpoint.includes('timeseries')) return '盘口与成交走势'
  if (endpoint.includes('/api/newspdex/match-detail')) return '单场详情与市场快照'
  if (endpoint.includes('/api/newspdex/live')) return '实时比赛与盘口监控'
  if (endpoint.includes('prediction_market') || endpoint.includes('polymarket')) return '外部预测市场快照'
  if (endpoint.startsWith('/api/') || endpoint.startsWith('internal:')) return 'SPdex 结构化数据'
  return 'SPdex 结构化数据'
}
</script>

<template>
  <div class="result-view">
    <div v-if="!response.success" class="result-error">
      <AlertTriangle :size="18" />
      <div>
        <b>{{ response.error?.code || 'analysis_failed' }}</b>
        <p>{{ response.error?.message || '分析请求未能完成' }}</p>
      </div>
    </div>

    <template v-else-if="isMatchList">
      <div v-if="matches.length" class="match-results">
        <article v-for="item in matches" :key="number(item.match_id ?? item.event_id)" class="match-result">
          <div class="match-rank">
            <b v-if="item.rank">#{{ item.rank }}</b>
            <small v-if="item.rank_score">{{ text(item.rank_score_label, '关注分') }} {{ text(item.rank_score) }}</small>
          </div>
          <div class="match-teams">
            <small>{{ text(item.league_name ?? item.league_code, '赛事') }}</small>
            <div>
              <b>{{ text(item.home_team, '主队') }}</b>
              <span>vs</span>
              <b>{{ text(item.away_team, '客队') }}</b>
            </div>
          </div>
          <div class="match-meta">
            <span><CalendarClock :size="14" />{{ formatTime(item.match_time) }}</span>
            <span>{{ text(item.status_label, statusLabel(item.status)) }}</span>
          </div>
          <div v-if="matchTags(item).length" class="tag-line">
            <span v-for="reason in matchTags(item)" :key="reason">
              {{ reason }}
            </span>
          </div>
          <button type="button" class="select-match focus-ring" @click="selectMatch(item)">分析这场</button>
        </article>
      </div>
      <div v-else class="empty-result">当前条件没有找到比赛。</div>
    </template>

    <template v-else-if="isSnapshot">
      <section class="match-banner">
        <div>
          <span>{{ text(snapshotMatch.league_name ?? snapshotMatch.league_code, '单场快照') }}</span>
          <b>{{ text(snapshotMatch.home_team, '主队') }} <i>vs</i> {{ text(snapshotMatch.away_team, '客队') }}</b>
        </div>
        <div>
          <span>{{ formatTime(snapshotMatch.match_time) }}</span>
          <b>{{ text(snapshotMatch.score, statusLabel(snapshotMatch.status)) }}</b>
        </div>
      </section>

      <section v-for="market in marketSections" :key="market.key" class="market-section">
        <header :title="marketDescription(market.key)">
          <span>
            <Table2 :size="15" />
            <b>{{ marketTitle(market.key, market.section) }}</b>
          </span>
          <em>{{ marketDescription(market.key) }}</em>
          <strong>{{ number(market.section.row_count) }} 条</strong>
        </header>
        <div class="metric-rows">
          <div v-for="(row, index) in market.rows" :key="index" class="metric-row">
            <span v-for="cell in rowCells(row)" :key="cell.key" :title="cell.hint">
              <small>{{ cell.label }}<em v-if="cell.hint">?</em></small>
              <b>{{ cell.value }}</b>
            </span>
          </div>
        </div>
      </section>
      <div v-if="!marketSections.length" class="empty-result">当前没有可展示的市场快照数据。</div>
    </template>

    <template v-else-if="isSeries">
      <section class="series-summary">
        <span><Database :size="15" />{{ text(presentation.title, text(data.metric_label ?? data.requested_market, '市场走势')) }}</span>
        <b>{{ number(data.point_count) }} 个数据点</b>
        <span>{{ text(data.granularity, '—') }} · {{ text(presentation.unit_label, text(data.unit, '原始值')) }}</span>
        <small v-if="presentation.interpretation">{{ text(presentation.interpretation) }}</small>
      </section>
      <div v-if="points.length" class="series-table">
        <div class="series-row series-head" :style="seriesGridStyle">
          <span>时间</span>
          <span v-for="column in seriesColumns" :key="column.key">{{ column.label }}</span>
        </div>
        <div v-for="(point, index) in points" :key="`${point.time}-${index}`" class="series-row" :style="seriesGridStyle">
          <span>{{ formatTime(point.time) }}</span>
          <span v-for="column in seriesColumns" :key="column.key">
            {{ fieldValue(column.key, seriesValue(point, column.key)) }}
          </span>
        </div>
      </div>
      <div v-else class="empty-result">当前时间窗口没有可用走势数据。</div>
    </template>

    <template v-else-if="isAnomaly">
      <div class="policy-band">
        <ShieldAlert :size="16" />
        <span>以下内容是规则化市场观察，不构成投注建议。</span>
      </div>
      <div v-if="anomalies.length" class="anomaly-list">
        <article v-for="(item, index) in anomalies" :key="`${item.market}-${index}`" class="anomaly-row">
          <div class="severity">
            <b>{{ text(item.score_label, '异常观察分') }}</b>
            <span>{{ text(item.score, '0') }}</span>
            <small>{{ text(item.severity_label, severityLabel(item.severity)) }}</small>
          </div>
          <div>
            <b>{{ text(item.market_label, label(text(item.market, 'market'))) }}</b>
            <p>{{ anomalySummary(item) }}</p>
            <small v-if="record(item.match).home_team">
              {{ text(record(item.match).home_team) }} vs {{ text(record(item.match).away_team) }}
            </small>
          </div>
        </article>
      </div>
      <div v-else class="empty-result">当前规则和灵敏度下没有发现异常信号。</div>
    </template>

    <template v-else-if="isBigTrades">
      <div class="policy-band">
        <ShieldAlert :size="16" />
        <span>以下内容是规则化市场观察，不构成投注建议。</span>
      </div>
      <section :class="['answer-summary', bigTradeInsight.tone]">
        <strong>{{ bigTradeInsight.title }}</strong>
        <p>{{ bigTradeInsight.description }}</p>
        <ul>
          <li v-for="detail in bigTradeInsight.details" :key="detail">{{ detail }}</li>
        </ul>
      </section>
      <section v-if="number(bigTradeSummary.trade_count)" class="big-trade-overview">
        <div>
          <small>大额交易笔数</small>
          <b>{{ fieldValue('amount', bigTradeSummary.trade_count) }}</b>
        </div>
        <div>
          <small>累计成交量</small>
          <b>{{ fieldValue('amount', bigTradeSummary.total_trade_amount) }}</b>
        </div>
        <div v-if="Object.keys(largestTrade).length">
          <small>最大单笔</small>
          <b>{{ fieldValue('amount', largestTrade.amount) }}</b>
        </div>
      </section>
      <div v-if="bigTradeGroups.length" class="big-trade-groups">
        <article v-for="group in bigTradeGroups" :key="group.key || group.label" class="big-trade-group">
          <header>
            <span>
              <b>{{ group.label }}</b>
              <small>{{ group.marketLabel }}</small>
            </span>
            <strong>{{ group.trades.length }} 笔</strong>
          </header>
          <div class="big-trade-list">
            <div v-for="(trade, index) in group.trades" :key="`${group.key}-${index}`" class="big-trade-row">
              <span class="trade-main">
                <b>{{ selectionLabel(trade.selection) }} · {{ text(trade.side_label ?? trade.side, '成交') }}</b>
                <small>{{ formatTime(trade.time) }}</small>
              </span>
              <span>
                <small>成交量</small>
                <b>{{ fieldValue('amount', trade.amount) }}</b>
              </span>
              <span>
                <small>价位</small>
                <b>{{ fieldValue('price', trade.price) }}</b>
              </span>
              <span>
                <small>成交占比</small>
                <b>{{ fieldValue('share', trade.share) }}</b>
              </span>
              <em v-if="number(trade.highlight) > 0">{{ text(trade.highlight_label, '占比较高') }}</em>
            </div>
          </div>
        </article>
      </div>
      <div v-else class="empty-result">当前窗口没有达到阈值的大额交易记录。</div>
    </template>

    <template v-else-if="isMetric">
      <section class="metric-definition">
        <span>{{ text(metric.key, '指标') }}</span>
        <h3>{{ text(metric.title, '指标解释') }}</h3>
        <p>{{ text(metric.description) }}</p>
        <dl>
          <div><dt>数据来源</dt><dd>{{ text(metric.source) }}</dd></div>
          <div><dt>分析注意</dt><dd>{{ array(metric.caveats).map(item => text(item)).join('；') }}</dd></div>
          <div><dt>建议用法</dt><dd>{{ array(metric.goodSampleUse).map(item => text(item)).join('；') }}</dd></div>
        </dl>
      </section>
    </template>

    <div v-else class="generic-result">
      <CheckCircle2 :size="18" />
      <p>分析已完成。当前结果暂未配置专用展示，请通过反馈告诉我们你最想看到的关键字段。</p>
    </div>

    <div v-if="response.tool === 'get_top_matches'" class="policy-band">
      <ShieldAlert :size="16" />
      <span>重点赛事排序用于筛选分析对象，是市场观察结果，不代表赛果判断。</span>
    </div>

    <section v-if="evidenceSources.length || evidenceFields.length" class="evidence-band">
      <Database :size="14" />
      <div>
        <b>分析依据</b>
        <span v-if="evidenceSources.length">{{ evidenceSources.join('、') }}</span>
        <span v-if="evidenceFields.length">参考字段：{{ evidenceFields.join('、') }}</span>
      </div>
    </section>

    <section v-if="missingFieldLabels.length || lockedPermissions.length" class="limits-band">
      <div v-if="missingFieldLabels.length">
        <AlertTriangle :size="14" />
        <span>缺失或不可用：{{ missingFieldLabels.join('；') }}</span>
      </div>
      <div v-if="lockedPermissions.length">
        <LockKeyhole :size="14" />
        <span>当前会籍未开放：{{ lockedPermissions.map(label).join('、') }}</span>
      </div>
    </section>

    <footer class="result-meta">
      <span><Clock3 :size="13" />数据截止 {{ formatTime(dataCutoff) }}</span>
      <span>{{ response.usage.billable ? '本次计量' : '测试计量' }}：{{ response.usage.usageUnits }} 单位</span>
    </footer>
  </div>
</template>

<style scoped>
.result-view { display: grid; gap: 13px; font-size: .95rem; }
.result-error, .policy-band, .limits-band > div { display: flex; align-items: flex-start; gap: 8px; }
.result-error { padding: 12px; border: 1px solid #f2aca6; border-radius: 5px; background: #fff3f1; color: #991b1b; }
.result-error p { margin: 3px 0 0; font-size: .85rem; }
.match-results, .anomaly-list, .big-trade-groups { display: grid; gap: 7px; }
.match-result { display: grid; grid-template-columns: 96px minmax(190px, 1.35fr) 172px minmax(180px, 1fr) auto; gap: 10px; align-items: center; min-height: 72px; padding: 10px 12px; border: 1px solid var(--divider); border-radius: 6px; background: var(--panel); }
.match-rank { display: grid; align-content: center; min-height: 52px; padding: 8px 9px; border-radius: 5px; background: var(--canvas); }
.match-rank b { color: var(--brand); font-size: .92rem; line-height: 1.1; }
.match-rank small { color: var(--ink); font-size: .76rem; font-weight: 750; line-height: 1.25; }
.match-teams { display: grid; gap: 5px; min-width: 0; }
.match-teams small { color: var(--muted); font-size: .8rem; }
.match-teams > div { display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; min-width: 0; color: var(--ink); font-size: 1rem; }
.match-teams b { min-width: 0; overflow-wrap: anywhere; }
.match-teams span { color: var(--muted); font-size: .76rem; }
.match-meta { display: grid; gap: 4px; color: var(--muted); font-size: .82rem; }
.match-meta span:first-child { display: inline-flex; align-items: center; gap: 4px; }
.tag-line { display: flex; flex-wrap: wrap; gap: 5px; min-width: 0; }
.tag-line span { padding: 3px 6px; border-radius: 3px; background: var(--canvas); color: var(--muted); font-size: .74rem; line-height: 1.25; }
.select-match { min-height: 34px; padding: 6px 11px; border: 1px solid var(--brand); border-radius: 4px; background: transparent; color: var(--brand); font-size: .82rem; font-weight: 750; white-space: nowrap; }
.match-banner { display: flex; align-items: end; justify-content: space-between; gap: 12px; padding: 12px; border-left: 3px solid var(--brand); background: var(--canvas); }
.match-banner > div { display: grid; gap: 4px; }
.match-banner > div:last-child { text-align: right; }
.match-banner span { color: var(--muted); font-size: .82rem; }
.match-banner b { font-size: 1.05rem; }
.match-banner i { color: var(--muted); font-size: .78rem; font-style: normal; }
.market-section { border-top: 1px solid var(--divider); }
.market-section header { display: grid; grid-template-columns: minmax(160px, auto) minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 8px 0; }
.market-section header > span { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
.market-section header b { font-size: .92rem; }
.market-section header em { color: var(--muted); font-size: .78rem; font-style: normal; line-height: 1.45; }
.market-section header strong { color: var(--muted); font-size: .78rem; font-weight: 650; }
.metric-rows { display: grid; gap: 1px; background: var(--divider); border: 1px solid var(--divider); }
.metric-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 9px; padding: 10px; background: var(--panel); }
.metric-row span { display: grid; gap: 2px; min-width: 0; }
.metric-row small { color: var(--muted); font-size: .76rem; }
.metric-row small em { display: inline-grid; width: 14px; height: 14px; margin-left: 4px; place-items: center; border-radius: 999px; background: var(--canvas); color: var(--muted); font-size: .62rem; font-style: normal; }
.metric-row b { overflow-wrap: anywhere; font-size: .9rem; }
.section-note, .empty-result { margin: 0; padding: 14px; color: var(--muted); font-size: .88rem; text-align: center; }
.series-summary { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 10px; background: var(--canvas); font-size: .86rem; }
.series-summary span:first-child { display: inline-flex; align-items: center; gap: 5px; font-weight: 720; }
.series-summary span:last-child { color: var(--muted); }
.series-summary small { grid-column: 1 / -1; color: var(--muted); font-size: .78rem; line-height: 1.5; }
.series-table { border: 1px solid var(--divider); overflow-x: auto; }
.series-row { display: grid; grid-template-columns: minmax(145px, 1.5fr) repeat(4, minmax(70px, 1fr)); min-width: 520px; border-top: 1px solid var(--divider); }
.series-row:first-child { border-top: 0; }
.series-row span { padding: 8px; font-size: .82rem; }
.series-head { background: var(--canvas); color: var(--muted); font-weight: 720; }
.policy-band { padding: 9px 10px; border-left: 3px solid #d97706; background: #fff8e8; color: #8a4b08; font-size: .86rem; }
.evidence-band { display: flex; align-items: flex-start; gap: 7px; padding: 9px 10px; background: var(--canvas); color: var(--muted); }
.evidence-band > div { display: grid; gap: 3px; min-width: 0; }
.evidence-band b { color: var(--ink); font-size: .84rem; }
.evidence-band span { overflow-wrap: anywhere; font-size: .8rem; }
.anomaly-row { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 12px; padding: 12px; background: var(--panel); }
.severity { display: grid; align-content: start; gap: 2px; color: #b42318; }
.severity b { font-size: .78rem; text-transform: uppercase; }
.severity span { font-size: 1.25rem; font-weight: 800; }
.severity small { color: var(--muted); font-size: .76rem; }
.anomaly-row > div:last-child { display: grid; gap: 4px; }
.anomaly-row p { margin: 0; color: var(--muted); font-size: .86rem; overflow-wrap: anywhere; }
.anomaly-row small { font-size: .78rem; }
.answer-summary { display: grid; gap: 7px; padding: 12px; border: 1px solid var(--divider); border-left: 4px solid #64748b; border-radius: 6px; background: var(--canvas); }
.answer-summary.strong { border-left-color: #b42318; background: #fff7f5; }
.answer-summary.watch { border-left-color: #d97706; background: #fffaf0; }
.answer-summary strong { color: var(--ink); font-size: 1.02rem; }
.answer-summary p { margin: 0; color: var(--ink); font-size: .9rem; line-height: 1.55; }
.answer-summary ul { display: grid; gap: 4px; margin: 0; padding-left: 18px; color: var(--muted); font-size: .84rem; line-height: 1.55; }
.big-trade-overview { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.big-trade-overview > div { display: grid; gap: 3px; padding: 10px; border: 1px solid var(--divider); border-radius: 5px; background: var(--canvas); }
.big-trade-overview small, .big-trade-row small, .big-trade-group header small { color: var(--muted); font-size: .76rem; }
.big-trade-overview b { color: var(--ink); font-size: 1rem; }
.big-trade-group { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--divider); border-radius: 6px; background: var(--panel); }
.big-trade-group header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.big-trade-group header span { display: flex; flex-wrap: wrap; align-items: baseline; gap: 7px; min-width: 0; }
.big-trade-group header b { font-size: .92rem; }
.big-trade-group header strong { color: var(--muted); font-size: .8rem; }
.big-trade-list { display: grid; gap: 1px; background: var(--divider); border: 1px solid var(--divider); }
.big-trade-row { display: grid; grid-template-columns: minmax(160px, 1.3fr) repeat(3, minmax(90px, 1fr)) auto; gap: 8px; align-items: center; padding: 9px 10px; background: var(--panel); }
.big-trade-row > span { display: grid; gap: 2px; min-width: 0; }
.big-trade-row b { font-size: .88rem; }
.big-trade-row em { padding: 3px 6px; border-radius: 3px; background: #fff3cf; color: #8a4b08; font-size: .74rem; font-style: normal; white-space: nowrap; }
.metric-definition { display: grid; gap: 7px; padding: 14px; border-left: 3px solid var(--brand); background: var(--canvas); }
.metric-definition > span { color: var(--brand); font: 650 .78rem/1.3 ui-monospace, monospace; }
.metric-definition h3 { margin: 0; font-size: 1.08rem; }
.metric-definition > p { margin: 0; color: var(--ink); font-size: .9rem; line-height: 1.65; }
.metric-definition dl { display: grid; gap: 7px; margin: 3px 0 0; }
.metric-definition dl div { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 8px; font-size: .82rem; }
.metric-definition dt { color: var(--muted); }
.metric-definition dd { margin: 0; }
.limits-band { display: grid; gap: 6px; padding: 9px 10px; background: #fff8e8; color: #8a4b08; font-size: .82rem; }
.result-meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; color: var(--muted); font-size: .78rem; }
.result-meta span:first-child { display: inline-flex; align-items: center; gap: 4px; }
.generic-result { display: flex; align-items: flex-start; gap: 8px; padding: 10px; background: var(--canvas); color: var(--muted); font-size: .86rem; }
.generic-result p { margin: 0; line-height: 1.6; }
@media (max-width: 720px) {
  .match-result { grid-template-columns: 78px minmax(0, 1fr); }
  .match-meta, .tag-line, .select-match { grid-column: 1 / -1; }
  .market-section header { grid-template-columns: 1fr auto; }
  .market-section header em { grid-column: 1 / 3; }
  .match-banner { align-items: start; }
  .series-summary { grid-template-columns: 1fr auto; }
  .series-summary span:last-child { grid-column: 1 / 3; }
  .big-trade-overview { grid-template-columns: 1fr; }
  .big-trade-row { grid-template-columns: 1fr 1fr; }
  .big-trade-row .trade-main, .big-trade-row em { grid-column: 1 / -1; }
}
</style>
