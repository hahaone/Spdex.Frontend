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
          { eventTicker: ticker, limit: 10000, source: 'db' },
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

      if (!isBswOk(tradesResult)) {
        error.value = `Kalshi 成交加载失败: ${tradesResult.info || `code=${tradesResult.code}`}`
      }
    }
    catch (e: unknown) {
      console.error('[useKalshiData] fetch error:', e)
      error.value = e instanceof Error ? e.message : 'Kalshi 数据加载失败'
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
      orderbook.value = null
      orderbookError.value = e instanceof Error ? e.message : 'Kalshi 盘口加载失败'
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
