import type {
  KalshiBswApiResult,
  KalshiCandlestickResponse,
  KalshiCandlestickSeries,
  KalshiOrderbook,
  KalshiSoccerMatchLink,
  KalshiSoccerTradesResponse,
  KalshiTradeWindowStatsResult,
} from '~/types/kalshi'

const BSW_OK = '00000'

function isBswOk(result: KalshiBswApiResult<unknown>): boolean {
  return String(result.code) === BSW_OK
}

export function useKalshiData(
  spdexEventId: Ref<number | null>,
  options: { withWindowStats?: boolean, withCandlesticks?: boolean } = {},
) {
  // 各页面只拉自己用到的数据：kalshi 详情页不用 windowStats、cs3 不用 candlesticks，避免无谓的重查询。
  const { withWindowStats = true, withCandlesticks = true } = options
  const matchLinks = ref<KalshiSoccerMatchLink[]>([])
  const trades = ref<KalshiSoccerTradesResponse | null>(null)
  const candlesticks = ref<KalshiCandlestickSeries[]>([])
  const candlesticksLoading = ref(false)
  const tradeWindowStats = ref<KalshiTradeWindowStatsResult | null>(null)
  const orderbook = ref<KalshiOrderbook | null>(null)
  const loading = ref(false)
  const orderbookLoading = ref(false)
  const error = ref<string | null>(null)
  const orderbookError = ref<string | null>(null)

  const token = useCookie('spdex_token')

  const primaryLink = computed(() => matchLinks.value[0] ?? null)
  const kalshiEventTicker = computed(() => primaryLink.value?.kalshiEventTicker ?? null)

  function apiFetch<T>(path: string, params: Record<string, unknown> = {}) {
    const headers: Record<string, string> = { 'X-Spdex-Frontend': 'fjcx' }
    if (token.value) {
      headers.Authorization = `Bearer ${token.value}`
    }
    return $fetch<T>(path, { params, headers })
  }

  async function fetchData() {
    const eventId = spdexEventId.value
    if (!eventId) return

    loading.value = true
    error.value = null
    orderbook.value = null
    orderbookError.value = null
    candlesticks.value = []

    try {
      const linkResult = await apiFetch<KalshiBswApiResult<KalshiSoccerMatchLink[]>>(
        '/api/kalshi/Get/Soccer/MatchLinksBySpdexEvent',
        { spdexEventId: eventId, refreshIfEmpty: true },
      )

      if (!isBswOk(linkResult) || !linkResult.data?.length) {
        matchLinks.value = []
        trades.value = null
        tradeWindowStats.value = null
        error.value = linkResult.data?.length === 0
          ? '该赛事暂无 Kalshi 数据'
          : (linkResult.info || '查询 Kalshi 关联失败')
        return
      }

      matchLinks.value = linkResult.data
      const ticker = linkResult.data[0]!.kalshiEventTicker

      // Trades 必拉；TradeWindowStats 仅在用到它的页面(如 cs3)才并行拉——kalshi 详情页不用,省一次重查询。
      const [tradesResult, windowStatsResult] = await Promise.all([
        apiFetch<KalshiBswApiResult<KalshiSoccerTradesResponse>>(
          '/api/kalshi/Get/Soccer/Trades',
          { eventTicker: ticker, limit: 3000, source: 'db' },
        ),
        withWindowStats
          ? apiFetch<KalshiBswApiResult<KalshiTradeWindowStatsResult>>(
              '/api/kalshi/Get/Soccer/TradeWindowStats',
              { eventTicker: ticker, source: 'db' },
            ).catch(() => null)
          : Promise.resolve(null),
      ])

      trades.value = isBswOk(tradesResult) ? tradesResult.data : null
      tradeWindowStats.value = windowStatsResult && isBswOk(windowStatsResult)
        ? windowStatsResult.data
        : null

      // 走势图 K线「后台」加载,不阻塞主内容(概率/成交/Ks指数)的渲染;只有用到走势图的页面才拉。
      if (withCandlesticks) {
        void loadCandlesticks()
      }

      // trades 上游失败或为空：静默降级为「暂无数据」，不向用户暴露错误。
    }
    catch (e: unknown) {
      // 上游/网络失败（如代理 502 超时）静默降级：不把原始 fetch 错误（[GET]...: 502）暴露给用户。
      console.error('[useKalshiData] fetch error:', e)
      trades.value = null
      candlesticks.value = []
      error.value = null
    }
    finally {
      loading.value = false
    }
  }

  // 走势图 K线：单独后台拉取(不在主 loading 里),失败静默降级为空(走势图回退为单点 lastPct)。
  async function loadCandlesticks() {
    const candleTickers = (trades.value?.trades.markets ?? [])
      .map(m => m.marketTicker)
      .filter(t => typeof t === 'string' && t.length > 0)
    if (candleTickers.length === 0) {
      candlesticks.value = []
      return
    }
    candlesticksLoading.value = true
    try {
      const candleResult = await apiFetch<KalshiBswApiResult<KalshiCandlestickResponse>>(
        '/api/kalshi/Get/Market/Candlesticks',
        { marketTickers: candleTickers.join(','), hours: 720, periodInterval: 60, source: 'db' },
      ).catch(() => null)
      candlesticks.value = candleResult && isBswOk(candleResult)
        ? (candleResult.data?.series ?? [])
        : []
    }
    finally {
      candlesticksLoading.value = false
    }
  }

  async function fetchOrderbook(marketTicker: string) {
    if (!marketTicker) return
    orderbookLoading.value = true
    orderbookError.value = null
    try {
      const result = await apiFetch<KalshiBswApiResult<KalshiOrderbook>>(
        '/api/kalshi/Get/Market/Orderbook',
        { marketTicker, depth: 10, source: 'db' },
      )
      orderbook.value = isBswOk(result) ? result.data : null
      if (!isBswOk(result)) {
        orderbookError.value = result.info || 'Kalshi 盘口加载失败'
      }
    }
    catch (e: unknown) {
      // 静默降级：不暴露原始 fetch 错误（[GET]...: 502），给一句友好提示即可。
      console.error('[useKalshiData] orderbook error:', e)
      orderbook.value = null
      orderbookError.value = 'Kalshi 盘口暂不可用'
    }
    finally {
      orderbookLoading.value = false
    }
  }

  watch(spdexEventId, () => { fetchData() }, { immediate: true })

  return {
    matchLinks,
    primaryLink,
    kalshiEventTicker,
    trades,
    candlesticks,
    candlesticksLoading,
    tradeWindowStats,
    orderbook,
    loading,
    orderbookLoading,
    error,
    orderbookError,
    refresh: fetchData,
    fetchOrderbook,
  }
}
