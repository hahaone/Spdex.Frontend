/**
 * 首页 dashboard 5 指标。
 * 调用 /api/newspdex/dashboard/metrics 拉真实数据，
 * 同时把后端 metric 映射为前端 UI 友好的结构（加 tone + to 路由）。
 */

import type { ApiResponse } from '~/types/auth'
import type { DashboardMetric, DashboardMetricRaw, DashboardMetricsResultRaw } from '~/types/dashboard'

/** 后端 metric.id → 前端 UI tone（控制色条颜色） */
const TONE_MAP: Record<string, DashboardMetric['tone']> = {
  'bf-volume': 'bf',
  'poly-volume': 'poly',
  'bf-index': 'index',
  'poly-index': 'index',
  'double-red': 'signal',
}

/** 后端 metric.id → 点击后跳转的目标路由 */
const TARGET_MAP: Record<string, string> = {
  'bf-volume': '/football?metric=bf-volume',
  'poly-volume': '/football?metric=poly-volume',
  'bf-index': '/football?metric=bf-index',
  'poly-index': '/football?metric=poly-index',
  'double-red': '/signals',
}

function decorate(raw: DashboardMetricRaw): DashboardMetric {
  return {
    ...raw,
    tone: TONE_MAP[raw.id] ?? 'bf',
    to: TARGET_MAP[raw.id] ?? '/football',
  }
}

export function useDashboardMetrics() {
  const result = useApiFetch<ApiResponse<DashboardMetricsResultRaw>>('/api/newspdex/dashboard/metrics', {
    key: 'newspdex-dashboard-metrics',
    server: false,
  })

  // 60s 自动刷新（与后端 cache TTL 一致）
  usePolling(() => result.refresh(), 60_000)

  /** 按行顺序输出 5 个 metric，方便 v-for 渲染 */
  const metrics = computed<DashboardMetric[]>(() => {
    const data = result.data.value?.data
    if (!data) return []
    return [
      decorate(data.bfVolume),
      decorate(data.polyVolume),
      decorate(data.bfIndex),
      decorate(data.polyIndex),
      decorate(data.doubleRed),
    ]
  })

  const prematchSixHourLockApplied = computed(() =>
    result.data.value?.data?.prematchSixHourLockApplied ?? false,
  )

  const generatedAt = computed(() => result.data.value?.data?.generatedAt ?? null)

  return {
    metrics,
    prematchSixHourLockApplied,
    generatedAt,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
