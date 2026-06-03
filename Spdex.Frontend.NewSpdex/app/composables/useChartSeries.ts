/**
 * 赛事走势图时间序列（盘口 × 指标矩阵）。
 * 调 /api/newspdex/charts/{eventId}/timeseries?type=market.metric，
 * 把 ISO 时间字符串转 HH:mm，nullable 数值补 0。
 * 后端额外返回 market/metric/metricLabel/unit/seriesLabels 供前端渲染标题、图例、Y 轴格式。
 */

import type { ApiResponse } from '~/types/auth'
import type { ChartPoint } from '~/types/market'

// 走势类型现为 "market.metric" 复合字符串（如 "standard.bfindex"），同时兼容旧式扁平别名（"1X2" 等）。
export type ChartSeriesType = string
export type ChartStatus = 'ok' | 'pending' | 'no-access'

export interface ChartSeriesLabels {
  home: string
  draw: string | null
  away: string
}

export interface ChartMetricDef { label: string, value: string }
export interface ChartMarketDef { label: string, value: string, metrics: ChartMetricDef[] }

/** PriceCalc 系盘口通用指标（含 E1 成交明细原始成交走势）。 */
const PRICECALC_METRICS: ChartMetricDef[] = [
  { label: '价位', value: 'odds' },
  { label: '必发指数', value: 'bfindex' },
  { label: '成交变化', value: 'traded' },
  { label: '成交明细', value: 'tradeflow' },
  { label: '成交量', value: 'volume' },
  { label: '成交比例', value: 'ratio' },
  { label: '挂牌指数', value: 'exchange' },
]

/** 走势矩阵：盘口 → 可用指标。对照旧站 Chart_GetJson 的 f-field 集合。 */
export const CHART_MARKETS: ChartMarketDef[] = [
  {
    label: '标盘',
    value: 'standard',
    metrics: [...PRICECALC_METRICS, { label: '模拟盈亏', value: 'payout' }, { label: '冷热', value: 'hotcold' }],
  },
  { label: '进球', value: 'goals', metrics: [...PRICECALC_METRICS] },
  {
    label: '让分',
    value: 'handicap',
    metrics: [...PRICECALC_METRICS, { label: '冷热', value: 'hotcold' }],
  },
  { label: '角球', value: 'corner', metrics: [...PRICECALC_METRICS] },
  { label: '欧赔', value: 'euro', metrics: [{ label: '欧赔', value: 'europe' }, { label: '凯利', value: 'kelly' }] },
]

interface BackendChartPoint {
  time: string
  home: number | null
  draw: number | null
  away: number | null
  volume: number
  priceHome?: number | null
  priceDraw?: number | null
  priceAway?: number | null
}

interface BackendChartResult {
  type: string
  eventId: number
  market: string
  metric: string
  metricLabel: string
  unit: string
  seriesLabels: ChartSeriesLabels
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
    ts: p.time,
    home: p.home ?? 0,
    draw: p.draw ?? 0,
    away: p.away ?? 0,
    volume: p.volume,
    priceHome: p.priceHome ?? 0,
    priceDraw: p.priceDraw ?? 0,
    priceAway: p.priceAway ?? 0,
  }
}

const DEFAULT_LABELS: ChartSeriesLabels = { home: '主', draw: '平', away: '客' }

export function useChartSeries(eventId: MaybeRef<number>, type: MaybeRef<string> = ref('1X2')) {
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
  const metricLabel = computed(() => result.data.value?.data?.metricLabel ?? '')
  const unit = computed(() => result.data.value?.data?.unit ?? 'odds')
  const seriesLabels = computed<ChartSeriesLabels>(() => result.data.value?.data?.seriesLabels ?? DEFAULT_LABELS)

  return {
    points,
    status,
    metricLabel,
    unit,
    seriesLabels,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
