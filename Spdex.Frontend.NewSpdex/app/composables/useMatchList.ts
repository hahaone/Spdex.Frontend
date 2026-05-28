/**
 * 足球赛事列表。
 * 调 /api/newspdex/matches，把后端 NewSpdexMatchSummary 映射为前端 MatchSummary，
 * 缺失字段（prices / turnovers per selection）用 0 占位或按 bfIndex 估算。
 */

import type { ApiResponse } from '~/types/auth'
import type { MatchStatus, MatchSummary } from '~/types/match'

interface BackendMatchSummary {
  eventId: number
  matchTime: string
  leagueCode: string
  leagueName: string
  homeTeam: string
  awayTeam: string
  status: MatchStatus
  isJc: boolean
  marketType: string
  handicap: string
  bfIndex: number[]
  polyIndex: number[]
  bfAmount: number
  polyAmount: number
  flags: string[]
  pMark: string | null
  euroHome?: number
  euroDraw?: number
  euroAway?: number
  euroBookmaker?: string
}

interface BackendMatchListResult {
  items: BackendMatchSummary[]
  leagues: string[]
  totalCount: number
  page: number
  pageSize: number
  prematchSixHourLockApplied: boolean
  jcOnlyEnforced: boolean
}

export interface MatchListFilters {
  date?: string
  league?: string
  jc?: boolean
  status?: 'upcoming' | 'started' | 'finished' | 'all' | 'jc'
  page?: number
  pageSize?: number
  sport?: 'soccer' | 'basketball'
}

/** 把 number 元素 ≥ 3 的数组转成 [number, number, number]，不足补 0 */
function toTriple(arr: number[] | undefined): [number, number, number] {
  if (!arr || arr.length < 3) return [0, 0, 0]
  return [arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0]
}

/** 把总成交按指数权重分摊到三个选项，估算 turnover 字符串 */
function distributeTurnover(total: number, indexes: [number, number, number]): [string, string, string] {
  const sum = indexes[0] + indexes[1] + indexes[2]
  if (total <= 0 || sum <= 0) return ['-', '-', '-']

  const calc = (idx: number) => {
    const share = total * (idx / sum)
    if (share >= 1_000_000) return (share / 1_000_000).toFixed(2) + 'M'
    if (share >= 1_000) return (share / 1_000).toFixed(1) + 'K'
    return Math.round(share).toString()
  }

  return [calc(indexes[0]), calc(indexes[1]), calc(indexes[2])]
}

function mapToMatchSummary(item: BackendMatchSummary): MatchSummary {
  const bfIndex = toTriple(item.bfIndex)
  const polyIndex = toTriple(item.polyIndex)
  const euro: [number, number, number] = [item.euroHome ?? 0, item.euroDraw ?? 0, item.euroAway ?? 0]
  const hasEuro = euro[0] > 0 || euro[1] > 0 || euro[2] > 0

  return {
    eventId: item.eventId,
    matchTime: item.matchTime,
    leagueCode: item.leagueCode,
    leagueName: item.leagueName,
    homeTeam: item.homeTeam,
    awayTeam: item.awayTeam,
    status: item.status,
    isJc: item.isJc,
    marketType: item.marketType || '胜负',
    handicap: item.handicap,
    prices: [0, 0, 0],  // 后端 list 不返回 odds，详情页才有
    turnovers: distributeTurnover(item.bfAmount, bfIndex),
    bfIndex,
    polyIndex,
    flags: item.flags ?? [],
    euro: hasEuro ? euro : undefined,
    euroBookmaker: hasEuro ? item.euroBookmaker : undefined,
  }
}

export function useMatchList(filters: MaybeRef<MatchListFilters> = {}) {
  const query = computed(() => {
    const f = unref(filters)
    const q: Record<string, string | number> = {}
    if (f.date) q.date = f.date
    if (f.league && f.league !== 'all') q.league = f.league
    if (f.jc) q.jc = 1
    if (f.status === 'jc') {
      q.jc = 1
    }
    else if (f.status && f.status !== 'all') {
      q.status = f.status
    }
    if (f.page) q.page = f.page
    if (f.pageSize) q.pageSize = f.pageSize
    if (f.sport && f.sport !== 'soccer') q.sport = f.sport
    return q
  })

  const result = useApiFetch<ApiResponse<BackendMatchListResult>>('/api/newspdex/matches', {
    key: 'newspdex-matches',
    server: false,
    query,
    watch: [query],
  })

  // 30s 自动刷新（赛事开赛/比分变化时反映）
  usePolling(() => result.refresh(), 30_000)

  const items = computed<MatchSummary[]>(() => {
    const list = result.data.value?.data?.items ?? []
    return list.map(mapToMatchSummary)
  })

  const leagues = computed(() => result.data.value?.data?.leagues ?? [])
  const totalCount = computed(() => result.data.value?.data?.totalCount ?? 0)
  const prematchSixHourLockApplied = computed(() => result.data.value?.data?.prematchSixHourLockApplied ?? false)

  return {
    items,
    leagues,
    totalCount,
    prematchSixHourLockApplied,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
