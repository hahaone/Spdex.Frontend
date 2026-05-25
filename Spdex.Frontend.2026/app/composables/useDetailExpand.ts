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
}

export function useDetailExpand(options: UseDetailExpandOptions = {}) {
  const { previousEndpoint = '/api/bighold/previous' } = options

  // ── 行展开状态 ──
  const expandedPcId = ref<number | null>(null)         // Back/Lay/Traded 层展开的行
  const expandedOddsPcId = ref<number | null>(null)     // LastPrice 层展开的行

  // ── 前一条记录懒加载 ──
  const { fetchPrevious, clearCache, loadingPcId, failedPcIds, cache: prevCache } = useBigHoldDetail(previousEndpoint)

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

    // 解析当前记录 RawData（缓存）
    if (!currentParsedCache.has(item.pcId)) {
      currentParsedCache.set(item.pcId, parseRawData(item.rawData))
    }

    // 懒加载前一条记录
    if (!prevCache.has(item.pcId)) {
      const prev = await fetchPrevious(item.pcId, item.marketId, item.selectionId, item.refreshTime)
      if (prev?.rawData) {
        previousParsedCache.set(item.pcId, parseRawData(prev.rawData))
      }
    }
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
    const prev = await fetchPrevious(item.pcId, item.marketId, item.selectionId, item.refreshTime)
    if (prev?.rawData) {
      previousParsedCache.set(item.pcId, parseRawData(prev.rawData))
    }
  }

  /**
   * 批量预取所有 items 的前一条记录（用于页面加载后自动触发深度高亮）。
   * 并发请求，已缓存的会被 fetchPrevious 内部跳过。
   */
  async function prefetchAllPrevious(items: BigHoldItemView[]) {
    const tasks = items
      .filter(item => !prevCache.has(item.pcId))
      .map(async (item) => {
        const prev = await fetchPrevious(item.pcId, item.marketId, item.selectionId, item.refreshTime)
        if (prev?.rawData) {
          previousParsedCache.set(item.pcId, parseRawData(prev.rawData))
        }
      })
    await Promise.allSettled(tasks)
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
