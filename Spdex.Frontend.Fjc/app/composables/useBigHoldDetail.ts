/**
 * 行展开明细数据懒加载 composable。
 * 点击展开行时请求前一条记录，结果缓存在 reactive Map 中避免重复请求。
 */

import type { BigHoldBatchDetailRequestItem, BigHoldBatchDetailResult, PreviousRecordResult } from '~/types/bighold'
import type { ApiResponse } from '~/types/api'

export function useBigHoldDetail(endpoint: string = '/api/bighold/previous') {
  const config = useRuntimeConfig()
  const token = useCookie('spdex_token')

  /** 缓存：pcId → PreviousRecordResult（null 表示"无前一条记录"，区别于"未请求"） */
  const cache = reactive(new Map<number, PreviousRecordResult | null>())

  /** 当前记录缓存：pcId → PreviousRecordResult（null 表示"当前记录不存在"） */
  const currentCache = reactive(new Map<number, PreviousRecordResult | null>())

  /** 正在加载的 PcId */
  const loadingPcId = ref<number | null>(null)

  /** 加载失败的 PcId 集合 */
  const failedPcIds = reactive(new Set<number>())

  /**
   * 获取前一条记录。
   * 优先从缓存读取；缓存未命中则发请求。
   * extraParams 用于传递 handicap 等额外查询参数（GL/Corner/Asian 需要）。
   */
  async function fetchPrevious(
    pcId: number,
    marketId: number,
    selectionId: number,
    refreshTime: string,
    extraParams?: Record<string, string>,
  ): Promise<PreviousRecordResult | null> {
    // 缓存命中
    if (cache.has(pcId)) {
      return cache.get(pcId) ?? null
    }

    loadingPcId.value = pcId
    failedPcIds.delete(pcId)

    try {
      const baseURL = config.public.apiBase as string
      const params = new URLSearchParams({
        pcId: pcId.toString(),
        marketId: marketId.toString(),
        selectionId: selectionId.toString(),
        refreshTime,
        ...extraParams,
      })

      const headers: Record<string, string> = {}
      if (token.value) {
        headers.Authorization = `Bearer ${token.value}`
      }

      const resp = await $fetch<ApiResponse<PreviousRecordResult>>(
        `${endpoint}?${params.toString()}`,
        { baseURL, headers },
      )

      const result = resp.data ?? null
      cache.set(pcId, result)
      return result
    }
    catch (err) {
      console.error('获取前一条记录失败:', err)
      failedPcIds.add(pcId)
      return null
    }
    finally {
      if (loadingPcId.value === pcId) {
        loadingPcId.value = null
      }
    }
  }

  /**
   * 批量获取当前记录 + 前一条记录。
   * 用于标盘 TOP20 自动深度高亮，避免初始列表携带 RawData，也避免 20 个 previous HTTP 请求。
   */
  async function fetchDetailsBatch(
    items: BigHoldBatchDetailRequestItem[],
    batchEndpoint: string,
  ): Promise<BigHoldBatchDetailResult['items']> {
    const pendingItems = items
      .filter(item => item.pcId > 0 && (!currentCache.has(item.pcId) || !cache.has(item.pcId)))
      .filter((item, index, arr) => arr.findIndex(v => v.pcId === item.pcId) === index)

    if (pendingItems.length === 0) return []

    loadingPcId.value = pendingItems[0]?.pcId ?? null
    for (const item of pendingItems) failedPcIds.delete(item.pcId)

    try {
      const baseURL = config.public.apiBase as string
      const headers: Record<string, string> = {}
      if (token.value) {
        headers.Authorization = `Bearer ${token.value}`
      }

      const resp = await $fetch<ApiResponse<BigHoldBatchDetailResult>>(batchEndpoint, {
        baseURL,
        method: 'POST',
        headers,
        body: { items: pendingItems },
      })

      const details = resp.data?.items ?? []
      const returnedPcIds = new Set(details.map(item => item.pcId))

      for (const detail of details) {
        currentCache.set(detail.pcId, detail.current ?? null)
        cache.set(detail.pcId, detail.previous ?? null)
      }

      for (const item of pendingItems) {
        if (!returnedPcIds.has(item.pcId)) {
          currentCache.set(item.pcId, null)
          cache.set(item.pcId, null)
        }
      }

      return details
    }
    catch (err) {
      console.error('批量获取行明细失败:', err)
      for (const item of pendingItems) failedPcIds.add(item.pcId)
      return []
    }
    finally {
      loadingPcId.value = null
    }
  }

  /** 清空缓存（排序切换时调用） */
  function clearCache() {
    cache.clear()
    currentCache.clear()
    failedPcIds.clear()
  }

  return {
    fetchPrevious,
    fetchDetailsBatch,
    clearCache,
    loadingPcId,
    failedPcIds,
    cache,
    currentCache,
  }
}
