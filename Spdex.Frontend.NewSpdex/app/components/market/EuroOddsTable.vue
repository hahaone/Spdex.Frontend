<script setup lang="ts">
import type { EuroOddsSection, EuroLine } from '~/composables/useMatchDetail'

const props = defineProps<{ euro: EuroOddsSection }>()

const marketIdx = ref(0)
const lineIdx = ref(0)

const market = computed(() => props.euro.markets[marketIdx.value] ?? props.euro.markets[0] ?? null)
const lines = computed<EuroLine[]>(() => market.value?.lines ?? [])
const showLineChips = computed(() => lines.value.length > 1)
const line = computed<EuroLine | null>(() => lines.value[lineIdx.value] ?? lines.value[0] ?? null)

/** 公司数最多的线（默认选它，最具代表性）。 */
function densest(ls: EuroLine[]): number {
  let idx = 0
  let n = -1
  ls.forEach((l, i) => {
    if (l.rows.length > n) { n = l.rows.length; idx = i }
  })
  return idx
}

function selectMarket(i: number) {
  if (i === marketIdx.value) return
  marketIdx.value = i
  lineIdx.value = densest(props.euro.markets[i]?.lines ?? [])
}
function selectLine(i: number) {
  lineIdx.value = i
}

/** 每列最高即时赔率（最佳，供高亮）。 */
const bestPerCol = computed<number[]>(() => {
  const l = line.value
  if (!l) return []
  return l.columns.map((_, i) => {
    let best = 0
    for (const r of l.rows) {
      const v = r.cur[i] ?? 0
      if (v > best) best = v
    }
    return best
  })
})

/** 公司名里的 "Bet" 脱敏成 "B*t"（合规）。保留大小写：Bet→B*t / bet→b*t。 */
function maskName(name: string): string {
  return (name || '').replace(/bet/gi, m => (m[0] === 'B' ? 'B*t' : 'b*t'))
}

/** 市场标签：欧赔"大小"按需求改叫"进球"。 */
function marketLabel(label: string): string {
  return label === '大小' ? '进球' : label
}

const isHandicap = computed(() => market.value?.key === 'handicap')

function fmtSigned(n: number): string {
  return (n > 0 ? '+' : '') + n.toFixed(2)
}
function parseLineValue(label: string | null | undefined): number | null {
  const raw = (label || '').trim()
  if (!raw) return null
  const clean = raw.replace(/[＋]/g, '+').replace(/\s*\(.+\)\s*$/, '')
  if (clean.includes('/')) {
    const parts = clean.split('/').map(x => Number.parseFloat(x.trim())).filter(Number.isFinite)
    if (parts.length === 2) return (parts[0]! + parts[1]!) / 2
  }
  const n = Number.parseFloat(clean)
  return Number.isFinite(n) ? n : null
}
function fmtLineValue(label: string | null | undefined): string {
  const n = parseLineValue(label)
  return n == null ? (label || '—') : n.toFixed(2)
}
/** 让球线 chip：成对显示，如「-1.50 / +1.50」。 */
function chipLabel(l: EuroLine): string {
  if (!isHandicap.value) return fmtLineValue(l.label)
  const n = parseLineValue(l.label)
  return n != null ? `${fmtSigned(n)} / ${fmtSigned(-n)}` : (l.label || '—')
}
/** 让球列头把让球标记放赔率前：主 -1.50 / 客 +1.50。 */
function colHeader(col: string): string {
  if (!isHandicap.value || !line.value) return col
  const n = parseLineValue(line.value.label)
  if (n == null) return col
  if (col === '主') return `主 ${fmtSigned(n)}`
  if (col === '客') return `客 ${fmtSigned(-n)}`
  return col
}

function fmt(v: number | undefined): string {
  return typeof v === 'number' && v > 0 ? v.toFixed(2) : '–'
}
function initText(v: number | undefined): string {
  return typeof v === 'number' && v > 0 ? v.toFixed(2) : ''
}
/** 涨跌方向：即 vs 初。即<初=跌(红)，即>初=涨(绿)，否则平。 */
function dir(init: number | undefined, cur: number | undefined): 'up' | 'down' | 'flat' {
  if (!init || !cur || init <= 0 || cur <= 0) return 'flat'
  if (cur > init + 0.001) return 'up'
  if (cur < init - 0.001) return 'down'
  return 'flat'
}
/** 该格是否为本列最佳（最高即时赔率）。 */
function isBest(cur: number | undefined, i: number): boolean {
  return !!cur && cur > 0 && cur === bestPerCol.value[i]
}

watch(() => props.euro.markets.length, () => {
  if (marketIdx.value >= props.euro.markets.length) marketIdx.value = 0
})
watch(market, (m) => {
  if (lineIdx.value >= (m?.lines.length ?? 0)) lineIdx.value = 0
}, { immediate: true })
</script>

<template>
  <section class="euro-v2">
    <div class="euro-head">
      <h3>欧赔</h3>
      <div class="market-tabs scrollbar-none">
        <button
          v-for="(m, i) in euro.markets"
          :key="m.key"
          type="button"
          :class="['mtab focus-ring', { active: i === marketIdx }]"
          @click="selectMarket(i)"
        >
          {{ marketLabel(m.label) }}
        </button>
      </div>
    </div>

    <!-- 盘口线选择（让球 / 大小） -->
    <div v-if="showLineChips" class="line-chips scrollbar-none">
      <span class="line-label">盘口</span>
      <button
        v-for="(l, i) in lines"
        :key="l.key"
        type="button"
        :class="['lchip focus-ring', { active: i === lineIdx }]"
        @click="selectLine(i)"
      >
        {{ chipLabel(l) }}
      </button>
    </div>

    <div v-if="line" class="euro-table-wrap scrollbar-none">
      <table class="euro-table">
        <thead>
          <tr>
            <th class="c-name">公司</th>
            <th v-for="c in line.columns" :key="c">{{ colHeader(c) }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in line.rows" :key="row.name">
            <td class="c-name">{{ maskName(row.name) }}</td>
            <td
              v-for="(c, i) in line.columns"
              :key="i"
              :class="['cell', dir(row.init[i], row.cur[i]), { best: isBest(row.cur[i], i) }]"
            >
              <b class="cur">{{ fmt(row.cur[i]) }}</b>
              <span class="init">{{ initText(row.init[i]) }}</span>
            </td>
          </tr>
          <tr v-if="line.average" class="avg-row">
            <td class="c-name">平均</td>
            <td
              v-for="(c, i) in line.columns"
              :key="i"
              :class="['cell', dir(line.average?.init[i], line.average?.cur[i])]"
            >
              <b class="cur">{{ fmt(line.average?.cur[i]) }}</b>
              <span class="init">{{ initText(line.average?.init[i]) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="euro-legend">
      <span class="lg up">↑ 涨</span>
      <span class="lg down">↓ 跌</span>
      <span class="lg best-lg">最佳</span>
      <span class="muted">· 上即时 / 下初赔 · {{ line?.rows.length ?? 0 }} 家</span>
    </div>
  </section>
</template>

<style scoped>
.euro-v2 {
  padding: 8px 10px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
}

.euro-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.euro-head h3 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 800;
  flex: 0 0 auto;
}

.market-tabs {
  display: inline-flex;
  gap: 4px;
  overflow-x: auto;
  min-width: 0;
}

.mtab {
  flex: 0 0 auto;
  padding: 3px 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 740;
}

.mtab.active {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}

.line-chips {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  margin-bottom: 6px;
  padding-bottom: 1px;
}

.line-label {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 720;
  margin-right: 2px;
}

.lchip {
  flex: 0 0 auto;
  padding: 2px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 740;
  font-variant-numeric: tabular-nums;
}

.lchip.active {
  background: var(--brand-tint);
  border-color: var(--brand-tint-strong);
  color: var(--brand-deep);
}

.euro-table-wrap {
  border: 1px solid var(--line);
  border-radius: 4px;
  overflow-x: auto;
  background: var(--panel);
}

.euro-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.74rem;
}

.euro-table th,
.euro-table td {
  padding: 3px 7px;
  border-bottom: 1px solid var(--divider);
  text-align: right;
  white-space: nowrap;
}

.euro-table th {
  background: var(--lavender);
  color: var(--accent-deep);
  font-size: 0.68rem;
  font-weight: 780;
}

.euro-table th.c-name,
.euro-table td.c-name {
  position: sticky;
  left: 0;
  z-index: 1;
  text-align: left;
  font-weight: 760;
  background: var(--panel);
}

.euro-table th.c-name {
  background: var(--lavender-strong);
}

.euro-table tbody tr:last-child td {
  border-bottom: 0;
}

.cell {
  line-height: 1.05;
  min-width: 46px;
}

.cell .cur {
  display: block;
  color: var(--ink);
  font-weight: 780;
  font-size: 0.75rem;
}

.cell .init {
  display: block;
  color: var(--soft);
  font-size: 0.6rem;
  min-height: 0.72rem;
}

.cell.up .cur {
  color: var(--up);
}

.cell.up .cur::after {
  content: ' ↑';
  font-size: 0.56rem;
}

.cell.down .cur {
  color: var(--down);
}

.cell.down .cur::after {
  content: ' ↓';
  font-size: 0.56rem;
}

.cell.best {
  background: var(--brand-tint);
  box-shadow: inset 0 0 0 1px var(--brand-tint-strong);
}

/* 平均行：与最后一家公司拉开距离 + 双线分隔，突出区别 */
.avg-row td {
  border-top: 3px double var(--brand-tint-strong);
  padding-top: 5px;
  background: var(--brand-tint);
}

.avg-row .c-name {
  color: var(--brand-deep);
  font-weight: 820;
}

.avg-row .cell:not(.up):not(.down) .cur {
  color: var(--brand-deep);
}

.euro-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 5px;
  font-size: 0.68rem;
  color: var(--muted);
}

.lg.up {
  color: var(--up);
  font-weight: 740;
}

.lg.down {
  color: var(--down);
  font-weight: 740;
}

.best-lg {
  padding: 0 5px;
  border-radius: 3px;
  background: var(--brand-tint);
  box-shadow: inset 0 0 0 1px var(--brand-tint-strong);
  color: var(--brand-deep);
  font-weight: 740;
}
</style>
