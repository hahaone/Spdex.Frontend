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

export const aiToolOptions = [
  'search_matches',
  'get_top_matches',
  'get_match_snapshot',
  'get_market_series',
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
