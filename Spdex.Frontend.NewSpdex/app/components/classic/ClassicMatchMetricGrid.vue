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
  twoWay?: boolean
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
// 挂牌指数(可正负,加 %)、亚洲指数(1 位小数 %)、比分指数/进球均衡(2 位)。0 视作无数据→空。
function pct2(v: number | undefined): string { return v != null && v !== 0 ? `${v.toFixed(2)}%` : '' }
function pct1(v: number | undefined): string { return v != null && v !== 0 ? `${v.toFixed(1)}%` : '' }
function ratio2(v: number | undefined): string { return v != null && v > 0 ? v.toFixed(2) : '' }
// 旧站着色:挂牌指数 正蓝/负绿;亚洲指数 正红/负紫。
function guaClass(v: number | undefined): string { return v == null || v === 0 ? '' : (v > 0 ? 'c-blue' : 'c-green') }
function asianClass(v: number | undefined): string { return v == null || v === 0 ? '' : (v > 0 ? 'c-red' : 'c-purple') }
// 旧站阈值:模拟盈亏 >60 标红、冷热指数 <0 标红(#5/#6)。
function pnlClass(v: number | undefined): string { return v != null && v > 60 ? 'c-red' : '' }
function heatClass(v: number | undefined): string { return v != null && v < 0 ? 'c-red' : '' }

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
// 进球比例(篮球):大/小主点线成交额占比（= 旧站 Per）。
function goalShare(i: number): string {
  const a = props.match.goalsAmount ?? [0, 0]
  const tot = (a[0] ?? 0) + (a[1] ?? 0)
  if (tot <= 0) return ''
  return `${Math.round(((a[i === 0 ? 0 : 1] ?? 0) / tot) * 100)}%`
}
// 亚盘线显示:整数原样,否则一位小数;0 视为无值。
function lineStr(v: number | undefined): string {
  if (v == null || v === 0) return ''
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

interface Col { key: string, label: string, tone: Tone, get: (i: number) => string, strong?: (i: number) => boolean, cls?: (i: number) => string }

const footballColumns: Col[] = [
  { key: 'team', label: '队名', tone: 'team', get: optionLabel, strong: () => true },
  // 标盘必发
  { key: 'turnover', label: '成交', tone: 'deal', get: i => std(i)?.turnover || props.match.turnovers[i] || '' },
  { key: 'index', label: '指数', tone: 'deal', get: i => num(std(i)?.bfIndex) || intList(props.match.bfIndex[i]), strong: () => true },
  { key: 'ratio', label: '比例', tone: 'deal', get: i => std(i)?.ratio || listShare(i) },
  { key: 'pnl', label: '模拟盈亏', tone: 'deal', get: i => signed(std(i)?.pnl), cls: i => pnlClass(std(i)?.pnl) },
  { key: 'price', label: '价位', tone: 'deal', get: i => std(i)?.price || odds(props.match.bfPrice?.[i]) },
  { key: 'listing1', label: '挂牌指数', tone: 'deal', get: i => pct2(props.match.stockStd?.[i]), cls: i => guaClass(props.match.stockStd?.[i]) },
  { key: 'heat', label: '冷热指数', tone: 'deal', get: i => signed(std(i)?.heat), cls: i => heatClass(std(i)?.heat) },
  { key: 'euroAvg', label: '欧洲平均', tone: 'deal', get: i => odds(std(i)?.euroAvg) || odds(props.match.euro?.[i]) },
  { key: 'kellyVar', label: '凯利方差', tone: 'deal', get: i => num(std(i)?.variance) || intList(props.match.kellyVar?.[i]) },
  // 进球(大小)
  { key: 'goalTurnover', label: '进球成交', tone: 'goal', get: i => i === 1 ? '> 2.5 >' : (goal(i)?.turnover || props.match.goalsTurnovers?.[i === 0 ? 0 : 1] || '') },
  { key: 'goalIndex', label: '进球指数', tone: 'goal', get: i => i === 1 ? '' : (num(goal(i)?.bfIndex) || intList(props.match.goalsIndex?.[i === 0 ? 0 : 1])) },
  { key: 'goalRatio', label: '进球比例', tone: 'goal', get: i => i === 1 ? '' : (goal(i)?.ratio || '') },
  { key: 'goalPrice', label: '进球价位', tone: 'goal', get: i => i === 1 ? (props.match.goalsLine || '') : (goal(i)?.price || odds(props.match.goalsOdds?.[i === 0 ? 0 : 1])) },
  { key: 'listing2', label: '挂牌指数', tone: 'goal', get: i => i === 1 ? '' : pct2(props.match.stockGoals?.[i === 0 ? 0 : 1]), cls: i => i === 1 ? '' : guaClass(props.match.stockGoals?.[i === 0 ? 0 : 1]) },
  // 让分
  { key: 'hcpTurnover', label: '让分成交', tone: 'handicap', get: i => hcp(i)?.turnover || '' },
  { key: 'hcpIndex', label: '让分指数', tone: 'handicap', get: i => num(hcp(i)?.bfIndex) },
  { key: 'hcpRatio', label: '让分比例', tone: 'handicap', get: hcpShare },
  { key: 'hcpPrice', label: '让分价位', tone: 'handicap', get: i => hcp(i)?.price || '' },
  { key: 'listing3', label: '挂牌指数', tone: 'handicap', get: i => pct2(props.match.stockHandicap?.[i]), cls: i => guaClass(props.match.stockHandicap?.[i]) },
  // 其他(VendorBase 同源)
  { key: 'asian', label: '亚洲指数', tone: 'extra', get: i => (i === 1 ? pct1(props.match.asianIndex) : ''), cls: i => (i === 1 ? asianClass(props.match.asianIndex) : '') },
  { key: 'csIndex', label: '比分指数', tone: 'extra', get: i => (i === 1 ? ratio2(props.match.csIndex) : '') },
  { key: 'goalBalance', label: '进球均衡', tone: 'extra', get: i => (i === 1 ? ratio2(props.match.goalBalance) : '') },
]

// 篮球(旧 NBAToday)列集:2-way 无平、进球用总分大小(中间行放分界线/VS,标盘列留空)。
// 去掉足球专属/无篮球数据列:冷热/欧洲平均/凯利方差/让分四列/亚洲指数/比分指数/进球均衡;
// 亚盘让分/亚盘总进球(~0.9 亚式赔率)同欧洲指数无数据源,暂不呈现。
const basketballColumns: Col[] = [
  { key: 'team', label: '队名', tone: 'team', get: i => i === 0 ? props.match.homeTeam : i === 2 ? props.match.awayTeam : 'VS', strong: () => true },
  { key: 'index', label: '指数', tone: 'deal', get: i => i === 1 ? '' : (num(std(i)?.bfIndex) || intList(props.match.bfIndex[i])), strong: () => true },
  { key: 'turnover', label: '成交', tone: 'deal', get: i => i === 1 ? '' : (intList(props.match.bfAmounts?.[i]) || std(i)?.turnover || props.match.turnovers[i] || '') },
  { key: 'ratio', label: '比例', tone: 'deal', get: i => i === 1 ? '' : (std(i)?.ratio || listShare(i)) },
  { key: 'pnl', label: '模拟盈亏', tone: 'deal', get: i => i === 1 ? '' : signed(std(i)?.pnl), cls: i => i === 1 ? '' : pnlClass(std(i)?.pnl) },
  { key: 'price', label: '价位', tone: 'deal', get: i => i === 1 ? '' : (std(i)?.price || odds(props.match.bfPrice?.[i])) },
  { key: 'stockStd', label: '挂牌指数', tone: 'deal', get: i => i === 1 ? '' : pct2(props.match.stockStd?.[i]), cls: i => i === 1 ? '' : guaClass(props.match.stockStd?.[i]) },
  // 篮球进球各列取后端「主点线」快照(payload),不走 enrich —— VendorBase 的 Uo* 会指向过期线、对不上显示的线。
  { key: 'goalLine', label: '进球分界', tone: 'goal', get: i => i === 0 ? 'Over' : i === 2 ? 'Under' : (props.match.goalsLine ? `${props.match.goalsLine}分` : '') },
  { key: 'goalTurnover', label: '进球成交', tone: 'goal', get: i => i === 1 ? '' : intList(props.match.goalsAmount?.[i === 0 ? 0 : 1]) },
  { key: 'goalRatio', label: '进球比例', tone: 'goal', get: i => i === 1 ? '' : goalShare(i) },
  { key: 'goalPrice', label: '进球价位', tone: 'goal', get: i => i === 1 ? '' : odds(props.match.goalsOdds?.[i === 0 ? 0 : 1]) },
  { key: 'goalIndex', label: '进球指数', tone: 'goal', get: i => i === 1 ? '' : intList(props.match.goalsIndex?.[i === 0 ? 0 : 1]) },
  { key: 'goalStock', label: '挂牌指数', tone: 'goal', get: i => i === 1 ? '' : pct2(props.match.stockGoals?.[i === 0 ? 0 : 1]), cls: i => i === 1 ? '' : guaClass(props.match.stockGoals?.[i === 0 ? 0 : 1]) },
  { key: 'goalPnl', label: '进球盈亏', tone: 'goal', get: i => i === 1 ? '' : signed(props.match.goalsPnl?.[i === 0 ? 0 : 1]) },
  // 亚盘让球/亚盘总进球:BetFair 最平衡线的 HK 赔率(中间行放线);来自后端 asianLet/asianTotal。
  { key: 'asianLet', label: '亚盘让球', tone: 'extra', get: i => i === 1 ? lineStr(props.match.asianLetLine) : odds(props.match.asianLet?.[i === 0 ? 0 : 1]) },
  { key: 'asianTotal', label: '亚盘总进球', tone: 'extra', get: i => i === 1 ? lineStr(props.match.asianTotalLine) : odds(props.match.asianTotal?.[i === 0 ? 0 : 1]) },
]

interface Cell { key: string, tone: Tone, value: string, strong: boolean, cls: string }
// 足球用宽表;篮球用旧 NBAToday 列集(twoWay 即篮球)。
const columns = computed<Col[]>(() => props.twoWay ? basketballColumns : footballColumns)
// 均 3 行;篮球中间行只承载 进球分界(线)/VS,标盘列留空(2-way 无平)。
const rowIndexes = [0, 1, 2]
const rows = computed<Cell[][]>(() => rowIndexes.map(i => columns.value.map(c => ({
  key: c.key,
  tone: c.tone,
  value: c.get(i),
  strong: c.strong?.(i) ?? false,
  cls: c.cls?.(i) ?? '',
}))))
</script>

<template>
  <div class="classic-grid-wrap">
    <table class="classic-metric-grid">
      <thead>
        <tr>
          <th v-for="c in columns" :key="c.key" :class="[`tone-${c.tone}`, `col-${c.key}`, { team: c.key === 'team' }]">{{ c.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, ri) in rows" :key="ri">
          <td
            v-for="cell in row"
            :key="cell.key"
            :class="[`tone-${cell.tone}`, `col-${cell.key}`, cell.cls, { strong: cell.strong, blank: !cell.value }]"
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
  font-size: 0.69rem;
  font-variant-numeric: tabular-nums;
}

th,
td {
  height: 28px;
  padding: 0 5px;
  border-right: 1px solid var(--classic-grid);
  border-bottom: 1px solid var(--classic-grid);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

thead th {
  height: 30px;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 760;
  letter-spacing: 0.02em;
  text-align: center;
  border-right-color: rgba(255, 255, 255, 0.14);
  border-bottom: 0;
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

/* #3 成交列(标盘/进球/让分成交)整列紫底白字,复刻旧站对「成交」列的突出(旧站 spec 列 th #9999FF / td #f0e9ff,此处按新主题紫 + 白字更醒目)。放在 tone-* 之后以同特异性覆盖。 */
th.col-turnover,
th.col-goalTurnover,
th.col-hcpTurnover { background: var(--classic-purple); }
td.col-turnover,
td.col-goalTurnover,
td.col-hcpTurnover { background: var(--classic-purple); color: #fff; font-weight: 760; }

/* 整行悬停：半透明蓝色叠层，保留分区底色又给出扫读焦点 */
tbody tr:hover td {
  box-shadow: inset 0 0 0 999px rgba(37, 99, 235, 0.05);
}

th.team,
td.tone-team {
  width: 86px;
  padding-left: 8px;
  text-align: left;
}

td.tone-team {
  background: var(--classic-panel);
  color: var(--classic-text);
  font-weight: 760;
}

td.strong:not(.tone-team) {
  color: var(--classic-link);
  font-weight: 820;
}

td.blank {
  color: var(--classic-title-muted);
  font-weight: 400;
}

/* 旧站着色:挂牌指数 正蓝/负绿;亚洲指数 正红/负紫 */
td.c-blue { color: #1f6fe0; font-weight: 760; }
td.c-green { color: #1f9e63; font-weight: 760; }
td.c-red { color: #d62b2b; font-weight: 760; }
td.c-purple { color: #7c5cf0; font-weight: 760; }

.dark td.c-blue { color: #6fa8ff; }
.dark td.c-green { color: #4fc78c; }
.dark td.c-red { color: #ff7676; }
.dark td.c-purple { color: #a98bff; }

tbody tr:last-child td {
  border-bottom: 0;
}
</style>
