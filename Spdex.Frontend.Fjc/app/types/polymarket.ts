// ─── Match Links ───

export type PolymarketMatchLinkStatus = 'auto' | 'pending' | 'unmatched' | 'manual' | 'rejected'

export interface PolymarketSoccerMatchLink {
  polymarketEventId: string
  polymarketTitle: string
  polymarketSlug: string
  polymarketKickoffUtc: string | null
  polymarketHomeTeam: string | null
  polymarketAwayTeam: string | null
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
  matchStatus: PolymarketMatchLinkStatus
  updatedAtUtc: string
}

// ─── Trades ───

export interface PolymarketEventTradesAggregate {
  eventId: string
  title: string
  slug: string
  tradeCount: number
  totalSize: number
  totalNotional: number
  marketVolume: number | null
  firstTradeAtUtc: string | null
  lastTradeAtUtc: string | null
  markets: PolymarketMarketTradesAggregate[]
  recentTrades: PolymarketTradeTick[]
}

export interface PolymarketMarketTradesAggregate {
  marketId: string
  conditionId: string
  question: string
  sportsMarketType: string
  tradeCount: number
  buyCount: number
  sellCount: number
  totalSize: number
  buySize: number
  sellSize: number
  totalNotional: number
  yesNotional: number
  noNotional: number
  marketVolume: number | null
  vwapPrice: number | null
  minPrice: number | null
  maxPrice: number | null
  lastPrice: number | null
  lastTradeAtUtc: string | null
  recentTrades: PolymarketTradeTick[]
}

export interface PolymarketTradeTick {
  conditionId: string
  asset: string
  side: string
  outcome: string
  price: number
  size: number
  timestampUtc: string
  transactionHash: string | null
  proxyWallet: string | null
  traderName: string | null
  traderPseudonym: string | null
  traderProfileImage: string | null
  outcomeIndex: number | null
}

// ─── Book (Orderbook) ───

export interface PolymarketEventBookAggregate {
  eventId: string
  title: string
  slug: string
  capturedAtUtc: string
  markets: PolymarketMarketBookAggregate[]
}

export interface PolymarketMarketBookAggregate {
  marketId: string
  conditionId: string
  question: string
  sportsMarketType: string
  yesBook: PolymarketTokenBook | null
  noBook: PolymarketTokenBook | null
}

export interface PolymarketTokenBook {
  tokenId: string
  lastTradePrice: number | null
  bestBid: number | null
  bestAsk: number | null
  spread: number | null
  midPrice: number | null
  totalBidSize: number
  totalAskSize: number
  bids: PolymarketBookLevel[]
  asks: PolymarketBookLevel[]
}

export interface PolymarketBookLevel {
  price: number
  size: number
}

// ─── BSW API 响应包装 ───

export interface BswApiResult<T> {
  code: string | number
  info: string
  data: T
}
