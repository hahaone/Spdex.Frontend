/**
 * NewSpdex 鉴权相关类型。后端 LoginUserInfo + Entitlements 的镜像。
 */

export interface Entitlements {
  mainstreamMatches: boolean
  goalsEquilibrium: boolean
  asianIndex: boolean
  correctScoreIndex: boolean
  csData: boolean
  cornerData: boolean
  dataReplay: boolean
  standardChart: boolean
  indexTrendChart: boolean
  tradeDetailTable: boolean
  europeanOddsTrend: boolean
  qMyModels: number
  qMyPublish: number
  qConcurrentFactors: number
  qBaseFactors: boolean
  qGoalsEquilibrium: boolean
  qInOutBoard: boolean
  flashQDailyQuota: number
  appCoreTrades: boolean
  appInOutBoard: boolean
  prematchSixHourLock: boolean
  jcOnly: boolean
  timeMachine: boolean
}

export type MembershipTier =
  | 'Reserved'
  | 'Free'
  | 'Basic'
  | 'Expert'
  | 'Professional'
  | 'Gold'
  | 'Emerald'
  | 'Ruby'
  | 'Platinum'
  | 'Lottery'
  | 'QGroup'
  | 'Studio'

export interface AuthUser {
  userId: number
  userName: string
  roleId: number
  roleName: string
  endDate: string | null
  tokenType: string | null
  tier: MembershipTier | null
  entitlements: Entitlements | null
}

export interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
  traceId?: string
}

export interface LoginResponseData {
  token?: string
  expiresAt: string
  user: AuthUser
}
