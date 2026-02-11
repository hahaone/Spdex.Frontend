import type { ApiResponse } from '~/types/match'
import type { UoBigHoldPageResult } from '~/types/uobighold'

interface UoBigHoldParams {
  id: number
  marketType?: number
  order?: number
}

export function useUoBigHold(params: Ref<UoBigHoldParams>) {
  const result = useApiFetch<ApiResponse<UoBigHoldPageResult>>('/api/uobighold', {
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
