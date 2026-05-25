import type { ApiResponse } from '~/types/api'
import type { BigHoldPageResult } from '~/types/bighold'

interface BigHoldParams {
  id: number
  order?: number
}

export function useBigHold(params: Ref<BigHoldParams>) {
  const result = useApiFetch<ApiResponse<BigHoldPageResult>>('/api/bighold', {
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
