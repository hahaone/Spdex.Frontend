/**
 * 实时赛事列表。调 /api/newspdex/live/list?tab=
 * tab: running 进行中 / upcoming 未开赛(未来24h) / finished 已结束(过去48h) / yesterday 昨日 / before 前日
 */

import type { ApiResponse } from '~/types/auth'

export type LiveTabKey = 'running' | 'upcoming' | 'finished' | 'yesterday' | 'before'

export interface LiveOddsCell { label: string, odd: string }
export interface LiveOddsMarket { market: string, line?: string | null, cells: LiveOddsCell[] }
export interface LiveOdds { score?: string | null, minute?: string | null, markets: LiveOddsMarket[] }

export interface LiveModel {
  xgHome: number
  xgAway: number
  control: [number, number]
  currentGoals: number
  remainingGoals: number
  modelTotalGoals: number
  redCards: number
  goalLine?: string | null
  modelOverPct?: number | null
  bookOverPct?: number | null
  edgePct?: number | null
  lean: string
}

export interface LiveBigBet { amountText: string, side: string, odd: number, attr: string }

export interface LiveStatPair { label: string, home: number, away: number }
export interface LiveStats {
  shots: LiveStatPair
  shotsOnTarget: LiveStatPair
  dangerousAttacks: LiveStatPair
  xg: LiveStatPair
}

export interface LiveListItem {
  eventId: number
  leagueName: string
  homeTeam: string
  awayTeam: string
  status: 'running' | 'upcoming' | 'finished'
  minute: string
  kickoffTime: string
  score: [number, number]
  halfScore: string
  corners: [number, number]
  cardBadges: Array<{ side: string, color: string, count: number }>
  stats: LiveStats | null
  liveOdds: LiveOdds | null
  model: LiveModel | null
  bigBet: LiveBigBet | null
  doubleRed: boolean
  dataStatus: string
}

interface BackendLiveListResult { matches: LiveListItem[], tab: string }

export function useLiveList(tab: MaybeRef<LiveTabKey> = ref('running')) {
  const tabRef = computed(() => unref(tab))
  const query = computed(() => ({ tab: tabRef.value }))

  const result = useApiFetch<ApiResponse<BackendLiveListResult>>(
    '/api/newspdex/live/list',
    {
      key: () => `newspdex-live-${tabRef.value}`,
      server: false,
      lazy: true,
      query,
      watch: [tabRef],
    },
  )

  // 30s 自动刷新（进行中/未开赛需要；其余 tab 也无妨）
  usePolling(() => result.refresh(), 30_000)

  const matches = computed<LiveListItem[]>(() => result.data.value?.data?.matches ?? [])
  const count = computed(() => matches.value.length)

  /** 按联赛分组（保持后端返回顺序）。 */
  const grouped = computed(() => {
    const map = new Map<string, LiveListItem[]>()
    for (const m of matches.value) {
      const k = m.leagueName || '其他'
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(m)
    }
    return [...map.entries()].map(([league, items]) => ({ league, items }))
  })

  return {
    matches,
    grouped,
    count,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
