<script setup lang="ts">
import type { MatchListItem, MatchListResult } from '~/types/match'
import type { LiveMatchOddsEventItem, LiveMatchOddsTopTradeSummary } from '~/types/live'
import { formatBfAmount, formatDateCN, formatMatchTimeSlash, formatMoney } from '~/utils/formatters'

const { isJcOnly } = useAuth()

const {
  pinnedItems,
  pinnedEventIds,
  isPinned,
  togglePin,
  refreshPinnedData,
  purgeExpired,
  clearAll: clearPinnedMatches,
} = usePinnedMatches()

const selectedDay = ref<'today' | 'yesterday'>('today')
const selectedLeague = ref('')
const liveStatus = ref<'running' | 'finished'>('running')
const jcOnly = ref(isJcOnly.value)
const currentPage = ref(1)
const pageSize = 100

if (isJcOnly.value) {
  jcOnly.value = true
}

function dateStringByOffset(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const selectedDate = computed(() => selectedDay.value === 'today' ? dateStringByOffset(0) : dateStringByOffset(-1))

const queryParams = computed(() => ({
  date: selectedDate.value,
  league: selectedLeague.value || undefined,
  status: liveStatus.value === 'running' ? 'started' : 'all',
  jc: (jcOnly.value || isJcOnly.value) ? 1 : undefined,
  page: currentPage.value,
  pageSize,
}))

const { data: response, status, refreshing, manualRefresh } = useMatchList(queryParams)
const isMatchLoading = computed(() => status.value === 'pending' || refreshing.value)
const result = computed<MatchListResult | null>(() => response.value?.data ?? null)
const apiMatches = computed(() => result.value?.items ?? [])
const leagues = computed(() => result.value?.leagues ?? [])

watch(apiMatches, (items) => {
  if (items.length > 0) {
    refreshPinnedData(items)
    purgeExpired()
  }
})

function isFinishedMatch(item: MatchListItem): boolean {
  const finalScore = item.match.final?.trim()
  if (finalScore && finalScore !== '-') return true

  const startedAt = new Date(item.match.matchTime).getTime()
  if (!Number.isFinite(startedAt)) return false
  return Date.now() - startedAt > 2.5 * 60 * 60 * 1000
}

const apiVisibleMatches = computed(() => {
  if (liveStatus.value === 'finished') {
    return apiMatches.value.filter(isFinishedMatch)
  }
  return apiMatches.value
})

const matches = computed(() => {
  const apiItems = apiVisibleMatches.value
  const ids = pinnedEventIds.value
  if (ids.size === 0) return apiItems

  const apiPinned: typeof apiItems = []
  const apiNormal: typeof apiItems = []
  const apiIdSet = new Set<number>()
  for (const item of apiItems) {
    apiIdSet.add(item.match.eventId)
    if (ids.has(item.match.eventId)) apiPinned.push(item)
    else apiNormal.push(item)
  }

  const extraPinned = pinnedItems.value.filter(item => !apiIdSet.has(item.match.eventId))
  return [...apiPinned, ...extraPinned, ...apiNormal]
})

const liveMarkets = computed(() => matches.value.map(item => ({
  eventId: item.match.eventId,
  marketId: item.match.marketId1,
})))
const liveTrades = useLiveMatchOddsTopTrades(liveMarkets)
const liveByEventId = computed(() => liveTrades.byEventId.value)
const missingLiveEventIds = computed(() => new Set(
  liveTrades.data.value?.missingEventIds.map(id => Number(id)).filter(Number.isFinite) ?? [],
))
const pendingLiveEventIds = computed(() => new Set(
  liveTrades.data.value?.pendingEventIds.map(id => Number(id)).filter(Number.isFinite) ?? [],
))
const isInitialLoading = computed(() => isMatchLoading.value && response.value == null)
const isRefreshing = computed(() => refreshing.value)

const expandedEventIds = ref<Set<number>>(new Set())
const flashEventIds = ref<Set<number>>(new Set())
const previousSignatures = ref<Map<number, string>>(new Map())
let matchRefreshTimer: ReturnType<typeof setInterval> | null = null
let liveTradeRefreshTimer: ReturnType<typeof setInterval> | null = null
type RefreshOptions = { silent?: boolean } | PointerEvent

function normalizeRefreshOptions(options?: RefreshOptions): { silent?: boolean } {
  return options && 'silent' in options ? options : {}
}

watch(
  () => liveTrades.data.value?.timestamp,
  () => {
    const next = new Map(previousSignatures.value)
    for (const item of liveTrades.data.value?.items ?? []) {
      const eventId = Number(item.eventId)
      if (!Number.isFinite(eventId) || !item.topSignature) continue

      const previous = next.get(eventId)
      if (previous && previous !== item.topSignature) {
        flashExpandButton(eventId)
      }
      next.set(eventId, item.topSignature)
    }
    previousSignatures.value = next
  },
)

watch(liveMarkets, () => {
  liveTrades.refresh({ silent: liveTrades.data.value != null })
}, { immediate: true })

onMounted(() => {
  matchRefreshTimer = setInterval(() => {
    refreshAll({ silent: true })
  }, 30_000)

  liveTradeRefreshTimer = setInterval(() => {
    if (document.visibilityState === 'hidden') {
      return
    }

    liveTrades.refresh({ silent: true })
  }, 5_000)
})

onBeforeUnmount(() => {
  if (matchRefreshTimer) {
    clearInterval(matchRefreshTimer)
    matchRefreshTimer = null
  }

  if (liveTradeRefreshTimer) {
    clearInterval(liveTradeRefreshTimer)
    liveTradeRefreshTimer = null
  }
})

async function refreshAll(options?: RefreshOptions) {
  const refreshOptions = normalizeRefreshOptions(options)
  await manualRefresh(refreshOptions)
  await nextTick()
  await liveTrades.refresh(refreshOptions)
}

function flashExpandButton(eventId: number) {
  flashEventIds.value = new Set([...flashEventIds.value, eventId])
  setTimeout(() => {
    const next = new Set(flashEventIds.value)
    next.delete(eventId)
    flashEventIds.value = next
  }, 1000)
}

function setDay(day: 'today' | 'yesterday') {
  selectedDay.value = day
  selectedLeague.value = ''
  currentPage.value = 1
  clearPinnedMatches()
}

function setStatus(value: 'running' | 'finished') {
  liveStatus.value = value
  selectedLeague.value = ''
  currentPage.value = 1
}

function onLeagueChange(value: string) {
  selectedLeague.value = value
  currentPage.value = 1
}

function toggleJcOnly() {
  if (isJcOnly.value) return
  jcOnly.value = !jcOnly.value
  selectedLeague.value = ''
  currentPage.value = 1
}

function toggleExpanded(eventId: number) {
  const next = new Set(expandedEventIds.value)
  if (next.has(eventId)) next.delete(eventId)
  else next.add(eventId)
  expandedEventIds.value = next
}

function isExpanded(eventId: number): boolean {
  return expandedEventIds.value.has(eventId)
}

function shouldFlash(eventId: number): boolean {
  return flashEventIds.value.has(eventId)
}

function getLiveItem(item: MatchListItem): LiveMatchOddsEventItem | undefined {
  return liveByEventId.value.get(item.match.eventId)
}

function liveEmptyText(item: MatchListItem): string {
  if (liveTrades.error.value) return '现场成交加载失败，等待下次自动刷新'
  if (liveTrades.loading.value) return '现场成交加载中...'
  if (pendingLiveEventIds.value.has(item.match.eventId)) return '现场成交加载中...'
  if (missingLiveEventIds.value.has(item.match.eventId)) return '未匹配 Betfair Match Odds'
  return '暂无现场成交'
}

function runnerLabel(trade: LiveMatchOddsTopTradeSummary | null | undefined, item: MatchListItem): string {
  if (!trade) return '-'
  const selectionId = Number(trade.selectionId)
  if (selectionId === item.match.homeTeamId) return '主'
  if (selectionId === 58805) return '平'
  if (selectionId === item.match.guestTeamId) return '客'
  return trade.runnerName || trade.selectionId || '-'
}

function sideLabel(sideHint: string | null | undefined): string {
  if (sideHint === 'backPressure') return '买向'
  if (sideHint === 'layPressure') return '卖向'
  return '-'
}

function directionMark(direction: string | null | undefined): string {
  if (direction === 'up') return '↑'
  if (direction === 'down') return '↓'
  return ''
}

function formatPriceMove(trade: LiveMatchOddsTopTradeSummary | null | undefined): string {
  if (!trade) return '-'
  const to = trade.priceTo ?? trade.tradedPrice
  if (!to) return '-'
  if (trade.priceFrom && trade.priceFrom !== to) {
    return `${trade.priceFrom.toFixed(2)} → ${to.toFixed(2)} ${directionMark(trade.priceDirection)}`
  }
  return `${to.toFixed(2)} ${directionMark(trade.priceDirection)}`
}

function formatTradeTime(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function formatBfMaxBetSummary(item: MatchListItem): string {
  if (!item.bfMaxBet) return '-'
  const amount = formatMoney(item.bfMaxBet)
  const pct = item.bfMaxBetPercent.toFixed(0)
  const attr = item.bfMaxBetAttr || '-'
  const pmark = item.bfPMark ? `,${item.bfPMark}` : ''
  const selection = item.bfMaxBetSelection || '-'
  return `${amount} (${pct}%,${attr}${pmark}) ${selection}`
}

function formatLiveSummary(live: LiveMatchOddsEventItem | undefined, item: MatchListItem): string {
  const trade = live?.maxTopTrade
  if (!trade) return '-'
  return `${formatMoney(trade.amount)} ${sideLabel(trade.sideHint)} ${runnerLabel(trade, item)} ${formatPriceMove(trade)}`
}
</script>

<template>
  <div class="live-page">
    <div class="filter-bar">
      <div class="filter-group status-group">
        <button :class="['status-btn', { active: liveStatus === 'running' }]" @click="setStatus('running')">
          进行中
        </button>
        <button :class="['status-btn', { active: liveStatus === 'finished' }]" @click="setStatus('finished')">
          已完场
        </button>
      </div>

      <div class="filter-group status-group">
        <button :class="['status-btn', { active: selectedDay === 'today' }]" @click="setDay('today')">
          今日
        </button>
        <button :class="['status-btn', { active: selectedDay === 'yesterday' }]" @click="setDay('yesterday')">
          昨日
        </button>
      </div>

      <div class="filter-group">
        <label>联赛</label>
        <select :value="selectedLeague" @change="onLeagueChange(($event.target as HTMLSelectElement).value)">
          <option value="">
            全部
          </option>
          <option v-for="lg in leagues" :key="lg" :value="lg">
            {{ lg }}
          </option>
        </select>
      </div>

      <button
        v-if="!isJcOnly"
        :class="['jc-btn', { active: jcOnly }]"
        @click="toggleJcOnly"
      >
        竞彩
      </button>

      <button class="refresh-btn" :disabled="isInitialLoading" @click="refreshAll">
        <span class="refresh-icon" :class="{ spinning: isInitialLoading || isRefreshing }">&#8635;</span>
        刷新
      </button>

      <div class="filter-info">
        <span class="date-text">{{ formatDateCN(selectedDate) }}</span>
        <span v-if="liveTrades.error.value" class="error-text">{{ liveTrades.error.value }}</span>
        <span v-else class="badge count">{{ matches.length }} 场赛事</span>
      </div>
    </div>

    <div class="table-wrap" :class="{ 'is-loading': isInitialLoading }">
      <div v-if="isInitialLoading" class="loading-overlay">
        <div class="loading-spinner" />
        <span>数据加载中...</span>
      </div>

      <table class="live-table">
        <thead>
          <tr>
            <th class="col-pin">关注</th>
            <th class="col-league">联赛</th>
            <th class="col-time">时间</th>
            <th class="col-teams">球队</th>
            <th class="col-price">价格</th>
            <th class="col-max">标盘最大单</th>
            <th class="col-money">成交</th>
            <th class="col-index">必指</th>
            <th class="col-live">现场成交</th>
            <th class="col-action" />
          </tr>
        </thead>
        <tbody>
          <template v-for="item in matches" :key="item.match.eventId">
            <tr class="match-row">
              <td>
                <button class="pin-btn" :class="{ pinned: isPinned(item.match.eventId) }" @click="togglePin(item)">
                  ★
                </button>
              </td>
              <td class="league-cell">{{ item.match.sortName }}</td>
              <td>{{ formatMatchTimeSlash(item.match.matchTime) }}</td>
              <td class="teams-cell">
                <strong>{{ item.match.homeTeam }}</strong>
                <span>v</span>
                <strong>{{ item.match.guestTeam }}</strong>
              </td>
              <td class="price-cell">
                <span>{{ item.bfMaxBetOdds ? item.bfMaxBetOdds.toFixed(2) : '-' }}</span>
              </td>
              <td class="max-cell">{{ formatBfMaxBetSummary(item) }}</td>
              <td class="money-cell">{{ formatBfAmount(item.bfAmount) }}</td>
              <td class="index-cell">-</td>
              <td class="live-cell">{{ formatLiveSummary(getLiveItem(item), item) }}</td>
              <td>
                <button
                  :class="['expand-btn', { open: isExpanded(item.match.eventId), flash: shouldFlash(item.match.eventId) }]"
                  @click="toggleExpanded(item.match.eventId)"
                >
                  {{ isExpanded(item.match.eventId) ? '⌃' : '⌄' }}
                </button>
              </td>
            </tr>
            <tr v-if="isExpanded(item.match.eventId)" class="detail-row">
              <td colspan="10">
                <table class="top-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>时间</th>
                      <th>选项</th>
                      <th>方向</th>
                      <th>价格</th>
                      <th>金额</th>
                      <th>成交价位</th>
                      <th>Back/Lay</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="trade in getLiveItem(item)?.topTrades ?? []"
                      :key="trade.key"
                      :class="{ latest: trade.key === getLiveItem(item)?.latestTopTradeKey }"
                    >
                      <td>{{ trade.rank }}</td>
                      <td>{{ formatTradeTime(trade.timestamp) }}</td>
                      <td>{{ runnerLabel(trade, item) }}</td>
                      <td>{{ sideLabel(trade.sideHint) }}</td>
                      <td>{{ formatPriceMove(trade) }}</td>
                      <td>{{ formatMoney(trade.amount) }}</td>
                      <td>{{ trade.tradedPrice ? trade.tradedPrice.toFixed(2) : '-' }}</td>
                      <td>{{ trade.bestBackPrice?.toFixed(2) ?? '-' }} / {{ trade.bestLayPrice?.toFixed(2) ?? '-' }}</td>
                    </tr>
                    <tr v-if="(getLiveItem(item)?.topTrades?.length ?? 0) === 0">
                      <td colspan="8" class="empty-cell">{{ liveEmptyText(item) }}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.live-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e3e6ec;
  border-radius: 8px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-size: 13px;
  color: #596579;
}

select {
  height: 34px;
  border: 1px solid #d7dce5;
  border-radius: 6px;
  padding: 0 30px 0 10px;
  color: #394255;
  background: #fff;
}

.status-group {
  gap: 0;
  border: 1px solid #cdd4df;
  border-radius: 6px;
  overflow: hidden;
}

.status-btn,
.jc-btn,
.refresh-btn {
  height: 34px;
  border: 0;
  background: #fff;
  color: #516078;
  padding: 0 16px;
  font-weight: 600;
  cursor: pointer;
}

.status-btn + .status-btn {
  border-left: 1px solid #cdd4df;
}

.status-btn.active,
.jc-btn.active {
  background: #2f56c5;
  color: #fff;
}

.jc-btn,
.refresh-btn {
  border: 1px solid #cdd4df;
  border-radius: 6px;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.refresh-btn:disabled {
  opacity: 0.65;
  cursor: default;
}

.refresh-icon.spinning {
  animation: spin 0.8s linear infinite;
}

.filter-info {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #6d7890;
  font-size: 13px;
}

.badge.count {
  color: #2f56c5;
  background: #e8efff;
  padding: 4px 12px;
  border-radius: 999px;
  font-weight: 700;
}

.error-text {
  color: #c73737;
}

.table-wrap {
  position: relative;
  overflow-x: auto;
  background: #fff;
  border: 1px solid #e3e6ec;
  border-radius: 8px;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.72);
  color: #4d5a70;
}

.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #d7dce5;
  border-top-color: #2f56c5;
  border-radius: 999px;
  animation: spin 0.8s linear infinite;
}

.live-table,
.top-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1180px;
}

th {
  height: 40px;
  padding: 0 10px;
  background: #f4f6f9;
  color: #344156;
  font-size: 13px;
  text-align: left;
  white-space: nowrap;
  border-bottom: 1px solid #dde3ec;
}

td {
  padding: 10px;
  color: #2f3746;
  font-size: 13px;
  border-top: 1px solid #edf0f5;
  white-space: nowrap;
}

.match-row:nth-child(4n + 1) td {
  background: #fbfcfe;
}

.pin-btn {
  border: 0;
  background: transparent;
  color: #c7ccd5;
  font-size: 18px;
  cursor: pointer;
}

.pin-btn.pinned {
  color: #f3b91b;
}

.league-cell {
  color: #596579;
  font-weight: 700;
}

.teams-cell {
  display: flex;
  gap: 8px;
  align-items: center;
}

.teams-cell span {
  color: #8a94a7;
}

.price-cell,
.money-cell,
.index-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.max-cell,
.live-cell {
  font-weight: 700;
}

.expand-btn {
  width: 28px;
  height: 28px;
  border: 1px solid #cfd6e2;
  border-radius: 6px;
  background: #fff;
  color: #40506a;
  cursor: pointer;
}

.expand-btn.open {
  background: #eef3ff;
  color: #2f56c5;
}

.expand-btn.flash {
  animation: flash 1s ease-out;
}

.detail-row > td {
  padding: 0;
  background: #f8fafc;
}

.top-table {
  min-width: 960px;
}

.top-table th {
  height: 34px;
  background: #eef2f7;
  font-size: 12px;
}

.top-table td {
  background: #fff;
  font-variant-numeric: tabular-nums;
}

.top-table tr.latest td {
  font-weight: 800;
  background: #fff7df;
}

.empty-cell {
  text-align: center;
  color: #7c8799;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes flash {
  0% {
    background: #ffe08a;
    border-color: #f0b429;
  }
  100% {
    background: #fff;
    border-color: #cfd6e2;
  }
}

@media (max-width: 768px) {
  .filter-info {
    width: 100%;
    margin-left: 0;
  }
}
</style>
