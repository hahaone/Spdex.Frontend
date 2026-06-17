import type { MatchSummary } from './match'

export type MarketTab = 'all' | 'standard' | 'poly' | 'goals' | 'handicap' | 'cs' | 'corner'

/** 单行某指标的「高/低」预格式化值（后端已按各指标显示口径格式化为字符串；无源为缺省/null）。 */
export interface MarketRowExtreme {
  price?: string
  turnover?: string
  bfIndex?: string
  ratio?: string
  pnl?: string
  listing?: string
  heat?: string
  euroAvg?: string
  variance?: string
}

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
  /** 赛前高值（标盘/进球段，移动端详情展示；无源为 null）。 */
  high?: MarketRowExtreme | null
  /** 赛前低值。 */
  low?: MarketRowExtreme | null
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
