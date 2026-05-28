/**
 * 个人中心账户聚合 composable。
 * 1. account/me 一次性拿 Users + 锦囊余额 + 有效 Tier
 * 2. billing/orders 拿订单历史
 */

import type { ApiResponse } from '~/types/auth'
import type { AccountSummary, OrderRecord } from '~/types/billing'

interface BackendOrders {
  orders: OrderRecord[]
  serviceAvailable: boolean
}

export function useAccount() {
  const summaryFetch = useApiFetch<ApiResponse<AccountSummary>>(
    '/api/newspdex/account/me',
    { server: false, lazy: true },
  )
  const ordersFetch = useApiFetch<ApiResponse<BackendOrders>>(
    '/api/newspdex/billing/orders',
    { server: false, lazy: true },
  )

  const summary = computed<AccountSummary | null>(() => summaryFetch.data.value?.data ?? null)
  const orders = computed<OrderRecord[]>(() => ordersFetch.data.value?.data?.orders ?? [])
  const ordersServiceAvailable = computed(() => ordersFetch.data.value?.data?.serviceAvailable ?? true)
  const pending = computed(() => summaryFetch.pending.value || ordersFetch.pending.value)

  async function refresh() {
    await Promise.all([summaryFetch.refresh(), ordersFetch.refresh()])
  }

  return {
    summary,
    orders,
    ordersServiceAvailable,
    pending,
    refresh,
  }
}
