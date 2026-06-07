<script setup lang="ts">
import { ArrowLeft, Lock, RefreshCw } from '@lucide/vue'
import { useEuroOdds, type EuroBookRow, type EuroExtremes } from '~/composables/useEuroOdds'

// 经典版「欧洲指数」（还原旧站 Match/View/EuroOdds）：各博彩公司 即时/初盘 1X2 赔率 + 凯利 + 返还率 + 凯利加权。
const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))

const { data, pending, refresh } = useEuroOdds(eventId)

const status = computed(() => data.value?.status ?? 'pending')
const locked = computed(() => status.value === 'no-access')
const rows = computed<EuroBookRow[]>(() => data.value?.rows ?? [])
const max = computed<EuroExtremes | null>(() => data.value?.max ?? null)
const min = computed<EuroExtremes | null>(() => data.value?.min ?? null)
const avg = computed(() => data.value?.avg ?? null)

function od(n: number): string { return n > 0 ? n.toFixed(2) : '-' }
function kv(n: number): string { return n > 0 ? n.toFixed(2) : '-' }
function vint(n: number | undefined): string { return n != null ? Math.round(n).toString() : '-' }
function avg2(n: number | undefined): string { return n != null && n > 0 ? n.toFixed(2) : '-' }
</script>

<template>
  <div class="eo-page classic-desktop">
    <section class="eo-card">
      <div class="eo-head">
        <div class="eo-head-left">
          <NuxtLink to="/football?view=classic" class="eo-back"><ArrowLeft :size="14" /><span>返回列表</span></NuxtLink>
          <h1>欧洲指数</h1>
          <span class="eo-teams">{{ data?.homeTeam ?? '—' }} VS {{ data?.awayTeam ?? '—' }}</span>
        </div>
        <div class="eo-head-right">
          <span v-if="data?.matchTime" class="eo-time num">比赛时间: {{ data.matchTime }}</span>
          <span v-if="data?.refreshTime" class="eo-time num">刷新时间: {{ data.refreshTime }}</span>
          <button type="button" class="eo-refresh" :disabled="pending" aria-label="刷新" @click="refresh()">
            <RefreshCw :size="13" :class="{ spinning: pending }" />
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
              <tr v-for="r in rows" :key="r.company">
                <td class="c-co">{{ r.company }}</td>
                <td class="c-odds o-home num">{{ od(r.home) }}</td>
                <td class="c-odds o-draw num">{{ od(r.draw) }}</td>
                <td class="c-odds o-away num">{{ od(r.away) }}</td>
                <td class="c-kelly num">{{ kv(r.kHome) }}</td>
                <td class="c-kelly num">{{ kv(r.kDraw) }}</td>
                <td class="c-kelly num">{{ kv(r.kAway) }}</td>
                <td class="c-ret num">{{ kv(r.ret) }}</td>
                <td class="c-wt num">{{ kv(r.wHome) }}</td>
                <td class="c-wt num">{{ kv(r.wDraw) }}</td>
                <td class="c-wt num">{{ kv(r.wAway) }}</td>
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
.eo-table .r-ext td { background: var(--classic-blue-soft); font-weight: 800; color: var(--classic-title); }

.eo-foot {
  display: flex; flex-wrap: wrap; gap: 0;
  margin: 10px 14px 14px; border: 1px solid var(--classic-border); border-radius: 3px; overflow: hidden;
}
.f-cell {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-right: 1px solid var(--classic-border);
  font-size: 0.76rem; font-weight: 740; color: var(--classic-text);
}
.f-cell span { color: var(--classic-title-muted); }
.f-cell b { color: var(--classic-title); font-weight: 840; }
.f-cell.warn { background: #fdeede; }

.dark .eo-table .c-odds { background: rgba(255, 233, 138, 0.08); }
.dark .eo-table .c-kelly { background: rgba(214, 43, 43, 0.1); }
.dark .eo-table .c-wt { background: rgba(36, 86, 166, 0.1); }
.dark .eo-table .c-co,
.dark .eo-table tbody .c-co,
.dark .eo-table .g-live,
.dark .eo-table .g-init,
.dark .eo-table .r-ext td { background: #1d3556; color: #9cc2f0; }
.dark .f-cell.warn { background: #3a2916; }
</style>
