<script setup lang="ts">
import type { EuroOddsSection } from '~/composables/useMatchDetail'

const props = defineProps<{ euro: EuroOddsSection }>()

const active = ref(0)
const market = computed(() => props.euro.markets[active.value] ?? props.euro.markets[0] ?? null)

/** 每列的最高即时赔率（最佳，供高亮）。 */
const bestPerCol = computed<number[]>(() => {
  const m = market.value
  if (!m) return []
  return m.columns.map((_, i) => {
    let best = 0
    for (const r of m.rows) {
      const v = r.cur[i] ?? 0
      if (v > best) best = v
    }
    return best
  })
})

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

watch(() => props.euro.markets.length, (n) => {
  if (active.value >= n) active.value = 0
})
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
          :class="['mtab focus-ring', { active: i === active }]"
          @click="active = i"
        >
          {{ m.label }}
        </button>
      </div>
    </div>

    <div v-if="market" class="euro-table-wrap scrollbar-none">
      <table class="euro-table">
        <thead>
          <tr>
            <th class="c-name">公司</th>
            <th v-for="c in market.columns" :key="c">{{ c }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in market.rows" :key="row.name">
            <td class="c-name">{{ row.name }}</td>
            <td
              v-for="(c, i) in market.columns"
              :key="i"
              :class="['cell', dir(row.init[i], row.cur[i]), { best: isBest(row.cur[i], i) }]"
            >
              <b class="cur">{{ fmt(row.cur[i]) }}</b>
              <span class="init">{{ initText(row.init[i]) }}</span>
            </td>
          </tr>
          <tr v-if="market.average" class="avg-row">
            <td class="c-name">平均</td>
            <td
              v-for="(c, i) in market.columns"
              :key="i"
              :class="['cell', dir(market.average?.init[i], market.average?.cur[i])]"
            >
              <b class="cur">{{ fmt(market.average?.cur[i]) }}</b>
              <span class="init">{{ initText(market.average?.init[i]) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="euro-legend">
      <span class="lg up">↑ 涨</span>
      <span class="lg down">↓ 跌</span>
      <span class="lg best-lg">最佳</span>
      <span class="muted">· 上即时 / 下初赔 · {{ market?.rows.length ?? 0 }} 家</span>
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

.euro-table-wrap {
  border: 1px solid var(--line);
  border-radius: 4px;
  overflow-x: auto;
  background: var(--panel);
}

.euro-table {
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

.avg-row .c-name {
  background: var(--brand-tint);
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
