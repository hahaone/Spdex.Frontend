<script setup lang="ts">
import type { ApiResponse } from '~/types/api'
import type { MatchListItem, MatchListResult } from '~/types/match'
import type { LiveExchangeRateResponse, LiveMatchOddsEventItem, LiveMatchOddsTopTradeCollisionRecord, LiveMatchOddsTopTradeSummary, LiveXgItem, LiveXgReplay } from '~/types/live'
import type { LiveXgRef } from '~/composables/useLiveXg'
import { formatBfAmount, formatDateCN, formatMatchTimeSlash, formatMoney } from '~/utils/formatters'

const MATCH_REFRESH_INTERVAL_MS = 30_000
const LIVE_TRADE_REFRESH_INTERVAL_MS = 5_000
const FX_RATE_REFRESH_INTERVAL_MS = 15 * 60_000
const FALLBACK_BETFAIR_GBP_TO_HKD_RATE = 9.8
const EFFECTIVE_LIVE_BIG_TRADE_HKD = 156_000
const LIVE_TRADE_COMPARE_THRESHOLD_HKD = 40_000
const BUSINESS_TIME_ZONE = 'Asia/Shanghai'
const ONE_DAY_MS = 24 * 60 * 60 * 1000
const DRAW_SELECTION_ID = 58805
const TOP_TRADE_COLLISION_HISTORY_LIMIT = 200
const TOP_TRADE_COLLISION_MARKER_STORAGE_PREFIX = 'spdex-fjcx-live-top-trade-collision-markers'
const TOP_TRADE_COLLISION_HISTORY_STORAGE_PREFIX = 'spdex-fjcx-live-top-trade-collisions'

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

// ── 现场频道 BSW xG（B+：预期总进球统一 BSW 网关）──
const xgToken = useCookie('spdex_token')
const xgRefs = computed<LiveXgRef[]>(() => matchCandidates.value.map(item => ({
  eventId: item.match.eventId,
  homeTeamName: item.match.homeTeamName || item.match.homeTeam,
  guestTeamName: item.match.guestTeamName || item.match.guestTeam,
})))
const liveXg = useLiveXg(xgRefs)
function getXg(item: MatchListItem): LiveXgItem | null {
  return liveXg.byEventId.value.get(item.match.eventId) ?? null
}
function formatXg(item: MatchListItem): string {
  const xg = getXg(item)
  return xg ? `${xg.xgHome.toFixed(2)}-${xg.xgAway.toFixed(2)}` : '-'
}
function formatProjGoals(item: MatchListItem): string {
  const xg = getXg(item)
  return xg ? xg.projectedTotalGoals.toFixed(2) : '-'
}

// 「预期总进球」折叠（独立于 TOP10 大单展开）+ 走势序列懒加载
const xgExpandedEventIds = ref<Set<number>>(new Set())
const xgReplayByEventId = ref<Map<number, LiveXgReplay>>(new Map())
const xgReplayRefreshingEventIds = ref<Set<number>>(new Set())
const xgReplayRenderVersionByEventId = ref<Map<number, number>>(new Map())
function isXgExpanded(eventId: number): boolean {
  return xgExpandedEventIds.value.has(eventId)
}
async function loadXgReplay(eventId: number) {
  if (!import.meta.client) return
  const refreshing = new Set(xgReplayRefreshingEventIds.value)
  refreshing.add(eventId)
  xgReplayRefreshingEventIds.value = refreshing
  try {
    const headers: Record<string, string> = { 'X-Spdex-Frontend': 'fjcx' }
    if (xgToken.value) headers.Authorization = `Bearer ${xgToken.value}`
    const res = await $fetch<ApiResponse<LiveXgReplay>>(`/api/live/xg/${eventId}/replay`, {
      headers,
      query: { t: Date.now() },
      cache: 'no-store',
    })
    if (res.code === 0 && res.data) {
      const map = new Map(xgReplayByEventId.value)
      map.set(eventId, res.data)
      xgReplayByEventId.value = map
      bumpXgReplayRenderVersion(eventId)
    }
  }
  catch { /* 忽略 */ }
  finally {
    const nextRefreshing = new Set(xgReplayRefreshingEventIds.value)
    nextRefreshing.delete(eventId)
    xgReplayRefreshingEventIds.value = nextRefreshing
  }
}
function bumpXgReplayRenderVersion(eventId: number) {
  const next = new Map(xgReplayRenderVersionByEventId.value)
  next.set(eventId, (next.get(eventId) ?? 0) + 1)
  xgReplayRenderVersionByEventId.value = next
}
function xgReplayRenderVersion(eventId: number): number {
  return xgReplayRenderVersionByEventId.value.get(eventId) ?? 0
}
function isXgReplayRefreshing(eventId: number): boolean {
  return xgReplayRefreshingEventIds.value.has(eventId)
}
async function refreshExpandedXgReplays() {
  const eventIds = [...xgExpandedEventIds.value]
  if (eventIds.length === 0) return
  await Promise.all(eventIds.map(eventId => loadXgReplay(eventId)))
}
async function toggleXgExpand(eventId: number) {
  const next = new Set(xgExpandedEventIds.value)
  if (next.has(eventId)) {
    next.delete(eventId)
    xgExpandedEventIds.value = next
    return
  }
  next.add(eventId)
  xgExpandedEventIds.value = next
  await loadXgReplay(eventId)
}

const TG_SPARK_MARK_DIFF_THRESHOLD = 1.09

function formatTgSparkValue(value: number): string {
  return value.toFixed(2)
}

// 预期总进球走势 sparkline（projectedTotalGoals + 时间轴 guide + 断点跳过）
function tgSpark(eventId: number) {
  const series = xgReplayByEventId.value.get(eventId)?.series ?? []
  const vals = series.map(p => (p.projectedTotalGoals == null ? null : Number(p.projectedTotalGoals)))
  const nums = vals.filter((v): v is number => v != null && Number.isFinite(v))
  if (nums.length < 2) return null
  const W = 320, H = 64, pad = 8
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  const maxMinute = Math.max(90, ...series.map(p => p.minute || 0))
  const xOf = (m: number) => pad + (W - pad * 2) * (Math.max(0, m) / maxMinute)
  const yOf = (v: number) => pad + (H - pad * 2) * (1 - (v - min) / span)
  let path = ''
  let pen = false
  let lastX = pad
  let lastY = H - pad
  const marked = new Set<number>()
  let previousValidIndex: number | null = null
  vals.forEach((v, i) => {
    if (v == null) { pen = false; return }
    const x = xOf(series[i]?.minute ?? i)
    const y = yOf(v)
    path += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `
    pen = true
    lastX = x
    lastY = y
    // 与上一个有效节点差异 >1.09 → 两个节点都标记并显示数值。
    const prev = previousValidIndex == null ? null : vals[previousValidIndex]
    if (previousValidIndex != null && prev != null && Math.abs(v - prev) > TG_SPARK_MARK_DIFF_THRESHOLD) {
      marked.add(previousValidIndex)
      marked.add(i)
    }
    previousValidIndex = i
  })
  const labels = [...marked].sort((a, b) => a - b).map((i) => {
    const v = vals[i]!
    const x = xOf(series[i]?.minute ?? i)
    const y = yOf(v)
    const nearRight = x > W - 36
    return {
      x,
      y,
      textX: nearRight ? x - 4 : x + 4,
      textY: Math.max(10, y - 6),
      text: formatTgSparkValue(v),
      anchor: nearRight ? 'end' : 'start',
    }
  })
  // 20 分钟、中场、75 分钟时间轴竖线（带标签）
  const guides = [{ minute: 20, label: '20\'' }, { minute: 45, label: '中场' }, { minute: 75, label: '75\'' }]
    .filter(g => maxMinute >= g.minute)
    .map((g) => {
      const x = xOf(g.minute)
      const nearRight = x > W - 28
      return { x, label: g.label, labelX: nearRight ? x - 3 : x + 3, labelY: H - 3, anchor: nearRight ? 'end' : 'start' }
    })
  const yGuides = [1, 2]
    .filter(value => value >= min && value <= max)
    .map(value => ({ value, y: yOf(value) }))
  return { path, w: W, h: H, min: formatTgSparkValue(min), max: formatTgSparkValue(max), guides, yGuides, labels, lastX, lastY }
}
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
const nowMs = ref(Date.now())
const nextMatchRefreshAt = ref(Date.now() + MATCH_REFRESH_INTERVAL_MS)
const refreshCountdownSeconds = computed(() =>
  Math.max(0, Math.ceil((nextMatchRefreshAt.value - nowMs.value) / 1000)),
)

const expandedEventIds = ref<Set<number>>(new Set())
const flashEventIds = ref<Set<number>>(new Set())
const previousSignatures = ref<Map<number, string>>(new Map())
const topTradeCollisionHistory = ref<TopTradeCollisionHistoryRecord[]>([])
const topTradeCollisionCountsByEventId = ref<Map<number, Map<string, number>>>(new Map())
const previousTopTradeKeysByEventId = ref<Map<number, Set<string>>>(new Map())
const isTopTradeCollisionHistoryOpen = ref(false)
let matchRefreshTimer: ReturnType<typeof setTimeout> | null = null
let liveTradeRefreshTimer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let fxRateRefreshTimer: ReturnType<typeof setInterval> | null = null
let autoRefreshActive = false
type RefreshOptions = { silent?: boolean } | PointerEvent

function normalizeRefreshOptions(options?: RefreshOptions): { silent?: boolean } {
  return options && 'silent' in options ? options : {}
}

const topTradeCollisionHistoryStorageKey = computed(() =>
  `${TOP_TRADE_COLLISION_HISTORY_STORAGE_PREFIX}:${selectedDate.value}`,
)
const topTradeCollisionMarkerStorageKey = computed(() =>
  `${TOP_TRADE_COLLISION_MARKER_STORAGE_PREFIX}:${selectedDate.value}`,
)

if (import.meta.client) {
  watch(topTradeCollisionHistoryStorageKey, () => {
    loadTopTradeCollisionHistory()
  }, { immediate: true })
  watch(topTradeCollisionMarkerStorageKey, () => {
    loadTopTradeCollisionMarkers()
  }, { immediate: true })
}

watch(
  () => liveTrades.data.value?.timestamp,
  () => {
    syncTopTradeCollisionMarkers()

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
  countdownTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)

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

  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
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
    await liveXg.refresh()
    await refreshExpandedXgReplays()
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

  nowMs.value = Date.now()
  nextMatchRefreshAt.value = nowMs.value + MATCH_REFRESH_INTERVAL_MS
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

const NEAR_TRADE_WINDOW_MS = 5_000

/**
 * 新进入 TOP10 的成交单与其他 TOP10 大单成交时间差 < 5 秒时，
 * 最新单时间粗体红字，联动单时间红字。
 */
function topTradeTimeClass(
  trade: LiveMatchOddsTopTradeSummary,
  live: LiveMatchOddsEventItem | undefined,
): string {
  if (!live) return ''
  const eventId = Number(live.eventId)
  if (!Number.isFinite(eventId)) return ''
  const markers = topTradeCollisionCountsByEventId.value.get(eventId)
  if (!markers || markers.size === 0) return ''

  const tradeTime = Date.parse(trade.timestamp)
  if (Number.isNaN(tradeTime)) return ''

  for (const triggerKey of markers.keys()) {
    const trigger = live.topTrades.find(item => item.key === triggerKey)
    if (!trigger) continue
    if (trade.key === triggerKey) {
      return 'time-near-collision-latest'
    }
    const triggerTime = Date.parse(trigger.timestamp)
    if (!Number.isNaN(triggerTime) && Math.abs(triggerTime - tradeTime) < NEAR_TRADE_WINDOW_MS) {
      return 'time-near-collision-linked'
    }
  }
  return ''
}

function topTradeCollisionGroup(live: LiveMatchOddsEventItem | undefined): LiveMatchOddsTopTradeSummary[] {
  if (!live?.latestTopTradeKey) return []
  const latest = live.topTrades.find(item => item.key === live.latestTopTradeKey)
  if (!latest) return []
  const latestTime = Date.parse(latest.timestamp)
  if (Number.isNaN(latestTime)) return []

  return live.topTrades
    .filter((trade) => {
      const tradeTime = Date.parse(trade.timestamp)
      return !Number.isNaN(tradeTime) && Math.abs(latestTime - tradeTime) < NEAR_TRADE_WINDOW_MS
    })
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
}

function syncTopTradeCollisionMarkers() {
  const next = new Map<number, Map<string, number>>()
  const previousKeysByEventId = previousTopTradeKeysByEventId.value
  const nextPreviousKeysByEventId = new Map<number, Set<string>>()
  const serverCollisionsByEventId = groupServerTopTradeCollisions()

  for (const item of liveTrades.data.value?.items ?? []) {
    const eventId = Number(item.eventId)
    if (!Number.isFinite(eventId)) continue

    const tradeKeys = new Set(item.topTrades.map(trade => trade.key))
    nextPreviousKeysByEventId.set(eventId, tradeKeys)
    const existing = topTradeCollisionCountsByEventId.value.get(eventId)
    const markers = new Map<string, number>()

    if (existing) {
      for (const [key, count] of existing) {
        if (tradeKeys.has(key)) markers.set(key, count)
      }
    }

    for (const collision of serverCollisionsByEventId.get(eventId) ?? []) {
      if (collision.trigger && tradeKeys.has(collision.trigger.key)) {
        markers.set(collision.trigger.key, Math.max(markers.get(collision.trigger.key) ?? 0, collision.count))
      }
      recordTopTradeCollisionHistoryFromServer(collision)
    }

    const collisionGroup = topTradeCollisionGroup(item)
    const collisionCount = collisionGroup.length > 1 ? collisionGroup.length : 0
    const latestKey = item.latestTopTradeKey
    const previousKeys = previousKeysByEventId.get(eventId)
    const latestEnteredTop10 = !!latestKey && previousKeys != null && !previousKeys.has(latestKey)
    if (collisionCount > 0 && latestEnteredTop10 && tradeKeys.has(latestKey)) {
      markers.set(latestKey, markers.get(latestKey) ?? collisionCount)
      recordTopTradeCollisionHistory(item, collisionGroup, collisionCount)
    }

    if (markers.size > 0) {
      next.set(eventId, markers)
    }
  }

  previousTopTradeKeysByEventId.value = nextPreviousKeysByEventId
  topTradeCollisionCountsByEventId.value = next
  saveTopTradeCollisionMarkers(next)
}

function groupServerTopTradeCollisions(): Map<number, LiveMatchOddsTopTradeCollisionRecord[]> {
  const groups = new Map<number, LiveMatchOddsTopTradeCollisionRecord[]>()
  for (const collision of liveTrades.data.value?.topTradeCollisions ?? []) {
    const eventId = Number(collision.eventId)
    if (!Number.isFinite(eventId) || !collision.trigger || collision.count <= 1) continue
    const items = groups.get(eventId) ?? []
    items.push(collision)
    groups.set(eventId, items)
  }
  return groups
}

function topTradeCollisionMarkerCount(
  trade: LiveMatchOddsTopTradeSummary,
  live: LiveMatchOddsEventItem | undefined,
): number {
  const eventId = Number(live?.eventId)
  if (!Number.isFinite(eventId)) return 0
  return topTradeCollisionCountsByEventId.value.get(eventId)?.get(trade.key) ?? 0
}

function topTradeCollisionDisplayCount(live: LiveMatchOddsEventItem | undefined): number {
  return retainedTopTradeCollisionCount(live)
}

function retainedTopTradeCollisionCount(live: LiveMatchOddsEventItem | undefined): number {
  const eventId = Number(live?.eventId)
  if (!Number.isFinite(eventId)) return 0
  const markers = topTradeCollisionCountsByEventId.value.get(eventId)
  if (!markers || markers.size === 0) return 0
  return Math.max(...markers.values())
}

interface TopTradeCollisionStoredMarker {
  eventId: number
  trades: Array<{ key: string; count: number }>
}

interface TopTradeCollisionHistoryMember {
  key: string
  rank: number
  time: string
  runner: string
  side: string
  price: string
  amount: string
  book: string
}

interface TopTradeCollisionHistoryRecord {
  key: string
  eventId: number
  league: string
  matchTime: string
  homeTeam: string
  guestTeam: string
  count: number
  triggeredAt: string
  detectedAt: string
  trigger: TopTradeCollisionHistoryMember
  linked: TopTradeCollisionHistoryMember[]
}

const visibleTopTradeCollisionHistory = computed(() =>
  isTopTradeCollisionHistoryOpen.value
    ? topTradeCollisionHistory.value
    : [],
)

function findMatchByEventId(eventId: number): MatchListItem | undefined {
  return matchCandidates.value.find(item => item.match.eventId === eventId)
}

function recordTopTradeCollisionHistory(
  live: LiveMatchOddsEventItem,
  collisionGroup: LiveMatchOddsTopTradeSummary[],
  collisionCount: number,
) {
  const eventId = Number(live.eventId)
  const latestKey = live.latestTopTradeKey
  if (!Number.isFinite(eventId) || !latestKey || collisionCount <= 1) return
  const latest = collisionGroup.find(trade => trade.key === latestKey)
  if (!latest) return

  const match = findMatchByEventId(eventId)
  const recordKey = `${eventId}|${latest.key}`
  const record = buildTopTradeCollisionHistoryRecord(eventId, match, latest, collisionGroup, collisionCount, recordKey)
  mergeTopTradeCollisionHistoryRecord(record, true)
}

function recordTopTradeCollisionHistoryFromServer(collision: LiveMatchOddsTopTradeCollisionRecord) {
  const eventId = Number(collision.eventId)
  if (!Number.isFinite(eventId) || !collision.trigger || collision.count <= 1) return

  const match = findMatchByEventId(eventId)
  const record: TopTradeCollisionHistoryRecord = {
    key: `${eventId}|${collision.trigger.key}`,
    eventId,
    league: match?.match.sortName ?? '-',
    matchTime: match ? formatMatchTimeSlash(match.match.matchTime) : '-',
    homeTeam: match?.match.homeTeam ?? '-',
    guestTeam: match?.match.guestTeam ?? '-',
    count: collision.count,
    triggeredAt: formatTradeTime(collision.triggeredAtUtc || collision.trigger.timestamp),
    detectedAt: formatTradeTime(collision.detectedAtUtc),
    trigger: buildTopTradeCollisionHistoryMember(collision.trigger, match),
    linked: collision.linked.map(trade => buildTopTradeCollisionHistoryMember(trade, match)),
  }
  mergeTopTradeCollisionHistoryRecord(record, false)
}

function mergeTopTradeCollisionHistoryRecord(record: TopTradeCollisionHistoryRecord, openOnNew: boolean) {
  const existingIndex = topTradeCollisionHistory.value.findIndex(item => item.key === record.key)
  let next: TopTradeCollisionHistoryRecord[]

  if (existingIndex >= 0) {
    next = [...topTradeCollisionHistory.value]
    const existing = next[existingIndex]!
    next[existingIndex] = {
      ...record,
      detectedAt: existing.detectedAt,
      count: Math.max(existing.count, record.count),
    }
  } else {
    next = [record, ...topTradeCollisionHistory.value]
    if (openOnNew) isTopTradeCollisionHistoryOpen.value = true
  }

  topTradeCollisionHistory.value = next.slice(0, TOP_TRADE_COLLISION_HISTORY_LIMIT)
  saveTopTradeCollisionHistory()
}

function buildTopTradeCollisionHistoryRecord(
  eventId: number,
  match: MatchListItem | undefined,
  latest: LiveMatchOddsTopTradeSummary,
  collisionGroup: LiveMatchOddsTopTradeSummary[],
  collisionCount: number,
  recordKey: string,
): TopTradeCollisionHistoryRecord {
  return {
    key: recordKey,
    eventId,
    league: match?.match.sortName ?? '-',
    matchTime: match ? formatMatchTimeSlash(match.match.matchTime) : '-',
    homeTeam: match?.match.homeTeam ?? '-',
    guestTeam: match?.match.guestTeam ?? '-',
    count: collisionCount,
    triggeredAt: formatTradeTime(latest.timestamp),
    detectedAt: formatTradeTime(new Date().toISOString()),
    trigger: buildTopTradeCollisionHistoryMember(latest, match),
    linked: collisionGroup
      .filter(trade => trade.key !== latest.key)
      .map(trade => buildTopTradeCollisionHistoryMember(trade, match)),
  }
}

function buildTopTradeCollisionHistoryMember(
  trade: LiveMatchOddsTopTradeSummary,
  match: MatchListItem | undefined,
): TopTradeCollisionHistoryMember {
  return {
    key: trade.key,
    rank: trade.rank,
    time: formatTradeTime(trade.timestamp),
    runner: match ? runnerLabel(trade, match) : (trade.runnerName || trade.selectionId || '-'),
    side: sideLabel(trade.sideHint),
    price: formatPriceMove(trade),
    amount: formatHkdMoney(tradeTotalDeltaHkd(trade)),
    book: formatBackLayBook(trade),
  }
}

function openTopTradeCollisionHistoryRecord(record: TopTradeCollisionHistoryRecord) {
  const next = new Set(expandedEventIds.value)
  next.add(record.eventId)
  expandedEventIds.value = next
}

function clearTopTradeCollisionHistory() {
  topTradeCollisionHistory.value = []
  if (import.meta.client) localStorage.removeItem(topTradeCollisionHistoryStorageKey.value)
}

function saveTopTradeCollisionMarkers(markers = topTradeCollisionCountsByEventId.value) {
  if (!import.meta.client) return
  const payload: TopTradeCollisionStoredMarker[] = [...markers.entries()].map(([eventId, tradeMarkers]) => ({
    eventId,
    trades: [...tradeMarkers.entries()].map(([key, count]) => ({ key, count })),
  }))
  localStorage.setItem(topTradeCollisionMarkerStorageKey.value, JSON.stringify(payload))
}

function loadTopTradeCollisionMarkers() {
  if (!import.meta.client) return
  try {
    const raw = localStorage.getItem(topTradeCollisionMarkerStorageKey.value)
    if (!raw) {
      topTradeCollisionCountsByEventId.value = new Map()
      return
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      topTradeCollisionCountsByEventId.value = new Map()
      return
    }

    const next = new Map<number, Map<string, number>>()
    for (const item of parsed) {
      if (!isTopTradeCollisionStoredMarker(item)) continue
      const markers = new Map<string, number>()
      for (const trade of item.trades) markers.set(trade.key, trade.count)
      if (markers.size > 0) next.set(item.eventId, markers)
    }
    topTradeCollisionCountsByEventId.value = next
  } catch {
    topTradeCollisionCountsByEventId.value = new Map()
  }
}

function isTopTradeCollisionStoredMarker(value: unknown): value is TopTradeCollisionStoredMarker {
  if (!value || typeof value !== 'object') return false
  const marker = value as Partial<TopTradeCollisionStoredMarker>
  return typeof marker.eventId === 'number'
    && Array.isArray(marker.trades)
    && marker.trades.every(trade =>
      trade
      && typeof trade === 'object'
      && typeof trade.key === 'string'
      && typeof trade.count === 'number',
    )
}

function saveTopTradeCollisionHistory() {
  if (!import.meta.client) return
  localStorage.setItem(
    topTradeCollisionHistoryStorageKey.value,
    JSON.stringify(topTradeCollisionHistory.value),
  )
}

function loadTopTradeCollisionHistory() {
  if (!import.meta.client) return
  try {
    const raw = localStorage.getItem(topTradeCollisionHistoryStorageKey.value)
    if (!raw) {
      topTradeCollisionHistory.value = []
      return
    }
    const parsed: unknown = JSON.parse(raw)
    topTradeCollisionHistory.value = Array.isArray(parsed)
      ? parsed.filter(isTopTradeCollisionHistoryRecord).slice(0, TOP_TRADE_COLLISION_HISTORY_LIMIT)
      : []
  } catch {
    topTradeCollisionHistory.value = []
  }
}

function isTopTradeCollisionHistoryRecord(value: unknown): value is TopTradeCollisionHistoryRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<TopTradeCollisionHistoryRecord>
  return typeof record.key === 'string'
    && typeof record.eventId === 'number'
    && typeof record.count === 'number'
    && typeof record.trigger === 'object'
    && Array.isArray(record.linked)
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
  if (selectionId === DRAW_SELECTION_ID) return '平'
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
  return trade.tradedSizeDelta || trade.runnerMatchedDelta || trade.amount || trade.snapshotTotalMatchedDelta
}

function tradeTotalDeltaHkd(trade: LiveMatchOddsTopTradeSummary): number {
  return toHkdAmount(tradeTotalDelta(trade))
}

function prematchMaxBetHkd(item: MatchListItem): number {
  const value = Number(item.bfMaxBet ?? 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

type LiveTradePromptClass = 'live-trade-normal' | 'live-trade-alert' | 'live-trade-alert-strong'

function getLiveTradePromptClass(
  trade: LiveMatchOddsTopTradeSummary | null | undefined,
  item: MatchListItem,
): LiveTradePromptClass {
  if (!trade) return 'live-trade-normal'

  const liveAmount = tradeTotalDeltaHkd(trade)
  if (liveAmount <= 0) return 'live-trade-normal'

  if (liveAmount > EFFECTIVE_LIVE_BIG_TRADE_HKD) {
    return 'live-trade-alert-strong'
  }

  const prematchMax = prematchMaxBetHkd(item)
  if (prematchMax > 0 && liveAmount > prematchMax) {
    return liveAmount >= LIVE_TRADE_COMPARE_THRESHOLD_HKD
      ? 'live-trade-alert-strong'
      : 'live-trade-alert'
  }

  return 'live-trade-normal'
}

function liveMaxPromptClass(live: LiveMatchOddsEventItem | undefined, item: MatchListItem): LiveTradePromptClass {
  return getLiveTradePromptClass(live?.maxTopTrade, item)
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

function formatLiveLtp(live: LiveMatchOddsEventItem | undefined, item: MatchListItem): string {
  if (!live) return liveMainFallbackText(item)

  const prices = [
    formatRunnerLtp(live, item.match.homeTeamId),
    formatRunnerLtp(live, DRAW_SELECTION_ID),
    formatRunnerLtp(live, item.match.guestTeamId),
  ]
  return prices.some(price => price !== '-') ? prices.join('-') : '-'
}

function formatLiveSummary(live: LiveMatchOddsEventItem | undefined, item: MatchListItem): string {
  if (!live) return liveMainFallbackText(item)
  const trade = live?.maxTopTrade
  if (!trade) return '-'
  return `${formatHkdMoney(tradeTotalDeltaHkd(trade))} ${sideLabel(trade.sideHint)} ${runnerLabel(trade, item)} ${formatPriceMove(trade)}`
}

function formatRunnerLtp(live: LiveMatchOddsEventItem, selectionId: number): string {
  const target = String(selectionId)
  const row = live.runnerLtps?.find(item => item.selectionId === target)
  const value = Number(row?.lastPriceTraded ?? 0)
  return Number.isFinite(value) && value > 0 ? value.toFixed(2) : '-'
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
        <span class="refresh-countdown">列表 {{ refreshCountdownSeconds }}s</span>
      </button>

      <div class="filter-info">
        <span class="date-text">{{ formatDateCN(selectedDate) }}</span>
        <span v-if="liveTrades.error.value" class="error-text">{{ liveTrades.error.value }}</span>
        <span v-else class="badge count">{{ matches.length }} 场赛事</span>
      </div>
    </div>

    <section v-if="topTradeCollisionHistory.length > 0" class="collision-history">
      <div class="collision-history-head">
        <div>
          <div class="collision-history-title">5秒多单记录</div>
          <div class="collision-history-subtitle">记录触发过的现场 TOP10 5秒多单，刷新后仍保留</div>
        </div>
        <div class="collision-history-actions">
          <span>{{ topTradeCollisionHistory.length }} 条</span>
          <button type="button" @click="isTopTradeCollisionHistoryOpen = !isTopTradeCollisionHistoryOpen">
            {{ isTopTradeCollisionHistoryOpen ? '收起' : '展开' }}
          </button>
          <button type="button" @click="clearTopTradeCollisionHistory">清空</button>
        </div>
      </div>
      <div v-if="isTopTradeCollisionHistoryOpen" class="collision-history-list">
        <button
          v-for="record in visibleTopTradeCollisionHistory"
          :key="record.key"
          type="button"
          class="collision-history-item"
          @click="openTopTradeCollisionHistoryRecord(record)"
        >
          <span class="collision-history-main">
            <strong>[{{ record.count }}]</strong>
            <span>{{ record.triggeredAt }}</span>
            <span>{{ record.league }}</span>
            <span>{{ record.homeTeam }} v {{ record.guestTeam }}</span>
          </span>
          <span class="collision-history-detail">
            触发 #{{ record.trigger.rank }} {{ record.trigger.runner }} {{ record.trigger.side }} {{ record.trigger.amount }} {{ record.trigger.price }}
            <template v-if="record.linked.length > 0">
              ｜关联 {{ record.linked.map(item => `#${item.rank} ${item.runner} ${item.amount}`).join('，') }}
            </template>
          </span>
        </button>
      </div>
    </section>

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
            <th class="col-live-total">现场总成交</th>
            <th class="col-live-ltp">现场价位</th>
            <th class="col-live">现场最大单</th>
            <th class="col-xg">xG</th>
            <th class="col-tg">预期总进球</th>
            <th class="col-action" />
          </tr>
        </thead>
        <tbody>
          <template v-for="item in matches" :key="item.match.eventId">
            <tr class="match-row" @click="toggleExpanded(item.match.eventId)">
              <td>
                <button class="pin-btn" :class="{ pinned: isPinned(item.match.eventId) }" @click.stop="togglePin(item)">
                  ★
                </button>
              </td>
              <td class="league-cell">{{ item.match.sortName }}</td>
              <td>{{ formatMatchTimeSlash(item.match.matchTime) }}</td>
              <td class="teams-cell">
                <strong>{{ item.match.homeTeam }}</strong>
                <span>v</span>
                <strong>{{ item.match.guestTeam }}</strong>
                <div class="mobile-live-meta">
                  <span>现场价位 {{ formatLiveLtp(getLiveItem(item), item) }}</span>
                  <span :class="['mobile-live-max', liveMaxPromptClass(getLiveItem(item), item)]">
                    现场最大单 {{ formatLiveSummary(getLiveItem(item), item) }}
                    <span v-if="topTradeCollisionDisplayCount(getLiveItem(item)) > 0" class="live-collision-count">
                      [{{ topTradeCollisionDisplayCount(getLiveItem(item)) }}]
                    </span>
                  </span>
                </div>
              </td>
              <td class="price-cell">
                <span>{{ item.bfMaxBetOdds ? item.bfMaxBetOdds.toFixed(2) : '-' }}</span>
              </td>
              <td class="max-cell">{{ formatBfMaxBetSummary(item) }}</td>
              <td class="money-cell">{{ formatHkdCompact(item.bfAmount) }}</td>
              <td class="live-total-cell" :class="{ 'live-latest': isLiveMaxLatest(getLiveItem(item)) }">
                {{ formatLiveTotal(getLiveItem(item), item) }}
              </td>
              <td class="live-ltp-cell" :class="{ 'live-latest': isLiveMaxLatest(getLiveItem(item)) }">
                {{ formatLiveLtp(getLiveItem(item), item) }}
              </td>
              <td
                class="live-cell"
                :class="[
                  { 'live-latest': isLiveMaxLatest(getLiveItem(item)) },
                  liveMaxPromptClass(getLiveItem(item), item),
                ]"
              >
                {{ formatLiveSummary(getLiveItem(item), item) }}
                <span v-if="topTradeCollisionDisplayCount(getLiveItem(item)) > 0" class="live-collision-count">
                  [{{ topTradeCollisionDisplayCount(getLiveItem(item)) }}]
                </span>
              </td>
              <td class="xg-cell">{{ formatXg(item) }}</td>
              <td class="tg-cell">
                <button
                  class="tg-toggle"
                  :class="{ open: isXgExpanded(item.match.eventId) }"
                  @click.stop="toggleXgExpand(item.match.eventId)"
                >
                  <span class="num">{{ formatProjGoals(item) }}</span>
                  <i class="tg-arrow">{{ isXgExpanded(item.match.eventId) ? '⌃' : '⌄' }}</i>
                </button>
              </td>
              <td class="action-cell">
                <button
                  :class="['expand-btn', { open: isExpanded(item.match.eventId), flash: shouldFlash(item.match.eventId) }]"
                  @click.stop="toggleExpanded(item.match.eventId)"
                >
                  {{ isExpanded(item.match.eventId) ? '⌃' : '⌄' }}
                </button>
              </td>
            </tr>
            <tr v-if="isExpanded(item.match.eventId)" class="detail-row">
              <td colspan="13">
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
                      <th>挂卖/挂买</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="trade in getLiveItem(item)?.topTrades ?? []"
                      :key="trade.key"
                      :class="{ latest: isLatestTopTrade(trade, getLiveItem(item)) }"
                    >
                      <td>{{ trade.rank }}</td>
                      <td :class="topTradeTimeClass(trade, getLiveItem(item))">{{ formatTradeTime(trade.timestamp) }}</td>
                      <td>{{ runnerLabel(trade, item) }}</td>
                      <td>{{ sideLabel(trade.sideHint) }}</td>
                      <td>{{ formatPriceMove(trade) }}</td>
                      <td :class="getLiveTradePromptClass(trade, item)">
                        {{ formatHkdMoney(tradeTotalDeltaHkd(trade)) }}
                      </td>
                      <td>{{ trade.tradedPrice ? trade.tradedPrice.toFixed(2) : '-' }}</td>
                      <td>
                        {{ formatBackLayBook(trade) }}
                        <span
                          v-if="topTradeCollisionMarkerCount(trade, getLiveItem(item)) > 0"
                          class="live-collision-count top-trade-collision-count"
                        >
                          [{{ topTradeCollisionMarkerCount(trade, getLiveItem(item)) }}]
                        </span>
                      </td>
                    </tr>
                    <tr v-if="(getLiveItem(item)?.topTrades?.length ?? 0) === 0">
                      <td colspan="8" class="empty-cell">{{ liveEmptyText(item) }}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr v-if="isXgExpanded(item.match.eventId)" class="xg-detail-row">
              <td colspan="13">
                <template v-for="(spark, sparkIdx) in [tgSpark(item.match.eventId)]" :key="sparkIdx">
                  <div class="tg-chart">
                    <div class="tg-chart-head">
                      <span class="tg-title">预期总进球走势</span>
                      <span v-if="isXgReplayRefreshing(item.match.eventId)" class="tg-refreshing">刷新中...</span>
                      <span v-else-if="spark" class="tg-range num">{{ spark.min }} ~ {{ spark.max }}</span>
                    </div>
                    <svg
                      v-if="spark"
                      :key="`tg-${item.match.eventId}-${xgReplayRenderVersion(item.match.eventId)}`"
                      class="tg-svg"
                      :viewBox="`0 0 ${spark.w} ${spark.h}`"
                      preserveAspectRatio="none"
                    >
                      <line
                        v-for="guide in spark.yGuides"
                        :key="`tg-y-${guide.value}`"
                        class="tg-y-guide"
                        x1="0"
                        :y1="guide.y"
                        :x2="spark.w"
                        :y2="guide.y"
                      />
                      <g v-for="g in spark.guides" :key="g.label">
                        <line class="tg-guide" :x1="g.x" y1="0" :x2="g.x" :y2="spark.h" />
                        <text class="tg-guide-label" :x="g.labelX" :y="g.labelY" :text-anchor="g.anchor">{{ g.label }}</text>
                      </g>
                      <path :d="spark.path" fill="none" class="tg-line" />
                      <g v-for="(lb, li) in spark.labels" :key="`tgl-${li}`">
                        <circle :cx="lb.x" :cy="lb.y" r="2.6" class="tg-mark" />
                        <text class="tg-mark-label" :x="lb.textX" :y="lb.textY" :text-anchor="lb.anchor">{{ lb.text }}</text>
                      </g>
                      <circle :cx="spark.lastX" :cy="spark.lastY" r="3" class="tg-dot" />
                    </svg>
                    <div v-else class="tg-empty">{{ isXgReplayRefreshing(item.match.eventId) ? '走势刷新中...' : '暂无预期总进球走势（数据积累中或非足球）' }}</div>
                  </div>
                </template>
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

.refresh-countdown {
  min-width: 30px;
  padding-left: 6px;
  border-left: 1px solid #d8deea;
  color: #6d7890;
  font-variant-numeric: tabular-nums;
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

.collision-history {
  border: 1px solid #ffd6dc;
  border-radius: 8px;
  background: #fff7f8;
  overflow: hidden;
}

.collision-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 10px;
  border-bottom: 1px solid #ffe1e6;
}

.collision-history-head > div:first-child {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
}

.collision-history-title {
  font-size: 13px;
  font-weight: 900;
  color: #c81e32;
}

.collision-history-subtitle {
  margin-top: 0;
  font-size: 11px;
  color: #8d5e66;
}

.collision-history-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #9a5260;
  white-space: nowrap;
}

.collision-history-actions button {
  height: 24px;
  padding: 0 8px;
  border: 1px solid #ffc2cc;
  border-radius: 6px;
  background: #fff;
  color: #c81e32;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.collision-history-list {
  display: grid;
  gap: 1px;
  background: #ffe1e6;
}

.collision-history-item {
  display: grid;
  grid-template-columns: minmax(280px, max-content) minmax(0, 1fr);
  align-items: center;
  gap: 6px 12px;
  border: 0;
  background: #fff;
  padding: 6px 10px;
  text-align: left;
  cursor: pointer;
}

.collision-history-item:hover {
  background: #fffafa;
}

.collision-history-main,
.collision-history-detail {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px 7px;
}

.collision-history-main {
  color: #253044;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.25;
}

.collision-history-main strong {
  color: #ff2d3f;
  font-variant-numeric: tabular-nums;
}

.collision-history-detail {
  color: #6f7888;
  font-size: 11px;
  line-height: 1.3;
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

.live-table {
  min-width: 1380px;
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

.match-row {
  cursor: pointer;
}

.match-row:nth-child(4n + 1) td {
  background: #fbfcfe;
}

th.col-live-total,
th.col-live-ltp,
th.col-live {
  background: #edf7ff;
}

.match-row td.live-total-cell,
.match-row td.live-ltp-cell,
.match-row td.live-cell {
  background: #f7fbff;
}

.match-row:nth-child(4n + 1) td.live-total-cell,
.match-row:nth-child(4n + 1) td.live-ltp-cell,
.match-row:nth-child(4n + 1) td.live-cell {
  background: #f1f8ff;
}

/* xG 组（赛中 BSW，薄荷绿，区别于赛前白 + 必发毫秒/现场蓝） */
th.col-xg,
th.col-tg {
  background: #e9f7ef;
}

.match-row td.xg-cell,
.match-row td.tg-cell {
  background: #f4fbf6;
}

.match-row:nth-child(4n + 1) td.xg-cell,
.match-row:nth-child(4n + 1) td.tg-cell {
  background: #eef9f1;
}

/* 预期总进球折叠按钮（同现场最大单的展开交互） */
.tg-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  border: 1px solid #cde7d6;
  border-radius: 5px;
  background: #fff;
  color: #1f7a45;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.tg-toggle.open {
  background: #e9f7ef;
}

.tg-arrow {
  font-style: normal;
  color: #4a9968;
}

/* xG 预期总进球走势图（独立展开行） */
.xg-detail-row td {
  background: #f4fbf6;
  padding: 12px 16px;
}

.tg-chart {
  max-width: 420px;
}

.tg-chart-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}

.tg-title {
  font-size: 13px;
  font-weight: 800;
  color: #1f7a45;
}

.tg-range {
  font-size: 12px;
  color: #6b7a72;
}

.tg-refreshing {
  font-size: 12px;
  color: #7b8a82;
  font-weight: 700;
}

.tg-svg {
  width: 100%;
  height: 64px;
  color: #2e9c5f;
}

.tg-y-guide {
  stroke: #d1d5db;
  stroke-width: 0.9;
  vector-effect: non-scaling-stroke;
}

.tg-guide {
  stroke: #cfe6d8;
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.tg-line {
  stroke: #2e9c5f;
  stroke-width: 1.6;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.tg-dot {
  fill: #2e9c5f;
}

.tg-guide-label {
  fill: #9bb3a5;
  font-size: 8px;
  font-weight: 700;
}

.tg-mark {
  fill: #2e9c5f;
}

.tg-mark-label {
  fill: #1f7a45;
  font-size: 8px;
  font-weight: 800;
}

.tg-empty {
  padding: 16px 0;
  color: #8a958f;
  font-size: 13px;
}

.match-row td.live-total-cell.live-latest,
.match-row td.live-ltp-cell.live-latest,
.match-row td.live-cell.live-latest,
.match-row:nth-child(4n + 1) td.live-total-cell.live-latest,
.match-row:nth-child(4n + 1) td.live-ltp-cell.live-latest,
.match-row:nth-child(4n + 1) td.live-cell.live-latest {
  background: #fff7df;
}

.col-pin {
  width: 44px;
}

.col-league {
  width: 66px;
}

.col-time {
  width: 88px;
}

.col-price {
  width: 58px;
}

.col-index {
  width: 76px;
}

.col-live-total {
  width: 112px;
}

.col-live-ltp {
  width: 122px;
}

.col-action {
  width: 50px;
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
.live-total-cell,
.live-ltp-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.max-cell {
  font-weight: 700;
}

.live-cell {
  font-weight: 400;
}

.match-row td.live-cell.live-trade-alert,
.match-row:nth-child(4n + 1) td.live-cell.live-trade-alert {
  color: #d62929;
  font-weight: 400;
}

.match-row td.live-cell.live-trade-alert-strong,
.match-row:nth-child(4n + 1) td.live-cell.live-trade-alert-strong {
  color: #d62929;
  font-weight: 800;
}

.live-collision-count {
  margin-left: 4px;
  color: #ff2d3f;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.top-trade-collision-count {
  margin-left: 10px;
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

.top-table td.live-trade-alert {
  color: #d62929;
  font-weight: 400;
}

.top-table td.live-trade-alert-strong {
  color: #d62929;
  font-weight: 800;
}

.top-table td.live-trade-normal {
  color: #2f3746;
  font-weight: 400;
}

.top-table tr.latest td.live-trade-normal,
.top-table tr.latest td.live-trade-alert {
  font-weight: 400;
}

.top-table tr.latest td.live-trade-alert-strong {
  font-weight: 800;
}

/* 新进入 TOP10 大单成交时间，与其他 TOP10 成交时间差 < 5s 时高亮（簇拥成交识别） */
.top-table td.time-near-collision-latest,
.top-table tr.latest td.time-near-collision-latest {
  color: #d62929;
  font-weight: 800;
}

.top-table td.time-near-collision-linked {
  color: #d62929;
  font-weight: 400;
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

.mobile-live-meta {
  display: none;
}

.mobile-live-meta .mobile-live-max.live-trade-alert,
.mobile-live-meta .mobile-live-max.live-trade-alert-strong {
  color: #d62929 !important;
}

.mobile-live-meta .mobile-live-max.live-trade-alert {
  font-weight: 400 !important;
}

.mobile-live-meta .mobile-live-max.live-trade-alert-strong {
  font-weight: 800 !important;
}

@media (max-width: 768px) {
  .filter-info {
    width: 100%;
    margin-left: 0;
  }

  .live-table {
    min-width: 1080px;
  }

  .teams-cell {
    min-width: 220px;
    flex-wrap: wrap;
    white-space: normal;
  }

  .mobile-live-meta {
    flex-basis: 100%;
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 4px;
    color: #40506a;
    font-size: 12px;
    line-height: 1.35;
  }

  th.col-live-ltp,
  th.col-live,
  td.live-ltp-cell,
  td.live-cell {
    display: none;
  }
}
</style>
