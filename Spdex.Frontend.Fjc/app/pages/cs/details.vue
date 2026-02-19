<script setup lang="ts">
import type { GlBigHoldPageResult, GlTimeWindowData, GlItemView, GlBigItem, GlPayoutItem, Fj3Net } from '~/types/glbighold'
import type { PriceSizeRow } from '~/types/bighold'
import { parseRawData } from '~/utils/parseRawData'
import { formatMoney } from '~/utils/formatters'
import { tradedClass } from '~/utils/styleHelpers'
import {
  type AlignedRow,
  getAlignedRows,
  isBigHighlighted as isBigHighlightedHelper,
  bigTimeColorStyle,
  bigPerDisplay,
  maxTotalStyle,

  rankClass,
  ssdClass,
  netStyle,
  winStyle,
} from '~/utils/detailHelpers'

definePageMeta({ layout: 'default' })

const route = useRoute()
const eventId = computed(() => Number(route.query.id) || 0)
const orderParam = computed(() => Number(route.query.order) || 0)

const params = computed(() => ({ id: eventId.value, order: orderParam.value }))
const { data: apiResult, pending } = useGlBigHold(params)
const pageData = computed(() => apiResult.value?.data as GlBigHoldPageResult | null)

useHead({
  title: computed(() => pageData.value?.match
    ? `GL ${pageData.value.match.homeTeam}vs${pageData.value.match.guestTeam}`
    : 'Goal Line'),
})

// ── 时间窗口 ──
const activeWindowIdx = ref(0)
const windows = computed<GlTimeWindowData[]>(() => pageData.value?.windows ?? [])
const currentWindow = computed<GlTimeWindowData | null>(() => windows.value[activeWindowIdx.value] ?? null)
watch(activeWindowIdx, () => { expandedRows.value.clear() })

// ── 分时统计摘要辅助 ──
/** Under 对比前一分时 = 当前 underTotalBet / 下一窗口 underTotalBet */
function underRatio(idx: number): number | null {
  if (idx >= windows.value.length - 1) return null
  const cur = windows.value[idx]?.underTotalBet ?? 0
  const prev = windows.value[idx + 1]?.underTotalBet ?? 0
  if (prev < 0.1) return null
  return cur / (prev + 0.1)
}
/** Over 对比前一分时 = 当前 overTotalBet / 下一窗口 overTotalBet */
function overRatio(idx: number): number | null {
  if (idx >= windows.value.length - 1) return null
  const cur = windows.value[idx]?.overTotalBet ?? 0
  const prev = windows.value[idx + 1]?.overTotalBet ?? 0
  if (prev < 0.1) return null
  return cur / (prev + 0.1)
}
/**
 * V2.0: 分时环比高亮规则
 * ratio 以 100 为基数（如 130 表示 130%）
 * <130% AND 对应汇总量>8K → 红色加粗
 * >500% AND 对应汇总量>8K → 蓝色加粗
 * 其它灰色
 */
function ratioColorStyle(ratio: number | null, totalBet?: number): string {
  if (ratio == null) return ''
  const pct = ratio * 100  // 转为百分比
  const hasVolume = (totalBet ?? 0) > 8000
  if (pct < 130 && hasVolume) return 'color:#c00;font-weight:bold'
  if (pct > 500 && hasVolume) return 'color:#00c;font-weight:bold'
  return 'color:#666'
}

// ── 跨表共振：额外请求 OU2.5 数据，提取当前窗口 RefreshTime 集合 ──
const uoQueryParams = computed(() => ({ id: eventId.value, marketType: 0, order: 0 }))
const { data: uoData } = useUoBigHold(uoQueryParams)

/** OU2.5 当前分时 TOP20 的 RefreshTime 集合（精确到秒）——只用[当前]窗口 */
const uoTimeSet = computed<Set<string>>(() => {
  const set = new Set<string>()
  const uo = uoData.value?.data
  if (!uo) return set
  // 仅当前窗口（hoursOffset === 0）的 items (TOP20)
  const current = (uo.windows ?? []).find(w => w.hoursOffset === 0)
  if (current)
    for (const item of current.items)
      set.add(item.refreshTime.substring(0, 19))
  return set
})

/** 判断 GL 大注记录是否与 OU2.5 共振（同一秒有大注） */
function isResonant(big: GlBigItem): boolean {
  if (uoTimeSet.value.size === 0) return false
  return uoTimeSet.value.has(big.refreshTime.substring(0, 19))
}

// ── 大注 & Hold ──
const bigList = computed<GlBigItem[]>(() => pageData.value?.bigList ?? [])
const holdList = computed<GlBigItem[]>(() => pageData.value?.holdList ?? [])

// ── Net ──
const netList = computed<Fj3Net[]>(() => pageData.value?.netList ?? [])
const netList15 = computed<Fj3Net[]>(() => pageData.value?.netList15 ?? [])

// ── Payout ──
const minPayoutList = computed<GlPayoutItem[]>(() => pageData.value?.minPayoutList ?? [])
const maxPayoutList = computed<GlPayoutItem[]>(() => pageData.value?.maxPayoutList ?? [])

// ── 行展开 ──
const detailComposable = useBigHoldDetail('/api/glbighold/previous')
const expandedRows = ref<Set<string>>(new Set())

function toggleRow(item: GlItemView) {
  if (activeWindowIdx.value !== 0) return
  if (expandedRows.value.has(item.key)) {
    expandedRows.value.delete(item.key)
  } else {
    expandedRows.value.add(item.key)
  }
}

function getLastPriceRows(item: GlItemView): PriceSizeRow[] {
  const w = currentWindow.value
  if (!w?.lastPrices) return []
  const lp = w.lastPrices.find(p => p.key === item.key)
  if (!lp?.rawData) return []
  return parseRawData(lp.rawData)
}

// ── BigList 展开 ──
const expandedBigRows = ref<Set<number>>(new Set())
function toggleBigRow(big: GlBigItem) {
  if (expandedBigRows.value.has(big.pcId)) {
    expandedBigRows.value.delete(big.pcId)
  } else {
    expandedBigRows.value.add(big.pcId)
    if (big.pcId) {
      detailComposable.fetchPrevious(big.pcId, big.marketId, big.selectionId, big.refreshTime, { handicap: big.handicap.toString() })
    }
  }
}

// ── BigList 预加载 ──
watch(bigList, (list) => {
  for (const big of list) {
    if (big.pcId && !detailComposable.cache.has(big.pcId)) {
      detailComposable.fetchPrevious(big.pcId, big.marketId, big.selectionId, big.refreshTime, { handicap: big.handicap.toString() })
    }
  }
}, { immediate: true })

// ── 高亮/样式（页面特有逻辑） ──
function ssdClassFor(val: number, w: GlTimeWindowData, field: 'MaxBet' | 'TotalBet' | 'MaxHold' | 'TotalHold'): string {
  const t3 = (w as any)[`threshold3Sigma${field}`] as number
  const t2 = (w as any)[`threshold2Sigma${field}`] as number
  return ssdClass(val, t2, t3)
}

/**
 * Handicap 列高亮逻辑（HighlightCode）：
 * 旧站 csc6_2.aspx.cs ItemDataBoundHandler 第 821-826 行：
 * 当 LastPrice 挂牌数据中 traded>1 的价位恰好只有 1 个，且存在 traded>1000 的价位 → 黄色高亮。
 */
function isHandicapHighlighted(item: GlItemView): boolean {
  if (activeWindowIdx.value !== 0) return false
  const rows = getLastPriceRows(item)
  if (rows.length === 0) return false
  const tradedGt1 = rows.filter(r => r.traded > 1).length
  const anyGt1000 = rows.some(r => r.traded > 1000)
  return tradedGt1 === 1 && anyGt1000
}

/**
 * Odds 列高亮逻辑（HighlightCode2）：
 * 旧站 csc6_2.aspx.cs ItemDataBoundHandler 第 839-847 行：
 * 当 Odds>=3 且 LastPrice 有数据 且无对手盘（同 Handicap 不同 SelectionId 的 runner）→ 黄色高亮。
 */
function isOddsHighlighted(item: GlItemView): boolean {
  if (activeWindowIdx.value !== 0) return false
  if (item.odds < 3) return false
  const rows = getLastPriceRows(item)
  if (rows.length === 0) return false
  // 检查对手盘：同窗口中 handicap 相同但 selectionId 不同的 runner
  const w = currentWindow.value
  if (!w) return false
  const allItems = [...(w.underItems ?? []), ...(w.overItems ?? [])]
  const competitor = allItems.find(c => c.selectionId !== item.selectionId && Math.abs(c.handicap - item.handicap) < 0.001)
  return !competitor
}

function getBigAlignedRows(big: GlBigItem): AlignedRow[] {
  const prev = detailComposable.cache.get(big.pcId)
  return getAlignedRows(big.rawData, prev?.rawData ?? null)
}

function isBigHighlighted(big: GlBigItem): boolean {
  if (!detailComposable.cache.has(big.pcId)) return false
  const prev = detailComposable.cache.get(big.pcId)
  if (!prev?.rawData) return false
  return isBigHighlightedHelper(big.rawData, prev.rawData)
}

// ── 可折叠区域 ──
const collapsedSections = ref<Set<string>>(new Set(['hold', 'net', 'net15']))
function toggleSection(key: string) {
  if (collapsedSections.value.has(key)) collapsedSections.value.delete(key)
  else collapsedSections.value.add(key)
}
</script>

<template>
  <div class="grid-detail-page">
    <div v-if="pending" class="loading">加载中...</div>

    <template v-else-if="pageData">
      <!-- 赛事头部 -->
      <div class="match-header">
        <h5>
          GL: {{ pageData.match.homeTeam }} vs {{ pageData.match.guestTeam }}
          <span>比赛时间: [{{ new Date(pageData.match.matchTime).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }}]</span>
        </h5>
      </div>

      <!-- ★ 分时统计摘要 -->
      <div v-if="windows.length > 0" class="summary-panel">
        <div class="summary-title">分时统计摘要</div>
        <table class="summary-table">
          <thead>
            <tr>
              <th class="st-label">窗口</th>
              <th class="st-weight">必指</th>
              <th class="st-amount">Under 汇总量</th>
              <th class="st-ratio">Under 分时环比</th>
              <th class="st-amount">Over 汇总量</th>
              <th class="st-ratio">Over 分时环比</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(w, idx) in windows"
              :key="'sum-' + idx"
              class="summary-row"
              :class="{ 'summary-active': activeWindowIdx === idx }"
              @click="activeWindowIdx = idx"
            >
              <td class="st-label">{{ w.label }}</td>
              <td class="st-weight">
                <template v-if="w.odds">{{ w.odds.homeWeight.toFixed(0) }} | {{ w.odds.drawWeight.toFixed(0) }} | {{ w.odds.awayWeight.toFixed(0) }}</template>
                <template v-else>-</template>
              </td>
              <td class="st-amount">{{ formatMoney(w.underTotalBet) }}</td>
              <td class="st-ratio" :style="ratioColorStyle(underRatio(idx), w.underTotalBet)">
                <template v-if="underRatio(idx) != null">{{ (underRatio(idx)! * 100).toFixed(2) }}%</template>
                <template v-else>-</template>
              </td>
              <td class="st-amount">{{ formatMoney(w.overTotalBet) }}</td>
              <td class="st-ratio" :style="ratioColorStyle(overRatio(idx), w.overTotalBet)">
                <template v-if="overRatio(idx) != null">{{ (overRatio(idx)! * 100).toFixed(2) }}%</template>
                <template v-else>-</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Tab 栏 -->
      <div class="grid-tab-bar">
        <button v-for="(w, i) in pageData.windows" :key="i" :class="{ active: activeWindowIdx === i }" @click="activeWindowIdx = i">
          {{ w.label }}
        </button>
      </div>

      <!-- 当前窗口数据 -->
      <template v-if="currentWindow">
        <h4>
          {{ currentWindow.label }} 数据
          <span v-if="currentWindow.odds" class="odds-info">
            ({{ currentWindow.odds.homeWeight.toFixed(0) }}-{{ currentWindow.odds.drawWeight.toFixed(0) }}-{{ currentWindow.odds.awayWeight.toFixed(0) }}__{{ formatMoney(currentWindow.odds.totalAmount) }})
          </span>
        </h4>
        <div v-if="currentWindow.viewSubTitle" class="view-subtitle">{{ currentWindow.viewSubTitle }}</div>

        <div class="table-scroll">
          <table class="gridtable">
            <thead>
              <tr>
                <th>Handicap</th>
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
              <!-- Under 组 -->
              <template v-for="item in currentWindow.underItems" :key="'u-' + item.key">
                <tr :style="activeWindowIdx === 0 ? 'cursor:pointer' : ''" @click="toggleRow(item)">
                  <td :class="{ tdhighlight: isHandicapHighlighted(item) }"><strong>{{ item.displayName }}</strong></td>
                  <td :class="{ tdhighlight: isOddsHighlighted(item) }">{{ item.odds.toFixed(2) }}</td>
                  <td>{{ item.dense > 0 ? item.dense.toFixed(2) : '' }}</td>
                  <td :class="ssdClassFor(item.maxBet, currentWindow, 'MaxBet')">{{ formatMoney(item.maxBet) }}</td>
                  <td>{{ item.oddsOnMax > 0 ? item.oddsOnMax.toFixed(2) : '' }}</td>
                  <td>{{ item.maxBetAttr }}</td>
                  <td>{{ item.maxBetMark }}</td>
                  <td :class="ssdClassFor(item.totalBet, currentWindow, 'TotalBet')">{{ formatMoney(item.totalBet) }}</td>
                  <td :class="ssdClassFor(item.maxHold, currentWindow, 'MaxHold')">{{ formatMoney(item.maxHold) }}</td>
                  <td :class="ssdClassFor(item.totalHold, currentWindow, 'TotalHold')">{{ formatMoney(item.totalHold) }}</td>
                  <td :style="maxTotalStyle(item.maxTotal)">{{ (item.maxTotal * 100).toFixed(0) }}%</td>
                  <td :class="rankClass(item.rankTotalBet)">{{ item.rankTotalBet }}</td>
                </tr>
                <!-- 展开行 -->
                <tr v-if="expandedRows.has(item.key) && activeWindowIdx === 0" class="expand-row">
                  <td colspan="12" style="padding:4px">
                    <table class="ex">
                      <thead><tr class="extrth"><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
                      <tbody>
                        <tr v-for="(r, ri) in getLastPriceRows(item)" :key="ri">
                          <td :style="r.toBack > 0 ? 'background:#A6D8FF' : (r.toLay > 0 ? 'background:#FAC9D1' : '')">{{ r.price.toFixed(2) }}</td>
                          <td :style="r.toBack > 0 ? 'background:#A6D8FF' : ''">{{ r.toBack > 0 ? `HK$ ${formatMoney(r.toBack)}` : '' }}</td>
                          <td :style="r.toLay > 0 ? 'background:#FAC9D1' : ''">{{ r.toLay > 0 ? `HK$ ${formatMoney(r.toLay)}` : '' }}</td>
                          <td :class="tradedClass(r)">{{ r.traded > 0 ? `HK$ ${formatMoney(r.traded)}` : '' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </template>

              <!-- Under 汇总 -->
              <tr class="subtotal-row">
                <td><strong>Under 汇总</strong></td>
                <td></td><td></td><td></td><td></td><td></td><td></td>
                <td>{{ formatMoney(currentWindow.underTotalBet) }}</td>
                <td>{{ formatMoney(currentWindow.underMaxHold) }}</td>
                <td>{{ formatMoney(currentWindow.underTotalHold) }}</td>
                <td></td><td></td>
              </tr>

              <!-- Over 组 -->
              <template v-for="item in currentWindow.overItems" :key="'o-' + item.key">
                <tr :style="activeWindowIdx === 0 ? 'cursor:pointer' : ''" @click="toggleRow(item)">
                  <td :class="{ tdhighlight: isHandicapHighlighted(item) }"><strong>{{ item.displayName }}</strong></td>
                  <td :class="{ tdhighlight: isOddsHighlighted(item) }">{{ item.odds.toFixed(2) }}</td>
                  <td>{{ item.dense > 0 ? item.dense.toFixed(2) : '' }}</td>
                  <td :class="ssdClassFor(item.maxBet, currentWindow, 'MaxBet')">{{ formatMoney(item.maxBet) }}</td>
                  <td>{{ item.oddsOnMax > 0 ? item.oddsOnMax.toFixed(2) : '' }}</td>
                  <td>{{ item.maxBetAttr }}</td>
                  <td>{{ item.maxBetMark }}</td>
                  <td :class="ssdClassFor(item.totalBet, currentWindow, 'TotalBet')">{{ formatMoney(item.totalBet) }}</td>
                  <td :class="ssdClassFor(item.maxHold, currentWindow, 'MaxHold')">{{ formatMoney(item.maxHold) }}</td>
                  <td :class="ssdClassFor(item.totalHold, currentWindow, 'TotalHold')">{{ formatMoney(item.totalHold) }}</td>
                  <td :style="maxTotalStyle(item.maxTotal)">{{ (item.maxTotal * 100).toFixed(0) }}%</td>
                  <td :class="rankClass(item.rankTotalBet)">{{ item.rankTotalBet }}</td>
                </tr>
                <tr v-if="expandedRows.has(item.key) && activeWindowIdx === 0" class="expand-row">
                  <td colspan="12" style="padding:4px">
                    <table class="ex">
                      <thead><tr class="extrth"><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
                      <tbody>
                        <tr v-for="(r, ri) in getLastPriceRows(item)" :key="ri">
                          <td :style="r.toBack > 0 ? 'background:#A6D8FF' : (r.toLay > 0 ? 'background:#FAC9D1' : '')">{{ r.price.toFixed(2) }}</td>
                          <td :style="r.toBack > 0 ? 'background:#A6D8FF' : ''">{{ r.toBack > 0 ? `HK$ ${formatMoney(r.toBack)}` : '' }}</td>
                          <td :style="r.toLay > 0 ? 'background:#FAC9D1' : ''">{{ r.toLay > 0 ? `HK$ ${formatMoney(r.toLay)}` : '' }}</td>
                          <td :class="tradedClass(r)">{{ r.traded > 0 ? `HK$ ${formatMoney(r.traded)}` : '' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </template>

              <!-- Over 汇总 -->
              <tr class="subtotal-row">
                <td><strong>Over 汇总</strong></td>
                <td></td><td></td><td></td><td></td><td></td><td></td>
                <td>{{ formatMoney(currentWindow.overTotalBet) }}</td>
                <td>{{ formatMoney(currentWindow.overMaxHold) }}</td>
                <td>{{ formatMoney(currentWindow.overTotalHold) }}</td>
                <td></td><td></td>
              </tr>

              <!-- 统计行 -->
              <tr class="stats-row"><td>σ</td><td></td><td></td><td>{{ formatMoney(currentWindow.stdDevMaxBet) }}</td><td></td><td></td><td></td><td>{{ formatMoney(currentWindow.stdDevTotalBet) }}</td><td>{{ formatMoney(currentWindow.stdDevMaxHold) }}</td><td>{{ formatMoney(currentWindow.stdDevTotalHold) }}</td><td></td><td></td></tr>
              <tr class="stats-row"><td>μ</td><td></td><td></td><td>{{ formatMoney(currentWindow.avgMaxBet) }}</td><td></td><td></td><td></td><td>{{ formatMoney(currentWindow.avgTotalBet) }}</td><td>{{ formatMoney(currentWindow.avgMaxHold) }}</td><td>{{ formatMoney(currentWindow.avgTotalHold) }}</td><td></td><td></td></tr>
              <tr class="stats-row"><td>2σ</td><td></td><td></td><td>{{ formatMoney(currentWindow.threshold2SigmaMaxBet) }}</td><td></td><td></td><td></td><td>{{ formatMoney(currentWindow.threshold2SigmaTotalBet) }}</td><td>{{ formatMoney(currentWindow.threshold2SigmaMaxHold) }}</td><td>{{ formatMoney(currentWindow.threshold2SigmaTotalHold) }}</td><td></td><td></td></tr>
              <tr class="stats-row"><td>3σ</td><td></td><td></td><td>{{ formatMoney(currentWindow.threshold3SigmaMaxBet) }}</td><td></td><td></td><td></td><td>{{ formatMoney(currentWindow.threshold3SigmaTotalBet) }}</td><td>{{ formatMoney(currentWindow.threshold3SigmaMaxHold) }}</td><td>{{ formatMoney(currentWindow.threshold3SigmaTotalHold) }}</td><td></td><td></td></tr>

              <!-- Grand Total -->
              <tr class="grand-total-row">
                <td><strong>Grand Total</strong></td>
                <td colspan="6"></td>
                <td>{{ formatMoney(currentWindow.grandTotalBet) }}</td>
                <td></td>
                <td>{{ formatMoney(currentWindow.grandTotalHold) }}</td>
                <td></td><td></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 时间窗口大注 TOP5 -->
        <template v-if="currentWindow.windowBigList && currentWindow.windowBigList.length > 0">
          <h4>{{ currentWindow.label }} 大注 TOP5</h4>
          <table class="gridtable">
            <thead><tr><th>Handicap</th><th>Odds</th><th>TradedChange</th><th>Attr</th><th>Payout</th><th>Per</th><th>Weight</th><th>P Mark</th><th>Update Time</th></tr></thead>
            <tbody>
              <tr v-for="b in currentWindow.windowBigList" :key="b.pcId">
                <td><strong>{{ b.selectionName }}</strong></td>
                <td>{{ b.lastOdds.toFixed(2) }}</td>
                <td>{{ formatMoney(b.tradedChange) }}</td>
                <td>{{ b.tradedAttr }}</td>
                <td>{{ b.payout.toFixed(0) }}</td>
                <td>{{ bigPerDisplay(b.per) }}</td>
                <td>{{ b.weight.toFixed(0) }}</td>
                <td>{{ b.pMark }}</td>
                <td :style="bigTimeColorStyle(b.colorRank)">{{ new Date(b.refreshTime).toLocaleString('zh-CN') }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </template>

      <!-- 以下区块仅在全时 Tab 显示 -->
      <template v-if="activeWindowIdx === 0">
      <h4>大注 TOP10</h4>
      <table class="gridtable">
        <thead><tr><th>Handicap</th><th>Odds</th><th>TradedChange</th><th>Attr</th><th>Payout</th><th>Per</th><th>Weight</th><th>P Mark</th><th>Update Time</th></tr></thead>
        <tbody>
          <template v-for="big in bigList" :key="big.pcId">
            <tr :class="{ 'row-resonant': isResonant(big) }" style="cursor:pointer" @click="toggleBigRow(big)">
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
      <button class="ts_button" @click="toggleSection('hold')">展开/收起 Hold TOP10</button>
      <div v-if="!collapsedSections.has('hold')" class="match_list">
        <h4>Hold TOP10</h4>
        <table class="gridtable">
          <thead><tr><th>Handicap</th><th>Odds</th><th>TradedChange</th><th>Attr</th><th>Top Hold</th><th>Payout</th><th>Per</th><th>Weight</th><th>P Mark</th><th>Update Time</th></tr></thead>
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
      </div>

      <!-- Net 表 -->
      <template v-if="netList.length > 0">
        <h4>Net表</h4>
        <table class="gridtable">
          <thead><tr><th>Title</th><th>赔付</th><th>收益</th><th>净赔付</th><th>盈亏</th></tr></thead>
          <tbody>
            <tr v-for="n in netList" :key="n.title">
              <td>{{ n.title }}</td>
              <td :style="netStyle(n.payoutTotal)">{{ formatMoney(n.payoutTotal) }}</td>
              <td :style="netStyle(n.netTotal)">{{ formatMoney(n.netTotal) }}</td>
              <td :style="netStyle(n.payout)">{{ formatMoney(n.payout) }}</td>
              <td :style="winStyle(n.win)">{{ (n.win * 100).toFixed(1) }}%</td>
            </tr>
          </tbody>
        </table>
      </template>

      <!-- -15分钟 Net 表 -->
      <template v-if="netList15.length > 0">
        <button class="ts_button" @click="toggleSection('net15')">展开/收起 -15分钟 Net表</button>
        <div v-if="!collapsedSections.has('net15')">
          <h4>-15分钟 Net表</h4>
          <table class="gridtable">
            <thead><tr><th>Title</th><th>赔付</th><th>收益</th><th>净赔付</th><th>盈亏</th></tr></thead>
            <tbody>
              <tr v-for="n in netList15" :key="n.title">
                <td>{{ n.title }}</td>
                <td :style="netStyle(n.payoutTotal)">{{ formatMoney(n.payoutTotal) }}</td>
                <td :style="netStyle(n.netTotal)">{{ formatMoney(n.netTotal) }}</td>
                <td :style="netStyle(n.payout)">{{ formatMoney(n.payout) }}</td>
                <td :style="winStyle(n.win)">{{ (n.win * 100).toFixed(1) }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <!-- 最小/最大 Payout -->
      <template v-if="minPayoutList.length > 0">
        <h4>最小 Payout</h4>
        <table class="gridtable">
          <thead><tr><th>Handicap</th><th>Amount</th><th>TradedChange</th><th>Attr</th><th>LastOdds</th><th>Payout</th><th>Per</th><th>Per2</th><th>Weight</th><th>P Mark</th><th>RefreshTime</th></tr></thead>
          <tbody>
            <tr v-for="p in minPayoutList" :key="'min-'+p.selectionId+p.handicap">
              <td>{{ p.selectionName }}</td>
              <td>{{ formatMoney(p.amount) }}</td>
              <td>{{ formatMoney(p.tradedChange) }}</td>
              <td>{{ p.tradedAttr }}</td>
              <td>{{ p.lastOdds.toFixed(2) }}</td>
              <td>{{ p.payout.toFixed(0) }}</td>
              <td>{{ (p.per / 100).toFixed(0) }}%</td>
              <td>{{ (p.per2 * 100).toFixed(1) }}%</td>
              <td>{{ p.weight.toFixed(0) }}</td>
              <td>{{ p.pMark }}</td>
              <td>{{ new Date(p.refreshTime).toLocaleString('zh-CN') }}</td>
            </tr>
          </tbody>
        </table>
      </template>

      <template v-if="maxPayoutList.length > 0">
        <h4>最大 Payout</h4>
        <table class="gridtable">
          <thead><tr><th>Handicap</th><th>Amount</th><th>TradedChange</th><th>Attr</th><th>LastOdds</th><th>Payout</th><th>Per</th><th>Per2</th><th>Weight</th><th>P Mark</th><th>RefreshTime</th></tr></thead>
          <tbody>
            <tr v-for="p in maxPayoutList" :key="'max-'+p.selectionId+p.handicap">
              <td>{{ p.selectionName }}</td>
              <td>{{ formatMoney(p.amount) }}</td>
              <td>{{ formatMoney(p.tradedChange) }}</td>
              <td>{{ p.tradedAttr }}</td>
              <td>{{ p.lastOdds.toFixed(2) }}</td>
              <td>{{ p.payout.toFixed(0) }}</td>
              <td>{{ (p.per / 100).toFixed(0) }}%</td>
              <td>{{ (p.per2 * 100).toFixed(1) }}%</td>
              <td>{{ p.weight.toFixed(0) }}</td>
              <td>{{ p.pMark }}</td>
              <td>{{ new Date(p.refreshTime).toLocaleString('zh-CN') }}</td>
            </tr>
          </tbody>
        </table>
      </template>
      </template><!-- end activeWindowIdx === 0 -->
    </template>
  </div>
</template>

<style scoped>
@import '~/assets/css/detail-shared.css';

/* cs (Goal Line) 页面特有样式 */
.odds-info { color: #337ab7; font-weight: normal; font-size: 13px; }
.view-subtitle { color: #666; font-size: 13px; margin-bottom: 6px; }

/* ── 分时统计摘要面板 ── */
.summary-panel {
  margin: 12px 0;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}
.summary-title {
  padding: 6px 14px;
  background: #b22222;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.5px;
}
.summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.summary-table th,
.summary-table td {
  padding: 6px 28px;
  text-align: center;
  border-bottom: 1px solid #eee;
  line-height: 1.7;
}
.summary-table th {
  background: #f5f5f5;
  border-bottom: 1px solid #ccc;
  font-weight: 600;
  font-size: 12px;
  color: #555;
}
.summary-row { cursor: pointer; transition: background 0.12s; }
.summary-row:hover { background: #fef9e7; }
.summary-active { background: #fff3cd !important; font-weight: 600; }
th.st-label, td.st-label { font-weight: 600; padding-left: 16px !important; text-align: left !important; white-space: nowrap; }
td.st-amount { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
th.st-amount { white-space: nowrap; min-width: 100px; }
td.st-weight { white-space: nowrap; }
td.st-ratio { font-variant-numeric: tabular-nums; white-space: nowrap; }
th.st-ratio { white-space: nowrap; min-width: 120px; }

/* ── 跨表共振高亮（GL 与 OU2.5 同一时间均有大注时整行突出显示） ── */
.row-resonant {
  background: #fef9e7 !important;
  border-left: 4px solid #f59e0b !important;
}
.row-resonant:hover {
  background: #fef3c7 !important;
}
.row-resonant td:first-child {
  padding-left: 8px !important;
}
</style>
