/**
 * 实时赛况 snapshot：比分、分钟、半场、角球、红黄牌、事件时间线、xG/射门统计。
 * 调 /api/newspdex/live/{eventId}/snapshot。
 * 进行中赛事每 30 秒自动刷新；其他状态不刷新。
 */

import type { ApiResponse } from '~/types/auth'
import type { LiveModel } from '~/composables/useLiveList'

export type LiveStatus = 'upcoming' | 'running' | 'finished'
export type LiveDataStatus = 'ok' | 'pending' | 'no-access' | 'not-running'

export interface LiveCardBadge {
  side: 'home' | 'away'
  color: 'red' | 'yellow'
  count: number
}

export type LiveEventType =
  | 'goal' | 'corner' | 'red' | 'yellow' | 'penalty' | 'substitution' | 'offside' | 'var' | 'other'

export interface LiveEvent {
  minute: string
  side: 'home' | 'away'
  type: LiveEventType
  text: string
}

interface BackendStatPair {
  label: string
  home: number
  away: number
}

interface BackendLiveStats {
  shots: BackendStatPair
  shotsOnTarget: BackendStatPair
  attacks: BackendStatPair
  dangerousAttacks: BackendStatPair
  xg: BackendStatPair
  substitutions?: BackendStatPair
  penalties?: BackendStatPair | null
}

export interface LiveOddsCell {
  label: string
  odd: string
}

/** 赔率走势采样点：A=主/大，B=客/小。 */
export interface LiveOddsTick {
  minute?: string | null
  score?: string | null
  a?: number | null
  b?: number | null
}

export interface LiveOddsMarket {
  market: string
  line: string | null
  cells: LiveOddsCell[]
  series?: LiveOddsTick[]
}

export interface LiveOdds {
  bookmaker: string
  score: string | null
  minute: string | null
  markets: LiveOddsMarket[]
}

/** 网关赛中 xG 模型。 */
export interface LiveInPlayXg {
  homeXg: number
  awayXg: number
  totalXg: number
  projectedTotalGoals: number
  expectedRemainingGoals: number
  homeDominance: number
  awayDominance: number
  performanceLabel: string
  goalLineEdgePct?: number | null
}

/** 盘口资金流向（当前 1X2 概率 + 开盘→当前漂移 + 蒸汽/反向盘）。 */
export interface LiveOddsMove {
  driftDirection: string
  homeProb: number
  drawProb: number
  awayProb: number
  homeDriftPct: number
  drawDriftPct: number
  awayDriftPct: number
  steamDetected: boolean
  steamText?: string | null
  reverseLine: boolean
}

export interface LiveSignalPoint {
  minute: number
  strength: number
}

/** 赛中深度分析（BSW 网关）。各部分可独立为 null。 */
export interface LiveAnalysis {
  inPlay: LiveInPlayXg | null
  oddsMove: LiveOddsMove | null
  signalTimeline: LiveSignalPoint[]
}

interface BackendSnapshot {
  eventId: number
  leagueName: string
  homeTeam: string
  awayTeam: string
  status: LiveStatus
  minute: string
  score: number[]
  halfScore: string
  corners: number[]
  cardBadges: LiveCardBadge[]
  events: LiveEvent[]
  stats: BackendLiveStats | null
  liveOdds: LiveOdds | null
  model: LiveModel | null
  analysis: LiveAnalysis | null
  dataStatus: LiveDataStatus
  generatedAt: string
}

export interface LiveStatRow {
  label: string
  home: string
  away: string
}

export interface LiveSnapshot {
  eventId: number
  leagueName: string
  homeTeam: string
  awayTeam: string
  status: LiveStatus
  minute: string
  score: [number, number]
  halfScore: string
  corners: [number, number]
  cardBadges: LiveCardBadge[]
  events: LiveEvent[]
  stats: LiveStatRow[]
  liveOdds: LiveOdds | null
  model: LiveModel | null
  analysis: LiveAnalysis | null
  dataStatus: LiveDataStatus
}

function pairToTuple(arr: number[] | undefined): [number, number] {
  if (!arr || arr.length < 2) return [0, 0]
  return [arr[0] ?? 0, arr[1] ?? 0]
}

function statPair(label: string, p: BackendStatPair | undefined): LiveStatRow {
  if (!p) return { label, home: '-', away: '-' }
  const fmt = (v: number) => Number.isInteger(v) ? String(v) : v.toFixed(2)
  return { label: p.label || label, home: fmt(p.home), away: fmt(p.away) }
}

function mapSnapshot(data: BackendSnapshot): LiveSnapshot {
  const statsList: LiveStatRow[] = []
  if (data.stats) {
    statsList.push(statPair('射门', data.stats.shots))
    statsList.push(statPair('射正', data.stats.shotsOnTarget))
    statsList.push(statPair('进攻', data.stats.attacks))
    statsList.push(statPair('危险进攻', data.stats.dangerousAttacks))
    statsList.push(statPair('控球率%', data.stats.xg))
    if (data.stats.penalties) statsList.push(statPair('点球', data.stats.penalties))
    if (data.stats.substitutions) statsList.push(statPair('换人', data.stats.substitutions))
  }
  return {
    eventId: data.eventId,
    leagueName: data.leagueName ?? '',
    homeTeam: data.homeTeam ?? '',
    awayTeam: data.awayTeam ?? '',
    status: data.status,
    minute: data.minute,
    score: pairToTuple(data.score),
    halfScore: data.halfScore || '-',
    corners: pairToTuple(data.corners),
    cardBadges: data.cardBadges ?? [],
    events: data.events ?? [],
    stats: statsList,
    liveOdds: data.liveOdds ?? null,
    model: data.model ?? null,
    analysis: data.analysis ?? null,
    dataStatus: data.dataStatus,
  }
}

export function useLiveSnapshot(eventId: MaybeRef<number>) {
  const idRef = computed(() => unref(eventId))

  const result = useApiFetch<ApiResponse<BackendSnapshot>>(
    () => `/api/newspdex/live/${idRef.value}/snapshot`,
    {
      key: () => `newspdex-live-snapshot-${idRef.value}`,
      server: false,
      watch: [idRef],
    },
  )

  const snapshot = computed<LiveSnapshot | null>(() => {
    const data = result.data.value?.data
    return data ? mapSnapshot(data) : null
  })

  // 仅在进行中赛事自动轮询，30s 间隔
  const isRunning = computed(() => snapshot.value?.status === 'running')
  usePolling(() => result.refresh(), 30_000, { enabled: isRunning })

  return {
    snapshot,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
