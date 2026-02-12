import type { ApiResponse } from '~/types/api'
import type { CsBigHoldPageResult } from '~/types/csbighold'

interface CsBigHoldParams {
  id: number
  order?: number
}

export function useCsBigHold(params: Ref<CsBigHoldParams>) {
  const result = useApiFetch<ApiResponse<CsBigHoldPageResult>>('/api/csbighold', {
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
