<script setup lang="ts">
import type { ApiResponse } from '~/types/api'
import type { MatchListItem, MatchListResult } from '~/types/match'
import type { LiveExchangeRateResponse, LiveMatchOddsEventItem, LiveMatchOddsTopTradeSummary } from '~/types/live'
import { formatBfAmount, formatDateCN, formatMatchTimeSlash, formatMoney } from '~/utils/formatters'

const MATCH_REFRESH_INTERVAL_MS = 30_000
const LIVE_TRADE_REFRESH_INTERVAL_MS = 5_000
const FX_RATE_REFRESH_INTERVAL_MS = 15 * 60_000
const FALLBACK_BETFAIR_GBP_TO_HKD_RATE = 9.8
const EFFECTIVE_LIVE_BIG_TRADE_HKD = 156_000
const BUSINESS_TIME_ZONE = 'Asia/Shanghai'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

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
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const partMap = Object.fromEntries(parts.map(part => [part.type, part.value]))
  const baseUtc = Date.UTC(Number(partMap.year), Number(partMap.month) - 1, Number(partMap.day))
  const d = new Date(baseUtc + offsetDays * ONE_DAY_MS)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
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
const { data: fxRateResponse, refresh: refreshFxRate } = useApiFetch<ApiResponse<LiveExchangeRateResponse>>(
  '/api/live/fx-rates/GBP/HKD',
  { server: false, baseURL: '' },
)
const isMatchLoading = computed(() => status.value === 'pending' || refreshing.value)
const result = computed<MatchListResult | null>(() => response.value?.data ?? null)
const apiMatches = computed(() => result.value?.items ?? [])
const leagues = computed(() => result.value?.leagues ?? [])
const betfairGbpToHkdRate = computed(() => {
  const rate = Number(fxRateResponse.value?.data?.rate ?? 0)
  return Number.isFinite(rate) && rate > 0 ? rate : FALLBACK_BETFAIR_GBP_TO_HKD_RATE
})

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
  return apiMatches.value.filter(item => !isFinishedMatch(item))
})

const matchCandidates = computed(() => {
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

  const extraPinned = pinnedItems.value.filter(item =>
    !apiIdSet.has(item.match.eventId)
    && (liveStatus.value === 'finished' ? isFinishedMatch(item) : !isFinishedMatch(item)),
  )
  return [...apiPinned, ...extraPinned, ...apiNormal]
})

const liveMarkets = computed(() => matchCandidates.value.map(item => ({
  eventId: item.match.eventId,
  marketId: item.match.marketId1,
})))
const liveTrades = useLiveMatchOddsTopTrades(liveMarkets)
const liveByEventId = computed(() => liveTrades.byEventId.value)
const matches = computed(() => {
  if (liveStatus.value !== 'running') return matchCandidates.value

  return matchCandidates.value.filter((item) => {
    const live = liveByEventId.value.get(item.match.eventId)
    const marketStatus = live?.marketStatus?.toUpperCase()
    return marketStatus !== 'CLOSED'
  })
})
const missingLiveEventIds = computed(() => new Set(
  liveTrades.data.value?.missingEventIds.map(id => Number(id)).filter(Number.isFinite) ?? [],
))
const pendingLiveEventIds = computed(() => new Set(
  liveTrades.data.value?.pendingEventIds.map(id => Number(id)).filter(Number.isFinite) ?? [],
))
const hasPendingVisibleLiveTrades = computed(() =>
  matchCandidates.value.some(item => pendingLiveEventIds.value.has(item.match.eventId)),
)
const isInitialLoading = computed(() => isMatchLoading.value && response.value == null)

const expandedEventIds = ref<Set<number>>(new Set())
const flashEventIds = ref<Set<number>>(new Set())
const previousSignatures = ref<Map<number, string>>(new Map())
let matchRefreshTimer: ReturnType<typeof setTimeout> | null = null
let liveTradeRefreshTimer: ReturnType<typeof setInterval> | null = null
let fxRateRefreshTimer: ReturnType<typeof setInterval> | null = null
let autoRefreshActive = false
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
  void liveTrades.refresh({ silent: liveTrades.data.value != null })
}, { immediate: true })

onMounted(() => {
  autoRefreshActive = true
  scheduleNextMatchRefresh()

  liveTradeRefreshTimer = setInterval(() => {
    if (
      document.visibilityState === 'hidden'
      || (liveStatus.value !== 'running' && !hasPendingVisibleLiveTrades.value)
    ) {
      return
    }

    void liveTrades.refresh({ silent: true })
  }, LIVE_TRADE_REFRESH_INTERVAL_MS)

  fxRateRefreshTimer = setInterval(() => {
    if (document.visibilityState === 'hidden') {
      return
    }

    void refreshFxRate()
  }, FX_RATE_REFRESH_INTERVAL_MS)
})

onBeforeUnmount(() => {
  autoRefreshActive = false

  if (matchRefreshTimer) {
    clearTimeout(matchRefreshTimer)
    matchRefreshTimer = null
  }

  if (liveTradeRefreshTimer) {
    clearInterval(liveTradeRefreshTimer)
    liveTradeRefreshTimer = null
  }

  if (fxRateRefreshTimer) {
    clearInterval(fxRateRefreshTimer)
    fxRateRefreshTimer = null
  }
})

async function refreshAll(options?: RefreshOptions) {
  const refreshOptions = normalizeRefreshOptions(options)
  try {
    await manualRefresh(refreshOptions)
    await nextTick()
    await liveTrades.refresh(refreshOptions)
  }
  finally {
    scheduleNextMatchRefresh()
  }
}

function scheduleNextMatchRefresh() {
  if (!autoRefreshActive) return

  if (matchRefreshTimer) {
    clearTimeout(matchRefreshTimer)
  }

  matchRefreshTimer = setTimeout(() => {
    void refreshAll({ silent: true })
  }, MATCH_REFRESH_INTERVAL_MS)
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

function isLiveMaxLatest(live: LiveMatchOddsEventItem | undefined): boolean {
  const maxKey = live?.maxTopTrade?.key
  return !!maxKey && maxKey === live?.latestTopTradeKey
}

function isLatestTopTrade(
  trade: LiveMatchOddsTopTradeSummary,
  live: LiveMatchOddsEventItem | undefined,
): boolean {
  return !!live?.latestTopTradeKey && trade.key === live.latestTopTradeKey
}

function liveEmptyText(item: MatchListItem): string {
  if (liveTrades.error.value) return '现场成交加载失败，等待下次自动刷新'
  if (liveTrades.loading.value) return '现场成交加载中...'
  if (pendingLiveEventIds.value.has(item.match.eventId)) return '现场成交加载中...'
  if (missingLiveEventIds.value.has(item.match.eventId)) return '未匹配 Betfair Match Odds'
  return '暂无现场成交'
}

function liveMainFallbackText(item: MatchListItem): string {
  if (pendingLiveEventIds.value.has(item.match.eventId)) return '生成中'
  if (missingLiveEventIds.value.has(item.match.eventId)) return '未匹配'
  if (liveTrades.error.value) return '-'
  return '-'
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
  const from = trade.priceFrom ?? null
  if (trade.priceDirection === 'flat') {
    const price = to ?? from
    return price ? `${price.toFixed(2)} 横盘` : '横盘'
  }
  if (!to) return '-'
  if (from && from !== to) {
    return `${from.toFixed(2)} → ${to.toFixed(2)} ${directionMark(trade.priceDirection)}`
  }
  if (from === to) return `${to.toFixed(2)} 横盘`
  return `${to.toFixed(2)} ${directionMark(trade.priceDirection)}`
}

function formatTradeTime(value: string | null | undefined): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

function toHkdAmount(amount: number | null | undefined): number {
  const raw = Number(amount ?? 0)
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return raw * betfairGbpToHkdRate.value
}

function formatHkdMoney(amount: number | null | undefined): string {
  return `HK$ ${formatMoney(Number(amount ?? 0))}`
}

function formatHkdCompact(amount: number | null | undefined): string {
  const value = Number(amount ?? 0)
  if (!Number.isFinite(value) || value <= 0) return '-'
  return `HK$ ${formatBfAmount(value)}`
}

function tradeTotalDelta(trade: LiveMatchOddsTopTradeSummary): number {
  return trade.snapshotTotalMatchedDelta || trade.amount
}

function tradeTotalDeltaHkd(trade: LiveMatchOddsTopTradeSummary): number {
  return toHkdAmount(tradeTotalDelta(trade))
}

function prematchMaxBetHkd(item: MatchListItem): number {
  const value = Number(item.bfMaxBet ?? 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

function isEffectiveLiveBigTrade(
  trade: LiveMatchOddsTopTradeSummary | null | undefined,
  item: MatchListItem,
): boolean {
  if (!trade) return false

  const liveAmount = tradeTotalDeltaHkd(trade)
  if (liveAmount <= 0) return false

  const prematchMax = prematchMaxBetHkd(item)
  return liveAmount > EFFECTIVE_LIVE_BIG_TRADE_HKD
    || (prematchMax > 0 && liveAmount > prematchMax)
}

function hasEffectiveLiveMax(live: LiveMatchOddsEventItem | undefined, item: MatchListItem): boolean {
  return isEffectiveLiveBigTrade(live?.maxTopTrade, item)
}

function formatBfIndex(item: MatchListItem): string {
  const indexes = [item.bfIndexHome, item.bfIndexDraw, item.bfIndexAway]
    .map(value => Number(value ?? 0))

  if (indexes.every(value => !Number.isFinite(value) || value <= 0)) return '-'
  return indexes
    .map(value => (Number.isFinite(value) && value > 0 ? Math.round(value).toString() : '-'))
    .join('-')
}

function formatBfMaxBetSummary(item: MatchListItem): string {
  if (!item.bfMaxBet) return '-'
  const amount = formatHkdMoney(item.bfMaxBet)
  const pct = item.bfMaxBetPercent.toFixed(0)
  const attr = item.bfMaxBetAttr || '-'
  const pmark = item.bfPMark ? `,${item.bfPMark}` : ''
  const selection = item.bfMaxBetSelection || '-'
  return `${amount} (${pct}%,${attr}${pmark}) ${selection}`
}

function formatLiveTotal(live: LiveMatchOddsEventItem | undefined, item: MatchListItem): string {
  if (!live?.totalMatched) return live ? '-' : liveMainFallbackText(item)
  const liveTotalHkd = toHkdAmount(live.totalMatched)
  const prematchHkd = Number(item.bfAmount ?? 0)
  const pureLiveTotal = Math.max(0, liveTotalHkd - prematchHkd)
  return formatHkdCompact(pureLiveTotal)
}

function formatLiveSummary(live: LiveMatchOddsEventItem | undefined, item: MatchListItem): string {
  if (!live) return liveMainFallbackText(item)
  const trade = live?.maxTopTrade
  if (!trade) return '-'
  return `${formatHkdMoney(tradeTotalDeltaHkd(trade))} ${sideLabel(trade.sideHint)} ${runnerLabel(trade, item)} ${formatPriceMove(trade)}`
}

function formatBookLevel(size: number | null | undefined, price: number | null | undefined): string {
  const priceValue = Number(price ?? 0)
  if (!Number.isFinite(priceValue) || priceValue <= 0) return '-'

  const sizeHkd = toHkdAmount(size)
  if (sizeHkd <= 0) return `- (${priceValue.toFixed(2)})`

  return `${formatHkdMoney(sizeHkd)} (${priceValue.toFixed(2)})`
}

function formatBackLayBook(trade: LiveMatchOddsTopTradeSummary): string {
  return `${formatBookLevel(trade.bestBackSize, trade.bestBackPrice)} / ${formatBookLevel(trade.bestLaySize, trade.bestLayPrice)}`
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

      <button class="refresh-btn" :disabled="isInitialLoading" @click="refreshAll()">
        <span class="refresh-icon" :class="{ spinning: isInitialLoading }">&#8635;</span>
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
            <th class="col-live-total">现场总成交</th>
            <th class="col-live">现场最大单</th>
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
              <td class="money-cell">{{ formatHkdCompact(item.bfAmount) }}</td>
              <td class="index-cell">{{ formatBfIndex(item) }}</td>
              <td class="live-total-cell" :class="{ 'live-latest': isLiveMaxLatest(getLiveItem(item)) }">
                {{ formatLiveTotal(getLiveItem(item), item) }}
              </td>
              <td
                class="live-cell"
                :class="{
                  'live-latest': isLiveMaxLatest(getLiveItem(item)),
                  'live-effective-big': hasEffectiveLiveMax(getLiveItem(item), item),
                }"
              >
                {{ formatLiveSummary(getLiveItem(item), item) }}
              </td>
              <td class="action-cell">
                <button
                  :class="['expand-btn', { open: isExpanded(item.match.eventId), flash: shouldFlash(item.match.eventId) }]"
                  @click="toggleExpanded(item.match.eventId)"
                >
                  {{ isExpanded(item.match.eventId) ? '⌃' : '⌄' }}
                </button>
              </td>
            </tr>
            <tr v-if="isExpanded(item.match.eventId)" class="detail-row">
              <td colspan="11">
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
                      :class="{ latest: isLatestTopTrade(trade, getLiveItem(item)) }"
                    >
                      <td>{{ trade.rank }}</td>
                      <td>{{ formatTradeTime(trade.timestamp) }}</td>
                      <td>{{ runnerLabel(trade, item) }}</td>
                      <td>{{ sideLabel(trade.sideHint) }}</td>
                      <td>{{ formatPriceMove(trade) }}</td>
                      <td :class="{ 'effective-big-amount': isEffectiveLiveBigTrade(trade, item) }">
                        {{ formatHkdMoney(tradeTotalDeltaHkd(trade)) }}
                      </td>
                      <td>{{ trade.tradedPrice ? trade.tradedPrice.toFixed(2) : '-' }}</td>
                      <td>{{ formatBackLayBook(trade) }}</td>
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
  min-width: 1320px;
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

th.col-live-total,
th.col-live {
  background: #edf7ff;
}

.match-row td.live-total-cell,
.match-row td.live-cell {
  background: #f7fbff;
}

.match-row:nth-child(4n + 1) td.live-total-cell,
.match-row:nth-child(4n + 1) td.live-cell {
  background: #f1f8ff;
}

.match-row td.live-total-cell.live-latest,
.match-row td.live-cell.live-latest,
.match-row:nth-child(4n + 1) td.live-total-cell.live-latest,
.match-row:nth-child(4n + 1) td.live-cell.live-latest {
  background: #fff7df;
}

.match-row td.live-cell.live-effective-big,
.match-row:nth-child(4n + 1) td.live-cell.live-effective-big {
  color: #d62929;
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
.index-cell,
.live-total-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.max-cell,
.live-total-cell,
.live-cell {
  font-weight: 700;
}

.action-cell {
  text-align: right;
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

.top-table td.effective-big-amount {
  color: #d62929;
  font-weight: 800;
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
