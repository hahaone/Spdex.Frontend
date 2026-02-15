<script setup lang="ts">
import type { BigHoldItemView, PriceSizeRow, TimeWindowData } from '~/types/bighold'
import { parseRawData } from '~/utils/parseRawData'
import { formatMoney, formatDateTime, formatMatchTime } from '~/utils/formatters'
import { holdClass, amountClass, pmarkClass, priceBgClass, tradedClass } from '~/utils/styleHelpers'
import { isBigHighlighted, bigTimeColorStyle } from '~/utils/detailHelpers'

// ── 路由参数 ──
const route = useRoute()
const eventId = computed(() => Number(route.query.id) || 0)
const orderParam = ref(0)

// ── 数据获取 ──
const queryParams = computed(() => ({
  id: eventId.value,
  order: orderParam.value,
}))
const { data, pending, error, refreshing, manualRefresh } = useBigHold(queryParams)

const result = computed(() => data.value?.data)
const matchInfo = computed(() => result.value?.match)
const windows = computed(() => result.value?.windows ?? [])

// ── 跨表共振：额外请求亚盘数据，提取 RefreshTime 集合 ──
const asianQueryParams = computed(() => ({ id: eventId.value, order: 0 }))
const { data: asianData } = useAsianBigHold(asianQueryParams)

/** 亚盘所有大注/持仓记录的 RefreshTime 集合（精确到秒） */
const asianTimeSet = computed<Set<string>>(() => {
  const set = new Set<string>()
  const asian = asianData.value?.data
  if (!asian) return set
  // bigList + holdList（当前窗口 TOP10）
  for (const item of asian.bigList ?? [])
    set.add(item.refreshTime.substring(0, 19))
  for (const item of asian.holdList ?? [])
    set.add(item.refreshTime.substring(0, 19))
  // 各时间窗口的 windowBigLists
  for (const wbl of asian.windowBigLists ?? [])
    for (const item of wbl.items)
      set.add(item.refreshTime.substring(0, 19))
  return set
})

/** 判断标盘记录是否与亚盘共振（同一秒有大注） */
function isResonant(item: BigHoldItemView): boolean {
  if (asianTimeSet.value.size === 0) return false
  return asianTimeSet.value.has(item.refreshTime.substring(0, 19))
}

useHead({
  title: computed(() => matchInfo.value
    ? `标盘 ${matchInfo.value.homeTeam}vs${matchInfo.value.guestTeam}`
    : '标盘'),
})

// ── Tab 切换（纯前端，不重新请求） ──
const activeTab = ref(0)
const activeWindow = computed<TimeWindowData | null>(() => windows.value[activeTab.value] ?? null)

// ── 行展开 & 前一条记录（使用共享 composable） ──
const {
  expandedPcId, expandedOddsPcId,
  loadingPcId, failedPcIds, prevCache,
  toggleExpand, toggleOddsExpand, retryFetchPrevious, prefetchAllPrevious,
  collapseAll, resetAll,
  getCurrentRows, getPreviousRows, getDiffRows,
} = useDetailExpand()

// 切换 Tab 时收起所有展开行
watch(activeTab, () => collapseAll())

// 数据就绪后自动预取前一条记录，以便深度高亮立即呈现
watch(activeWindow, (win) => {
  if (win?.items?.length) {
    prefetchAllPrevious(win.items)
  }
}, { immediate: true })

// ── 排序 ──
function setOrder(newOrder: number) {
  orderParam.value = newOrder
  resetAll()
}

/** 获取匹配 selectionId 的 LastPrice 数据 */
function getLastPriceRows(selectionId: number): PriceSizeRow[] {
  if (!activeWindow.value?.lastPrices) return []
  const lp = activeWindow.value.lastPrices.find(p => p.selectionId === selectionId)
  if (!lp?.rawData) return []
  return parseRawData(lp.rawData)
}

/** 检查 LastPrice 是否有大额挂单（500/1000 价位 ≥ 200） */
function hasLargeOrder(selectionId: number): boolean {
  if (!activeWindow.value?.lastPrices) return false
  const lp = activeWindow.value.lastPrices.find(p => p.selectionId === selectionId)
  return lp?.hasLargeOrderAt500Or1000 ?? false
}

/**
 * V2.0: 分时环比高亮规则
 * <130% AND 分时成交量>40K → 红色加粗
 * >500% AND 分时成交量>40K → 蓝色加粗
 * 其余灰色
 */
function pctColorStyle(val: number | null | undefined, totalAmount?: number): string {
  if (val == null) return ''
  const hasVolume = (totalAmount ?? 0) > 40000
  if (val < 130 && hasVolume) return 'color:#c00;font-weight:bold'
  if (val > 500 && hasVolume) return 'color:#00c;font-weight:bold'
  return 'color:#888'
}

/** V2.0: 新增比例列 — 各结果在分时成交量中的占比 */
function windowRatioDisplay(w: TimeWindowData): string {
  if (!w.odds) return '-'
  const total = w.odds.totalAmount
  if (total <= 0) return '-'
  const hp = (w.odds.homeAmount / total * 100).toFixed(0)
  const dp = (w.odds.drawAmount / total * 100).toFixed(0)
  const ap = (w.odds.awayAmount / total * 100).toFixed(0)
  return `${hp}% | ${dp}% | ${ap}%`
}
</script>

<template>
  <div class="detail-page">
    <!-- 加载/错误状态 -->
    <div v-if="pending" class="loading">加载中...</div>
    <div v-else-if="error || !result" class="error-msg">
      {{ error ? '数据加载失败' : '赛事不存在' }}
      <NuxtLink to="/" class="back-link">&larr; 返回首页</NuxtLink>
    </div>

    <template v-else>
      <!-- 页头：赛事信息 -->
      <div class="match-header">
        <NuxtLink to="/" class="back-link">&larr; 返回列表</NuxtLink>
        <h2 class="match-title">
          <span class="team-home">{{ matchInfo?.homeTeam }}</span>
          <span class="team-vs">vs</span>
          <span class="team-away">{{ matchInfo?.guestTeam }}</span>
        </h2>
        <div class="match-meta">
          开赛时间：{{ formatMatchTime(matchInfo?.matchTime ?? '') }}
          &nbsp;|&nbsp; MarketId1: {{ matchInfo?.marketId1 }}
        </div>
        <!-- 提炼表入口链接 -->
        <div class="filter-links">
          <span class="filter-links-label">&gt;&gt;</span>
          <NuxtLink :to="{ path: '/cs3/filter1', query: { id: eventId } }" target="_blank" class="filter-link filter-link-1">[标盘提炼表]</NuxtLink>
          <NuxtLink :to="{ path: '/cs3/filter2', query: { id: eventId } }" target="_blank" class="filter-link filter-link-2">[指数提炼表]</NuxtLink>
          <NuxtLink :to="{ path: '/cs3/filter3', query: { id: eventId } }" target="_blank" class="filter-link filter-link-3">[挂牌指数提炼表]</NuxtLink>
        </div>
      </div>

      <!-- ★ 所有分时统计摘要行 -->
      <div v-if="windows.length > 0" class="summary-panel">
        <div class="summary-title">分时统计摘要</div>
        <table class="summary-table">
          <thead>
            <tr>
              <th class="st-label">窗口</th>
              <th class="st-amount">成交量</th>
              <th class="st-weight">必指</th>
              <th class="st-pct-detail">比例</th>
              <th class="st-payout">盈亏</th>
              <th class="st-pct">分时环比</th>
              <th class="st-pct-detail">环比主平客</th>
              <th class="st-uk">Time</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(w, idx) in windows"
              :key="'sum-' + idx"
              class="summary-row"
              :class="{ 'summary-active': activeTab === idx }"
              @click="activeTab = idx"
            >
              <td class="st-label">{{ w.label }}</td>
              <td class="st-amount">{{ w.odds ? formatMoney(w.odds.totalAmount) : '-' }}</td>
              <td class="st-weight">
                <template v-if="w.odds">{{ w.odds.homeWeight.toFixed(0) }} | {{ w.odds.drawWeight.toFixed(0) }} | {{ w.odds.awayWeight.toFixed(0) }}</template>
                <template v-else>-</template>
              </td>
              <td class="st-pct-detail">{{ windowRatioDisplay(w) }}</td>
              <td class="st-payout">
                <template v-if="w.odds">{{ w.odds.homePayout.toFixed(0) }} | {{ w.odds.drawPayout.toFixed(0) }} | {{ w.odds.awayPayout.toFixed(0) }}</template>
                <template v-else>-</template>
              </td>
              <td class="st-pct" :style="pctColorStyle(w.amountPercent, w.odds?.totalAmount)">
                <template v-if="w.amountPercent != null">{{ w.amountPercent.toFixed(2) }}%</template>
                <template v-else>-</template>
              </td>
              <td class="st-pct-detail">
                <template v-if="w.homeAmountPercent != null || w.drawAmountPercent != null || w.awayAmountPercent != null">{{ w.homeAmountPercent != null ? w.homeAmountPercent.toFixed(0) + '%' : '-' }} | {{ w.drawAmountPercent != null ? w.drawAmountPercent.toFixed(0) + '%' : '-' }} | {{ w.awayAmountPercent != null ? w.awayAmountPercent.toFixed(0) + '%' : '-' }}</template>
                <template v-else>-</template>
              </td>
              <td class="st-uk">{{ w.ukTime ?? '-' }}</td>
            </tr>
          </tbody>
        </table>
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
        <button
          :class="['sort-btn', { active: orderParam === 0 }]"
          @click="setOrder(0)"
        >Hold &darr;</button>
        <button
          :class="['sort-btn', { active: orderParam === 1 }]"
          @click="setOrder(1)"
        >时间 &darr;</button>
        <button
          :class="['sort-btn', { active: orderParam === 2 }]"
          @click="setOrder(2)"
        >序号 &uarr;</button>

        <button
          class="refresh-btn"
          :disabled="refreshing"
          @click="manualRefresh"
        >
          <span :class="{ 'spin': refreshing }">↻</span>
          {{ refreshing ? '刷新中...' : '刷新数据' }}
        </button>
      </div>

      <!-- 当前 Tab 内容 -->
      <div v-if="activeWindow" class="window-content">
        <!-- 赔率摘要 + 密集指标 -->
        <div v-if="activeWindow.odds" class="info-bar">
          <!-- 第一行：赔率/成交量/必指/盈亏/冷热/分项 横向卡片 -->
          <div class="info-row">
            <span class="info-chip">
              成交量 <b>{{ formatMoney(activeWindow.odds.totalAmount) }}</b>
            </span>
            <span class="info-chip">
              赔率 <b>{{ activeWindow.odds.homeOdds }}-{{ activeWindow.odds.drawOdds }}-{{ activeWindow.odds.awayOdds }}</b>
            </span>
            <span class="info-chip">
              必指 <b>{{ activeWindow.odds.homeWeight.toFixed(0) }}-{{ activeWindow.odds.drawWeight.toFixed(0) }}-{{ activeWindow.odds.awayWeight.toFixed(0) }}</b>
            </span>
            <span class="info-chip">
              盈亏
              <b :class="{ 'text-neg': activeWindow.odds.homePayout < 0 }">{{ activeWindow.odds.homePayout.toFixed(0) }}</b>-<b
                :class="{ 'text-neg': activeWindow.odds.drawPayout < 0 }">{{ activeWindow.odds.drawPayout.toFixed(0) }}</b>-<b
                :class="{ 'text-neg': activeWindow.odds.awayPayout < 0 }">{{ activeWindow.odds.awayPayout.toFixed(0) }}</b>
            </span>
            <span class="info-chip">
              冷热
              <b :class="{ 'text-neg': activeWindow.odds.homeHotTrend < 0 }">{{ activeWindow.odds.homeHotTrend.toFixed(2) }}</b>-<b
                :class="{ 'text-neg': activeWindow.odds.drawHotTrend < 0 }">{{ activeWindow.odds.drawHotTrend.toFixed(2) }}</b>-<b
                :class="{ 'text-neg': activeWindow.odds.awayHotTrend < 0 }">{{ activeWindow.odds.awayHotTrend.toFixed(2) }}</b>
            </span>
            <span class="info-chip">
              分项 <b>主 {{ formatMoney(activeWindow.odds.homeAmount) }}-平{{ formatMoney(activeWindow.odds.drawAmount) }}-客{{ formatMoney(activeWindow.odds.awayAmount) }}</b>
            </span>
          </div>
          <!-- 第二行：密集指标（移除密集指数和密集交易量） -->
          <div v-if="activeWindow.csExtra" class="info-row">
            <span class="info-chip dense">密集价位 <b>{{ activeWindow.csExtra.densePrice }}</b></span>
            <span class="info-chip dense">密集比例 <b>{{ activeWindow.csExtra.denseRatio }}</b></span>
            <span class="info-chip dense">内比 <b>{{ activeWindow.csExtra.innerRatio }}</b></span>
            <span class="info-chip dense">外比 <b>{{ activeWindow.csExtra.outerRatio }}</b></span>
          </div>
        </div>

        <!-- BigHold 主表 -->
        <div class="table-wrapper">
          <table class="bighold-table">
            <thead>
              <tr>
                <th class="col-idx">#</th>
                <th class="col-sel clickable-header">1x2</th>
                <th class="col-odds clickable-header">价位</th>
                <th class="col-amount">成交量</th>
                <th class="col-attr">属性</th>
                <th class="col-hold">Hold</th>
                <th class="col-payout">盈亏</th>
                <th class="col-per">占比</th>
                <th class="col-pertotal">总占比</th>
                <th class="col-weight">必指</th>
                <th class="col-hot">冷热</th>
                <th class="col-pmark">P标</th>
                <th class="col-time">更新时间</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(item, idx) in activeWindow.items" :key="item.pcId">
                <!-- 主行 -->
                <tr
                  :class="['main-row', { 'row-expanded': expandedPcId === item.pcId || expandedOddsPcId === item.pcId, 'row-resonant': isResonant(item) }]"
                >
                  <td>{{ idx + 1 }}</td>
                  <td
                    :class="['sel-cell', 'sel-' + item.selection, { 'sel-large-order': hasLargeOrder(item.selectionId), 'sel-depth-highlight': prevCache.has(item.pcId) && isBigHighlighted(item.rawData, prevCache.get(item.pcId)?.rawData) }]"
                    title="点击展开 Back/Lay/Traded 明细"
                    @click="toggleExpand(item)"
                  >{{ item.selection }}</td>
                  <td
                    class="odds-cell"
                    title="点击展开 LastPrice 挂牌"
                    @click="toggleOddsExpand(item)"
                  >{{ item.lastOdds }}</td>
                  <td :class="amountClass(item)">{{ formatMoney(item.tradedChange) }}</td>
                  <td class="col-attr-val">{{ item.tradedAttr }}</td>
                  <td :class="holdClass(item)">{{ formatMoney(item.hold) }}</td>
                  <td>{{ item.payout.toFixed(0) }}</td>
                  <td>{{ item.per.toFixed(1) }}%</td>
                  <td>{{ (item.perTotal * 100).toFixed(0) }}%</td>
                  <td>{{ item.weight.toFixed(0) }}</td>
                  <td :class="{ 'text-neg': item.hotTrend < 0 }">{{ item.hotTrend.toFixed(2) }}</td>
                  <td><span :class="['pmark-badge', pmarkClass(item.pMark)]">{{ item.pMark }}</span></td>
                  <td class="col-time-val" :style="bigTimeColorStyle(item.colorGroup)">{{ formatDateTime(item.refreshTime) }}</td>
                </tr>

                <!-- 展开行：Back/Lay/Traded 层（当前 + 前一条 + 差额） -->
                <tr v-if="expandedPcId === item.pcId" class="expand-row">
                  <td colspan="13">
                    <div class="expand-content">
                      <div class="detail-panels">
                        <!-- 当前记录 -->
                        <div class="detail-panel">
                          <div class="panel-title">当前记录</div>
                          <table v-if="getCurrentRows(item.pcId).length > 0" class="detail-table">
                            <thead>
                              <tr>
                                <th>价位</th>
                                <th>买</th>
                                <th>卖</th>
                                <th>成交</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="row in getCurrentRows(item.pcId)" :key="'c-' + row.price">
                                <td :class="priceBgClass(row)">{{ row.price }}</td>
                                <td :class="{ 'bg-back': row.toBack > 0 }">{{ row.toBack > 0 ? formatMoney(row.toBack) : '' }}</td>
                                <td :class="{ 'bg-lay': row.toLay > 0 }">{{ row.toLay > 0 ? formatMoney(row.toLay) : '' }}</td>
                                <td :class="tradedClass(row)">{{ row.traded > 0 ? formatMoney(row.traded) : '' }}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div v-else class="panel-empty">无明细数据</div>
                        </div>

                        <!-- 前一条记录 -->
                        <div class="detail-panel">
                          <div class="panel-title">前一条记录</div>
                          <!-- 加载中 -->
                          <div v-if="loadingPcId === item.pcId" class="panel-loading">
                            <span class="spinner"></span> 加载中...
                          </div>
                          <!-- 加载失败 -->
                          <div v-else-if="failedPcIds.has(item.pcId)" class="panel-error">
                            获取失败，<span class="retry-link" @click="retryFetchPrevious(item)">点击重试</span>
                          </div>
                          <!-- 无前一条记录 -->
                          <div v-else-if="prevCache.has(item.pcId) && !prevCache.get(item.pcId)" class="panel-empty">
                            无前一条记录
                          </div>
                          <!-- 有数据 -->
                          <table v-else-if="getPreviousRows(item.pcId).length > 0" class="detail-table">
                            <thead>
                              <tr>
                                <th>价位</th>
                                <th>买</th>
                                <th>卖</th>
                                <th>成交</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="row in getPreviousRows(item.pcId)" :key="'p-' + row.price">
                                <td :class="priceBgClass(row)">{{ row.price }}</td>
                                <td :class="{ 'bg-back': row.toBack > 0 }">{{ row.toBack > 0 ? formatMoney(row.toBack) : '' }}</td>
                                <td :class="{ 'bg-lay': row.toLay > 0 }">{{ row.toLay > 0 ? formatMoney(row.toLay) : '' }}</td>
                                <td :class="tradedClass(row)">{{ row.traded > 0 ? formatMoney(row.traded) : '' }}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div v-else class="panel-empty">等待数据...</div>
                        </div>

                        <!-- 成交差额 -->
                        <div class="detail-panel">
                          <div class="panel-title">成交差额</div>
                          <table v-if="getDiffRows(item.pcId).length > 0" class="detail-table diff-table">
                            <thead>
                              <tr>
                                <th>价位</th>
                                <th>差额</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="row in getDiffRows(item.pcId)" :key="'d-' + row.price">
                                <td>{{ row.price }}</td>
                                <td class="diff-val">+{{ formatMoney(row.traded) }}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div v-else class="panel-empty">
                            {{ getPreviousRows(item.pcId).length > 0 ? '无变化' : '等待前一条数据...' }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>

                <!-- 展开行：赔率层（LastPrice） -->
                <tr v-if="expandedOddsPcId === item.pcId" class="expand-row expand-row-odds">
                  <td colspan="13">
                    <div class="expand-content">
                      <div class="detail-panels">
                        <div class="detail-panel">
                          <div class="panel-title">LastPrice 挂牌数据 ({{ item.selection }})</div>
                          <table v-if="getLastPriceRows(item.selectionId).length > 0" class="detail-table">
                            <thead>
                              <tr>
                                <th>价位</th>
                                <th>买</th>
                                <th>卖</th>
                                <th>成交</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="row in getLastPriceRows(item.selectionId)" :key="'lp-' + row.price">
                                <td :class="priceBgClass(row)">{{ row.price }}</td>
                                <td :class="{ 'bg-back': row.toBack > 0 }">{{ row.toBack > 0 ? formatMoney(row.toBack) : '' }}</td>
                                <td :class="{ 'bg-lay': row.toLay > 0 }">{{ row.toLay > 0 ? formatMoney(row.toLay) : '' }}</td>
                                <td :class="tradedClass(row)">{{ row.traded > 0 ? formatMoney(row.traded) : '' }}</td>
                              </tr>
                            </tbody>
                          </table>
                          <div v-else class="panel-empty">无 LastPrice 数据</div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>

              <!-- 无数据提示 -->
              <tr v-if="activeWindow.items.length === 0">
                <td colspan="13" class="no-data">暂无数据</td>
              </tr>
            </tbody>
            <!-- 统计行 -->
            <tfoot v-if="activeWindow.items.length > 0">
              <tr class="stat-row">
                <td colspan="3" class="stat-label">&sigma; (标准差)</td>
                <td>{{ formatMoney(activeWindow.stdDevAmount) }}</td>
                <td></td>
                <td>{{ formatMoney(activeWindow.stdDevHold) }}</td>
                <td colspan="7"></td>
              </tr>
              <tr class="stat-row">
                <td colspan="3" class="stat-label">&mu; (平均)</td>
                <td>{{ formatMoney(activeWindow.avgAmount) }}</td>
                <td></td>
                <td>{{ formatMoney(activeWindow.avgHold) }}</td>
                <td colspan="7"></td>
              </tr>
              <tr class="stat-row stat-highlight">
                <td colspan="3" class="stat-label">&mu; + 2&sigma;</td>
                <td>{{ formatMoney(activeWindow.threshold2SigmaAmount) }}</td>
                <td></td>
                <td>{{ formatMoney(activeWindow.threshold2SigmaHold) }}</td>
                <td colspan="7"></td>
              </tr>
              <tr class="stat-row stat-highlight">
                <td colspan="3" class="stat-label">&mu; + 3&sigma;</td>
                <td>{{ formatMoney(activeWindow.threshold3SigmaAmount) }}</td>
                <td></td>
                <td>{{ formatMoney(activeWindow.threshold3SigmaHold) }}</td>
                <td colspan="7"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<style>
/* 引入共享详情页样式（非 scoped，因为共享 CSS 需要全局生效） */
@import '~/assets/css/detail-shared.css';
</style>

<style scoped>
/* ── cs3 页面特有样式（仅保留该页独有的） ── */

/* 1x2 Selection 颜色（中文类名） */
.sel-主 { color: #c00; }
.sel-平 { color: #666; }
.sel-客 { color: #00c; }

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
.summary-row {
  cursor: pointer;
  transition: background 0.12s;
}
.summary-row:hover {
  background: #fef9e7;
}
.summary-active {
  background: #fff3cd !important;
  font-weight: 600;
}
th.st-label, td.st-label { font-weight: 600; padding-left: 16px !important; text-align: left !important; white-space: nowrap; }
td.st-amount { font-variant-numeric: tabular-nums; text-align: right; }
td.st-weight, td.st-payout { white-space: nowrap; }
td.st-uk { font-family: 'SF Mono', 'Menlo', monospace; font-size: 12px; color: #555; white-space: nowrap; }
td.st-pct { font-weight: 600; color: #b22222; font-variant-numeric: tabular-nums; }
td.st-pct-detail { font-family: 'SF Mono', 'Menlo', monospace; font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }

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
.filter-link-1 { color: #b22222; }
.filter-link-2 { color: #2563eb; }
.filter-link-3 { color: #059669; }

/* ── 跨表共振高亮（标盘与亚盘同一时间均有大注时整行突出显示） ── */
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
