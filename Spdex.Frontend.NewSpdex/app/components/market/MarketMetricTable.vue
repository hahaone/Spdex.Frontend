<script setup lang="ts">
import type { MarketMetricRow } from '~/types/market'

const props = defineProps<{
  title: string
  rows: MarketMetricRow[]
  mode: 'standard' | 'poly' | 'goals' | 'handicap'
}>()

const primaryColumns = computed(() => {
  if (props.mode === 'poly') return ['选项', '价位', '成交', '指数', 'BP量比']
  if (props.mode === 'goals') return ['选项', '价位', '成交', '指数', '比例', '挂牌', '均衡']
  if (props.mode === 'handicap') return ['选项', '价位', '成交', '指数', '比例', '挂牌']
  return ['选项', '价格', '成交', '必指', '比例']
})

function rowClass(row: MarketMetricRow): string {
  if (row.key === 'home' || row.key === 'over') return 'row-home'
  if (row.key === 'draw' || row.key === 'line') return 'row-draw'
  if (row.key === 'away' || row.key === 'under') return 'row-away'
  return ''
}

function rowPrimary(row: MarketMetricRow): string[] {
  if (props.mode === 'poly') return [row.selection, row.price, row.turnover || '-', String(row.polyIndex ?? '-'), row.ratio ?? '-']
  if (props.mode === 'goals') return [row.selection, row.price, row.turnover || '-', String(row.bfIndex ?? '-'), row.ratio ?? '-', row.listing ?? '-', row.balance ?? '-']
  if (props.mode === 'handicap') return [row.selection, row.price, row.turnover || '-', String(row.bfIndex ?? '-'), row.ratio ?? '-', row.listing ?? '-']
  return [row.selection, row.price, row.turnover, String(row.bfIndex ?? '-'), row.ratio ?? '-']
}

function isNegative(value: unknown): boolean {
  return typeof value === 'number' && value < 0
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
          <span :class="{ negative: isNegative(row.pnl) }">盈亏 <b class="num">{{ row.pnl }}</b></span>
          <span>挂牌 <b class="num">{{ row.listing }}</b></span>
          <span :class="{ negative: isNegative(row.heat) }">冷热 <b class="num">{{ row.heat }}</b></span>
          <span>欧均 <b class="num">{{ row.euroAvg }}</b></span>
          <span>方差 <b class="num">{{ row.variance }}</b></span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.market-section {
  padding: 8px 10px 10px;
  background: #ffffff;
  border-bottom: 1px solid #eaeef4;
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
  border: 1px solid #dde2eb;
  border-radius: 4px;
  overflow-x: auto;
  background: #fff;
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
  border-bottom: 1px solid #eaeef4;
  text-align: right;
  white-space: nowrap;
  font-weight: 740;
}

.metric-table th {
  background: #ece5f4;
  color: #4f3f86;
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
  background: #dcd2ed;
}

.metric-table tbody td.first-col {
  background: inherit;
}

.metric-table tbody tr:last-child td {
  border-bottom: 0;
}

.metric-table tbody tr.row-home td.first-col {
  background: #dceefd;
}

.metric-table tbody tr.row-draw td.first-col {
  background: #e6f3e6;
}

.metric-table tbody tr.row-away td.first-col {
  background: #fff4d8;
}

.extension-section {
  margin-top: 8px;
}

.ext-head {
  padding: 2px 4px;
  color: #6b7280;
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
  border: 1px solid #dde2eb;
  border-radius: 4px;
  font-size: 0.73rem;
  font-weight: 720;
}

.extension-row.row-home {
  border-color: #c4dff8;
}

.extension-row.row-draw {
  border-color: #c8e6c9;
}

.extension-row.row-away {
  border-color: #fce4a8;
}

.extension-row .ext-key {
  grid-row: span 3;
  align-self: center;
  font-size: 0.92rem;
  font-weight: 820;
  color: #1a2233;
}

.extension-row span {
  min-width: 0;
  overflow: hidden;
  color: #4a5364;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extension-row span b {
  color: #1a2233;
  font-weight: 760;
}

.extension-row span.negative b {
  color: #d6324c;
}
</style>
