/**
 * 内盘/外盘资金细分（还原旧站 BaseInfoExtra）。
 * 调 /api/newspdex/inner-outer/{eventId}：
 * 标盘 1X2 主/平/客 的内盘/外盘金额 + 模拟盈亏 + 核心交易时段比例。
 */

import type { ApiResponse } from '~/types/auth'

export interface InnerOuterData {
  eventId: number
  homeTeam: string
  awayTeam: string
  /** 内盘金额 [主, 平, 客]。 */
  innerAmount: number[]
  /** 外盘金额 [主, 平, 客]。 */
  outerAmount: number[]
  /** 内盘模拟盈亏(%) [主, 平, 客]。 */
  innerPayout: number[]
  /** 外盘模拟盈亏(%) [主, 平, 客]。 */
  outerPayout: number[]
  /** 临场最后 1 小时成交占比(%)。 */
  pre1: number
  /** 临场 1–6 小时。 */
  pre6: number
  /** 临场 6–24 小时。 */
  pre24: number
  /** 临场 24–48 小时。 */
  pre48: number
  hasData: boolean
  accessLocked: boolean
  lockMessage: string | null
}

export function useInnerOuter(eventId: MaybeRef<number>) {
  const idRef = computed(() => unref(eventId))

  const result = useApiFetch<ApiResponse<InnerOuterData>>(
    () => `/api/newspdex/inner-outer/${idRef.value}`,
    {
      key: () => `newspdex-inner-outer-${idRef.value}`,
      server: false,
      watch: [idRef],
    },
  )

  const data = computed<InnerOuterData | null>(() => result.data.value?.data ?? null)

  // 30s 轮询（成交持续变化）
  usePolling(() => result.refresh(), 30_000, { pending: result.pending, errorRef: result.error })

  return { data, pending: result.pending, refresh: result.refresh }
}
