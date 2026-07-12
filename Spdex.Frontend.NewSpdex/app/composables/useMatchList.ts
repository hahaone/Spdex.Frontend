/**
 * 足球赛事列表。
 * 调 /api/newspdex/matches，把后端 NewSpdexMatchSummary 映射为前端 MatchSummary，
 * 缺失字段（prices / turnovers per selection）用 0 占位或按 bfIndex 估算。
 */

import type { ApiResponse } from '~/types/auth'
import type { MatchStatus, MatchSummary } from '~/types/match'
import { formatHandicapLine } from '~/utils/handicap'

interface BackendMatchSummary {
  eventId: number
  matchTime: string
  leagueCode: string
  leagueName: string
  homeTeam: string
  awayTeam: string
  status: MatchStatus
  isJc: boolean
  jcIssue?: number
  jcOrder?: number
  sfcIssue?: number
  sfcOrder?: number
  marketType: string
  handicap: string
  bfIndex: number[]
  polyIndex: number[]
  bfAmount: number
  bfAmounts?: number[]
  polyAmount: number
  flags: string[]
  pMark: string | null
  bfPriceHome?: number
  bfPriceDraw?: number
  bfPriceAway?: number
  euroHome?: number
  euroDraw?: number
  euroAway?: number
  euroBookmaker?: string
  kellyHome?: number
  kellyDraw?: number
  kellyAway?: number
  kellyVarHome?: number
  kellyVarDraw?: number
  kellyVarAway?: number
  bigBetSide?: string
  bigBetAttr?: string
  bigBetOdds?: number
  bigBetAmount?: number
  goalsLine?: string
  goalsOdds?: number[]
  goalsIndex?: number[]
  goalsAmount?: number[]
  goalsPnl?: number[]
  asianLet?: number[]
  asianLetLine?: number
  asianTotal?: number[]
  asianTotalLine?: number
  score?: string
  halfScore?: string
  liveMinute?: string
  stockStd?: number[]
  stockGoals?: number[]
  stockHandicap?: number[]
  handicapAmount?: number[]
  handicapIndex?: number[]
  handicapOdds?: number[]
  asianIndex?: number
  asianIndexTo?: string
  csIndex?: number
  goalBalance?: number
  mediaIndex?: number[]
}

interface BackendMatchListResult {
  items: BackendMatchSummary[]
  leagues: string[]
  totalCount: number
  page: number
  pageSize: number
  prematchSixHourLockApplied: boolean
  jcOnlyEnforced: boolean
  historicalBackcheckLimitApplied: boolean
  earliestBackcheckDate?: string | null
}

export interface MatchListFilters {
  date?: string
  league?: string
  jc?: boolean
  /** 仅足彩赛事（LotteryId>0） */
  lottery?: boolean
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

/** 把总成交按指数权重分摊到三个选项，显示完整金额（千分位，不缩成 K/M） */
function distributeTurnover(total: number, indexes: [number, number, number]): [string, string, string] {
  const sum = indexes[0] + indexes[1] + indexes[2]
  if (total <= 0 || sum <= 0) return ['-', '-', '-']

  const calc = (idx: number) => Math.round(total * (idx / sum)).toLocaleString('en-US')

  return [calc(indexes[0]), calc(indexes[1]), calc(indexes[2])]
}

function toPair(arr: number[] | undefined): [number, number] {
  if (!arr || arr.length < 2) return [0, 0]
  return [arr[0] ?? 0, arr[1] ?? 0]
}

function amountPair(arr: number[] | undefined): [number, number] {
  const pair = toPair(arr)
  return [pair[0] > 0 ? pair[0] : 0, pair[1] > 0 ? pair[1] : 0]
}

function formatAmountPair(arr: [number, number]): [string, string] {
  const fmt = (value: number) => value > 0 ? Math.round(value).toLocaleString('en-US') : '-'
  return [fmt(arr[0]), fmt(arr[1])]
}

/** 标盘三选项真实成交额(各侧)→ 千分位字符串;<=0 显示 '-'。 */
function formatAmountTriple(arr: [number, number, number]): [string, string, string] {
  const fmt = (value: number) => value > 0 ? Math.round(value).toLocaleString('en-US') : '-'
  return [fmt(arr[0]), fmt(arr[1]), fmt(arr[2])]
}

function mapToMatchSummary(item: BackendMatchSummary): MatchSummary {
  const bfIndex = toTriple(item.bfIndex)
  // 各侧成交优先用后端真实金额(BfAmounts);缺省才退回「总额×指数占比」近似——
  // 否则移动端会按必指分摊,与经典/旧站的真实成交额口径不一致(见反馈:同场两端成交不同)。
  const bfAmounts = toTriple(item.bfAmounts)
  const hasBfAmounts = bfAmounts[0] > 0 || bfAmounts[1] > 0 || bfAmounts[2] > 0
  const polyIndex = toTriple(item.polyIndex)
  const bfPrice: [number, number, number] = [item.bfPriceHome ?? 0, item.bfPriceDraw ?? 0, item.bfPriceAway ?? 0]
  const hasBfPrice = bfPrice[0] > 0 || bfPrice[1] > 0 || bfPrice[2] > 0
  const euro: [number, number, number] = [item.euroHome ?? 0, item.euroDraw ?? 0, item.euroAway ?? 0]
  const hasEuro = euro[0] > 0 || euro[1] > 0 || euro[2] > 0
  const kelly: [number, number, number] = [item.kellyHome ?? 0, item.kellyDraw ?? 0, item.kellyAway ?? 0]
  const hasKelly = kelly[0] > 0 || kelly[1] > 0 || kelly[2] > 0
  const kellyVar: [number, number, number] = [item.kellyVarHome ?? 0, item.kellyVarDraw ?? 0, item.kellyVarAway ?? 0]
  const hasKellyVar = kellyVar[0] > 0 || kellyVar[1] > 0 || kellyVar[2] > 0
  const goalsOdds = toPair(item.goalsOdds)
  const goalsIndex = toPair(item.goalsIndex)
  const goalsAmount = amountPair(item.goalsAmount)
  const hasGoalsMarket = Boolean(item.goalsLine)
    || goalsOdds.some(value => value > 0)
    || goalsIndex.some(value => value > 0)
    || goalsAmount.some(value => value > 0)

  return {
    eventId: item.eventId,
    matchTime: item.matchTime,
    leagueCode: item.leagueCode,
    leagueName: item.leagueName,
    homeTeam: item.homeTeam,
    awayTeam: item.awayTeam,
    status: item.status,
    isJc: item.isJc,
    jcIssue: item.jcIssue ?? 0,
    jcOrder: item.jcOrder ?? 0,
    sfcIssue: item.sfcIssue ?? 0,
    sfcOrder: item.sfcOrder ?? 0,
    marketType: item.marketType || '胜负',
    handicap: formatHandicapLine(item.handicap),
    prices: [0, 0, 0],  // 后端 list 不返回 odds，详情页才有
    turnovers: hasBfAmounts ? formatAmountTriple(bfAmounts) : distributeTurnover(item.bfAmount, bfIndex),
    bfAmounts,
    bfIndex,
    polyIndex,
    flags: item.flags ?? [],
    bfPrice: hasBfPrice ? bfPrice : undefined,
    euro: hasEuro ? euro : undefined,
    euroBookmaker: hasEuro ? item.euroBookmaker : undefined,
    kelly: hasKelly ? kelly : undefined,
    kellyVar: hasKellyVar ? kellyVar : undefined,
    bigBetSide: item.bigBetSide || undefined,
    bigBetAttr: item.bigBetAttr || undefined,
    bigBetOdds: item.bigBetOdds || undefined,
    bigBetAmount: item.bigBetAmount || undefined,
    bfAmount: item.bfAmount,
    goalsLine: hasGoalsMarket ? item.goalsLine || undefined : undefined,
    goalsOdds: hasGoalsMarket ? goalsOdds : undefined,
    goalsIndex: hasGoalsMarket ? goalsIndex : undefined,
    goalsAmount: hasGoalsMarket ? goalsAmount : undefined,
    goalsTurnovers: hasGoalsMarket ? formatAmountPair(goalsAmount) : undefined,
    goalsPnl: hasGoalsMarket ? toPair(item.goalsPnl) : undefined,
    // 篮球亚盘让球/亚盘总进球(BetFair 最平衡线 + HK 赔率);无数据时为 [0,0]/0,网格按 0 显示空。
    asianLet: toPair(item.asianLet),
    asianLetLine: item.asianLetLine ?? 0,
    asianTotal: toPair(item.asianTotal),
    asianTotalLine: item.asianTotalLine ?? 0,
    scoreText: item.score || undefined,
    halfScoreText: item.halfScore || undefined,
    liveMinute: item.liveMinute || undefined,
    stockStd: toTriple(item.stockStd),
    stockGoals: toPair(item.stockGoals),
    stockHandicap: toTriple(item.stockHandicap),
    handicapAmount: toTriple(item.handicapAmount),
    handicapIndex: toTriple(item.handicapIndex),
    handicapOdds: toTriple(item.handicapOdds),
    asianIndex: item.asianIndex ?? 0,
    asianIndexTo: item.asianIndexTo ?? '',
    csIndex: item.csIndex ?? 0,
    goalBalance: item.goalBalance ?? 0,
    mediaIndex: toPair(item.mediaIndex),
  }
}

export function useMatchList(filters: MaybeRef<MatchListFilters> = {}) {
  const query = computed(() => {
    const f = unref(filters)
    const q: Record<string, string | number> = {}
    if (f.date) q.date = f.date
    if (f.league && f.league !== 'all') q.league = f.league
    if (f.jc) q.jc = 1
    if (f.lottery) q.lottery = 1
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
    // key 带上 sport：足球/篮球独立缓存，切换频道时自动拉取对应数据（不再需要手动刷新）
    key: () => `newspdex-matches-${unref(filters).sport ?? 'soccer'}`,
    server: false,
    query,
    watch: [query],
  })

  // 20s 自动刷新（赛事开赛/比分/赔率成交变化时反映；后端会动数据缓存 30s，前端略快于它以尽快反映）
  usePolling(() => result.refresh(), 20_000, { pending: result.pending, errorRef: result.error })

  const items = computed<MatchSummary[]>(() => {
    const list = result.data.value?.data?.items ?? []
    return list.map(mapToMatchSummary)
  })

  const leagues = computed(() => result.data.value?.data?.leagues ?? [])
  const totalCount = computed(() => result.data.value?.data?.totalCount ?? 0)
  const prematchSixHourLockApplied = computed(() => result.data.value?.data?.prematchSixHourLockApplied ?? false)
  const historicalBackcheckLimitApplied = computed(() => result.data.value?.data?.historicalBackcheckLimitApplied ?? false)
  const earliestBackcheckDate = computed(() => result.data.value?.data?.earliestBackcheckDate ?? null)
  const initialLoading = computed(() =>
    !result.data.value?.data && (result.pending.value || result.status.value === 'idle'))

  return {
    items,
    leagues,
    totalCount,
    prematchSixHourLockApplied,
    historicalBackcheckLimitApplied,
    earliestBackcheckDate,
    initialLoading,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
