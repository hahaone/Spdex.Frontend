<script setup lang="ts">
import type { AsianHcRow, AsianTimeWindowData, AsianBigItem } from '~/types/asianbighold'
import type { PriceSizeRow } from '~/types/bighold'
import { parseRawData, calcTradedDiff } from '~/utils/parseRawData'
import { formatMoney, formatMatchTimeFull, formatPercent, formatOdds, formatDense, formatTimeWithSeconds } from '~/utils/formatters'
import { highlightClass } from '~/utils/styleHelpers'

// ── 路由参数 ──
const route = useRoute()
const eventId = computed(() => Number(route.query.id) || 0)

// ── 数据获取：使用 asianbighold API（默认 MarketId3） ──
const queryParams = computed(() => ({
  id: eventId.value,
  order: 0,
}))
const { data, pending, error, refreshing, manualRefresh } = useAsianBigHold(queryParams)

const result = computed(() => data.value?.data)
const matchInfo = computed(() => result.value?.match)
const volumeSummary = computed(() => result.value?.volumeSummary ?? [])
const bigList = computed(() => result.value?.bigList ?? [])
const holdList = computed(() => result.value?.holdList ?? [])
const odds0 = computed(() => result.value?.odds0)

// ── NBA 判断：NBA 或含 " @ " 的赛事，让球盘的 OrderIndex 与 HomeTeamId 是反的 ──
// DB 中 HomeTeam/GuestTeam 是正确的主客关系，但让球盘的 OrderIndex=1 对应的
// 实际上是 GuestTeamId 的 selection，所以显示队名时需要翻转。
// 与旧站 csc5bk2.aspx.cs SelectionView 一致：不翻转区域，只翻转队名。
const isNbaReverse = computed(() => {
  const path = matchInfo.value?.matchPath ?? ''
  return path.includes('NBA') || path.includes(' @ ')
})

// ── 页面 title（直接用 DB 的主客队名，DB 存的就是对的） ──
useHead({
  title: computed(() => matchInfo.value
    ? `篮球亚盘 ${matchInfo.value.homeTeam}vs${matchInfo.value.guestTeam}`
    : '篮球亚盘'),
})

// ── 当前窗口数据（只用第一个窗口 = "当前"） ──
const currentWindow = computed<AsianTimeWindowData | null>(() => result.value?.windows?.[0] ?? null)

// ── Home/Away 分组（不翻转区域，与旧站一致） ──
const homeRows = computed<AsianHcRow[]>(() => {
  if (!currentWindow.value) return []
  return currentWindow.value.homeGroups.flatMap(g => g.rows)
})
const awayRows = computed<AsianHcRow[]>(() => {
  if (!currentWindow.value) return []
  return currentWindow.value.awayGroups.flatMap(g => g.rows)
})

// ── 小计（不翻转，与旧站一致） ──
const homeSubtotal = computed(() => currentWindow.value?.homeSubtotal)
const awaySubtotal = computed(() => currentWindow.value?.awaySubtotal)
const allSubtotal = computed(() => currentWindow.value?.allSubtotal)

// ── TotalHold / TotalBet ratio ──
function holdBetRatio(subtotal: { grandTotalBet: number, grandTotalHold: number } | undefined | null): string {
  if (!subtotal || subtotal.grandTotalBet === 0) return ''
  return (subtotal.grandTotalHold / subtotal.grandTotalBet).toFixed(2)
}

// ── 对应标盘 ──
const odds0Display = computed(() => {
  if (!odds0.value) return ''
  const o = odds0.value
  const homeName = matchInfo.value?.homeTeam ?? '主'
  const awayName = matchInfo.value?.guestTeam ?? '客'
  return `${homeName}: ${o.homeWeight.toFixed(2)} | 平: ${o.drawWeight.toFixed(2)} | ${awayName}: ${o.awayWeight.toFixed(2)}`
})

// ── 行展开 ──
const expandedKey = ref<string | null>(null)
function rowKey(row: AsianHcRow): string { return `${row.selectionId}-${row.handicap}` }
function toggleExpand(row: AsianHcRow) {
  const key = rowKey(row)
  expandedKey.value = expandedKey.value === key ? null : key
}

// ── 大注展开 ──
const expandedBigPcId = ref<number | null>(null)
const { fetchPrevious } = useBigHoldDetail('/api/asianbighold/previous')
const bigCurrentParsedCache = reactive(new Map<number, PriceSizeRow[]>())
const bigPreviousParsedCache = reactive(new Map<number, PriceSizeRow[]>())

async function toggleBigExpand(item: AsianBigItem, expandKey: number) {
  if (expandedBigPcId.value === expandKey) { expandedBigPcId.value = null; return }
  expandedBigPcId.value = expandKey
  if (!bigCurrentParsedCache.has(expandKey) && item.rawData)
    bigCurrentParsedCache.set(expandKey, parseRawData(item.rawData))
  const prev = await fetchPrevious(item.pcId, item.marketId, item.selectionId, item.refreshTime, { handicap: item.handicap.toString() })
  if (prev?.rawData && !bigPreviousParsedCache.has(expandKey))
    bigPreviousParsedCache.set(expandKey, parseRawData(prev.rawData))
}

// ── LastPrice 解析 ──
function getLastPriceRows(row: AsianHcRow): PriceSizeRow[] {
  if (!currentWindow.value?.lastPrices) return []
  const lp = currentWindow.value.lastPrices.find(
    p => p.selectionId === row.selectionId && Math.abs(p.handicap - row.handicap) < 0.001,
  )
  if (!lp?.rawData) return []
  return parseRawData(lp.rawData)
}

// ── 显示名称：篮球统一用队名 + handicap（与旧站 SelectionView 完全一致） ──
// 先按 orderIndex 取队名，NBA 时再翻转一次（因为让球盘 OrderIndex 与 TeamId 是反的）
function selectionView(row: AsianHcRow): string {
  let name = row.orderIndex === 1 ? matchInfo.value?.homeTeam : matchInfo.value?.guestTeam
  if (isNbaReverse.value)
    name = name === matchInfo.value?.homeTeam ? matchInfo.value?.guestTeam : matchInfo.value?.homeTeam
  return `${name} ${row.handicap >= 0 ? '+' : ''}${row.handicap.toFixed(1)}`
}

// ── 高亮 ──
function maxBetCls(row: AsianHcRow) { return row.maxBetHighlight >= 2 ? 'hl-bright' : row.maxBetHighlight >= 1 ? 'hl-light' : '' }
function totalBetCls(row: AsianHcRow) { return row.totalBetHighlight >= 2 ? 'hl-bright' : row.totalBetHighlight >= 1 ? 'hl-light' : '' }
function maxHoldCls(row: AsianHcRow) { return row.maxHoldHighlight >= 2 ? 'hl-bright' : row.maxHoldHighlight >= 1 ? 'hl-light' : '' }
function totalHoldCls(row: AsianHcRow) { return row.totalHoldHighlight >= 2 ? 'hl-bright' : row.totalHoldHighlight >= 1 ? 'hl-light' : '' }

// ── 大注/Hold 列表用队名替换后端的"主"/"客"标签 ──
// 大注/Hold 不在翻转区域内，NBA 时需要翻转队名（与旧站 SelectionView 一致）
function bigSelectionView(item: AsianBigItem): string {
  let name = item.orderIndex === 1 ? matchInfo.value?.homeTeam : matchInfo.value?.guestTeam
  if (isNbaReverse.value)
    name = name === matchInfo.value?.homeTeam ? matchInfo.value?.guestTeam : matchInfo.value?.homeTeam
  const hc = item.handicap
  return `${name} ${hc >= 0 ? '+' : ''}${hc.toFixed(2)}`
}

// ── 分时段汇总（前4个） ──
const volumeSummary4 = computed(() => volumeSummary.value.slice(0, 4))
</script>

<template>
  <div class="bk-detail-page">
    <div v-if="pending" class="loading">加载中...</div>
    <div v-else-if="error" class="error-msg">加载失败：{{ error.message }}</div>
    <template v-if="result && matchInfo">
      <div class="page-header">
        <h5>{{ matchInfo?.homeTeam }} vs {{ matchInfo?.guestTeam }}
          <span>比赛时间: [{{ formatMatchTimeFull(matchInfo.matchTime) }}]</span>
        </h5>
      </div>
      <div class="section-title">
        <h4>当前/临场 数据 对应标盘：{{ odds0Display }}</h4>
        <button class="refresh-btn" :disabled="refreshing" @click="manualRefresh">
          <span class="refresh-icon" :class="{ spinning: refreshing }">&#8635;</span> 刷新
        </button>
      </div>

      <!-- ═══ HOME 区域 ═══ -->
      <div v-if="homeRows.length > 0" class="side-section">
        <div class="table-wrap">
          <table class="grid-table">
            <thead>
              <tr>
                <th>Handicap</th><th>Latest Price</th><th>Dense</th><th>Dense%</th>
                <th>MaxBet</th><th>MaxBet Price</th><th>Attribute</th><th>Time Mark</th>
                <th>Total bet</th><th>Max hold</th><th>Total hold</th><th>Max/total</th><th>Rank totalbet</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in homeRows" :key="rowKey(row)">
                <tr class="data-row" @click="toggleExpand(row)">
                  <td class="clickable" :class="{ 'row-highlight': row.latestPriceHighlight }"><span :class="{ 'neg-hc': row.isNegativeHandicap }">{{ selectionView(row) }}</span></td>
                  <td>{{ formatOdds(row.odds) }}</td><td>{{ formatDense(row.dense) }}</td><td>{{ formatPercent(row.densePercent) }}</td>
                  <td :class="maxBetCls(row)">{{ formatMoney(row.maxBet) }}</td><td>{{ formatOdds(row.maxBetPrice) }}</td>
                  <td>{{ row.maxBetAttr }}</td><td>{{ row.timeMark }}</td>
                  <td :class="totalBetCls(row)">{{ formatMoney(row.totalBet) }}</td>
                  <td :class="maxHoldCls(row)">{{ formatMoney(row.maxHold) }}</td>
                  <td :class="totalHoldCls(row)">{{ formatMoney(row.totalHold) }}</td>
                  <td :class="{ 'max-total-hl': row.maxTotalHighlight }">{{ formatPercent(row.maxTotal) }}</td>
                  <td :class="{ 'rank-hl': row.rankHighlight }">{{ row.rankTotalBet }}</td>
                </tr>
                <tr v-if="expandedKey === rowKey(row)" class="expand-row">
                  <td colspan="13">
                    <table class="ex-table"><thead><tr><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
                      <tbody><tr v-for="(ps, i) in getLastPriceRows(row)" :key="i">
                        <td :class="{ 'back-bg': ps.toBack > 0, 'lay-bg': ps.toLay > 0 && ps.toBack === 0 }">{{ ps.price }}</td>
                        <td :class="{ 'back-bg': ps.toBack > 0 }">{{ ps.toBack > 0 ? `HK$ ${formatMoney(ps.toBack)}` : '' }}</td>
                        <td :class="{ 'lay-bg': ps.toLay > 0 }">{{ ps.toLay > 0 ? `HK$ ${formatMoney(ps.toLay)}` : '' }}</td>
                        <td><span :class="highlightClass(ps.tradedHighlight)">{{ ps.traded > 0 ? `HK$ ${formatMoney(ps.traded)}` : '' }}</span></td>
                      </tr></tbody>
                    </table>
                  </td>
                </tr>
              </template>
              <!-- Home 小计 -->
              <tr v-if="homeSubtotal" class="subtotal-row subtotal-home">
                <td colspan="8" class="subtotal-label">小计</td>
                <td>{{ formatMoney(homeSubtotal.grandTotalBet) }}</td>
                <td>{{ formatMoney(homeSubtotal.grandMaxHold) }}</td>
                <td>{{ formatMoney(homeSubtotal.grandTotalHold) }}</td>
                <td v-if="holdBetRatio(homeSubtotal)" colspan="2" class="ratio-cell">TH/TB: {{ holdBetRatio(homeSubtotal) }}</td>
                <td v-else colspan="2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ═══ AWAY 区域 ═══ -->
      <div v-if="awayRows.length > 0" class="side-section">
        <div class="table-wrap">
          <table class="grid-table">
            <thead>
              <tr>
                <th>Handicap</th><th>Latest Price</th><th>Dense</th><th>Dense%</th>
                <th>MaxBet</th><th>MaxBet Price</th><th>Attribute</th><th>Time Mark</th>
                <th>Total bet</th><th>Max hold</th><th>Total hold</th><th>Max/total</th><th>Rank totalbet</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in awayRows" :key="rowKey(row)">
                <tr class="data-row" @click="toggleExpand(row)">
                  <td class="clickable" :class="{ 'row-highlight': row.latestPriceHighlight }"><span :class="{ 'neg-hc': row.isNegativeHandicap }">{{ selectionView(row) }}</span></td>
                  <td>{{ formatOdds(row.odds) }}</td><td>{{ formatDense(row.dense) }}</td><td>{{ formatPercent(row.densePercent) }}</td>
                  <td :class="maxBetCls(row)">{{ formatMoney(row.maxBet) }}</td><td>{{ formatOdds(row.maxBetPrice) }}</td>
                  <td>{{ row.maxBetAttr }}</td><td>{{ row.timeMark }}</td>
                  <td :class="totalBetCls(row)">{{ formatMoney(row.totalBet) }}</td>
                  <td :class="maxHoldCls(row)">{{ formatMoney(row.maxHold) }}</td>
                  <td :class="totalHoldCls(row)">{{ formatMoney(row.totalHold) }}</td>
                  <td :class="{ 'max-total-hl': row.maxTotalHighlight }">{{ formatPercent(row.maxTotal) }}</td>
                  <td :class="{ 'rank-hl': row.rankHighlight }">{{ row.rankTotalBet }}</td>
                </tr>
                <tr v-if="expandedKey === rowKey(row)" class="expand-row">
                  <td colspan="13">
                    <table class="ex-table"><thead><tr><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
                      <tbody><tr v-for="(ps, i) in getLastPriceRows(row)" :key="i">
                        <td :class="{ 'back-bg': ps.toBack > 0, 'lay-bg': ps.toLay > 0 && ps.toBack === 0 }">{{ ps.price }}</td>
                        <td :class="{ 'back-bg': ps.toBack > 0 }">{{ ps.toBack > 0 ? `HK$ ${formatMoney(ps.toBack)}` : '' }}</td>
                        <td :class="{ 'lay-bg': ps.toLay > 0 }">{{ ps.toLay > 0 ? `HK$ ${formatMoney(ps.toLay)}` : '' }}</td>
                        <td><span :class="highlightClass(ps.tradedHighlight)">{{ ps.traded > 0 ? `HK$ ${formatMoney(ps.traded)}` : '' }}</span></td>
                      </tr></tbody>
                    </table>
                  </td>
                </tr>
              </template>
              <!-- Away 小计 -->
              <tr v-if="awaySubtotal" class="subtotal-row subtotal-away">
                <td colspan="8" class="subtotal-label">小计</td>
                <td>{{ formatMoney(awaySubtotal.grandTotalBet) }}</td>
                <td>{{ formatMoney(awaySubtotal.grandMaxHold) }}</td>
                <td>{{ formatMoney(awaySubtotal.grandTotalHold) }}</td>
                <td v-if="holdBetRatio(awaySubtotal)" colspan="2" class="ratio-cell">TH/TB: {{ holdBetRatio(awaySubtotal) }}</td>
                <td v-else colspan="2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 无数据 -->
      <div v-if="homeRows.length === 0 && awayRows.length === 0" class="no-data">暂无数据</div>

      <!-- 统计行 (Avg, X2, X3) -->
      <div v-if="allSubtotal" class="stats-section">
        <table class="grid-table stats-table">
          <thead>
            <tr><th></th><th>MaxBet</th><th colspan="3"></th><th>TotalBet</th><th>MaxHold</th><th>TotalHold</th></tr>
          </thead>
          <tbody>
            <tr class="stat-row"><td>Average</td><td>{{ formatMoney(allSubtotal.avr) }}</td><td colspan="3"></td>
              <td>{{ formatMoney(allSubtotal.totalBetSubTotal) }}</td><td>{{ formatMoney(allSubtotal.maxHoldSubTotal) }}</td><td>{{ formatMoney(allSubtotal.totalHoldSubTotal) }}</td></tr>
            <tr class="stat-row"><td>X2</td><td><strong>{{ formatMoney(allSubtotal.x2) }}</strong></td><td colspan="3"></td>
              <td>{{ formatMoney(allSubtotal.totalBetX2) }}</td><td>{{ formatMoney(allSubtotal.maxHoldX2) }}</td><td>{{ formatMoney(allSubtotal.totalHoldX2) }}</td></tr>
            <tr class="stat-row"><td>X3</td><td><strong>{{ formatMoney(allSubtotal.x3) }}</strong></td><td colspan="3"></td>
              <td>{{ formatMoney(allSubtotal.totalBetX3) }}</td><td>{{ formatMoney(allSubtotal.maxHoldX3) }}</td><td>{{ formatMoney(allSubtotal.totalHoldX3) }}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 分时段成交汇总 -->
      <div v-if="volumeSummary4.length > 0" class="section">
        <h4>分时段成交汇总</h4>
        <table class="grid-table small-table">
          <thead><tr><th>时间节点</th><th>{{ matchInfo?.homeTeam ?? 'Home' }}</th><th>{{ matchInfo?.guestTeam ?? 'Away' }}</th></tr></thead>
          <tbody><tr v-for="v in volumeSummary4" :key="v.timing"><td>{{ v.timing }}</td><td>{{ formatMoney(v.homeAmount) }}</td><td>{{ formatMoney(v.awayAmount) }}</td></tr></tbody>
        </table>
      </div>

      <!-- 大注TOP10 -->
      <div v-if="bigList.length > 0" class="section">
        <h4>大注TOP10</h4>
        <table class="grid-table">
          <thead><tr><th>Handicap</th><th>Odds</th><th>TradedChange</th><th>Attr</th><th>Payout</th><th>Per</th><th>Weight</th><th>P Mark</th><th>Update Time</th></tr></thead>
          <tbody>
            <template v-for="item in bigList.slice(0, 10)" :key="item.pcId">
              <tr class="data-row" @click="toggleBigExpand(item, item.pcId)">
                <td class="clickable"><strong>{{ bigSelectionView(item) }}</strong></td>
                <td>{{ formatOdds(item.lastOdds) }}</td><td>{{ formatMoney(item.tradedChange) }}</td><td>{{ item.tradedAttr }}</td>
                <td>{{ Math.round(item.payout) }}</td><td>{{ formatPercent(item.per / 100) }}</td><td>{{ Math.round(item.weight) }}</td>
                <td>{{ item.pMark }}</td><td>{{ formatTimeWithSeconds(item.refreshTime) }}</td>
              </tr>
              <tr v-if="expandedBigPcId === item.pcId" class="expand-row">
                <td colspan="9">
                  <div class="expand-panels">
                    <div class="expand-panel"><span class="panel-label">当前记录</span>
                      <table class="ex-table"><thead><tr><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
                        <tbody><tr v-for="(ps, i) in bigCurrentParsedCache.get(item.pcId) ?? []" :key="i">
                          <td :class="{ 'back-bg': ps.toBack > 0, 'lay-bg': ps.toLay > 0 && ps.toBack === 0 }">{{ ps.price }}</td>
                          <td :class="{ 'back-bg': ps.toBack > 0 }">{{ ps.toBack > 0 ? `HK$ ${formatMoney(ps.toBack)}` : '' }}</td>
                          <td :class="{ 'lay-bg': ps.toLay > 0 }">{{ ps.toLay > 0 ? `HK$ ${formatMoney(ps.toLay)}` : '' }}</td>
                          <td>{{ ps.traded > 0 ? `HK$ ${formatMoney(ps.traded)}` : '' }}</td>
                        </tr></tbody>
                      </table>
                    </div>
                    <div class="expand-panel"><span class="panel-label">前一条记录</span>
                      <table class="ex-table"><thead><tr><th>价位</th><th>买</th><th>卖</th><th>成交</th></tr></thead>
                        <tbody><tr v-for="(ps, i) in bigPreviousParsedCache.get(item.pcId) ?? []" :key="i">
                          <td :class="{ 'back-bg': ps.toBack > 0, 'lay-bg': ps.toLay > 0 && ps.toBack === 0 }">{{ ps.price }}</td>
                          <td :class="{ 'back-bg': ps.toBack > 0 }">{{ ps.toBack > 0 ? `HK$ ${formatMoney(ps.toBack)}` : '' }}</td>
                          <td :class="{ 'lay-bg': ps.toLay > 0 }">{{ ps.toLay > 0 ? `HK$ ${formatMoney(ps.toLay)}` : '' }}</td>
                          <td>{{ ps.traded > 0 ? `HK$ ${formatMoney(ps.traded)}` : '' }}</td>
                        </tr></tbody>
                      </table>
                    </div>
                    <div class="expand-panel"><span class="panel-label">成交差额</span>
                      <table class="ex-table"><thead><tr><th>价位</th><th>成交</th></tr></thead>
                        <tbody><tr v-for="(ps, i) in calcTradedDiff(bigCurrentParsedCache.get(item.pcId) ?? [], bigPreviousParsedCache.get(item.pcId) ?? [])" :key="i">
                          <td>{{ ps.price }}</td><td>{{ ps.traded !== 0 ? `HK$ ${formatMoney(ps.traded)}` : '' }}</td>
                        </tr></tbody>
                      </table>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Hold TOP10 -->
      <div v-if="holdList.length > 0" class="section">
        <h4>Hold TOP10</h4>
        <table class="grid-table">
          <thead><tr><th>Handicap</th><th>Odds</th><th>TradedChange</th><th>Attr</th><th>Top Hold</th><th>Payout</th><th>Per</th><th>Weight</th><th>P Mark</th><th>Update Time</th></tr></thead>
          <tbody>
            <tr v-for="item in holdList.slice(0, 10)" :key="item.pcId">
              <td>{{ bigSelectionView(item) }}</td><td>{{ formatOdds(item.lastOdds) }}</td><td>{{ formatMoney(item.tradedChange) }}</td><td>{{ item.tradedAttr }}</td>
              <td>{{ formatMoney(item.hold) }}</td><td>{{ Math.round(item.payout) }}</td><td>{{ formatPercent(item.per / 100) }}</td><td>{{ Math.round(item.weight) }}</td>
              <td>{{ item.pMark }}</td><td>{{ formatTimeWithSeconds(item.refreshTime) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.bk-detail-page { max-width: 100%; padding: 1rem; }
.page-header h5 { font-size: 1.2em; margin-bottom: 0.5rem; }
.page-header h5 span { font-weight: normal; color: #666; margin-left: 1rem; }
.section-title { display: flex; align-items: center; gap: 1rem; padding: 10px; margin-top: 20px; border-top: 2px solid #ccc; }
.section-title h4 { font-size: 1.4em; color: #ff0000; font-weight: bold; margin: 0; }
.refresh-btn { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.4rem 0.7rem; border: 1px solid #d1d5db; border-radius: 4px; background: #fff; font-size: 0.88rem; cursor: pointer; }
.refresh-btn:hover:not(:disabled) { background: #f0fdf4; } .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.refresh-icon { font-size: 1rem; display: inline-block; } .refresh-icon.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.section { margin-top: 2rem; }
.section h4 { padding: 10px; font-size: 1.4em; color: #ff0000; font-weight: bold; border-top: 2px solid #ccc; }
.side-section { margin-top: 1rem; }
.table-wrap { overflow-x: auto; }
.grid-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.grid-table th { padding: 6px 8px; background: #f5f5f5; border: 1px solid #ddd; text-align: left; font-weight: 600; white-space: nowrap; }
.grid-table td { padding: 4px 8px; border: 1px solid #eee; white-space: nowrap; }
.grid-table tbody tr:hover { background: #f8f8f8; }
.small-table { max-width: 400px; }
.stats-table { max-width: 700px; margin-top: 1rem; }
.stats-section { margin-top: 1rem; }
.data-row { cursor: pointer; } .clickable { cursor: pointer; } .neg-hc { color: red; }
.hl-light { background: #FFFFA8; } .hl-bright { background: #ffff00; }
.max-total-hl { color: #ff0000; font-weight: bold; } .rank-hl { color: #ff0000; font-weight: bold; }
.row-highlight { background: #ffff00; }
.subtotal-row td { font-weight: bold; }
.subtotal-home { background: #e0f0ff; } .subtotal-home td { background: #e0f0ff; }
.subtotal-away { background: #e0f0ff; } .subtotal-away td { background: #e0f0ff; }
.subtotal-label { text-align: right !important; padding-right: 10px !important; color: #333; }
.ratio-cell { font-weight: 600; color: #555; }
.stat-row td { background: #ffffa8; }
.no-data { text-align: center; color: #999; padding: 2rem; }
.expand-row td { padding: 8px; background: #fafafa; }
.expand-panels { display: flex; gap: 1rem; flex-wrap: wrap; }
.expand-panel { flex: 1; min-width: 200px; } .panel-label { font-weight: 600; font-size: 0.85rem; display: block; margin-bottom: 4px; }
.ex-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.ex-table th { padding: 3px 6px; background: #e8e8e8; border: 1px solid #ddd; }
.ex-table td { padding: 2px 6px; border: 1px solid #eee; }
.back-bg { background: #A6D8FF; } .lay-bg { background: #FAC9D1; }
.loading { text-align: center; padding: 2rem; color: #666; }
.error-msg { text-align: center; padding: 2rem; color: red; }
</style>
