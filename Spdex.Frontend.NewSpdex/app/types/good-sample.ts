export interface GoodSampleUsage {
  usageUnits: number
  billable: boolean
  billingMode: string
}

export interface GoodSampleResponse {
  ruleVersion: string
  tool: string
  success: boolean
  data?: unknown
  error?: {
    code: string
    message: string
    details?: Record<string, string>
  }
  usage: GoodSampleUsage
  generatedAt: string
  traceId: string
}

export interface GoodSampleMatchChoice {
  matchId: number
  homeTeam: string
  awayTeam: string
  leagueName: string
  matchTime: string
}

export type AiAnswerFeedbackType = 'helpful' | 'issue' | 'unclear'

export interface AiAnswerFeedbackResponse {
  generatedAtUtc: string
  feedback: {
    feedbackId: string
    answerId: string
    traceId: string
    feedbackType: AiAnswerFeedbackType
    status: string
    severity: string
  }
}

export interface SavedGoodSample {
  id: string
  title: string
  question?: string
  savedAt: string
  preset?: 'today_hot' | 'search' | 'snapshot' | 'trend' | 'anomaly' | 'metric'
  match?: GoodSampleMatchChoice | null
  response: GoodSampleResponse
}
