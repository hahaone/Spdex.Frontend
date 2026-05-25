/**
 * Goal Line（入球线）大额持仓明细页类型定义。
 * 对应后端 GlBigHoldPageResult 及相关 DTO。
 */

import type { OddsSummary } from './bighold'

/** GL 赛事基础信息 */
export interface GlMatchInfo {
  eventId: number
  homeTeam: string
  guestTeam: string
  matchTime: string
  marketId1: number
  marketId6: number
  homeTeamId: number
  guestTeamId: number
}

/** GL 单行数据 */
export interface GlItemView {
  orderIndex: number
  handicap: number
  displayName: string
  odds: number
  dense: number
  denseSize: number
  maxBet: number
  oddsOnMax: number
  maxBetAttr: string
  maxBetMark: string
  totalBet: number
  maxHold: number
  totalHold: number
  maxTotal: number
  rankTotalBet: number
  payout: number
  pcId: number
  selectionId: number
  key: string
}

/** GL 时间窗口数据 */
export interface GlTimeWindowData {
  label: string
  hoursOffset: number

  underItems: GlItemView[]
  overItems: GlItemView[]

  underTotalBet: number
  underMaxHold: number
  underTotalHold: number
  overTotalBet: number
  overMaxHold: number
  overTotalHold: number

  stdDevMaxBet: number
  avgMaxBet: number
  threshold2SigmaMaxBet: number
  threshold3SigmaMaxBet: number
  stdDevTotalBet: number
  avgTotalBet: number
  threshold2SigmaTotalBet: number
  threshold3SigmaTotalBet: number
  stdDevMaxHold: number
  avgMaxHold: number
  threshold2SigmaMaxHold: number
  threshold3SigmaMaxHold: number
  stdDevTotalHold: number
  avgTotalHold: number
  threshold2SigmaTotalHold: number
  threshold3SigmaTotalHold: number

  odds: OddsSummary | null
  grandTotalBet: number
  grandTotalHold: number
  viewSubTitle: string

  lastPrices: GlLastPriceData[] | null
  windowBigList: GlBigItem[] | null
}

/** GL 大注/Hold TOP 项 */
export interface GlBigItem {
  pcId: number
  selectionId: number
  handicap: number
  selectionName: string
  tradedChange: number
  lastOdds: number
  hold: number
  tradedAttr: string
  payout: number
  per: number
  weight: number
  pMark: string
  refreshTime: string
  rawData: string | null
  marketId: number
  orderIndex: number
  colorRank: number
}

/** GL Payout 表行项 */
export interface GlPayoutItem {
  selectionId: number
  handicap: number
  selectionName: string
  amount: number
  tradedChange: number
  tradedAttr: string
  lastOdds: number
  payout: number
  per: number
  per2: number
  weight: number
  pMark: string
  refreshTime: string
}

/** GL LastPrice 挂牌数据 */
export interface GlLastPriceData {
  selectionId: number
  handicap: number
  key: string
  rawData: string | null
  hasLargeOrderAt500Or1000: boolean
}

/** Fj3Net 净赔付模型 */
export interface Fj3Net {
  title: string
  handicapUnder: number
  handicapOver: number
  handicapUnderHalf: number
  handicapOverHalf: number
  fullPayoutUnder: number
  fullNetUnder: number
  halfPayoutUnder: number
  halfNetUnder: number
  fullPayoutOver: number
  fullNetOver: number
  halfPayoutOver: number
  halfNetOver: number
  payoutTotal: number
  netTotal: number
  payout: number
  win: number
}

/** GL 整页响应 */
export interface GlBigHoldPageResult {
  match: GlMatchInfo
  windows: GlTimeWindowData[]
  bigList: GlBigItem[]
  holdList: GlBigItem[]
  netList: Fj3Net[] | null
  netList15: Fj3Net[] | null
  minPayoutList: GlPayoutItem[]
  maxPayoutList: GlPayoutItem[]
}
