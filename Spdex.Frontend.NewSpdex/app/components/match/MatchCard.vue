<script setup lang="ts">
import { ChevronRight, Zap } from '@lucide/vue'
import type { RouteLocationRaw } from 'vue-router'
import type { MatchSummary } from '~/types/match'
import { formatHandicapLine } from '~/utils/handicap'

const props = withDefaults(defineProps<{
  match: MatchSummary
  /** twoWay=true 适配篮球：只显示主/客两行，让分线显示在头部 chip */
  twoWay?: boolean
  /** 跳转路径，默认 /football/{eventId} */
  to?: RouteLocationRaw
  /** 是否展示闪Q入口；默认足球卡片展示，篮球调用方可关闭。 */
  showFlashQ?: boolean
}>(), {
  twoWay: false,
  to: undefined,
  showFlashQ: true,
})

const { buildFlashQLink } = useFlashQLink()
const { canOpenFlashQ, flashQLockMessage } = useFlashQAccess()
const linkTo = computed(() => props.to ?? `/football/${props.match.eventId}`)
const flashQUrl = computed(() => buildFlashQLink(props.match.eventId))

const maxTurnover = computed(() => Math.max(...props.match.turnovers.map(toNumber), 1))

function toNumber(value: string): number {
  const normalized = value.toUpperCase().replace(/[$,]/g, '')
  if (normalized.endsWith('M')) return parseFloat(normalized) * 1_000_000
  if (normalized.endsWith('K')) return parseFloat(normalized) * 1_000
  return parseFloat(normalized) || 0
}

function barWidth(value: string): string {
  return `${Math.max(6, (toNumber(value) / maxTurnover.value) * 100)}%`
}

function fmtOdds(value: number | undefined): string {
  return value && value > 0 ? value.toFixed(2) : '-'
}

function bfPct(i: number): number {
  return Math.round(props.match.bfIndex[i] ?? 0)
}

function bigBetSideKey(side: string): string {
  if (side.includes('主')) return 'home'
  if (side.includes('客')) return 'away'
  if (side.includes('平')) return 'draw'
  return 'mute'
}

// 必发成交为英镑盘口口径，不加人民币符号（G4）；显示完整金额（千分位，不缩成 K/M）
function fmtAmount(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

const kickOff = computed(() => props.match.matchTime.slice(11, 16))
const handicapLabel = computed(() => formatHandicapLine(props.match.handicap))
const statusLabel = computed(() => {
  if (props.match.status === 'finished') return '完场'
  if (props.match.status === 'started') return '进行中'
  return '未开'
})
const totalTurnover = computed(() => fmtAmount(props.match.bfAmount ?? 0))
const hasPoly = computed(() => props.match.polyIndex.some(v => v > 0))
const scoreText = computed(() => (props.match.scoreText ? props.match.scoreText.replace('-', ' : ') : ''))
const hasGoalsMarket = computed(() => props.twoWay && Boolean(
  props.match.goalsLine
  || props.match.goalsOdds?.some(value => value > 0)
  || props.match.goalsIndex?.some(value => value > 0)
  || props.match.goalsAmount?.some(value => value > 0),
))
const goalsLineLabel = computed(() => props.match.goalsLine ? `大小 ${props.match.goalsLine}` : '大小')
const goalsOddsOver = computed(() => fmtOdds(props.match.goalsOdds?.[0]))
const goalsOddsUnder = computed(() => fmtOdds(props.match.goalsOdds?.[1]))
const goalsIndexText = computed(() => {
  const values = props.match.goalsIndex
  if (!values) return '-'
  const over = Math.round(values[0] ?? 0)
  const under = Math.round(values[1] ?? 0)
  return (over > 0 || under > 0) ? `${over}/${under}` : '-'
})
const goalsTurnoverText = computed(() => {
  const values = props.match.goalsTurnovers
  if (!values) return '-'
  return `${values[0]} / ${values[1]}`
})
</script>

<template>
  <article class="match-card">
    <div class="card-head">
      <NuxtLink :to="linkTo" class="card-head-main focus-ring">
        <span class="league">
          <span class="code">{{ match.leagueCode }}</span>
          <span class="name">{{ match.leagueName }}</span>
        </span>
      </NuxtLink>

      <a v-if="showFlashQ && canOpenFlashQ" :href="flashQUrl" class="flashq-mini focus-ring" aria-label="使用闪Q分析">
        <Zap :size="12" />
        <span>闪Q</span>
      </a>
      <button
        v-else-if="showFlashQ"
        type="button"
        class="flashq-mini locked focus-ring"
        :title="flashQLockMessage"
        aria-label="免费版暂未开放闪Q"
        disabled
      >
        <Zap :size="12" />
        <span>闪Q</span>
      </button>

      <NuxtLink :to="linkTo" class="head-right focus-ring">
        <span :class="['status', `st-${match.status}`]">
          <i v-if="match.status === 'started'" class="live-dot" aria-hidden="true" />{{ statusLabel }}
        </span>
        <span class="num kick-off">{{ kickOff }}</span>
        <span v-if="twoWay && handicapLabel" class="tag tag-quant num">{{ handicapLabel }}</span>
        <span v-if="match.isJc" class="tag tag-brand">竞彩</span>
      </NuxtLink>
    </div>

    <NuxtLink :to="linkTo" class="match-main focus-ring">
      <div v-if="scoreText" class="score-strip">
        <span class="sc-label">比分</span>
        <span class="sc-main num">{{ scoreText }}</span>
        <span v-if="match.halfScoreText" class="sc-half">半 {{ match.halfScoreText }}</span>
      </div>

      <div class="grid-legend">
        <span class="lg-team">球队</span>
        <span>必发</span>
        <span>必指</span>
        <span class="lg-to">成交</span>
      </div>

      <div :class="['market-grid', { 'two-way': twoWay }]">
        <span class="cell selection home">{{ match.homeTeam }}</span>
        <span class="cell num odds">{{ fmtOdds(match.bfPrice?.[0]) }}</span>
        <span class="cell bfidx"><i :style="{ width: `${bfPct(0)}%` }" /><b class="num">{{ bfPct(0) }}</b></span>
        <span class="cell turnover"><i :style="{ width: barWidth(match.turnovers[0]) }" /><b class="num">{{ match.turnovers[0] }}</b></span>

        <template v-if="!twoWay">
          <span class="cell selection handicap">{{ handicapLabel || '平' }}</span>
          <span class="cell num odds">{{ fmtOdds(match.bfPrice?.[1]) }}</span>
          <span class="cell bfidx"><i :style="{ width: `${bfPct(1)}%` }" /><b class="num">{{ bfPct(1) }}</b></span>
          <span class="cell turnover"><i :style="{ width: barWidth(match.turnovers[1]) }" /><b class="num">{{ match.turnovers[1] }}</b></span>
        </template>

        <span class="cell selection away">{{ match.awayTeam }}</span>
        <span class="cell num odds">{{ fmtOdds(match.bfPrice?.[2]) }}</span>
        <span class="cell bfidx"><i :style="{ width: `${bfPct(2)}%` }" /><b class="num">{{ bfPct(2) }}</b></span>
        <span class="cell turnover"><i :style="{ width: barWidth(match.turnovers[2]) }" /><b class="num">{{ match.turnovers[2] }}</b></span>
      </div>

      <div v-if="hasGoalsMarket" class="goals-grid">
        <span class="goals-label">{{ goalsLineLabel }}</span>
        <span class="goals-odds num">大 {{ goalsOddsOver }}</span>
        <span class="goals-odds num">小 {{ goalsOddsUnder }}</span>
        <span class="goals-meta">
          <b class="num">{{ goalsIndexText }}</b>
          <span class="num">{{ goalsTurnoverText }}</span>
        </span>
      </div>

      <div class="meta-foot">
        <span class="m-chip total">成交 <b class="num">{{ totalTurnover }}</b></span>
        <span v-if="match.euro" class="m-chip euro">欧赔 <b class="num">{{ match.euro[0].toFixed(2) }}/{{ match.euro[1].toFixed(2) }}/{{ match.euro[2].toFixed(2) }}</b></span>
        <span v-if="match.kellyVar" class="m-chip kelly" title="跨公司凯利方差 主/平/客">
          凯利方差 <b class="num">{{ match.kellyVar[0] }}/{{ match.kellyVar[1] }}/{{ match.kellyVar[2] }}</b>
        </span>
        <span v-if="hasPoly" class="m-chip poly">P指 <b class="num">{{ match.polyIndex.join('/') }}</b></span>
        <span
          v-if="match.bigBetSide"
          :class="['big-bet', `side-${bigBetSideKey(match.bigBetSide)}`]"
          :title="match.bigBetAttr"
        >
          大单 {{ match.bigBetSide }}<template v-if="match.bigBetOdds">@{{ match.bigBetOdds.toFixed(2) }}</template> {{ match.bigBetAttr }}
        </span>
        <span v-for="flag in match.flags" :key="flag" class="tag tag-signal">{{ flag }}</span>
        <ChevronRight class="chev" :size="16" />
      </div>
    </NuxtLink>
  </article>
</template>

<style scoped>
.match-card {
  display: block;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(26, 34, 51, 0.05);
}

.match-main {
  display: block;
  color: inherit;
  text-decoration: none;
}

.card-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 6px 9px;
  border-bottom: 1px solid var(--divider);
  background: linear-gradient(180deg, var(--surface) 0%, var(--surface) 100%);
}

.card-head-main,
.head-right,
.flashq-mini {
  text-decoration: none;
}

.card-head-main {
  min-width: 0;
  color: inherit;
}

.league {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  gap: 5px;
  font-size: 0.82rem;
  font-weight: 760;
}

.code {
  flex: 0 0 auto;
  padding: 0 4px;
  border-radius: 3px;
  background: #1a2233;
  color: #fff;
  font-size: 0.66rem;
  font-weight: 760;
  letter-spacing: 0.04em;
  line-height: 1.5;
}

.name {
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.head-right {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  color: inherit;
}

.flashq-mini {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 46px;
  min-height: 22px;
  gap: 3px;
  padding: 0 7px;
  border: 1px solid #e8cf83;
  border-radius: 4px;
  background: #fff2bd;
  color: #252d3a;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
  font: inherit;
  font-size: 0.68rem;
  font-weight: 860;
  white-space: nowrap;
}

.flashq-mini.locked {
  cursor: not-allowed;
  border-color: #ddd0a2;
  background: #f7efd3;
  color: var(--muted);
  opacity: 0.68;
}

.flashq-mini:active {
  transform: translateY(1px);
}

.flashq-mini.locked:active {
  transform: none;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 5px;
  height: 17px;
  border-radius: 3px;
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.st-upcoming { background: var(--canvas); color: var(--muted); }
.st-started { background: var(--draw-bg); color: var(--sell); }
.st-finished { background: var(--surface); color: var(--muted); }

.live-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--sell);
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.kick-off {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 760;
}

.score-strip {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 10px;
  padding: 3px 9px;
  background: #fbfdff;
  border-bottom: 1px solid var(--divider);
}

.sc-label { font-size: 0.64rem; font-weight: 800; color: var(--sell); }
.sc-main { font-size: 1.05rem; font-weight: 880; color: var(--ink); letter-spacing: 0.05em; }
.sc-half { font-size: 0.7rem; font-weight: 720; color: var(--muted); }

.grid-legend {
  display: grid;
  grid-template-columns: minmax(60px, 1.05fr) 46px 52px minmax(58px, 0.95fr);
  padding: 2px 0;
  background: var(--panel);
  border-bottom: 1px solid #f0f3f8;
  font-size: 0.6rem;
  font-weight: 760;
  color: var(--soft);
}

.grid-legend span { padding: 0 8px; text-align: center; }
.grid-legend .lg-team { text-align: left; }
.grid-legend .lg-to { text-align: right; }

.market-grid {
  display: grid;
  grid-template-columns: minmax(60px, 1.05fr) 46px 52px minmax(58px, 0.95fr);
  gap: 1px;
  background: var(--divider);
  border-bottom: 1px solid var(--divider);
}

.goals-grid {
  display: grid;
  grid-template-columns: minmax(60px, 1.05fr) 56px 56px minmax(78px, 0.95fr);
  gap: 1px;
  background: var(--divider);
  border-bottom: 1px solid var(--divider);
}

.goals-grid > span {
  display: inline-flex;
  align-items: center;
  min-height: 25px;
  padding: 2px 8px;
  background: #fbfdff;
  font-size: 0.74rem;
  font-weight: 760;
}

.goals-label {
  min-width: 0;
  color: var(--brand-deep);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.goals-odds {
  justify-content: center;
  color: var(--brand-deep);
}

.goals-meta {
  min-width: 0;
  justify-content: flex-end;
  gap: 6px;
  color: var(--muted);
}

.goals-meta b {
  color: var(--brand-deep);
}

.goals-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell {
  display: flex;
  align-items: center;
  min-height: 27px;
  padding: 3px 8px;
  background: var(--panel);
  font-size: 0.86rem;
  font-weight: 720;
}

.selection {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--ink);
}

.selection.handicap {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 740;
}

.odds {
  justify-content: center;
  background: var(--brand-tint);
  color: var(--brand-deep);
  font-weight: 800;
}

.bfidx {
  position: relative;
  justify-content: center;
  overflow: hidden;
  font-size: 0.76rem;
}

.bfidx i {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: rgba(124, 92, 250, 0.16);
}

.bfidx b { position: relative; color: var(--brand-deep); font-weight: 760; }

.turnover {
  position: relative;
  min-width: 0;
  justify-content: flex-end;
  overflow: hidden;
  font-size: 0.78rem;
}

.turnover i {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: rgba(46, 156, 95, 0.16);
}

.turnover b { position: relative; font-weight: 740; color: var(--ink); }

.meta-foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  padding: 6px 9px;
  background: var(--panel);
  font-size: 0.7rem;
  font-weight: 720;
}

.m-chip {
  padding: 1px 6px;
  border-radius: 3px;
  background: #f1f4f9;
  color: var(--muted);
}

.m-chip b { font-weight: 800; color: var(--ink); }
.m-chip.kelly { background: #e9f7ef; color: var(--sell); }
.m-chip.kelly b { color: var(--sell); }
.m-chip.poly { background: #efeaf8; color: #5a3fa0; }
.m-chip.poly b { color: #5a3fa0; }
.m-chip.euro { background: var(--away-bg); color: #8a6212; }
.m-chip.euro b { color: #8a6212; }

.big-bet {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.big-bet.side-home { background: var(--brand-tint); color: var(--brand-deep); }
.big-bet.side-away { background: var(--away-bg); color: #8a6212; }
.big-bet.side-draw { background: var(--canvas); color: var(--muted); }
.big-bet.side-mute { background: var(--canvas); color: var(--muted); }

.chev {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--brand);
}

@media (max-width: 370px) {
  .card-head {
    gap: 5px;
    padding-inline: 7px;
  }

  .flashq-mini {
    min-width: 40px;
    padding-inline: 5px;
  }

  .market-grid,
  .grid-legend,
  .goals-grid {
    grid-template-columns: minmax(52px, 1fr) 42px 46px minmax(52px, 0.85fr);
  }

  .cell {
    padding-inline: 6px;
    font-size: 0.82rem;
  }
}

/* 极小屏(<=340px)兜底：再收紧网格列与字号，确保 4 列不溢出/裁切 */
@media (max-width: 340px) {
  .market-grid,
  .grid-legend,
  .goals-grid {
    grid-template-columns: minmax(44px, 1fr) 38px 40px minmax(44px, 0.8fr);
  }

  .cell {
    padding-inline: 4px;
    font-size: 0.78rem;
  }

  .odds,
  .selection.handicap {
    font-size: 0.76rem;
  }

  .meta-foot {
    gap: 4px;
    font-size: 0.66rem;
  }
}
</style>
