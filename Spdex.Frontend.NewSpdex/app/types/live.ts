import type { MatchSummary } from './match'

export type LiveTab = 'running' | 'upcoming' | 'finished'

export interface LiveMatchSummary extends MatchSummary {
  minute: string
  score: [number, number]
  halfScore: string
  corners: [number, number]
  cardBadges: Array<{
    side: 'home' | 'away'
    color: 'red' | 'yellow'
    count: number
  }>
  topTrade?: {
    amountText: string
    selection: string
    price: string
    state: string
  }
  liveOdds: {
    oneXTwo: [string, string, string]
    handicap: [string, string, string]
    total: [string, string, string]
  }
  models: string[]
}

export interface LiveDetail {
  match: LiveMatchSummary
  events: Array<{
    minute: string
    side: 'home' | 'away'
    type: 'goal' | 'red' | 'yellow'
    text: string
  }>
  stats: Array<{
    label: string
    home: string
    away: string
  }>
  oddsPanel: Array<{
    market: string
    home: string
    drawOrLine: string
    away: string
  }>
  priceCompare: Array<{
    book: string
    home: string
    draw: string
    away: string
  }>
}

export interface UpcomingDetail {
  match: LiveMatchSummary
  venue: Array<{ label: string; value: string }>
  oddsPanel: Array<{
    market: string
    home: string
    drawOrLine: string
    away: string
  }>
  priceCompare: Array<{
    book: string
    home: string
    draw: string
    away: string
  }>
}

export interface BackendLiveMatchOddsEvent {
  eventId: number
  marketId: number
  inPlay: boolean
  marketTime: string
  totalMatched?: number
  runnerLtp?: Record<number, number>
  topTrades?: BackendLiveTopTradeSummary[]
  maxTopTrade?: BackendLiveTopTradeSummary
}

export interface BackendLiveTopTradeSummary {
  key: string
  rank: number
  timestamp: string
  amount: number
  snapshotTotalMatchedDelta?: number
  priceFrom?: number
  priceTo?: number
  priceDirection?: 'up' | 'down' | 'flat'
  tradedPrice?: number
  tradedSizeDelta?: number
  sideHint?: 'backPressure' | 'layPressure'
}
