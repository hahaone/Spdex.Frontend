/**
 * 角球（Corner）大额持仓明细页类型定义。
 * 对应后端 CornerBigHoldPageResult 及相关 DTO。
 */

import type { OddsSummary } from './bighold'

/** 角球赛事基础信息 */
export interface CornerMatchInfo {
  eventId: number
  homeTeam: string
  guestTeam: string
  matchTime: string
  marketId1: number
  marketCorner: number
  homeTeamId: number
  guestTeamId: number
}

/** 角球单行数据 */
export interface CornerItemView {
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

/** 角球单窗口数据 */
export interface CornerWindowData {
  group1Items: CornerItemView[]
  group2Items: CornerItemView[]
  group3Items: CornerItemView[]

  group1TotalBet: number
  group1MaxHold: number
  group1TotalHold: number
  group2TotalBet: number
  group2MaxHold: number
  group2TotalHold: number
  group3TotalBet: number
  group3MaxHold: number
  group3TotalHold: number

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

  grandTotalBet: number
  grandTotalHold: number
  odds: OddsSummary | null
  lastPrices: CornerLastPriceData[] | null
}

/** 角球大注/Hold TOP 项 */
export interface CornerBigItem {
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

/** 角球 Payout 表行项 */
export interface CornerPayoutItem {
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

/** 角球 LastPrice 挂牌数据 */
export interface CornerLastPriceData {
  selectionId: number
  key: string
  rawData: string | null
  hasLargeOrderAt500Or1000: boolean
}

/** 角球整页响应 */
export interface CornerBigHoldPageResult {
  match: CornerMatchInfo
  window: CornerWindowData
  bigList: CornerBigItem[]
  holdList: CornerBigItem[]
  minPayoutList: CornerPayoutItem[]
  maxPayoutList: CornerPayoutItem[]
}
