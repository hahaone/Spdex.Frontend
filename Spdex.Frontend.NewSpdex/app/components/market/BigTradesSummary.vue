<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { useBigTrades, type BigTradeGroup } from '~/composables/useBigTrades'

const props = defineProps<{ eventId: number }>()

const { group, pending } = useBigTrades(computed(() => props.eventId), 6)

const blocks = computed<{ label: string, g: BigTradeGroup }[]>(() => {
  const out: { label: string, g: BigTradeGroup }[] = []
  const std = group('std-all')
  if (std && std.trades.length) out.push({ label: '标准盘', g: std })
  const ou = group('ou-all')
  if (ou && ou.trades.length) out.push({ label: '大小球', g: ou })
  return out
})

function money(n: number): string {
  if (!n || n <= 0) return '–'
  return Math.round(n).toLocaleString('en-US')
}
function selClass(sel: string): string {
  if (sel === '主' || sel === '大') return 's-home'
  if (sel === '平') return 's-draw'
  return 's-away'
}
function sideClass(side: string): string {
  return side.includes('买') ? 'buy' : 'sell'
}
</script>

<template>
  <section class="bts">
    <div class="bts-head">
      <h3>重大成交</h3>
      <NuxtLink :to="`/football/${eventId}/trades`" class="more focus-ring">
        <span>大注提示</span>
        <ChevronRight :size="14" />
      </NuxtLink>
    </div>

    <div v-if="!blocks.length" class="bts-empty">{{ pending ? '加载中…' : '暂无重大成交' }}</div>

    <div v-for="b in blocks" :key="b.label" class="bts-block">
      <div class="bts-label">{{ b.label }}</div>
      <ul class="bts-list">
        <li v-for="(t, i) in b.g.trades" :key="i" class="bts-row">
          <b :class="['sel', selClass(t.sel)]">{{ t.sel }}</b>
          <span class="amt num">{{ money(t.amount) }}</span>
          <span class="px num">{{ t.price.toFixed(2) }}</span>
          <span :class="['attr', sideClass(t.side)]">{{ t.side }}</span>
          <span :class="['per', 'num', `hl${t.highlight}`]">{{ (t.per * 100).toFixed(1) }}%</span>
          <span class="time num">{{ t.time.slice(0, 11) }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.bts {
  padding: 9px 10px 10px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  box-shadow: var(--card-shadow);
}

.bts-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.bts-head h3 {
  margin: 0;
  font-size: 0.86rem;
  font-weight: 820;
}

.more {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  color: var(--brand);
  font-size: 0.74rem;
  font-weight: 740;
}

.bts-empty {
  padding: 16px 0;
  text-align: center;
  color: var(--muted);
  font-size: 0.78rem;
}

.bts-block + .bts-block {
  margin-top: 7px;
}

.bts-label {
  margin-bottom: 3px;
  color: var(--accent-deep);
  font-size: 0.7rem;
  font-weight: 780;
}

.bts-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 1px;
  background: var(--divider);
  border: 1px solid var(--divider);
  border-radius: 5px;
  overflow: hidden;
}

.bts-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 40px 32px 46px auto;
  align-items: center;
  gap: 5px;
  padding: 4px 7px;
  background: var(--panel);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.sel {
  text-align: center;
  padding: 1px 0;
  border-radius: 3px;
  font-weight: 800;
}

.sel.s-home {
  background: var(--home-bg);
  color: var(--brand-deep);
}

.sel.s-draw {
  background: var(--draw-bg);
  color: var(--sell);
}

.sel.s-away {
  background: var(--away-bg);
  color: #8a6212;
}

.amt {
  text-align: right;
  font-weight: 800;
  color: var(--ink);
}

.px {
  text-align: right;
  color: var(--muted);
}

.attr {
  text-align: center;
  font-weight: 760;
}

.attr.buy {
  color: var(--buy);
}

.attr.sell {
  color: var(--sell);
}

.per {
  text-align: right;
  font-weight: 760;
  color: var(--muted);
}

.per.hl1 {
  color: var(--down);
  font-weight: 820;
}

.per.hl2 {
  color: #fff;
  background: var(--down);
  border-radius: 3px;
  padding: 0 3px;
  font-weight: 820;
}

.time {
  color: var(--soft);
  font-size: 0.64rem;
  white-space: nowrap;
}
</style>
