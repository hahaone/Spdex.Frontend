import type { ApiResponse } from '~/types/api'
import type { AsianBigHoldPageResult } from '~/types/asianbighold'

interface AsianBigHoldParams {
  id: number
  order?: number
}

export function useAsianBigHold(params: Ref<AsianBigHoldParams>) {
  const result = useApiFetch<ApiResponse<AsianBigHoldPageResult>>('/api/asianbighold', {
    params,
    watch: [params],
  })

  /** 手动刷新数据（重新请求 API） */
  const refreshing = ref(false)
  async function manualRefresh() {
    refreshing.value = true
    try {
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
