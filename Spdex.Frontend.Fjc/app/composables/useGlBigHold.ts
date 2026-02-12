import type { ApiResponse } from '~/types/api'
import type { GlBigHoldPageResult } from '~/types/glbighold'

interface GlBigHoldParams {
  id: number
  order?: number
}

export function useGlBigHold(params: Ref<GlBigHoldParams>) {
  const result = useApiFetch<ApiResponse<GlBigHoldPageResult>>('/api/glbighold', {
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
