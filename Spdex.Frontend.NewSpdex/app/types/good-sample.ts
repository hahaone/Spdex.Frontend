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
  traceId?: string | null
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
  auditTraceIds?: string[]
  usage?: AiAgentUsage | null
  generatedAtUtc: string
  error?: string | null
  message?: string | null
}

export interface AiAgentHistoryRecord {
  recordId: string
  subjectType: string
  subjectId: string
  title: string
  question: string
  preset?: 'today_hot' | 'search' | 'snapshot' | 'trend' | 'anomaly' | 'metric' | string | null
  matchId?: number | null
  matchTitle?: string | null
  leagueName?: string | null
  matchTime?: string | null
  traceId: string
  provider: string
  model: string
  answer?: AiAgentAnswer | null
  toolCalls: AiAgentToolCallSummary[]
  usage?: AiAgentUsage | null
  toolUsageUnits: number
  billable: boolean
  billingMode: string
  saved: boolean
  createdAtUtc: string
  updatedAtUtc: string
  savedAtUtc?: string | null
}

export interface AiAgentHistoryListResponse {
  generatedAtUtc: string
  limit: number
  count: number
  items: AiAgentHistoryRecord[]
}

export interface AiAgentHistoryMutationResponse {
  generatedAtUtc: string
  deleted?: boolean
  item: AiAgentHistoryRecord
}

export interface AiAgentHistoryUsageSummary {
  fromUtc: string
  toUtc: string
  records: number
  savedRecords: number
  toolUsageUnits: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  billable: boolean
  billingMode: string
}

export interface AiAgentHistoryUsageResponse {
  generatedAtUtc: string
  days: number
  summary: AiAgentHistoryUsageSummary
}

export interface AiAgentWorkflowStep {
  stepId: string
  title: string
  question: string
  preset: 'today_hot' | 'search' | 'snapshot' | 'trend' | 'anomaly' | 'metric' | string
  market?: string | null
  interval?: string | null
  metricKey?: string | null
  requiresMatch: boolean
}

export interface AiAgentWorkflowRecord {
  workflowId: string
  subjectType: string
  subjectId: string
  name: string
  description?: string | null
  matchRequired: boolean
  steps: AiAgentWorkflowStep[]
  runCount: number
  createdAtUtc: string
  updatedAtUtc: string
  lastRunAtUtc?: string | null
}

export interface AiAgentWorkflowListResponse {
  generatedAtUtc: string
  limit: number
  count: number
  items: AiAgentWorkflowRecord[]
}

export interface AiAgentWorkflowMutationResponse {
  generatedAtUtc: string
  deleted?: boolean
  item: AiAgentWorkflowRecord
}

export interface AiAgentWorkflowRunStepResult {
  stepId: string
  title: string
  question: string
  preset: string
  status: string
  toolUsageUnits: number
  durationMs?: number | null
  traceId?: string | null
  errorMessage?: string | null
}

export interface AiAgentWorkflowRunRecord {
  runId: string
  workflowId: string
  subjectType: string
  subjectId: string
  workflowName?: string | null
  triggerSource: string
  status: string
  stepCount: number
  completedStepCount: number
  toolUsageUnits: number
  durationMs?: number | null
  traceId?: string | null
  errorMessage?: string | null
  matchId?: number | null
  matchTitle?: string | null
  stepResults: AiAgentWorkflowRunStepResult[]
  startedAtUtc: string
  completedAtUtc?: string | null
  createdAtUtc: string
}

export interface AiAgentWorkflowRunListResponse {
  generatedAtUtc: string
  limit: number
  workflowId?: string | null
  count: number
  items: AiAgentWorkflowRunRecord[]
}

export interface AiAgentWorkflowRunMutationResponse {
  generatedAtUtc: string
  item: AiAgentWorkflowRunRecord
  workflow?: AiAgentWorkflowRecord | null
}

export interface AiAgentAutomationTaskRecord {
  taskId: string
  subjectType: string
  subjectId: string
  name: string
  description?: string | null
  workflowId: string
  enabled: boolean
  triggerType: 'scheduled' | 'match_status' | 'watch_condition' | string
  cadence: 'daily' | 'hourly' | 'before_kickoff' | 'live_window' | 'on_signal' | string
  scope: 'daily_watchlist' | 'selected_match' | 'ask_each_run' | string
  matchId?: number | null
  matchTitle?: string | null
  dailyRunLimit: number
  monthlyUnitBudget?: number | null
  notifyChannels: string[]
  runCount: number
  lastRunStatus: string
  createdAtUtc: string
  updatedAtUtc: string
  lastRunAtUtc?: string | null
  nextRunAtUtc?: string | null
}

export interface AiAgentAutomationTaskListResponse {
  generatedAtUtc: string
  limit: number
  count: number
  items: AiAgentAutomationTaskRecord[]
}

export interface AiAgentAutomationTaskMutationResponse {
  generatedAtUtc: string
  deleted?: boolean
  item: AiAgentAutomationTaskRecord
}

export interface AiAgentAutomationRunRecord {
  runId: string
  taskId: string
  workflowId: string
  subjectType: string
  subjectId: string
  triggerSource: string
  status: string
  stepCount: number
  completedStepCount: number
  toolUsageUnits: number
  durationMs?: number | null
  traceId?: string | null
  errorMessage?: string | null
  startedAtUtc: string
  completedAtUtc?: string | null
  createdAtUtc: string
}

export interface AiAgentAutomationRunGateResult {
  allowed: boolean
  reasonCode: string
  message: string
  taskId: string
  workflowId: string
  triggerSource: string
  dailyRunLimit: number
  dailyRunsUsed: number
  monthlyUnitBudget?: number | null
  monthlyUnitsUsed: number
  estimatedToolUsageUnits: number
  requestedStepCount: number
  maxStepCount: number
  checkedAtUtc: string
}

export interface AiAgentAutomationRunPreflightResponse {
  generatedAtUtc: string
  item: AiAgentAutomationRunGateResult
}

export interface AiAgentAutomationRunListResponse {
  generatedAtUtc: string
  limit: number
  taskId?: string | null
  count: number
  items: AiAgentAutomationRunRecord[]
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
