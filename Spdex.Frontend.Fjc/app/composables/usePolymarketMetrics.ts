import type { InjectionKey, Ref } from 'vue'
import type {
  PolymarketMarketTradesAggregate,
  PolymarketTokenBook,
  PolymarketEventTradesAggregate,
  PolymarketMarketBookAggregate,
} from '~/types/polymarket'

export interface PolymarketMetricsResult {
  ofi: number | null
  di: number | null
  se: number | null
  activityScore: number | null
  activityLabel: string
}

// ─── OFI: Order Flow Imbalance ───
export function computeOFI(market: PolymarketMarketTradesAggregate): number | null {
  const total = market.buySize + market.sellSize
  if (total === 0) return null
  return (market.buySize - market.sellSize) / total
}

// ─── DI: Depth Imbalance ───
export function computeDI(book: PolymarketTokenBook | null): number | null {
  if (!book) return null
  const total = book.totalBidSize + book.totalAskSize
  if (total === 0) return null
  return (book.totalBidSize - book.totalAskSize) / total
}

// ─── SE: Spread Efficiency ───
export function computeSE(book: PolymarketTokenBook | null): number | null {
  if (!book) return null
  if (book.spread == null || book.midPrice == null || book.midPrice === 0) return null
  if (book.bestBid == null || book.bestAsk == null) return null
  return book.spread / book.midPrice
}

// ─── Activity Score ───
export function computeActivityScore(
  market: PolymarketMarketTradesAggregate | null | undefined,
  trades: PolymarketEventTradesAggregate | null,
): number | null {
  const tradeCount = market?.tradeCount ?? trades?.tradeCount ?? 0
  const totalNotional = market?.marketVolume ?? market?.totalNotional ?? trades?.marketVolume ?? trades?.totalNotional ?? 0
  const lastTradeAtUtc = market?.lastTradeAtUtc ?? trades?.lastTradeAtUtc ?? null
  if (tradeCount === 0) return null

  const tcNorm = Math.min(tradeCount / 200, 1)
  const notNorm = Math.min(totalNotional / 100_000, 1)
  let recency = 0
  if (lastTradeAtUtc) {
    const hoursAgo = (Date.now() - new Date(lastTradeAtUtc).getTime()) / (1000 * 60 * 60)
    recency = Math.max(0, 1 - hoursAgo / 24)
  }
  return Math.round((tcNorm * 0.3 + notNorm * 0.3 + recency * 0.4) * 100)
}

export function getActivityLabel(score: number | null): string {
  if (score == null) return '无数据'
  if (score >= 60) return '高'
  if (score >= 30) return '中'
  return '低'
}

export function computeMarketMetrics(
  market: PolymarketMarketTradesAggregate | undefined,
  book: PolymarketMarketBookAggregate | null | undefined,
  eventTrades: PolymarketEventTradesAggregate | null,
): PolymarketMetricsResult {
  const ofi = market ? computeOFI(market) : null
  const yesBook = book?.yesBook ?? null
  const di = computeDI(yesBook)
  const se = computeSE(yesBook)
  const activityScore = computeActivityScore(market, eventTrades)
  const activityLabel = getActivityLabel(activityScore)
  return { ofi, di, se, activityScore, activityLabel }
}

// ─── Odds Format ───

export type OddsFormat = 'price' | 'decimal' | 'american' | 'hongkong' | 'malay' | 'indonesian' | 'fractional' | 'percentage'

export const ODDS_FORMATS: { key: OddsFormat; label: string }[] = [
  { key: 'price', label: '价格' },
  { key: 'decimal', label: '小数' },
  { key: 'american', label: '美式' },
  { key: 'percentage', label: '百分比' },
  { key: 'hongkong', label: '香港' },
  { key: 'malay', label: '马来式' },
  { key: 'indonesian', label: '印尼式' },
  { key: 'fractional', label: '分数' },
]

export const ODDS_FORMAT_KEY = Symbol('oddsFormat') as InjectionKey<Ref<OddsFormat>>

export function formatPolyOdds(price: number | null | undefined, format: OddsFormat): string {
  if (price == null) return '-'
  if (price <= 0 || price >= 1) return price.toFixed(4)

  switch (format) {
    case 'price':
      return price.toFixed(4)
    case 'decimal':
      return (1 / price).toFixed(2)
    case 'percentage':
      return `${(price * 100).toFixed(1)}%`
    case 'hongkong':
      return ((1 / price) - 1).toFixed(2)
    case 'american':
      if (price >= 0.5) return `${Math.round(-(price / (1 - price)) * 100)}`
      return `+${Math.round(((1 - price) / price) * 100)}`
    case 'malay':
      if (price >= 0.5) return (-(price / (1 - price))).toFixed(2)
      return ((1 - price) / price).toFixed(2)
    case 'indonesian':
      if (price >= 0.5) return (-(price / (1 - price))).toFixed(2)
      return ((1 - price) / price).toFixed(2)
    case 'fractional': {
      const profit = (1 / price) - 1
      return toFraction(profit)
    }
    default:
      return price.toFixed(4)
  }
}

function toFraction(value: number): string {
  if (value <= 0) return '0'
  for (const d of [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 50, 100]) {
    const n = Math.round(value * d)
    if (Math.abs(n / d - value) < 0.01) {
      return `${n}/${d}`
    }
  }
  return `${Math.round(value * 100)}/100`
}

// ─── Formatting helpers ───

export function formatPrice(value: number | null | undefined): string {
  if (value == null) return '-'
  return value.toFixed(4)
}

export function formatCompactCurrency(value: number | null | undefined): string {
  if (value == null) return '-'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

export function formatImbalance(value: number | null): string {
  if (value == null) return 'N/A'
  const pct = (value * 100).toFixed(1)
  return value >= 0 ? `+${pct}%` : `${pct}%`
}

export function formatSE(value: number | null): string {
  if (value == null) return 'N/A'
  return `${(value * 100).toFixed(2)}%`
}
