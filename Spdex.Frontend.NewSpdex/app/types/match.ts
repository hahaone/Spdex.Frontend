export type MatchStatus = 'upcoming' | 'started' | 'finished'

export interface MatchSummary {
  eventId: number
  leagueCode: string
  leagueName: string
  matchTime: string
  status: MatchStatus
  isJc: boolean
  marketType: string
  homeTeam: string
  awayTeam: string
  handicap: string
  prices: [number, number, number]
  turnovers: [string, string, string]
  bfIndex: [number, number, number]
  polyIndex: [number, number, number]
  flags: string[]
  /** 必发价位（Betfair 赔率）三个 [主,平,客]，0 = 无数据。 */
  bfPrice?: [number, number, number]
  /** 欧赔（首选公司）三个赔率，0 = 无数据。 */
  euro?: [number, number, number]
  /** 欧赔首选公司名（如 "WilliamHill"）。 */
  euroBookmaker?: string
  /** 首选公司凯利三值，0/0/0 = 无数据。 */
  kelly?: [number, number, number]
  /** 凯利方差三值（跨公司凯利的总体方差×10000 取整），0/0/0 = 无数据/无分歧。 */
  kellyVar?: [number, number, number]
  /** 标盘最大单注方向（"主"/"平"/"客"），空串=无数据。 */
  bigBetSide?: string
  /** 标盘最大单注属性（"买+"/"卖-"），空串=无数据。 */
  bigBetAttr?: string
  /** 标盘最大单注赔率，0/undefined=无。 */
  bigBetOdds?: number
  /** 标盘最大单注金额（原始数值）。 */
  bigBetAmount?: number
  /** Betfair 总成交额（原始数值，前端格式化为 K/M）。 */
  bfAmount?: number
  /** 大小盘口线（篮球总分线 / 足球进球线）。 */
  goalsLine?: string
  /** 大小赔率 [大, 小]。 */
  goalsOdds?: [number, number]
  /** 大小必指 [大, 小]。 */
  goalsIndex?: [number, number]
  /** 大小成交显示 [大, 小]。 */
  goalsTurnovers?: [string, string]
  /** 大小成交原始金额 [大, 小]。 */
  goalsAmount?: [number, number]
  /** 全场比分文本（"2-1"），仅 started/finished 有值。 */
  scoreText?: string
  /** 半场比分文本（"1-0"）。 */
  halfScoreText?: string
}

export interface MatchListResult {
  items: MatchSummary[]
  leagues: Array<{ code: string; name: string; count: number }>
  totalCount: number
  page: number
  pageSize: number
}

export interface BackendMatchListItem {
  eventId: number
  matchTime: string
  homeTeam: string
  guestTeam: string
  leagueCode: string
  leagueName: string
  marketId1?: number
  marketId2?: number
  marketId3?: number
  marketId4?: number
  marketId5?: number
  marketId6?: number
  lotteryId?: number
  asianLineId?: number
  final?: string
  half?: string
  needRunning?: boolean
  marketCorner?: string
  fullName?: string
  asianAvrLet?: number
  bfAmount?: number
  bfIndexHome?: number
  bfIndexDraw?: number
  bfIndexAway?: number
  asianAmount?: number
  pMark?: string
  maxBet?: BackendMaxBet
  bfMaxBet?: BackendMaxBet
}

export interface BackendMaxBet {
  amount: number
  ratio?: number
  attribute?: string
  spread?: number
  odds?: number
  time?: string
  score?: string
}
