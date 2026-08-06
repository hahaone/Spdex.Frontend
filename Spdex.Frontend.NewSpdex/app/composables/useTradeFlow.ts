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
  resolution: string
  sourcePointCount: number
  returnedPointCount: number
  sampled: boolean
  timePrecision: string
  status: 'ok' | 'pending' | 'no-access'
}

export function useTradeFlow(
  eventId: MaybeRef<number>,
  market: MaybeRef<string>,
  selection: MaybeRef<string>,
  granularity: MaybeRef<string> = ref('raw'),
  enabled?: MaybeRef<boolean>,
  loadContext?: string,
) {
  const idRef = computed(() => unref(eventId))
  const marketRef = computed(() => unref(market))
  const selectionRef = computed(() => unref(selection))
  const granRef = computed(() => unref(granularity))
  const enabledRef = computed(() => enabled == null ? true : unref(enabled))
  const manualRefresh = enabled != null

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
      ...(loadContext ? { headers: { 'X-Spdex-Load-Context': loadContext } } : {}),
      ...(manualRefresh
        ? { immediate: false, watch: false }
        : { watch: [idRef, marketRef, selectionRef, granRef] }),
    },
  )

  if (manualRefresh) {
    watch([idRef, marketRef, selectionRef, granRef, enabledRef], () => {
      if (enabledRef.value && idRef.value > 0) result.refresh()
    }, { immediate: true })
  }

  // 60s 自动刷新
  usePolling(() => { if (enabledRef.value) result.refresh() }, 60_000, {
    enabled: enabledRef,
    pending: result.pending,
    errorRef: result.error,
  })

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
