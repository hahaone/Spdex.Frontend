/**
 * 经典版「欧洲指数」数据（还原旧站 Match/View/EuroOdds）。
 * 调 /api/newspdex/euro-odds/{eventId},返回各博彩公司 即时/初盘 1X2 赔率 + 凯利 + 返还率 + 凯利加权,
 * 及各列最高/最低与均值/凯利方差汇总。
 */

import type { ApiResponse } from '~/types/auth'

export interface EuroBookRow {
  company: string
  home: number
  draw: number
  away: number
  kHome: number
  kDraw: number
  kAway: number
  ret: number
  wHome: number
  wDraw: number
  wAway: number
  hasInit: boolean
  iHome: number
  iDraw: number
  iAway: number
  ikHome: number
  ikDraw: number
  ikAway: number
  iRet: number
}

export interface EuroExtremes {
  home: number, draw: number, away: number
  kHome: number, kDraw: number, kAway: number
  ret: number
  wHome: number, wDraw: number, wAway: number
  iHome: number, iDraw: number, iAway: number
  ikHome: number, ikDraw: number, ikAway: number
  iRet: number
}

export interface EuroAverages {
  homeAvg: number, drawAvg: number, awayAvg: number
  kVarHome: number, kVarDraw: number, kVarAway: number
  iHomeAvg: number, iDrawAvg: number, iAwayAvg: number
  ikVarHome: number, ikVarDraw: number, ikVarAway: number
}

export interface EuroOddsData {
  eventId: number
  homeTeam: string
  awayTeam: string
  matchTime: string
  refreshTime: string
  status: 'ok' | 'no-access' | 'pending'
  lockMessage: string | null
  rows: EuroBookRow[]
  max: EuroExtremes | null
  min: EuroExtremes | null
  avg: EuroAverages | null
}

export function useEuroOdds(eventId: MaybeRef<number>) {
  const idRef = computed(() => unref(eventId))

  const result = useApiFetch<ApiResponse<EuroOddsData>>(
    () => `/api/newspdex/euro-odds/${idRef.value}`,
    {
      key: () => `newspdex-euro-${idRef.value}`,
      server: false,
      watch: [idRef],
    },
  )

  // 30s 轮询（赛前欧赔持续变化）
  usePolling(() => result.refresh(), 30_000, { errorRef: result.error })

  const data = computed<EuroOddsData | null>(() => result.data.value?.data ?? null)

  return {
    data,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
