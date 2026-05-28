/**
 * 实时赛况 snapshot：比分、分钟、半场、角球、红黄牌、事件时间线、xG/射门统计。
 * 调 /api/newspdex/live/{eventId}/snapshot。
 * 进行中赛事每 30 秒自动刷新；其他状态不刷新。
 */

import type { ApiResponse } from '~/types/auth'

export type LiveStatus = 'upcoming' | 'running' | 'finished'
export type LiveDataStatus = 'ok' | 'pending' | 'no-access' | 'not-running'

export interface LiveCardBadge {
  side: 'home' | 'away'
  color: 'red' | 'yellow'
  count: number
}

export interface LiveEvent {
  minute: string
  side: 'home' | 'away'
  type: 'goal' | 'red' | 'yellow' | 'substitution' | 'var'
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
  dangerousAttacks: BackendStatPair
  xg: BackendStatPair
}

interface BackendSnapshot {
  eventId: number
  status: LiveStatus
  minute: string
  score: number[]
  halfScore: string
  corners: number[]
  cardBadges: LiveCardBadge[]
  events: LiveEvent[]
  stats: BackendLiveStats | null
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
  status: LiveStatus
  minute: string
  score: [number, number]
  halfScore: string
  corners: [number, number]
  cardBadges: LiveCardBadge[]
  events: LiveEvent[]
  stats: LiveStatRow[]
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
    statsList.push(statPair('危险进攻', data.stats.dangerousAttacks))
    statsList.push(statPair('xG', data.stats.xg))
  }
  return {
    eventId: data.eventId,
    status: data.status,
    minute: data.minute,
    score: pairToTuple(data.score),
    halfScore: data.halfScore || '-',
    corners: pairToTuple(data.corners),
    cardBadges: data.cardBadges ?? [],
    events: data.events ?? [],
    stats: statsList,
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
