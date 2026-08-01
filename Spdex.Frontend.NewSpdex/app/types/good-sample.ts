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

export interface AiAgentEvidence {
  label: string
  value: string
  explanation: string
}

export interface AiAgentUiCard {
  type: string
  title: string
  payload?: unknown
}

export interface AiAgentAnswer {
  directAnswer: string
  confidence: 'low' | 'medium' | 'high' | string
  summary: string[]
  keyEvidence: AiAgentEvidence[]
  dataLimits: string[]
  followups: string[]
  uiCards: AiAgentUiCard[]
  policyNotice: string
}

export interface AiAgentToolCallSummary {
  tool: string
  status: string
  id?: string
}

export interface AiAgentUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export interface AiAgentTurnResponse {
  success: boolean
  answer?: AiAgentAnswer | null
  traceId: string
  provider: string
  model: string
  toolCalls: AiAgentToolCallSummary[]
  usage?: AiAgentUsage | null
  generatedAtUtc: string
  error?: string | null
  message?: string | null
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
  response?: GoodSampleResponse
  agentResponse?: AiAgentTurnResponse
}
