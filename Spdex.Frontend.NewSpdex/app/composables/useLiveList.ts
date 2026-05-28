/**
 * 实时 inplay 列表。来自 BSW Living（每 30s 缓存）。
 * 与 useLiveSnapshot 区别：useLiveList 一次拉所有，用于 /live 列表页。
 */

import type { ApiResponse } from '~/types/auth'

export interface LiveListItem {
  eventId: number
  leagueName: string
  homeTeam: string
  awayTeam: string
  status: string
  minute: string
  score: [number, number]
  halfScore: string
  corners: [number, number]
  cardBadges: Array<{ side: string, color: string, count: number }>
  events: Array<{ minute: string, side: string, type: string, text: string }>
  stats: {
    shots: { label: string, home: number, away: number }
    shotsOnTarget: { label: string, home: number, away: number }
    dangerousAttacks: { label: string, home: number, away: number }
    xg: { label: string, home: number, away: number }
  } | null
  dataStatus: string
  generatedAt: string
}

interface BackendLiveListResult {
  matches: LiveListItem[]
}

export function useLiveList() {
  const result = useApiFetch<ApiResponse<BackendLiveListResult>>(
    '/api/newspdex/live/active',
    { server: false, lazy: true },
  )

  // 30s 自动刷新（同 live snapshot 节奏）
  usePolling(() => result.refresh(), 30_000)

  const matches = computed<LiveListItem[]>(() => result.data.value?.data?.matches ?? [])
  const runningCount = computed(() => matches.value.filter(m => m.status === 'running').length)

  return {
    matches,
    runningCount,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
