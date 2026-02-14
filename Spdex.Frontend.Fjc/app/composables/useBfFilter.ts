/**
 * 标盘提炼表三页面 API composable。
 * 对应后端 BfFilterController 的三个端点。
 */

import type { ApiResponse } from '~/types/api'
import type { Filter1Result, Filter2Result, Filter3Result, AsianFilter1Result } from '~/types/bffilter'

/** [标盘提炼表] GET /api/bighold/filter1?id=X */
export function useBfFilter1(eventId: Ref<number>) {
  const url = computed(() => `/api/bighold/filter1?id=${eventId.value}`)
  return useApiFetch<ApiResponse<Filter1Result>>(url, {
    watch: [eventId],
  })
}

/** [指数提炼表] GET /api/bighold/filter2?id=X */
export function useBfFilter2(eventId: Ref<number>) {
  const url = computed(() => `/api/bighold/filter2?id=${eventId.value}`)
  return useApiFetch<ApiResponse<Filter2Result>>(url, {
    watch: [eventId],
  })
}

/** [挂牌指数提炼表] GET /api/bighold/filter3?id=X&time=T */
export function useBfFilter3(eventId: Ref<number>, time: Ref<string | null>) {
  const url = computed(() => {
    let path = `/api/bighold/filter3?id=${eventId.value}`
    if (time.value) {
      path += `&time=${encodeURIComponent(time.value)}`
    }
    return path
  })
  return useApiFetch<ApiResponse<Filter3Result>>(url, {
    watch: [eventId, time],
  })
}

/** [亚盘提炼表] GET /api/bighold/asian-filter1?id=X */
export function useAsianFilter1(eventId: Ref<number>) {
  const url = computed(() => `/api/bighold/asian-filter1?id=${eventId.value}`)
  return useApiFetch<ApiResponse<AsianFilter1Result>>(url, {
    watch: [eventId],
  })
}
