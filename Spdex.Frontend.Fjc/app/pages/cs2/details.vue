<script setup lang="ts">
import type { CsBigHoldPageResult, CsItemView, CsTimeWindowData, CsBigItem, CsPayoutItem } from '~/types/csbighold'
import type { PriceSizeRow } from '~/types/bighold'
import { parseRawData } from '~/utils/parseRawData'
import { formatMoney } from '~/utils/formatters'
import {
  type AlignedRow,
  getAlignedRows as getAlignedRowsHelper,
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

// ── 数据获取 ──
const params = computed(() => ({ id: eventId.value, order: orderParam.value }))
const { data: apiResult, pending } = useCsBigHold(params)
const pageData = computed(() => apiResult.value?.data as CsBigHoldPageResult | null)

useHead({
  title: computed(() => pageData.value?.match
    ? `波胆 ${pageData.value.match.homeTeam}vs${pageData.value.match.guestTeam}`
    : '波胆'),
})

// ── 当前时间窗口 ──
const activeWindowIdx = ref(0)
const currentWindow = computed<CsTimeWindowData | null>(() => pageData.value?.windows?.[activeWindowIdx.value] ?? null)
watch(activeWindowIdx, () => { expandedRows.value.clear() })

// ── 大注 TOP10 ──
const bigList = computed<CsBigItem[]>(() => pageData.value?.bigList ?? [])
// big_alert: 收集 bigList 中的比分名（用于 CS 列蓝框逻辑）
const bigListCsNames = computed(() => new Set(bigList.value.map(b => b.selectionName)))

// ── Payout 列表 ──
const minPayoutList = computed<CsPayoutItem[]>(() => pageData.value?.minPayoutList ?? [])
const maxPayoutList = computed<CsPayoutItem[]>(() => pageData.value?.maxPayoutList ?? [])

// ── 行展开（懒加载上一条记录）──
const detailComposable = useBigHoldDetail('/api/csbighold/previous')
const expandedRows = ref<Set<number>>(new Set())

function toggleRow(item: CsItemView) {
  if (expandedRows.value.has(item.code)) {
    expandedRows.value.delete(item.code)
  } else {
    expandedRows.value.add(item.code)
  }
}

/** 从 lastPrices 中按 selectionId 取得挂牌数据并解析 */
function getLastPriceRows(item: CsItemView): PriceSizeRow[] {
  const w = currentWindow.value
  if (!w?.lastPrices) return []
  const lp = w.lastPrices.find(p => p.selectionId === item.selectionId)
  if (!lp?.rawData) return []
  return parseRawData(lp.rawData)
}

// ── BigList 展开 ──
const expandedBigRows = ref<Set<number>>(new Set())
function toggleBigRow(big: CsBigItem) {
  if (expandedBigRows.value.has(big.pcId)) {
    expandedBigRows.value.delete(big.pcId)
  } else {
    expandedBigRows.value.add(big.pcId)
    if (big.pcId) {
      detailComposable.fetchPrevious(big.pcId, big.marketId, big.selectionId, big.refreshTime)
    }
  }
}

// ── BigList 预加载前一条记录（用于 HighlightPcId 高亮计算）──
watch(bigList, (list) => {
  for (const big of list) {
    if (big.pcId && !detailComposable.cache.has(big.pcId)) {
      detailComposable.fetchPrevious(big.pcId, big.marketId, big.selectionId, big.refreshTime)
    }
  }
}, { immediate: true })

// ── 页面特有工具方法 ──

/** Home/Draw/Away 分组的左侧颜色条 */
const homeCodes = [110, 120, 121, 130, 131, 132, 199]
const drawCodes = [200, 211, 222, 233, 299]

function getGroupClass(code: number): string {
  if (homeCodes.includes(code)) return 'group-home'
  if (drawCodes.includes(code)) return 'group-draw'
  return 'group-away'
}

/** SSD 高亮快捷方法 */
function ssdClassFor(val: number, w: CsTimeWindowData, field: 'MaxBet' | 'TotalBet' | 'MaxHold' | 'TotalHold'): string {
  const t3 = (w as any)[`threshold3Sigma${field}`] as number
  const t2 = (w as any)[`threshold2Sigma${field}`] as number
  return ssdClass(val, t2, t3)
}

/** CS 名称列：rank 1-4 用 red1-4 + 不在 bigList 中则加 big_alert */
function csRankClass(item: CsItemView): string {
  const rank = item.rankTotalBet
  if (rank >= 1 && rank <= 4) {
    const base = `red${rank}`
    if (!bigListCsNames.value.has(item.cs)) {
      return `${base} big_alert`
    }
    return base
  }
  return ''
}

/** T > 3 红色 */
function tStyle(t: number | null): string {
  return t && t > 3 ? 'color:#ff0000;font-weight:bold' : ''
}

/**
 * OddsAmount 跨窗口比值（蓝色百分比）。
 * 对应旧站 csc2.aspx 每个时间窗口 header 右侧显示的百分比：
 *   -30min vs -1h, -1h vs -2h, -2h vs -6h, -3h vs -6h, -6h vs -12h, -12h vs -24h
 * 当前窗口(0)和-24h(7)不显示。
 */
const oddsAmountRatioTargetIdx: Record<number, number> = {
  1: 2,   // -30min vs -1h
  2: 3,   // -1h vs -2h
  3: 5,   // -2h vs -6h
  4: 5,   // -3h vs -6h
  5: 6,   // -6h vs -12h
  6: 7,   // -12h vs -24h
}

function getOddsAmountRatio(windowIdx: number): string | null {
  const targetIdx = oddsAmountRatioTargetIdx[windowIdx]
  if (targetIdx === undefined) return null
  const windows = pageData.value?.windows
  if (!windows || !windows[targetIdx]) return null
  const current = windows[windowIdx]?.oddsAmount ?? 0
  const target = (windows[targetIdx]?.oddsAmount ?? 0) + 0.1
  return ((current / target) * 100).toFixed(2) + '%'
}

/** Grand Total 行中 OddsAmount / GrandTotalHold */
function oddsHoldRatio(w: CsTimeWindowData): string {
  if (w.grandTotalHold <= 0) return '0.00'
  return (w.oddsAmount / w.grandTotalHold).toFixed(2)
}

/** Grand Total 行中 GrandTotalHold / GrandTotalBet */
function holdBetRatio(w: CsTimeWindowData): string {
  if (w.grandTotalBet <= 0) return '0.00'
  return (w.grandTotalHold / w.grandTotalBet).toFixed(2)
}

/**
 * Per2Viewer: per2 > per1 红色，per2 < per1 绿色，否则无色。
 */
function per2Style(per2: number, per1: number): string {
  const p1 = Math.round(per1 * 100) / 100
  const p2 = Math.round(per2 * 100) / 100
  if (p2 > p1) return 'color:red'
  if (p2 < p1) return 'color:#00876a'
  return ''
}

/**
 * PayoutViewer: 同一 selectionId 在 minPayoutList 和 maxPayoutList 中的 Payout 都 <20 → 红色。
 */
function payoutStyle(selectionId: number, _payout: number): string {
  const minItem = minPayoutList.value.find(p => p.selectionId === selectionId)
  const maxItem = maxPayoutList.value.find(p => p.selectionId === selectionId)
  if (minItem && maxItem && minItem.payout < 20 && maxItem.payout < 20) return 'color:red'
  return ''
}

/** BigList 展开：三栏对齐 */
function getBigAlignedRows(big: CsBigItem): AlignedRow[] {
  const prev = detailComposable.cache.get(big.pcId)
  return getAlignedRowsHelper(big.rawData, prev?.rawData ?? null)
}

function isBigHighlighted(big: CsBigItem): boolean {
  if (!detailComposable.cache.has(big.pcId)) return false
  const prev = detailComposable.cache.get(big.pcId)
  if (!prev?.rawData) return false
  return isBigHighlightedHelper(big.rawData, prev.rawData)
}
</script>

<template>
  <div class="cs2-page">
    <!-- 加载中 -->
    <div v-if="pending" class="loading">加载中...</div>

    <template v-else-if="pageData">
      <!-- 赛事头部 -->
      <div class="match-header">
        <h5>
          {{ pageData.match.homeTeam }} vs {{ pageData.match.guestTeam }}
          <span>比赛时间: [{{ new Date(pageData.match.matchTime).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }}]</span>
        </h5>
      </div>

      <!-- 时间窗口 Tab 栏 -->
      <div class="grid-tab-bar">
        <button
          v-for="(w, i) in pageData.windows"
          :key="i"
          :class="{ active: activeWindowIdx === i }"
          @click="activeWindowIdx = i"
        >
          {{ w.label }}
        </button>
      </div>

      <!-- 当前窗口数据 -->
      <template v-if="currentWindow">
        <h4>
          {{ currentWindow.label }} 数据
          <span v-if="currentWindow.odds">
            对应标盘：({{ (currentWindow.odds.homeWeight ?? 0).toFixed(0) }}-{{ (currentWindow.odds.drawWeight ?? 0).toFixed(0) }}-{{ (currentWindow.odds.awayWeight ?? 0).toFixed(0) }}__{{ formatMoney(currentWindow.odds.totalAmount ?? 0) }})
          </span>
          <!-- 非当前、非-24h窗口：OddsAmount 跨窗口比值（蓝色） -->
          <span v-if="getOddsAmountRatio(activeWindowIdx)" style="color:#0000ff">
            {{ getOddsAmountRatio(activeWindowIdx) }}
          </span>
        </h4>

        <!-- 比分数据表：15 列，与旧站 csc2.aspx 完全一致 -->
        <table class="gridtable">
          <thead>
            <tr>
              <th>CS</th><th>Odds</th><th>Dense</th><th>Dense%</th><th>Max bet</th><th>MB Odds</th>
              <th>Attr</th><th>Mark</th><th>Total bet</th><th>Max hold</th><th>Total hold</th>
              <th>Max/total</th><th>Vol %</th><th>T</th><th>Rank totalbet</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in currentWindow.items" :key="item.code">
              <tr :class="getGroupClass(item.code)" :style="activeWindowIdx === 0 ? 'cursor:pointer' : ''" class="data-row" @click="activeWindowIdx === 0 && toggleRow(item)">
                <td><strong :class="csRankClass(item)">{{ item.cs }}</strong></td>
                <td>{{ (item.odds ?? 0).toFixed(2) }}</td>
                <td>{{ (item.dense ?? 0).toFixed(2) }}</td>
                <td>{{ densePercent(item.denseSize ?? 0, item.totalBet ?? 0) }}</td>
                <td :class="ssdClassFor(item.maxBet ?? 0, currentWindow, 'MaxBet')">{{ formatMoney(item.maxBet ?? 0) }}</td>
                <td>{{ (item.oddsOnMax ?? 0).toFixed(2) }}</td>
                <td>{{ item.maxBetAttr ?? '' }}</td>
                <td>{{ item.maxBetMark ?? '' }}</td>
                <td :class="ssdClassFor(item.totalBet ?? 0, currentWindow, 'TotalBet')">{{ formatMoney(item.totalBet ?? 0) }}</td>
                <td :class="ssdClassFor(item.maxHold ?? 0, currentWindow, 'MaxHold')">{{ formatMoney(item.maxHold ?? 0) }}</td>
                <td :class="ssdClassFor(item.totalHold ?? 0, currentWindow, 'TotalHold')">{{ formatMoney(item.totalHold ?? 0) }}</td>
                <td :style="maxTotalStyle(item.maxTotal ?? 0)">{{ ((item.maxTotal ?? 0) * 100).toFixed(0) }}%</td>
                <td>{{ item.volPercent ?? '- -' }}</td>
                <td :style="tStyle(item.tRatio)">{{ item.tRatio ? item.tRatio.toFixed(2) : '' }}</td>
                <td :class="rankClass(item.rankTotalBet ?? 0)">{{ item.rankTotalBet ?? '' }}</td>
              </tr>
              <!-- 展开行 -->
              <tr v-if="expandedRows.has(item.code)" class="expand-row">
                <td colspan="15" style="padding:4px">
                  <table class="ex">
                    <thead><tr class="extrth"><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
                    <tbody>
                      <tr v-for="(row, ri) in getLastPriceRows(item)" :key="ri">
                        <td :style="row.toBack > 0 ? 'background:#A6D8FF' : (row.toLay > 0 ? 'background:#FAC9D1' : '')">{{ row.price }}</td>
                        <td :style="row.toBack > 0 ? 'background:#A6D8FF' : ''">{{ row.toBack > 0 ? `HK$ ${formatMoney(row.toBack)}` : '' }}</td>
                        <td :style="row.toLay > 0 ? 'background:#FAC9D1' : ''">{{ row.toLay > 0 ? `HK$ ${formatMoney(row.toLay)}` : '' }}</td>
                        <td>{{ row.traded > 0 ? `HK$ ${formatMoney(row.traded)}` : '' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </template>

            <!-- σ 行 -->
            <tr class="stats-row trdr">
              <td /><td />
              <td>{{ formatMoney(currentWindow.stdDevMaxBet) }}</td>
              <td /><td /><td /><td /><td />
              <td>{{ formatMoney(currentWindow.stdDevTotalBet) }}</td>
              <td>{{ formatMoney(currentWindow.stdDevMaxHold) }}</td>
              <td>{{ formatMoney(currentWindow.stdDevTotalHold) }}</td>
              <td /><td /><td /><td />
            </tr>
            <!-- μ 行 -->
            <tr class="stats-row">
              <td /><td />
              <td>{{ formatMoney(currentWindow.avgMaxBet) }}</td>
              <td /><td /><td /><td /><td />
              <td>{{ formatMoney(currentWindow.avgTotalBet) }}</td>
              <td>{{ formatMoney(currentWindow.avgMaxHold) }}</td>
              <td>{{ formatMoney(currentWindow.avgTotalHold) }}</td>
              <td /><td /><td /><td />
            </tr>
            <!-- 2σ 行 -->
            <tr class="stats-row">
              <td /><td><strong>2x</strong></td>
              <td><strong>{{ formatMoney(currentWindow.threshold2SigmaMaxBet) }}</strong></td>
              <td /><td /><td /><td /><td />
              <td><strong>{{ formatMoney(currentWindow.threshold2SigmaTotalBet) }}</strong></td>
              <td><strong>{{ formatMoney(currentWindow.threshold2SigmaMaxHold) }}</strong></td>
              <td><strong>{{ formatMoney(currentWindow.threshold2SigmaTotalHold) }}</strong></td>
              <td /><td /><td /><td />
            </tr>
            <!-- 3σ 行 -->
            <tr class="stats-row">
              <td /><td><strong>3x</strong></td>
              <td><strong>{{ formatMoney(currentWindow.threshold3SigmaMaxBet) }}</strong></td>
              <td /><td /><td /><td /><td />
              <td><strong>{{ formatMoney(currentWindow.threshold3SigmaTotalBet) }}</strong></td>
              <td><strong>{{ formatMoney(currentWindow.threshold3SigmaMaxHold) }}</strong></td>
              <td><strong>{{ formatMoney(currentWindow.threshold3SigmaTotalHold) }}</strong></td>
              <td /><td /><td /><td />
            </tr>
            <!-- Grand Total -->
            <tr class="stats-row">
              <td /><td><strong>Grand Total</strong></td>
              <td /><td /><td /><td /><td /><td />
              <td><strong>{{ formatMoney(currentWindow.grandTotalBet) }}</strong></td>
              <td />
              <td><strong>{{ formatMoney(currentWindow.grandTotalHold) }}</strong></td>
              <td><strong>{{ holdBetRatio(currentWindow) }}</strong></td>
              <td><span style="color:#0000ff"><strong>{{ oddsHoldRatio(currentWindow) }}</strong></span></td>
              <td /><td />
            </tr>
            <!-- 附加计算 标题 -->
            <tr class="stats-row">
              <td><strong>附加计算</strong></td>
              <td>Home CS</td><td>Draw CS</td><td>Away CS</td><td />
              <td>Home 1x2</td><td>Draw 1x2</td><td>Away 1x2</td>
              <td /><td /><td /><td /><td /><td /><td />
            </tr>
            <!-- 附加计算 数值 -->
            <tr class="stats-row">
              <td />
              <td><strong>{{ currentWindow.homeBetHold.toFixed(2) }}</strong></td>
              <td><strong>{{ currentWindow.drawBetHold.toFixed(2) }}</strong></td>
              <td><strong>{{ currentWindow.awayBetHold.toFixed(2) }}</strong></td>
              <td />
              <td><strong>{{ currentWindow.home1x2.toFixed(2) }}</strong></td>
              <td><strong>{{ currentWindow.draw1x2.toFixed(2) }}</strong></td>
              <td><strong>{{ currentWindow.away1x2.toFixed(2) }}</strong></td>
              <td /><td /><td /><td /><td /><td /><td />
            </tr>
            <!-- H 行 (×1.25) -->
            <tr class="stats-row">
              <td />
              <td><strong>H:&nbsp;&nbsp;{{ (currentWindow.homeBetHold * 1.25).toFixed(2) }}</strong></td>
              <td><strong>H:&nbsp;&nbsp;{{ (currentWindow.drawBetHold * 1.25).toFixed(2) }}</strong></td>
              <td><strong>H:&nbsp;&nbsp;{{ (currentWindow.awayBetHold * 1.25).toFixed(2) }}</strong></td>
              <td /><td /><td /><td />
              <td /><td /><td /><td /><td /><td /><td />
            </tr>
            <!-- L 行 (×0.75) -->
            <tr class="stats-row">
              <td />
              <td><strong>L:&nbsp;&nbsp;{{ (currentWindow.homeBetHold * 0.75).toFixed(2) }}</strong></td>
              <td><strong>L:&nbsp;&nbsp;{{ (currentWindow.drawBetHold * 0.75).toFixed(2) }}</strong></td>
              <td><strong>L:&nbsp;&nbsp;{{ (currentWindow.awayBetHold * 0.75).toFixed(2) }}</strong></td>
              <td /><td /><td /><td />
              <td /><td /><td /><td /><td /><td /><td />
            </tr>
          </tbody>
        </table>
      </template>

      <!-- 大注 TOP10 -->
      <div class="big-section">
        <h4>大注TOP10</h4>
        <table class="gridtable">
          <thead>
            <tr>
              <th>Handicap</th><th>Odds</th>
              <th><NuxtLink :to="`/cs2/details?id=${pageData.match.eventId}&order=0`">TradedChange</NuxtLink></th>
              <th>Attr</th><th>Payout</th><th>Per</th><th>Weight</th><th>P Mark</th>
              <th><NuxtLink :to="`/cs2/details?id=${pageData.match.eventId}&order=1`">Update Time</NuxtLink></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="big in bigList" :key="big.pcId">
              <tr class="big-row" @click="toggleBigRow(big)">
                <td :class="{ tdhighlight: isBigHighlighted(big) }"><strong>{{ big.selectionName }}</strong></td>
                <td>{{ (big.lastOdds ?? 0).toFixed(2) }}</td>
                <td>{{ formatMoney(big.tradedChange ?? 0) }}</td>
                <td>{{ big.tradedAttr ?? '' }}</td>
                <td>{{ (big.payout ?? 0).toFixed(0) }}</td>
                <td>{{ bigPerDisplay(big.per ?? 0) }}</td>
                <td>{{ (big.weight ?? 0).toFixed(0) }}</td>
                <td>{{ big.pMark }}</td>
                <td><span :style="bigTimeColorStyle(big.colorRank)">{{ new Date(big.refreshTime).toLocaleString('zh-CN') }}</span></td>
              </tr>
              <!-- 大注展开行：三栏按 price 对齐，紧凑并排 -->
              <tr v-if="expandedBigRows.has(big.pcId)" class="expand-row">
                <td colspan="9" style="padding:4px">
                  <div class="expand-panels">
                    <div class="expand-panel">
                      <span>当前记录</span>
                      <table class="ex">
                        <thead><tr class="extrth"><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
                        <tbody>
                          <tr v-for="(ar, ri) in getBigAlignedRows(big)" :key="ri">
                            <td :style="ar.cur?.toBack ? 'background:#A6D8FF' : (ar.cur?.toLay ? 'background:#FAC9D1' : '')">{{ ar.price }}</td>
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
                            <td :style="ar.prev?.toBack ? 'background:#A6D8FF' : (ar.prev?.toLay ? 'background:#FAC9D1' : '')">{{ ar.price }}</td>
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
                            <td>{{ ar.price }}</td>
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
      </div>

      <!-- 最小 Payout -->
      <div v-if="minPayoutList.length" class="payout-section">
        <h4>最小 Payout</h4>
        <table class="gridtable">
          <thead>
            <tr>
              <th>CS</th><th>总成交</th><th>成交量</th><th>属性</th><th>价位</th>
              <th>Payout</th><th>比例</th><th>比例2</th><th>Weight</th><th>P Mark</th><th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in minPayoutList" :key="item.selectionId">
              <td><strong>{{ item.selectionName }}</strong></td>
              <td>{{ formatMoney(item.amount ?? 0) }}</td>
              <td>{{ formatMoney(item.tradedChange ?? 0) }}</td>
              <td>{{ item.tradedAttr ?? '' }}</td>
              <td>{{ (item.lastOdds ?? 0).toFixed(2) }}</td>
              <td :style="payoutStyle(item.selectionId, item.payout)">{{ (item.payout ?? 0).toFixed(0) }}</td>
              <td>{{ ((item.per ?? 0) / 100 * 100).toFixed(0) }}%</td>
              <td :style="per2Style(item.per2 ?? 0, (item.per ?? 0) / 100)">{{ ((item.per2 ?? 0) * 100).toFixed(0) }}%</td>
              <td>{{ (item.weight ?? 0).toFixed(0) }}</td>
              <td>{{ item.pMark }}</td>
              <td>{{ new Date(item.refreshTime).toLocaleString('zh-CN') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 最大 Payout -->
      <div v-if="maxPayoutList.length" class="payout-section">
        <h4>最大 Payout</h4>
        <table class="gridtable">
          <thead>
            <tr>
              <th>CS</th><th>总成交</th><th>成交量</th><th>属性</th><th>价位</th>
              <th>Payout</th><th>比例</th><th>比例2</th><th>Weight</th><th>P Mark</th><th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in maxPayoutList" :key="item.selectionId">
              <td><strong>{{ item.selectionName }}</strong></td>
              <td>{{ formatMoney(item.amount ?? 0) }}</td>
              <td>{{ formatMoney(item.tradedChange ?? 0) }}</td>
              <td>{{ item.tradedAttr ?? '' }}</td>
              <td>{{ (item.lastOdds ?? 0).toFixed(2) }}</td>
              <td :style="payoutStyle(item.selectionId, item.payout)">{{ (item.payout ?? 0).toFixed(0) }}</td>
              <td>{{ ((item.per ?? 0) / 100 * 100).toFixed(0) }}%</td>
              <td :style="per2Style(item.per2 ?? 0, (item.per ?? 0) / 100)">{{ ((item.per2 ?? 0) * 100).toFixed(0) }}%</td>
              <td>{{ (item.weight ?? 0).toFixed(0) }}</td>
              <td>{{ item.pMark }}</td>
              <td>{{ new Date(item.refreshTime).toLocaleString('zh-CN') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-else class="no-data">暂无数据</div>
  </div>
</template>

<style scoped>
@import '~/assets/css/detail-shared.css';

/* cs2 (Correct Score) 页面特有样式 */
.cs2-page { padding: 10px; font-family: Arial, sans-serif; font-size: 14px; }
.match-header h5 { padding: 10px; font-size: 1.2em; }
.match-header h5 span { font-weight: normal; color: #666; margin-left: 10px; }

h4 { padding: 10px; font-size: 1.4em; color: #ff0000; font-weight: bold; margin: 20px 30px 10px; border-top: 2px solid #ccc; }
h4 span { font-size: 0.75em; color: #333; font-weight: normal; }

.group-home { border-left: 3px solid #ff4444; }
.group-draw { border-left: 3px solid #888; }
.group-away { border-left: 3px solid #4488ff; }

.trdr td { border-top: 2px solid #eee; }
.data-row { cursor: pointer; }
.payout-section { margin-top: 20px; }
.big-section { margin-top: 20px; }
.big-row { cursor: pointer; }
.big-row:hover { background: #f5f5f5; }
</style>
