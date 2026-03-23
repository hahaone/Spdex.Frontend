/**
 * 信号引擎相关 TypeScript 类型。
 * 映射后端 SignalsController 返回的 DTO。
 */

/** 信号状态枚举 */
export type SignalStatus = 'Triggered' | 'Conditional' | 'Executable' | 'Expired' | 'Executed'

/** 条件评估结果 */
export interface ConditionResult {
  type: string
  description: string
  passed: boolean
  actualValue: number
  expectedThreshold: number
}

/** 盘口快照 */
export interface HandicapSnapshot {
  handicap: number
  totalBet: number
  maxBet: number
  odds: number
  payout: number
  rankTotalBet: number
}

/** 信号触发时的数据快照 */
export interface SignalSnapshot {
  triggerWindowLabel: string
  overTotalBet: number
  underTotalBet: number
  overUnderRatio: number
  periodOverPeriodRatio: number
  highlightHandicap: number
  highlightTotalBet: number
  highlight3Sigma: number
  overItems: HandicapSnapshot[]
  underItems: HandicapSnapshot[]
}

/** 等待条件 */
export interface SignalWaitCondition {
  description: string
  marketDescription: string
  selection: string
  handicap: number
  priceOperator: string
  priceThreshold: number
  action: string
}

/** 实时信号（内存 SignalStore） */
export interface Signal {
  signalId: string
  modelId: string
  modelName: string
  eventId: number
  homeTeam: string
  guestTeam: string
  matchTime: string
  status: SignalStatus
  triggeredAt: string
  executableAt: string | null
  expiredAt: string | null
  executedAt: string | null
  executedBy: string | null
  snapshot: SignalSnapshot | null
  conditionResults: ConditionResult[]
  waitCondition: SignalWaitCondition | null
}

/** 实时信号列表响应 */
export interface SignalListResult {
  signals: Signal[]
  totalCount: number
  statusCounts: Record<string, number>
}

/** 模型摘要信息 */
export interface SignalModelSummary {
  id: string
  name: string
  enabled: boolean
  marketIdField: string
  factor: string
  conditionCount: number
  hasWaitCondition: boolean
  activeSignalCount: number
}

/** 历史信号记录（DB，含比赛结果） */
export interface SignalRecord {
  id: number
  signalId: string
  modelId: string
  modelName: string
  eventId: number
  homeTeam: string | null
  guestTeam: string | null
  matchTime: string
  status: string
  triggeredAt: string
  executableAt: string | null
  expiredAt: string | null
  executedAt: string | null
  executedBy: string | null
  snapshotJson: string | null
  conditionsJson: string | null
  waitCondJson: string | null
  triggersJson: string | null
  createdAt: string
  updatedAt: string
  /** 半场比分 */
  halfScore: string | null
  /** 全场比分 */
  finalScore: string | null
  /** 上半场有进球 */
  isHit: boolean | null
  /** 半场进球 Over 1.5 */
  halfOver15: boolean | null
  /** 全场进球 Over 2.5 */
  fullOver25: boolean | null
  /** 双方都有进球 */
  bothTeamsScored: boolean | null
  /** 触发次数 */
  triggerCount: number
}

/** 历史信号分页响应 */
export interface SignalHistoryResult {
  items: SignalRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** 模型统计数据 */
export interface SignalStats {
  modelId: string
  modelName: string
  /** 总比赛数（按 modelId + eventId 去重） */
  totalTriggered: number
  /** 已执行比赛数 */
  totalExecuted: number
  /** 已过期比赛数 */
  totalExpired: number
  /** 活跃比赛数 */
  totalActive: number
  executionRate: number
  /** 已完赛数 */
  totalFinished: number
  /** 上半场有进球命中数 */
  hitFirstHalfGoal: number
  /** 半场 Over 1.5 命中数 */
  hitHalfOver15: number
  /** 全场 Over 2.5 命中数 */
  hitFullOver25: number
  /** BTS 命中数 */
  hitBothTeamsScored: number
}
