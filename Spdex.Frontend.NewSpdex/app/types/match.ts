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
  /** 欧赔（首选公司）三个赔率，0 = 无数据。 */
  euro?: [number, number, number]
  /** 欧赔首选公司名（如 "WilliamHill"）。 */
  euroBookmaker?: string
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
