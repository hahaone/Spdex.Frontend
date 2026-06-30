/**
 * 行展开通用逻辑 composable。
 * 管理 BigHold 类详情页中行展开/收起、RawData 解析与缓存、前一条记录懒加载。
 * 适用于 cs3(1x2)、cs4(O/U) 等使用 BigHoldItemView 的页面。
 */

import type { BigHoldItemView, PriceSizeRow } from '~/types/bighold'
import { calcTradedDiff, parseRawData } from '~/utils/parseRawData'

interface UseDetailExpandOptions {
  /** useBigHoldDetail 的 API 端点，默认 '/api/bighold/previous' */
  previousEndpoint?: string
  /** 批量获取当前记录 + 前一条记录的端点。仅标盘页启用。 */
  batchEndpoint?: string
}

export function useDetailExpand(options: UseDetailExpandOptions = {}) {
  const { previousEndpoint = '/api/bighold/previous', batchEndpoint } = options
  let prefetchRunId = 0

  // ── 行展开状态 ──
  const expandedPcId = ref<number | null>(null)         // Back/Lay/Traded 层展开的行
  const expandedOddsPcId = ref<number | null>(null)     // LastPrice 层展开的行

  // ── 前一条记录懒加载 ──
  const {
    fetchPrevious,
    fetchDetailsBatch,
    clearCache,
    loadingPcId,
    failedPcIds,
    cache: prevCache,
    currentCache,
  } = useBigHoldDetail(previousEndpoint)

  // ── RawData 解析缓存 ──
  const currentParsedCache = reactive(new Map<number, PriceSizeRow[]>())
  const previousParsedCache = reactive(new Map<number, PriceSizeRow[]>())

  /** 切换 Back/Lay/Traded 层展开/收起 */
  async function toggleExpand(item: BigHoldItemView) {
    if (expandedPcId.value === item.pcId) {
      expandedPcId.value = null
      return
    }

    expandedPcId.value = item.pcId
    expandedOddsPcId.value = null

    await ensureRowDetails(item)
  }

  /** 切换 LastPrice 层展开/收起，与 Back/Lay/Traded 层互斥 */
  function toggleOddsExpand(item: BigHoldItemView) {
    if (expandedOddsPcId.value === item.pcId) {
      expandedOddsPcId.value = null
      return
    }
    expandedOddsPcId.value = item.pcId
    expandedPcId.value = null
  }

  /** 重试加载前一条记录 */
  async function retryFetchPrevious(item: BigHoldItemView) {
    if (batchEndpoint) {
      await fetchDetailsBatch([item], batchEndpoint)
      hydrateParsedCaches(item)
      return
    }

    const prev = await fetchPrevious(item.pcId, item.marketId, item.selectionId, item.refreshTime)
    if (prev?.rawData) {
      previousParsedCache.set(item.pcId, parseRawData(prev.rawData))
    }
  }

  /**
   * 批量预取所有 items 的前一条记录（用于页面加载后自动触发深度高亮）。
   * 使用低并发队列，避免标盘打开时瞬间发出过多 previous 请求。
   */
  async function prefetchAllPrevious(items: BigHoldItemView[], concurrency = 3) {
    const runId = ++prefetchRunId

    if (batchEndpoint) {
      const queue = items.filter(item => !currentCache.has(item.pcId) || !prevCache.has(item.pcId))
      if (queue.length === 0) return

      const chunkSize = 20
      for (let i = 0; runId === prefetchRunId && i < queue.length; i += chunkSize) {
        const chunk = queue.slice(i, i + chunkSize)
        await fetchDetailsBatch(chunk, batchEndpoint)
        for (const item of chunk) hydrateParsedCaches(item)
      }
      return
    }

    const queue = items.filter(item => !prevCache.has(item.pcId))
    let index = 0

    async function worker() {
      while (runId === prefetchRunId && index < queue.length) {
        const item = queue[index++]
        if (!item || prevCache.has(item.pcId)) continue
        const prev = await fetchPrevious(item.pcId, item.marketId, item.selectionId, item.refreshTime)
        if (prev?.rawData) {
          previousParsedCache.set(item.pcId, parseRawData(prev.rawData))
        }
      }
    }

    const workerCount = Math.max(1, Math.min(concurrency, queue.length))
    await Promise.allSettled(Array.from({ length: workerCount }, () => worker()))
  }

  async function ensureRowDetails(item: BigHoldItemView) {
    if (batchEndpoint) {
      if (!currentCache.has(item.pcId) || !prevCache.has(item.pcId)) {
        await fetchDetailsBatch([item], batchEndpoint)
      }
      hydrateParsedCaches(item)
      return
    }

    // 兼容其它 BigHold 页面：当前 RawData 仍来自主列表，前一条仍懒加载。
    if (!currentParsedCache.has(item.pcId)) {
      currentParsedCache.set(item.pcId, parseRawData(item.rawData))
    }

    if (!prevCache.has(item.pcId)) {
      const prev = await fetchPrevious(item.pcId, item.marketId, item.selectionId, item.refreshTime)
      if (prev?.rawData) {
        previousParsedCache.set(item.pcId, parseRawData(prev.rawData))
      }
    }
  }

  function hydrateParsedCaches(item: BigHoldItemView) {
    if (!currentParsedCache.has(item.pcId)) {
      const current = currentCache.get(item.pcId)
      currentParsedCache.set(item.pcId, parseRawData(current?.rawData ?? item.rawData))
    }

    if (!previousParsedCache.has(item.pcId)) {
      const previous = prevCache.get(item.pcId)
      if (previous?.rawData) {
        previousParsedCache.set(item.pcId, parseRawData(previous.rawData))
      }
    }
  }

  /** 获取当前记录解析数据 */
  function getCurrentRows(pcId: number): PriceSizeRow[] {
    return currentParsedCache.get(pcId) ?? []
  }

  /** 获取前一条记录解析数据 */
  function getPreviousRows(pcId: number): PriceSizeRow[] {
    return previousParsedCache.get(pcId) ?? []
  }

  /** 获取差额数据 */
  function getDiffRows(pcId: number): PriceSizeRow[] {
    const current = getCurrentRows(pcId)
    const previous = getPreviousRows(pcId)
    if (current.length === 0 || previous.length === 0) return []
    return calcTradedDiff(current, previous)
  }

  /** 收起所有展开行（Tab 切换时调用） */
  function collapseAll() {
    expandedPcId.value = null
    expandedOddsPcId.value = null
  }

  /** 排序切换时重置所有状态 */
  function resetAll() {
    prefetchRunId++
    collapseAll()
    clearCache()
    currentParsedCache.clear()
    previousParsedCache.clear()
  }

  return {
    // 状态
    expandedPcId,
    expandedOddsPcId,
    loadingPcId,
    failedPcIds,
    prevCache,
    currentCache,
    // 操作
    toggleExpand,
    toggleOddsExpand,
    retryFetchPrevious,
    prefetchAllPrevious,
    collapseAll,
    resetAll,
    clearCache,
    // 数据访问
    getCurrentRows,
    getPreviousRows,
    getDiffRows,
  }
}
