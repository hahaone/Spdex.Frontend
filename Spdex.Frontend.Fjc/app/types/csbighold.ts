/**
 * 波胆（正确比分）大额持仓明细页类型定义。
 * 对应后端 CsBigHoldPageResult 及相关 DTO。
 * 复用 OddsSummary、LastPriceData、PreviousRecordResult、PriceSizeRow。
 */

import type { OddsSummary, LastPriceData } from './bighold'

/** 波胆赛事基础信息（含 MarketId4） */
export interface CsMatchInfo {
  eventId: number
  homeTeam: string
  guestTeam: string
  matchTime: string
  marketId1: number
  marketId4: number
  homeTeamId: number
  guestTeamId: number
}

/** 波胆单个比分行的视图模型 */
export interface CsItemView {
  code: number
  cs: string
  odds: number
  maxBet: number
  maxBet2: number
  maxBetAttr: string
  maxBetAttr2: string
  maxBetMark: string
  maxBetMark2: string
  oddsOnMax: number
  totalBet: number
  maxHold: number
  totalHold: number
  maxTotal: number
  rankTotalBet: number
  rankMaxHold: number
  rankTotalHold: number
  dense: number
  denseSize: number
  payout: number
  pcId: number
  selectionId: number
  tRatio: number | null
  per2: number | null
  volPercent: string | null
}

/** 波胆时间窗口数据 */
export interface CsTimeWindowData {
  label: string
  hoursOffset: number
  items: CsItemView[]

  // MaxBet 统计
  stdDevMaxBet: number
  avgMaxBet: number
  threshold2SigmaMaxBet: number
  threshold3SigmaMaxBet: number

  // TotalBet 统计
  stdDevTotalBet: number
  avgTotalBet: number
  threshold2SigmaTotalBet: number
  threshold3SigmaTotalBet: number

  // MaxHold 统计
  stdDevMaxHold: number
  avgMaxHold: number
  threshold2SigmaMaxHold: number
  threshold3SigmaMaxHold: number

  // TotalHold 统计
  stdDevTotalHold: number
  avgTotalHold: number
  threshold2SigmaTotalHold: number
  threshold3SigmaTotalHold: number

  // 赔率摘要（标盘 MarketId1）
  odds: OddsSummary | null

  // 汇总
  grandTotalBet: number
  grandTotalHold: number
  oddsAmount: number

  // Home/Draw/Away 比分分组（BetHold = TotalHold/TotalBet, 1x2 = OddsAmount/TotalHold）
  homeBetHold: number
  drawBetHold: number
  awayBetHold: number
  home1x2: number
  draw1x2: number
  away1x2: number

  // LastPrice 挂牌数据（仅当前窗口）
  lastPrices: LastPriceData[] | null
}

/** 大注 TOP10 项 */
export interface CsBigItem {
  pcId: number
  selectionId: number
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
  colorRank: number
}

/** Payout 表行项（最小/最大 Payout 表共用） */
export interface CsPayoutItem {
  selectionId: number
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

/** 整页响应 */
export interface CsBigHoldPageResult {
  match: CsMatchInfo
  windows: CsTimeWindowData[]
  bigList: CsBigItem[]
  minPayoutList: CsPayoutItem[]
  maxPayoutList: CsPayoutItem[]
}
