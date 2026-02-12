<script setup lang="ts">
import type { BigHoldItemView, PriceSizeRow } from '~/types/bighold'
import type { UoTimeWindowData } from '~/types/uobighold'
import { parseRawData } from '~/utils/parseRawData'
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

useHead({
  title: computed(() => matchInfo.value
    ? `大小 ${matchInfo.value.homeTeam}vs${matchInfo.value.guestTeam}`
    : '大小'),
})

// ── Tab 切换 ──
const activeTab = ref(0)
const activeWindow = computed<UoTimeWindowData | null>(() => windows.value[activeTab.value] ?? null)

// ── 行展开 & 前一条记录（使用共享 composable） ──
const {
  expandedPcId, expandedOddsPcId,
  loadingPcId, failedPcIds, prevCache,
  toggleExpand, toggleOddsExpand, retryFetchPrevious,
  collapseAll, resetAll,
  getCurrentRows, getPreviousRows, getDiffRows,
} = useDetailExpand({ previousEndpoint: '/api/uobighold/previous' })

watch(activeTab, () => collapseAll())

// ── 排序 ──
function setOrder(newOrder: number) {
  orderParam.value = newOrder
  resetAll()
}

// ── 进球盘切换 ──
function setMarketType(mt: number) {
  marketTypeParam.value = mt
  activeTab.value = 0
  resetAll()
}

/** 进球盘选项列表 */
const goalLines = [
  { type: 21, label: '0.5球' },
  { type: 22, label: '1.5球' },
  { type: 0, label: '2.5球' },
  { type: 23, label: '3.5球' },
  { type: 24, label: '4.5球' },
]

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

/** 百分比格式化 */
function formatPer(val: number): string {
  return formatPercent(val, 0)
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

<style>
@import '~/assets/css/detail-shared.css';
</style>

<style scoped>
/* ── cs4 页面特有样式 ── */

/* 进球盘切换栏 */
.goal-line-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.goal-line-label {
  color: #666;
  font-size: 0.88rem;
}
.goal-line-btn {
  padding: 4px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 0.88rem;
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
</style>
