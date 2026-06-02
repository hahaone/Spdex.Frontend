<script setup lang="ts">
import type { MarketMetricRow } from '~/types/market'

const props = defineProps<{
  title: string
  rows: MarketMetricRow[]
  mode: 'standard' | 'poly' | 'goals' | 'handicap' | 'cs' | 'corner'
}>()

const primaryColumns = computed(() => {
  if (props.mode === 'poly') return ['选项', '价位', '成交', '指数', 'BP量比']
  if (props.mode === 'goals') return ['选项', '价位', '成交', '指数', '比例', '挂牌', '均衡']
  if (props.mode === 'handicap') return ['选项', '价位', '成交', '指数', '比例', '挂牌']
  if (props.mode === 'cs') return ['比分', '赔率', '大注']
  if (props.mode === 'corner') return ['区间', '价位', '成交', '比例']
  return ['选项', '价格', '成交', '必指', '比例']
})

function rowClass(row: MarketMetricRow): string {
  if (row.key === 'home' || row.key === 'over') return 'row-home'
  if (row.key === 'draw' || row.key === 'line') return 'row-draw'
  if (row.key === 'away' || row.key === 'under') return 'row-away'
  return ''
}

/** 指数类（必指/进球指数/让分指数/P指）保留整数 */
function fmtInt(v: number | undefined | null): string {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v).toString() : '-'
}
/** 冷热/欧均保留 2 位小数 */
function fmt2(v: number | undefined | null): string {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : '-'
}
/** 方差数值偏小，<0.1 时给 3 位小数，避免显示成 0.00 */
function fmtVar(v: number | undefined | null): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '-'
  return Math.abs(v) < 0.1 ? v.toFixed(3) : v.toFixed(2)
}

/** Poly 成交是美元，加 $ 前缀以区别必发（人民币口径）。 */
function polyTurnover(t: string | undefined): string {
  return t && t !== '-' ? `$${t}` : (t || '-')
}

function rowPrimary(row: MarketMetricRow): string[] {
  if (props.mode === 'poly') return [row.selection, row.price, polyTurnover(row.turnover), fmtInt(row.polyIndex), row.ratio ?? '-']
  if (props.mode === 'goals') return [row.selection, row.price, row.turnover || '-', fmtInt(row.bfIndex), row.ratio ?? '-', row.listing ?? '-', row.balance ?? '-']
  if (props.mode === 'handicap') return [row.selection, row.price, row.turnover || '-', fmtInt(row.bfIndex), row.ratio ?? '-', row.listing ?? '-']
  if (props.mode === 'cs') return [row.selection, row.price, row.turnover || '-']
  if (props.mode === 'corner') return [row.selection, row.price, row.turnover || '-', row.ratio ?? '-']
  return [row.selection, row.price, row.turnover, fmtInt(row.bfIndex), row.ratio ?? '-']
}

function isNegative(value: unknown): boolean {
  return typeof value === 'number' && value < 0
}

/** 盈亏只在 ≥60（强烈盈利信号）时标红；负盈亏不再标红。 */
function isPnlHot(value: unknown): boolean {
  return typeof value === 'number' && value >= 60
}
</script>

<template>
  <section class="market-section">
    <div class="section-title">
      <h2>{{ title }}</h2>
      <span v-if="mode === 'standard'" class="tag tag-brand">核心</span>
    </div>

    <div class="table-wrap scrollbar-none">
      <table class="metric-table">
        <thead>
          <tr>
            <th v-for="column in primaryColumns" :key="column">
              {{ column }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" :class="rowClass(row)">
            <td v-for="(value, index) in rowPrimary(row)" :key="`${row.key}-${index}`" :class="['num', { 'first-col': index === 0 }]">
              {{ value }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="mode === 'standard'" class="extension-section">
      <div class="ext-head">扩展数据</div>
      <div class="extension-grid">
        <div v-for="row in rows" :key="`${row.key}-ext`" :class="['extension-row', rowClass(row)]">
          <b class="ext-key">{{ row.selection }}</b>
          <span :class="{ hot: isPnlHot(row.pnl) }">盈亏 <b class="num">{{ fmtInt(row.pnl) }}</b></span>
          <span>挂牌 <b class="num">{{ row.listing ?? '-' }}</b></span>
          <span :class="{ negative: isNegative(row.heat) }">冷热 <b class="num">{{ fmt2(row.heat) }}</b></span>
          <span>欧均 <b class="num">{{ fmt2(row.euroAvg) }}</b></span>
          <span>方差 <b class="num">{{ fmtVar(row.variance) }}</b></span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.market-section {
  padding: 8px 10px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
}

.section-title {
  margin-bottom: 6px;
}

.section-title h2 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 800;
}

.table-wrap {
  border: 1px solid var(--line);
  border-radius: 4px;
  overflow-x: auto;
  background: var(--panel);
}

.metric-table {
  width: 100%;
  min-width: 320px;
  border-collapse: collapse;
  font-size: 0.78rem;
}

.metric-table th,
.metric-table td {
  padding: 5px 7px;
  border-bottom: 1px solid var(--divider);
  text-align: right;
  white-space: nowrap;
  font-weight: 740;
}

.metric-table th {
  background: var(--lavender);
  color: var(--accent-deep);
  font-size: 0.7rem;
  letter-spacing: 0.02em;
  font-weight: 780;
}

.metric-table th:first-child,
.metric-table td.first-col {
  position: sticky;
  left: 0;
  z-index: 1;
  text-align: left;
  font-weight: 780;
}

.metric-table th:first-child {
  background: var(--lavender-strong);
}

.metric-table tbody td.first-col {
  background: inherit;
}

.metric-table tbody tr:last-child td {
  border-bottom: 0;
}

.metric-table tbody tr.row-home td.first-col {
  background: var(--home-bg);
}

.metric-table tbody tr.row-draw td.first-col {
  background: var(--draw-bg);
}

.metric-table tbody tr.row-away td.first-col {
  background: var(--away-bg);
}

.extension-section {
  margin-top: 8px;
}

.ext-head {
  padding: 2px 4px;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 760;
  letter-spacing: 0.02em;
}

.extension-grid {
  display: grid;
  gap: 4px;
  margin-top: 4px;
}

.extension-row {
  display: grid;
  grid-template-columns: 30px repeat(2, minmax(0, 1fr));
  gap: 3px 8px;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: 0.73rem;
  font-weight: 720;
}

.extension-row.row-home {
  border-color: var(--home-strong);
}

.extension-row.row-draw {
  border-color: var(--draw-strong);
}

.extension-row.row-away {
  border-color: var(--away-strong);
}

.extension-row .ext-key {
  grid-row: span 3;
  align-self: center;
  font-size: 0.92rem;
  font-weight: 820;
  color: var(--ink);
}

.extension-row span {
  min-width: 0;
  overflow: hidden;
  color: var(--muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extension-row span b {
  color: var(--ink);
  font-weight: 760;
}

.extension-row span.negative b {
  color: var(--buy);
}

/* 盈亏 ≥60 强烈盈利才标红 */
.extension-row span.hot b {
  color: var(--buy);
}
</style>
