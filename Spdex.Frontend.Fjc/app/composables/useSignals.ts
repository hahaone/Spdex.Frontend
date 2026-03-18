/**
 * 信号引擎 API composable。
 * 封装 /api/signals 系列端点调用。
 */
import type { ApiResponse } from '~/types/api'
import type {
  SignalListResult,
  SignalModelSummary,
  SignalHistoryResult,
  SignalStats,
  Signal,
} from '~/types/signal'

// ── 实时信号列表 ──

interface SignalListParams {
  status?: string | null
  modelId?: string | null
  eventId?: number | null
}

export function useSignalList(params: Ref<SignalListParams>) {
  const refreshing = ref(false)

  const fetchResult = useApiFetch<ApiResponse<SignalListResult>>('/api/signals', {
    params,
    watch: [params],
  })

  /** 手动刷新 */
  async function manualRefresh() {
    refreshing.value = true
    try {
      await fetchResult.refresh()
    }
    finally {
      refreshing.value = false
    }
  }

  return {
    ...fetchResult,
    refreshing,
    manualRefresh,
  }
}

// ── 模型列表 ──

export function useSignalModels() {
  return useApiFetch<ApiResponse<SignalModelSummary[]>>('/api/signals/models')
}

// ── 历史记录（分页） ──

interface SignalHistoryParams {
  modelId?: string | null
  status?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  eventId?: number | null
  page?: number
  pageSize?: number
}

export function useSignalHistory(params: Ref<SignalHistoryParams>) {
  const refreshing = ref(false)

  const fetchResult = useApiFetch<ApiResponse<SignalHistoryResult>>('/api/signals/history', {
    params,
    watch: [params],
  })

  async function manualRefresh() {
    refreshing.value = true
    try {
      await fetchResult.refresh()
    }
    finally {
      refreshing.value = false
    }
  }

  return {
    ...fetchResult,
    refreshing,
    manualRefresh,
  }
}

// ── 统计数据 ──

interface SignalStatsParams {
  modelId?: string | null
  days?: number
}

export function useSignalStats(params: Ref<SignalStatsParams>) {
  return useApiFetch<ApiResponse<SignalStats[]>>('/api/signals/stats', {
    params,
    watch: [params],
  })
}

// ── 信号操作（非响应式，一次性调用） ──

/** 确认执行信号 */
export async function ackSignal(signalId: string, executedBy?: string): Promise<ApiResponse<Signal> | null> {
  const config = useRuntimeConfig()
  const token = useCookie('spdex_token')
  const headers: Record<string, string> = {}
  if (token.value) headers['Authorization'] = `Bearer ${token.value}`

  const res = await $fetch<ApiResponse<Signal>>(
    `/api/signals/${signalId}/ack`,
    {
      baseURL: config.public.apiBase as string,
      method: 'POST',
      headers,
      body: executedBy ? { executedBy } : undefined,
    },
  ).catch(() => null)

  return res
}

/** 手动过期（取消）信号 */
export async function expireSignal(signalId: string): Promise<ApiResponse<Signal> | null> {
  const config = useRuntimeConfig()
  const token = useCookie('spdex_token')
  const headers: Record<string, string> = {}
  if (token.value) headers['Authorization'] = `Bearer ${token.value}`

  const res = await $fetch<ApiResponse<Signal>>(
    `/api/signals/${signalId}`,
    {
      baseURL: config.public.apiBase as string,
      method: 'DELETE',
      headers,
    },
  ).catch(() => null)

  return res
}
