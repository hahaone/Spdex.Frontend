import type { ApiResponse, MatchListResult } from '~/types/match'

interface MatchListParams {
  date?: string | null
  league?: string | null
  jc?: number
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
