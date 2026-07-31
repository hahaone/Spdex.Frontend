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

export interface AiInAppNotificationListResult {
  generatedAtUtc: string
  limit: number
  filters: {
    unreadOnly: boolean
  }
  count: number
  unreadCount: number
  items: AiInAppNotificationRow[]
}

export interface AiInAppNotificationReadResult {
  generatedAtUtc: string
  marked: boolean
  updated: boolean
  item: AiInAppNotificationRow
}

export interface AiInAppNotificationMarkAllReadResult {
  generatedAtUtc: string
  marked: boolean
  updatedCount: number
  readAt: string
}
