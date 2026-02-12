import type { ApiResponse } from '~/types/api'
import type { CornerBigHoldPageResult } from '~/types/cornerbighold'

interface CornerBigHoldParams {
  id: number
  order?: number
}

export function useCornerBigHold(params: Ref<CornerBigHoldParams>) {
  const result = useApiFetch<ApiResponse<CornerBigHoldPageResult>>('/api/cornerbighold', {
    params,
    watch: [params],
  })

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
