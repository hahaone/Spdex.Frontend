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
  border: 1px solid #dde2eb;
  border-radius: 6px;
  background: #fff;
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
  background: linear-gradient(180deg, #e2f1fa 0%, #c9e5f5 100%);
  color: #1672b3;
}

.summary-card.poly .summary-head {
  background: linear-gradient(180deg, #ece5f4 0%, #dcd2ed 100%);
  color: #4f3f86;
}

.summary-card.goals .summary-head {
  background: linear-gradient(180deg, #e6f3e6 0%, #d0e9d0 100%);
  color: #246b3b;
}

.summary-card.handicap .summary-head {
  background: linear-gradient(180deg, #fff4d8 0%, #ffe7b0 100%);
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
  background: #eaeef4;
}

.row {
  display: grid;
  grid-template-columns: 32px 54px minmax(0, 1fr) 40px;
  gap: 6px;
  align-items: center;
  padding: 4px 9px;
  background: #fff;
  font-size: 0.8rem;
}

.row.col-head {
  background: #ece5f4;
  color: #4f3f86;
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
  color: #1a2233;
}

.row .idx {
  font-weight: 780;
  color: #1672b3;
}

@media (max-width: 370px) {
  .row {
    grid-template-columns: 28px 50px minmax(0, 1fr) 36px;
    gap: 5px;
    padding-inline: 6px;
  }
}
</style>
