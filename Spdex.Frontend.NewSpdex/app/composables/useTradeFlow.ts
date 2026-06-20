/**
 * 成交走势图（E1 原始成交明细）数据。
 * 调 /api/newspdex/charts/{eventId}/tradeflow?market=&selection=&granularity=，
 * 返回单选项的「时间桶 × 成交属性(买/卖/冲/买+/卖+/换)」聚合 + 价位线。
 */

import type { ApiResponse } from '~/types/auth'

export interface TradeFlowBucket {
  time: string
  items: Record<string, number>
  price: number | null
}

export interface TradeFlowResult {
  eventId: string
  market: string
  selection: string
  selectionLabel: string
  attrs: string[]
  buckets: TradeFlowBucket[]
  status: 'ok' | 'pending' | 'no-access'
}

export function useTradeFlow(
  eventId: MaybeRef<number>,
  market: MaybeRef<string>,
  selection: MaybeRef<string>,
  granularity: MaybeRef<string> = ref('5m'),
) {
  const idRef = computed(() => unref(eventId))
  const marketRef = computed(() => unref(market))
  const selectionRef = computed(() => unref(selection))
  const granRef = computed(() => unref(granularity))

  const query = computed(() => ({
    market: marketRef.value,
    selection: selectionRef.value,
    granularity: granRef.value,
  }))

  const result = useApiFetch<ApiResponse<TradeFlowResult>>(
    () => `/api/newspdex/charts/${idRef.value}/tradeflow`,
    {
      key: () => `newspdex-tradeflow-${idRef.value}-${marketRef.value}-${selectionRef.value}-${granRef.value}`,
      server: false,
      query,
      watch: [idRef, marketRef, selectionRef, granRef],
    },
  )

  // 60s 自动刷新
  usePolling(() => result.refresh(), 60_000, { pending: result.pending, errorRef: result.error })

  const data = computed<TradeFlowResult | null>(() => result.data.value?.data ?? null)
  const status = computed<'ok' | 'pending' | 'no-access'>(() => data.value?.status ?? 'pending')

  return {
    data,
    status,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
