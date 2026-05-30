<script setup lang="ts">
import { ArrowLeft, Lock, RefreshCw } from '@lucide/vue'
import type { TradeMarketType, TradeSelection } from '~/composables/useTradeTicks'

const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))

const { detail } = useMatchDetail(eventId)
const match = computed(() => detail.value?.match)
const entitlements = useEntitlements()

const type = ref<TradeMarketType>('standard')
const selection = ref<TradeSelection>('home')

const typeOptions = [
  { label: '标盘', value: 'standard' },
  { label: '进球', value: 'goals' },
  { label: '让分', value: 'handicap' },
]

const selectionOptions = [
  { label: '主', value: 'home' },
  { label: '平', value: 'draw' },
  { label: '客', value: 'away' },
]

function selectionColor(sel: string): string {
  if (sel === 'home') return 'row-home'
  if (sel === 'draw') return 'row-draw'
  return 'row-away'
}

const { rows, status: tradeStatus, count, pending, refresh } = useTradeTicks(eventId, type, selection, ref(50))
</script>

<template>
  <div class="trades-page">
    <section class="header">
      <NuxtLink :to="`/football/${eventId}`" class="back focus-ring">
        <ArrowLeft :size="15" />
        <span>返回详情</span>
      </NuxtLink>
      <div class="teams">
        <span>{{ match?.homeTeam ?? '—' }}</span>
        <b class="line">{{ match?.handicap || '—' }}</b>
        <span>{{ match?.awayTeam ?? '—' }}</span>
      </div>
    </section>

    <section class="controls">
      <SegmentedControl v-model="type" :options="typeOptions" dense tone="accent" />
      <div class="selection-row">
        <SegmentedControl v-model="selection" :options="selectionOptions" dense tone="brand" />
        <button class="refresh-btn focus-ring" aria-label="刷新" :disabled="pending" @click="refresh()">
          <RefreshCw :size="15" :class="{ spinning: pending }" />
        </button>
      </div>
    </section>

    <div v-if="!entitlements.tradeDetailTable || tradeStatus === 'no-access'" class="access-lock">
      <Lock :size="14" />
      <span>明细表数据未对当前会籍开放，专家版及以上可见</span>
    </div>

    <div v-else-if="tradeStatus === 'pending'" class="access-lock pending">
      <Lock :size="14" />
      <span>该市场明细待后续接入</span>
    </div>

    <section v-else class="trade-band">
      <div class="section-title">
        <h1>明细表 · {{ selectionOptions.find(o => o.value === selection)?.label }}</h1>
        <span class="hint num">{{ count }} 条 · 30s 自动刷新</span>
      </div>

      <div class="trade-table">
        <div class="trade-head">
          <span>时间</span>
          <span>价位</span>
          <span>成交量</span>
          <span>变化</span>
          <span>属性</span>
          <span>挂牌</span>
        </div>
        <div v-if="!rows.length" class="empty-row">{{ pending ? '加载中…' : '暂无明细' }}</div>
        <div v-for="row in rows" v-else :key="row.id" :class="['trade-row', selectionColor(selection)]">
          <span class="num">{{ row.time }}</span>
          <span class="num">{{ row.price }}</span>
          <span class="num">{{ row.volume }}</span>
          <span :class="['num', row.change.startsWith('-') ? 'negative' : 'positive']">{{ row.change }}</span>
          <span :class="['attr', row.side.includes('买') ? 'buy' : 'sell']">{{ row.side }}</span>
          <span class="num">{{ row.listing }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.trades-page {
  display: grid;
}

.access-lock {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 12px 16px;
  padding: 10px 12px;
  border: 1px dashed var(--away-strong);
  border-radius: 4px;
  background: var(--away-bg);
  color: #8a6212;
  font-size: 0.82rem;
  font-weight: 720;
}

.access-lock.pending {
  border-color: var(--lavender-strong);
  background: #faf8fd;
  color: var(--accent);
}

.empty-row {
  padding: 18px 12px;
  text-align: center;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 720;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.header {
  display: grid;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(180deg, var(--panel) 0%, var(--surface) 100%);
  border-bottom: 1px solid var(--divider);
}

.back {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 4px;
  color: var(--brand);
  font-size: 0.78rem;
  font-weight: 740;
}

.teams {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink);
  font-size: 0.92rem;
  font-weight: 780;
}

.line {
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--brand);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 800;
}

.controls {
  display: grid;
  gap: 6px;
  padding: 8px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
}

.selection-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px;
  gap: 6px;
  align-items: center;
}

.refresh-btn {
  display: inline-grid;
  min-height: 28px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--muted);
}

.trade-band {
  padding: 8px 10px 12px;
  background: var(--panel);
}

.section-title {
  margin-bottom: 6px;
}

.section-title h1 {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 800;
}

.hint {
  font-weight: 720;
  font-size: 0.72rem;
  opacity: 0.86;
}

.trade-table {
  border: 1px solid var(--line);
  border-radius: 4px;
  overflow: hidden;
}

.trade-head,
.trade-row {
  display: grid;
  grid-template-columns: 56px 48px minmax(70px, 1fr) 56px 26px 56px;
  gap: 5px;
  align-items: center;
  padding: 4px 8px;
  font-size: 0.76rem;
  font-weight: 740;
}

.trade-head {
  background: var(--lavender);
  color: var(--accent-deep);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.trade-row {
  border-top: 1px solid var(--divider);
}

.trade-row.row-home {
  background: #eaf4fe;
}

.trade-row.row-home:nth-child(odd) {
  background: var(--home-bg);
}

.trade-row.row-draw {
  background: #effaef;
}

.trade-row.row-draw:nth-child(odd) {
  background: var(--draw-bg);
}

.trade-row.row-away {
  background: #fff9e6;
}

.trade-row.row-away:nth-child(odd) {
  background: var(--away-bg);
}

.attr {
  display: inline-grid;
  place-items: center;
  border-radius: 2px;
  font-size: 0.7rem;
  font-weight: 760;
}

.attr.buy {
  background: rgba(214, 50, 76, 0.16);
  color: #b1253c;
}

.attr.sell {
  background: rgba(46, 156, 95, 0.16);
  color: var(--sell);
}

@media (max-width: 370px) {
  .trade-head,
  .trade-row {
    grid-template-columns: 50px 42px minmax(58px, 1fr) 48px 22px 48px;
    gap: 4px;
    padding-inline: 6px;
  }
}
</style>
