import type {
  BswApiResult,
  PolymarketSoccerMatchLink,
  PolymarketEventTradesAggregate,
  PolymarketEventBookAggregate,
  PolymarketMarketTradesAggregate,
  PolymarketMarketBookAggregate,
  PolymarketTradeTick,
  PolymarketTradeWindowStatsResult,
} from '~/types/polymarket'

/** BSW API 成功码 */
const BSW_OK = '00000'

function isBswOk(result: BswApiResult<unknown>): boolean {
  return String(result.code) === BSW_OK
}

function shouldLoadSupplementalEvent(link: PolymarketSoccerMatchLink): boolean {
  const text = `${link.polymarketTitle ?? ''} ${link.polymarketSlug ?? ''}`.toLowerCase()
  return text.includes('corner') || text.includes('player')
}

function linkedEventIds(links: PolymarketSoccerMatchLink[]): string[] {
  const ids: string[] = []
  const add = (id: string | null | undefined) => {
    const trimmed = id?.trim()
    if (trimmed && !ids.includes(trimmed)) ids.push(trimmed)
  }

  add(links[0]?.polymarketEventId)
  for (const link of links) {
    if (shouldLoadSupplementalEvent(link)) add(link.polymarketEventId)
  }
  return ids
}

function marketKey(
  market: Pick<PolymarketMarketTradesAggregate | PolymarketMarketBookAggregate, 'marketId' | 'conditionId'>,
  fallback: string,
): string {
  return market.marketId || market.conditionId || fallback
}

function tradeKey(trade: PolymarketTradeTick): string {
  return [
    trade.conditionId,
    trade.outcome,
    trade.timestampUtc,
    trade.price,
    trade.size,
    trade.transactionHash ?? '',
    trade.proxyWallet ?? '',
  ].join('|')
}

function sum(values: Array<number | null | undefined>): number {
  let total = 0
  for (const value of values) {
    if (Number.isFinite(value)) total += Number(value)
  }
  return total
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => Number.isFinite(value))
  return valid.length > 0 ? sum(valid) : null
}

function minUtc(values: Array<string | null | undefined>): string | null {
  const valid = values
    .map(value => (value ? new Date(value).getTime() : NaN))
    .filter(Number.isFinite)
  return valid.length > 0 ? new Date(Math.min(...valid)).toISOString() : null
}

function maxUtc(values: Array<string | null | undefined>): string | null {
  const valid = values
    .map(value => (value ? new Date(value).getTime() : NaN))
    .filter(Number.isFinite)
  return valid.length > 0 ? new Date(Math.max(...valid)).toISOString() : null
}

function mergeTrades(list: Array<PolymarketEventTradesAggregate | null>): PolymarketEventTradesAggregate | null {
  const aggregates = list.filter((item): item is PolymarketEventTradesAggregate => item !== null)
  const base = aggregates[0]
  if (!base) return null

  const markets: PolymarketMarketTradesAggregate[] = []
  const seenMarkets = new Set<string>()
  for (const aggregate of aggregates) {
    aggregate.markets.forEach((market, index) => {
      const key = marketKey(market, `${aggregate.eventId}:trade:${index}`)
      if (seenMarkets.has(key)) return
      seenMarkets.add(key)
      markets.push(market)
    })
  }

  const mergeTicks = (ticks: PolymarketTradeTick[], mode: 'time' | 'size') => {
    const seen = new Set<string>()
    const result: PolymarketTradeTick[] = []
    for (const tick of ticks) {
      const key = tradeKey(tick)
      if (seen.has(key)) continue
      seen.add(key)
      result.push(tick)
    }
    return result.sort((a, b) => mode === 'size'
      ? b.size - a.size
      : new Date(b.timestampUtc).getTime() - new Date(a.timestampUtc).getTime())
  }

  const recentTrades = mergeTicks(aggregates.flatMap(item => item.recentTrades ?? []), 'time')
  const topTrades = mergeTicks(aggregates.flatMap(item => item.topTrades ?? []), 'size')

  return {
    ...base,
    tradeCount: sum(aggregates.map(item => item.tradeCount)),
    totalSize: sum(aggregates.map(item => item.totalSize)),
    totalNotional: sum(aggregates.map(item => item.totalNotional)),
    marketVolume: sumNullable(aggregates.map(item => item.marketVolume)),
    firstTradeAtUtc: minUtc(aggregates.map(item => item.firstTradeAtUtc)),
    lastTradeAtUtc: maxUtc(aggregates.map(item => item.lastTradeAtUtc)),
    markets,
    recentTrades,
    topTrades: topTrades.length > 0 ? topTrades : null,
  }
}

function mergeBooks(list: Array<PolymarketEventBookAggregate | null>): PolymarketEventBookAggregate | null {
  const aggregates = list.filter((item): item is PolymarketEventBookAggregate => item !== null)
  const base = aggregates[0]
  if (!base) return null

  const markets: PolymarketMarketBookAggregate[] = []
  const seenMarkets = new Set<string>()
  for (const aggregate of aggregates) {
    aggregate.markets.forEach((market, index) => {
      const key = marketKey(market, `${aggregate.eventId}:book:${index}`)
      if (seenMarkets.has(key)) return
      seenMarkets.add(key)
      markets.push(market)
    })
  }

  return {
    ...base,
    capturedAtUtc: maxUtc(aggregates.map(item => item.capturedAtUtc)) ?? base.capturedAtUtc,
    markets,
  }
}

/**
 * Polymarket 数据 composable。
 * 通过 Spdex.WebApi 代理接口获取 BSW 的 Polymarket 数据。
 *
 * 流程：spdexEventId → 反查 matchLink → 拉取主 event；再补拉角球/球员等独立 event 并合并 markets。
 */
export function usePolymarketData(spdexEventId: Ref<number | null>) {
  const matchLinks = ref<PolymarketSoccerMatchLink[]>([])
  const trades = ref<PolymarketEventTradesAggregate | null>(null)
  const book = ref<PolymarketEventBookAggregate | null>(null)
  const tradeWindowStats = ref<PolymarketTradeWindowStatsResult | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const token = useCookie('spdex_token')

  const primaryLink = computed(() => matchLinks.value[0] ?? null)
  const polymarketEventId = computed(() => primaryLink.value?.polymarketEventId ?? null)
  let fetchSeq = 0

  /** 带 auth header 的 $fetch（走 Nuxt proxy，避免 CORS） */
  function apiFetch<T>(path: string, params: Record<string, unknown> = {}) {
    const headers: Record<string, string> = { 'X-Spdex-Frontend': 'fjcx' }
    if (token.value) {
      headers.Authorization = `Bearer ${token.value}`
    }
    return $fetch<T>(path, {
      params,
      headers,
    })
  }

  async function fetchEventData(eventId: string, spdexId: number) {
    return Promise.all([
      apiFetch<BswApiResult<PolymarketEventTradesAggregate>>(
        `/api/polymarket/Get/Soccer/Trades`,
        { eventId, spdexEventId: spdexId, limit: 3000, includeFamily: true },
      ).catch(() => null),
      apiFetch<BswApiResult<PolymarketEventBookAggregate>>(
        `/api/polymarket/Get/Soccer/Book`,
        { eventId, spdexEventId: spdexId, levels: 10, includeFamily: true },
      ).catch(() => null),
    ])
  }

  async function fetchData() {
    const eventId = spdexEventId.value
    if (!eventId) return
    const seq = ++fetchSeq

    loading.value = true
    error.value = null

    try {
      // 1. 反查 Polymarket 关联
      const linkResult = await apiFetch<BswApiResult<PolymarketSoccerMatchLink[]>>(
        `/api/polymarket/Get/Soccer/MatchLinksBySpdexEvent`,
        { spdexEventId: eventId, refreshIfEmpty: true },
      )

      if (!isBswOk(linkResult) || !linkResult.data?.length) {
        matchLinks.value = []
        trades.value = null
        book.value = null
        error.value = linkResult.data?.length === 0
          ? '该赛事暂无 Polymarket 数据'
          : (linkResult.info || '查询关联失败')
        return
      }

      matchLinks.value = linkResult.data

      const polyEventIds = linkedEventIds(linkResult.data)
      const primaryPolyEventId = polyEventIds[0]
      if (!primaryPolyEventId) {
        trades.value = null
        book.value = null
        error.value = '该赛事暂无 Polymarket 数据'
        return
      }

      // 2. 先拉主 event，让页面尽快出现；附属角球/球员 event 后面再合并进导航。
      const [[tradesResult, bookResult], windowStatsResult] = await Promise.all([
        fetchEventData(primaryPolyEventId, eventId),
        apiFetch<BswApiResult<PolymarketTradeWindowStatsResult>>(
          `/api/polymarket/Get/Soccer/TradeWindowStats`,
          { polymarketEventId: primaryPolyEventId, spdexEventId: eventId },
        ).catch(() => null), // 新接口失败不影响原有功能
      ])

      if (seq !== fetchSeq) return

      const primaryTrades = tradesResult && isBswOk(tradesResult) ? tradesResult.data : null
      const primaryBook = bookResult && isBswOk(bookResult) ? bookResult.data : null
      trades.value = primaryTrades
      book.value = primaryBook
      tradeWindowStats.value = windowStatsResult && isBswOk(windowStatsResult)
        ? windowStatsResult.data : null
      loading.value = false

      const supplementalIds = polyEventIds.slice(1)
      if (supplementalIds.length > 0) {
        const supplementalResults = await Promise.all(supplementalIds.map(id => fetchEventData(id, eventId)))
        if (seq !== fetchSeq) return

        const supplementalTrades = supplementalResults
          .map(([result]) => result && isBswOk(result) ? result.data : null)
        const supplementalBooks = supplementalResults
          .map(([, result]) => result && isBswOk(result) ? result.data : null)

        trades.value = mergeTrades([primaryTrades, ...supplementalTrades])
        book.value = mergeBooks([primaryBook, ...supplementalBooks])
      }

      // trades/book 上游失败或为空：静默降级为「暂无数据」，不向用户暴露错误。
    }
    catch (e: unknown) {
      // 上游/网络失败（如代理 502 超时）静默降级：不把原始 fetch 错误（[GET]...: 502）暴露给用户，
      // 页面走「赛事已匹配，但暂无成交和盘口数据」空态。
      console.error('[usePolymarketData] fetch error:', e)
      trades.value = null
      book.value = null
      error.value = null
    }
    finally {
      if (seq === fetchSeq) loading.value = false
    }
  }

  // 监听 eventId 变化自动刷新
  watch(spdexEventId, () => { fetchData() }, { immediate: true })

  return {
    matchLinks,
    primaryLink,
    polymarketEventId,
    trades,
    book,
    tradeWindowStats,
    loading,
    error,
    refresh: fetchData,
  }
}
