export interface LiveMatchOddsTopTradesResponse {
  items: LiveMatchOddsEventItem[]
  missingEventIds: string[]
  pendingEventIds: string[]
  count: number
  limit: number
  scope: string
  timestamp: string
  missingEvents: LiveMatchOddsMissingEvent[]
}

export interface LiveMatchOddsMissingEvent {
  eventId: string
  triedMarketIds: string[]
  foundCandidateMarketIds: string[]
  eventMarketCount: number
  matchOddsMarketCount: number
  eventMarkets: LiveMatchOddsMarketDiagnostic[]
  matchOddsMarkets: LiveMatchOddsMarketDiagnostic[]
  reason: string
}

export interface LiveMatchOddsMarketDiagnostic {
  marketId: string
  marketType?: string | null
  status?: string | null
  inPlay?: boolean | null
  lastSeenAtUtc?: string | null
  totalMatched?: number | null
}

export interface LiveMatchOddsEventItem {
  eventId: string
  marketId: string
  marketType?: string | null
  marketStatus?: string | null
  inPlay?: boolean | null
  marketTime?: string | null
  lastUpdatedAtUtc?: string | null
  totalMatched?: number | null
  topSignature: string
  latestTopTradeKey?: string | null
  maxTopTrade?: LiveMatchOddsTopTradeSummary | null
  topTrades: LiveMatchOddsTopTradeSummary[]
}

export interface LiveMatchOddsTopTradeSummary {
  key: string
  rank: number
  timestamp: string
  sequence?: number | null
  source: string
  selectionId?: string | null
  runnerName?: string | null
  amount: number
  snapshotTotalMatchedDelta: number
  runnerMatchedDelta?: number | null
  priceFrom?: number | null
  priceTo?: number | null
  priceDelta?: number | null
  priceDirection: 'up' | 'down' | 'flat' | string
  tradedPrice?: number | null
  tradedSizeDelta?: number | null
  bestBackPrice?: number | null
  bestBackSize?: number | null
  bestLayPrice?: number | null
  bestLaySize?: number | null
  sideHint: 'backPressure' | 'layPressure' | 'unknown' | string
}
