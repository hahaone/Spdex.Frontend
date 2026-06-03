/**
 * 拉取会员套餐配置（后端 60s 缓存）。
 * 返回 6 个 tier 的 plans 数组，按 V3 展示顺序：翡翠 / 白金 / 黄金 / 红宝石 / 专家 / 免费。
 */

import type { NuxtApp } from '#app'
import type { ApiResponse } from '~/types/auth'
import type { PaymentPlan } from '~/types/billing'

interface BackendPlans {
  plans: PaymentPlan[]
}

export function useBillingPlans() {
  const { data, pending, error, refresh } = useApiFetch<ApiResponse<BackendPlans>>(
    '/api/newspdex/billing/plans',
    {
      key: 'newspdex-billing-plans',
      server: false,
      lazy: true,
      // 慢变接口 SWR：同会话内再次进页直接复用上次结果(不重拉)，硬刷新才重新请求
      getCachedData: (key: string, nuxtApp: NuxtApp) =>
        (nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]) as ApiResponse<BackendPlans> | undefined,
    },
  )

  const plans = computed<PaymentPlan[]>(() => data.value?.data?.plans ?? [])

  // 顶部 3 张大卡（推荐区） vs 底部 4 张小卡
  const featuredPlans = computed(() => plans.value.filter(p => p.hot > 0))
  const standardPlans = computed(() => plans.value.filter(p => p.hot === 0))

  return {
    plans,
    featuredPlans,
    standardPlans,
    pending,
    error,
    refresh,
  }
}
