/**
 * 标盘（胜平负/1X2）大额持仓明细页类型定义。
 * 对应后端 BigHoldPageResult 及相关 DTO。
 */

/** 赛事基础信息 */
export interface MatchInfo {
  eventId: number
  homeTeam: string
  guestTeam: string
  matchTime: string
  marketId1: number
  homeTeamId: number
  guestTeamId: number
}

/** 赔率摘要 */
export interface OddsSummary {
  totalAmount: number
  homeOdds: number
  drawOdds: number
  awayOdds: number
  homeWeight: number
  drawWeight: number
  awayWeight: number
  homePayout: number
  drawPayout: number
  awayPayout: number
  homeAmount: number
  drawAmount: number
  awayAmount: number
  homeHotTrend: number
  drawHotTrend: number
  awayHotTrend: number
}

/** 单条大额持仓视图 */
export interface BigHoldItemView {
  pcId: number
  selection: string       // "主"/"平"/"客"
  selectionId: number
  lastOdds: number
  tradedChange: number    // 成交量
  tradedAttr: string
  hold: number            // TradedChange × (LastOdds - 1)
  payout: number
  per: number
  perTotal: number
  weight: number
  hotTrend: number
  pMark: string
  refreshTime: string
  orderIndex: number
  isTop2Amount: boolean   // Top 2 TradedChange 标记
  holdHighlight: number   // 0=无, 1=≥2σ, 2=≥3σ
  amountHighlight: number
  rawData: string | null  // MapRunner JSON，前端解析 Back/Lay/Traded
  marketId: number        // 展开时需传给 previous API
  dense: number           // 密集价位（UO/亚盘 页面使用）
  handicap: number        // 让球值（亚盘页面使用）
}

/** RawData 解析后的单行价位数据 */
export interface PriceSizeRow {
  price: number
  toBack: number     // 买入盘金额
  toLay: number      // 卖出盘金额
  traded: number     // 成交金额
  /** 成交高亮级别: 0=无, 1=最大成交, 2=≥2倍次大, 3=≥3倍次大 */
  tradedHighlight: number
}

/** 前一条记录 API 响应 */
export interface PreviousRecordResult {
  pcId: number
  rawData: string | null
  refreshTime: string
  tradedChange: number
  lastOdds: number
}

/** LastPrice 挂牌数据 */
export interface LastPriceData {
  selectionId: number
  selection: string         // "主"/"平"/"客"
  rawData: string | null
  hasLargeOrderAt500Or1000: boolean
}

/** 密集价位相关指标数据 */
export interface CsExtraData {
  densePrice: string   // "1.85-3.10-2.25"
  denseRatio: string   // "15%-50%-35%"
  denseIndex: string   // "2.8-15.5-7.2"
  denseVolume: string  // "1.50-5.10-3.20"
  innerRatio: string   // "12.5%-40.1%-28.3%"
  outerRatio: string   // "42.8%-39.9%-41.5%"
}

/** 单个时间窗口的数据 */
export interface TimeWindowData {
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
  // 赔率摘要
  odds: OddsSummary | null
  // LastPrice 挂牌数据
  lastPrices: LastPriceData[] | null
  // 密集价位/密集比例/密集指数/密集交易量/内比/外比
  csExtra: CsExtraData | null
}

/** 整页响应 */
export interface BigHoldPageResult {
  match: MatchInfo
  windows: TimeWindowData[]
}
