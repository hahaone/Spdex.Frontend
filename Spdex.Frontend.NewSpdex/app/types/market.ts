import type { MatchSummary } from './match'

export type MarketTab = 'all' | 'standard' | 'poly' | 'goals' | 'handicap' | 'cs' | 'corner'

export interface MarketMetricRow {
  key: string
  selection: string
  price: string
  turnover: string
  bfIndex?: number
  polyIndex?: number
  ratio?: string
  pnl?: number
  listing?: string
  heat?: number
  euroAvg?: number
  variance?: number
  asian?: string
  balance?: string
}

export interface MarketDetail {
  match: MatchSummary
  standard: MarketMetricRow[]
  poly: MarketMetricRow[]
  goals: MarketMetricRow[]
  handicap: MarketMetricRow[]
  cs: MarketMetricRow[]
  corner: MarketMetricRow[]
}

export interface ChartPoint {
  time: string
  /** 原始 ISO 时间，供时间范围过滤（2H/6H/24H）。 */
  ts?: string
  home: number
  draw: number
  away: number
  volume: number
  /** 各选项当桶价位（LastOdds），供成交变化柱图叠加价位线。0=无。 */
  priceHome?: number
  priceDraw?: number
  priceAway?: number
}

export interface TradeRow {
  id: string
  time: string
  price: string
  volume: string
  change: string
  side: '买' | '卖'
  listing: string
}
