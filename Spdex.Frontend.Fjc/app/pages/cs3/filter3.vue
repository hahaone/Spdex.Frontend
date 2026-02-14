<script setup lang="ts">
import type { Filter3Item, NextRecordResult } from '~/types/bffilter'
import type { PriceSizeRow, PreviousRecordResult } from '~/types/bighold'
import type { ApiResponse } from '~/types/api'
import { parseRawData, calcTradedDiff } from '~/utils/parseRawData'
import { formatMoney, formatDateTime, formatMatchTime } from '~/utils/formatters'
import { pmarkClass, priceBgClass, tradedClass } from '~/utils/styleHelpers'

// ── 路由参数 ──
const route = useRoute()
const eventId = computed(() => Number(route.query.id) || 0)

// ── 挂牌时间输入 ──
const timeInput = ref<string | null>(null)
const activeTime = ref<string | null>(null)

function submitTime() {
  activeTime.value = timeInput.value || null
}

// ── 数据获取 ──
const { data, pending, error } = useBfFilter3(eventId, activeTime)

const result = computed(() => data.value?.data)
const matchInfo = computed(() => result.value?.match)
const items = computed(() => result.value?.items ?? [])

useHead({
  title: computed(() => matchInfo.value
    ? `挂牌指数提炼表 ${matchInfo.value.homeTeam}vs${matchInfo.value.guestTeam}`
    : '挂牌指数提炼表'),
})

// ── 行展开状态（1x2 展开：下一条/当前/前一条/差额） ──
const expandedPcId = ref<number | null>(null)

// ── 前一条记录缓存 ──
const config = useRuntimeConfig()
const prevCache = reactive(new Map<number, PreviousRecordResult | null>())
const loadingPrevPcId = ref<number | null>(null)
const failedPrevPcIds = reactive(new Set<number>())

// ── 下一条记录缓存 ──
const nextCache = reactive(new Map<number, NextRecordResult | null>())
const loadingNextPcId = ref<number | null>(null)
const failedNextPcIds = reactive(new Set<number>())

// ── RawData 解析缓存 ──
const currentParsedCache = reactive(new Map<number, PriceSizeRow[]>())
const previousParsedCache = reactive(new Map<number, PriceSizeRow[]>())
const nextParsedCache = reactive(new Map<number, PriceSizeRow[]>())

async function fetchPrevious(item: Filter3Item): Promise<PreviousRecordResult | null> {
  if (prevCache.has(item.pcId)) return prevCache.get(item.pcId) ?? null

  loadingPrevPcId.value = item.pcId
  failedPrevPcIds.delete(item.pcId)

  try {
    const baseURL = config.public.apiBase as string
    const params = new URLSearchParams({
      pcId: item.pcId.toString(),
      marketId: (matchInfo.value?.marketId1 ?? 0).toString(),
      selectionId: item.selectionId.toString(),
      refreshTime: item.refreshTime,
    })

    const resp = await $fetch<ApiResponse<PreviousRecordResult>>(
      `/api/bighold/previous?${params.toString()}`,
      { baseURL },
    )

    const res = resp.data ?? null
    prevCache.set(item.pcId, res)
    if (res?.rawData) {
      previousParsedCache.set(item.pcId, parseRawData(res.rawData))
    }
    return res
  }
  catch (err) {
    console.error('获取前一条记录失败:', err)
    failedPrevPcIds.add(item.pcId)
    return null
  }
  finally {
    if (loadingPrevPcId.value === item.pcId) loadingPrevPcId.value = null
  }
}

async function fetchNext(item: Filter3Item): Promise<NextRecordResult | null> {
  if (nextCache.has(item.pcId)) return nextCache.get(item.pcId) ?? null

  loadingNextPcId.value = item.pcId
  failedNextPcIds.delete(item.pcId)

  try {
    const baseURL = config.public.apiBase as string
    const params = new URLSearchParams({
      pcId: item.pcId.toString(),
      marketId: (matchInfo.value?.marketId1 ?? 0).toString(),
      selectionId: item.selectionId.toString(),
      refreshTime: item.refreshTime,
    })

    const resp = await $fetch<ApiResponse<NextRecordResult>>(
      `/api/bighold/next?${params.toString()}`,
      { baseURL },
    )

    const res = resp.data ?? null
    nextCache.set(item.pcId, res)
    if (res?.rawData) {
      nextParsedCache.set(item.pcId, parseRawData(res.rawData))
    }
    return res
  }
  catch (err) {
    console.error('获取下一条记录失败:', err)
    failedNextPcIds.add(item.pcId)
    return null
  }
  finally {
    if (loadingNextPcId.value === item.pcId) loadingNextPcId.value = null
  }
}

/** 切换 1x2 展开（下一条/当前/前一条/差额） */
async function toggleExpand(item: Filter3Item) {
  if (expandedPcId.value === item.pcId) {
    expandedPcId.value = null
    return
  }
  expandedPcId.value = item.pcId

  // 解析当前记录
  if (!currentParsedCache.has(item.pcId)) {
    currentParsedCache.set(item.pcId, parseRawData(item.rawData))
  }

  // 并发懒加载前一条和下一条
  const tasks: Promise<unknown>[] = []
  if (!prevCache.has(item.pcId)) tasks.push(fetchPrevious(item))
  if (!nextCache.has(item.pcId)) tasks.push(fetchNext(item))
  if (tasks.length > 0) await Promise.allSettled(tasks)
}

function getCurrentRows(pcId: number): PriceSizeRow[] {
  return currentParsedCache.get(pcId) ?? []
}
function getPreviousRows(pcId: number): PriceSizeRow[] {
  return previousParsedCache.get(pcId) ?? []
}
function getNextRows(pcId: number): PriceSizeRow[] {
  return nextParsedCache.get(pcId) ?? []
}
function getDiffRows(pcId: number): PriceSizeRow[] {
  const current = getCurrentRows(pcId)
  const previous = getPreviousRows(pcId)
  if (current.length === 0 || previous.length === 0) return []
  return calcTradedDiff(current, previous)
}

/** 数据就绪后自动预取所有前一条记录（用于 prev 子行显示） */
watch(items, (newItems) => {
  if (!newItems.length) return
  for (const item of newItems) {
    if (!prevCache.has(item.pcId)) {
      fetchPrevious(item)
    }
  }
}, { immediate: true })

/** 行背景色：主=灰，平=淡紫，客=淡蓝 + 黄色高亮 */
function selectionBgClassName(item: Filter3Item): string {
  if (item.selectionBgClass === 1) return 'selbg-1'
  if (item.selectionBgClass === 2) return 'selbg-2'
  if (item.selectionBgClass === 3) return 'selbg-3'
  return ''
}

function rowClass(item: Filter3Item): string[] {
  const classes: string[] = ['main-row', selectionBgClassName(item)]
  if (expandedPcId.value === item.pcId) classes.push('row-expanded')
  if (item.isHighlighted) classes.push('row-highlighted')
  return classes
}

/** 挂牌指数高亮样式 */
function etClass(item: Filter3Item): string {
  if (item.exchangeTradeHighlight === 1) return 'et-red'
  if (item.exchangeTradeHighlight === -1) return 'et-blue'
  return ''
}

/** 获取前一条记录的摘要信息（用于紧凑 prev 子行） */
function getPrevRecord(pcId: number): PreviousRecordResult | null | undefined {
  return prevCache.get(pcId)
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
      <!-- 页头 + 挂牌时间输入 -->
      <div class="match-header">
        <NuxtLink to="/" class="back-link">&larr; 返回列表</NuxtLink>
        <h2 class="match-title">
          <span class="team-home">{{ matchInfo?.homeTeam }}</span>
          <span class="team-vs">vs</span>
          <span class="team-away">{{ matchInfo?.guestTeam }}</span>
          <span class="page-badge">挂牌指数提炼表</span>
        </h2>
        <div class="match-meta">
          开赛时间：{{ formatMatchTime(matchInfo?.matchTime ?? '') }}
          &nbsp;|&nbsp; MarketId1: {{ matchInfo?.marketId1 }}
        </div>
      </div>

      <!-- 挂牌时间输入框 -->
      <div class="time-input-bar">
        <label for="listingTime">挂牌时间：</label>
        <input
          id="listingTime"
          v-model="timeInput"
          type="datetime-local"
          class="input-time"
        >
        <button class="btn-submit" @click="submitTime">提交</button>
      </div>

      <!-- 主表 -->
      <div class="table-wrapper">
        <table class="gridtable">
          <thead>
            <tr>
              <th>1x2</th>
              <th>Odds</th>
              <th>成交量</th>
              <th>Attr</th>
              <th>挂牌指数</th>
              <th>Weight</th>
              <th>P Mark</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in items" :key="item.pcId">
              <!-- 主行 -->
              <tr :class="rowClass(item)">
                <td
                  class="sel-cell"
                  :class="'sel-' + item.selection"
                  title="点击展开明细"
                  @click="toggleExpand(item)"
                >
                  <strong>{{ item.selection }}</strong>
                </td>
                <td class="num-cell">{{ item.lastOdds.toFixed(2) }}</td>
                <td class="num-cell">{{ formatMoney(item.tradedChange) }}</td>
                <td>{{ item.tradedAttr }}</td>
                <td :class="etClass(item)" class="num-cell">{{ (item.exchangeTrade * 100).toFixed(2) }}%</td>
                <td :class="{ 'td-highlight': item.weightHighlight }" class="num-cell">{{ item.weight.toFixed(0) }}</td>
                <td><span :class="['pmark-badge', pmarkClass(item.pMark)]">{{ item.pMark }}</span></td>
                <td class="col-time-val">{{ formatDateTime(item.refreshTime) }}</td>
              </tr>

              <!-- 前一条记录子行（紧跟在主行下方，始终显示） -->
              <tr v-if="prevCache.has(item.pcId) && getPrevRecord(item.pcId)" class="prev-sub-row" :class="selectionBgClassName(item)">
                <td class="prev-label">前一条记录</td>
                <td class="num-cell">{{ getPrevRecord(item.pcId)!.lastOdds.toFixed(2) }}</td>
                <td class="num-cell">{{ formatMoney(getPrevRecord(item.pcId)!.tradedChange) }}</td>
                <td colspan="2"></td>
                <td colspan="1"></td>
                <td colspan="1"></td>
                <td class="col-time-val">{{ formatDateTime(getPrevRecord(item.pcId)!.refreshTime) }}</td>
              </tr>

              <!-- 展开行：下一条 / 当前 / 前一条 / 差额 -->
              <tr v-if="expandedPcId === item.pcId" class="expand-row">
                <td colspan="8">
                  <div class="expand-content">
                    <div class="detail-panels">
                      <!-- 下一条记录 -->
                      <div class="detail-panel">
                        <div class="panel-title">下一条记录</div>
                        <div v-if="loadingNextPcId === item.pcId" class="panel-loading">
                          <span class="spinner"></span> 加载中...
                        </div>
                        <div v-else-if="failedNextPcIds.has(item.pcId)" class="panel-error">
                          获取失败，<span class="retry-link" @click="fetchNext(item)">点击重试</span>
                        </div>
                        <div v-else-if="nextCache.has(item.pcId) && !nextCache.get(item.pcId)" class="panel-empty">
                          无下一条记录
                        </div>
                        <table v-else-if="getNextRows(item.pcId).length > 0" class="detail-table">
                          <thead>
                            <tr><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr>
                          </thead>
                          <tbody>
                            <tr v-for="row in getNextRows(item.pcId)" :key="'n-' + row.price">
                              <td :class="priceBgClass(row)">{{ row.price }}</td>
                              <td :class="{ 'bg-back': row.toBack > 0 }">{{ row.toBack > 0 ? formatMoney(row.toBack) : '' }}</td>
                              <td :class="{ 'bg-lay': row.toLay > 0 }">{{ row.toLay > 0 ? formatMoney(row.toLay) : '' }}</td>
                              <td :class="tradedClass(row)">{{ row.traded > 0 ? formatMoney(row.traded) : '' }}</td>
                            </tr>
                          </tbody>
                        </table>
                        <div v-else class="panel-empty">等待数据...</div>
                      </div>

                      <!-- 当前记录 -->
                      <div class="detail-panel">
                        <div class="panel-title">当前记录</div>
                        <table v-if="getCurrentRows(item.pcId).length > 0" class="detail-table">
                          <thead>
                            <tr><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr>
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
                        <div v-if="loadingPrevPcId === item.pcId" class="panel-loading">
                          <span class="spinner"></span> 加载中...
                        </div>
                        <div v-else-if="failedPrevPcIds.has(item.pcId)" class="panel-error">
                          获取失败，<span class="retry-link" @click="fetchPrevious(item)">点击重试</span>
                        </div>
                        <div v-else-if="prevCache.has(item.pcId) && !prevCache.get(item.pcId)" class="panel-empty">
                          无前一条记录
                        </div>
                        <table v-else-if="getPreviousRows(item.pcId).length > 0" class="detail-table">
                          <thead>
                            <tr><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr>
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
                            <tr><th>价位</th><th>差额</th></tr>
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
            </template>

            <tr v-if="items.length === 0">
              <td colspan="8" class="no-data">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style>
@import '~/assets/css/detail-shared.css';
</style>

<style scoped>
.page-badge {
  display: inline-block;
  margin-left: 12px;
  padding: 2px 10px;
  background: #059669;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 4px;
  vertical-align: middle;
}

/* ── 挂牌时间输入栏 ── */
.time-input-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}
.time-input-bar label {
  font-weight: 600;
  font-size: 0.9rem;
  color: #444;
  white-space: nowrap;
}
.input-time {
  padding: 5px 10px;
  font-size: 0.9rem;
  border: 1px solid #ccc;
  border-radius: 5px;
}
.btn-submit {
  background-color: #2563eb;
  color: white;
  border: none;
  padding: 6px 16px;
  font-size: 0.9rem;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-submit:hover {
  background-color: #1d4ed8;
}

/* ── Selection 颜色 ── */
.sel-主 { color: #c00; }
.sel-平 { color: #666; }
.sel-客 { color: #00c; }

.num-cell {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* ── 行背景色（按 SelectionId 着色） ── */
.selbg-1 { background-color: #eee; }        /* 主 = 灰 */
.selbg-2 { background-color: #e9e5ff; }     /* 平 = 淡紫 */
.selbg-3 { background-color: #d6edff; }     /* 客 = 淡蓝 */

/* ── 行级黄色高亮 ── */
.row-highlighted {
  background: #ffff00 !important;
}
.row-highlighted:hover {
  background: #ffffa8 !important;
}

/* ── 挂牌指数高亮 ── */
.et-red {
  color: #c00 !important;
  font-weight: 700;
}
.et-blue {
  color: #00c !important;
  font-weight: 700;
}

/* ── 前一条记录子行 ── */
.prev-sub-row td {
  padding: 3px 5px !important;
  font-size: 0.85rem;
  color: #666;
  border-bottom: 1px dashed #d1d5db;
}
.prev-label {
  font-style: italic;
  color: #999 !important;
  text-align: center;
}

/* ── 展开面板四栏 ── */
.detail-panels {
  flex-wrap: wrap;
}
.detail-panel {
  min-width: 180px;
  max-width: 320px;
}
</style>
