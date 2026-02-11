<script setup lang="ts">
import type { BigHoldItemView, PriceSizeRow, TimeWindowData } from '~/types/bighold'
import { calcTradedDiff, parseRawData } from '~/utils/parseRawData'
import { formatMoney, formatDateTime, formatMatchTime } from '~/utils/formatters'
import { holdClass, amountClass, pmarkClass, priceBgClass, tradedClass } from '~/utils/styleHelpers'

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

// ── Tab 切换（纯前端，不重新请求） ──
const activeTab = ref(0)
const activeWindow = computed<TimeWindowData | null>(() => windows.value[activeTab.value] ?? null)

// 切换 Tab 时收起所有展开行
watch(activeTab, () => {
  expandedPcId.value = null
  expandedOddsPcId.value = null
})

// ── 行展开状态 ──
const expandedPcId = ref<number | null>(null)         // 1x2 层展开的行
const expandedOddsPcId = ref<number | null>(null)     // 赔率层展开的行

// ── 行展开明细数据（单例 composable） ──
const { fetchPrevious, clearCache, loadingPcId, failedPcIds, cache: prevCache } = useBigHoldDetail()

// ── 排序 ──
function setOrder(newOrder: number) {
  orderParam.value = newOrder
  expandedPcId.value = null
  expandedOddsPcId.value = null
  clearCache()
}

/** 当前记录解析后的 PriceSizeRow[] 缓存 */
const currentParsedCache = reactive(new Map<number, PriceSizeRow[]>())
/** 前一条记录解析后的 PriceSizeRow[] 缓存 */
const previousParsedCache = reactive(new Map<number, PriceSizeRow[]>())

/** 切换 1x2 层展开/收起 */
async function toggleExpand(item: BigHoldItemView) {
  if (expandedPcId.value === item.pcId) {
    // 收起
    expandedPcId.value = null
    return
  }

  // 展开新行，自动收起旧行
  expandedPcId.value = item.pcId
  expandedOddsPcId.value = null

  // 解析当前记录 RawData（缓存）
  if (!currentParsedCache.has(item.pcId)) {
    currentParsedCache.set(item.pcId, parseRawData(item.rawData))
  }

  // 懒加载前一条记录
  if (!prevCache.has(item.pcId)) {
    const prev = await fetchPrevious(item.pcId, item.marketId, item.selectionId, item.refreshTime)
    if (prev?.rawData) {
      previousParsedCache.set(item.pcId, parseRawData(prev.rawData))
    }
  }
}

/** 切换赔率层展开/收起（LastPrice），与 1x2 互斥 */
function toggleOddsExpand(item: BigHoldItemView) {
  if (expandedOddsPcId.value === item.pcId) {
    expandedOddsPcId.value = null
    return
  }
  expandedOddsPcId.value = item.pcId
  expandedPcId.value = null  // 互斥：关闭 1x2 展开
}

/** 重试加载前一条记录 */
async function retryFetchPrevious(item: BigHoldItemView) {
  const prev = await fetchPrevious(item.pcId, item.marketId, item.selectionId, item.refreshTime)
  if (prev?.rawData) {
    previousParsedCache.set(item.pcId, parseRawData(prev.rawData))
  }
}

/** 获取当前记录解析数据 */
function getCurrentRows(pcId: number): PriceSizeRow[] {
  return currentParsedCache.get(pcId) ?? []
}

/** 获取前一条记录解析数据 */
function getPreviousRows(pcId: number): PriceSizeRow[] {
  return previousParsedCache.get(pcId) ?? []
}

/** 获取差额数据 */
function getDiffRows(pcId: number): PriceSizeRow[] {
  const current = getCurrentRows(pcId)
  const previous = getPreviousRows(pcId)
  if (current.length === 0 || previous.length === 0) return []
  return calcTradedDiff(current, previous)
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

// ── 格式化 & 样式辅助 → 已移至 ~/utils/formatters.ts 和 ~/utils/styleHelpers.ts ──
</script>

<template>
  <div class="bighold-page">
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
      </div>

      <!-- 排序按钮 + 刷新 -->
      <div class="sort-bar">
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
        <!-- 赔率摘要 + 密集指标 -->
        <div v-if="activeWindow.odds" class="info-bar">
          <!-- 第一行：赔率/成交量/权重/盈亏/HOT 横向卡片 -->
          <div class="info-row">
            <span class="info-chip">
              成交量 <b>{{ formatMoney(activeWindow.odds.totalAmount) }}</b>
            </span>
            <span class="info-chip">
              赔率 <b>{{ activeWindow.odds.homeOdds }}-{{ activeWindow.odds.drawOdds }}-{{ activeWindow.odds.awayOdds }}</b>
            </span>
            <span class="info-chip">
              权重 <b>{{ activeWindow.odds.homeWeight.toFixed(0) }}-{{ activeWindow.odds.drawWeight.toFixed(0) }}-{{ activeWindow.odds.awayWeight.toFixed(0) }}</b>
            </span>
            <span class="info-chip">
              盈亏 <b>{{ activeWindow.odds.homePayout.toFixed(0) }}-{{ activeWindow.odds.drawPayout.toFixed(0) }}-{{ activeWindow.odds.awayPayout.toFixed(0) }}</b>
            </span>
            <span class="info-chip">
              HOT
              <b :class="{ 'text-neg': activeWindow.odds.homeHotTrend < 0 }">{{ activeWindow.odds.homeHotTrend.toFixed(2) }}</b>-<b
                :class="{ 'text-neg': activeWindow.odds.drawHotTrend < 0 }">{{ activeWindow.odds.drawHotTrend.toFixed(2) }}</b>-<b
                :class="{ 'text-neg': activeWindow.odds.awayHotTrend < 0 }">{{ activeWindow.odds.awayHotTrend.toFixed(2) }}</b>
            </span>
            <span class="info-chip">
              分项 <b>{{ formatMoney(activeWindow.odds.homeAmount) }}-{{ formatMoney(activeWindow.odds.drawAmount) }}-{{ formatMoney(activeWindow.odds.awayAmount) }}</b>
            </span>
          </div>
          <!-- 第二行：密集指标 -->
          <div v-if="activeWindow.csExtra" class="info-row">
            <span class="info-chip dense">密集价位 <b>{{ activeWindow.csExtra.densePrice }}</b></span>
            <span class="info-chip dense">密集比例 <b>{{ activeWindow.csExtra.denseRatio }}</b></span>
            <span class="info-chip dense">密集指数 <b>{{ activeWindow.csExtra.denseIndex }}</b></span>
            <span class="info-chip dense">密集交易量 <b>{{ activeWindow.csExtra.denseVolume }}</b></span>
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
                <th class="col-weight">Weight</th>
                <th class="col-hot">Hot</th>
                <th class="col-pmark">P标</th>
                <th class="col-time">更新时间</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(item, idx) in activeWindow.items" :key="item.pcId">
                <!-- 主行 -->
                <tr
                  :class="['main-row', { 'row-expanded': expandedPcId === item.pcId || expandedOddsPcId === item.pcId }]"
                >
                  <td>{{ idx + 1 }}</td>
                  <td
                    :class="['sel-cell', 'sel-' + item.selection, { 'sel-large-order': hasLargeOrder(item.selectionId) }]"
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
                  <td class="col-time-val">{{ formatDateTime(item.refreshTime) }}</td>
                </tr>

                <!-- 展开行：1x2 层（当前 + 前一条 + 差额） -->
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

<style scoped>
.bighold-page {
  max-width: 1440px;
  margin: 0 auto;
  padding: 16px;
  font-size: 0.85rem;
  background: #fff;
}

/* ── 页头 ── */
.match-header {
  margin-bottom: 12px;
}
.back-link {
  color: #2563eb;
  text-decoration: none;
  font-size: 0.85rem;
}
.back-link:hover {
  text-decoration: underline;
}
.match-title {
  margin: 6px 0 2px;
  font-size: 1.1rem;
}
.team-home { color: #c00; font-weight: 600; }
.team-vs { margin: 0 8px; color: #666; font-weight: 400; }
.team-away { color: #00c; font-weight: 600; }
.match-meta {
  color: #666;
  font-size: 0.82rem;
}

/* ── 排序栏 ── */
.sort-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.sort-label {
  color: #666;
  font-size: 0.82rem;
}
.sort-btn {
  padding: 3px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 0.82rem;
}
.sort-btn:hover {
  background: #f0f0f0;
}
.sort-btn.active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}

/* ── 刷新按钮 ── */
.refresh-btn {
  margin-left: auto;
  padding: 3px 14px;
  border: 1px solid #10b981;
  border-radius: 4px;
  background: #fff;
  color: #10b981;
  font-size: 0.82rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: all 0.15s ease;
}
.refresh-btn:hover:not(:disabled) {
  background: #10b981;
  color: #fff;
}
.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.refresh-btn .spin {
  display: inline-block;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── Tab 栏（胶囊按钮组） ── */
.tab-bar {
  display: inline-flex;
  gap: 0;
  margin-bottom: 10px;
  background: #f1f3f5;
  border-radius: 8px;
  padding: 3px;
  overflow-x: auto;
}
.tab-btn {
  padding: 5px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.8rem;
  color: #666;
  border-radius: 6px;
  white-space: nowrap;
  transition: all 0.15s ease;
  font-weight: 500;
  letter-spacing: 0.01em;
  position: relative;
}
.tab-btn:hover {
  color: #333;
  background: rgba(0, 0, 0, 0.04);
}
.tab-btn.active {
  color: #fff;
  background: #3b82f6;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.3);
}

/* ── 信息条（赔率 + 密集指标） ── */
.info-bar {
  margin-bottom: 8px;
  padding: 6px 8px;
  background: #f8fafc;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}
.info-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: baseline;
  line-height: 1.6;
}
.info-row + .info-row {
  margin-top: 2px;
  padding-top: 4px;
  border-top: 1px dashed #e5e7eb;
}
.info-chip {
  font-size: 0.78rem;
  color: #666;
  white-space: nowrap;
}
.info-chip b {
  color: #222;
  font-weight: 600;
  margin-left: 2px;
  font-variant-numeric: tabular-nums;
}
.info-chip.dense {
  color: #7c6a2d;
}
.info-chip.dense b {
  color: #4a3d14;
}

/* ── BigHold 主表 ── */
.table-wrapper {
  overflow-x: auto;
}
.bighold-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  background: #fff;
}
.bighold-table th {
  background: #f5f5f5;
  padding: 6px 8px;
  text-align: center;
  font-weight: 600;
  border-bottom: 2px solid #d1d5db;
  white-space: nowrap;
}
.bighold-table td {
  padding: 5px 8px;
  text-align: center;
  border-bottom: 1px solid #e5e7eb;
}
.bighold-table tbody .main-row:hover {
  background: #f5f8ff;
}

/* 可点击列表头提示 */
.clickable-header {
  cursor: help;
}

/* 主行展开时加强下边框 */
.row-expanded {
  border-bottom: 2px solid #2563eb !important;
}
.row-expanded td {
  border-bottom: 2px solid #2563eb !important;
}

/* 可点击的 1x2 和赔率单元格 */
.sel-cell {
  cursor: pointer;
  user-select: none;
  font-weight: 600;
}
.sel-cell:hover {
  text-decoration: underline;
}
.odds-cell {
  cursor: pointer;
  user-select: none;
}
.odds-cell:hover {
  text-decoration: underline;
}

/* 列宽 */
.col-idx { width: 36px; }
.col-sel { width: 40px; }
.col-odds { width: 60px; }
.col-amount { width: 80px; }
.col-attr { width: 50px; }
.col-hold { width: 80px; }
.col-payout { width: 60px; }
.col-per { width: 50px; }
.col-pertotal { width: 56px; }
.col-weight { width: 50px; }
.col-hot { width: 60px; }
.col-pmark { width: 46px; }
.col-time { width: 130px; }
.col-time-val { font-size: 0.78rem; white-space: nowrap; }
.col-attr-val { font-size: 0.78rem; max-width: 60px; overflow: hidden; text-overflow: ellipsis; }

/* 1x2 Selection 颜色 */
.sel-主 { color: #c00; }
.sel-平 { color: #666; }
.sel-客 { color: #00c; }

/* LastPrice 大额挂单 → 1x2 标红 */
.sel-large-order {
  color: #c00 !important;
  background: #fee2e2 !important;
}

/* Hold 高亮 */
.highlight-3sigma {
  background: #ffff00 !important;
  font-weight: 700;
}
.highlight-2sigma {
  background: #FFFFA8 !important;
}

/* Top 2 Amount */
.text-top2 {
  color: #8b0000;
  font-weight: 700;
}

/* 负数红色 */
.text-neg {
  color: #c00;
}

/* PMark 样式 (与首页一致) */
.pmark-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
}
.pmark-ps { background: #fef3c7; color: #92400e; }
.pmark-p { background: #fee2e2; color: #991b1b; }
.pmark-p0 { background: #fce7f3; color: #9d174d; }
.pmark-p1 { background: #ede9fe; color: #5b21b6; }
.pmark-p2 { background: #dbeafe; color: #1e40af; }
.pmark-p6 { background: #d1fae5; color: #065f46; }
.pmark-p12 { background: #f3f4f6; color: #6b7280; }

/* ── 展开行 ── */
.expand-row > td {
  padding: 0 !important;
  border-bottom: 1px solid #d1d5db;
  background: #fff;
}
.expand-row-odds > td {
  background: #fafcff;
}
.expand-content {
  padding: 10px 16px;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 600px;
  }
}

/* 三栏并排 */
.detail-panels {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.detail-panel {
  flex: 1;
  min-width: 200px;
  max-width: 380px;
}
.panel-title {
  font-weight: 600;
  font-size: 0.82rem;
  color: #444;
  margin-bottom: 4px;
  padding-bottom: 3px;
  border-bottom: 1px solid #e5e7eb;
}

/* 明细子表 */
.detail-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.78rem;
}
.detail-table th {
  background: #eef0f2;
  padding: 3px 10px;
  text-align: center;
  font-weight: 600;
  font-size: 0.75rem;
  border-bottom: 1px solid #d1d5db;
}
.detail-table td {
  padding: 2px 14px 2px 8px;
  text-align: right;
  border-bottom: 1px solid #eee;
  font-variant-numeric: tabular-nums;
}
.detail-table td:first-child {
  text-align: center;
  font-weight: 500;
  padding-left: 6px;
  padding-right: 6px;
}

/* Back 蓝底 — !important 覆盖 expand-row td 的背景 */
.bg-back {
  background: #A6D8FF !important;
}
/* Lay 粉底 — !important 覆盖 expand-row td 的背景 */
.bg-lay {
  background: #FAC9D1 !important;
}

/* 成交量高亮 */
.text-traded-2x {
  color: #e67e22;
  font-weight: 700;
}
.text-traded-3x {
  color: #8e44ad;
  font-weight: 700;
}

/* 差额表 */
.diff-table td {
  text-align: center;
}
.diff-val {
  color: #27ae60;
  font-weight: 600;
}

/* 面板状态 */
.panel-empty {
  text-align: center;
  color: #999;
  padding: 12px 0;
  font-size: 0.78rem;
}
.panel-loading {
  text-align: center;
  color: #666;
  padding: 12px 0;
  font-size: 0.78rem;
}
.panel-error {
  text-align: center;
  color: #c00;
  padding: 12px 0;
  font-size: 0.78rem;
}
.retry-link {
  color: #2563eb;
  cursor: pointer;
  text-decoration: underline;
}
.retry-link:hover {
  color: #1d4ed8;
}

/* 加载旋转动画 */
.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  vertical-align: middle;
  margin-right: 4px;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 统计行 */
.stat-row td {
  padding: 4px 8px;
  background: #fafbfc;
  border-bottom: 1px solid #e5e7eb;
}
.stat-label {
  text-align: right !important;
  font-weight: 600;
  color: #555;
}
.stat-highlight td {
  font-weight: 700;
}

/* 无数据 */
.no-data {
  text-align: center;
  color: #999;
  padding: 24px !important;
}

/* 加载/错误 */
.loading, .error-msg {
  text-align: center;
  padding: 48px 0;
  color: #666;
}
</style>
