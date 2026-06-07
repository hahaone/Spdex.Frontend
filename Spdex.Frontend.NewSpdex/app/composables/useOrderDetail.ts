/**
 * 经典版「完整明细」数据。调 /api/newspdex/order-detail/{eventId}?market=standard。
 * 返回标盘 主/平/客 逐刷新 PriceCalc 全字段（价位/成交量/成交变化/属性/挂牌倾向 + 卖方/买方挂牌三档）。
 * 前端据此渲染 综合明细 + 主/平/客明细 4 个 tab。
 */

import type { ApiResponse } from '~/types/auth'

export interface OrderLevel {
  odds: number
  size: number
}

export interface OrderRow {
  side: string // 选项 key（home/draw/away/over/under/cs{id}）
  time: string
  ts: string
  price: number
  amount: number
  change: number
  attr: string
  listing: number
  listingAttr: string
  lay: OrderLevel[]
  back: OrderLevel[]
}

export interface OrderSelection {
  key: string
  tab: string // 简称（主队/平局/客队 / 大球/小球 / 比分）
  name: string // 全名（队名 / 大球 2.5 / 比分）
}

export interface OrderDetailData {
  eventId: number
  homeTeam: string
  awayTeam: string
  matchTime: string
  market: string
  title: string
  status: 'ok' | 'no-access' | 'pending'
  lockMessage: string | null
  selections: OrderSelection[]
  rows: OrderRow[]
}

export function useOrderDetail(eventId: MaybeRef<number>, market: MaybeRef<string> = 'standard') {
  const idRef = computed(() => unref(eventId))
  const mktRef = computed(() => unref(market) || 'standard')

  const result = useApiFetch<ApiResponse<OrderDetailData>>(
    () => `/api/newspdex/order-detail/${idRef.value}?market=${mktRef.value}`,
    {
      key: () => `newspdex-orderdetail-${idRef.value}-${mktRef.value}`,
      server: false,
      watch: [idRef, mktRef],
    },
  )

  // 30s 轮询（赛前盘口持续变化）
  usePolling(() => result.refresh(), 30_000, { errorRef: result.error })

  const data = computed<OrderDetailData | null>(() => result.data.value?.data ?? null)

  return {
    data,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
