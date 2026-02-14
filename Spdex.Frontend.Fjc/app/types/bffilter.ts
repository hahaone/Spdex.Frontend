/**
 * 标盘提炼表三页面类型定义。
 * 对应后端 BfFilterResult.cs 中的 DTO。
 */

import type { MatchInfo } from '~/types/bighold'

// ── [标盘提炼表] Filter1 ──

/** 标盘提炼表单项：挂单量显著超过成交量的价位 */
export interface Filter1Item {
  /** 选项名称（主/平/客） */
  selection: string
  /** 赔率价位 */
  price: number
  /** 挂卖量（Back） */
  toBack: number
  /** 挂买量（Lay） */
  toLay: number
  /** 成交量 */
  traded: number
  /** 更新时间 */
  updateTime: string
}

/** 标盘提炼表结果 */
export interface Filter1Result {
  match: MatchInfo
  items: Filter1Item[]
}

// ── [指数提炼表] Filter2 ──

/** 指数提炼表单项：Weight 增长显著且成交 > 2K 的记录 */
export interface Filter2Item {
  pcId: number
  selectionId: number
  /** 选项名称（主/平/客） */
  selection: string
  lastOdds: number
  tradedChange: number
  tradedAttr: string
  payout: number
  previousPayout: number
  payoutDifference: number
  weight: number
  previousWeight: number
  weightDifference: number
  pMark: string
  refreshTime: string
  /** 原始数据 JSON（RawData），前端展开时解析 */
  rawData: string
  /** 行级黄色高亮（traded diff > 3 条正值） */
  isHighlighted: boolean
  /** Payout >= 60 */
  payoutHighlight: boolean
  /** Weight >= 50 */
  weightHighlight: boolean
}

/** 指数提炼表结果 */
export interface Filter2Result {
  match: MatchInfo
  items: Filter2Item[]
}

// ── [挂牌指数提炼表] Filter3 ──

/** 挂牌指数提炼表单项：ExchangeTrade 极值记录 */
export interface Filter3Item {
  pcId: number
  selectionId: number
  /** 选项名称（主/平/客） */
  selection: string
  lastOdds: number
  tradedChange: number
  tradedAttr: string
  /** 挂牌指数（ExchangeTrade / 100，百分比值如 0.055 = 5.5%） */
  exchangeTrade: number
  weight: number
  pMark: string
  refreshTime: string
  /** 原始数据 JSON */
  rawData: string
  /** 行级黄色高亮 */
  isHighlighted: boolean
  /** Weight >= 50 */
  weightHighlight: boolean
  /** 选项背景色编号（1=主/灰，2=平/紫，3=客/蓝） */
  selectionBgClass: number
  /** ExchangeTrade > 5% 红色(1) / < -5% 蓝色(-1) / 0=普通 */
  exchangeTradeHighlight: number
}

/** 挂牌指数提炼表结果 */
export interface Filter3Result {
  match: MatchInfo
  items: Filter3Item[]
}

// ── [亚盘提炼表] AsianFilter1 ──

/** 亚盘提炼表单项：挂单量 ≥ 10K 的价位 */
export interface AsianFilter1Item {
  /** SelectionId（1=Home, 2=Away） */
  selectId: number
  /** 队名 */
  selection: string
  /** 让球值 */
  handicap: number
  /** 赔率价位 */
  price: number
  /** 挂卖量（Back） */
  toBack: number
  /** 挂买量（Lay） */
  toLay: number
  /** 成交量 */
  traded: number
  /** 更新时间 */
  updateTime: string
}

/** 亚盘提炼表结果 */
export interface AsianFilter1Result {
  match: MatchInfo
  items: AsianFilter1Item[]
}

/** 下一条记录 API 响应 */
export interface NextRecordResult {
  pcId: number
  rawData: string
  refreshTime: string
  tradedChange: number
  lastOdds: number
}
