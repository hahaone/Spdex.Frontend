/**
 * 大注提示（重大成交）。对应旧站 biginfo.aspx。
 * 调 /api/newspdex/big-trades/{eventId}?perGroup=N，
 * 返回 标盘/大小 × 选项分组的最大成交（属性/成交量/价位/时间/交易时占比）。
 */

import type { ApiResponse } from '~/types/auth'

export interface BigTrade {
  sel: string // 主/平/客/大/小
  side: string // 买/卖/买+/卖+
  amount: number
  price: number
  time: string // MM-dd HH:mm:ss
  per: number // 0..1
  highlight: number // 0/1/2
}

export interface BigTradeGroup {
  key: string
  label: string
  market: string // standard / goals
  total: number
  trades: BigTrade[]
}

export interface BigTradesData {
  eventId: number
  homeTeam: string
  awayTeam: string
  groups: BigTradeGroup[]
  accessLocked: boolean
  lockMessage: string | null
}

export function useBigTrades(eventId: MaybeRef<number>, perGroup = 10) {
  const idRef = computed(() => unref(eventId))

  const result = useApiFetch<ApiResponse<BigTradesData>>(
    () => `/api/newspdex/big-trades/${idRef.value}?perGroup=${perGroup}`,
    {
      key: () => `newspdex-bigtrades-${idRef.value}-${perGroup}`,
      server: false,
      watch: [idRef],
    },
  )

  const data = computed<BigTradesData | null>(() => result.data.value?.data ?? null)

  /** 按市场取分组（standard / goals）。 */
  function groupsOf(market: string): BigTradeGroup[] {
    return (data.value?.groups ?? []).filter(g => g.market === market)
  }

  /** 取某 key 的分组（如综合 std-all / ou-all）。 */
  function group(key: string): BigTradeGroup | null {
    return (data.value?.groups ?? []).find(g => g.key === key) ?? null
  }

  // 60s 轮询（成交持续变化）
  usePolling(() => result.refresh(), 60_000)

  return {
    data,
    groupsOf,
    group,
    pending: result.pending,
    refresh: result.refresh,
  }
}
