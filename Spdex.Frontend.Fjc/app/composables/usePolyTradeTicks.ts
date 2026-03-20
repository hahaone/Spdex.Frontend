import type {
  BswApiResult,
  PolymarketTradeTicksPage,
  PolymarketEventTradesAggregate,
} from '~/types/polymarket'

/** BSW API 成功码 */
const BSW_OK = '00000'
function isBswOk(result: BswApiResult<unknown>): boolean {
  return String(result.code) === BSW_OK
}

/**
 * Polymarket 全量成交分页 composable。
 * 通过 Spdex.WebApi 代理调用 BSW 的 TradeTicks 接口获取分页数据，
 * 同时首次加载 Trades 聚合以获取 market 元数据（runner 名称映射）。
 */
export function usePolyTradeTicks(polymarketEventId: Ref<string | null>) {
  const ticks = ref<PolymarketTradeTicksPage | null>(null)
  const meta = ref<PolymarketEventTradesAggregate | null>(null)
  const loading = ref(false)
  const metaLoading = ref(false)
  const error = ref<string | null>(null)

  const page = ref(1)
  const pageSize = ref(50)

  const token = useCookie('spdex_token')

  function apiFetch<T>(path: string, params: Record<string, unknown> = {}) {
    const headers: Record<string, string> = {}
    if (token.value) headers.Authorization = `Bearer ${token.value}`
    return $fetch<T>(path, { params, headers })
  }

  /** 加载 market 元数据（一次性） */
  async function fetchMeta() {
    const eventId = polymarketEventId.value
    if (!eventId || meta.value) return
    metaLoading.value = true
    try {
      const result = await apiFetch<BswApiResult<PolymarketEventTradesAggregate>>(
        '/api/polymarket/Get/Soccer/Trades',
        { eventId, limit: 1, includeFamily: true },
      )
      meta.value = isBswOk(result) ? result.data : null
    }
    catch { /* 元数据失败不阻塞 */ }
    finally { metaLoading.value = false }
  }

  /** 加载分页成交数据 */
  async function fetchTicks() {
    const eventId = polymarketEventId.value
    if (!eventId) return
    loading.value = true
    error.value = null
    try {
      const result = await apiFetch<BswApiResult<PolymarketTradeTicksPage>>(
        '/api/polymarket/Get/Soccer/TradeTicks',
        { eventId, page: page.value, pageSize: pageSize.value },
      )
      if (isBswOk(result)) {
        ticks.value = result.data
      }
      else {
        error.value = result.info || `code=${result.code}`
      }
    }
    catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '成交数据加载失败'
    }
    finally { loading.value = false }
  }

  function goToPage(p: number) {
    page.value = p
    fetchTicks()
  }

  function setPageSize(size: number) {
    pageSize.value = size
    page.value = 1
    fetchTicks()
  }

  // 监听 eventId 变化
  watch(polymarketEventId, () => {
    page.value = 1
    meta.value = null
    ticks.value = null
    fetchMeta()
    fetchTicks()
  }, { immediate: true })

  return {
    ticks,
    meta,
    loading,
    metaLoading,
    error,
    page,
    pageSize,
    goToPage,
    setPageSize,
    refresh: fetchTicks,
  }
}
