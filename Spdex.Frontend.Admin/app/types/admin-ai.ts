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
    channel: string | null
    conditionId: string | null
    triggerId: string | null
    conditionKind: string | null
    subject: Record<string, unknown> | null
    matchedAt: string | null
    rawPayloadOmitted: boolean
  } | null
}

export interface AiInAppNotificationResult {
  generatedAtUtc: string
  limit: number
  count: number
  items: AiInAppNotificationRow[]
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
