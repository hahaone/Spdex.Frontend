import type { ApiResponse } from '~/types/api'
import type { AsianBigHoldResonanceResult } from '~/types/asianbighold'

interface AsianBigHoldResonanceParams {
  id: number
  market?: string
}

export function useAsianBigHoldResonance(params: Ref<AsianBigHoldResonanceParams>, opts: Record<string, unknown> = {}) {
  return useApiFetch<ApiResponse<AsianBigHoldResonanceResult>>('/api/asianbighold/resonance', {
    params,
    watch: [params],
    ...opts,
  })
}
