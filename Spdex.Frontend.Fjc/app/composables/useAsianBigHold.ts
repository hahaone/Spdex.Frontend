import type { ApiResponse } from '~/types/api'
import type { AsianBigHoldPageResult } from '~/types/asianbighold'

interface AsianBigHoldParams {
  id: number
  order?: number
  market?: string
}

/**
 * ★ P4: 内置 300ms 防抖，避免快速切换排序/参数时产生无效请求。
 */
export function useAsianBigHold(params: Ref<AsianBigHoldParams>) {
  // 防抖后的参数：延迟 300ms 同步
  const debouncedParams = ref({ ...toValue(params) })
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(params, (newVal) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debouncedParams.value = { ...newVal }
    }, 300)
  }, { deep: true })

  const result = useApiFetch<ApiResponse<AsianBigHoldPageResult>>('/api/asianbighold', {
    params: debouncedParams,
    watch: [debouncedParams],
  })

  /** 手动刷新数据（重新请求 API），跳过防抖 */
  const refreshing = ref(false)
  async function manualRefresh() {
    refreshing.value = true
    try {
      // 立即同步参数，跳过防抖
      if (debounceTimer) clearTimeout(debounceTimer)
      debouncedParams.value = { ...toValue(params) }
      await result.refresh()
    }
    finally {
      refreshing.value = false
    }
  }

  return {
    ...result,
    refreshing,
    manualRefresh,
  }
}
