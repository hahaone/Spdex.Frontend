export interface AiOpsStatus {
  status: 'ok' | 'degraded' | 'not_ready'
  service: string
  version: string
  ruleVersion: string
  environment: string
  generatedAtUtc: string
  security: {
    requireApiKey: boolean
    opsApiKeyConfigured: boolean
    accessTokensEnabled: boolean
    credentialsEnabled: boolean
    oauthEnabled: boolean
    internalSessionsEnabled: boolean
    subjectPoliciesEnabled: boolean
  }
  downstream: {
    name: string
    healthy: boolean
    httpStatusCode: number
    message: string
  }
  tools: { count: number, names: string[] }
  audit: {
    storageProvider: string
    persistent: boolean
    ledgerRecordCount: number
    recentRecordCount: number
  }
  usage: { retentionDays: number, aggregateCount: number }
  subjectPolicyCoordination: {
    provider: string
    centralized: boolean
    available: boolean
    failureMode: string
    errorCount: number
    fallbackAcquisitionCount: number
  }
  ledgerMaintenance: {
    enabled: boolean
    latestArchiveCreatedAtUtc: string | null
    latestArchiveAgeHours: number | null
    latestArchiveFileName: string | null
    latestArchiveRecordCount: number | null
    latestArchiveIntegrityOk: boolean | null
    externalBackupRequired: boolean
    externalBackupCreatedAtUtc: string | null
    externalBackupAgeHours: number | null
    externalBackupFileName: string | null
    externalBackupRecordCount: number | null
    externalBackupIntegrityOk: boolean | null
  }
  warnings: string[]
}

export interface AiOrganization {
  organizationId: string
  organizationName: string
  contactName: string | null
  contactEmail: string | null
  contractStatus: 'active' | 'suspended' | 'expired'
  contractStartsAt: string | null
  contractEndsAt: string | null
  dailyUsageUnits: number
  requestsPerMinute: number
  maxConcurrency: number
  slaTier: string
  createdAt: string
  updatedAt: string
}

export interface AiCredential {
  id: string
  credentialType: string
  name: string
  subjectType: string
  subjectId: string
  displayName: string | null
  tenantId: string | null
  clientId: string | null
  scopes: string[]
  entitlementProfile: string
  quotaPolicy: string
  rateLimitPolicy: string
  tokenPrefix: string
  status: 'active' | 'revoked' | 'disabled'
  createdAt: string
  expiresAt: string
  lastUsedAt: string | null
  lastSourceIp: string | null
  callCount: number
  rotatedFromId: string | null
  ipAllowList: string[]
}

export interface AiCredentialIssue {
  credential: AiCredential
  accessToken: string
  tokenType: string
}

export interface AiUsageRow {
  dateUtc: string
  subjectType: string
  subjectId: string
  userId: string | null
  aiClientId: string | null
  principalSource: string | null
  entitlementProfile: string | null
  quotaPolicy: string | null
  rateLimitPolicy: string | null
  toolName: string
  calls: number
  successfulCalls: number
  failedCalls: number
  usageUnits: number
  firstSeenUtc: string
  lastSeenUtc: string
}

export interface AiUsageResult {
  generatedAtUtc: string
  billingMode: string
  billable: boolean
  count: number
  items: AiUsageRow[]
}

export interface AiAuditRow {
  traceId: string
  toolName: string
  userId: string | null
  eventIds: number[]
  success: boolean
  usageUnits: number
  elapsedMs: number
  errorCode: string | null
  createdAtUtc: string
  subjectType: string | null
  subjectId: string | null
  aiClientId: string | null
  principalSource: string | null
  entitlementProfile: string | null
  quotaPolicy: string | null
  rateLimitPolicy: string | null
}

export interface AiAuditResult {
  generatedAtUtc: string
  count: number
  items: AiAuditRow[]
}

export interface AiInAppNotificationRow {
  inAppNotificationId: string
  notificationId: string
  conditionId: string
  triggerId: string
  owner: {
    subjectType: string
    subjectId: string
  }
  source: string
  title: string
  body: string
  severity: string
  createdAt: string
  readAt: string | null
  payloadRef: {
    type: string | null
    source: string | null
    channel: string | null
    conditionId: string | null
    triggerId: string | null
    conditionKind: string | null
    severity: string | null
    status: string | null
    taskId: string | null
    runId: string | null
    workflowId: string | null
    traceId: string | null
    subject: Record<string, unknown> | null
    task: Record<string, unknown> | null
    workflow: Record<string, unknown> | null
    match: Record<string, unknown> | null
    matchedAt: string | null
    completedAt: string | null
    rawPayloadOmitted: boolean
  } | null
}

export interface AiInAppNotificationResult {
  generatedAtUtc: string
  limit: number
  count: number
  items: AiInAppNotificationRow[]
}

export interface AiNotificationOutboxRow {
  notificationId: string
  conditionId: string
  triggerId: string
  owner: {
    subjectType: string
    subjectId: string
  }
  channel: string
  status: string
  attemptCount: number
  nextAttemptAt: string | null
  lastAttemptAt: string | null
  deliveredAt: string | null
  deliveryProvider: string | null
  deliveryError: string | null
  createdAt: string
  updatedAt: string
  payloadRef: AiInAppNotificationRow['payloadRef']
}

export interface AiNotificationOutboxResult {
  generatedAtUtc: string
  limit: number
  count: number
  items: AiNotificationOutboxRow[]
}

export interface AiNotificationOutboxRetryResult {
  generatedAtUtc: string
  item: AiNotificationOutboxRow | null
}

export interface AiNotificationProviderDrillRequest {
  ownerSubjectType?: string | null
  ownerSubjectId?: string | null
  channel?: string | null
  status?: string | null
  taskId?: string | null
  workflowId?: string | null
  taskName?: string | null
  workflowName?: string | null
  matchTitle?: string | null
  deliverNow?: boolean | null
}

export interface AiNotificationProviderDrillResult {
  generatedAtUtc: string
  deliverNow: boolean
  delivery: {
    status: string
    retryable: boolean
    provider: string
    error: string | null
  } | null
  item: AiNotificationOutboxRow
}

export interface AiAnswerFeedbackRow {
  feedbackId: string
  answerId: string
  traceId: string
  feedbackType: 'helpful' | 'issue' | 'unclear'
  issueTags: string[]
  commentText: string | null
  toolName: string | null
  preset: string | null
  matchId: number | null
  questionText: string | null
  clientType: string | null
  pageUrl: string | null
  renderMode: string | null
  subjectType: string
  subjectId: string
  userId: string | null
  aiClientId: string | null
  principalSource: string | null
  status: string
  severity: string
  reviewReason: string | null
  reviewerId: string | null
  reviewedAtUtc: string | null
  createdAtUtc: string
  updatedAtUtc: string
}

export interface AiAnswerFeedbackResult {
  generatedAtUtc: string
  limit: number
  count: number
  items: AiAnswerFeedbackRow[]
}

export interface AiAnswerFeedbackUpdateResult {
  generatedAtUtc: string
  feedback: AiAnswerFeedbackRow
}

export interface AiAnswerFeedbackBatchReviewResult {
  generatedAtUtc: string
  result: {
    requested: number
    updated: number
    failed: number
    items: AiAnswerFeedbackRow[]
    failures: Array<{
      feedbackId: string
      errorCode: string
      errorMessage: string
    }>
  }
}

export interface AiGoldenSampleCandidateRow {
  feedbackId: string
  answerId: string
  traceId: string
  candidateType: string
  candidateReason: string
  priority: number
  feedbackType: 'helpful' | 'issue' | 'unclear'
  status: string
  severity: string
  toolName: string | null
  preset: string | null
  matchId: number | null
  questionText: string | null
  issueTags: string[]
  reviewReason: string | null
  createdAtUtc: string
  updatedAtUtc: string
}

export interface AiGoldenSampleCandidateResult {
  generatedAtUtc: string
  limit: number
  count: number
  items: AiGoldenSampleCandidateRow[]
}

export interface AiAgentAutomationTaskRow {
  taskId: string
  subjectType: string
  subjectId: string
  name: string
  description: string | null
  workflowId: string
  enabled: boolean
  triggerType: string
  cadence: string
  scope: string
  matchId: number | null
  matchTitle: string | null
  dailyRunLimit: number
  monthlyUnitBudget: number | null
  notifyChannels: string[]
  runCount: number
  lastRunStatus: string
  createdAtUtc: string
  updatedAtUtc: string
  lastRunAtUtc: string | null
  nextRunAtUtc: string | null
}

export interface AiAgentAutomationRunRow {
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
  durationMs: number | null
  traceId: string | null
  errorMessage: string | null
  startedAtUtc: string
  completedAtUtc: string | null
  createdAtUtc: string
}

export interface AiAgentWorkflowRunStepRow {
  stepId: string
  title: string
  question: string
  preset: string
  status: string
  toolUsageUnits: number
  durationMs: number | null
  traceId: string | null
  errorMessage: string | null
}

export interface AiAgentWorkflowRunRow {
  runId: string
  workflowId: string
  subjectType: string
  subjectId: string
  workflowName: string | null
  triggerSource: string
  status: string
  stepCount: number
  completedStepCount: number
  toolUsageUnits: number
  durationMs: number | null
  traceId: string | null
  errorMessage: string | null
  matchId: number | null
  matchTitle: string | null
  stepResults: AiAgentWorkflowRunStepRow[]
  startedAtUtc: string
  completedAtUtc: string | null
  createdAtUtc: string
}

export interface AiAgentAutomationRunDetailResult {
  generatedAtUtc: string
  run: AiAgentAutomationRunRow
  task: AiAgentAutomationTaskRow | null
  taskError: { code: string | null, message: string | null } | null
  workflowRun: AiAgentWorkflowRunRow | null
  steps: AiAgentWorkflowRunStepRow[]
  retry: {
    eligible: boolean
    reason: string
  }
}

export interface AiAgentAutomationRetryResult {
  generatedAtUtc: string
  retriedFromRunId: string
  item: AiAgentAutomationTaskRow
  execution: {
    task: AiAgentAutomationTaskRow
    workflow: unknown
    automationRun: AiAgentAutomationRunRow | null
    workflowRun: AiAgentWorkflowRunRow | null
    preflight: unknown
    status: string
    stepCount: number
    completedStepCount: number
    toolUsageUnits: number
    durationMs: number
    traceId: string | null
    errorMessage: string | null
  }
}

export interface AiAgentAutomationOpsSummary {
  taskCount: number
  enabledTaskCount: number
  runCount: number
  successRunCount: number
  skippedRunCount: number
  failedRunCount: number
  partialRunCount: number
  toolUsageUnits: number
  fromUtc: string
  toUtc: string
}

export interface AiAgentAutomationSummaryResult {
  generatedAtUtc: string
  windowDays: number
  summary: AiAgentAutomationOpsSummary
}

export interface AiAgentAutomationCostSnapshot {
  runCount: number
  billableRunCount: number
  toolUsageUnits: number
  averageUnitsPerRun: number
  estimatedMonthlyUnits: number
  activeTaskCount: number
  budgetedTaskCount: number
  monthlyUnitBudgetTotal: number
  monthlyUnitBudgetRemaining: number
  monthlyBudgetUsageRate: number
}

export interface AiAgentAutomationQualitySnapshot {
  feedbackCount: number
  helpfulFeedbackCount: number
  issueFeedbackCount: number
  unclearFeedbackCount: number
  openFeedbackCount: number
  needsCalibrationCount: number
  needsCodeFixCount: number
  needsCopyFixCount: number
  verifiedFeedbackCount: number
  failureRate: number
  partialRate: number
  retryRate: number
  feedbackIssueRate: number
}

export interface AiAgentAutomationNotificationSnapshot {
  automationNotificationCount: number
  inAppNotificationCount: number
  unreadInAppNotificationCount: number
  deliveredCount: number
  skippedCount: number
  pendingCount: number
  retryWaitingCount: number
  dispatchingCount: number
  failedCount: number
  failureRate: number
}

export interface AiAgentAutomationStatusBucket {
  status: string
  count: number
  rate: number
}

export interface AiAgentAutomationDailyUsagePoint {
  dateUtc: string
  runCount: number
  toolUsageUnits: number
  failedRunCount: number
  partialRunCount: number
  skippedRunCount: number
}

export interface AiAgentAutomationTaskRiskRow {
  taskId: string
  subjectType: string
  subjectId: string
  name: string
  workflowId: string
  enabled: boolean
  lastRunStatus: string
  lastRunAtUtc: string | null
  runCount: number
  failedRunCount: number
  partialRunCount: number
  skippedRunCount: number
  toolUsageUnits: number
  monthlyUnitBudget: number | null
  monthlyUnitBudgetRemaining: number | null
  monthlyBudgetUsageRate: number | null
  riskLevel: string
  riskReason: string
}

export interface AiAgentAutomationInsightsResult {
  generatedAtUtc: string
  windowDays: number
  sampleLimit: number
  summary: AiAgentAutomationOpsSummary
  cost: AiAgentAutomationCostSnapshot
  quality: AiAgentAutomationQualitySnapshot
  notifications: AiAgentAutomationNotificationSnapshot
  statusBuckets: AiAgentAutomationStatusBucket[]
  dailyUsage: AiAgentAutomationDailyUsagePoint[]
  riskTasks: AiAgentAutomationTaskRiskRow[]
  recentProblemRuns: AiAgentAutomationRunRow[]
}

export interface AiAgentAutomationTaskResult {
  generatedAtUtc: string
  limit: number
  count: number
  items: AiAgentAutomationTaskRow[]
}

export interface AiAgentAutomationRunResult {
  generatedAtUtc: string
  limit: number
  count: number
  items: AiAgentAutomationRunRow[]
}

export interface AiAgentAutomationTaskUpdateResult {
  generatedAtUtc: string
  task: AiAgentAutomationTaskRow
}

export const aiToolOptions = [
  'search_matches',
  'get_match_snapshot',
  'plan_agent_analysis',
  'run_match_analysis_workflow',
  'run_watchlist_workflow',
  'prepare_monitoring_workflow',
  'list_match_market_capabilities',
  'get_market_series',
  'get_market_metric_series',
  'get_trade_flow',
  'get_big_trades',
  'get_market_depth',
  'get_hold_window_summary',
  'compare_market_windows',
  'get_extraction_signals',
  'detect_cross_market_resonance',
  'get_prediction_market_links',
  'get_prediction_market_snapshot',
  'compare_prediction_market_to_spdex',
  'get_live_market_monitor',
  'get_signal_feed',
  'explain_signal',
  'generate_match_brief',
  'generate_watchlist',
  'create_watch_condition',
  'list_watch_conditions',
  'get_watch_condition',
  'list_watch_notifications',
  'evaluate_watch_condition',
  'update_watch_condition',
  'cancel_watch_condition',
  'get_top_matches',
  'detect_market_anomalies',
  'explain_metric',
].map(value => ({ label: value, value }))

export const aiScopeOptions = [
  { label: '赛事搜索', value: 'matches.search' },
  { label: '赛事快照', value: 'matches.snapshot' },
  { label: '市场序列', value: 'markets.series' },
  { label: '异常检测', value: 'markets.anomalies' },
  { label: '指标解释', value: 'metrics.explain' },
]
