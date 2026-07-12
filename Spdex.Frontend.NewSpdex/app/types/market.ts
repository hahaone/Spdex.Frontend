import type { MatchSummary } from './match'

export type MarketTab = 'all' | 'standard' | 'poly' | 'goals' | 'handicap' | 'cs' | 'corner' | 'jc'

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
  jc: JcSection | null
}

export interface JcRow {
  key: string
  selection: string
  officialOdds: number | null
  restoredOdds: number | null
  restoredProbability: number | null
  distribution: number | null
  differenceRate: number | null
}

export interface JcMarket {
  key: string
  title: string
  mode: string
  note: string | null
  betId: string | null
  isSingle: string | null
  source: string | null
  sourceUpdatedAt: string | null
  capturedAt: string | null
  overround: number | null
  rows: JcRow[]
}

export interface JcTrendValue {
  key: string
  selection: string
  odds: number | null
}

export interface JcTrendPoint {
  time: string
  minutesToKickoff: number | null
  oddsText: string
  values: JcTrendValue[]
}

export interface JcTrendMarket {
  key: string
  title: string
  mode: string
  note: string | null
  points: JcTrendPoint[]
}

export interface JcEuroRow {
  company: string
  firstHome: number | null
  firstDraw: number | null
  firstAway: number | null
  home: number | null
  draw: number | null
  away: number | null
  returnRate: number | null
  probabilityHome: number | null
  probabilityDraw: number | null
  probabilityAway: number | null
  homeChange: number | null
  drawChange: number | null
  awayChange: number | null
  updatedAt: string | null
}

export interface JcOfficialEuroChange {
  updatedAt: string | null
  minutesToKickoff: number | null
  home: number | null
  draw: number | null
  away: number | null
  homeChange: number | null
  drawChange: number | null
  awayChange: number | null
}

export interface JcSampleDistribution {
  title: string
  type: string
  total: number | null
  homeCount: number | null
  drawCount: number | null
  awayCount: number | null
  homePercent: number | null
  drawPercent: number | null
  awayPercent: number | null
}

export interface JcIndexTrend {
  companyEuroSnapshot: JcEuroRow[]
  officialEuroChanges: JcOfficialEuroChange[]
  euroList: JcEuroRow[]
  sampleDistributions: JcSampleDistribution[]
}

export interface JcInjuryItem {
  name: string
  position: string
  role: string | null
  reason: string | null
  stats: string | null
}

export interface JcInjuryGroup {
  label: string
  injuries: JcInjuryItem[]
}

export interface JcNewsItem {
  id: string
  tag: string
  time: string | null
  title: string
  content: string | null
}

export interface JcAnalyzeItem {
  title: string
  text: string
}

export interface JcRecommendationMatch {
  serialNo: string | null
  leagueName: string | null
  hostNameS: string | null
  guestNameS: string | null
  lotteryType: string | null
  betTimeUtc: string | null
}

export interface JcRecommendation {
  contentId: string
  title: string | null
  summary: string | null
  content: string | null
  recommenderName: string | null
  recommenderId: string | null
  miniTypeText: string | null
  lotteryStyleText: string | null
  price: string | null
  saleTimeUtc: string | null
  matches: JcRecommendationMatch[]
}

export interface JcIntelligence {
  injuryAnalysis: string | null
  injuryGroups: JcInjuryGroup[]
  news: JcNewsItem[]
  analyzeItems: JcAnalyzeItem[]
  recommendations: JcRecommendation[]
}

export interface JcSection {
  title: string
  isSnapshot: boolean
  popularityIsHistorical: boolean
  snapshotStatus: string | null
  snapshotAt: string | null
  matchedAt: string | null
  totalHeat: number | null
  currentRank: number | null
  historicalHighest: number | null
  note: string | null
  markets: JcMarket[]
  trendMarkets: JcTrendMarket[]
  indexTrend: JcIndexTrend | null
  intelligence: JcIntelligence | null
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
