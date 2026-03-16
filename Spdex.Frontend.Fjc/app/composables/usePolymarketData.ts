import type {
  BswApiResult,
  PolymarketSoccerMatchLink,
  PolymarketEventTradesAggregate,
  PolymarketEventBookAggregate,
} from '~/types/polymarket'

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

  const primaryLink = computed(() => matchLinks.value[0] ?? null)
  const polymarketEventId = computed(() => primaryLink.value?.polymarketEventId ?? null)

  async function fetchData() {
    const eventId = spdexEventId.value
    if (!eventId) return

    loading.value = true
    error.value = null

    try {
      // 1. 反查 Polymarket 关联
      const linkResult = await $fetch<BswApiResult<PolymarketSoccerMatchLink[]>>(
        `/api/polymarket/Get/Soccer/MatchLinksBySpdexEvent`,
        { params: { spdexEventId: eventId, refreshIfEmpty: true } },
      )

      if (linkResult.code !== 0 || !linkResult.data?.length) {
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
        $fetch<BswApiResult<PolymarketEventTradesAggregate>>(
          `/api/polymarket/Get/Soccer/Trades`,
          { params: { eventId: polyEventId, limit: 10000, includeFamily: true } },
        ),
        $fetch<BswApiResult<PolymarketEventBookAggregate>>(
          `/api/polymarket/Get/Soccer/Book`,
          { params: { eventId: polyEventId, levels: 10, includeFamily: true } },
        ),
      ])

      trades.value = tradesResult.code === 0 ? tradesResult.data : null
      book.value = bookResult.code === 0 ? bookResult.data : null
    }
    catch (e: unknown) {
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
