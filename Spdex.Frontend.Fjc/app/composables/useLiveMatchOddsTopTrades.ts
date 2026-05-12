import type { ApiResponse } from '~/types/api'
import type { LiveMatchOddsEventItem, LiveMatchOddsTopTradesResponse } from '~/types/live'

const BATCH_SIZE = 20
const MAX_CONCURRENCY = 3

export interface LiveMatchOddsMarketRef {
  eventId: number
  marketId: number
}

export function useLiveMatchOddsTopTrades(markets: Ref<LiveMatchOddsMarketRef[]>) {
  const data = ref<LiveMatchOddsTopTradesResponse | null>(null)
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref<string | null>(null)
  const token = useCookie('spdex_token')
  let pendingRefresh = false

  async function refresh(options: { silent?: boolean } = {}) {
    const refs = dedupeMarkets(markets.value)
    const ids = refs.map(ref => ref.eventId)
    if (refs.length === 0) {
      data.value = null
      error.value = null
      return
    }

    if (refreshing.value) {
      pendingRefresh = true
      return
    }

    refreshing.value = true
    if (!options.silent) {
      loading.value = true
    }

    error.value = null
    let successCount = 0
    let failureCount = 0
    let firstError: unknown = null

    const requested = new Set(ids)
    const itemMap = new Map<number, LiveMatchOddsEventItem>()
    const missingSet = new Set<number>()
    const pendingSet = new Set<number>()

    for (const item of data.value?.items ?? []) {
      const eventId = Number(item.eventId)
      if (requested.has(eventId)) {
        itemMap.set(eventId, item)
      }
    }

    for (const id of data.value?.missingEventIds ?? []) {
      const eventId = Number(id)
      if (requested.has(eventId)) {
        missingSet.add(eventId)
      }
    }

    for (const id of data.value?.pendingEventIds ?? []) {
      const eventId = Number(id)
      if (requested.has(eventId)) {
        pendingSet.add(eventId)
      }
    }

    try {
      const batches = chunk(refs, BATCH_SIZE)
      let cursor = 0

      async function fetchNextBatch() {
        while (cursor < batches.length) {
          const batch = batches[cursor++]
          if (!batch) return

          try {
            const result = await fetchBatch(batch)
            mergeBatch(ids, itemMap, missingSet, pendingSet, batch.map(ref => ref.eventId), result)
            successCount += 1
          }
          catch (err) {
            failureCount += 1
            firstError ??= err
          }
        }
      }

      await Promise.all(
        Array.from({ length: Math.min(MAX_CONCURRENCY, batches.length) }, fetchNextBatch),
      )

      if (successCount === 0 && failureCount > 0) {
        throw firstError ?? new Error('现场数据加载失败')
      }
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : '现场数据加载失败'
    }
    finally {
      refreshing.value = false
      if (!options.silent) {
        loading.value = false
      }

      if (pendingRefresh) {
        pendingRefresh = false
        void refresh({ silent: true })
      }
    }
  }

  async function fetchBatch(markets: LiveMatchOddsMarketRef[]) {
    const headers: Record<string, string> = {}
    if (token.value) {
      headers.Authorization = `Bearer ${token.value}`
    }

    const result = await $fetch<ApiResponse<LiveMatchOddsTopTradesResponse>>(
      '/api/live/match-odds/top-trades',
      {
        method: 'POST',
        body: { markets, limit: 10 },
        headers,
      },
    )

    if (result.code !== 0 || !result.data) {
      throw new Error(result.message || '现场数据加载失败')
    }

    return result.data
  }

  function dedupeMarkets(items: LiveMatchOddsMarketRef[]): LiveMatchOddsMarketRef[] {
    const map = new Map<number, LiveMatchOddsMarketRef>()
    for (const item of items) {
      const eventId = Number(item.eventId)
      const marketId = Number(item.marketId)
      if (!Number.isFinite(eventId) || eventId <= 0 || !Number.isFinite(marketId) || marketId <= 0) {
        continue
      }

      map.set(eventId, { eventId, marketId })
    }
    return Array.from(map.values())
  }

  function mergeBatch(
    requestedIds: number[],
    itemMap: Map<number, LiveMatchOddsEventItem>,
    missingSet: Set<number>,
    pendingSet: Set<number>,
    batchIds: number[],
    response: LiveMatchOddsTopTradesResponse,
  ) {
    for (const id of batchIds) {
      missingSet.delete(id)
      pendingSet.delete(id)
    }

    for (const item of response.items) {
      const eventId = Number(item.eventId)
      if (Number.isFinite(eventId)) {
        itemMap.set(eventId, item)
        missingSet.delete(eventId)
        pendingSet.delete(eventId)
      }
    }

    for (const id of response.pendingEventIds ?? []) {
      const eventId = Number(id)
      if (Number.isFinite(eventId) && !itemMap.has(eventId)) {
        pendingSet.add(eventId)
        missingSet.delete(eventId)
      }
    }

    for (const id of response.missingEventIds) {
      const eventId = Number(id)
      if (Number.isFinite(eventId) && !itemMap.has(eventId) && !pendingSet.has(eventId)) {
        missingSet.add(eventId)
      }
    }

    data.value = buildResponseSnapshot(
      requestedIds,
      itemMap,
      missingSet,
      pendingSet,
      response.limit,
      response.scope,
      response.timestamp,
      response.missingEvents ?? [],
    )
  }

  function buildResponseSnapshot(
    requestedIds: number[],
    itemMap: Map<number, LiveMatchOddsEventItem>,
    missingSet: Set<number>,
    pendingSet: Set<number>,
    limit: number,
    scope: string,
    timestamp: string,
    missingEvents: LiveMatchOddsTopTradesResponse['missingEvents'],
  ): LiveMatchOddsTopTradesResponse {
    const items = requestedIds
      .map(id => itemMap.get(id))
      .filter((item): item is LiveMatchOddsEventItem => item != null)

    return {
      items,
      missingEventIds: requestedIds
        .filter(id => !itemMap.has(id) && missingSet.has(id))
        .map(String),
      pendingEventIds: requestedIds
        .filter(id => !itemMap.has(id) && pendingSet.has(id))
        .map(String),
      count: items.length,
      limit,
      scope,
      timestamp,
      missingEvents,
    }
  }

  function chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size))
    }
    return chunks
  }

  const byEventId = computed(() => {
    const map = new Map<number, LiveMatchOddsTopTradesResponse['items'][number]>()
    for (const item of data.value?.items ?? []) {
      const eventId = Number(item.eventId)
      if (Number.isFinite(eventId)) {
        map.set(eventId, item)
      }
    }
    return map
  })

  return {
    data,
    byEventId,
    loading,
    refreshing,
    error,
    refresh,
  }
}
