/**
 * 实时赛况 snapshot：比分、分钟、半场、角球、红黄牌、事件时间线、xG/射门统计。
 * 调 /api/newspdex/live/{eventId}/snapshot，并显式包含赛中分析/回放走势大字段。
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
  player?: string | null
  team?: string | null
  rawText?: string | null
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

/** 完场回放序列上的一个时刻（标量快照，重建自归档）。 */
export interface AnalysisReplayPoint {
  capturedAt: string
  minute: number
  score: number[]
  modelTotalGoals?: number | null
  /** BSW 网关预期总进球（B+ 统一口径，预期总进球走势图数据源）。 */
  projectedTotalGoals?: number | null
  edgePct?: number | null
  modelOverPct?: number | null
  bookOverPct?: number | null
  homeProb?: number | null
  drawProb?: number | null
  awayProb?: number | null
  signalStrength?: number | null
}

/** 完场回放：赛中分析时序序列（仅完场且有归档时非空）。 */
export interface AnalysisReplay {
  series: AnalysisReplayPoint[]
  signalPeak: number
}

/** 单条伤停记录。 */
export interface LiveInjuryItem {
  player: string
  position: string
  status: string
  reason: string
  expectedReturn: string
}

/** 赛前伤停情报（主客两队，BSW 网关 Kinetel）。 */
export interface LiveInjuryInfo {
  home: LiveInjuryItem[]
  away: LiveInjuryItem[]
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
  analysisReplay: AnalysisReplay | null
  injuries: LiveInjuryInfo | null
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
  analysisReplay: AnalysisReplay | null
  injuries: LiveInjuryInfo | null
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
    analysisReplay: data.analysisReplay ?? null,
    injuries: data.injuries ?? null,
    dataStatus: data.dataStatus,
  }
}

export function useLiveSnapshot(eventId: MaybeRef<number>, enabled: MaybeRef<boolean> = ref(true)) {
  const idRef = computed(() => unref(eventId))
  const enabledRef = computed(() => unref(enabled))

  const result = useApiFetch<ApiResponse<BackendSnapshot>>(
    () => `/api/newspdex/live/${idRef.value}/snapshot?include=analysis,analysisReplay`,
    {
      key: () => `newspdex-live-snapshot-${idRef.value}`,
      server: false,
      immediate: enabledRef.value,
      watch: [idRef],
    },
  )

  const snapshot = computed<LiveSnapshot | null>(() => {
    const data = result.data.value?.data
    return data ? mapSnapshot(data) : null
  })

  // 仅在进行中赛事且有访问权限时自动轮询，30s 间隔（免费/游客不轮询，避免反复 403）
  const isRunning = computed(() => enabledRef.value && snapshot.value?.status === 'running')
  usePolling(() => result.refresh(), 30_000, { enabled: isRunning, pending: result.pending, errorRef: result.error })

  return {
    snapshot,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
