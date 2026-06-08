<script setup lang="ts">
import { ArrowLeft, Lock, RefreshCw } from '@lucide/vue'
import { useOrderDetail, type OrderRow, type OrderSelection } from '~/composables/useOrderDetail'

// 经典版「完整明细」共享视图（还原旧站 op1 Match/View/Normal + Details / NBA/View/...）。
// 足球与篮球共用：sport 决定返回列表/大注提示的链接前缀；篮球为 2-way、进球=总分大小(主点线)。
// 市场感知：明细(standard 主[/平]/客) / 进球明细(goals 大/小) / 比分明细(cs，仅足球)。
const props = withDefaults(defineProps<{
  sport?: 'football' | 'basketball'
}>(), {
  sport: 'football',
})

const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))
const market = computed(() => (typeof route.query.market === 'string' ? route.query.market : 'standard'))
// 大球明细/小球明细 → ?market=goals&side=over|under：进入即定位到对应选项 tab。
const side = computed(() => (typeof route.query.side === 'string' ? route.query.side : ''))
const basePath = computed(() => `/${props.sport}`)

const { data, pending, refresh } = useOrderDetail(eventId, market)

const status = computed(() => data.value?.status ?? 'pending')
const locked = computed(() => status.value === 'no-access')
const rows = computed<OrderRow[]>(() => data.value?.rows ?? [])
const selections = computed<OrderSelection[]>(() => data.value?.selections ?? [])

// tab：'all'（综合）或某选项 key；带 side 参数时初始定位到该选项。
const tab = ref<string>(side.value === 'over' || side.value === 'under' ? side.value : 'all')
const tabs = computed(() => [
  { key: 'all', label: '综合明细' },
  ...selections.value.map(s => ({ key: s.key, label: `${s.tab}明细` })),
])

const MARKET_LABEL: Record<string, string> = { standard: '标盘', goals: '进球', cs: '比分' }
const marketLabel = computed(() => MARKET_LABEL[market.value] ?? '标盘')

const pageTitle = computed(() => {
  if (tab.value === 'all') return data.value?.title ?? '明细'
  const s = selections.value.find(x => x.key === tab.value)
  return `${marketLabel.value}(${s?.tab ?? ''})`
})

function groupHeader(s: OrderSelection): string {
  return market.value === 'standard' ? `${s.tab}：${s.name}` : s.name
}

// 综合明细：按时间分组，各选项并排
interface CombinedRow { ts: string, time: string, byKey: Record<string, OrderRow> }
const combined = computed<CombinedRow[]>(() => {
  const map = new Map<string, CombinedRow>()
  for (const r of rows.value) {
    let e = map.get(r.ts)
    if (!e) { e = { ts: r.ts, time: r.time, byKey: {} }; map.set(r.ts, e) }
    e.byKey[r.side] = r
  }
  return [...map.values()].sort((a, b) => b.ts.localeCompare(a.ts))
})

const sideRows = computed<OrderRow[]>(() => (tab.value === 'all' ? [] : rows.value.filter(r => r.side === tab.value)))

// 分页（旧站每页约 30 行）
const PAGE_SIZE = 30
const page = ref(1)
const total = computed(() => (tab.value === 'all' ? combined.value.length : sideRows.value.length))
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const pagedCombined = computed(() => combined.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const pagedSide = computed(() => sideRows.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const pageList = computed(() => Array.from({ length: pageCount.value }, (_, i) => i + 1))
watch(tab, () => { page.value = 1 })
watch(market, () => { tab.value = 'all'; page.value = 1 })
watch(pageCount, (n) => { if (page.value > n) page.value = n })
function goPage(p: number) {
  page.value = Math.min(pageCount.value, Math.max(1, p))
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ── 格式化 ──
function price(n: number): string { return n > 0 ? n.toFixed(2) : '-' }
function amount(n: number): string { return n > 0 ? Math.round(n).toLocaleString('en-US') : '' }
function change(n: number): string { return n > 0 ? Math.round(n).toLocaleString('en-US') : '' }
function listing(n: number): string { return n !== 0 ? `${n.toFixed(2)}%` : '' }
function lvlOdds(n: number): string { return n > 0 ? n.toFixed(2) : '' }
function lvlSize(n: number): string { return n > 0 ? Math.round(n).toLocaleString('en-US') : '' }
function attrClass(a: string): string {
  if (!a) return ''
  if (a.includes('买')) return 'a-buy'
  if (a.includes('卖')) return 'a-sell'
  return 'a-neutral'
}
</script>

<template>
  <div class="detail-page classic-desktop">
    <section class="dp-card">
      <!-- 头部 -->
      <div class="dp-head">
        <div class="dp-head-left">
          <NuxtLink :to="`${basePath}?view=classic`" class="dp-back"><ArrowLeft :size="14" /><span>返回列表</span></NuxtLink>
          <h1>{{ pageTitle }}</h1>
          <span class="dp-teams">{{ data?.homeTeam ?? '—' }} VS {{ data?.awayTeam ?? '—' }}</span>
        </div>
        <div class="dp-head-right">
          <span v-if="data?.matchTime" class="dp-time num">比赛时间: {{ data.matchTime }}</span>
          <NuxtLink :to="`${basePath}/${eventId}/trades`" class="dp-bignote">大注提示 »</NuxtLink>
          <button type="button" class="dp-refresh" :disabled="pending" aria-label="刷新" @click="refresh()">
            <RefreshCw :size="13" :class="{ spinning: pending }" />
          </button>
        </div>
      </div>

      <!-- tab -->
      <div class="dp-tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          :class="['dp-tab', { active: tab === t.key }]"
          @click="tab = t.key"
        >{{ t.label }}</button>
      </div>

      <!-- 锁定 / 空态 -->
      <div v-if="locked" class="dp-state lock">
        <Lock :size="14" /><span>{{ data?.lockMessage || '完整明细为专家版及以上会籍专属' }}</span>
      </div>
      <div v-else-if="!rows.length" class="dp-state">{{ pending ? '加载中…' : '暂无明细数据' }}</div>

      <template v-else>
        <!-- 综合明细 -->
        <div v-if="tab === 'all'" class="dp-table-wrap">
          <table class="dp-table combined">
            <thead>
              <tr>
                <th rowspan="2" class="c-time">时间</th>
                <th v-for="(s, i) in selections" :key="s.key" colspan="5" :class="`gc-${i % 6}`">{{ groupHeader(s) }}</th>
              </tr>
              <tr>
                <template v-for="(s, i) in selections" :key="s.key">
                  <th :class="`gc-${i % 6}`">价位</th>
                  <th :class="`gc-${i % 6}`">成交量</th>
                  <th :class="`gc-${i % 6}`">成交变化</th>
                  <th :class="`gc-${i % 6}`">属性</th>
                  <th :class="`gc-${i % 6}`">挂牌倾向</th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in pagedCombined" :key="r.ts">
                <td class="c-time num">{{ r.time }}</td>
                <template v-for="(s, i) in selections" :key="s.key">
                  <td class="num cell-home" :class="`bc-${i % 6}`">{{ r.byKey[s.key] ? price(r.byKey[s.key]!.price) : '' }}</td>
                  <td class="num" :class="`bc-${i % 6}`">{{ r.byKey[s.key] ? amount(r.byKey[s.key]!.amount) : '' }}</td>
                  <td class="num" :class="`bc-${i % 6}`">{{ r.byKey[s.key] ? change(r.byKey[s.key]!.change) : '' }}</td>
                  <td :class="[`bc-${i % 6}`, r.byKey[s.key] ? attrClass(r.byKey[s.key]!.attr) : '']">{{ r.byKey[s.key]?.attr || '' }}</td>
                  <td class="num" :class="`bc-${i % 6}`">{{ r.byKey[s.key] ? listing(r.byKey[s.key]!.listing) : '' }}</td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 单选项明细（含挂牌深度） -->
        <div v-else class="dp-table-wrap">
          <table class="dp-table ladder">
            <thead>
              <tr>
                <th rowspan="2" class="c-time">时间</th>
                <th rowspan="2">价位</th>
                <th rowspan="2">成交量</th>
                <th rowspan="2">成交变化</th>
                <th rowspan="2">属性</th>
                <th colspan="6" class="g-sell">卖方挂牌</th>
                <th colspan="6" class="g-buy">买方挂牌</th>
                <th rowspan="2">属性</th>
              </tr>
              <tr>
                <template v-for="i in 3" :key="`s${i}`">
                  <th class="g-sell">价位</th><th class="g-sell">挂牌量</th>
                </template>
                <template v-for="i in 3" :key="`b${i}`">
                  <th class="g-buy">价位</th><th class="g-buy">挂牌量</th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, ri) in pagedSide" :key="`${r.ts}-${ri}`">
                <td class="c-time num">{{ r.time }}</td>
                <td class="num cell-home">{{ price(r.price) }}</td>
                <td class="num">{{ amount(r.amount) }}</td>
                <td class="num">{{ change(r.change) }}</td>
                <td :class="attrClass(r.attr)">{{ r.attr }}</td>
                <!-- 卖方挂牌 = 低价侧(Back,best 在最右),升序展示;买方挂牌 = 高价侧(Lay) -->
                <template v-for="(lv, i) in [...r.back].reverse()" :key="`sell${i}`">
                  <td class="num b-sell">{{ lvlOdds(lv.odds) }}</td>
                  <td class="num b-sell">{{ lvlSize(lv.size) }}</td>
                </template>
                <template v-for="(lv, i) in r.lay" :key="`buy${i}`">
                  <td class="num b-buy">{{ lvlOdds(lv.odds) }}</td>
                  <td class="num b-buy">{{ lvlSize(lv.size) }}</td>
                </template>
                <td :class="['lattr', r.listingAttr ? 'a-neutral' : '']">{{ r.listingAttr }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 分页 -->
        <nav v-if="pageCount > 1" class="dp-pager" aria-label="明细分页">
          <span class="dp-pageinfo">第 {{ page }} 页，共 {{ pageCount }} 页</span>
          <button type="button" class="pg" :disabled="page <= 1" @click="goPage(1)">«</button>
          <button type="button" class="pg" :disabled="page <= 1" @click="goPage(page - 1)">‹</button>
          <button v-for="p in pageList" :key="p" type="button" :class="['pg', 'num', { active: p === page }]" @click="goPage(p)">{{ p }}</button>
          <button type="button" class="pg" :disabled="page >= pageCount" @click="goPage(page + 1)">›</button>
          <button type="button" class="pg" :disabled="page >= pageCount" @click="goPage(pageCount)">»</button>
        </nav>
      </template>
    </section>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100vh;
  padding: 12px;
  background: var(--classic-bg, #eceff3);
}

.dp-card {
  max-width: 1320px;
  margin: 0 auto;
  border: 1px solid var(--classic-border);
  border-radius: var(--classic-radius);
  background: var(--classic-panel);
  box-shadow: var(--classic-shadow);
  overflow: hidden;
}

/* 头部 */
.dp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border-bottom: 1px solid var(--classic-border);
}

.dp-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.dp-back {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--classic-link);
  font-size: 0.78rem;
  font-weight: 760;
}

.dp-head-left h1 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 880;
  color: var(--classic-title);
}

.dp-teams {
  color: var(--classic-text);
  font-size: 0.86rem;
  font-weight: 760;
}

.dp-head-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.dp-time {
  color: var(--classic-title-muted);
  font-size: 0.78rem;
  font-weight: 720;
}

.dp-bignote {
  color: var(--classic-link);
  font-size: 0.8rem;
  font-weight: 800;
}

.dp-refresh {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 24px;
  border: 1px solid var(--classic-border);
  border-radius: 2px;
  background: var(--classic-panel);
  color: var(--classic-text);
  cursor: pointer;
}

.spinning { animation: dp-spin 0.8s linear infinite; }
@keyframes dp-spin { to { transform: rotate(360deg); } }

/* tab */
.dp-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 0;
  padding: 8px 14px 0;
  border-bottom: 1px solid var(--classic-border);
}

.dp-tab {
  min-width: 96px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--classic-border);
  border-bottom: 0;
  border-radius: 4px 4px 0 0;
  margin-right: 4px;
  background: var(--classic-blue-soft);
  color: var(--classic-link);
  font-size: 0.84rem;
  font-weight: 820;
  cursor: pointer;
}

.dp-tab.active {
  background: #2456a6;
  border-color: #2456a6;
  color: #fff;
}

/* 状态 */
.dp-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 120px;
  color: var(--classic-title-muted);
  font-size: 0.84rem;
  font-weight: 720;
}

.dp-state.lock {
  margin: 14px;
  padding: 24px;
  border: 1px dashed var(--classic-border);
  border-radius: 6px;
  background: var(--classic-blue-soft);
  color: #8a6212;
}

/* 表格 */
.dp-table-wrap {
  overflow-x: auto;
  padding: 10px 12px 0;
}

.dp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.74rem;
  font-variant-numeric: tabular-nums;
}

.dp-table th,
.dp-table td {
  padding: 4px 7px;
  border: 1px solid var(--classic-grid);
  text-align: center;
  white-space: nowrap;
}

.dp-table thead th {
  font-weight: 800;
  color: var(--classic-title);
  background: var(--classic-blue-soft);
}

.dp-table .num { text-align: right; font-family: 'JetBrains Mono', 'SF Mono', monospace; }
.dp-table .c-time { color: var(--classic-title-muted); text-align: center; }
.dp-table tbody .cell-home { color: var(--classic-link); font-weight: 760; }

/* 列分组着色（综合明细，按选项序号循环） */
.dp-table th.gc-0 { background: #d6e6fa; color: #1f4e87; }
.dp-table th.gc-1 { background: #d7eede; color: #2f7d54; }
.dp-table th.gc-2 { background: #fdeecb; color: #8a6212; }
.dp-table th.gc-3 { background: #e7e3fb; color: #5b4ba8; }
.dp-table th.gc-4 { background: #d5eef0; color: #1f7480; }
.dp-table th.gc-5 { background: #fbe3ee; color: #9c4a72; }
.dp-table td.bc-0 { background: #f1f7fe; }
.dp-table td.bc-1 { background: #f1f9f4; }
.dp-table td.bc-2 { background: #fdf7ea; }
.dp-table td.bc-3 { background: #f7f5fe; }
.dp-table td.bc-4 { background: #f0fafb; }
.dp-table td.bc-5 { background: #fdf3f8; }

/* 单选项明细：卖方=绿 / 买方=黄 */
.dp-table th.g-sell { background: #d7eede; color: #2f7d54; }
.dp-table th.g-buy { background: #fdeecb; color: #8a6212; }
.dp-table td.b-sell { background: #f1f9f4; }
.dp-table td.b-buy { background: #fdf7ea; }

/* 属性着色 */
.a-buy { color: #d62b2b; font-weight: 780; }
.a-sell { color: #2f7d54; font-weight: 780; }
.a-neutral { color: var(--classic-text); font-weight: 740; }
.lattr { color: var(--classic-purple); font-weight: 740; }

/* 分页 */
.dp-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 5px;
  padding: 12px 0 14px;
}

.dp-pageinfo {
  margin-right: 8px;
  color: var(--classic-title-muted);
  font-size: 0.78rem;
  font-weight: 720;
}

.pg {
  min-width: 28px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--classic-border);
  border-radius: 2px;
  background: var(--classic-panel);
  color: var(--classic-text);
  font-size: 0.76rem;
  font-weight: 740;
  cursor: pointer;
}

.pg:disabled { opacity: 0.45; cursor: not-allowed; }
.pg.active {
  background: #2456a6;
  border-color: #2456a6;
  color: #fff;
  font-weight: 820;
}

.dark .dp-table td.bc-0 { background: rgba(36, 86, 166, 0.12); }
.dark .dp-table td.bc-1, .dark .dp-table td.b-sell { background: rgba(47, 125, 84, 0.12); }
.dark .dp-table td.bc-2, .dark .dp-table td.b-buy { background: rgba(138, 98, 18, 0.12); }
.dark .dp-table td.bc-3 { background: rgba(91, 75, 168, 0.12); }
.dark .dp-table td.bc-4 { background: rgba(31, 116, 128, 0.12); }
.dark .dp-table td.bc-5 { background: rgba(156, 74, 114, 0.12); }
.dark .dp-table th.gc-0 { background: #1d3556; color: #9cc2f0; }
.dark .dp-table th.gc-1, .dark .dp-table th.g-sell { background: #1c3a2a; color: #88d4a6; }
.dark .dp-table th.gc-2, .dark .dp-table th.g-buy { background: #3a3016; color: #e0c585; }
.dark .dp-table th.gc-3 { background: #2c2654; color: #b9aef0; }
.dark .dp-table th.gc-4 { background: #163438; color: #88cdd6; }
.dark .dp-table th.gc-5 { background: #3a1f2e; color: #e3a6c4; }
</style>
