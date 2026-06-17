/**
 * 经典版「正确比分明细」数据（还原旧站 Match/View/CorrectScore）。
 * 调 /api/newspdex/correct-score/{eventId}?offsets=0,120,{reviewMin}，
 * 返回 19 比分 × {赔率/成交/锁定/比例/盈亏/指数} 矩阵的多时间块（明细/2小时/快速回顾）。
 */

import type { ApiResponse } from '~/types/auth'

export interface CsCell {
  odds: number
  oddsDir: number
  traded: number
  locked: number
  ratio: number
  ratioDir: number
  payout: number
  index: number
}

export interface CsScore { key: string, label: string, group: number }

export interface CsBlock {
  offsetMin: number
  label: string
  totalAmount: number
  bigTrade: string | null
  cells: Record<string, CsCell>
}

export interface CorrectScoreData {
  eventId: number
  homeTeam: string
  awayTeam: string
  matchTime: string
  refreshTime: string
  csIndex: number
  status: 'ok' | 'no-access' | 'pending'
  lockMessage: string | null
  scores: CsScore[]
  blocks: CsBlock[]
}

export function useCorrectScore(eventId: MaybeRef<number>, reviewMin: MaybeRef<number> = 360) {
  const idRef = computed(() => unref(eventId))
  const revRef = computed(() => unref(reviewMin))
  const offsets = computed(() => `0,120,${revRef.value}`)

  const result = useApiFetch<ApiResponse<CorrectScoreData>>(
    () => `/api/newspdex/correct-score/${idRef.value}?offsets=${offsets.value}`,
    {
      key: () => `newspdex-cs-${idRef.value}-${revRef.value}`,
      server: false,
      watch: [idRef, revRef],
    },
  )

  // 30s 轮询（赛前比分盘持续变化）
  usePolling(() => result.refresh(), 30_000, { pending: result.pending, errorRef: result.error })

  // 硬刷新兜底:server:false + 函数式 URL 水合时偶发不触发首次客户端取数 → 空白（见 useEuroOdds）。
  onMounted(() => {
    if (!result.data.value && !result.pending.value) result.refresh()
  })

  const data = computed<CorrectScoreData | null>(() => result.data.value?.data ?? null)

  return {
    data,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
