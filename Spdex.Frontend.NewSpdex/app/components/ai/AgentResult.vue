<script setup lang="ts">
import { Bot, CheckCircle2, Info, ListChecks, ShieldAlert } from '@lucide/vue'
import type { AiAgentTurnResponse } from '~/types/good-sample'

const props = defineProps<{ response: AiAgentTurnResponse }>()

interface TimelineRow {
  time: string
  volume: number
  home?: number
  draw?: number
  away?: number
  price?: number
  width: number
}

interface TimelinePill {
  label: string
  amount: number
}

interface TimelineCard {
  key: string
  title: string
  subtitle: string
  pointCount: number
  totalLabel: string
  peakLabel: string
  latestLabel: string
  pills: TimelinePill[]
  rows: TimelineRow[]
}

const confidenceLabel = computed(() => {
  const values: Record<string, string> = {
    high: '置信度高',
    medium: '置信度中',
    low: '置信度低',
  }
  return values[props.response.answer?.confidence || ''] || '置信度待确认'
})

const toolLabel = (tool: string) => {
  const values: Record<string, string> = {
    get_match_snapshot: '单场数据',
    list_match_market_capabilities: '可用能力',
    get_big_trades: '大额交易',
    get_market_series: '走势数据',
    get_market_metric_series: '指标走势',
    get_trade_flow: '成交明细',
    get_market_depth: '盘口深度',
    get_hold_window_summary: 'Hold 窗口',
    compare_market_windows: '窗口对比',
    get_extraction_signals: '提炼信号',
    detect_cross_market_resonance: '跨市场共振',
    get_prediction_market_links: '外部市场链接',
    get_prediction_market_snapshot: '外部市场快照',
    compare_prediction_market_to_spdex: '预测市场对比',
    get_live_market_monitor: '赛中监控',
    get_signal_feed: '活跃信号',
    explain_signal: '信号解释',
    generate_match_brief: '比赛简报',
    generate_watchlist: '观察列表',
    plan_agent_analysis: '分析路径',
    run_match_analysis_workflow: '单场工作流',
    run_watchlist_workflow: '观察列表工作流',
    detect_market_anomalies: '异常证据',
    explain_metric: '指标解释',
  }
  return values[tool] || '数据工具'
}

const showEvidenceExplanation = (value: string, explanation: string) => {
  const normalizedValue = value.trim()
  const normalizedExplanation = explanation.trim()
  return Boolean(normalizedExplanation) && normalizedExplanation !== normalizedValue
}

const timelineCards = computed<TimelineCard[]>(() => {
  return (props.response.answer?.uiCards ?? [])
    .filter(card => ['trade_volume_timeline', 'trade_flow_timeline'].includes(card.type))
    .map((card, index) => toTimelineCard(card.title, card.type, card.payload, index))
    .filter((card): card is TimelineCard => Boolean(card))
})

function toTimelineCard(title: string, type: string, payload: unknown, index: number): TimelineCard | null {
  const source = asRecord(payload)
  if (!source) return null

  const rows = readRows(source, type === 'trade_flow_timeline' ? 'buckets' : 'points')
  const maxVolume = Math.max(1, ...rows.map(row => row.volume))
  const normalizedRows = rows.map(row => ({
    ...row,
    width: Math.max(8, Math.round((row.volume / maxVolume) * 100)),
  }))
  const peak = asRecord(source.max_bucket)
  const latest = asRecord(source.latest_bucket)
  const total = readNumber(source, 'total_volume') ?? readNumber(source, 'total_amount')
  const pointCount = readNumber(source, 'point_count') ?? readNumber(source, 'bucket_count') ?? normalizedRows.length
  const pills = readPills(source, type === 'trade_flow_timeline' ? 'attr_totals' : 'direction_totals')
  const marketLabel = readText(source, 'market_label') || (type === 'trade_flow_timeline' ? '成交明细' : '成交量')
  const granularity = readText(source, 'granularity')
  const selectionLabel = readText(source, 'selection_label')

  return {
    key: `${type}-${index}`,
    title: title || (type === 'trade_flow_timeline' ? '成交明细时间桶' : '成交量时间分布'),
    subtitle: [marketLabel, selectionLabel, granularity].filter(Boolean).join(' · '),
    pointCount,
    totalLabel: total != null ? formatAmount(total) : '—',
    peakLabel: bucketLabel(peak),
    latestLabel: bucketLabel(latest),
    pills,
    rows: normalizedRows,
  }
}

function readRows(source: Record<string, unknown>, key: string): TimelineRow[] {
  const raw = Array.isArray(source[key]) ? source[key] : []
  return raw
    .map((item): TimelineRow | null => {
      const row = asRecord(item)
      if (!row) return null
      return {
        time: compactTime(readText(row, 'time')),
        volume: readNumber(row, 'volume') ?? 0,
        home: readNumber(row, 'home'),
        draw: readNumber(row, 'draw'),
        away: readNumber(row, 'away'),
        price: readNumber(row, 'price'),
        width: 0,
      }
    })
    .filter((row): row is TimelineRow => Boolean(row && row.time))
}

function readPills(source: Record<string, unknown>, key: string): TimelinePill[] {
  const raw = Array.isArray(source[key]) ? source[key] : []
  return raw
    .map((item) => {
      const row = asRecord(item)
      if (!row) return null
      const label = readText(row, 'label') || readText(row, 'attr') || readText(row, 'key')
      const amount = readNumber(row, 'amount') ?? 0
      return label && amount > 0 ? { label, amount } : null
    })
    .filter((item): item is TimelinePill => Boolean(item))
    .slice(0, 4)
}

function bucketLabel(bucket: Record<string, unknown> | null): string {
  if (!bucket) return '—'
  const amount = readNumber(bucket, 'volume') ?? readNumber(bucket, 'total_amount')
  const time = compactTime(readText(bucket, 'time'))
  return [time, amount != null ? formatAmount(amount) : ''].filter(Boolean).join(' · ') || '—'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readText(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  return typeof value === 'string' ? value : ''
}

function readNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function compactTime(value: string): string {
  if (!value) return ''
  return value.replace('T', ' ').replace(/Z$/, '').replace(/:00$/, '')
}

function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (Math.abs(value) >= 10_000) return `${(value / 1000).toFixed(0)}K`
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}
</script>

<template>
  <section v-if="response.success && response.answer" class="agent-result">
    <div class="notice">
      <ShieldAlert :size="17" />
      <span>{{ response.answer.policyNotice || '以下内容为规则化市场观察，不构成投注建议。' }}</span>
    </div>

    <section class="direct-answer">
      <div class="answer-icon"><Bot :size="20" /></div>
      <div>
        <p>{{ response.answer.directAnswer }}</p>
        <span>{{ confidenceLabel }}</span>
      </div>
    </section>

    <section v-if="response.answer.summary?.length" class="agent-section">
      <header><ListChecks :size="17" /><b>判断要点</b></header>
      <ul>
        <li v-for="item in response.answer.summary" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section v-if="response.answer.keyEvidence?.length" class="agent-section evidence-section">
      <header><CheckCircle2 :size="17" /><b>关键依据</b></header>
      <div class="evidence-grid">
        <article v-for="item in response.answer.keyEvidence" :key="`${item.label}-${item.value}`" class="evidence-item">
          <span>{{ item.label }}</span>
          <b>{{ item.value }}</b>
          <p v-if="showEvidenceExplanation(item.value, item.explanation)">{{ item.explanation }}</p>
        </article>
      </div>
    </section>

    <section v-if="timelineCards.length" class="agent-section timeline-section">
      <header><ListChecks :size="17" /><b>时间分布</b></header>
      <article v-for="card in timelineCards" :key="card.key" class="timeline-card">
        <div class="timeline-head">
          <div>
            <b>{{ card.title }}</b>
            <span>{{ card.subtitle }}</span>
          </div>
          <small>{{ card.pointCount }} 个时间点</small>
        </div>
        <div class="timeline-metrics">
          <span><small>合计</small><b>{{ card.totalLabel }}</b></span>
          <span><small>峰值</small><b>{{ card.peakLabel }}</b></span>
          <span><small>最新</small><b>{{ card.latestLabel }}</b></span>
        </div>
        <div v-if="card.pills.length" class="timeline-pills">
          <span v-for="pill in card.pills" :key="`${card.key}-${pill.label}`">
            {{ pill.label }} {{ formatAmount(pill.amount) }}
          </span>
        </div>
        <div v-if="card.rows.length" class="timeline-rows">
          <div v-for="row in card.rows" :key="`${card.key}-${row.time}`" class="timeline-row">
            <time>{{ row.time }}</time>
            <div class="timeline-bar"><span :style="{ width: `${row.width}%` }" /></div>
            <b>{{ formatAmount(row.volume) }}</b>
          </div>
        </div>
      </article>
    </section>

    <section v-if="response.answer.dataLimits?.length" class="agent-section muted-section">
      <header><Info :size="17" /><b>数据边界</b></header>
      <ul>
        <li v-for="item in response.answer.dataLimits" :key="item">{{ item }}</li>
      </ul>
    </section>

    <div v-if="response.toolCalls?.length" class="tool-summary">
      <span v-for="call in response.toolCalls" :key="call.id || call.tool">
        {{ toolLabel(call.tool) }}
      </span>
    </div>
  </section>
  <section v-else class="agent-error">
    {{ response.message || '观察助手暂时没有生成有效回答。' }}
  </section>
</template>

<style scoped>
.agent-result { display: grid; gap: 12px; font-size: 1rem; }
.notice { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-left: 3px solid #d97706; background: #fffbeb; color: #92400e; line-height: 1.45; }
.direct-answer { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: start; padding: 14px; border: 1px solid color-mix(in srgb, var(--brand) 28%, var(--line)); border-radius: 6px; background: color-mix(in srgb, var(--brand) 6%, var(--panel)); }
.answer-icon { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 6px; background: var(--brand); color: #fff; }
.direct-answer p { margin: 0; color: var(--ink); font-size: 1.04rem; font-weight: 760; line-height: 1.65; }
.direct-answer span { display: inline-block; margin-top: 6px; color: var(--muted); font-size: .88rem; }
.agent-section { display: grid; gap: 8px; padding-top: 2px; }
.agent-section header { display: flex; align-items: center; gap: 7px; color: var(--ink); font-size: .98rem; }
.agent-section ul { display: grid; gap: 6px; margin: 0; padding-left: 20px; color: var(--text); line-height: 1.6; }
.evidence-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }
.evidence-item { display: grid; gap: 4px; padding: 10px; border: 1px solid var(--divider); border-radius: 5px; background: var(--canvas); }
.evidence-item span { color: var(--muted); font-size: .82rem; }
.evidence-item b { color: var(--ink); font-size: 1.06rem; }
.evidence-item p { margin: 0; color: var(--muted); font-size: .88rem; line-height: 1.5; }
.timeline-section { gap: 10px; }
.timeline-card { display: grid; gap: 10px; padding: 12px; border: 1px solid var(--divider); border-radius: 6px; background: var(--canvas); }
.timeline-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--divider); padding-bottom: 8px; }
.timeline-head div { display: grid; gap: 2px; min-width: 0; }
.timeline-head b { color: var(--ink); font-size: .98rem; }
.timeline-head span,
.timeline-head small { color: var(--muted); font-size: .82rem; line-height: 1.35; }
.timeline-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.timeline-metrics span { display: grid; gap: 2px; min-width: 0; padding: 8px; border-radius: 5px; background: var(--panel); }
.timeline-metrics small { color: var(--muted); font-size: .76rem; }
.timeline-metrics b { overflow-wrap: anywhere; color: var(--ink); font-size: .92rem; }
.timeline-pills { display: flex; flex-wrap: wrap; gap: 6px; }
.timeline-pills span { padding: 4px 7px; border-radius: 4px; background: var(--chip-bg); color: var(--text); font-size: .8rem; }
.timeline-rows { display: grid; gap: 6px; }
.timeline-row { display: grid; grid-template-columns: minmax(112px, 1.2fr) minmax(80px, 2fr) minmax(64px, .7fr); align-items: center; gap: 8px; color: var(--text); font-size: .82rem; }
.timeline-row time { color: var(--muted); white-space: nowrap; }
.timeline-row b { color: var(--ink); text-align: right; font-size: .84rem; }
.timeline-bar { height: 9px; overflow: hidden; border-radius: 999px; background: var(--chip-bg); }
.timeline-bar span { display: block; height: 100%; min-width: 8px; border-radius: inherit; background: var(--brand); }
.muted-section { color: var(--muted); }
.tool-summary { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 2px; }
.tool-summary span { padding: 4px 7px; border-radius: 4px; background: var(--chip-bg); color: var(--muted); font-size: .78rem; }
.agent-error { padding: 12px; border: 1px solid #f4b5af; border-radius: 5px; background: #fff2f0; color: #9f1c13; }
@media (max-width: 640px) {
  .timeline-metrics { grid-template-columns: 1fr; }
  .timeline-row { grid-template-columns: minmax(96px, 1fr) minmax(70px, 1fr) minmax(54px, auto); }
}
</style>
