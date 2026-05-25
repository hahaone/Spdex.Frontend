<script setup lang="ts">
import type { CornerBigHoldPageResult, CornerWindowData, CornerItemView, CornerBigItem, CornerPayoutItem } from '~/types/cornerbighold'
import type { PriceSizeRow } from '~/types/bighold'
import { parseRawData } from '~/utils/parseRawData'
import { formatMoney } from '~/utils/formatters'
import {
  type AlignedRow,
  getAlignedRows,
  isBigHighlighted as isBigHighlightedHelper,
  bigTimeColorStyle,
  bigPerDisplay,
  maxTotalStyle,
  densePercent,
  rankClass,
  ssdClass,
} from '~/utils/detailHelpers'

definePageMeta({ layout: 'default' })

const route = useRoute()
const eventId = computed(() => Number(route.query.id) || 0)
const orderParam = computed(() => Number(route.query.order) || 0)

const params = computed(() => ({ id: eventId.value, order: orderParam.value }))
const { data: apiResult, pending } = useCornerBigHold(params)
const pageData = computed(() => apiResult.value?.data as CornerBigHoldPageResult | null)

useHead({
  title: computed(() => pageData.value?.match
    ? `角球 ${pageData.value.match.homeTeam}vs${pageData.value.match.guestTeam}`
    : '角球'),
})

const window = computed<CornerWindowData | null>(() => pageData.value?.window ?? null)

// ── 大注 & Hold ──
const bigList = computed<CornerBigItem[]>(() => pageData.value?.bigList ?? [])
const holdList = computed<CornerBigItem[]>(() => pageData.value?.holdList ?? [])
const minPayoutList = computed<CornerPayoutItem[]>(() => pageData.value?.minPayoutList ?? [])
const maxPayoutList = computed<CornerPayoutItem[]>(() => pageData.value?.maxPayoutList ?? [])
// big_alert: 收集 bigList 中的 selectionName
const bigListNames = computed(() => new Set(bigList.value.map(b => b.selectionName)))

// ── 行展开 ──
const detailComposable = useBigHoldDetail('/api/cornerbighold/previous')
const expandedRows = ref<Set<string>>(new Set())

function toggleRow(item: CornerItemView) {
  if (expandedRows.value.has(item.key)) {
    expandedRows.value.delete(item.key)
  } else {
    expandedRows.value.add(item.key)
  }
}

function getLastPriceRows(item: CornerItemView): PriceSizeRow[] {
  const w = window.value
  if (!w?.lastPrices) return []
  const lp = w.lastPrices.find(p => p.key === item.key)
  if (!lp?.rawData) return []
  return parseRawData(lp.rawData)
}

// ── BigList 展开 ──
const expandedBigRows = ref<Set<number>>(new Set())
function toggleBigRow(big: CornerBigItem) {
  if (expandedBigRows.value.has(big.pcId)) {
    expandedBigRows.value.delete(big.pcId)
  } else {
    expandedBigRows.value.add(big.pcId)
    if (big.pcId) {
      detailComposable.fetchPrevious(big.pcId, big.marketId, big.selectionId, big.refreshTime)
    }
  }
}

watch(bigList, (list) => {
  for (const big of list) {
    if (big.pcId && !detailComposable.cache.has(big.pcId)) {
      detailComposable.fetchPrevious(big.pcId, big.marketId, big.selectionId, big.refreshTime)
    }
  }
}, { immediate: true })

// ── 高亮/样式（页面特有逻辑） ──
function ssdClassFor(val: number, w: CornerWindowData, field: 'MaxBet' | 'TotalBet' | 'MaxHold' | 'TotalHold'): string {
  const t3 = (w as any)[`threshold3Sigma${field}`] as number
  const t2 = (w as any)[`threshold2Sigma${field}`] as number
  return ssdClass(val, t2, t3)
}

/** Selection 名称列：rank 1-4 用 red1-4 + 不在 bigList 中则加 big_alert */
function handicapRankClass(item: CornerItemView): string {
  const rank = item.rankTotalBet
  if (rank >= 1 && rank <= 4) {
    const base = `red${rank}`
    if (!bigListNames.value.has(item.displayName)) {
      return `${base} big_alert`
    }
    return base
  }
  return ''
}

function getBigAlignedRows(big: CornerBigItem): AlignedRow[] {
  const prev = detailComposable.cache.get(big.pcId)
  return getAlignedRows(big.rawData, prev?.rawData ?? null)
}

function isBigHighlighted(big: CornerBigItem): boolean {
  if (!detailComposable.cache.has(big.pcId)) return false
  const prev = detailComposable.cache.get(big.pcId)
  if (!prev?.rawData) return false
  return isBigHighlightedHelper(big.rawData, prev.rawData)
}

/** 渲染一组行 */
function renderGroupLabel(orderIndex: number): string {
  if (orderIndex === 1) return '9 or less'
  if (orderIndex === 2) return '10 - 12'
  return '13 or more'
}
</script>

<template>
  <div class="grid-detail-page">
    <div v-if="pending" class="loading">加载中...</div>

    <template v-else-if="pageData && window">
      <div class="match-header">
        <h5>
          角球: {{ pageData.match.homeTeam }} vs {{ pageData.match.guestTeam }}
          <span>比赛时间: [{{ new Date(pageData.match.matchTime).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }}]</span>
        </h5>
      </div>

      <div class="table-scroll">
        <table class="gridtable">
          <thead>
            <tr>
              <th>Selection</th>
              <th>Odds</th>
              <th>Dense</th>
              <th>Max bet</th>
              <th>MB Odds</th>
              <th>Attr</th>
              <th>Mark</th>
              <th>Total bet</th>
              <th>Max hold</th>
              <th>Total hold</th>
              <th>Max/total</th>
              <th>Rank</th>
            </tr>
          </thead>
          <tbody>
            <!-- Group 1: 9 or less -->
            <template v-for="item in window.group1Items" :key="item.key">
              <tr style="cursor:pointer" @click="toggleRow(item)">
                <td><strong :class="handicapRankClass(item)">{{ item.displayName }}</strong></td>
                <td>{{ item.odds.toFixed(2) }}</td>
                <td>{{ item.dense > 0 ? item.dense.toFixed(2) : '' }} <small v-if="item.denseSize > 0">{{ densePercent(item.denseSize, item.totalBet) }}</small></td>
                <td :class="ssdClassFor(item.maxBet, window, 'MaxBet')">{{ formatMoney(item.maxBet) }}</td>
                <td>{{ item.oddsOnMax > 0 ? item.oddsOnMax.toFixed(2) : '' }}</td>
                <td>{{ item.maxBetAttr }}</td>
                <td>{{ item.maxBetMark }}</td>
                <td :class="ssdClassFor(item.totalBet, window, 'TotalBet')">{{ formatMoney(item.totalBet) }}</td>
                <td :class="ssdClassFor(item.maxHold, window, 'MaxHold')">{{ formatMoney(item.maxHold) }}</td>
                <td :class="ssdClassFor(item.totalHold, window, 'TotalHold')">{{ formatMoney(item.totalHold) }}</td>
                <td :style="maxTotalStyle(item.maxTotal)">{{ (item.maxTotal * 100).toFixed(0) }}%</td>
                <td :class="rankClass(item.rankTotalBet)">{{ item.rankTotalBet }}</td>
              </tr>
              <tr v-if="expandedRows.has(item.key)" class="expand-row">
                <td colspan="12" style="padding:4px">
                  <table class="ex">
                    <thead><tr class="extrth"><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
                    <tbody>
                      <tr v-for="(r, ri) in getLastPriceRows(item)" :key="ri">
                        <td :style="r.toBack > 0 ? 'background:#A6D8FF' : (r.toLay > 0 ? 'background:#FAC9D1' : '')">{{ r.price.toFixed(2) }}</td>
                        <td :style="r.toBack > 0 ? 'background:#A6D8FF' : ''">{{ r.toBack > 0 ? `HK$ ${formatMoney(r.toBack)}` : '' }}</td>
                        <td :style="r.toLay > 0 ? 'background:#FAC9D1' : ''">{{ r.toLay > 0 ? `HK$ ${formatMoney(r.toLay)}` : '' }}</td>
                        <td>{{ r.traded > 0 ? `HK$ ${formatMoney(r.traded)}` : '' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </template>
            <tr class="subtotal-row"><td><strong>9 or less 汇总</strong></td><td></td><td></td><td></td><td></td><td></td><td></td><td>{{ formatMoney(window.group1TotalBet) }}</td><td>{{ formatMoney(window.group1MaxHold) }}</td><td>{{ formatMoney(window.group1TotalHold) }}</td><td></td><td></td></tr>

            <!-- Group 2: 10-12 -->
            <template v-for="item in window.group2Items" :key="item.key">
              <tr style="cursor:pointer" @click="toggleRow(item)">
                <td><strong :class="handicapRankClass(item)">{{ item.displayName }}</strong></td>
                <td>{{ item.odds.toFixed(2) }}</td>
                <td>{{ item.dense > 0 ? item.dense.toFixed(2) : '' }} <small v-if="item.denseSize > 0">{{ densePercent(item.denseSize, item.totalBet) }}</small></td>
                <td :class="ssdClassFor(item.maxBet, window, 'MaxBet')">{{ formatMoney(item.maxBet) }}</td>
                <td>{{ item.oddsOnMax > 0 ? item.oddsOnMax.toFixed(2) : '' }}</td>
                <td>{{ item.maxBetAttr }}</td>
                <td>{{ item.maxBetMark }}</td>
                <td :class="ssdClassFor(item.totalBet, window, 'TotalBet')">{{ formatMoney(item.totalBet) }}</td>
                <td :class="ssdClassFor(item.maxHold, window, 'MaxHold')">{{ formatMoney(item.maxHold) }}</td>
                <td :class="ssdClassFor(item.totalHold, window, 'TotalHold')">{{ formatMoney(item.totalHold) }}</td>
                <td :style="maxTotalStyle(item.maxTotal)">{{ (item.maxTotal * 100).toFixed(0) }}%</td>
                <td :class="rankClass(item.rankTotalBet)">{{ item.rankTotalBet }}</td>
              </tr>
              <tr v-if="expandedRows.has(item.key)" class="expand-row">
                <td colspan="12" style="padding:4px">
                  <table class="ex">
                    <thead><tr class="extrth"><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
                    <tbody>
                      <tr v-for="(r, ri) in getLastPriceRows(item)" :key="ri">
                        <td :style="r.toBack > 0 ? 'background:#A6D8FF' : (r.toLay > 0 ? 'background:#FAC9D1' : '')">{{ r.price.toFixed(2) }}</td>
                        <td :style="r.toBack > 0 ? 'background:#A6D8FF' : ''">{{ r.toBack > 0 ? `HK$ ${formatMoney(r.toBack)}` : '' }}</td>
                        <td :style="r.toLay > 0 ? 'background:#FAC9D1' : ''">{{ r.toLay > 0 ? `HK$ ${formatMoney(r.toLay)}` : '' }}</td>
                        <td>{{ r.traded > 0 ? `HK$ ${formatMoney(r.traded)}` : '' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </template>
            <tr class="subtotal-row"><td><strong>10 - 12 汇总</strong></td><td></td><td></td><td></td><td></td><td></td><td></td><td>{{ formatMoney(window.group2TotalBet) }}</td><td>{{ formatMoney(window.group2MaxHold) }}</td><td>{{ formatMoney(window.group2TotalHold) }}</td><td></td><td></td></tr>

            <!-- Group 3: 13 or more -->
            <template v-for="item in window.group3Items" :key="item.key">
              <tr style="cursor:pointer" @click="toggleRow(item)">
                <td><strong :class="handicapRankClass(item)">{{ item.displayName }}</strong></td>
                <td>{{ item.odds.toFixed(2) }}</td>
                <td>{{ item.dense > 0 ? item.dense.toFixed(2) : '' }} <small v-if="item.denseSize > 0">{{ densePercent(item.denseSize, item.totalBet) }}</small></td>
                <td :class="ssdClassFor(item.maxBet, window, 'MaxBet')">{{ formatMoney(item.maxBet) }}</td>
                <td>{{ item.oddsOnMax > 0 ? item.oddsOnMax.toFixed(2) : '' }}</td>
                <td>{{ item.maxBetAttr }}</td>
                <td>{{ item.maxBetMark }}</td>
                <td :class="ssdClassFor(item.totalBet, window, 'TotalBet')">{{ formatMoney(item.totalBet) }}</td>
                <td :class="ssdClassFor(item.maxHold, window, 'MaxHold')">{{ formatMoney(item.maxHold) }}</td>
                <td :class="ssdClassFor(item.totalHold, window, 'TotalHold')">{{ formatMoney(item.totalHold) }}</td>
                <td :style="maxTotalStyle(item.maxTotal)">{{ (item.maxTotal * 100).toFixed(0) }}%</td>
                <td :class="rankClass(item.rankTotalBet)">{{ item.rankTotalBet }}</td>
              </tr>
              <tr v-if="expandedRows.has(item.key)" class="expand-row">
                <td colspan="12" style="padding:4px">
                  <table class="ex">
                    <thead><tr class="extrth"><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
                    <tbody>
                      <tr v-for="(r, ri) in getLastPriceRows(item)" :key="ri">
                        <td :style="r.toBack > 0 ? 'background:#A6D8FF' : (r.toLay > 0 ? 'background:#FAC9D1' : '')">{{ r.price.toFixed(2) }}</td>
                        <td :style="r.toBack > 0 ? 'background:#A6D8FF' : ''">{{ r.toBack > 0 ? `HK$ ${formatMoney(r.toBack)}` : '' }}</td>
                        <td :style="r.toLay > 0 ? 'background:#FAC9D1' : ''">{{ r.toLay > 0 ? `HK$ ${formatMoney(r.toLay)}` : '' }}</td>
                        <td>{{ r.traded > 0 ? `HK$ ${formatMoney(r.traded)}` : '' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </template>
            <tr class="subtotal-row"><td><strong>13 or more 汇总</strong></td><td></td><td></td><td></td><td></td><td></td><td></td><td>{{ formatMoney(window.group3TotalBet) }}</td><td>{{ formatMoney(window.group3MaxHold) }}</td><td>{{ formatMoney(window.group3TotalHold) }}</td><td></td><td></td></tr>

            <!-- 统计行 -->
            <tr class="stats-row"><td>σ</td><td></td><td></td><td>{{ formatMoney(window.stdDevMaxBet) }}</td><td></td><td></td><td></td><td>{{ formatMoney(window.stdDevTotalBet) }}</td><td>{{ formatMoney(window.stdDevMaxHold) }}</td><td>{{ formatMoney(window.stdDevTotalHold) }}</td><td></td><td></td></tr>
            <tr class="stats-row"><td>μ</td><td></td><td></td><td>{{ formatMoney(window.avgMaxBet) }}</td><td></td><td></td><td></td><td>{{ formatMoney(window.avgTotalBet) }}</td><td>{{ formatMoney(window.avgMaxHold) }}</td><td>{{ formatMoney(window.avgTotalHold) }}</td><td></td><td></td></tr>
            <tr class="stats-row"><td>2σ</td><td></td><td></td><td>{{ formatMoney(window.threshold2SigmaMaxBet) }}</td><td></td><td></td><td></td><td>{{ formatMoney(window.threshold2SigmaTotalBet) }}</td><td>{{ formatMoney(window.threshold2SigmaMaxHold) }}</td><td>{{ formatMoney(window.threshold2SigmaTotalHold) }}</td><td></td><td></td></tr>
            <tr class="stats-row"><td>3σ</td><td></td><td></td><td>{{ formatMoney(window.threshold3SigmaMaxBet) }}</td><td></td><td></td><td></td><td>{{ formatMoney(window.threshold3SigmaTotalBet) }}</td><td>{{ formatMoney(window.threshold3SigmaMaxHold) }}</td><td>{{ formatMoney(window.threshold3SigmaTotalHold) }}</td><td></td><td></td></tr>

            <tr class="grand-total-row">
              <td><strong>Grand Total</strong></td><td colspan="6"></td>
              <td>{{ formatMoney(window.grandTotalBet) }}</td><td></td>
              <td>{{ formatMoney(window.grandTotalHold) }}</td><td></td><td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 大注 TOP10 -->
      <h4>大注 TOP10</h4>
      <table class="gridtable">
        <thead><tr><th>Selection</th><th>Odds</th><th>TradedChange</th><th>Attr</th><th>Payout</th><th>Per</th><th>Weight</th><th>P Mark</th><th>Update Time</th></tr></thead>
        <tbody>
          <template v-for="big in bigList" :key="big.pcId">
            <tr style="cursor:pointer" @click="toggleBigRow(big)">
              <td :class="{ tdhighlight: isBigHighlighted(big) }"><strong>{{ big.selectionName }}</strong></td>
              <td>{{ big.lastOdds.toFixed(2) }}</td>
              <td>{{ formatMoney(big.tradedChange) }}</td>
              <td>{{ big.tradedAttr }}</td>
              <td>{{ big.payout.toFixed(0) }}</td>
              <td>{{ bigPerDisplay(big.per) }}</td>
              <td>{{ big.weight.toFixed(0) }}</td>
              <td>{{ big.pMark }}</td>
              <td :style="bigTimeColorStyle(big.colorRank)">{{ new Date(big.refreshTime).toLocaleString('zh-CN') }}</td>
            </tr>
            <tr v-if="expandedBigRows.has(big.pcId)" class="expand-row">
              <td colspan="9" style="padding:4px">
                <div class="expand-panels">
                  <div class="expand-panel">
                    <span>当前记录</span>
                    <table class="ex">
                      <thead><tr class="extrth"><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
                      <tbody>
                        <tr v-for="(ar, ri) in getBigAlignedRows(big)" :key="ri">
                          <td :style="ar.cur?.toBack ? 'background:#A6D8FF' : (ar.cur?.toLay ? 'background:#FAC9D1' : '')">{{ ar.price.toFixed(2) }}</td>
                          <td :style="ar.cur?.toBack ? 'background:#A6D8FF' : ''">{{ ar.cur && ar.cur.toBack > 0 ? `HK$ ${formatMoney(ar.cur.toBack)}` : '' }}</td>
                          <td :style="ar.cur?.toLay ? 'background:#FAC9D1' : ''">{{ ar.cur && ar.cur.toLay > 0 ? `HK$ ${formatMoney(ar.cur.toLay)}` : '' }}</td>
                          <td>{{ ar.cur && ar.cur.traded > 0 ? `HK$ ${formatMoney(ar.cur.traded)}` : '' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="expand-panel">
                    <span>前一条记录</span>
                    <table class="ex">
                      <thead><tr class="extrth"><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
                      <tbody>
                        <tr v-for="(ar, ri) in getBigAlignedRows(big)" :key="ri">
                          <td :style="ar.prev?.toBack ? 'background:#A6D8FF' : (ar.prev?.toLay ? 'background:#FAC9D1' : '')">{{ ar.price.toFixed(2) }}</td>
                          <td :style="ar.prev?.toBack ? 'background:#A6D8FF' : ''">{{ ar.prev && ar.prev.toBack > 0 ? `HK$ ${formatMoney(ar.prev.toBack)}` : '' }}</td>
                          <td :style="ar.prev?.toLay ? 'background:#FAC9D1' : ''">{{ ar.prev && ar.prev.toLay > 0 ? `HK$ ${formatMoney(ar.prev.toLay)}` : '' }}</td>
                          <td>{{ ar.prev && ar.prev.traded > 0 ? `HK$ ${formatMoney(ar.prev.traded)}` : '' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div class="expand-panel">
                    <span>成交差额</span>
                    <table class="ex">
                      <thead><tr class="extrth"><th>价位</th><th>成交</th></tr></thead>
                      <tbody>
                        <tr v-for="(ar, ri) in getBigAlignedRows(big)" :key="ri">
                          <td>{{ ar.price.toFixed(2) }}</td>
                          <td>{{ ar.diff > 0 ? `HK$ ${formatMoney(ar.diff)}` : '' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Hold TOP10 -->
      <h4>Hold TOP10</h4>
      <table class="gridtable">
        <thead><tr><th>Selection</th><th>Odds</th><th>TradedChange</th><th>Attr</th><th>Top Hold</th><th>Payout</th><th>Per</th><th>Weight</th><th>P Mark</th><th>Update Time</th></tr></thead>
        <tbody>
          <tr v-for="h in holdList" :key="h.pcId">
            <td><strong>{{ h.selectionName }}</strong></td>
            <td>{{ h.lastOdds.toFixed(2) }}</td>
            <td>{{ formatMoney(h.tradedChange) }}</td>
            <td>{{ h.tradedAttr }}</td>
            <td>{{ formatMoney(h.hold) }}</td>
            <td>{{ h.payout.toFixed(0) }}</td>
            <td>{{ bigPerDisplay(h.per) }}</td>
            <td>{{ h.weight.toFixed(0) }}</td>
            <td>{{ h.pMark }}</td>
            <td>{{ new Date(h.refreshTime).toLocaleString('zh-CN') }}</td>
          </tr>
        </tbody>
      </table>

      <!-- Payout 表 -->
      <template v-if="minPayoutList.length > 0">
        <h4>最小 Payout</h4>
        <table class="gridtable">
          <thead><tr><th>Selection</th><th>Amount</th><th>TradedChange</th><th>Attr</th><th>LastOdds</th><th>Payout</th><th>Per</th><th>Per2</th><th>Weight</th><th>P Mark</th><th>RefreshTime</th></tr></thead>
          <tbody>
            <tr v-for="p in minPayoutList" :key="'min-'+p.selectionId">
              <td>{{ p.selectionName }}</td><td>{{ formatMoney(p.amount) }}</td><td>{{ formatMoney(p.tradedChange) }}</td><td>{{ p.tradedAttr }}</td><td>{{ p.lastOdds.toFixed(2) }}</td><td>{{ p.payout.toFixed(0) }}</td><td>{{ (p.per / 100).toFixed(0) }}%</td><td>{{ (p.per2 * 100).toFixed(1) }}%</td><td>{{ p.weight.toFixed(0) }}</td><td>{{ p.pMark }}</td><td>{{ new Date(p.refreshTime).toLocaleString('zh-CN') }}</td>
            </tr>
          </tbody>
        </table>
      </template>
      <template v-if="maxPayoutList.length > 0">
        <h4>最大 Payout</h4>
        <table class="gridtable">
          <thead><tr><th>Selection</th><th>Amount</th><th>TradedChange</th><th>Attr</th><th>LastOdds</th><th>Payout</th><th>Per</th><th>Per2</th><th>Weight</th><th>P Mark</th><th>RefreshTime</th></tr></thead>
          <tbody>
            <tr v-for="p in maxPayoutList" :key="'max-'+p.selectionId">
              <td>{{ p.selectionName }}</td><td>{{ formatMoney(p.amount) }}</td><td>{{ formatMoney(p.tradedChange) }}</td><td>{{ p.tradedAttr }}</td><td>{{ p.lastOdds.toFixed(2) }}</td><td>{{ p.payout.toFixed(0) }}</td><td>{{ (p.per / 100).toFixed(0) }}%</td><td>{{ (p.per2 * 100).toFixed(1) }}%</td><td>{{ p.weight.toFixed(0) }}</td><td>{{ p.pMark }}</td><td>{{ new Date(p.refreshTime).toLocaleString('zh-CN') }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </template>
  </div>
</template>

<style scoped>
@import '~/assets/css/detail-shared.css';
</style>
