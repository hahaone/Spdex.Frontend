<script setup lang="ts">
import type { AsianHcRow, AsianHcGroup, AsianTimeWindowData, AsianBigItem } from '~/types/asianbighold'
import type { PriceSizeRow } from '~/types/bighold'
import { parseRawData } from '~/utils/parseRawData'
import { formatMoney, formatMatchTimeFull, formatPercent, formatOdds, formatDense, formatBestPrice, formatNetPayout, formatTimeWithSeconds } from '~/utils/formatters'
import { highlightClass } from '~/utils/styleHelpers'

// ── 路由参数 ──
const route = useRoute()
const eventId = computed(() => Number(route.query.id) || 0)
const orderParam = ref(0)

// ── 数据获取 ──
const queryParams = computed(() => ({
  id: eventId.value,
  order: orderParam.value,
}))
const { data, pending, error, refreshing, manualRefresh } = useAsianBigHold(queryParams)

const result = computed(() => data.value?.data)
const matchInfo = computed(() => result.value?.match)
const windows = computed(() => result.value?.windows ?? [])
const netPayouts = computed(() => result.value?.netPayouts ?? [])
const netPayouts15 = computed(() => result.value?.netPayouts15 ?? [])
const volumeSummary = computed(() => result.value?.volumeSummary ?? [])
const bigList = computed(() => result.value?.bigList ?? [])
const holdList = computed(() => result.value?.holdList ?? [])
const windowBigLists = computed(() => result.value?.windowBigLists ?? [])
const odds0 = computed(() => result.value?.odds0)

// ── B24: 页面 title ──
useHead({
  title: computed(() => matchInfo.value
    ? `亚盘 ${matchInfo.value.homeTeam}vs${matchInfo.value.guestTeam}`
    : '亚盘'),
})

// ── Tab 切换 ──
const activeTab = ref(0)
const activeWindow = computed<AsianTimeWindowData | null>(() => windows.value[activeTab.value] ?? null)

watch(activeTab, () => {
  expandedKey.value = null
  expandedBigPcId.value = null
})

// ── 行展开状态：用 selectionId-handicap 作为唯一 key ──
const expandedKey = ref<string | null>(null)
const expandedBigPcId = ref<number | null>(null)

function rowKey(row: AsianHcRow): string {
  return `${row.selectionId}-${row.handicap}`
}

function toggleExpand(row: AsianHcRow) {
  const key = rowKey(row)
  expandedKey.value = expandedKey.value === key ? null : key
}

function toggleBigExpand(pcId: number) {
  expandedBigPcId.value = expandedBigPcId.value === pcId ? null : pcId
}

// ── 当前 Tab 对应的 windowBigList（按 hoursOffset 匹配）──
const activeWindowBigList = computed(() => {
  if (!activeWindow.value) return null
  return windowBigLists.value.find(
    wbl => wbl.hoursOffset === activeWindow.value!.hoursOffset,
  ) ?? null
})

// ── 是否为当前窗口（offset=0，有 LastPrice 数据）──
const isCurrentWindow = computed(() => activeWindow.value?.hoursOffset === 0)

// ── 查找行对应的 LastPrice 记录（用 epsilon 容差匹配 handicap）──
function findLastPrice(row: AsianHcRow) {
  if (!activeWindow.value?.lastPrices) return null
  return activeWindow.value.lastPrices.find(
    p => p.selectionId === row.selectionId && Math.abs(p.handicap - row.handicap) < 0.001,
  ) ?? null
}

// ── 获取行对应的 LastPrice 挂牌数据 ──
function getLastPriceRows(row: AsianHcRow): PriceSizeRow[] {
  const lp = findLastPrice(row)
  if (!lp?.rawData) return []
  return parseRawData(lp.rawData)
}

function getBigRawDataRows(item: AsianBigItem): PriceSizeRow[] {
  if (!item.rawData) return []
  return parseRawData(item.rawData)
}

function hasLargeOrder(row: AsianHcRow): boolean {
  const lp = findLastPrice(row)
  return lp?.hasLargeOrderAt500Or1000 ?? false
}

// ── 排序 ──
function setOrder(newOrder: number) {
  orderParam.value = newOrder
  expandedKey.value = null
  expandedBigPcId.value = null
}

// ── 判断 groups 是否有数据 ──
function hasGroupData(groups: AsianHcGroup[] | undefined | null): boolean {
  if (!groups || groups.length === 0) return false
  return groups.some(g => g.rows.length > 0)
}

// ── 格式化辅助 → 已移至 ~/utils/formatters.ts ──
// 下方保留局部别名以兼容模板中的调用名
const formatMatchTime = formatMatchTimeFull
const formatTime = formatTimeWithSeconds

function formatMaxTotal(val: number): string {
  return formatPercent(val, 0)
}

// ── B9: Home/Away 占比 ──
function homePercent(): string {
  if (!activeWindow.value) return ''
  const ht = activeWindow.value.homeSubtotal?.grandTotalBet ?? 0
  const at = activeWindow.value.awaySubtotal?.grandTotalBet ?? 0
  const total = ht + at
  if (total === 0) return ''
  return (ht / total * 100).toFixed(1) + '%'
}
function awayPercent(): string {
  if (!activeWindow.value) return ''
  const ht = activeWindow.value.homeSubtotal?.grandTotalBet ?? 0
  const at = activeWindow.value.awaySubtotal?.grandTotalBet ?? 0
  const total = ht + at
  if (total === 0) return ''
  return (at / total * 100).toFixed(1) + '%'
}

// ── B23: TotalHold / TotalBet ratio ──
function holdBetRatio(subtotal: { grandTotalBet: number, grandTotalHold: number } | undefined): string {
  if (!subtotal || subtotal.grandTotalBet === 0) return ''
  return (subtotal.grandTotalHold / subtotal.grandTotalBet).toFixed(2)
}

// ── 高亮样式 → highlightClass 已移至 ~/utils/styleHelpers.ts ──

/** MaxTotal > 65% 红色加粗 */
function maxTotalClass(row: AsianHcRow): string {
  return row.maxTotalHighlight ? 'text-red-bold' : ''
}

/** Rank ≤ 4 红色加粗 */
function rankClass(row: AsianHcRow): string {
  return row.rankHighlight ? 'text-red-bold' : ''
}

/** B22: MaxHold Rank 4 级红色渐变 */
function maxHoldRankClass(row: AsianHcRow): string {
  const classes: string[] = []
  if (row.maxHoldHighlight === 2) classes.push('td-highlight')
  else if (row.maxHoldHighlight === 1) classes.push('td-lowlight')
  if (row.rankMaxHoldLevel > 0 && row.rankMaxHoldLevel <= 4)
    classes.push('mh-red' + row.rankMaxHoldLevel)
  return classes.join(' ')
}

/** 有效后路：整行背景不再使用，改为仅高亮 Latest Price 列 */
function effectiveRouteClass(_row: AsianHcRow): string {
  return ''
}

/** Handicap 列高亮：LastPrice 仅 1 个成交价位且 > 1000（旧系统 HighlightCode / tr_focus2） */
function handicapHighlightClass(row: AsianHcRow): string {
  return row.latestPriceHighlight ? 'td-highlight' : ''
}

/** Latest Price 列高亮：有效后路（旧系统 HighlightCode2 / tr_focusPrice） */
function latestPriceClass(row: AsianHcRow): string {
  return row.effectiveRouteHighlight ? 'td-highlight' : ''
}

/** 让球值负值标红 */
function handicapClass(row: AsianHcRow): string {
  return row.isNegativeHandicap ? 'text-neg' : ''
}

/** PMark 样式 */
function pmarkClass(mark: string): string {
  if (!mark) return ''
  return 'pmark-' + mark.toLowerCase()
}

/** 挂牌 Back/Lay 背景 */
function priceBgClass(row: PriceSizeRow): string {
  if (row.toBack > 0) return 'bg-back'
  if (row.toLay > 0) return 'bg-lay'
  return ''
}

function tradedClass(row: PriceSizeRow): string {
  if (row.tradedHighlight >= 3) return 'text-traded-3x'
  if (row.tradedHighlight >= 2) return 'text-traded-2x'
  return ''
}

/** 大额挂单行背景 */
function largeOrderClass(row: AsianHcRow): string {
  return hasLargeOrder(row) ? 'row-large-order' : ''
}

/** 颜色分组 */
const colorPalette = ['#570202', '#0531ab', '#cf1204', '#620382', '#0c4f02', '#33126b', '#8f8210', '#8f108d', '#080a45', '#174508', '#086873', '#8a501e', '#e3496d']
function colorGroupStyle(item: AsianBigItem): Record<string, string> {
  if (!item.colorGroup) return {}
  const idx = (item.colorGroup - 1) % colorPalette.length
  return { color: colorPalette[idx]! }
}
</script>

<template>
  <div class="asian-page">
    <!-- 加载/错误状态 -->
    <div v-if="pending" class="loading">加载中...</div>
    <div v-else-if="error || !result" class="error-msg">
      {{ error ? '数据加载失败' : '赛事不存在或亚盘 MarketId3 为 0' }}
      <NuxtLink to="/" class="back-link">&larr; 返回首页</NuxtLink>
    </div>

    <template v-else>
      <!-- 页头 -->
      <div class="match-header">
        <NuxtLink to="/" class="back-link">&larr; 返回列表</NuxtLink>
        <h2 class="match-title">
          <span class="team-home">{{ matchInfo?.homeTeam }}</span>
          <span class="team-vs">vs</span>
          <span class="team-away">{{ matchInfo?.guestTeam }}</span>
        </h2>
        <div class="match-meta">
          开赛时间：{{ formatMatchTime(matchInfo?.matchTime ?? '') }}
          &nbsp;|&nbsp; 亚盘 (Asian Handicap)
          <template v-if="activeWindow && activeWindow.bestPriceHome > 0">
            &nbsp;|&nbsp; 合理价：
            <b class="best-price-home">Home {{ formatBestPrice(activeWindow.bestPriceHome) }}</b>
            &nbsp;
            <b class="best-price-away">Away {{ formatBestPrice(activeWindow.bestPriceAway) }}</b>
          </template>
        </div>
        <!-- B1: Odds0 信息 -->
        <div v-if="odds0" class="odds0-bar">
          对应标盘：({{ odds0.homeWeight.toFixed(0) }}-{{ odds0.drawWeight.toFixed(0) }}-{{ odds0.awayWeight.toFixed(0) }}__{{ formatMoney(odds0.totalAmount) }})
          (主:{{ odds0.homePayout.toFixed(0) }} 平:{{ odds0.drawPayout.toFixed(0) }} 客:{{ odds0.awayPayout.toFixed(0) }})
        </div>
      </div>

      <!-- 排序 + 刷新 -->
      <div class="sort-bar">
        <span class="sort-label">排序：</span>
        <button :class="['sort-btn', { active: orderParam === 0 }]" @click="setOrder(0)">Hold &darr;</button>
        <button :class="['sort-btn', { active: orderParam === 1 }]" @click="setOrder(1)">时间 &darr;</button>
        <button :class="['sort-btn', { active: orderParam === 2 }]" @click="setOrder(2)">序号 &uarr;</button>
        <button class="refresh-btn" :disabled="refreshing" @click="manualRefresh">
          <span :class="{ spin: refreshing }">↻</span>
          {{ refreshing ? '刷新中...' : '刷新数据' }}
        </button>
      </div>

      <!-- Tab 栏 -->
      <div class="tab-bar">
        <button
          v-for="(w, idx) in windows"
          :key="idx"
          :class="['tab-btn', { active: activeTab === idx }]"
          @click="activeTab = idx"
        >{{ w.label }}</button>
      </div>

      <!-- 当前 Tab 内容 -->
      <div v-if="activeWindow" class="window-content">
        <!-- ViewSubTitle 副标题 -->
        <div v-if="activeWindow.viewSubTitle" class="view-subtitle">
          {{ activeWindow.viewSubTitle }}
        </div>

        <!-- ═══ HOME 区域 ═══ -->
        <template v-if="hasGroupData(activeWindow.homeGroups)">
          <div class="side-header side-home">
            <span class="side-label">Home（主队）</span>
            <span class="side-total">
              TotalBet: <b>{{ formatMoney(activeWindow.homeSubtotal?.grandTotalBet ?? 0) }}</b>
              &nbsp; MaxHold: <b>{{ formatMoney(activeWindow.homeSubtotal?.grandMaxHold ?? 0) }}</b>
              &nbsp; TotalHold: <b>{{ formatMoney(activeWindow.homeSubtotal?.grandTotalHold ?? 0) }}</b>
              <!-- B23 -->
              <template v-if="holdBetRatio(activeWindow.homeSubtotal)">
                &nbsp; TotalHold/TotalBet: <b>{{ holdBetRatio(activeWindow.homeSubtotal) }}</b>
              </template>
            </span>
          </div>
          <div class="table-wrapper">
            <table class="hc-table">
              <thead>
                <tr>
                  <th class="col-hc">Handicap</th>
                  <th class="col-price">Latest Price</th>
                  <th class="col-dense">Dense</th>
                  <th class="col-dp">Dense%</th>
                  <th class="col-maxbet">MaxBet</th>
                  <th class="col-mbp">MaxBet Price</th>
                  <th class="col-attr">Attribute</th>
                  <th class="col-tm">Time Mark</th>
                  <th class="col-tb">Total bet</th>
                  <th class="col-mh">Max hold</th>
                  <th class="col-th">Total hold</th>
                  <th class="col-mt">Max/total</th>
                  <th class="col-rank">Rank</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="group in (activeWindow.homeGroups ?? [])" :key="'hg-' + group.label">
                  <tr v-if="group.rows.length > 0" class="band-header">
                    <td colspan="13">{{ group.label }}</td>
                  </tr>
                  <template v-for="row in group.rows" :key="'hr-' + rowKey(row)">
                    <tr :class="['data-row', effectiveRouteClass(row), largeOrderClass(row), { 'row-expanded': expandedKey === rowKey(row) }]">
                      <td :class="['col-hc-val', handicapClass(row), handicapHighlightClass(row)]" @click="toggleExpand(row)">{{ row.displayName }}</td>
                      <td :class="latestPriceClass(row)">{{ formatOdds(row.odds) }}</td>
                      <td>{{ formatDense(row.dense) }}</td>
                      <td>{{ row.densePercent > 0 ? formatPercent(row.densePercent) : '' }}</td>
                      <td :class="highlightClass(row.maxBetHighlight)">{{ formatMoney(row.maxBet) }}</td>
                      <td>{{ formatOdds(row.maxBetPrice) }}</td>
                      <td class="col-attr-val">{{ row.maxBetAttr }}</td>
                      <td><span :class="['pmark-badge', pmarkClass(row.timeMark)]">{{ row.timeMark }}</span></td>
                      <td :class="highlightClass(row.totalBetHighlight)">{{ formatMoney(row.totalBet) }}</td>
                      <td :class="maxHoldRankClass(row)">{{ formatMoney(row.maxHold) }}</td>
                      <td :class="highlightClass(row.totalHoldHighlight)">{{ formatMoney(row.totalHold) }}</td>
                      <td :class="maxTotalClass(row)">{{ row.maxTotal > 0 ? formatMaxTotal(row.maxTotal) : '' }}</td>
                      <td :class="rankClass(row)">{{ row.rankTotalBet > 0 ? row.rankTotalBet : '' }}</td>
                    </tr>
                    <tr v-if="expandedKey === rowKey(row)" class="expand-row">
                      <td colspan="13">
                        <div class="expand-content">
                          <div class="detail-panel">
                            <div class="panel-title">LastPrice 挂牌数据 ({{ row.displayName }})</div>
                            <template v-if="isCurrentWindow">
                              <table v-if="getLastPriceRows(row).length > 0" class="detail-table">
                                <thead><tr><th>价位</th><th>买(Back)</th><th>卖(Lay)</th><th>成交(Traded)</th></tr></thead>
                                <tbody>
                                  <tr v-for="pr in getLastPriceRows(row)" :key="'lp-' + pr.price">
                                    <td :class="priceBgClass(pr)">{{ pr.price }}</td>
                                    <td :class="{ 'bg-back': pr.toBack > 0 }">{{ pr.toBack > 0 ? formatMoney(pr.toBack) : '' }}</td>
                                    <td :class="{ 'bg-lay': pr.toLay > 0 }">{{ pr.toLay > 0 ? formatMoney(pr.toLay) : '' }}</td>
                                    <td :class="tradedClass(pr)">{{ pr.traded > 0 ? formatMoney(pr.traded) : '' }}</td>
                                  </tr>
                                </tbody>
                              </table>
                              <div v-else class="panel-empty">该选项无 LastPrice 挂牌数据</div>
                            </template>
                            <div v-else class="panel-empty">挂牌数据仅在"当前"窗口提供</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                  <tr v-if="group.rows.length > 0" class="subtotal-row">
                    <td colspan="8" class="subtotal-label">{{ group.label }} 小计</td>
                    <td class="subtotal-val">{{ formatMoney(group.subtotal.grandTotalBet) }}</td>
                    <td class="subtotal-val">{{ formatMoney(group.subtotal.grandMaxHold) }}</td>
                    <td class="subtotal-val">{{ formatMoney(group.subtotal.grandTotalHold) }}</td>
                    <td colspan="2"></td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </template>

        <!-- ═══ AWAY 区域 ═══ -->
        <template v-if="hasGroupData(activeWindow.awayGroups)">
          <div class="side-header side-away">
            <span class="side-label">Away（客队）</span>
            <span class="side-total">
              TotalBet: <b>{{ formatMoney(activeWindow.awaySubtotal?.grandTotalBet ?? 0) }}</b>
              &nbsp; MaxHold: <b>{{ formatMoney(activeWindow.awaySubtotal?.grandMaxHold ?? 0) }}</b>
              &nbsp; TotalHold: <b>{{ formatMoney(activeWindow.awaySubtotal?.grandTotalHold ?? 0) }}</b>
              <template v-if="holdBetRatio(activeWindow.awaySubtotal)">
                &nbsp; TotalHold/TotalBet: <b>{{ holdBetRatio(activeWindow.awaySubtotal) }}</b>
              </template>
            </span>
          </div>
          <div class="table-wrapper">
            <table class="hc-table">
              <thead>
                <tr>
                  <th class="col-hc">Handicap</th><th class="col-price">Latest Price</th><th class="col-dense">Dense</th>
                  <th class="col-dp">Dense%</th><th class="col-maxbet">MaxBet</th><th class="col-mbp">MaxBet Price</th>
                  <th class="col-attr">Attribute</th><th class="col-tm">Time Mark</th><th class="col-tb">Total bet</th>
                  <th class="col-mh">Max hold</th><th class="col-th">Total hold</th><th class="col-mt">Max/total</th>
                  <th class="col-rank">Rank</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="group in (activeWindow.awayGroups ?? [])" :key="'ag-' + group.label">
                  <tr v-if="group.rows.length > 0" class="band-header"><td colspan="13">{{ group.label }}</td></tr>
                  <template v-for="row in group.rows" :key="'ar-' + rowKey(row)">
                    <tr :class="['data-row', effectiveRouteClass(row), largeOrderClass(row), { 'row-expanded': expandedKey === rowKey(row) }]">
                      <td :class="['col-hc-val', handicapClass(row), handicapHighlightClass(row)]" @click="toggleExpand(row)">{{ row.displayName }}</td>
                      <td :class="latestPriceClass(row)">{{ formatOdds(row.odds) }}</td>
                      <td>{{ formatDense(row.dense) }}</td>
                      <td>{{ row.densePercent > 0 ? formatPercent(row.densePercent) : '' }}</td>
                      <td :class="highlightClass(row.maxBetHighlight)">{{ formatMoney(row.maxBet) }}</td>
                      <td>{{ formatOdds(row.maxBetPrice) }}</td>
                      <td class="col-attr-val">{{ row.maxBetAttr }}</td>
                      <td><span :class="['pmark-badge', pmarkClass(row.timeMark)]">{{ row.timeMark }}</span></td>
                      <td :class="highlightClass(row.totalBetHighlight)">{{ formatMoney(row.totalBet) }}</td>
                      <td :class="maxHoldRankClass(row)">{{ formatMoney(row.maxHold) }}</td>
                      <td :class="highlightClass(row.totalHoldHighlight)">{{ formatMoney(row.totalHold) }}</td>
                      <td :class="maxTotalClass(row)">{{ row.maxTotal > 0 ? formatMaxTotal(row.maxTotal) : '' }}</td>
                      <td :class="rankClass(row)">{{ row.rankTotalBet > 0 ? row.rankTotalBet : '' }}</td>
                    </tr>
                    <tr v-if="expandedKey === rowKey(row)" class="expand-row">
                      <td colspan="13">
                        <div class="expand-content">
                          <div class="detail-panel">
                            <div class="panel-title">LastPrice 挂牌数据 ({{ row.displayName }})</div>
                            <template v-if="isCurrentWindow">
                              <table v-if="getLastPriceRows(row).length > 0" class="detail-table">
                                <thead><tr><th>价位</th><th>买(Back)</th><th>卖(Lay)</th><th>成交(Traded)</th></tr></thead>
                                <tbody>
                                  <tr v-for="pr in getLastPriceRows(row)" :key="'alp-' + pr.price">
                                    <td :class="priceBgClass(pr)">{{ pr.price }}</td>
                                    <td :class="{ 'bg-back': pr.toBack > 0 }">{{ pr.toBack > 0 ? formatMoney(pr.toBack) : '' }}</td>
                                    <td :class="{ 'bg-lay': pr.toLay > 0 }">{{ pr.toLay > 0 ? formatMoney(pr.toLay) : '' }}</td>
                                    <td :class="tradedClass(pr)">{{ pr.traded > 0 ? formatMoney(pr.traded) : '' }}</td>
                                  </tr>
                                </tbody>
                              </table>
                              <div v-else class="panel-empty">该选项无 LastPrice 挂牌数据</div>
                            </template>
                            <div v-else class="panel-empty">挂牌数据仅在"当前"窗口提供</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </template>
                  <tr v-if="group.rows.length > 0" class="subtotal-row">
                    <td colspan="8" class="subtotal-label">{{ group.label }} 小计</td>
                    <td class="subtotal-val">{{ formatMoney(group.subtotal.grandTotalBet) }}</td>
                    <td class="subtotal-val">{{ formatMoney(group.subtotal.grandMaxHold) }}</td>
                    <td class="subtotal-val">{{ formatMoney(group.subtotal.grandTotalHold) }}</td>
                    <td colspan="2"></td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </template>

        <!-- 无数据 -->
        <div v-if="!hasGroupData(activeWindow.homeGroups) && !hasGroupData(activeWindow.awayGroups)" class="no-data">暂无数据</div>

        <!-- B9: Home/Away 占比行 -->
        <div v-if="homePercent() && activeWindow.allSubtotal" class="ratio-bar">
          <span>Home <b>{{ homePercent() }}</b> — Away <b>{{ awayPercent() }}</b></span>
          <span class="ratio-sep">|</span>
          <span>总 TotalBet: <b>{{ formatMoney(activeWindow.allSubtotal.grandTotalBet) }}</b></span>
          <span class="ratio-sep">|</span>
          <span>总 MaxHold: <b>{{ formatMoney(activeWindow.allSubtotal.grandMaxHold) }}</b></span>
          <span class="ratio-sep">|</span>
          <span>总 TotalHold: <b>{{ formatMoney(activeWindow.allSubtotal.grandTotalHold) }}</b></span>
        </div>

        <!-- ═══ 统计量（X2/X3 阈值） ═══ -->
        <div v-if="activeWindow.allSubtotal" class="stats-bar">
          <div class="stats-row">
            <span class="stats-chip">MaxBet: σ={{ formatMoney(activeWindow.allSubtotal.avr) }} X2=<b>{{ formatMoney(activeWindow.allSubtotal.x2) }}</b> X3=<b>{{ formatMoney(activeWindow.allSubtotal.x3) }}</b></span>
            <span class="stats-chip">TotalBet: X2=<b>{{ formatMoney(activeWindow.allSubtotal.totalBetX2) }}</b> X3=<b>{{ formatMoney(activeWindow.allSubtotal.totalBetX3) }}</b></span>
            <span class="stats-chip">MaxHold: X2=<b>{{ formatMoney(activeWindow.allSubtotal.maxHoldX2) }}</b> X3=<b>{{ formatMoney(activeWindow.allSubtotal.maxHoldX3) }}</b></span>
            <span class="stats-chip">TotalHold: X2=<b>{{ formatMoney(activeWindow.allSubtotal.totalHoldX2) }}</b> X3=<b>{{ formatMoney(activeWindow.allSubtotal.totalHoldX3) }}</b></span>
          </div>
        </div>

        <!-- ═══ 当前 Tab 对应的大注 TOP5 ═══ -->
        <div v-if="activeWindowBigList && activeWindowBigList.items.length > 0" class="big-section">
          <h4 class="section-title">大注 TOP5（{{ activeWindowBigList.label }}）</h4>
          <div class="table-wrapper">
            <table class="big-table compact">
              <thead>
                <tr>
                  <th>Handicap</th><th>Odds</th><th>TradedChange</th><th>Attr</th>
                  <th>Hold</th><th>Payout</th><th>Per</th><th>Weight</th><th>P Mark</th><th>Update Time</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in activeWindowBigList.items" :key="'wbi-' + item.pcId" class="data-row big-row">
                  <td class="col-hc-val">{{ item.selection }}</td>
                  <td>{{ item.lastOdds.toFixed(2) }}</td>
                  <td :class="highlightClass(item.amountHighlight)">{{ formatMoney(item.tradedChange) }}</td>
                  <td>{{ item.tradedAttr }}</td>
                  <td>{{ formatMoney(item.hold) }}</td>
                  <td>{{ item.payout.toFixed(0) }}</td>
                  <td>{{ (item.per * 100).toFixed(0) }}%</td>
                  <td>{{ item.weight.toFixed(0) }}</td>
                  <td><span :class="['pmark-badge', pmarkClass(item.pMark)]">{{ item.pMark }}</span></td>
                  <td :style="colorGroupStyle(item)">{{ formatTime(item.refreshTime) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ═══ B3: 大注 TOP10 ═══ -->
      <div v-if="bigList.length > 0 && activeTab === 0" class="big-section">
        <h4 class="section-title">大注 TOP10（按 TradedChange）</h4>
        <div class="table-wrapper">
          <table class="big-table">
            <thead>
              <tr>
                <th>Handicap</th><th>Odds</th><th>TradedChange</th><th>Attr</th>
                <th>Hold</th><th>Payout</th><th>Per</th><th>Weight</th><th>P Mark</th><th>Update Time</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="item in bigList" :key="'bg-' + item.pcId">
                <tr class="data-row big-row" @click="toggleBigExpand(item.pcId)">
                  <td class="col-hc-val">{{ item.selection }}</td>
                  <td>{{ item.lastOdds.toFixed(2) }}</td>
                  <td :class="highlightClass(item.amountHighlight)">{{ formatMoney(item.tradedChange) }}</td>
                  <td>{{ item.tradedAttr }}</td>
                  <td :class="highlightClass(item.holdHighlight)">{{ formatMoney(item.hold) }}</td>
                  <td>{{ item.payout.toFixed(0) }}</td>
                  <td>{{ (item.per * 100).toFixed(0) }}%</td>
                  <td>{{ item.weight.toFixed(0) }}</td>
                  <td><span :class="['pmark-badge', pmarkClass(item.pMark)]">{{ item.pMark }}</span></td>
                  <td :style="colorGroupStyle(item)">{{ formatTime(item.refreshTime) }}</td>
                </tr>
                <tr v-if="expandedBigPcId === item.pcId" class="expand-row">
                  <td colspan="10">
                    <div class="expand-content">
                      <div class="detail-panel">
                        <div class="panel-title">当前记录 RawData</div>
                        <table v-if="getBigRawDataRows(item).length > 0" class="detail-table">
                          <thead><tr><th>价位</th><th>买(Back)</th><th>卖(Lay)</th><th>成交(Traded)</th></tr></thead>
                          <tbody>
                            <tr v-for="pr in getBigRawDataRows(item)" :key="'bpr-' + pr.price">
                              <td :class="priceBgClass(pr)">{{ pr.price }}</td>
                              <td :class="{ 'bg-back': pr.toBack > 0 }">{{ pr.toBack > 0 ? formatMoney(pr.toBack) : '' }}</td>
                              <td :class="{ 'bg-lay': pr.toLay > 0 }">{{ pr.toLay > 0 ? formatMoney(pr.toLay) : '' }}</td>
                              <td :class="tradedClass(pr)">{{ pr.traded > 0 ? formatMoney(pr.traded) : '' }}</td>
                            </tr>
                          </tbody>
                        </table>
                        <div v-else class="panel-empty">无 RawData</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ═══ B5: Hold TOP10 ═══ -->
      <div v-if="holdList.length > 0 && activeTab === 0" class="big-section">
        <h4 class="section-title">Hold TOP10（按持仓额）</h4>
        <div class="table-wrapper">
          <table class="big-table">
            <thead>
              <tr>
                <th>Handicap</th><th>Odds</th><th>TradedChange</th><th>Attr</th>
                <th>Top Hold</th><th>Payout</th><th>Per</th><th>Weight</th><th>P Mark</th><th>Update Time</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="item in holdList" :key="'hl-' + item.pcId">
                <tr class="data-row big-row" @click="toggleBigExpand(item.pcId + 100000)">
                  <td class="col-hc-val">{{ item.selection }}</td>
                  <td>{{ item.lastOdds.toFixed(2) }}</td>
                  <td :class="highlightClass(item.amountHighlight)">{{ formatMoney(item.tradedChange) }}</td>
                  <td>{{ item.tradedAttr }}</td>
                  <td :class="highlightClass(item.holdHighlight)">{{ formatMoney(item.hold) }}</td>
                  <td>{{ item.payout.toFixed(0) }}</td>
                  <td>{{ (item.per * 100).toFixed(0) }}%</td>
                  <td>{{ item.weight.toFixed(0) }}</td>
                  <td><span :class="['pmark-badge', pmarkClass(item.pMark)]">{{ item.pMark }}</span></td>
                  <td :style="colorGroupStyle(item)">{{ formatTime(item.refreshTime) }}</td>
                </tr>
                <tr v-if="expandedBigPcId === item.pcId + 100000" class="expand-row">
                  <td colspan="10">
                    <div class="expand-content">
                      <div class="detail-panel">
                        <div class="panel-title">当前记录 RawData</div>
                        <table v-if="getBigRawDataRows(item).length > 0" class="detail-table">
                          <thead><tr><th>价位</th><th>买(Back)</th><th>卖(Lay)</th><th>成交(Traded)</th></tr></thead>
                          <tbody>
                            <tr v-for="pr in getBigRawDataRows(item)" :key="'hpr-' + pr.price">
                              <td :class="priceBgClass(pr)">{{ pr.price }}</td>
                              <td :class="{ 'bg-back': pr.toBack > 0 }">{{ pr.toBack > 0 ? formatMoney(pr.toBack) : '' }}</td>
                              <td :class="{ 'bg-lay': pr.toLay > 0 }">{{ pr.toLay > 0 ? formatMoney(pr.toLay) : '' }}</td>
                              <td :class="tradedClass(pr)">{{ pr.traded > 0 ? formatMoney(pr.traded) : '' }}</td>
                            </tr>
                          </tbody>
                        </table>
                        <div v-else class="panel-empty">无 RawData</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ═══ B20/B21: 净赔付表 ═══ -->
      <div v-if="netPayouts.length > 0 && activeTab === 0" class="net-payout-section">
        <h4 class="section-title">净赔付（当前）</h4>
        <table class="net-table">
          <thead><tr><th>场景</th><th>赔付</th><th>收益</th><th>净赔付</th><th>盈亏</th></tr></thead>
          <tbody>
            <tr v-for="np in netPayouts" :key="np.title" :class="{ 'net-negative': np.net < 0 }">
              <td class="net-title">{{ np.title }}</td>
              <td>{{ formatMoney(np.payout) }}</td>
              <td>{{ formatMoney(np.win) }}</td>
              <td :class="{ 'text-neg': np.net < 0, 'text-pos': np.net > 0 }">{{ formatMoney(np.net) }}</td>
              <td :class="{ 'text-neg': np.netPayout < 0, 'text-pos': np.netPayout > 0 }">{{ formatNetPayout(np.netPayout) }}</td>
            </tr>
          </tbody>
        </table>
        <template v-if="netPayouts15.length > 0">
          <h4 class="section-title section-title-sub">净赔付（-15分钟）</h4>
          <table class="net-table">
            <thead><tr><th>场景</th><th>赔付</th><th>收益</th><th>净赔付</th><th>盈亏</th></tr></thead>
            <tbody>
              <tr v-for="np in netPayouts15" :key="'n15-' + np.title" :class="{ 'net-negative': np.net < 0 }">
                <td class="net-title">{{ np.title }}</td>
                <td>{{ formatMoney(np.payout) }}</td>
                <td>{{ formatMoney(np.win) }}</td>
                <td :class="{ 'text-neg': np.net < 0, 'text-pos': np.net > 0 }">{{ formatMoney(np.net) }}</td>
                <td :class="{ 'text-neg': np.netPayout < 0, 'text-pos': np.netPayout > 0 }">{{ formatNetPayout(np.netPayout) }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>

      <!-- ═══ 成交汇总 ═══ -->
      <div v-if="volumeSummary.length > 0" class="volume-summary">
        <h4 class="section-title">成交汇总</h4>
        <table class="summary-table">
          <thead><tr><th>时间</th><th>主队 (Home)</th><th>客队 (Away)</th><th>合计</th></tr></thead>
          <tbody>
            <tr v-for="vs in volumeSummary" :key="vs.timing">
              <td>{{ vs.timing }}</td>
              <td>{{ formatMoney(vs.homeAmount) }}</td>
              <td>{{ formatMoney(vs.awayAmount) }}</td>
              <td>{{ formatMoney(vs.homeAmount + vs.awayAmount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.asian-page { max-width: 1440px; margin: 0 auto; padding: 16px; font-size: 0.9rem; background: #fff; }

/* ── 页头 ── */
.match-header { margin-bottom: 12px; }
.back-link { color: #2563eb; text-decoration: none; font-size: 0.9rem; }
.back-link:hover { text-decoration: underline; }
.match-title { margin: 6px 0 2px; font-size: 1.15rem; }
.team-home { color: #c00; font-weight: 600; }
.team-vs { margin: 0 8px; color: #666; font-weight: 400; }
.team-away { color: #00c; font-weight: 600; }
.match-meta { color: #666; font-size: 0.88rem; }
.best-price-home { color: #c00; }
.best-price-away { color: #00c; }

/* B1: Odds0 */
.odds0-bar { margin-top: 4px; padding: 5px 10px; background: #fefce8; border: 1px solid #fef08a; border-radius: 4px; font-size: 0.88rem; color: #713f12; font-weight: 500; }

/* ── 排序栏 ── */
.sort-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.sort-label { color: #666; font-size: 0.88rem; }
.sort-btn { padding: 3px 10px; border: 1px solid #ccc; border-radius: 4px; background: #fff; cursor: pointer; font-size: 0.88rem; }
.sort-btn:hover { background: #f0f0f0; }
.sort-btn.active { background: #2563eb; color: #fff; border-color: #2563eb; }
.refresh-btn { margin-left: auto; padding: 3px 14px; border: 1px solid #10b981; border-radius: 4px; background: #fff; color: #10b981; font-size: 0.88rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease; }
.refresh-btn:hover:not(:disabled) { background: #10b981; color: #fff; }
.refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.refresh-btn .spin { display: inline-block; animation: spin 0.8s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ── Tab 栏 ── */
.tab-bar { display: inline-flex; gap: 0; margin-bottom: 10px; background: #f1f3f5; border-radius: 8px; padding: 3px; overflow-x: auto; }
.tab-btn { padding: 5px 16px; border: none; background: transparent; cursor: pointer; font-size: 0.88rem; color: #666; border-radius: 6px; white-space: nowrap; transition: all 0.15s ease; font-weight: 500; }
.tab-btn:hover { color: #333; background: rgba(0, 0, 0, 0.04); }
.tab-btn.active { color: #fff; background: #3b82f6; font-weight: 600; box-shadow: 0 1px 3px rgba(59, 130, 246, 0.3); }

/* ── ViewSubTitle ── */
.view-subtitle { margin-bottom: 8px; padding: 6px 10px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; font-size: 0.88rem; color: #166534; }

/* ── Home / Away 分区头 ── */
.side-header { display: flex; align-items: baseline; gap: 16px; padding: 8px 10px; margin-top: 12px; border-radius: 4px 4px 0 0; font-size: 0.9rem; flex-wrap: wrap; }
.side-home { background: #fef2f2; border-left: 4px solid #c00; }
.side-away { background: #eff6ff; border-left: 4px solid #00c; }
.side-label { font-weight: 700; }
.side-home .side-label { color: #c00; }
.side-away .side-label { color: #00c; }
.side-total { color: #555; font-size: 0.88rem; }
.side-total b { color: #222; font-weight: 600; }

/* ── 主表 ── */
.table-wrapper { overflow-x: auto; }
.hc-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; background: #fff; }
.hc-table th { background: #f5f5f5; padding: 5px 6px; text-align: center; font-weight: 600; border-bottom: 2px solid #d1d5db; white-space: nowrap; font-size: 0.85rem; }
.hc-table td { padding: 4px 6px; text-align: center; border-bottom: 1px solid #e5e7eb; font-variant-numeric: tabular-nums; }
.hc-table tbody .data-row:hover { background: #f5f8ff; }
.col-hc { width: 90px; } .col-price { width: 70px; } .col-dense { width: 60px; } .col-dp { width: 55px; }
.col-maxbet { width: 75px; } .col-mbp { width: 70px; } .col-attr { width: 55px; } .col-tm { width: 60px; }
.col-tb { width: 75px; } .col-mh { width: 70px; } .col-th { width: 70px; } .col-mt { width: 60px; } .col-rank { width: 45px; }
.col-hc-val { cursor: pointer; user-select: none; font-weight: 600; font-size: 0.88rem; text-align: left !important; padding-left: 10px !important; }
.col-hc-val:hover { text-decoration: underline; }
.col-attr-val { font-size: 0.82rem; max-width: 60px; overflow: hidden; text-overflow: ellipsis; }

/* ── Band 分区头行 ── */
.band-header td { background: #f1f3f5; font-weight: 600; font-size: 0.85rem; color: #555; text-align: left !important; padding: 4px 10px !important; border-bottom: 1px solid #d1d5db; }

/* ── 小计行 ── */
.subtotal-row td { background: #fafbfc; border-bottom: 2px solid #d1d5db; font-weight: 600; font-size: 0.85rem; }
.subtotal-label { text-align: right !important; color: #555; padding-right: 10px !important; }
.subtotal-val { color: #333; }

/* ── 高亮 ── */
.td-highlight { background: #ffff00 !important; font-weight: 700; }
.td-lowlight { background: #FFFFA8 !important; }
.text-red-bold { color: #c00; font-weight: 700; }
.text-neg { color: #c00; }
.text-pos { color: #059669; }

/* B22: MaxHold Rank 4 级红色渐变 */
.mh-red1 { background: #8C0000 !important; color: #fff !important; font-weight: 700; }
.mh-red2 { background: #DF0000 !important; color: #fff !important; font-weight: 700; }
.mh-red3 { background: #FF5353 !important; color: #fff !important; font-weight: 700; }
.mh-red4 { background: #FF9F9F !important; color: #fff !important; font-weight: 700; }

.effective-route { background: #fffbeb !important; }
.effective-route:hover { background: #fef3c7 !important; }
.row-large-order { background: #fef2f2 !important; }
.row-large-order:hover { background: #fee2e2 !important; }
.row-expanded { border-bottom: 2px solid #2563eb !important; }
.row-expanded td { border-bottom: 2px solid #2563eb !important; }

/* ── PMark 标签 ── */
.pmark-badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 0.82rem; font-weight: 600; }
.pmark-ps { background: #fef3c7; color: #92400e; }
.pmark-pp { background: #fde68a; color: #78350f; }
.pmark-p { background: #fee2e2; color: #991b1b; }
.pmark-p0 { background: #fce7f3; color: #9d174d; }
.pmark-p1 { background: #ede9fe; color: #5b21b6; }
.pmark-p2 { background: #dbeafe; color: #1e40af; }
.pmark-p3 { background: #ccfbf1; color: #0f766e; }
.pmark-p6 { background: #d1fae5; color: #065f46; }
.pmark-p12 { background: #f3f4f6; color: #6b7280; }
.pmark-p24 { background: #e5e7eb; color: #4b5563; }
.pmark-p48 { background: #d1d5db; color: #374151; }

/* ── 展开行 ── */
.expand-row > td { padding: 0 !important; border-bottom: 1px solid #d1d5db; background: #fafcff; }
.expand-content { padding: 8px 16px; animation: slideDown 0.2s ease; }
@keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 600px; } }
.detail-panel { max-width: 420px; }
.panel-title { font-weight: 600; font-size: 0.88rem; color: #444; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid #e5e7eb; }
.detail-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.85rem; }
.detail-table th { background: #eef0f2; padding: 3px 10px; text-align: center; font-weight: 600; font-size: 0.82rem; border-bottom: 1px solid #d1d5db; }
.detail-table td { padding: 2px 10px; text-align: right; border-bottom: 1px solid #eee; font-variant-numeric: tabular-nums; }
.detail-table td:first-child { text-align: center; font-weight: 500; }
.bg-back { background: #A6D8FF !important; }
.bg-lay { background: #FAC9D1 !important; }
.text-traded-2x { color: #e67e22; font-weight: 700; }
.text-traded-3x { color: #8e44ad; font-weight: 700; }
.panel-empty { text-align: center; color: #999; padding: 12px 0; font-size: 0.85rem; }

/* B9: 占比行 */
.ratio-bar { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 8px; padding: 6px 10px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 4px; font-size: 0.88rem; color: #0c4a6e; }
.ratio-bar b { color: #0369a1; font-weight: 600; }
.ratio-sep { color: #93c5fd; }

/* ── 统计量栏 ── */
.stats-bar { margin-top: 8px; padding: 6px 10px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 4px; }
.stats-row { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: baseline; }
.stats-chip { font-size: 0.85rem; color: #555; white-space: nowrap; }
.stats-chip b { color: #222; font-weight: 600; margin-left: 1px; font-variant-numeric: tabular-nums; }

/* ── B3/B4/B5: 大注/Hold 表 ── */
.big-section { margin-top: 16px; }
.big-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; background: #fff; }
.big-table th { background: #f5f5f5; padding: 5px 8px; text-align: center; font-weight: 600; border-bottom: 2px solid #d1d5db; white-space: nowrap; font-size: 0.85rem; }
.big-table td { padding: 4px 8px; text-align: center; border-bottom: 1px solid #e5e7eb; font-variant-numeric: tabular-nums; }
.big-table .data-row:hover { background: #f5f8ff; }
.big-row { cursor: pointer; }
.big-table.compact { font-size: 0.85rem; }
.big-table.compact td { padding: 3px 6px; }

/* ── 净赔付表 ── */
.net-payout-section { margin-top: 16px; }
.section-title { font-size: 0.95rem; font-weight: 600; color: #333; margin: 0 0 6px; }
.section-title-sub { margin-top: 12px; }
.net-table { width: 100%; max-width: 600px; border-collapse: collapse; font-size: 0.88rem; margin-bottom: 4px; }
.net-table th { background: #eef0f2; padding: 4px 10px; text-align: center; font-weight: 600; border-bottom: 1px solid #d1d5db; }
.net-table td { padding: 4px 10px; text-align: center; border-bottom: 1px solid #eee; font-variant-numeric: tabular-nums; }
.net-title { text-align: left !important; font-weight: 500; }
.net-negative td { background: #fef2f2; }

/* ── 成交汇总表 ── */
.volume-summary { margin-top: 16px; padding: 8px; background: #f8fafc; border-radius: 4px; border: 1px solid #e5e7eb; }
.summary-table { width: 100%; max-width: 500px; border-collapse: collapse; font-size: 0.88rem; }
.summary-table th { background: #eef0f2; padding: 4px 10px; text-align: center; font-weight: 600; border-bottom: 1px solid #d1d5db; }
.summary-table td { padding: 4px 10px; text-align: center; border-bottom: 1px solid #eee; font-variant-numeric: tabular-nums; }

.no-data { text-align: center; color: #999; padding: 24px; }
.loading, .error-msg { text-align: center; padding: 48px 0; color: #666; }
</style>
