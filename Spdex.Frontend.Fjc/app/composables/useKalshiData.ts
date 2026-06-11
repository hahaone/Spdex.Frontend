import type {
  KalshiBswApiResult,
  KalshiOrderbook,
  KalshiSoccerMatchLink,
  KalshiSoccerTradesResponse,
  KalshiTradeWindowStatsResult,
} from '~/types/kalshi'

const BSW_OK = '00000'

function isBswOk(result: KalshiBswApiResult<unknown>): boolean {
  return String(result.code) === BSW_OK
}

export function useKalshiData(spdexEventId: Ref<number | null>) {
  const matchLinks = ref<KalshiSoccerMatchLink[]>([])
  const trades = ref<KalshiSoccerTradesResponse | null>(null)
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
    const headers: Record<string, string> = {}
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

      const [tradesResult, windowStatsResult] = await Promise.all([
        apiFetch<KalshiBswApiResult<KalshiSoccerTradesResponse>>(
          '/api/kalshi/Get/Soccer/Trades',
          { eventTicker: ticker, limit: 3000, source: 'db' },
        ),
        apiFetch<KalshiBswApiResult<KalshiTradeWindowStatsResult>>(
          '/api/kalshi/Get/Soccer/TradeWindowStats',
          { eventTicker: ticker, source: 'db' },
        ).catch(() => null),
      ])

      trades.value = isBswOk(tradesResult) ? tradesResult.data : null
      tradeWindowStats.value = windowStatsResult && isBswOk(windowStatsResult)
        ? windowStatsResult.data
        : null

      // trades 上游失败或为空：静默降级为「暂无数据」，不向用户暴露错误。
    }
    catch (e: unknown) {
      // 上游/网络失败（如代理 502 超时）静默降级：不把原始 fetch 错误（[GET]...: 502）暴露给用户。
      console.error('[useKalshiData] fetch error:', e)
      trades.value = null
      error.value = null
    }
    finally {
      loading.value = false
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
