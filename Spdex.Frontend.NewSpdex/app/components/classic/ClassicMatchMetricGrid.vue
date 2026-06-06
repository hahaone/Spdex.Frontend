<script setup lang="ts">
import type { MatchSummary } from '~/types/match'
import type { MatchEnrich } from '~/composables/useClassicMatchEnrich'

/**
 * 旧站今日足球宽表（24 列）。诚实填充:
 * - Tier A(列表 payload,常驻):成交/指数/比例/价位/进球大小/凯利方差/欧赔。
 * - Tier B/C(详情 BFF,滚入视口后由 enrich 补):模拟盈亏/冷热/真实比例/欧均/让分三列。
 * - Tier D(列表与详情都无来源):挂牌指数/亚洲指数/比分指数/进球均衡/媒体指数 → 一律 "-",绝不造数。
 */
const props = defineProps<{
  match: MatchSummary
  enrich: MatchEnrich | null
}>()

type Tone = 'team' | 'deal' | 'goal' | 'handicap' | 'extra'

const SEL = ['home', 'draw', 'away'] as const

function std(i: number) {
  const key = SEL[i]
  return key ? props.enrich?.standard?.[key] : undefined
}
function hcp(i: number) {
  const key = SEL[i]
  return key ? props.enrich?.handicap?.[key] : undefined
}
function goal(i: number) {
  const k = i === 0 ? 'over' : i === 2 ? 'under' : ''
  return k ? props.enrich?.goals?.[k] : undefined
}

function odds(v: number | undefined): string { return v != null && v > 0 ? v.toFixed(2) : '' }
function num(v: number | undefined): string { return v != null && v !== 0 ? Math.round(v).toLocaleString('en-US') : (v === 0 ? '0' : '') }
function intList(v: number | undefined): string { return v != null && v > 0 ? Math.round(v).toLocaleString('en-US') : '' }
function signed(v: number | undefined): string { if (v == null) return ''; const r = Math.round(v); return r > 0 ? `+${r}` : String(r) }

function optionLabel(i: number): string {
  if (i === 0) return props.match.homeTeam
  if (i === 1) return props.match.handicap || '让球'
  return props.match.awayTeam
}

// 比例(标盘):优先详情真实金额占比,否则用列表必指占比(与成交分摊口径自洽)
const bfSum = computed(() => { const [h = 0, d = 0, a = 0] = props.match.bfIndex; return h + d + a })
function listShare(i: number): string {
  const v = props.match.bfIndex[i] ?? 0
  return bfSum.value > 0 ? `${Math.round((v / bfSum.value) * 100)}%` : ''
}
// 让分比例:让分行 bfIndex(=1X2 权重)占比
const hcpSum = computed(() => SEL.reduce((s, k) => s + (props.enrich?.handicap?.[k]?.bfIndex ?? 0), 0))
function hcpShare(i: number): string {
  const v = hcp(i)?.bfIndex
  if (v == null || hcpSum.value <= 0) return ''
  return `${Math.round((v / hcpSum.value) * 100)}%`
}

interface Col { key: string, label: string, tone: Tone, get: (i: number) => string, strong?: (i: number) => boolean }

const columns: Col[] = [
  { key: 'team', label: '队名', tone: 'team', get: optionLabel, strong: () => true },
  // 标盘必发
  { key: 'turnover', label: '成交', tone: 'deal', get: i => std(i)?.turnover || props.match.turnovers[i] || '' },
  { key: 'index', label: '指数', tone: 'deal', get: i => num(std(i)?.bfIndex) || intList(props.match.bfIndex[i]), strong: () => true },
  { key: 'ratio', label: '比例', tone: 'deal', get: i => std(i)?.ratio || listShare(i) },
  { key: 'pnl', label: '模拟盈亏', tone: 'deal', get: i => signed(std(i)?.pnl) },
  { key: 'price', label: '价位', tone: 'deal', get: i => std(i)?.price || odds(props.match.bfPrice?.[i]) },
  { key: 'listing1', label: '挂牌指数', tone: 'deal', get: () => '' },
  { key: 'heat', label: '冷热指数', tone: 'deal', get: i => signed(std(i)?.heat) },
  { key: 'euroAvg', label: '欧洲平均', tone: 'deal', get: i => odds(std(i)?.euroAvg) || odds(props.match.euro?.[i]) },
  { key: 'kellyVar', label: '凯利方差', tone: 'deal', get: i => num(std(i)?.variance) || intList(props.match.kellyVar?.[i]) },
  // 进球(大小)
  { key: 'goalTurnover', label: '进球成交', tone: 'goal', get: i => i === 1 ? (props.match.goalsLine || '') : (goal(i)?.turnover || props.match.goalsTurnovers?.[i === 0 ? 0 : 1] || '') },
  { key: 'goalIndex', label: '进球指数', tone: 'goal', get: i => i === 1 ? '' : (num(goal(i)?.bfIndex) || intList(props.match.goalsIndex?.[i === 0 ? 0 : 1])) },
  { key: 'goalRatio', label: '进球比例', tone: 'goal', get: i => i === 1 ? '' : (goal(i)?.ratio || '') },
  { key: 'goalPrice', label: '进球价位', tone: 'goal', get: i => i === 1 ? (props.match.goalsLine || '') : (goal(i)?.price || odds(props.match.goalsOdds?.[i === 0 ? 0 : 1])) },
  { key: 'listing2', label: '挂牌指数', tone: 'goal', get: () => '' },
  // 让分
  { key: 'hcpTurnover', label: '让分成交', tone: 'handicap', get: i => hcp(i)?.turnover || '' },
  { key: 'hcpIndex', label: '让分指数', tone: 'handicap', get: i => num(hcp(i)?.bfIndex) },
  { key: 'hcpRatio', label: '让分比例', tone: 'handicap', get: hcpShare },
  { key: 'hcpPrice', label: '让分价位', tone: 'handicap', get: i => hcp(i)?.price || '' },
  { key: 'listing3', label: '挂牌指数', tone: 'handicap', get: () => '' },
  // 其他(暂无来源)
  { key: 'asian', label: '亚洲指数', tone: 'extra', get: () => '' },
  { key: 'csIndex', label: '比分指数', tone: 'extra', get: () => '' },
  { key: 'goalBalance', label: '进球均衡', tone: 'extra', get: () => '' },
  { key: 'media', label: '媒体指数', tone: 'extra', get: () => '' },
]

interface Cell { key: string, tone: Tone, value: string, strong: boolean }
const rows = computed<Cell[][]>(() => [0, 1, 2].map(i => columns.map(c => ({
  key: c.key,
  tone: c.tone,
  value: c.get(i),
  strong: c.strong?.(i) ?? false,
}))))
</script>

<template>
  <div class="classic-grid-wrap">
    <table class="classic-metric-grid">
      <thead>
        <tr>
          <th v-for="c in columns" :key="c.key" :class="[`tone-${c.tone}`, { team: c.key === 'team' }]">{{ c.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in rows" :key="ri">
          <td
            v-for="cell in row"
            :key="cell.key"
            :class="[`tone-${cell.tone}`, { strong: cell.strong, blank: !cell.value }]"
          >
            <span class="num">{{ cell.value || '-' }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.classic-grid-wrap {
  overflow-x: auto;
  border-right: 1px solid var(--classic-grid);
  border-left: 1px solid var(--classic-grid);
}

.classic-metric-grid {
  width: 100%;
  min-width: 1200px;
  border-collapse: collapse;
  table-layout: auto;
  background: var(--classic-panel);
  color: var(--classic-text);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

th,
td {
  height: 26px;
  padding: 0 4px;
  border-right: 1px solid var(--classic-grid);
  border-bottom: 1px solid var(--classic-grid);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

th {
  color: #fff;
  font-weight: 800;
  text-align: center;
}

th.tone-deal { background: var(--classic-green); }
th.tone-goal,
th.tone-handicap,
th.tone-extra { background: var(--classic-purple); }
th.tone-team { background: var(--classic-title); }

td.tone-deal { background: var(--classic-green-soft); }
td.tone-goal,
td.tone-handicap { background: var(--classic-purple-soft); }
td.tone-extra { background: var(--classic-blue-soft); }

th.team,
td.tone-team {
  width: 84px;
  text-align: center;
}

td.tone-team {
  background: var(--classic-panel);
  color: var(--classic-text);
  font-weight: 780;
}

td.strong:not(.tone-team) {
  color: var(--classic-link);
  font-weight: 800;
}

td.blank {
  color: var(--classic-title-muted);
}
</style>
