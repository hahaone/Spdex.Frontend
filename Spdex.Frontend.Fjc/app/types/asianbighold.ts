/**
 * 亚盘（Asian Handicap）明细页类型定义。
 * 对应后端 AsianBigHoldPageResult 及相关 DTO。
 * 数据来源为 GetListByMatchHandicap（CustomCs 聚合），按盘口区间分组。
 */

/** 亚盘赛事基础信息 */
export interface AsianMatchInfo {
  eventId: number
  homeTeam: string
  guestTeam: string
  matchTime: string
  /** 亚盘 MarketId（固定使用 MarketId3） */
  marketId3: number
  homeTeamId: number
  guestTeamId: number
}

/** 单行亚盘数据（对应后端 AsianHcRow） */
export interface AsianHcRow {
  orderIndex: number       // 1=Home, 2=Away
  handicap: number
  displayName: string      // "主 -0.50"
  isNegativeHandicap: boolean
  odds: number
  dense: number
  densePercent: number     // DenseSize / TotalBet
  maxBet: number
  maxBetPrice: number      // OddsOnMax
  maxBetAttr: string
  timeMark: string         // PS/PP/P/P0/P1...
  totalBet: number
  maxHold: number
  totalHold: number
  maxTotal: number         // MaxBet / TotalBet
  rankTotalBet: number
  rankMaxHold: number
  rankTotalHold: number
  // 高亮标记
  maxBetHighlight: number      // 0=无, 1=≥X2, 2=≥X3
  totalBetHighlight: number
  maxHoldHighlight: number
  totalHoldHighlight: number
  maxTotalHighlight: boolean   // > 65%
  rankHighlight: boolean       // RankTotalBet ≤ 4
  /** MaxHold 排名级别：0=不高亮, 1-4=对应红色渐变 */
  rankMaxHoldLevel: number
  // 展开行用
  selectionId: number
  pcId: number
  effectiveRouteHighlight: boolean  // "有效后路高亮"
  latestPriceHighlight: boolean     // 仅1个成交价位且>1000 → Latest Price 列黄色高亮
}

/** 盘口区间小计 */
export interface AsianHcSubtotal {
  grandTotalBet: number
  grandMaxHold: number
  grandTotalHold: number
}

/** 盘口区间分组 */
export interface AsianHcGroup {
  label: string
  rows: AsianHcRow[]
  subtotal: AsianHcSubtotal
}

/** Fj2SubTotal 统计量 */
export interface Fj2SubTotal {
  selection: string
  handicap: string
  subTotal: number
  avr: number
  x2: number
  x3: number
  totalBetSubTotal: number
  totalBetAvr: number
  totalBetX2: number
  totalBetX3: number
  maxHoldSubTotal: number
  maxHoldAvr: number
  maxHoldX2: number
  maxHoldX3: number
  totalHoldSubTotal: number
  totalHoldAvr: number
  totalHoldX2: number
  totalHoldX3: number
  grandTotalBet: number
  grandMaxHold: number
  grandTotalHold: number
}

/** 净赔付行 */
export interface Fj2Net {
  selection: string
  title: string
  payout: number
  win: number
  net: number
  netPayout: number
}

/** 亚盘 LastPrice 挂牌数据 */
export interface AsianLastPriceData {
  selectionId: number
  handicap: number
  key: string
  rawData: string | null
  hasLargeOrderAt500Or1000: boolean
}

/** 亚盘单个时间窗口的数据 */
export interface AsianTimeWindowData {
  label: string
  hoursOffset: number
  homeGroups: AsianHcGroup[]
  awayGroups: AsianHcGroup[]
  homeSubtotal: AsianHcSubtotal
  awaySubtotal: AsianHcSubtotal
  allSubtotal: Fj2SubTotal
  viewSubTitle: string
  bestPriceHome: number
  bestPriceAway: number
  lastPrices: AsianLastPriceData[] | null
}

/** 多时间节点成交汇总行 */
export interface AsianVolumeSummary {
  timing: string
  homeAmount: number
  awayAmount: number
}

/** 大注/Hold 列表中的单条记录 */
export interface AsianBigItem {
  pcId: number
  selection: string      // "主 -0.50"
  selectionId: number
  lastOdds: number
  tradedChange: number
  tradedAttr: string
  hold: number
  payout: number
  per: number
  weight: number
  pMark: string
  refreshTime: string
  orderIndex: number
  handicap: number
  amountHighlight: number   // 0=无, 1=≥X2, 2=≥X3
  holdHighlight: number
  colorGroup: number        // 颜色分组索引
  rawData: string | null
  marketId: number
}

/** 各时间窗口的大注 TOP5 */
export interface AsianWindowBigList {
  label: string
  hoursOffset: number
  items: AsianBigItem[]
}

/** "当前"窗口的 1X2 赔率摘要 */
export interface AsianOdds0 {
  homeWeight: number
  drawWeight: number
  awayWeight: number
  totalAmount: number
  homePayout: number
  drawPayout: number
  awayPayout: number
}

/** 亚盘整页响应 */
export interface AsianBigHoldPageResult {
  match: AsianMatchInfo
  windows: AsianTimeWindowData[]
  netPayouts: Fj2Net[] | null
  netPayouts15: Fj2Net[] | null
  volumeSummary: AsianVolumeSummary[]
  bigList: AsianBigItem[] | null
  holdList: AsianBigItem[] | null
  windowBigLists: AsianWindowBigList[] | null
  odds0: AsianOdds0 | null
}

/** PriceSizeRow 从 bighold.ts 导入复用 */
