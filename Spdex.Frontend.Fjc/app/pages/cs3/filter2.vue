<script setup lang="ts">
import type { Filter2Item } from '~/types/bffilter'
import type { PriceSizeRow, PreviousRecordResult } from '~/types/bighold'
import type { ApiResponse } from '~/types/api'
import { parseRawData, calcTradedDiff } from '~/utils/parseRawData'
import { formatMoney, formatDateTime, formatMatchTime } from '~/utils/formatters'
import { pmarkClass, priceBgClass, tradedClass } from '~/utils/styleHelpers'

// ── 路由参数 ──
const route = useRoute()
const eventId = computed(() => Number(route.query.id) || 0)

// ── 数据获取 ──
const { data, pending, error } = useBfFilter2(eventId)

const result = computed(() => data.value?.data)
const matchInfo = computed(() => result.value?.match)
const items = computed(() => result.value?.items ?? [])

useHead({
  title: computed(() => matchInfo.value
    ? `指数提炼表 ${matchInfo.value.homeTeam}vs${matchInfo.value.guestTeam}`
    : '指数提炼表'),
})

// ── 行展开 ──
const expandedPcId = ref<number | null>(null)       // 当前记录展开
const expandedOddsPcId = ref<number | null>(null)    // LastPrice 展开

// ── 前一条记录缓存（懒加载） ──
const config = useRuntimeConfig()
const prevCache = reactive(new Map<number, PreviousRecordResult | null>())
const loadingPcId = ref<number | null>(null)
const failedPcIds = reactive(new Set<number>())

// ── RawData 解析缓存 ──
const currentParsedCache = reactive(new Map<number, PriceSizeRow[]>())
const previousParsedCache = reactive(new Map<number, PriceSizeRow[]>())

async function fetchPrevious(item: Filter2Item): Promise<PreviousRecordResult | null> {
  if (prevCache.has(item.pcId)) return prevCache.get(item.pcId) ?? null

  loadingPcId.value = item.pcId
  failedPcIds.delete(item.pcId)

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
    failedPcIds.add(item.pcId)
    return null
  }
  finally {
    if (loadingPcId.value === item.pcId) loadingPcId.value = null
  }
}

/** 切换 1x2 展开 (当前/前一条/差额) */
async function toggleExpand(item: Filter2Item) {
  if (expandedPcId.value === item.pcId) {
    expandedPcId.value = null
    return
  }
  expandedPcId.value = item.pcId
  expandedOddsPcId.value = null

  // 解析当前记录
  if (!currentParsedCache.has(item.pcId)) {
    currentParsedCache.set(item.pcId, parseRawData(item.rawData))
  }

  // 懒加载前一条记录
  if (!prevCache.has(item.pcId)) {
    await fetchPrevious(item)
  }
}

/** 切换 Odds 展开 (LastPrice) */
function toggleOddsExpand(item: Filter2Item) {
  if (expandedOddsPcId.value === item.pcId) {
    expandedOddsPcId.value = null
    return
  }
  expandedOddsPcId.value = item.pcId
  expandedPcId.value = null

  // 解析当前记录
  if (!currentParsedCache.has(item.pcId)) {
    currentParsedCache.set(item.pcId, parseRawData(item.rawData))
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

/** 行背景样式：traded diff 高亮 → 黄色 */
function rowClass(item: Filter2Item): string[] {
  const classes: string[] = ['main-row']
  if (expandedPcId.value === item.pcId || expandedOddsPcId.value === item.pcId) {
    classes.push('row-expanded')
  }
  if (item.isHighlighted) {
    classes.push('row-highlighted')
  }
  return classes
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
          <span class="page-badge">指数提炼表</span>
        </h2>
        <div class="match-meta">
          开赛时间：{{ formatMatchTime(matchInfo?.matchTime ?? '') }}
          &nbsp;|&nbsp; MarketId1: {{ matchInfo?.marketId1 }}
        </div>
      </div>

      <!-- 主表 -->
      <div class="table-wrapper">
        <table class="gridtable">
          <thead>
            <tr>
              <th>1x2</th>
              <th>Odds</th>
              <th>Amount</th>
              <th>Attr</th>
              <th>Payout</th>
              <th>PrePayout</th>
              <th>PayoutDiff</th>
              <th>Weight</th>
              <th>PreWeight</th>
              <th>WeightDiff</th>
              <th>P Mark</th>
              <th>Update Time</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="item in items" :key="item.pcId">
              <!-- 主行 -->
              <tr :class="rowClass(item)">
                <td
                  class="sel-cell"
                  :class="'sel-' + item.selection"
                  title="点击展开 Back/Lay/Traded 明细"
                  @click="toggleExpand(item)"
                >
                  <strong>{{ item.selection }}</strong>
                </td>
                <td
                  class="odds-cell"
                  title="点击展开挂牌数据"
                  @click="toggleOddsExpand(item)"
                >{{ item.lastOdds.toFixed(2) }}</td>
                <td class="num-cell">{{ formatMoney(item.tradedChange) }}</td>
                <td>{{ item.tradedAttr }}</td>
                <td :class="{ 'td-highlight': item.payoutHighlight }" class="num-cell">{{ item.payout.toFixed(0) }}</td>
                <td class="num-cell">{{ item.previousPayout.toFixed(0) }}</td>
                <td class="num-cell">{{ item.payoutDifference.toFixed(0) }}</td>
                <td :class="{ 'td-highlight': item.weightHighlight }" class="num-cell">{{ item.weight.toFixed(0) }}</td>
                <td class="num-cell">{{ item.previousWeight.toFixed(0) }}</td>
                <td class="num-cell">{{ item.weightDifference.toFixed(0) }}</td>
                <td><span :class="['pmark-badge', pmarkClass(item.pMark)]">{{ item.pMark }}</span></td>
                <td class="col-time-val">{{ formatDateTime(item.refreshTime) }}</td>
              </tr>

              <!-- 展开行：Back/Lay/Traded (当前 + 前一条 + 差额) -->
              <tr v-if="expandedPcId === item.pcId" class="expand-row">
                <td colspan="12">
                  <div class="expand-content">
                    <div class="detail-panels">
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
                        <div v-if="loadingPcId === item.pcId" class="panel-loading">
                          <span class="spinner"></span> 加载中...
                        </div>
                        <div v-else-if="failedPcIds.has(item.pcId)" class="panel-error">
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

              <!-- 展开行：赔率层（LastPrice 挂牌数据） -->
              <tr v-if="expandedOddsPcId === item.pcId" class="expand-row expand-row-odds">
                <td colspan="12">
                  <div class="expand-content">
                    <div class="detail-panels">
                      <div class="detail-panel">
                        <div class="panel-title">挂牌数据 ({{ item.selection }})</div>
                        <table v-if="getCurrentRows(item.pcId).length > 0" class="detail-table">
                          <thead>
                            <tr><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr>
                          </thead>
                          <tbody>
                            <tr v-for="row in getCurrentRows(item.pcId)" :key="'lp-' + row.price">
                              <td :class="priceBgClass(row)">{{ row.price }}</td>
                              <td :class="{ 'bg-back': row.toBack > 0 }">{{ row.toBack > 0 ? formatMoney(row.toBack) : '' }}</td>
                              <td :class="{ 'bg-lay': row.toLay > 0 }">{{ row.toLay > 0 ? formatMoney(row.toLay) : '' }}</td>
                              <td :class="tradedClass(row)">{{ row.traded > 0 ? formatMoney(row.traded) : '' }}</td>
                            </tr>
                          </tbody>
                        </table>
                        <div v-else class="panel-empty">无挂牌数据</div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>

            <tr v-if="items.length === 0">
              <td colspan="12" class="no-data">暂无数据</td>
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
  background: #2563eb;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 4px;
  vertical-align: middle;
}

/* Selection 颜色 */
.sel-主 { color: #c00; }
.sel-平 { color: #666; }
.sel-客 { color: #00c; }

.num-cell {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* 行级黄色高亮（traded diff > 3 条正值） */
.row-highlighted {
  background: #ffff00 !important;
}
.row-highlighted:hover {
  background: #ffffa8 !important;
}
</style>
