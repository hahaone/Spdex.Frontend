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
  /** 价值倾向;null/缺省=无大小球盘口或未计算 edge,前端不显示结论。 */
  lean?: string | null
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
  /** 赛前让球线(亚盘平均让球)，未开赛卡用。 */
  prematchHandicap?: string | null
  /** 赛前必发 主/平/客 赔率 [home, draw, away]，未开赛卡用。 */
  prematchOdds?: number[] | null
}

interface BackendLiveListResult { matches: LiveListItem[], tab: string }

export function useLiveList(
  tab: MaybeRef<LiveTabKey> = ref('running'),
  enabled: MaybeRef<boolean> = ref(true),
) {
  const tabRef = computed(() => unref(tab))
  const enabledRef = computed(() => unref(enabled))
  const query = computed(() => ({ tab: tabRef.value }))

  const result = useApiFetch<ApiResponse<BackendLiveListResult>>(
    '/api/newspdex/live/list',
    {
      key: () => `newspdex-live-${tabRef.value}`,
      server: false,
      lazy: true,
      immediate: enabledRef.value,
      query,
      watch: [tabRef],
    },
  )

  // 30s 自动刷新（仅在有访问权限时；免费/游客不轮询，避免反复 403）
  usePolling(() => {
    if (enabledRef.value && !result.pending.value)
      result.refresh()
  }, 30_000, { errorRef: result.error })

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
