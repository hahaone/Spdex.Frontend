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
const matches = computed(() => array(data.value.matches).map(record))
const snapshot = computed(() => record(data.value.snapshot))
const snapshotMatch = computed(() => record(snapshot.value.match))
const marketSections = computed(() => Object.entries(record(snapshot.value.markets))
  .filter(([, value]) => value && typeof value === 'object')
  .map(([key, value]) => ({
    key,
    section: record(value),
    rows: array(record(value).rows).map(record),
  })))
const points = computed(() => array(data.value.points).slice(-12).map(record))
const anomalies = computed(() => array(data.value.anomalies).map(record))
const missingFields = computed(() => array(data.value.missing_fields).map(value => String(value)))
const lockedPermissions = computed(() => Object.entries(record(data.value.permissions))
  .filter(([, value]) => value === false)
  .map(([key]) => key))
const metric = computed(() => {
  const nested = record(data.value.metric)
  return Object.keys(nested).length ? nested : data.value
})
const evidence = computed(() => record(data.value.evidence))
const evidenceFields = computed(() => [
  ...array(evidence.value.source_inputs),
  ...array(evidence.value.ranking_inputs),
  ...array(data.value.evidence_sections),
].map(value => String(value)))
const dataCutoff = computed(() => text(data.value.data_cutoff_at, props.response.generatedAt))

const isMatchList = computed(() => ['search_matches', 'get_top_matches'].includes(props.response.tool))
const isSnapshot = computed(() => props.response.tool === 'get_match_snapshot')
const isSeries = computed(() => props.response.tool === 'get_market_series')
const isAnomaly = computed(() => props.response.tool === 'detect_market_anomalies')
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
  const labels: Record<string, string> = {
    standard: '标盘',
    poly: 'Poly',
    goals: '大小球',
    handicap: '让球',
    correct_score: '比分',
    corner: '角球',
    jc: '竞彩',
    euro_odds: '欧赔',
    match_odds: '胜平负',
    asian_handicap: '亚洲让球',
    over_under: '大小球',
    trade_volume: '成交量',
    home: '主',
    draw: '平',
    away: '客',
    volume: '成交量',
    selection: '方向',
    price: '价格',
    index: '指数',
    amount: '成交',
    price_home: '主胜价',
    price_draw: '平局价',
    price_away: '客胜价',
    time: '时间',
  }
  return labels[key] || key.replaceAll('_', ' ')
}

function fieldValue(key: string, value: unknown): string {
  if (key === 'status') return statusLabel(value)
  if ((key.includes('amount') || key === 'volume') && typeof value === 'number') {
    return value.toLocaleString('en-US')
  }
  return text(value)
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

function formatTime(value: unknown): string {
  const raw = text(value, '')
  if (!raw) return '—'
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime())
    ? raw
    : parsed.toLocaleString('zh-CN', { hour12: false })
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
            <span>{{ text(item.league_name ?? item.league_code, '赛事') }}</span>
          </div>
          <div class="match-teams">
            <b>{{ text(item.home_team, '主队') }}</b>
            <span>vs</span>
            <b>{{ text(item.away_team, '客队') }}</b>
          </div>
          <div class="match-meta">
            <span><CalendarClock :size="13" />{{ formatTime(item.match_time) }}</span>
            <span>{{ statusLabel(item.status) }}</span>
          </div>
          <div v-if="array(item.rank_reasons).length || array(item.flags).length" class="tag-line">
            <span v-for="reason in [...array(item.rank_reasons), ...array(item.flags)].slice(0, 4)" :key="String(reason)">
              {{ text(reason) }}
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
        <header>
          <Table2 :size="15" />
          <b>{{ text(market.section.title, label(market.key)) }}</b>
          <span>{{ number(market.section.row_count) }} 条</span>
        </header>
        <div v-if="market.rows.length" class="metric-rows">
          <div v-for="(row, index) in market.rows" :key="index" class="metric-row">
            <span v-for="[key, value] in rowEntries(row)" :key="key">
              <small>{{ label(key) }}</small>
              <b>{{ fieldValue(key, value) }}</b>
            </span>
          </div>
        </div>
        <p v-else class="section-note">{{ text(market.section.note, '该分区暂无可展示数据') }}</p>
      </section>
    </template>

    <template v-else-if="isSeries">
      <section class="series-summary">
        <span><Database :size="15" />{{ text(data.metric_label ?? data.requested_market, '市场走势') }}</span>
        <b>{{ number(data.point_count) }} 个数据点</b>
        <span>{{ text(data.granularity, '—') }} · {{ text(data.unit, '原始值') }}</span>
      </section>
      <div v-if="points.length" class="series-table">
        <div class="series-row series-head">
          <span>时间</span><span>主</span><span>平</span><span>客</span><span>成交</span>
        </div>
        <div v-for="(point, index) in points" :key="`${point.time}-${index}`" class="series-row">
          <span>{{ formatTime(point.time) }}</span>
          <span>{{ text(point.home ?? point.price_home) }}</span>
          <span>{{ text(point.draw ?? point.price_draw) }}</span>
          <span>{{ text(point.away ?? point.price_away) }}</span>
          <span>{{ text(point.volume) }}</span>
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
            <b>{{ severityLabel(item.severity) }}</b>
            <span>{{ text(item.score, '0') }}</span>
          </div>
          <div>
            <b>{{ label(text(item.market, 'market')) }}</b>
            <p>{{ array(item.reasons).map(reason => text(reason)).join(' · ') || text(item.reason) }}</p>
            <small v-if="record(item.match).home_team">
              {{ text(record(item.match).home_team) }} vs {{ text(record(item.match).away_team) }}
            </small>
          </div>
        </article>
      </div>
      <div v-else class="empty-result">当前规则和灵敏度下没有发现异常信号。</div>
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
      <pre>{{ JSON.stringify(response.data, null, 2) }}</pre>
    </div>

    <div v-if="response.tool === 'get_top_matches'" class="policy-band">
      <ShieldAlert :size="16" />
      <span>重点赛事排序用于筛选分析对象，是市场观察结果，不代表赛果判断。</span>
    </div>

    <section v-if="evidence.source_endpoint || evidenceFields.length" class="evidence-band">
      <Database :size="14" />
      <div>
        <b>证据来源</b>
        <span v-if="evidence.source_endpoint">{{ text(evidence.source_endpoint) }}</span>
        <span v-if="evidenceFields.length">{{ evidenceFields.join('、') }}</span>
      </div>
    </section>

    <section v-if="missingFields.length || lockedPermissions.length" class="limits-band">
      <div v-if="missingFields.length">
        <AlertTriangle :size="14" />
        <span>缺失或不可用：{{ missingFields.join('；') }}</span>
      </div>
      <div v-if="lockedPermissions.length">
        <LockKeyhole :size="14" />
        <span>当前会籍未开放：{{ lockedPermissions.map(label).join('、') }}</span>
      </div>
    </section>

    <footer class="result-meta">
      <span><Clock3 :size="13" />数据截止 {{ formatTime(dataCutoff) }}</span>
      <span>{{ response.usage.usageUnits }} units · {{ response.usage.billable ? '计费' : '测试计量' }}</span>
    </footer>

    <details class="raw-result">
      <summary>查看结构化原始数据</summary>
      <pre>{{ JSON.stringify(response.success ? response.data : response.error, null, 2) }}</pre>
    </details>
  </div>
</template>

<style scoped>
.result-view { display: grid; gap: 12px; }
.result-error, .policy-band, .limits-band > div { display: flex; align-items: flex-start; gap: 8px; }
.result-error { padding: 12px; border: 1px solid #f2aca6; border-radius: 5px; background: #fff3f1; color: #991b1b; }
.result-error p { margin: 3px 0 0; font-size: .75rem; }
.match-results, .anomaly-list { display: grid; gap: 1px; background: var(--divider); border: 1px solid var(--divider); border-radius: 5px; overflow: hidden; }
.match-result { display: grid; grid-template-columns: 90px minmax(190px, 1fr) minmax(150px, auto) auto; gap: 10px; align-items: center; padding: 10px; background: var(--panel); }
.match-rank, .match-teams { display: grid; gap: 2px; }
.match-rank b { color: var(--brand); font-size: .74rem; }
.match-rank span, .match-meta { color: var(--muted); font-size: .68rem; }
.match-teams { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; font-size: .78rem; }
.match-teams span { color: var(--muted); font-size: .62rem; }
.match-meta { display: grid; gap: 3px; }
.match-meta span:first-child { display: inline-flex; align-items: center; gap: 4px; }
.tag-line { display: flex; flex-wrap: wrap; gap: 4px; grid-column: 2 / 4; }
.tag-line span { padding: 2px 5px; border-radius: 3px; background: var(--canvas); color: var(--muted); font-size: .6rem; }
.select-match { min-height: 30px; padding: 5px 9px; border: 1px solid var(--brand); border-radius: 4px; background: transparent; color: var(--brand); font-size: .68rem; font-weight: 750; }
.match-banner { display: flex; align-items: end; justify-content: space-between; gap: 12px; padding: 12px; border-left: 3px solid var(--brand); background: var(--canvas); }
.match-banner > div { display: grid; gap: 4px; }
.match-banner > div:last-child { text-align: right; }
.match-banner span { color: var(--muted); font-size: .68rem; }
.match-banner b { font-size: .9rem; }
.match-banner i { color: var(--muted); font-size: .65rem; font-style: normal; }
.market-section { border-top: 1px solid var(--divider); }
.market-section header { display: flex; align-items: center; gap: 6px; padding: 8px 0; }
.market-section header b { font-size: .76rem; }
.market-section header span { margin-left: auto; color: var(--muted); font-size: .64rem; }
.metric-rows { display: grid; gap: 1px; background: var(--divider); border: 1px solid var(--divider); }
.metric-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(92px, 1fr)); gap: 8px; padding: 8px; background: var(--panel); }
.metric-row span { display: grid; gap: 2px; min-width: 0; }
.metric-row small { color: var(--muted); font-size: .6rem; }
.metric-row b { overflow-wrap: anywhere; font-size: .7rem; }
.section-note, .empty-result { margin: 0; padding: 14px; color: var(--muted); font-size: .75rem; text-align: center; }
.series-summary { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: center; padding: 10px; background: var(--canvas); font-size: .72rem; }
.series-summary span:first-child { display: inline-flex; align-items: center; gap: 5px; font-weight: 720; }
.series-summary span:last-child { color: var(--muted); }
.series-table { border: 1px solid var(--divider); overflow-x: auto; }
.series-row { display: grid; grid-template-columns: minmax(145px, 1.5fr) repeat(4, minmax(70px, 1fr)); min-width: 520px; border-top: 1px solid var(--divider); }
.series-row:first-child { border-top: 0; }
.series-row span { padding: 7px; font-size: .67rem; }
.series-head { background: var(--canvas); color: var(--muted); font-weight: 720; }
.policy-band { padding: 9px 10px; border-left: 3px solid #d97706; background: #fff8e8; color: #8a4b08; font-size: .72rem; }
.evidence-band { display: flex; align-items: flex-start; gap: 7px; padding: 9px 10px; background: var(--canvas); color: var(--muted); }
.evidence-band > div { display: grid; gap: 3px; min-width: 0; }
.evidence-band b { color: var(--ink); font-size: .67rem; }
.evidence-band span { overflow-wrap: anywhere; font-size: .63rem; }
.anomaly-row { display: grid; grid-template-columns: 60px minmax(0, 1fr); gap: 10px; padding: 10px; background: var(--panel); }
.severity { display: grid; align-content: start; gap: 2px; color: #b42318; }
.severity b { font-size: .66rem; text-transform: uppercase; }
.severity span { font-size: 1rem; font-weight: 800; }
.anomaly-row > div:last-child { display: grid; gap: 4px; }
.anomaly-row p { margin: 0; color: var(--muted); font-size: .7rem; overflow-wrap: anywhere; }
.anomaly-row small { font-size: .64rem; }
.metric-definition { display: grid; gap: 7px; padding: 14px; border-left: 3px solid var(--brand); background: var(--canvas); }
.metric-definition > span { color: var(--brand); font: 650 .65rem/1.3 ui-monospace, monospace; }
.metric-definition h3 { margin: 0; font-size: 1rem; }
.metric-definition > p { margin: 0; color: var(--ink); font-size: .78rem; line-height: 1.65; }
.metric-definition dl { display: grid; gap: 7px; margin: 3px 0 0; }
.metric-definition dl div { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 8px; font-size: .69rem; }
.metric-definition dt { color: var(--muted); }
.metric-definition dd { margin: 0; }
.limits-band { display: grid; gap: 6px; padding: 9px 10px; background: #fff8e8; color: #8a4b08; font-size: .68rem; }
.result-meta { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; color: var(--muted); font-size: .64rem; }
.result-meta span:first-child { display: inline-flex; align-items: center; gap: 4px; }
.raw-result { border-top: 1px solid var(--divider); color: var(--muted); font-size: .68rem; }
.raw-result summary { padding: 8px 0; cursor: pointer; }
.raw-result pre, .generic-result pre { max-height: 360px; margin: 0; overflow: auto; padding: 10px; background: var(--canvas); color: var(--ink); font: 10px/1.55 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.generic-result { display: grid; gap: 8px; }
@media (max-width: 720px) {
  .match-result { grid-template-columns: 70px minmax(0, 1fr) auto; }
  .match-meta { grid-column: 1 / 3; }
  .tag-line { grid-column: 1 / 4; }
  .match-banner { align-items: start; }
  .series-summary { grid-template-columns: 1fr auto; }
  .series-summary span:last-child { grid-column: 1 / 3; }
}
</style>
