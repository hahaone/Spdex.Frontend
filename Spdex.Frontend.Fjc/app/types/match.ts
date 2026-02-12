/** 赛事信息（对应后端 MatchWithLeague 实体） */
export interface Match {
  eventId: number
  matchTime: string
  homeTeam: string
  guestTeam: string
  homeTeamId: number
  guestTeamId: number
  matchPath: string
  marketId1: number
  marketId2: number
  marketId3: number
  marketId4: number
  marketId5: number
  marketId6: number
  elHomeSelectionId: number
  elAwaySelectionId: number
  asianLineId: number
  asianSelectionId: number
  startTime: string
  homeTeamName: string
  guestTeamName: string
  txoddsMid: number
  txoddsBit: boolean
  allow: boolean
  final: string
  half: string
  lotteryId: number
  lotteryOrder: number
  jcIssueNo: number
  jcMatchNo: number
  eventTypeId: number
  leagueId: number
  marketName1: string
  needRunning: boolean
  runningGroup: string
  fullName: string
  sortName: string
  marketCorner: number
}

/** 赛事列表单项（赛事 + 亚盘让球值 + Betfair交易额 + P标记 + 最大单注） */
export interface MatchListItem {
  match: Match
  asianAvrLet: string | null
  bfAmount: number
  pMark: string | null
  /** 最大单笔交易变化量（波胆市场 MAX(TradedChange)） */
  maxBet: number
  /** 最大单注占总成交量百分比 */
  maxBetPercent: number
  /** 最大单注交易属性（如"买+"、"卖+"） */
  maxBetAttr: string | null
  /** 价格变化量 */
  maxBetPriceChange: number
  /** 最大单注对应的赔率（价位） */
  maxBetOdds: number
  /** 最大单注发生时间 */
  maxBetTime: string | null
  /** 最大单注对应的比分项名称（如"1-1"） */
  maxBetSelection: string | null
}

/** GET /api/matches 响应数据 */
export interface MatchListResult {
  items: MatchListItem[]
  leagues: string[]
  totalCount: number
  page: number
  pageSize: number
}

// ApiResponse<T> 已统一定义在 ~/types/api.ts 中
