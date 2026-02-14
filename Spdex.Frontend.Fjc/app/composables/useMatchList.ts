import type { ApiResponse } from '~/types/api'
import type { MatchListResult } from '~/types/match'

interface MatchListParams {
  date?: string | null
  league?: string | null
  jc?: number
  status?: string | null
  page?: number
  pageSize?: number
}

export function useMatchList(params: Ref<MatchListParams>) {
  const refreshing = ref(false)

  const fetchResult = useApiFetch<ApiResponse<MatchListResult>>('/api/matches', {
    params,
    watch: [params],
  })

  /** 手动刷新（不改变参数，仅重新请求） */
  async function manualRefresh() {
    refreshing.value = true
    try {
      await fetchResult.refresh()
    }
    finally {
      refreshing.value = false
    }
  }

  return {
    ...fetchResult,
    refreshing,
    manualRefresh,
  }
}
