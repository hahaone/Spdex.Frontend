/**
 * 进球盘（Over/Under）大额持仓明细页类型定义。
 * 对应后端 UoBigHoldPageResult 及相关 DTO。
 * 复用 BigHoldItemView、LastPriceData、PreviousRecordResult、PriceSizeRow。
 */

import type { BigHoldItemView, LastPriceData } from './bighold'

/** UO 赛事基础信息（含各进球盘 MarketId） */
export interface UoMatchInfo {
  eventId: number
  homeTeam: string
  guestTeam: string
  matchTime: string
  /** 当前使用的 UO MarketId */
  marketId: number
  /** 当前进球盘名称（如 "2.5"） */
  marketName: string
  marketId2: number
  marketId21: number
  marketId22: number
  marketId23: number
  marketId24: number
  homeTeamId: number
  guestTeamId: number
}

/** UO 赔率摘要（2-way: Over/Under） */
export interface UoOddsSummary {
  totalAmount: number
  overAmount: number
  underAmount: number
  overOdds: number
  underOdds: number
  overWeight: number
  underWeight: number
  overPayout: number
  underPayout: number
  /** Over 占比 (0~1) */
  overPer: number
  /** Under 占比 (0~1) */
  underPer: number
}

/** UO 密集价位扩展指标 */
export interface UoCsExtraData {
  /** 密集价位（"1.85-2.10"） */
  densePrice: string
  /** 密集比例（"25%-35%"） */
  denseRatio: string
  /** 概率 Pro（"0.54-0.48"） */
  pro: string
  /** 回报率 R */
  r: number
  /** 成交量（"Over-Under-Total"） */
  volume: string
  /** TOP 指标（"1.25-0.88"） */
  top: string
  /** 盈亏指数 Over */
  payoutIndexOver: number
  /** 盈亏指数 Under */
  payoutIndexUnder: number
  /** HOLD 金额 Over */
  holdAmountOver: number
  /** HOLD 金额 Under */
  holdAmountUnder: number
}

/** 多时间节点成交汇总行 */
export interface UoVolumeSummary {
  timing: string
  underAmount: number
  overAmount: number
}

/** UO 单个时间窗口的数据 */
export interface UoTimeWindowData {
  label: string
  hoursOffset: number
  items: BigHoldItemView[]
  // Hold 统计量
  stdDevHold: number
  avgHold: number
  threshold2SigmaHold: number
  threshold3SigmaHold: number
  // Amount 统计量
  stdDevAmount: number
  avgAmount: number
  threshold2SigmaAmount: number
  threshold3SigmaAmount: number
  // 统计摘要行
  ukTime: string | null             // UK 时间 (GMT/BST)
  amountPercent: number | null       // 成交量百分比 = 当前/下一窗口 ×100
  overAmountPercent: number | null   // 大球成交量百分比
  underAmountPercent: number | null  // 小球成交量百分比
  // 赔率摘要（2-way）
  odds: UoOddsSummary | null
  // LastPrice 挂牌数据
  lastPrices: LastPriceData[] | null
  // 密集价位扩展指标
  csExtra: UoCsExtraData | null
}

/** UO 整页响应 */
export interface UoBigHoldPageResult {
  match: UoMatchInfo
  windows: UoTimeWindowData[]
  volumeSummary: UoVolumeSummary[]
}
