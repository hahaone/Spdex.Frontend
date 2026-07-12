<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import type { JcSection } from '~/types/market'

const props = defineProps<{
  jc: JcSection
  title?: string
}>()

const emit = defineEmits<{
  open: []
}>()

const mainMarket = computed(() =>
  props.jc.markets.find(m => m.key === 'SportteryNWDL') ?? props.jc.markets[0] ?? null)

function fmtAmount(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '-'
}

function fmtOdds(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-'
}
</script>

<template>
  <button class="jc-summary-card" type="button" @click="emit('open')">
    <div class="summary-head">
      <span class="title">{{ title || jc.title }}</span>
      <ChevronRight :size="16" />
    </div>

    <div class="heat-strip">
      <span>玩法 <b class="num">{{ jc.markets.length }}</b></span>
      <span>走势 <b class="num">{{ (jc.trendMarkets ?? []).reduce((sum, market) => sum + market.points.length, 0) }}</b></span>
      <span v-if="jc.totalHeat">热度 <b class="num">{{ fmtAmount(jc.totalHeat) }}</b></span>
    </div>

    <div v-if="mainMarket" class="summary-grid">
      <div class="row col-head">
        <span>选项</span>
        <span class="num">官方</span>
        <span class="num">玩法</span>
      </div>
      <div v-for="row in mainMarket.rows.slice(0, 3)" :key="row.key" class="row data">
        <b>{{ row.selection }}</b>
        <span class="num">{{ fmtOdds(row.officialOdds) }}</span>
        <span class="num">{{ mainMarket.title }}</span>
      </div>
    </div>

    <div v-else class="empty-note">{{ jc.note || '暂无竞彩赔率' }}</div>
  </button>
</template>

<style scoped>
.jc-summary-card {
  display: grid;
  align-content: start;
  width: 100%;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--ink);
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
  background: linear-gradient(180deg, var(--brand-tint) 0%, var(--brand-tint-strong) 100%);
  color: var(--brand-deep);
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

.heat-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 9px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 760;
}

.heat-strip b {
  color: var(--ink);
}

.summary-grid {
  display: grid;
  gap: 1px;
  background: var(--divider);
}

.row {
  display: grid;
  grid-template-columns: 44px 64px minmax(0, 1fr);
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

.empty-note {
  padding: 10px 9px;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 720;
}
</style>
