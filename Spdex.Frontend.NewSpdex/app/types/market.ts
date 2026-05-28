import type { MatchSummary } from './match'

export type MarketTab = 'all' | 'standard' | 'poly' | 'goals' | 'handicap'

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
}

export interface ChartPoint {
  time: string
  home: number
  draw: number
  away: number
  volume: number
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
