/**
 * 逐笔成交明细。
 * 调 /api/newspdex/trades/{eventId}?marketType=&selection=&limit=
 * 30s 自动刷新（实时滚球数据需要近实时更新）
 */

import type { ApiResponse } from '~/types/auth'

export type TradeMarketType = 'standard' | 'goals' | 'handicap'
export type TradeSelection = 'home' | 'draw' | 'away' | 'over' | 'under'
export type TradeStatus = 'ok' | 'pending' | 'no-access'

interface BackendTradeRow {
  id: number
  time: string
  price: string
  volume: string
  change: string
  side: string
  listing: string
}

interface BackendTradesResult {
  eventId: number
  marketType: string
  selection: string
  rows: BackendTradeRow[]
  count: number
  status: TradeStatus
}

export function useTradeTicks(
  eventId: MaybeRef<number>,
  marketType: MaybeRef<TradeMarketType> = ref('standard'),
  selection: MaybeRef<TradeSelection> = ref('home'),
  limit: MaybeRef<number> = ref(50),
) {
  const idRef = computed(() => unref(eventId))
  const typeRef = computed(() => unref(marketType))
  const selRef = computed(() => unref(selection))
  const limitRef = computed(() => unref(limit))

  const query = computed(() => ({
    marketType: typeRef.value,
    selection: selRef.value,
    limit: limitRef.value,
  }))

  const result = useApiFetch<ApiResponse<BackendTradesResult>>(
    () => `/api/newspdex/trades/${idRef.value}`,
    {
      key: () => `newspdex-trades-${idRef.value}-${typeRef.value}-${selRef.value}`,
      server: false,
      query,
      watch: [idRef, typeRef, selRef, limitRef],
    },
  )

  usePolling(() => result.refresh(), 30_000)

  const rows = computed(() => result.data.value?.data?.rows ?? [])
  const status = computed<TradeStatus>(() => result.data.value?.data?.status ?? 'pending')
  const count = computed(() => result.data.value?.data?.count ?? 0)

  return {
    rows,
    status,
    count,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
