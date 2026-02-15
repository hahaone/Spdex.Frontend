<script setup lang="ts">
import type { AsianHcRow, AsianHcGroup, AsianTimeWindowData, AsianBigItem } from '~/types/asianbighold'
import type { PriceSizeRow, PreviousRecordResult } from '~/types/bighold'
import type { ApiResponse } from '~/types/api'
import { parseRawData, calcTradedDiff } from '~/utils/parseRawData'
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

// ── 跨表共振：额外请求标盘数据，提取 RefreshTime 集合 ──
const bfQueryParams = computed(() => ({ id: eventId.value, order: 0 }))
const { data: bfData } = useBigHold(bfQueryParams)

/** 标盘所有大注记录的 RefreshTime 集合（精确到秒） */
const bfTimeSet = computed<Set<string>>(() => {
  const set = new Set<string>()
  const bf = bfData.value?.data
  if (!bf) return set
  // 所有时间窗口的 items
  for (const win of bf.windows ?? [])
    for (const item of win.items)
      set.add(item.refreshTime.substring(0, 19))
  return set
})

/** 判断亚盘记录是否与标盘共振（同一秒有大注） */
function isResonant(item: AsianBigItem): boolean {
  if (bfTimeSet.value.size === 0) return false
  return bfTimeSet.value.has(item.refreshTime.substring(0, 19))
}

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

// ── 大注展开：前一条记录懒加载 + RawData 解析缓存 ──
const { fetchPrevious: fetchBigPrevious, clearCache: clearBigPrevCache, loadingPcId: bigLoadingPcId, failedPcIds: bigFailedPcIds, cache: bigPrevCache } = useBigHoldDetail('/api/asianbighold/previous')

/** 大注当前记录 RawData 解析缓存 */
const bigCurrentParsedCache = reactive(new Map<number, PriceSizeRow[]>())
/** 大注前一条记录 RawData 解析缓存 */
const bigPreviousParsedCache = reactive(new Map<number, PriceSizeRow[]>())

/** 从展开 key 提取真实 pcId（去除 holdList/windowBigList 偏移） */
function realPcId(expandKey: number): number {
  if (expandKey >= 200000) return expandKey - 200000
  if (expandKey >= 100000) return expandKey - 100000
  return expandKey
}

async function toggleBigExpand(expandKey: number) {
  if (expandedBigPcId.value === expandKey) {
    expandedBigPcId.value = null
    return
  }
  expandedBigPcId.value = expandKey

  const pcId = realPcId(expandKey)
  // 查找对应的 AsianBigItem
  const item = findBigItem(pcId)
  if (!item) return

  // 解析当前记录 RawData
  if (!bigCurrentParsedCache.has(pcId)) {
    bigCurrentParsedCache.set(pcId, item.rawData ? parseRawData(item.rawData) : [])
  }

  // 懒加载前一条记录
  if (!bigPrevCache.has(pcId)) {
    const prev = await fetchBigPrevious(pcId, item.marketId, item.selectionId, item.refreshTime, { handicap: String(item.handicap) })
    if (prev?.rawData) {
      bigPreviousParsedCache.set(pcId, parseRawData(prev.rawData))
    }
  }
}

/** 根据真实 pcId 在所有大注列表中查找 AsianBigItem */
function findBigItem(pcId: number): AsianBigItem | undefined {
  return bigList.value.find(b => b.pcId === pcId)
    ?? holdList.value.find(b => b.pcId === pcId)
    ?? windowBigLists.value.flatMap(wbl => wbl.items).find(b => b.pcId === pcId)
}

/** 获取大注当前记录解析数据 */
function getBigCurrentRows(pcId: number): PriceSizeRow[] {
  return bigCurrentParsedCache.get(pcId) ?? []
}

/** 获取大注前一条记录解析数据 */
function getBigPreviousRows(pcId: number): PriceSizeRow[] {
  return bigPreviousParsedCache.get(pcId) ?? []
}

/** 获取大注成交差额 */
function getBigDiffRows(pcId: number): PriceSizeRow[] {
  const current = getBigCurrentRows(pcId)
  const previous = getBigPreviousRows(pcId)
  if (current.length === 0 || previous.length === 0) return []
  return calcTradedDiff(current, previous)
}

/** 重试加载前一条记录 */
async function retryBigFetchPrevious(pcId: number) {
  const item = findBigItem(pcId)
  if (!item) return
  const prev = await fetchBigPrevious(pcId, item.marketId, item.selectionId, item.refreshTime, { handicap: String(item.handicap) })
  if (prev?.rawData) {
    bigPreviousParsedCache.set(pcId, parseRawData(prev.rawData))
  }
}

/**
 * 计算成交差额价位 > 4 的大单 pcId 集合（用于 Handicap 高亮）。
 * 需要先展开行或 prefetch 过前一条记录才能计算。
 */
const bigDiffHighlightSet = computed<Set<number>>(() => {
  const set = new Set<number>()
  // 遍历所有已缓存前一条记录的 pcId
  for (const [pcId] of bigPrevCache) {
    const diffRows = getBigDiffRows(pcId)
    if (diffRows.length > 3) {
      set.add(pcId)
    }
  }
  return set
})

/** 批量预取所有大注的前一条记录（用于计算差额高亮） */
async function prefetchAllBigPrevious() {
  const allItems: AsianBigItem[] = [
    ...bigList.value,
    ...holdList.value,
    ...windowBigLists.value.flatMap(wbl => wbl.items),
  ]
  // 去重
  const seen = new Set<number>()
  const unique = allItems.filter((item) => {
    if (seen.has(item.pcId)) return false
    seen.add(item.pcId)
    return true
  })

  const tasks = unique
    .filter(item => !bigPrevCache.has(item.pcId))
    .map(async (item) => {
      // 解析当前记录 RawData
      if (!bigCurrentParsedCache.has(item.pcId)) {
        bigCurrentParsedCache.set(item.pcId, item.rawData ? parseRawData(item.rawData) : [])
      }
      const prev = await fetchBigPrevious(item.pcId, item.marketId, item.selectionId, item.refreshTime, { handicap: String(item.handicap) })
      if (prev?.rawData) {
        bigPreviousParsedCache.set(item.pcId, parseRawData(prev.rawData))
      }
    })
  await Promise.allSettled(tasks)
}

// 当数据加载完成后自动预取所有大注的前一条记录
watch(() => result.value, (val) => {
  if (val) {
    nextTick(() => prefetchAllBigPrevious())
  }
}, { immediate: true })

/** Handicap 列大注差额高亮（成交差额 > 3 个价位） */
function bigDiffHandicapClass(item: AsianBigItem): string {
  return bigDiffHighlightSet.value.has(item.pcId) ? 'td-highlight' : ''
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

function hasLargeOrder(row: AsianHcRow): boolean {
  const lp = findLastPrice(row)
  return lp?.hasLargeOrderAt500Or1000 ?? false
}

// ── 排序 ──
function setOrder(newOrder: number) {
  orderParam.value = newOrder
  expandedKey.value = null
  expandedBigPcId.value = null
  clearBigPrevCache()
  bigCurrentParsedCache.clear()
  bigPreviousParsedCache.clear()
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

/** MaxHold 高亮：与旧版一致，仅使用 sigma-based 黄色高亮（TotalBetViewer 逻辑） */
function maxHoldRankClass(row: AsianHcRow): string {
  if (row.maxHoldHighlight === 2) return 'td-highlight'
  if (row.maxHoldHighlight === 1) return 'td-lowlight'
  return ''
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
        <!-- 提炼表入口链接 -->
        <div class="filter-links">
          <span class="filter-links-label">&gt;&gt;</span>
          <NuxtLink :to="{ path: '/cs5/filter1', query: { id: eventId } }" target="_blank" class="filter-link filter-link-asian">[亚盘提炼表]</NuxtLink>
        </div>
        <!-- B1: Odds0 信息 -->
        <div v-if="odds0" class="odds0-bar">
          对应标盘：({{ odds0.homeWeight.toFixed(0) }}-{{ odds0.drawWeight.toFixed(0) }}-{{ odds0.awayWeight.toFixed(0) }}__{{ formatMoney(odds0.totalAmount) }})
          (主:{{ odds0.homePayout.toFixed(0) }} 平:{{ odds0.drawPayout.toFixed(0) }} 客:{{ odds0.awayPayout.toFixed(0) }})
        </div>
      </div>

      <!-- Tab 栏 + 排序按钮 + 刷新（合并为一行） -->
      <div class="tab-bar">
        <button
          v-for="(w, idx) in windows"
          :key="idx"
          :class="['tab-btn', { active: activeTab === idx }]"
          @click="activeTab = idx"
        >{{ w.label }}</button>

        <span class="tab-bar-spacer" />

        <span class="sort-label">排序：</span>
        <button :class="['sort-btn', { active: orderParam === 0 }]" @click="setOrder(0)">Hold &darr;</button>
        <button :class="['sort-btn', { active: orderParam === 1 }]" @click="setOrder(1)">时间 &darr;</button>
        <button :class="['sort-btn', { active: orderParam === 2 }]" @click="setOrder(2)">序号 &uarr;</button>
        <button class="refresh-btn" :disabled="refreshing" @click="manualRefresh">
          <span :class="{ spin: refreshing }">↻</span>
          {{ refreshing ? '刷新中...' : '刷新数据' }}
        </button>
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
                    <td colspan="13">&nbsp;</td>
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
                  <tr v-if="group.rows.length > 0" class="band-header"><td colspan="13">&nbsp;</td></tr>
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
                <template v-for="item in activeWindowBigList.items" :key="'wbi-' + item.pcId">
                  <tr :class="['data-row', 'big-row', { 'row-resonant': isResonant(item) }]" @click="toggleBigExpand(item.pcId + 200000)">
                    <td :class="['col-hc-val', bigDiffHandicapClass(item)]">{{ item.selection }}</td>
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
                  <tr v-if="expandedBigPcId === item.pcId + 200000" class="expand-row">
                    <td colspan="10">
                      <div class="expand-content">
                        <div class="detail-panels">
                          <!-- 当前记录 -->
                          <div class="detail-panel">
                            <div class="panel-title">当前记录</div>
                            <table v-if="getBigCurrentRows(item.pcId).length > 0" class="detail-table">
                              <thead><tr><th>价位</th><th>买(Back)</th><th>卖(Lay)</th><th>成交(Traded)</th></tr></thead>
                              <tbody>
                                <tr v-for="pr in getBigCurrentRows(item.pcId)" :key="'wc-' + pr.price">
                                  <td :class="priceBgClass(pr)">{{ pr.price }}</td>
                                  <td :class="{ 'bg-back': pr.toBack > 0 }">{{ pr.toBack > 0 ? formatMoney(pr.toBack) : '' }}</td>
                                  <td :class="{ 'bg-lay': pr.toLay > 0 }">{{ pr.toLay > 0 ? formatMoney(pr.toLay) : '' }}</td>
                                  <td :class="tradedClass(pr)">{{ pr.traded > 0 ? formatMoney(pr.traded) : '' }}</td>
                                </tr>
                              </tbody>
                            </table>
                            <div v-else class="panel-empty">无明细数据</div>
                          </div>
                          <!-- 前一条记录 -->
                          <div class="detail-panel">
                            <div class="panel-title">前一条记录</div>
                            <div v-if="bigLoadingPcId === item.pcId" class="panel-loading"><span class="spinner"></span> 加载中...</div>
                            <div v-else-if="bigFailedPcIds.has(item.pcId)" class="panel-error">获取失败，<span class="retry-link" @click.stop="retryBigFetchPrevious(item.pcId)">点击重试</span></div>
                            <div v-else-if="bigPrevCache.has(item.pcId) && !bigPrevCache.get(item.pcId)" class="panel-empty">无前一条记录</div>
                            <table v-else-if="getBigPreviousRows(item.pcId).length > 0" class="detail-table">
                              <thead><tr><th>价位</th><th>买(Back)</th><th>卖(Lay)</th><th>成交(Traded)</th></tr></thead>
                              <tbody>
                                <tr v-for="pr in getBigPreviousRows(item.pcId)" :key="'wp-' + pr.price">
                                  <td :class="priceBgClass(pr)">{{ pr.price }}</td>
                                  <td :class="{ 'bg-back': pr.toBack > 0 }">{{ pr.toBack > 0 ? formatMoney(pr.toBack) : '' }}</td>
                                  <td :class="{ 'bg-lay': pr.toLay > 0 }">{{ pr.toLay > 0 ? formatMoney(pr.toLay) : '' }}</td>
                                  <td :class="tradedClass(pr)">{{ pr.traded > 0 ? formatMoney(pr.traded) : '' }}</td>
                                </tr>
                              </tbody>
                            </table>
                            <div v-else class="panel-empty">等待数据...</div>
                          </div>
                          <!-- 成交差额 -->
                          <div class="detail-panel">
                            <div class="panel-title">成交差额</div>
                            <table v-if="getBigDiffRows(item.pcId).length > 0" class="detail-table diff-table">
                              <thead><tr><th>价位</th><th>差额</th></tr></thead>
                              <tbody>
                                <tr v-for="pr in getBigDiffRows(item.pcId)" :key="'wd-' + pr.price">
                                  <td>{{ pr.price }}</td>
                                  <td class="diff-val">+{{ formatMoney(pr.traded) }}</td>
                                </tr>
                              </tbody>
                            </table>
                            <div v-else class="panel-empty">{{ getBigPreviousRows(item.pcId).length > 0 ? '无变化' : '等待前一条数据...' }}</div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
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
                <tr :class="['data-row', 'big-row', { 'row-resonant': isResonant(item) }]" @click="toggleBigExpand(item.pcId)">
                  <td :class="['col-hc-val', bigDiffHandicapClass(item)]">{{ item.selection }}</td>
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
                      <div class="detail-panels">
                        <!-- 当前记录 -->
                        <div class="detail-panel">
                          <div class="panel-title">当前记录</div>
                          <table v-if="getBigCurrentRows(item.pcId).length > 0" class="detail-table">
                            <thead><tr><th>价位</th><th>买(Back)</th><th>卖(Lay)</th><th>成交(Traded)</th></tr></thead>
                            <tbody>
                              <tr v-for="pr in getBigCurrentRows(item.pcId)" :key="'bc-' + pr.price">
                                <td :class="priceBgClass(pr)">{{ pr.price }}</td>
                                <td :class="{ 'bg-back': pr.toBack > 0 }">{{ pr.toBack > 0 ? formatMoney(pr.toBack) : '' }}</td>
                                <td :class="{ 'bg-lay': pr.toLay > 0 }">{{ pr.toLay > 0 ? formatMoney(pr.toLay) : '' }}</td>
                                <td :class="tradedClass(pr)">{{ pr.traded > 0 ? formatMoney(pr.traded) : '' }}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div v-else class="panel-empty">无明细数据</div>
                        </div>
                        <!-- 前一条记录 -->
                        <div class="detail-panel">
                          <div class="panel-title">前一条记录</div>
                          <div v-if="bigLoadingPcId === item.pcId" class="panel-loading"><span class="spinner"></span> 加载中...</div>
                          <div v-else-if="bigFailedPcIds.has(item.pcId)" class="panel-error">获取失败，<span class="retry-link" @click.stop="retryBigFetchPrevious(item.pcId)">点击重试</span></div>
                          <div v-else-if="bigPrevCache.has(item.pcId) && !bigPrevCache.get(item.pcId)" class="panel-empty">无前一条记录</div>
                          <table v-else-if="getBigPreviousRows(item.pcId).length > 0" class="detail-table">
                            <thead><tr><th>价位</th><th>买(Back)</th><th>卖(Lay)</th><th>成交(Traded)</th></tr></thead>
                            <tbody>
                              <tr v-for="pr in getBigPreviousRows(item.pcId)" :key="'bp-' + pr.price">
                                <td :class="priceBgClass(pr)">{{ pr.price }}</td>
                                <td :class="{ 'bg-back': pr.toBack > 0 }">{{ pr.toBack > 0 ? formatMoney(pr.toBack) : '' }}</td>
                                <td :class="{ 'bg-lay': pr.toLay > 0 }">{{ pr.toLay > 0 ? formatMoney(pr.toLay) : '' }}</td>
                                <td :class="tradedClass(pr)">{{ pr.traded > 0 ? formatMoney(pr.traded) : '' }}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div v-else class="panel-empty">等待数据...</div>
                        </div>
                        <!-- 成交差额 -->
                        <div class="detail-panel">
                          <div class="panel-title">成交差额</div>
                          <table v-if="getBigDiffRows(item.pcId).length > 0" class="detail-table diff-table">
                            <thead><tr><th>价位</th><th>差额</th></tr></thead>
                            <tbody>
                              <tr v-for="pr in getBigDiffRows(item.pcId)" :key="'bd-' + pr.price">
                                <td>{{ pr.price }}</td>
                                <td class="diff-val">+{{ formatMoney(pr.traded) }}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div v-else class="panel-empty">{{ getBigPreviousRows(item.pcId).length > 0 ? '无变化' : '等待前一条数据...' }}</div>
                        </div>
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
                <tr :class="['data-row', 'big-row', { 'row-resonant': isResonant(item) }]" @click="toggleBigExpand(item.pcId + 100000)">
                  <td :class="['col-hc-val', bigDiffHandicapClass(item)]">{{ item.selection }}</td>
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
                      <div class="detail-panels">
                        <!-- 当前记录 -->
                        <div class="detail-panel">
                          <div class="panel-title">当前记录</div>
                          <table v-if="getBigCurrentRows(item.pcId).length > 0" class="detail-table">
                            <thead><tr><th>价位</th><th>买(Back)</th><th>卖(Lay)</th><th>成交(Traded)</th></tr></thead>
                            <tbody>
                              <tr v-for="pr in getBigCurrentRows(item.pcId)" :key="'hc-' + pr.price">
                                <td :class="priceBgClass(pr)">{{ pr.price }}</td>
                                <td :class="{ 'bg-back': pr.toBack > 0 }">{{ pr.toBack > 0 ? formatMoney(pr.toBack) : '' }}</td>
                                <td :class="{ 'bg-lay': pr.toLay > 0 }">{{ pr.toLay > 0 ? formatMoney(pr.toLay) : '' }}</td>
                                <td :class="tradedClass(pr)">{{ pr.traded > 0 ? formatMoney(pr.traded) : '' }}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div v-else class="panel-empty">无明细数据</div>
                        </div>
                        <!-- 前一条记录 -->
                        <div class="detail-panel">
                          <div class="panel-title">前一条记录</div>
                          <div v-if="bigLoadingPcId === item.pcId" class="panel-loading"><span class="spinner"></span> 加载中...</div>
                          <div v-else-if="bigFailedPcIds.has(item.pcId)" class="panel-error">获取失败，<span class="retry-link" @click.stop="retryBigFetchPrevious(item.pcId)">点击重试</span></div>
                          <div v-else-if="bigPrevCache.has(item.pcId) && !bigPrevCache.get(item.pcId)" class="panel-empty">无前一条记录</div>
                          <table v-else-if="getBigPreviousRows(item.pcId).length > 0" class="detail-table">
                            <thead><tr><th>价位</th><th>买(Back)</th><th>卖(Lay)</th><th>成交(Traded)</th></tr></thead>
                            <tbody>
                              <tr v-for="pr in getBigPreviousRows(item.pcId)" :key="'hp-' + pr.price">
                                <td :class="priceBgClass(pr)">{{ pr.price }}</td>
                                <td :class="{ 'bg-back': pr.toBack > 0 }">{{ pr.toBack > 0 ? formatMoney(pr.toBack) : '' }}</td>
                                <td :class="{ 'bg-lay': pr.toLay > 0 }">{{ pr.toLay > 0 ? formatMoney(pr.toLay) : '' }}</td>
                                <td :class="tradedClass(pr)">{{ pr.traded > 0 ? formatMoney(pr.traded) : '' }}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div v-else class="panel-empty">等待数据...</div>
                        </div>
                        <!-- 成交差额 -->
                        <div class="detail-panel">
                          <div class="panel-title">成交差额</div>
                          <table v-if="getBigDiffRows(item.pcId).length > 0" class="detail-table diff-table">
                            <thead><tr><th>价位</th><th>差额</th></tr></thead>
                            <tbody>
                              <tr v-for="pr in getBigDiffRows(item.pcId)" :key="'hd-' + pr.price">
                                <td>{{ pr.price }}</td>
                                <td class="diff-val">+{{ formatMoney(pr.traded) }}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div v-else class="panel-empty">{{ getBigPreviousRows(item.pcId).length > 0 ? '无变化' : '等待前一条数据...' }}</div>
                        </div>
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
/* V2.0: Away区与Home最后一行增加间距 */
.side-header { display: flex; align-items: baseline; gap: 16px; padding: 8px 10px; margin-top: 24px; border-radius: 4px 4px 0 0; font-size: 0.9rem; flex-wrap: wrap; }
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
/* 灰色间隔栏（不显示文字） */
.band-header td { background: #f1f3f5; font-size: 0; line-height: 0; padding: 3px 0 !important; border-bottom: 1px solid #d1d5db; }

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
.panel-loading { text-align: center; color: #666; padding: 12px 0; font-size: 0.85rem; }
.panel-error { text-align: center; color: #dc2626; padding: 12px 0; font-size: 0.85rem; }
.retry-link { color: #2563eb; cursor: pointer; text-decoration: underline; }
.spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #ddd; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; vertical-align: middle; margin-right: 4px; }
.detail-panels { display: flex; gap: 16px; flex-wrap: wrap; }
.detail-panels .detail-panel { flex: 1; min-width: 200px; }
.diff-table td { text-align: center; }
.diff-val { color: #059669; font-weight: 600; }

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
/* V2.0: 大注TOP10与上方列表区域增加间距 */
.big-section { margin-top: 32px; }
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

/* ── 提炼表入口链接 ── */
.filter-links {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
}
.filter-links-label {
  color: #999;
  font-weight: 600;
}
.filter-link {
  text-decoration: none;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  transition: all 0.15s;
}
.filter-link:hover {
  text-decoration: underline;
}
.filter-link-asian { color: #7c3aed; }

/* ── 跨表共振高亮（亚盘与标盘同一时间均有大注时整行突出显示） ── */
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
