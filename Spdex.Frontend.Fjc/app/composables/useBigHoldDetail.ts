/**
 * 行展开明细数据懒加载 composable。
 * 点击展开行时请求前一条记录，结果缓存在 reactive Map 中避免重复请求。
 */

import type { PreviousRecordResult } from '~/types/bighold'
import type { ApiResponse } from '~/types/api'

export function useBigHoldDetail(endpoint: string = '/api/bighold/previous') {
  const config = useRuntimeConfig()

  /** 缓存：pcId → PreviousRecordResult（null 表示"无前一条记录"，区别于"未请求"） */
  const cache = reactive(new Map<number, PreviousRecordResult | null>())

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

      const resp = await $fetch<ApiResponse<PreviousRecordResult>>(
        `${endpoint}?${params.toString()}`,
        { baseURL },
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

  /** 清空缓存（排序切换时调用） */
  function clearCache() {
    cache.clear()
    failedPcIds.clear()
  }

  return {
    fetchPrevious,
    clearCache,
    loadingPcId,
    failedPcIds,
    cache,
  }
}
