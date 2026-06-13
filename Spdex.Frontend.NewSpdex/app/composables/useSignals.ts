/**
 * 活跃信号列表。基于 ISignalStore 当前 active 信号。
 * 60s 自动刷新（与 dashboard 一致）。
 */

import type { ApiResponse } from '~/types/auth'

export interface SignalSummary {
  signalId: string
  modelId: string
  modelName: string
  eventId: number
  homeTeam: string
  awayTeam: string
  matchTime: string
  status: string
  triggeredAt: string
  triggerCount: number
}

interface BackendSignalsResult {
  signals: SignalSummary[]
}

export function useSignals(limit: MaybeRef<number> = 50) {
  const limitRef = computed(() => unref(limit))

  const result = useApiFetch<ApiResponse<BackendSignalsResult>>(
    '/api/newspdex/signals/active',
    {
      key: () => `newspdex-signals-${limitRef.value}`,
      server: false,
      query: computed(() => ({ limit: limitRef.value })),
    },
  )

  usePolling(() => result.refresh(), 60_000, { pending: result.pending, errorRef: result.error })

  const signals = computed<SignalSummary[]>(() => result.data.value?.data?.signals ?? [])

  return {
    signals,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
