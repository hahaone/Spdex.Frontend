<script setup lang="ts">
import { ArrowLeft, Lock, RefreshCw } from '@lucide/vue'
import { useCorrectScore, type CsBlock, type CsCell, type CsScore } from '~/composables/useCorrectScore'

// 经典版「正确比分明细」（还原旧站 Match/View/CorrectScore）：
// 19 比分列 × {赔率/成交/锁定/比例/盈亏/指数} 行,热力着色;多时间块(明细/2小时数据/快速回顾)。
const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))
const reviewMin = ref(360)

const { data, pending, refresh } = useCorrectScore(eventId, reviewMin)

const status = computed(() => data.value?.status ?? 'pending')
const locked = computed(() => status.value === 'no-access')
const scores = computed<CsScore[]>(() => data.value?.scores ?? [])
const blocks = computed<CsBlock[]>(() => data.value?.blocks ?? [])

const reviewOptions = [
  { label: '10分钟前', value: 10 },
  { label: '30分钟前', value: 30 },
  { label: '1小时前', value: 60 },
  { label: '2小时前', value: 120 },
  { label: '6小时前', value: 360 },
  { label: '12小时前', value: 720 },
]

// 每块的指标极值(行内热力归一化)
interface BlockView extends CsBlock { maxTraded: number, maxLocked: number, maxPayoutAbs: number }
const viewBlocks = computed<BlockView[]>(() => blocks.value.map((b) => {
  let mt = 0
  let ml = 0
  let mp = 0
  for (const s of scores.value) {
    const c = b.cells[s.key]
    if (!c) continue
    mt = Math.max(mt, c.traded)
    ml = Math.max(ml, c.locked)
    mp = Math.max(mp, Math.abs(c.payout))
  }
  return { ...b, maxTraded: mt, maxLocked: ml, maxPayoutAbs: mp }
}))

function cell(b: CsBlock, s: CsScore): CsCell | undefined { return b.cells[s.key] }

function fOdds(n: number): string { return n > 0 ? n.toFixed(2) : '' }
function fAmt(n: number): string { return n > 0 ? Math.round(n).toLocaleString('en-US') : '' }
function fPct(n: number): string { return n !== 0 ? `${n.toFixed(2)}%` : '' }
function fPnl(n: number): string { return n !== 0 ? n.toFixed(2) : '' }
function fIdx(n: number): string { return n !== 0 ? Math.round(n).toString() : '' }

function redHeat(v: number, max: number): Record<string, string> {
  if (!(v > 0) || max <= 0) return {}
  const r = Math.min(1, v / max)
  return { background: `rgba(214, 48, 43, ${(0.1 + 0.78 * r).toFixed(3)})`, color: r > 0.42 ? '#fff' : 'inherit' }
}
function pnlHeat(v: number, maxAbs: number): Record<string, string> {
  if (!v || maxAbs <= 0) return {}
  const r = Math.min(1, Math.abs(v) / maxAbs)
  const rgb = v > 0 ? '214, 48, 43' : '38, 132, 86'
  return { background: `rgba(${rgb}, ${(0.1 + 0.78 * r).toFixed(3)})`, color: r > 0.5 ? '#fff' : 'inherit' }
}
function dirArrow(d: number): string { return d > 0 ? '▲' : d < 0 ? '▼' : '' }
function dirCls(d: number): string { return d > 0 ? 'up' : d < 0 ? 'down' : '' }
function tint(s: CsScore): boolean { return s.group % 2 === 0 }
function money(n: number): string { return Math.round(n).toLocaleString('en-US') }
</script>

<template>
  <div class="cs-page classic-desktop">
    <section class="cs-card">
      <div class="cs-head">
        <div class="cs-head-left">
          <NuxtLink to="/football?view=classic" class="cs-back"><ArrowLeft :size="14" /><span>返回列表</span></NuxtLink>
          <h1>正确比分明细</h1>
          <span class="cs-teams">{{ data?.homeTeam ?? '—' }} VS {{ data?.awayTeam ?? '—' }}</span>
        </div>
        <div class="cs-head-right">
          <span v-if="data?.matchTime" class="cs-time num">比赛时间: {{ data.matchTime }}</span>
          <span v-if="data?.refreshTime" class="cs-time num">刷新时间: {{ data.refreshTime }}</span>
          <button type="button" class="cs-refresh" :disabled="pending" aria-label="刷新" @click="refresh()">
            <RefreshCw :size="13" :class="{ spinning: pending }" />
          </button>
        </div>
      </div>

      <div v-if="locked" class="cs-state lock">
        <Lock :size="14" /><span>{{ data?.lockMessage || '正确比分明细为专家版及以上会籍专属' }}</span>
      </div>
      <div v-else-if="!blocks.length" class="cs-state">{{ pending ? '加载中…' : '暂无比分明细数据' }}</div>

      <template v-else>
        <div v-for="(b, bi) in viewBlocks" :key="`${b.offsetMin}-${bi}`" class="cs-block">
          <div v-if="bi > 0" class="cs-block-head">
            <h3>{{ b.label }}</h3>
            <select v-if="b.label === '快速回顾'" v-model.number="reviewMin" class="cs-review">
              <option v-for="o in reviewOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>

          <div class="cs-table-wrap">
            <table class="cs-table">
              <thead>
                <tr>
                  <th class="m-col" />
                  <th v-for="s in scores" :key="s.key" :class="['s-h', { tint: tint(s) }]">{{ s.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th class="m-col">赔率</th>
                  <td v-for="s in scores" :key="s.key" :class="['v', 'num', { tint: tint(s) }]">
                    <template v-if="cell(b, s)"><i :class="['ar', dirCls(cell(b, s)!.oddsDir)]">{{ dirArrow(cell(b, s)!.oddsDir) }}</i>{{ fOdds(cell(b, s)!.odds) }}</template>
                  </td>
                </tr>
                <tr>
                  <th class="m-col">成交</th>
                  <td v-for="s in scores" :key="s.key" class="v num" :style="cell(b, s) ? redHeat(cell(b, s)!.traded, b.maxTraded) : {}">{{ cell(b, s) ? fAmt(cell(b, s)!.traded) : '' }}</td>
                </tr>
                <tr>
                  <th class="m-col">锁定</th>
                  <td v-for="s in scores" :key="s.key" class="v num" :style="cell(b, s) ? redHeat(cell(b, s)!.locked, b.maxLocked) : {}">{{ cell(b, s) ? fAmt(cell(b, s)!.locked) : '' }}</td>
                </tr>
                <tr>
                  <th class="m-col">比例</th>
                  <td v-for="s in scores" :key="s.key" :class="['v', 'num', { tint: tint(s) }]">
                    <template v-if="cell(b, s)"><i :class="['ar', dirCls(cell(b, s)!.ratioDir)]">{{ dirArrow(cell(b, s)!.ratioDir) }}</i>{{ fPct(cell(b, s)!.ratio) }}</template>
                  </td>
                </tr>
                <tr>
                  <th class="m-col">盈亏</th>
                  <td v-for="s in scores" :key="s.key" class="v num" :style="cell(b, s) ? pnlHeat(cell(b, s)!.payout, b.maxPayoutAbs) : {}">{{ cell(b, s) ? fPnl(cell(b, s)!.payout) : '' }}</td>
                </tr>
                <tr>
                  <th class="m-col">指数</th>
                  <td v-for="s in scores" :key="s.key" class="v num" :style="cell(b, s) ? pnlHeat(cell(b, s)!.payout, b.maxPayoutAbs) : {}">{{ cell(b, s) ? fIdx(cell(b, s)!.index) : '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="cs-foot">
            <span class="f-total">总成交量：<b class="num">{{ money(b.totalAmount) }}</b></span>
            <span v-if="bi === 0" class="f-idx">正确比分指数：<b class="num">{{ data?.csIndex?.toFixed(2) ?? '—' }}</b></span>
            <span v-if="bi === 0 && b.bigTrade" class="f-big num">{{ b.bigTrade }}</span>
          </div>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.cs-page {
  min-height: 100vh;
  padding: 12px;
  background: var(--classic-bg, #eceff3);
}

.cs-card {
  max-width: 1320px;
  margin: 0 auto;
  border: 1px solid var(--classic-border);
  border-radius: var(--classic-radius);
  background: var(--classic-panel);
  box-shadow: var(--classic-shadow);
  overflow: hidden;
}

.cs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border-bottom: 1px solid var(--classic-border);
}

.cs-head-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.cs-back { display: inline-flex; align-items: center; gap: 3px; color: var(--classic-link); font-size: 0.78rem; font-weight: 760; }
.cs-head-left h1 { margin: 0; font-size: 1.15rem; font-weight: 880; color: var(--classic-title); }
.cs-teams { color: var(--classic-text); font-size: 0.86rem; font-weight: 760; }
.cs-head-right { display: flex; align-items: center; gap: 12px; }
.cs-time { color: var(--classic-title-muted); font-size: 0.78rem; font-weight: 720; }
.cs-refresh {
  display: inline-grid; place-items: center; width: 26px; height: 24px;
  border: 1px solid var(--classic-border); border-radius: 2px;
  background: var(--classic-panel); color: var(--classic-text); cursor: pointer;
}
.spinning { animation: cs-spin 0.8s linear infinite; }
@keyframes cs-spin { to { transform: rotate(360deg); } }

.cs-state {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 120px; color: var(--classic-title-muted); font-size: 0.84rem; font-weight: 720;
}
.cs-state.lock {
  margin: 14px; padding: 24px; border: 1px dashed var(--classic-border);
  border-radius: 6px; background: var(--classic-blue-soft); color: #8a6212;
}

.cs-block { padding: 12px 14px 4px; }
.cs-block-head { display: flex; align-items: center; gap: 12px; margin: 4px 0 8px; }
.cs-block-head h3 { margin: 0; font-size: 1rem; font-weight: 840; color: var(--classic-title); }
.cs-review {
  height: 26px; padding: 0 6px; border: 1px solid var(--classic-border); border-radius: 2px;
  background: var(--classic-panel); color: var(--classic-text); font-size: 0.78rem; font-weight: 720;
}

.cs-table-wrap { overflow-x: auto; }
.cs-table {
  width: 100%;
  min-width: 1180px;
  border-collapse: collapse;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  table-layout: fixed;
}
.cs-table th,
.cs-table td {
  border: 1px solid var(--classic-grid);
  padding: 4px 4px;
  text-align: center;
  white-space: nowrap;
}
.cs-table .m-col {
  width: 46px;
  background: var(--classic-blue-soft);
  color: var(--classic-title);
  font-weight: 820;
  position: sticky;
  left: 0;
  z-index: 1;
}
.cs-table thead .s-h {
  font-weight: 820;
  color: var(--classic-title);
  background: var(--classic-panel);
}
.cs-table thead .s-h.tint { background: var(--classic-blue-soft); }
.cs-table td.v { font-family: 'JetBrains Mono', 'SF Mono', monospace; color: var(--classic-text); }
.cs-table td.v.tint { background: var(--classic-blue-soft); }

.ar { font-style: normal; font-size: 0.6rem; margin-right: 1px; }
.ar.up { color: #2f9e63; }
.ar.down { color: #d62b2b; }

.cs-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 20px;
  margin-top: 6px;
  padding: 8px 4px 4px;
  border-top: 1px solid var(--classic-border);
  font-size: 0.78rem;
  font-weight: 740;
  color: var(--classic-text);
}
.cs-foot b { color: var(--classic-title); font-weight: 840; }
.f-big { color: var(--classic-title-muted); font-weight: 720; }

.dark .cs-table thead .s-h.tint,
.dark .cs-table td.v.tint,
.dark .cs-table .m-col { background: #1d3556; color: #9cc2f0; }
</style>
