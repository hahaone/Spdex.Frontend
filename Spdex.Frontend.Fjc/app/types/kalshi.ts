export type KalshiMatchLinkStatus = 'auto' | 'pending' | 'unmatched' | 'manual' | 'rejected'

export interface KalshiSoccerMatchLink {
  kalshiEventTicker: string
  kalshiTitle: string
  seriesTicker: string
  kalshiKickoffUtc: string | null
  kalshiHomeTeam: string | null
  kalshiAwayTeam: string | null
  betsapiEventId: number | null
  betsapiLeagueName: string | null
  betsapiHomeTeam: string | null
  betsapiAwayTeam: string | null
  betsapiKickoffUtc: string | null
  spdexEventId: number | null
  matchConfidence: number
  teamScore: number
  timeScore: number
  leagueScore: number
  matchStatus: KalshiMatchLinkStatus
  updatedAtUtc: string
}

export interface KalshiSoccerTradesResponse {
  eventTicker: string
  source: string
  fromUtc: string | null
  toUtc: string | null
  trades: KalshiEventTradesAggregate
}

export interface KalshiEventTradesAggregate {
  eventTicker: string
  title: string
  kickoffUtc: string | null
  tradeCount: number
  totalSize: number
  totalNotional: number
  firstTradeAtUtc: string | null
  lastTradeAtUtc: string | null
  markets: KalshiMarketTradesAggregate[]
  outcomeSeries: KalshiOutcomeTradeSeries[]
}

export interface KalshiMarketTradesAggregate {
  marketTicker: string
  label: string
  tradeCount: number
  totalSize: number
  yesSize: number
  noSize: number
  totalNotional: number
  yesNotional: number
  noNotional: number
  vwapYesPrice: number | null
  vwapNoPrice: number | null
  lastYesPrice: number | null
  lastNoPrice: number | null
  lastTradeAtUtc: string | null
}

export interface KalshiOutcomeTradeSeries {
  key: string
  marketTicker: string
  runner: string
  outcomeSide: 'Yes' | 'No' | string
  tradeCount: number
  totalSize: number
  totalNotional: number
  vwapPrice: number | null
  lastPrice: number | null
  lastTradeAtUtc: string | null
  trades: KalshiTradeDeltaTick[]
}

export interface KalshiTradeDeltaTick {
  tradeId: string
  marketTicker: string
  runner: string
  outcomeSide: 'Yes' | 'No' | string
  price: number
  count: number
  notional: number
  createdAtUtc: string
  previousPrice: number | null
  priceDelta: number | null
  intervalMilliseconds: number | null
}

export interface KalshiBookLevel {
  price: number
  size: number
}

export interface KalshiOrderbook {
  marketTicker: string
  depth: number
  capturedAtUtc: string
  yesBids: KalshiBookLevel[]
  noBids: KalshiBookLevel[]
  bestYesBid: number | null
  bestNoBid: number | null
  bestYesAsk: number | null
  bestNoAsk: number | null
  yesSpread: number | null
  noSpread: number | null
}

export interface KalshiTradeWindowStatsResult {
  eventTicker: string
  windows: KalshiTradeWindowStats[]
}

export interface KalshiTradeWindowStats {
  label: string
  hoursOffset: number
  volume: number
  indexHome: number
  indexDraw: number
  indexAway: number
  pctChange: number | null
}

export interface KalshiBswApiResult<T> {
  code: string | number
  info: string
  data: T
}
