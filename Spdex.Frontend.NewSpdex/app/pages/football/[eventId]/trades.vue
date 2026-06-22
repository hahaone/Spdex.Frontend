<script setup lang="ts">
import { ArrowLeft, Lock, RefreshCw } from '@lucide/vue'
import { useBigTrades } from '~/composables/useBigTrades'
import { withMatchListContext } from '~/utils/matchNavigation'

const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))
const detailRoute = computed(() => withMatchListContext(`/football/${eventId.value}`, route.query))

const { data, pending, refresh } = useBigTrades(eventId, 12)

const locked = computed(() => data.value?.accessLocked === true)
const groups = computed(() => data.value?.groups ?? [])

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
  <div class="bt-page">
    <section class="bt-header">
      <NuxtLink :to="detailRoute" class="back focus-ring">
        <ArrowLeft :size="15" />
        <span>返回详情</span>
      </NuxtLink>
      <div class="bt-title">
        <h1>大注提示</h1>
        <span class="teams">{{ data?.homeTeam ?? '—' }} VS {{ data?.awayTeam ?? '—' }}</span>
        <button class="refresh-btn focus-ring" aria-label="刷新" @click="refresh()">
          <RefreshCw :size="15" :class="{ spinning: pending }" />
        </button>
      </div>
    </section>

    <div v-if="locked" class="access-lock">
      <Lock :size="14" />
      <span>{{ data?.lockMessage || '大注提示未对当前会籍开放，专家版及以上可见' }}</span>
    </div>

    <div v-else-if="!groups.length" class="access-lock pending">
      {{ pending ? '加载中…' : '暂无重大成交数据' }}
    </div>

    <div v-else class="bt-grid">
      <section v-for="g in groups" :key="g.key" class="bt-group">
        <div class="bt-group-head">
          <h3>{{ g.label }}</h3>
          <span class="bt-total">总成交 <b class="num">{{ money(g.total) }}</b></span>
        </div>
        <div class="bt-table-wrap scrollbar-none">
          <table class="bt-table">
            <thead>
              <tr>
                <th class="c-sel">选项</th>
                <th>属性</th>
                <th>成交量</th>
                <th>价位</th>
                <th class="c-time">交易时间</th>
                <th>占比</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(t, i) in g.trades" :key="i">
                <td class="c-sel"><b :class="['sel', selClass(t.sel)]">{{ t.sel }}</b></td>
                <td><span :class="['attr', sideClass(t.side)]">{{ t.side }}</span></td>
                <td class="num">{{ money(t.amount) }}</td>
                <td class="num">{{ t.price.toFixed(2) }}</td>
                <td class="num c-time">{{ t.time }}</td>
                <td :class="['num', 'per', `hl${t.highlight}`]">{{ (t.per * 100).toFixed(2) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <p v-if="!locked && groups.length" class="bt-foot">占比 = 该笔成交量 ÷ 当时累计成交。占比越高表示该笔越突出（≥10% 标红、≥30% 加深）。</p>
  </div>
</template>

<style scoped>
.bt-page {
  padding-bottom: 16px;
}

.bt-header {
  padding: 8px 12px 10px;
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

.bt-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.bt-title h1 {
  margin: 0;
  font-size: 1rem;
  font-weight: 820;
}

.bt-title .teams {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 720;
}

.refresh-btn {
  display: inline-flex;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted);
}

.refresh-btn .spinning {
  animation: bt-spin 0.8s linear infinite;
}

@keyframes bt-spin {
  to { transform: rotate(360deg); }
}

.access-lock {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 12px;
  padding: 22px 12px;
  border: 1px dashed var(--away-strong);
  border-radius: 6px;
  background: var(--away-bg);
  color: #8a6212;
  font-size: 0.82rem;
  font-weight: 720;
}

.access-lock.pending {
  border-color: var(--lavender-strong);
  background: var(--lavender);
  color: var(--accent);
}

.bt-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  padding: 10px 12px;
}

.bt-group {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  background: var(--panel);
  box-shadow: var(--card-shadow);
}

.bt-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  background: linear-gradient(180deg, var(--brand-tint) 0%, var(--brand-tint-strong) 100%);
}

.bt-group-head h3 {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 820;
  color: var(--brand-deep);
}

.bt-total {
  font-size: 0.72rem;
  font-weight: 720;
  color: var(--muted);
}

.bt-total b {
  color: var(--ink);
  font-weight: 800;
}

.bt-table-wrap {
  overflow-x: auto;
}

.bt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.76rem;
}

.bt-table th,
.bt-table td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--divider);
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.bt-table th {
  background: var(--lavender);
  color: var(--accent-deep);
  font-size: 0.68rem;
  font-weight: 780;
}

.bt-table th.c-sel,
.bt-table td.c-sel {
  text-align: center;
  width: 38px;
}

.bt-table .c-time {
  text-align: center;
}

.bt-table tbody tr:last-child td {
  border-bottom: 0;
}

.sel {
  display: inline-block;
  min-width: 22px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 800;
  font-size: 0.72rem;
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

.attr {
  font-weight: 760;
}

.attr.buy {
  color: var(--buy);
}

.attr.sell {
  color: var(--sell);
}

.time {
  color: var(--muted);
  font-size: 0.7rem;
}

.per {
  font-weight: 760;
  color: var(--muted);
}

.per.hl1 {
  color: var(--down);
  font-weight: 800;
}

.per.hl2 {
  color: #fff;
  background: var(--down);
  border-radius: 3px;
  font-weight: 820;
}

.bt-foot {
  margin: 2px 14px 0;
  color: var(--soft);
  font-size: 0.68rem;
  line-height: 1.5;
}

@media (min-width: 768px) {
  .bt-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
