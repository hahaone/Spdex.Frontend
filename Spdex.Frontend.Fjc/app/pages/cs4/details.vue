<script setup lang="ts">
import type { BigHoldItemView, PriceSizeRow } from '~/types/bighold'
import type { UoTimeWindowData } from '~/types/uobighold'
import { calcTradedDiff, parseRawData } from '~/utils/parseRawData'
import { formatMoney, formatDateTime, formatMatchTime, formatPercent } from '~/utils/formatters'
import { holdClass, amountClass, pmarkClass, priceBgClass, tradedClass } from '~/utils/styleHelpers'

// ── 路由参数 ──
const route = useRoute()
const eventId = computed(() => Number(route.query.id) || 0)
const orderParam = ref(0)
const marketTypeParam = ref(Number(route.query.marketType) || 0)

// ── 数据获取 ──
const queryParams = computed(() => ({
  id: eventId.value,
  marketType: marketTypeParam.value,
  order: orderParam.value,
}))
const { data, pending, error, refreshing, manualRefresh } = useUoBigHold(queryParams)

const result = computed(() => data.value?.data)
const matchInfo = computed(() => result.value?.match)
const windows = computed(() => result.value?.windows ?? [])
const volumeSummary = computed(() => result.value?.volumeSummary ?? [])

// ── Tab 切换 ──
const activeTab = ref(0)
const activeWindow = computed<UoTimeWindowData | null>(() => windows.value[activeTab.value] ?? null)

watch(activeTab, () => {
  expandedPcId.value = null
  expandedOddsPcId.value = null
})

// ── 行展开状态 ──
const expandedPcId = ref<number | null>(null)
const expandedOddsPcId = ref<number | null>(null)

// ── 行展开明细数据 ──
const { fetchPrevious, clearCache, loadingPcId, failedPcIds, cache: prevCache } = useBigHoldDetail('/api/uobighold/previous')

// ── 排序 ──
function setOrder(newOrder: number) {
  orderParam.value = newOrder
  expandedPcId.value = null
  expandedOddsPcId.value = null
  clearCache()
}

// ── 进球盘切换 ──
function setMarketType(mt: number) {
  marketTypeParam.value = mt
  activeTab.value = 0
  expandedPcId.value = null
  expandedOddsPcId.value = null
  clearCache()
}

/** 进球盘选项列表 */
const goalLines = [
  { type: 21, label: '0.5球' },
  { type: 22, label: '1.5球' },
  { type: 0, label: '2.5球' },
  { type: 23, label: '3.5球' },
  { type: 24, label: '4.5球' },
]

/** 当前记录解析后的 PriceSizeRow[] 缓存 */
const currentParsedCache = reactive(new Map<number, PriceSizeRow[]>())
/** 前一条记录解析后的 PriceSizeRow[] 缓存 */
const previousParsedCache = reactive(new Map<number, PriceSizeRow[]>())

/** 切换 O/U 层展开/收起 */
async function toggleExpand(item: BigHoldItemView) {
  if (expandedPcId.value === item.pcId) {
    expandedPcId.value = null
    return
  }
  expandedPcId.value = item.pcId
  expandedOddsPcId.value = null

  if (!currentParsedCache.has(item.pcId)) {
    currentParsedCache.set(item.pcId, parseRawData(item.rawData))
  }

  if (!prevCache.has(item.pcId)) {
    const prev = await fetchPrevious(item.pcId, item.marketId, item.selectionId, item.refreshTime)
    if (prev?.rawData) {
      previousParsedCache.set(item.pcId, parseRawData(prev.rawData))
    }
  }
}

/** 切换赔率层展开/收起（LastPrice），与 O/U 互斥 */
function toggleOddsExpand(item: BigHoldItemView) {
  if (expandedOddsPcId.value === item.pcId) {
    expandedOddsPcId.value = null
    return
  }
  expandedOddsPcId.value = item.pcId
  expandedPcId.value = null
}

/** 重试加载前一条记录 */
async function retryFetchPrevious(item: BigHoldItemView) {
  const prev = await fetchPrevious(item.pcId, item.marketId, item.selectionId, item.refreshTime)
  if (prev?.rawData) {
    previousParsedCache.set(item.pcId, parseRawData(prev.rawData))
  }
}

function getCurrentRows(pcId: number): PriceSizeRow[] {
  return currentParsedCache.get(pcId) ?? []
}

function getPreviousRows(pcId: number): PriceSizeRow[] {
  return previousParsedCache.get(pcId) ?? []
}

function getDiffRows(pcId: number): PriceSizeRow[] {
  const current = getCurrentRows(pcId)
  const previous = getPreviousRows(pcId)
  if (current.length === 0 || previous.length === 0) return []
  return calcTradedDiff(current, previous)
}

function getLastPriceRows(selectionId: number): PriceSizeRow[] {
  if (!activeWindow.value?.lastPrices) return []
  const lp = activeWindow.value.lastPrices.find(p => p.selectionId === selectionId)
  if (!lp?.rawData) return []
  return parseRawData(lp.rawData)
}

function hasLargeOrder(selectionId: number): boolean {
  if (!activeWindow.value?.lastPrices) return false
  const lp = activeWindow.value.lastPrices.find(p => p.selectionId === selectionId)
  return lp?.hasLargeOrderAt500Or1000 ?? false
}

// ── 格式化 & 样式辅助 → 已移至 ~/utils/formatters.ts 和 ~/utils/styleHelpers.ts ──

/** 百分比格式化（保留旧模板中 formatPer 的调用兼容） */
function formatPer(val: number): string {
  return formatPercent(val, 0)
}
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
          &nbsp;|&nbsp; 进球盘 {{ matchInfo?.marketName }} 球
        </div>
      </div>

      <!-- 进球盘切换 -->
      <div class="goal-line-bar">
        <span class="goal-line-label">进球盘：</span>
        <button
          v-for="gl in goalLines"
          :key="gl.type"
          :class="['goal-line-btn', { active: marketTypeParam === gl.type }]"
          @click="setMarketType(gl.type)"
        >{{ gl.label }}</button>
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
        <!-- 赔率摘要 -->
        <div v-if="activeWindow.odds" class="info-bar">
          <div class="info-row">
            <span class="info-chip">
              成交量 <b>{{ formatMoney(activeWindow.odds.totalAmount) }}</b>
            </span>
            <span class="info-chip">
              赔率 <b>{{ activeWindow.odds.overOdds }}-{{ activeWindow.odds.underOdds }}</b>
            </span>
            <span class="info-chip">
              比例 <b>{{ formatPer(activeWindow.odds.overPer) }} | {{ formatPer(activeWindow.odds.underPer) }}</b>
            </span>
            <span class="info-chip">
              Weight <b>{{ activeWindow.odds.overWeight.toFixed(0) }}-{{ activeWindow.odds.underWeight.toFixed(0) }}</b>
            </span>
            <span class="info-chip">
              盈亏 <b>{{ activeWindow.odds.overPayout.toFixed(0) }}-{{ activeWindow.odds.underPayout.toFixed(0) }}</b>
            </span>
          </div>
          <!-- 密集指标 -->
          <div v-if="activeWindow.csExtra" class="info-row">
            <span class="info-chip dense">密集价位 <b>{{ activeWindow.csExtra.densePrice }}</b></span>
            <span class="info-chip dense">密集比例 <b>{{ activeWindow.csExtra.denseRatio }}</b></span>
            <span class="info-chip dense">Pro <b>{{ activeWindow.csExtra.pro }}，R:{{ activeWindow.csExtra.r.toFixed(3) }}</b></span>
            <span class="info-chip dense">成交量 <b>{{ activeWindow.csExtra.volume }}</b></span>
            <span class="info-chip dense">TOP <b>{{ activeWindow.csExtra.top }}</b></span>
          </div>
          <div v-if="activeWindow.csExtra" class="info-row">
            <span class="info-chip dense">
              盈亏指数 Over:<b>{{ activeWindow.csExtra.payoutIndexOver.toFixed(3) }}</b>
              Under:<b>{{ activeWindow.csExtra.payoutIndexUnder.toFixed(3) }}</b>
            </span>
            <span class="info-chip dense">
              HOLD金额 Over:<b>{{ formatMoney(activeWindow.csExtra.holdAmountOver) }}</b>
              Under:<b>{{ formatMoney(activeWindow.csExtra.holdAmountUnder) }}</b>
            </span>
          </div>
        </div>

        <!-- BigHold 主表 -->
        <div class="table-wrapper">
          <table class="bighold-table">
            <thead>
              <tr>
                <th class="col-sel clickable-header">O/U</th>
                <th class="col-odds clickable-header">Odds</th>
                <th class="col-dense">Dense</th>
                <th class="col-amount">Amount</th>
                <th class="col-attr">Attr</th>
                <th class="col-hold">Top Hold</th>
                <th class="col-payout">Payout</th>
                <th class="col-per">Per</th>
                <th class="col-weight">Weight</th>
                <th class="col-pmark">P Mark</th>
                <th class="col-time">Update Time</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="item in activeWindow.items" :key="item.pcId">
                <tr :class="['main-row', { 'row-expanded': expandedPcId === item.pcId || expandedOddsPcId === item.pcId }]">
                  <td
                    :class="['sel-cell', item.selection === '大' ? 'sel-over' : 'sel-under', { 'sel-large-order': hasLargeOrder(item.selectionId) }]"
                    title="点击展开 Back/Lay/Traded 明细"
                    @click="toggleExpand(item)"
                  >{{ item.selection }}</td>
                  <td class="odds-cell" title="点击展开 LastPrice" @click="toggleOddsExpand(item)">{{ item.lastOdds.toFixed(2) }}</td>
                  <td>{{ item.dense > 0 ? item.dense.toFixed(2) : '' }}</td>
                  <td :class="amountClass(item)">{{ formatMoney(item.tradedChange) }}</td>
                  <td class="col-attr-val">{{ item.tradedAttr }}</td>
                  <td :class="holdClass(item)">{{ formatMoney(item.hold) }}</td>
                  <td>{{ item.payout.toFixed(0) }}</td>
                  <td>{{ formatPer(item.per / 100) }}</td>
                  <td>{{ item.weight.toFixed(0) }}</td>
                  <td><span :class="['pmark-badge', pmarkClass(item.pMark)]">{{ item.pMark }}</span></td>
                  <td class="col-time-val">{{ formatDateTime(item.refreshTime) }}</td>
                </tr>

                <!-- 展开行：O/U 层（当前 + 前一条 + 差额） -->
                <tr v-if="expandedPcId === item.pcId" class="expand-row">
                  <td colspan="11">
                    <div class="expand-content">
                      <div class="detail-panels">
                        <!-- 当前记录 -->
                        <div class="detail-panel">
                          <div class="panel-title">当前记录</div>
                          <table v-if="getCurrentRows(item.pcId).length > 0" class="detail-table">
                            <thead><tr><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
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
                          <div v-if="loadingPcId === item.pcId" class="panel-loading"><span class="spinner"></span> 加载中...</div>
                          <div v-else-if="failedPcIds.has(item.pcId)" class="panel-error">
                            获取失败，<span class="retry-link" @click="retryFetchPrevious(item)">点击重试</span>
                          </div>
                          <div v-else-if="prevCache.has(item.pcId) && !prevCache.get(item.pcId)" class="panel-empty">无前一条记录</div>
                          <table v-else-if="getPreviousRows(item.pcId).length > 0" class="detail-table">
                            <thead><tr><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
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
                            <thead><tr><th>价位</th><th>差额</th></tr></thead>
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
                  <td colspan="11">
                    <div class="expand-content">
                      <div class="detail-panels">
                        <div class="detail-panel">
                          <div class="panel-title">LastPrice 挂牌数据 ({{ item.selection }})</div>
                          <table v-if="getLastPriceRows(item.selectionId).length > 0" class="detail-table">
                            <thead><tr><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
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

              <tr v-if="activeWindow.items.length === 0">
                <td colspan="11" class="no-data">暂无数据</td>
              </tr>
            </tbody>
            <!-- 统计行 -->
            <tfoot v-if="activeWindow.items.length > 0">
              <tr class="stat-row">
                <td colspan="3" class="stat-label">&sigma; (标准差)</td>
                <td>{{ formatMoney(activeWindow.stdDevAmount) }}</td>
                <td></td>
                <td>{{ formatMoney(activeWindow.stdDevHold) }}</td>
                <td colspan="5"></td>
              </tr>
              <tr class="stat-row">
                <td colspan="3" class="stat-label">&mu; (平均)</td>
                <td>{{ formatMoney(activeWindow.avgAmount) }}</td>
                <td></td>
                <td>{{ formatMoney(activeWindow.avgHold) }}</td>
                <td colspan="5"></td>
              </tr>
              <tr class="stat-row stat-highlight">
                <td colspan="3" class="stat-label">&mu; + 2&sigma;</td>
                <td>{{ formatMoney(activeWindow.threshold2SigmaAmount) }}</td>
                <td></td>
                <td>{{ formatMoney(activeWindow.threshold2SigmaHold) }}</td>
                <td colspan="5"></td>
              </tr>
              <tr class="stat-row stat-highlight">
                <td colspan="3" class="stat-label">&mu; + 3&sigma;</td>
                <td>{{ formatMoney(activeWindow.threshold3SigmaAmount) }}</td>
                <td></td>
                <td>{{ formatMoney(activeWindow.threshold3SigmaHold) }}</td>
                <td colspan="5"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- 多时间节点成交汇总 -->
        <div v-if="volumeSummary.length > 0" class="volume-summary">
          <h4 class="summary-title">成交汇总</h4>
          <table class="summary-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>小球 (Under)</th>
                <th>大球 (Over)</th>
                <th>合计</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="vs in volumeSummary" :key="vs.timing">
                <td>{{ vs.timing }}</td>
                <td>{{ formatMoney(vs.underAmount) }}</td>
                <td>{{ formatMoney(vs.overAmount) }}</td>
                <td>{{ formatMoney(vs.underAmount + vs.overAmount) }}</td>
              </tr>
            </tbody>
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
.match-header { margin-bottom: 12px; }
.back-link { color: #2563eb; text-decoration: none; font-size: 0.85rem; }
.back-link:hover { text-decoration: underline; }
.match-title { margin: 6px 0 2px; font-size: 1.1rem; }
.team-home { color: #c00; font-weight: 600; }
.team-vs { margin: 0 8px; color: #666; font-weight: 400; }
.team-away { color: #00c; font-weight: 600; }
.match-meta { color: #666; font-size: 0.82rem; }

/* ── 进球盘切换 ── */
.goal-line-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.goal-line-label {
  color: #666;
  font-size: 0.82rem;
}
.goal-line-btn {
  padding: 4px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 500;
  transition: all 0.15s ease;
}
.goal-line-btn:hover {
  background: #f0f0f0;
  border-color: #9ca3af;
}
.goal-line-btn.active {
  background: #059669;
  color: #fff;
  border-color: #059669;
}

/* ── 排序栏 ── */
.sort-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.sort-label { color: #666; font-size: 0.82rem; }
.sort-btn {
  padding: 3px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 0.82rem;
}
.sort-btn:hover { background: #f0f0f0; }
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
.refresh-btn:hover:not(:disabled) { background: #10b981; color: #fff; }
.refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.refresh-btn .spin { display: inline-block; animation: spin 0.8s linear infinite; }
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── Tab 栏 ── */
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
}
.tab-btn:hover { color: #333; background: rgba(0, 0, 0, 0.04); }
.tab-btn.active {
  color: #fff;
  background: #3b82f6;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.3);
}

/* ── 信息条 ── */
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
.info-chip.dense { color: #7c6a2d; }
.info-chip.dense b { color: #4a3d14; }

/* ── 主表 ── */
.table-wrapper { overflow-x: auto; }
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
.bighold-table tbody .main-row:hover { background: #f5f8ff; }
.clickable-header { cursor: help; }
.row-expanded { border-bottom: 2px solid #2563eb !important; }
.row-expanded td { border-bottom: 2px solid #2563eb !important; }

.sel-cell {
  cursor: pointer;
  user-select: none;
  font-weight: 600;
}
.sel-cell:hover { text-decoration: underline; }
.odds-cell { cursor: pointer; user-select: none; }
.odds-cell:hover { text-decoration: underline; }

/* 列宽 */
.col-sel { width: 46px; }
.col-odds { width: 60px; }
.col-dense { width: 60px; }
.col-amount { width: 80px; }
.col-attr { width: 50px; }
.col-hold { width: 80px; }
.col-payout { width: 60px; }
.col-per { width: 50px; }
.col-weight { width: 50px; }
.col-pmark { width: 50px; }
.col-time { width: 130px; }
.col-time-val { font-size: 0.78rem; white-space: nowrap; }
.col-attr-val { font-size: 0.78rem; max-width: 60px; overflow: hidden; text-overflow: ellipsis; }

/* O/U 颜色 */
.sel-over { color: #c00; }
.sel-under { color: #00c; }
.sel-large-order {
  color: #c00 !important;
  background: #fee2e2 !important;
}

/* Hold 高亮 */
.highlight-3sigma { background: #ffff00 !important; font-weight: 700; }
.highlight-2sigma { background: #FFFFA8 !important; }
.text-top2 { color: #8b0000; font-weight: 700; }
.text-neg { color: #c00; }

/* PMark */
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
.expand-row-odds > td { background: #fafcff; }
.expand-content {
  padding: 10px 16px;
  animation: slideDown 0.2s ease;
}
@keyframes slideDown {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 600px; }
}

.detail-panels { display: flex; gap: 16px; flex-wrap: wrap; }
.detail-panel { flex: 1; min-width: 200px; max-width: 380px; }
.panel-title {
  font-weight: 600;
  font-size: 0.82rem;
  color: #444;
  margin-bottom: 4px;
  padding-bottom: 3px;
  border-bottom: 1px solid #e5e7eb;
}

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

.bg-back { background: #A6D8FF !important; }
.bg-lay { background: #FAC9D1 !important; }
.text-traded-2x { color: #e67e22; font-weight: 700; }
.text-traded-3x { color: #8e44ad; font-weight: 700; }

.diff-table td { text-align: center; }
.diff-val { color: #27ae60; font-weight: 600; }

.panel-empty { text-align: center; color: #999; padding: 12px 0; font-size: 0.78rem; }
.panel-loading { text-align: center; color: #666; padding: 12px 0; font-size: 0.78rem; }
.panel-error { text-align: center; color: #c00; padding: 12px 0; font-size: 0.78rem; }
.retry-link { color: #2563eb; cursor: pointer; text-decoration: underline; }
.retry-link:hover { color: #1d4ed8; }

.spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid #e5e7eb;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  vertical-align: middle;
  margin-right: 4px;
}

/* 统计行 */
.stat-row td {
  padding: 4px 8px;
  background: #fafbfc;
  border-bottom: 1px solid #e5e7eb;
}
.stat-label { text-align: right !important; font-weight: 600; color: #555; }
.stat-highlight td { font-weight: 700; }

.no-data { text-align: center; color: #999; padding: 24px !important; }
.loading, .error-msg { text-align: center; padding: 48px 0; color: #666; }

/* ── 成交汇总表 ── */
.volume-summary {
  margin-top: 16px;
  padding: 8px;
  background: #f8fafc;
  border-radius: 4px;
  border: 1px solid #e5e7eb;
}
.summary-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: #333;
  margin: 0 0 8px;
}
.summary-table {
  width: 100%;
  max-width: 500px;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.summary-table th {
  background: #eef0f2;
  padding: 4px 10px;
  text-align: center;
  font-weight: 600;
  border-bottom: 1px solid #d1d5db;
}
.summary-table td {
  padding: 4px 10px;
  text-align: center;
  border-bottom: 1px solid #eee;
  font-variant-numeric: tabular-nums;
}
</style>
