<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import type { MarketMetricRow } from '~/types/market'

defineProps<{
  title: string
  tone: 'standard' | 'poly' | 'goals' | 'handicap'
  rows: MarketMetricRow[]
  indexLabel: string
}>()

const emit = defineEmits<{
  open: []
}>()

function rowClass(row: MarketMetricRow): string {
  if (row.key === 'home' || row.key === 'over') return 'row-home'
  if (row.key === 'draw' || row.key === 'line') return 'row-draw'
  if (row.key === 'away' || row.key === 'under') return 'row-away'
  return ''
}

function indexValue(row: MarketMetricRow, tone: string): string {
  if (tone === 'poly') return row.polyIndex !== undefined ? String(row.polyIndex) : '-'
  return row.bfIndex !== undefined ? String(row.bfIndex) : '-'
}
</script>

<template>
  <button :class="['summary-card', tone]" type="button" @click="emit('open')">
    <div class="summary-head">
      <span class="title">{{ title }}</span>
      <ChevronRight :size="16" />
    </div>
    <div class="summary-grid">
      <div class="col-head row">
        <span>选项</span>
        <span>价位</span>
        <span>成交</span>
        <span>{{ indexLabel }}</span>
      </div>
      <div v-for="row in rows" :key="row.key" :class="['row', 'data', rowClass(row)]">
        <b class="num">{{ row.selection }}</b>
        <span class="num">{{ row.price }}</span>
        <span class="num turnover">{{ row.turnover || '-' }}</span>
        <span class="num idx">{{ indexValue(row, tone) }}</span>
      </div>
    </div>
  </button>
</template>

<style scoped>
.summary-card {
  display: block;
  width: 100%;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  text-align: left;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(26, 34, 51, 0.05);
}

.summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 9px;
}

.summary-card.standard .summary-head {
  background: linear-gradient(180deg, var(--brand-tint) 0%, var(--brand-tint-strong) 100%);
  color: var(--brand-deep);
}

.summary-card.poly .summary-head {
  background: linear-gradient(180deg, var(--lavender) 0%, var(--lavender-strong) 100%);
  color: var(--accent-deep);
}

.summary-card.goals .summary-head {
  background: linear-gradient(180deg, var(--draw-bg) 0%, #d0e9d0 100%);
  color: var(--sell);
}

.summary-card.handicap .summary-head {
  background: linear-gradient(180deg, var(--away-bg) 0%, #ffe7b0 100%);
  color: #8a6212;
}

.summary-head .title {
  font-size: 0.92rem;
  font-weight: 820;
  letter-spacing: 0.02em;
}

.summary-head svg {
  color: currentColor;
  opacity: 0.7;
}

.summary-grid {
  display: grid;
  gap: 1px;
  background: var(--divider);
}

.row {
  display: grid;
  grid-template-columns: 32px 54px minmax(0, 1fr) 40px;
  gap: 6px;
  align-items: center;
  padding: 4px 9px;
  background: var(--panel);
  font-size: 0.8rem;
}

.row.col-head {
  background: var(--lavender);
  color: var(--accent-deep);
  font-size: 0.7rem;
  font-weight: 780;
  letter-spacing: 0.02em;
}

.row.data {
  font-weight: 740;
}

.row b {
  font-weight: 800;
}

.row .num {
  text-align: right;
}

.row b.num {
  text-align: left;
}

.row .turnover {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--ink);
}

.row .idx {
  font-weight: 780;
  color: var(--brand-deep);
}

@media (max-width: 370px) {
  .row {
    grid-template-columns: 28px 50px minmax(0, 1fr) 36px;
    gap: 5px;
    padding-inline: 6px;
  }
}
</style>
