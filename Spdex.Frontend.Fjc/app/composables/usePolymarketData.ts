import type {
  BswApiResult,
  PolymarketSoccerMatchLink,
  PolymarketEventTradesAggregate,
  PolymarketEventBookAggregate,
} from '~/types/polymarket'

/** BSW API 成功码 */
const BSW_OK = '00000'

function isBswOk(result: BswApiResult<unknown>): boolean {
  return String(result.code) === BSW_OK
}

/**
 * Polymarket 数据 composable。
 * 通过 Spdex.WebApi 代理接口获取 BSW 的 Polymarket 数据。
 *
 * 流程：spdexEventId → 反查 matchLink → 取 polymarketEventId → 拉取 trades + book
 */
export function usePolymarketData(spdexEventId: Ref<number | null>) {
  const matchLinks = ref<PolymarketSoccerMatchLink[]>([])
  const trades = ref<PolymarketEventTradesAggregate | null>(null)
  const book = ref<PolymarketEventBookAggregate | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const token = useCookie('spdex_token')

  const primaryLink = computed(() => matchLinks.value[0] ?? null)
  const polymarketEventId = computed(() => primaryLink.value?.polymarketEventId ?? null)

  /** 带 auth header 的 $fetch（走 Nuxt proxy，避免 CORS） */
  function apiFetch<T>(path: string, params: Record<string, unknown> = {}) {
    const headers: Record<string, string> = {}
    if (token.value) {
      headers.Authorization = `Bearer ${token.value}`
    }
    return $fetch<T>(path, {
      params,
      headers,
    })
  }

  async function fetchData() {
    const eventId = spdexEventId.value
    if (!eventId) return

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

      const polyEventId = linkResult.data[0]!.polymarketEventId

      // 2. 并行拉取 trades + book
      const [tradesResult, bookResult] = await Promise.all([
        apiFetch<BswApiResult<PolymarketEventTradesAggregate>>(
          `/api/polymarket/Get/Soccer/Trades`,
          { eventId: polyEventId, limit: 10000, includeFamily: true },
        ),
        apiFetch<BswApiResult<PolymarketEventBookAggregate>>(
          `/api/polymarket/Get/Soccer/Book`,
          { eventId: polyEventId, levels: 10, includeFamily: true },
        ),
      ])

      trades.value = isBswOk(tradesResult) ? tradesResult.data : null
      book.value = isBswOk(bookResult) ? bookResult.data : null

      // trades/book 失败时提示（但不阻塞）
      if (!isBswOk(tradesResult)) {
        error.value = `Trades 加载失败: ${tradesResult.info || `code=${tradesResult.code}`}`
      }
      else if (!isBswOk(bookResult)) {
        error.value = `Book 加载失败: ${bookResult.info || `code=${bookResult.code}`}`
      }
    }
    catch (e: unknown) {
      console.error('[usePolymarketData] fetch error:', e)
      error.value = e instanceof Error ? e.message : 'Polymarket 数据加载失败'
    }
    finally {
      loading.value = false
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
    loading,
    error,
    refresh: fetchData,
  }
}
