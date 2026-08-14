<script setup lang="ts">
import { ArrowLeft, Lock, RefreshCw, X } from '@lucide/vue'
import { useEuroOdds, type EuroBookRow, type EuroExtremes, type EuroOddsHistoryData } from '~/composables/useEuroOdds'
import type { ApiResponse } from '~/types/auth'
import type { ChartPoint } from '~/types/market'
import { withMatchListContext } from '~/utils/matchNavigation'

// 经典版「欧洲指数」（还原旧站 Match/View/EuroOdds）：各博彩公司 即时/初盘 1X2 赔率 + 凯利 + 返还率 + 凯利加权。
const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))
const listRoute = computed(() => withMatchListContext('/football', route.query, { view: 'classic' }))
const hydrated = ref(false)

const { data, pending, refresh } = useEuroOdds(eventId)

const status = computed(() => data.value?.status ?? 'pending')
const locked = computed(() => status.value === 'no-access')
const rows = computed<EuroBookRow[]>(() => data.value?.rows ?? [])
const max = computed<EuroExtremes | null>(() => data.value?.max ?? null)
const min = computed<EuroExtremes | null>(() => data.value?.min ?? null)
const avg = computed(() => data.value?.avg ?? null)

type TrendMetric = 'odds' | 'kelly' | 'return' | 'weight'
interface TrendSelection { row: EuroBookRow, metric: TrendMetric }

const trendSelection = ref<TrendSelection | null>(null)
const trendHours = ref(6)
const trendData = ref<EuroOddsHistoryData | null>(null)
const trendPending = ref(false)
const trendError = ref('')
let trendRequestId = 0

const trendMeta: Record<TrendMetric, { title: string, labels: { home: string, draw: string | null, away: string | null } }> = {
  odds: { title: '欧赔变化', labels: { home: '主', draw: '平', away: '客' } },
  kelly: { title: '凯利指数变化', labels: { home: '凯利主', draw: '凯利平', away: '凯利客' } },
  return: { title: '返还率变化', labels: { home: '返还率', draw: null, away: null } },
  weight: { title: '加权凯利变化', labels: { home: '加权主', draw: '加权平', away: '加权客' } },
}

const trendTitle = computed(() => trendSelection.value ? trendMeta[trendSelection.value.metric].title : '')
const trendLabels = computed(() => trendSelection.value ? trendMeta[trendSelection.value.metric].labels : trendMeta.odds.labels)
const trendPoints = computed<ChartPoint[]>(() => {
  const metric = trendSelection.value?.metric
  if (!metric) return []
  return (trendData.value?.points ?? []).map((p) => {
    let home = p.home, draw = p.draw, away = p.away
    if (metric === 'kelly') ({ kHome: home, kDraw: draw, kAway: away } = p)
    else if (metric === 'return') { home = p.ret; draw = 0; away = 0 }
    else if (metric === 'weight') ({ wHome: home, wDraw: draw, wAway: away } = p)
    return { time: p.time, ts: p.time, home, draw, away, volume: 0 }
  })
})

async function loadTrend() {
  const selected = trendSelection.value
  if (!selected) return
  const requestId = ++trendRequestId
  trendPending.value = true
  trendError.value = ''
  try {
    const response = await $apiFetch<ApiResponse<EuroOddsHistoryData>>(
      `/api/newspdex/euro-odds/${eventId.value}/history?bid=${selected.row.bid}&hours=${trendHours.value}`,
    )
    if (requestId !== trendRequestId) return
    trendData.value = response.data ?? null
    if (!trendData.value || trendData.value.status !== 'ok')
      trendError.value = trendData.value?.lockMessage || '该时段暂无走势图数据'
  }
  catch {
    if (requestId === trendRequestId) trendError.value = '走势图加载失败，请稍后重试'
  }
  finally {
    if (requestId === trendRequestId) trendPending.value = false
  }
}

function openTrend(row: EuroBookRow, metric: TrendMetric) {
  if (!(row.bid > 0)) return
  trendSelection.value = { row, metric }
  trendData.value = null
  loadTrend()
}

function closeTrend() {
  trendRequestId++
  trendSelection.value = null
  trendData.value = null
  trendPending.value = false
  trendError.value = ''
}

function setTrendHours(hours: number) {
  if (trendHours.value === hours) return
  trendHours.value = hours
  trendData.value = null
  loadTrend()
}

function onTrendKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && trendSelection.value) closeTrend()
}

onMounted(() => {
  hydrated.value = true
  window.addEventListener('keydown', onTrendKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onTrendKeydown))

function od(n: number): string { return n > 0 ? n.toFixed(2) : '-' }
function kv(n: number): string { return n > 0 ? n.toFixed(2) : '-' }
function vint(n: number | undefined): string { return n != null ? Math.round(n).toString() : '-' }
function avg2(n: number | undefined): string { return n != null && n > 0 ? n.toFixed(2) : '-' }
// 公司名里的 "Bet" 脱敏成 "B*t"（合规，与移动端 EuroOddsTable.maskName 同口径）。保留大小写:Bet→B*t / bet→b*t。
function maskCo(name: string): string { return (name || '').replace(/bet/gi, m => (m[0] === 'B' ? 'B*t' : 'b*t')) }
</script>

<template>
  <div class="eo-page classic-desktop">
    <section class="eo-card">
      <div class="eo-head">
        <div class="eo-head-left">
          <NuxtLink :to="listRoute" class="eo-back"><ArrowLeft :size="14" /><span>返回列表</span></NuxtLink>
          <h1>欧洲指数</h1>
          <span class="eo-teams">{{ data?.homeTeam ?? '—' }} VS {{ data?.awayTeam ?? '—' }}</span>
        </div>
        <div class="eo-head-right">
          <span v-if="data?.matchTime" class="eo-time num">比赛时间: {{ data.matchTime }}</span>
          <span v-if="data?.refreshTime" class="eo-time num">刷新时间: {{ data.refreshTime }}</span>
          <button type="button" class="eo-refresh" :disabled="hydrated && pending" aria-label="刷新" @click="refresh()">
            <RefreshCw :size="13" :class="{ spinning: hydrated && pending }" />
          </button>
        </div>
      </div>

      <div v-if="locked" class="eo-state lock">
        <Lock :size="14" /><span>{{ data?.lockMessage || '欧洲指数为专家版及以上会籍专属' }}</span>
      </div>
      <div v-else-if="!rows.length" class="eo-state">{{ pending ? '加载中…' : '暂无欧赔数据' }}</div>

      <template v-else>
        <div class="eo-table-wrap">
          <table class="eo-table">
            <thead>
              <tr>
                <th rowspan="2" class="c-co">公司</th>
                <th colspan="10" class="g-live">即时价位<span class="g-hint">（点击数字查看详细数据走势）</span></th>
                <th colspan="7" class="g-init">初盘价位</th>
              </tr>
              <tr>
                <th class="c-odds">即时主</th><th class="c-odds">即时和</th><th class="c-odds">即时客</th>
                <th class="c-kelly">凯利主</th><th class="c-kelly">凯利和</th><th class="c-kelly">凯利客</th>
                <th class="c-ret">返还率</th>
                <th class="c-wt">凯利加权主</th><th class="c-wt">凯利加权和</th><th class="c-wt">凯利加权客</th>
                <th class="c-odds">初盘主</th><th class="c-odds">初盘和</th><th class="c-odds">初盘客</th>
                <th class="c-kelly">凯利主</th><th class="c-kelly">凯利和</th><th class="c-kelly">凯利客</th>
                <th class="c-ret">返还率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in rows" :key="r.company" :class="{ 'r-outlier': r.isOutlier }" :title="r.outlierReason || undefined">
                <td class="c-co">
                  <span class="co-name">{{ maskCo(r.company) }}</span>
                  <span v-if="r.isOutlier" class="outlier-badge">异常</span>
                </td>
                <td class="c-odds o-home num"><button type="button" class="trend-value" :disabled="r.home <= 0" :aria-label="`${maskCo(r.company)} 欧赔走势`" @click="openTrend(r, 'odds')">{{ od(r.home) }}</button></td>
                <td class="c-odds o-draw num"><button type="button" class="trend-value" :disabled="r.draw <= 0" :aria-label="`${maskCo(r.company)} 欧赔走势`" @click="openTrend(r, 'odds')">{{ od(r.draw) }}</button></td>
                <td class="c-odds o-away num"><button type="button" class="trend-value" :disabled="r.away <= 0" :aria-label="`${maskCo(r.company)} 欧赔走势`" @click="openTrend(r, 'odds')">{{ od(r.away) }}</button></td>
                <td class="c-kelly num"><button type="button" class="trend-value" :disabled="r.kHome <= 0" :aria-label="`${maskCo(r.company)} 凯利走势`" @click="openTrend(r, 'kelly')">{{ kv(r.kHome) }}</button></td>
                <td class="c-kelly num"><button type="button" class="trend-value" :disabled="r.kDraw <= 0" :aria-label="`${maskCo(r.company)} 凯利走势`" @click="openTrend(r, 'kelly')">{{ kv(r.kDraw) }}</button></td>
                <td class="c-kelly num"><button type="button" class="trend-value" :disabled="r.kAway <= 0" :aria-label="`${maskCo(r.company)} 凯利走势`" @click="openTrend(r, 'kelly')">{{ kv(r.kAway) }}</button></td>
                <td class="c-ret num"><button type="button" class="trend-value" :disabled="r.ret <= 0" :aria-label="`${maskCo(r.company)} 返还率走势`" @click="openTrend(r, 'return')">{{ kv(r.ret) }}</button></td>
                <td class="c-wt num"><button type="button" class="trend-value" :disabled="r.wHome <= 0" :aria-label="`${maskCo(r.company)} 加权凯利走势`" @click="openTrend(r, 'weight')">{{ kv(r.wHome) }}</button></td>
                <td class="c-wt num"><button type="button" class="trend-value" :disabled="r.wDraw <= 0" :aria-label="`${maskCo(r.company)} 加权凯利走势`" @click="openTrend(r, 'weight')">{{ kv(r.wDraw) }}</button></td>
                <td class="c-wt num"><button type="button" class="trend-value" :disabled="r.wAway <= 0" :aria-label="`${maskCo(r.company)} 加权凯利走势`" @click="openTrend(r, 'weight')">{{ kv(r.wAway) }}</button></td>
                <td class="c-odds o-home num">{{ r.hasInit ? od(r.iHome) : '' }}</td>
                <td class="c-odds o-draw num">{{ r.hasInit ? od(r.iDraw) : '' }}</td>
                <td class="c-odds o-away num">{{ r.hasInit ? od(r.iAway) : '' }}</td>
                <td class="c-kelly num">{{ r.hasInit ? kv(r.ikHome) : '' }}</td>
                <td class="c-kelly num">{{ r.hasInit ? kv(r.ikDraw) : '' }}</td>
                <td class="c-kelly num">{{ r.hasInit ? kv(r.ikAway) : '' }}</td>
                <td class="c-ret num">{{ r.hasInit ? kv(r.iRet) : '' }}</td>
              </tr>
              <tr v-if="max" class="r-ext">
                <td class="c-co">最高值</td>
                <td class="num">{{ od(max.home) }}</td><td class="num">{{ od(max.draw) }}</td><td class="num">{{ od(max.away) }}</td>
                <td class="num">{{ kv(max.kHome) }}</td><td class="num">{{ kv(max.kDraw) }}</td><td class="num">{{ kv(max.kAway) }}</td>
                <td class="num">{{ kv(max.ret) }}</td>
                <td class="num">{{ kv(max.wHome) }}</td><td class="num">{{ kv(max.wDraw) }}</td><td class="num">{{ kv(max.wAway) }}</td>
                <td class="num">{{ od(max.iHome) }}</td><td class="num">{{ od(max.iDraw) }}</td><td class="num">{{ od(max.iAway) }}</td>
                <td class="num">{{ kv(max.ikHome) }}</td><td class="num">{{ kv(max.ikDraw) }}</td><td class="num">{{ kv(max.ikAway) }}</td>
                <td class="num">{{ kv(max.iRet) }}</td>
              </tr>
              <tr v-if="min" class="r-ext">
                <td class="c-co">最低值</td>
                <td class="num">{{ od(min.home) }}</td><td class="num">{{ od(min.draw) }}</td><td class="num">{{ od(min.away) }}</td>
                <td class="num">{{ kv(min.kHome) }}</td><td class="num">{{ kv(min.kDraw) }}</td><td class="num">{{ kv(min.kAway) }}</td>
                <td class="num">{{ kv(min.ret) }}</td>
                <td class="num">{{ kv(min.wHome) }}</td><td class="num">{{ kv(min.wDraw) }}</td><td class="num">{{ kv(min.wAway) }}</td>
                <td class="num">{{ od(min.iHome) }}</td><td class="num">{{ od(min.iDraw) }}</td><td class="num">{{ od(min.iAway) }}</td>
                <td class="num">{{ kv(min.ikHome) }}</td><td class="num">{{ kv(min.ikDraw) }}</td><td class="num">{{ kv(min.ikAway) }}</td>
                <td class="num">{{ kv(min.iRet) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="avg" class="eo-foot">
          <div class="f-cell"><span>主赔平均</span><b class="num">{{ avg2(avg.homeAvg) }}</b></div>
          <div class="f-cell"><span>平赔平均</span><b class="num">{{ avg2(avg.drawAvg) }}</b></div>
          <div class="f-cell"><span>客赔平均</span><b class="num">{{ avg2(avg.awayAvg) }}</b></div>
          <div class="f-cell warn"><span>主凯利方差</span><b class="num">{{ vint(avg.kVarHome) }}</b></div>
          <div class="f-cell warn"><span>平凯利方差</span><b class="num">{{ vint(avg.kVarDraw) }}</b></div>
          <div class="f-cell warn"><span>客凯利方差</span><b class="num">{{ vint(avg.kVarAway) }}</b></div>
          <div class="f-cell"><span>初盘主赔平均</span><b class="num">{{ avg2(avg.iHomeAvg) }}</b></div>
          <div class="f-cell"><span>初盘平赔平均</span><b class="num">{{ avg2(avg.iDrawAvg) }}</b></div>
          <div class="f-cell"><span>初盘客赔平均</span><b class="num">{{ avg2(avg.iAwayAvg) }}</b></div>
          <div class="f-cell warn"><span>初盘主凯利方差</span><b class="num">{{ vint(avg.ikVarHome) }}</b></div>
          <div class="f-cell warn"><span>初盘平凯利方差</span><b class="num">{{ vint(avg.ikVarDraw) }}</b></div>
          <div class="f-cell warn"><span>初盘客凯利方差</span><b class="num">{{ vint(avg.ikVarAway) }}</b></div>
        </div>
      </template>
    </section>

    <Teleport to="body">
      <div v-if="trendSelection" class="trend-modal" role="presentation" @click.self="closeTrend">
        <section class="trend-dialog" role="dialog" aria-modal="true" :aria-label="trendTitle">
          <header class="trend-head">
            <div>
              <h2>{{ maskCo(trendSelection.row.company) }} · {{ trendTitle }}</h2>
              <p>{{ data?.homeTeam }} VS {{ data?.awayTeam }}</p>
            </div>
            <button type="button" class="trend-close" aria-label="关闭走势图" @click="closeTrend"><X :size="18" /></button>
          </header>
          <div class="trend-tools" aria-label="走势图时间范围">
            <button v-for="hours in [6, 24, 72, 168]" :key="hours" type="button" :class="{ active: trendHours === hours }" @click="setTrendHours(hours)">
              {{ hours < 24 ? `${hours}小时` : `${hours / 24}天` }}
            </button>
            <button type="button" class="trend-reload" :disabled="trendPending" aria-label="刷新走势图" @click="loadTrend"><RefreshCw :size="14" :class="{ spinning: trendPending }" /></button>
          </div>
          <div class="trend-body">
            <div v-if="trendPending && !trendPoints.length" class="trend-state">加载走势数据…</div>
            <div v-else-if="trendError || !trendPoints.length" class="trend-state">{{ trendError || '该时段暂无走势图数据' }}</div>
            <LazyStaticTrendChart v-else :points="trendPoints" :height="280" :series-labels="trendLabels" unit="odds" />
          </div>
          <footer v-if="trendPoints.length" class="trend-foot">共 {{ trendPoints.length }} 个原始变化点，时间精确到秒</footer>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.eo-page { min-height: 100vh; padding: 12px; background: var(--classic-bg, #eceff3); }
.eo-card {
  max-width: 1320px; margin: 0 auto;
  border: 1px solid var(--classic-border); border-radius: var(--classic-radius);
  background: var(--classic-panel); box-shadow: var(--classic-shadow); overflow: hidden;
}

.eo-head {
  display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap;
  padding: 12px 14px; border-bottom: 1px solid var(--classic-border);
}
.eo-head-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.eo-back { display: inline-flex; align-items: center; gap: 3px; color: var(--classic-link); font-size: 0.78rem; font-weight: 760; }
.eo-head-left h1 { margin: 0; font-size: 1.15rem; font-weight: 880; color: var(--classic-title); }
.eo-teams { color: var(--classic-text); font-size: 0.86rem; font-weight: 760; }
.eo-head-right { display: flex; align-items: center; gap: 12px; }
.eo-time { color: var(--classic-title-muted); font-size: 0.78rem; font-weight: 720; }
.eo-refresh {
  display: inline-grid; place-items: center; width: 26px; height: 24px;
  border: 1px solid var(--classic-border); border-radius: 2px; background: var(--classic-panel); color: var(--classic-text); cursor: pointer;
}
.spinning { animation: eo-spin 0.8s linear infinite; }
@keyframes eo-spin { to { transform: rotate(360deg); } }

.eo-state {
  display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 120px;
  color: var(--classic-title-muted); font-size: 0.84rem; font-weight: 720;
}
.eo-state.lock { margin: 14px; padding: 24px; border: 1px dashed var(--classic-border); border-radius: 6px; background: var(--classic-blue-soft); color: #8a6212; }

.eo-table-wrap { overflow-x: auto; padding: 12px 14px 0; }
.eo-table {
  width: 100%; min-width: 1180px; border-collapse: collapse;
  font-size: 0.74rem; font-variant-numeric: tabular-nums;
}
.eo-table th, .eo-table td {
  border: 1px solid var(--classic-grid); padding: 5px 6px; text-align: center; white-space: nowrap;
}
.eo-table thead th { font-weight: 820; color: var(--classic-title); }
.eo-table .g-live, .eo-table .g-init { background: var(--classic-blue-soft); font-size: 0.82rem; }
.g-hint { color: var(--classic-title-muted); font-size: 0.68rem; font-weight: 600; }
.eo-table .c-co { background: var(--classic-yellow, #ffe98a); color: var(--classic-title); font-weight: 800; text-align: center; }
.eo-table tbody .c-co { background: var(--classic-blue-soft); }
.eo-table .c-odds { background: #fffbe9; }
.eo-table .c-kelly { background: #fdeeee; }
.eo-table .c-ret { background: #fffbe9; font-weight: 820; }
.eo-table .c-wt { background: #eef4fb; }
.eo-table td.num { color: var(--classic-text); font-family: 'JetBrains Mono', 'SF Mono', monospace; }
.eo-table td.o-home { color: #d62b2b; font-weight: 760; }
.eo-table td.o-draw { color: #2456a6; font-weight: 720; }
.eo-table td.o-away { color: #2456a6; font-weight: 720; }
.eo-table td.c-ret { font-weight: 820; color: var(--classic-title); }
.trend-value {
  display: inline; padding: 0; border: 0; background: transparent; color: inherit;
  font: inherit; font-weight: inherit; cursor: pointer;
}
.trend-value:hover, .trend-value:focus-visible { text-decoration: underline; text-underline-offset: 2px; }
.trend-value:focus-visible { outline: 2px solid var(--classic-link); outline-offset: 2px; }
.trend-value:disabled { cursor: default; text-decoration: none; }
.eo-table .r-ext td { background: var(--classic-blue-soft); font-weight: 800; color: var(--classic-title); }
.eo-table .r-outlier td { opacity: 0.62; }
.eo-table .r-outlier .co-name {
  color: #9a6a14;
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}
.outlier-badge {
  display: inline-block;
  margin-left: 4px;
  padding: 1px 4px;
  border-radius: 2px;
  background: #ffe1b5;
  color: #9a4b08;
  font-size: 0.62rem;
  font-weight: 760;
  text-decoration: none;
}

/* 均值/方差汇总:6 列网格(即时一行、初盘一行),整齐不再 ragged 折行;窄屏降到 3 列。
   gap:1px + 容器底色 = 网格线，免去逐格 border 的 nth-child 维护。 */
.eo-foot {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 1px;
  margin: 10px 14px 14px;
  background: var(--classic-border);
  border: 1px solid var(--classic-border); border-radius: 3px; overflow: hidden;
}
.f-cell {
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  padding: 7px 12px;
  background: var(--classic-panel);
  font-size: 0.74rem; font-weight: 740; color: var(--classic-text); min-width: 0;
}
.f-cell span { color: var(--classic-title-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.f-cell b { color: var(--classic-title); font-weight: 840; flex: 0 0 auto; }
.f-cell.warn { background: #fdeede; }
@media (max-width: 920px) {
  .eo-foot { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

.dark .eo-table .c-odds { background: rgba(255, 233, 138, 0.08); }
.dark .eo-table .c-kelly { background: rgba(214, 43, 43, 0.1); }
.dark .eo-table .c-wt { background: rgba(36, 86, 166, 0.1); }
.dark .eo-table .c-co,
.dark .eo-table tbody .c-co,
.dark .eo-table .g-live,
.dark .eo-table .g-init,
.dark .eo-table .r-ext td { background: #1d3556; color: #9cc2f0; }
.dark .f-cell.warn { background: #3a2916; }

.trend-modal {
  position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center;
  padding: 20px; background: rgba(15, 23, 42, 0.48);
}
.trend-dialog {
  width: min(900px, 100%); max-height: calc(100vh - 40px); overflow: auto;
  border: 1px solid var(--classic-border, #d8dee8); border-radius: 6px;
  background: var(--classic-panel, #fff); box-shadow: 0 18px 50px rgba(15, 23, 42, 0.25);
}
.trend-head {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 16px 12px; border-bottom: 1px solid var(--classic-border, #d8dee8);
}
.trend-head h2 { margin: 0; color: var(--classic-title, #172033); font-size: 1rem; font-weight: 850; }
.trend-head p { margin: 3px 0 0; color: var(--classic-title-muted, #758195); font-size: 0.74rem; font-weight: 680; }
.trend-close, .trend-reload {
  display: inline-grid; place-items: center; width: 30px; height: 28px;
  border: 1px solid var(--classic-border, #d8dee8); border-radius: 4px;
  background: var(--classic-panel, #fff); color: var(--classic-text, #46536a); cursor: pointer;
}
.trend-tools { display: flex; align-items: center; gap: 6px; padding: 10px 16px 0; }
.trend-tools > button:not(.trend-reload) {
  min-width: 58px; height: 28px; padding: 0 10px; border: 1px solid var(--classic-border, #d8dee8);
  border-radius: 4px; background: var(--classic-panel, #fff); color: var(--classic-text, #46536a);
  font-size: 0.72rem; font-weight: 740; cursor: pointer;
}
.trend-tools > button.active { border-color: var(--classic-link, #276ee8); background: var(--classic-link, #276ee8); color: #fff; }
.trend-body { min-height: 320px; padding: 10px 14px 4px; }
.trend-state { display: grid; place-items: center; min-height: 280px; color: var(--classic-title-muted, #758195); font-size: 0.82rem; font-weight: 700; }
.trend-foot { padding: 0 16px 12px; color: var(--classic-title-muted, #758195); font-size: 0.7rem; text-align: right; }
.dark .trend-dialog, .dark .trend-close, .dark .trend-reload, .dark .trend-tools > button:not(.active) { background: #172235; }
@media (max-width: 640px) {
  .trend-modal { padding: 8px; }
  .trend-dialog { max-height: calc(100vh - 16px); }
  .trend-tools { overflow-x: auto; }
  .trend-body { min-height: 260px; padding-inline: 6px; }
}
</style>
