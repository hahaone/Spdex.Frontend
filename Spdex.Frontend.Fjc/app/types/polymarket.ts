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
  /** 最近 N 笔按时间排序（受限于最近 200-2000 笔） */
  recentTrades: PolymarketTradeTick[]
  /** 全量 TTL 窗口内按 size 排序的 TOP N（BSW 后端 polymarket_trade_ticks 全量查询，TOP 100 事件级） */
  topTrades?: PolymarketTradeTick[] | null
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
  /** 最近 N 笔按时间排序（受限于最近 200 笔） */
  recentTrades: PolymarketTradeTick[]
  /** 全量 TTL 窗口内按 size 排序的 TOP N（BSW 后端 TOP 50 市场级） */
  topTrades?: PolymarketTradeTick[] | null
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
  /**
   * 服务端预计算的"上一笔同 conditionId+outcome 成交价"，仅 TopTrades 列表内填充。
   * 前端直接 (price - previousPrice) 即得正确价差，不依赖 RecentTrades 时间窗口。
   */
  previousPrice?: number | null
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

// ─── Trade Window Stats (后端预计算分时统计) ───

export interface PolymarketTradeWindowStatsResult {
  eventId: string
  windows: PolymarketTradeWindowStats[]
}

export interface PolymarketTradeWindowStats {
  label: string
  hoursOffset: number
  volume: number
  indexHome: number
  indexDraw: number
  indexAway: number
  pctChange: number | null
}

// ─── Trade Ticks (分页) ───

export interface PolymarketTradeTicksPage {
  items: PolymarketTradeTick[]
  totalCount: number
  page: number
  pageSize: number
  /**
   * 紧随当前页之后（时间更老）的少量成交，用于跨页价差计算。
   * 不渲染，仅用作每页最后一笔同 runner+outcome 成交的"前一笔"参考。
   */
  bridgeTicks?: PolymarketTradeTick[] | null
}

// ─── 持仓排行 ───

export interface PolymarketHolder {
  proxyWallet: string
  name: string | null
  pseudonym: string | null
  profileImage: string | null
  verified: boolean
  amount: number
  avgPrice: number
  totalBought: number
  initialValue: number
}

export interface PolymarketHolderSnapshot {
  eventId: string
  conditionId: string
  marketQuestion: string | null
  offsetLabel: string
  offsetMinutes: number
  capturedAtUtc: string
  kickoffUtc: string
  tokens: PolymarketHolderSnapshotToken[]
}

export interface PolymarketHolderSnapshotToken {
  tokenIndex: number
  token: string
  holders: PolymarketHolderSnapshotEntry[]
}

export interface PolymarketHolderSnapshotEntry {
  proxyWallet: string
  name: string | null
  pseudonym: string | null
  amount: number
}

export interface PolymarketTokenHolders {
  token: string
  outcomeIndex: number | null
  holders: PolymarketHolder[]
}

// ─── BSW API 响应包装 ───

export interface BswApiResult<T> {
  code: string | number
  info: string
  data: T
}
