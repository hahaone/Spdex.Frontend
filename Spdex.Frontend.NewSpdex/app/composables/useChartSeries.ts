/**
 * 赛事走势图时间序列。
 * 调 /api/newspdex/charts/{eventId}/timeseries，把 ISO 时间字符串转 HH:mm，
 * nullable odds 补 0。
 */

import type { ApiResponse } from '~/types/auth'
import type { ChartPoint } from '~/types/market'

export type ChartSeriesType = '1X2' | 'CS' | 'HHT' | 'HFT' | 'momentum' | 'AI' | 'goals' | 'handicap' | 'corner'
export type ChartStatus = 'ok' | 'pending' | 'no-access'

interface BackendChartPoint {
  time: string
  home: number | null
  draw: number | null
  away: number | null
  volume: number
}

interface BackendChartResult {
  type: string
  eventId: number
  points: BackendChartPoint[]
  generatedAt: string
  status: ChartStatus
}

function isoToHM(iso: string): string {
  // 接受 "2026-05-27T14:30:00Z" 或 "2026-05-27T14:30:00"
  const idx = iso.indexOf('T')
  if (idx < 0) return iso
  return iso.slice(idx + 1, idx + 6)
}

function mapPoint(p: BackendChartPoint): ChartPoint {
  return {
    time: isoToHM(p.time),
    home: p.home ?? 0,
    draw: p.draw ?? 0,
    away: p.away ?? 0,
    volume: p.volume,
  }
}

export function useChartSeries(eventId: MaybeRef<number>, type: MaybeRef<ChartSeriesType> = ref('1X2')) {
  const idRef = computed(() => unref(eventId))
  const typeRef = computed(() => unref(type))

  const query = computed(() => ({ type: typeRef.value }))

  const result = useApiFetch<ApiResponse<BackendChartResult>>(
    () => `/api/newspdex/charts/${idRef.value}/timeseries`,
    {
      key: () => `newspdex-chart-${idRef.value}-${typeRef.value}`,
      server: false,
      query,
      watch: [idRef, typeRef],
    },
  )

  // 60s 自动刷新（走势变化频率较低）
  usePolling(() => result.refresh(), 60_000)

  const points = computed<ChartPoint[]>(() => {
    const list = result.data.value?.data?.points ?? []
    return list.map(mapPoint)
  })

  const status = computed<ChartStatus>(() => result.data.value?.data?.status ?? 'pending')

  return {
    points,
    status,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
