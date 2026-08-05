<script setup lang="ts">
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Flame,
  Inbox,
  RefreshCw,
  Save,
  Settings2,
  Smartphone,
} from '@lucide/vue'
import type {
  AiInAppNotificationListResult,
  AiInAppNotificationMarkAllReadResult,
  AiInAppNotificationReadResult,
  AiInAppNotificationRow,
  AiNotificationPreferenceResult,
} from '~/types/ai-notification'
import type { ApiResponse } from '~/types/auth'

interface AiPreferenceForm {
  inApp: boolean
  minimumSeverity: string
  deliveryMode: string
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  quietHoursTimeZone: string
}

const { signals, pending, refresh } = useSignals(50)

// 后台 Web Push 订阅（关页/锁屏也能收到信号）
const { supported, subscribed, busy, permission, refreshState, subscribe, unsubscribe } = usePushSubscription()
// PWA 安装引导（充分利用主屏模式：可推送 + 全屏）
const { isStandalone, isIOS, canInstall, promptInstall } = usePwaInstall()
const feedback = ref('')
const aiNotificationsVisible = useAiNotificationVisibility()
const {
  refreshUnreadCount,
  syncUnreadCount,
  decrementUnreadCount,
} = useAiNotificationInbox()
const aiNotifications = ref<AiInAppNotificationListResult | null>(null)
const aiNotificationsLoading = ref(false)
const aiNotificationError = ref('')
const aiUnreadOnly = ref(false)
const aiNotificationSource = ref('')
const expandedNotificationId = ref('')
const markingNotificationId = ref('')
const markingAllNotifications = ref(false)
const aiPreferences = ref<AiNotificationPreferenceResult | null>(null)
const aiPreferenceForm = ref<AiPreferenceForm>(defaultAiPreferenceForm())
const aiPreferencesLoading = ref(false)
const aiPreferencesSaving = ref(false)
const aiPreferenceError = ref('')
const aiPreferencesExpanded = ref(false)

onMounted(async () => {
  await refreshState()
  if (aiNotificationsVisible.value) {
    await Promise.all([
      loadAiNotifications(),
      loadAiNotificationPreferences(),
    ])
  }
})

async function enablePush() {
  feedback.value = ''
  const r = await subscribe()
  if (!r.ok) feedback.value = r.reason || '开启失败'
}

async function disablePush() {
  feedback.value = ''
  await unsubscribe()
}

async function sendTest() {
  feedback.value = '发送中…'
  try {
    const res = await $apiFetch<ApiResponse<unknown>>('/api/newspdex/push/test', { method: 'POST' })
    feedback.value = res?.message || '已发送测试推送'
  }
  catch {
    feedback.value = '测试发送失败'
  }
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const idx = iso.indexOf('T')
  if (idx < 0) return iso
  return iso.slice(idx + 1, idx + 6)
}

const bannerState = computed<'on' | 'off' | 'denied' | 'unsupported'>(() => {
  if (!supported.value) return 'unsupported'
  if (subscribed.value) return 'on'
  if (permission.value === 'denied') return 'denied'
  return 'off'
})

// 「添加到主屏幕」引导文案（未装成 PWA 时显示）
const installHint = computed(() => {
  if (isIOS.value)
    return '用 Safari 打开 → 底部「分享」→「添加到主屏幕」，再从桌面图标进入'
  return '浏览器菜单 →「安装应用 / 添加到主屏幕」'
})

async function doInstall() {
  feedback.value = ''
  await promptInstall()
}

const bannerLabel = computed(() => {
  switch (bannerState.value) {
    case 'on': return '后台推送已开启 · 关页/锁屏也能收到'
    case 'denied': return '通知被拒绝，请到浏览器设置里允许'
    case 'unsupported':
      return isIOS.value
        ? 'iPhone 请用 Safari 打开 → 分享 →「添加到主屏幕」，再从主屏图标进入开启'
        : '当前浏览器不支持后台推送'
    default: return '开启后台推送，关页也能收到新信号'
  }
})

const aiNotificationItems = computed(() => aiNotifications.value?.items ?? [])
const aiUnreadCount = computed(() => aiNotifications.value?.unreadCount ?? 0)
const aiNotificationSourceOptions = [
  { label: '全部通知', value: '' },
  { label: '观察条件', value: 'spdex_ai_watch_condition' },
  { label: '自动化任务', value: 'spdex_ai_automation' },
]
const aiPreferenceStatus = computed(() => {
  if (aiPreferencesLoading.value) return '加载中'
  if (!aiPreferences.value) return '未加载'
  return aiPreferences.value.preferences.stored ? '已保存' : '默认值'
})
const aiPreferenceSummary = computed(() => {
  const form = aiPreferenceForm.value
  const channel = form.inApp ? '站内通知' : '暂停站内通知'
  const mode = form.deliveryMode === 'digest' ? '摘要' : '实时'
  const severity = severityText(form.minimumSeverity)
  const quiet = form.quietHoursEnabled ? '免打扰已开' : '免打扰关闭'
  return `${channel} · ${mode} · 最低${severity} · ${quiet}`
})

function defaultAiPreferenceForm(): AiPreferenceForm {
  return {
    inApp: true,
    minimumSeverity: 'info',
    deliveryMode: 'realtime',
    quietHoursEnabled: false,
    quietHoursStart: '',
    quietHoursEnd: '',
    quietHoursTimeZone: 'UTC',
  }
}

async function loadAiNotifications() {
  aiNotificationsLoading.value = true
  aiNotificationError.value = ''
  try {
    aiNotifications.value = await $apiFetch<AiInAppNotificationListResult>(
      '/api/newspdex/ai/notifications/in-app',
      {
        query: {
          unreadOnly: aiUnreadOnly.value || undefined,
          source: aiNotificationSource.value || undefined,
          limit: 30,
        },
      },
    )
    syncUnreadCount(aiNotifications.value)
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string, error_description?: string }, statusCode?: number }
    aiNotificationError.value = fetchError.data?.message || fetchError.data?.error_description || 'AI 收件箱暂不可用'
  }
  finally {
    aiNotificationsLoading.value = false
  }
}

async function loadAiNotificationPreferences() {
  aiPreferencesLoading.value = true
  aiPreferenceError.value = ''
  try {
    const result = await $apiFetch<AiNotificationPreferenceResult>(
      '/api/newspdex/ai/notifications/preferences',
    )
    applyAiNotificationPreferences(result)
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string, error_description?: string } }
    aiPreferenceError.value = fetchError.data?.message || fetchError.data?.error_description || 'AI 通知偏好暂不可用'
  }
  finally {
    aiPreferencesLoading.value = false
  }
}

async function saveAiNotificationPreferences() {
  if (aiPreferencesSaving.value) return
  aiPreferencesSaving.value = true
  aiPreferenceError.value = ''
  try {
    const form = aiPreferenceForm.value
    const result = await $apiFetch<AiNotificationPreferenceResult>(
      '/api/newspdex/ai/notifications/preferences',
      {
        method: 'PUT',
        body: {
          channels: {
            inApp: form.inApp,
            email: false,
            webhook: false,
          },
          minimumSeverity: form.minimumSeverity,
          deliveryMode: form.deliveryMode,
          quietHours: {
            enabled: form.quietHoursEnabled,
            start: form.quietHoursEnabled ? form.quietHoursStart || null : null,
            end: form.quietHoursEnabled ? form.quietHoursEnd || null : null,
            timeZone: form.quietHoursTimeZone || 'UTC',
          },
          emailAddress: '',
        },
      },
    )
    applyAiNotificationPreferences(result)
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string, error_description?: string } }
    aiPreferenceError.value = fetchError.data?.message || fetchError.data?.error_description || '保存 AI 通知偏好失败'
  }
  finally {
    aiPreferencesSaving.value = false
  }
}

function applyAiNotificationPreferences(result: AiNotificationPreferenceResult) {
  aiPreferences.value = result
  const preferences = result.preferences
  aiPreferenceForm.value = {
    inApp: preferences.channels.inApp,
    minimumSeverity: preferences.minimumSeverity || 'info',
    deliveryMode: preferences.deliveryMode || 'realtime',
    quietHoursEnabled: preferences.quietHours.enabled,
    quietHoursStart: preferences.quietHours.start || '',
    quietHoursEnd: preferences.quietHours.end || '',
    quietHoursTimeZone: preferences.quietHours.timeZone || 'UTC',
  }
}

async function markAiNotificationRead(item: AiInAppNotificationRow) {
  if (item.readAt || markingNotificationId.value) return
  markingNotificationId.value = item.inAppNotificationId
  aiNotificationError.value = ''
  try {
    const result = await $apiFetch<AiInAppNotificationReadResult>(
      `/api/newspdex/ai/notifications/in-app/${encodeURIComponent(item.inAppNotificationId)}/read`,
      { method: 'POST' },
    )
    replaceAiNotification(result.item)
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string } }
    aiNotificationError.value = fetchError.data?.message || '标记已读失败'
  }
  finally {
    markingNotificationId.value = ''
  }
}

async function markAllAiNotificationsRead() {
  if (markingAllNotifications.value || aiUnreadCount.value <= 0) return
  markingAllNotifications.value = true
  aiNotificationError.value = ''
  try {
    await $apiFetch<AiInAppNotificationMarkAllReadResult>(
      '/api/newspdex/ai/notifications/in-app/read-all',
      { method: 'POST' },
    )
    await loadAiNotifications()
    await refreshUnreadCount({ force: true })
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string } }
    aiNotificationError.value = fetchError.data?.message || '全部标记失败'
  }
  finally {
    markingAllNotifications.value = false
  }
}

async function toggleAiUnreadOnly() {
  aiUnreadOnly.value = !aiUnreadOnly.value
  await loadAiNotifications()
}

async function changeAiNotificationSource() {
  await loadAiNotifications()
}

function toggleAiPreferencesExpanded() {
  aiPreferencesExpanded.value = !aiPreferencesExpanded.value
}

function toggleAiNotificationExpanded(item: AiInAppNotificationRow) {
  expandedNotificationId.value = expandedNotificationId.value === item.inAppNotificationId
    ? ''
    : item.inAppNotificationId
}

function isAiNotificationExpanded(item: AiInAppNotificationRow): boolean {
  return expandedNotificationId.value === item.inAppNotificationId
}

function replaceAiNotification(next: AiInAppNotificationRow) {
  if (!aiNotifications.value) return
  const previous = aiNotifications.value.items.find(item => item.inAppNotificationId === next.inAppNotificationId)
  const unreadDelta = previous && !previous.readAt && next.readAt ? 1 : 0
  if (unreadDelta) decrementUnreadCount(unreadDelta)
  aiNotifications.value = {
    ...aiNotifications.value,
    unreadCount: Math.max(0, aiNotifications.value.unreadCount - unreadDelta),
    items: aiNotifications.value.items.map(item =>
      item.inAppNotificationId === next.inAppNotificationId ? next : item),
  }
  if (aiUnreadOnly.value) {
    aiNotifications.value = {
      ...aiNotifications.value,
      count: aiNotifications.value.items.filter(item => !item.readAt).length,
      items: aiNotifications.value.items.filter(item => !item.readAt),
    }
  }
}

function notificationSourceText(value?: string | null): string {
  if (value === 'spdex_ai_automation') return '自动化任务'
  if (value === 'spdex_ai_watch_condition') return '观察条件'
  return 'AI 通知'
}

function notificationStatusText(value?: string | null): string | null {
  if (!value) return null
  const labels: Record<string, string> = {
    success: '已完成',
    partial: '部分完成',
    failed: '失败',
    skipped: '已跳过',
    active: '观察中',
    triggered: '已触发',
    delivered: '已送达',
  }
  return labels[value] || null
}

function notificationConditionText(value?: string | null): string | null {
  if (!value) return null
  const labels: Record<string, string> = {
    active_signal: '活跃信号',
    market_anomaly: '盘口异常',
    live_edge: '赛中信号',
    external_market_linked: '外部市场联动',
    external_divergence: '外部市场背离',
    big_trade: '大额交易',
    brief_ready: '简报就绪',
  }
  return labels[value] || null
}

function notificationChannelText(value?: string | null): string | null {
  if (!value) return null
  const labels: Record<string, string> = {
    in_app: '站内通知',
    email: '邮件',
    webhook: 'Webhook',
  }
  return labels[value] || value
}

function notificationMetaText(item: AiInAppNotificationRow): string {
  const parts = [
    notificationSourceText(item.source),
    notificationStatusText(item.payloadRef?.status),
    notificationConditionText(item.payloadRef?.conditionKind),
  ].filter(Boolean)
  return parts.join(' · ')
}

function notificationSubject(item: AiInAppNotificationRow): string {
  const match = item.payloadRef?.match
  const matchTitle = match?.title
  if (typeof matchTitle === 'string' && matchTitle) return matchTitle
  const subject = item.payloadRef?.subject
  const matchId = subject?.match_id ?? subject?.matchId
  if (typeof matchId === 'number' || typeof matchId === 'string') return `赛事 ${matchId}`
  const workflow = item.payloadRef?.workflow
  const workflowName = workflow?.name
  if (typeof workflowName === 'string' && workflowName) return workflowName
  const task = item.payloadRef?.task
  const taskName = task?.name
  if (typeof taskName === 'string' && taskName) return taskName
  const date = subject?.date
  if (typeof date === 'string' && date) return date
  return item.payloadRef?.conditionKind || item.source || 'AI 观察'
}

function readRecordText(record: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function notificationDetailRows(item: AiInAppNotificationRow): { label: string, value: string }[] {
  const payload = item.payloadRef
  const rows = [
    { label: '通知来源', value: notificationSourceText(item.source) },
    { label: '通知等级', value: severityText(item.severity) },
    { label: '当前状态', value: notificationStatusText(payload?.status) },
    { label: '观察类型', value: notificationConditionText(payload?.conditionKind) },
    { label: '投递方式', value: notificationChannelText(payload?.channel) },
    { label: '关联对象', value: notificationSubject(item) },
    { label: '任务名称', value: readRecordText(payload?.task, ['name', 'title']) },
    { label: '流程名称', value: readRecordText(payload?.workflow, ['name', 'title']) },
    { label: '触发时间', value: formatNotificationTime(payload?.matchedAt || item.createdAt) },
    { label: '完成时间', value: formatNotificationTime(payload?.completedAt || null) },
    { label: '客服追踪号', value: payload?.traceId || null },
  ]
  return rows.filter((row): row is { label: string, value: string } => Boolean(row.value))
}

function notificationTarget(item: AiInAppNotificationRow): string | null {
  const match = item.payloadRef?.match
  const directMatchId = match?.match_id ?? match?.matchId
  if (typeof directMatchId === 'number' || typeof directMatchId === 'string') return `/football/${directMatchId}`
  const subject = item.payloadRef?.subject
  const matchId = subject?.match_id ?? subject?.matchId
  if (typeof matchId === 'number' || typeof matchId === 'string') return `/football/${matchId}`
  return null
}

function severityText(severity: string): string {
  const key = severity.toLowerCase()
  if (key === 'critical') return '重要'
  if (key === 'warning') return '关注'
  if (key === 'success') return '完成'
  return '观察'
}

function formatNotificationTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}
</script>

<template>
  <section class="push-page">
    <div class="page-head">
      <div class="head-info">
        <h1>
          <Bell :size="16" />
          <span>推送</span>
        </h1>
        <span class="muted num">{{ signals.length }} 条最新信号</span>
      </div>
      <button class="refresh-btn focus-ring" :disabled="pending" @click="refresh()">
        <RefreshCw :size="14" :class="{ spinning: pending }" />
      </button>
    </div>

    <div class="perm-banner" :class="{ active: bannerState === 'on', denied: bannerState === 'denied' }">
      <component :is="bannerState === 'on' ? Bell : BellOff" :size="14" />
      <span>{{ feedback || bannerLabel }}</span>
      <button
        v-if="bannerState === 'off'"
        class="perm-btn focus-ring"
        type="button"
        :disabled="busy"
        @click="enablePush"
      >
        {{ busy ? '开启中…' : '开启推送' }}
      </button>
      <template v-else-if="bannerState === 'on'">
        <button class="perm-btn ghost focus-ring" type="button" :disabled="busy" @click="sendTest">
          测试
        </button>
        <button class="perm-btn ghost focus-ring" type="button" :disabled="busy" @click="disablePush">
          关闭
        </button>
      </template>
    </div>

    <div v-if="!isStandalone" class="install-card">
      <Smartphone :size="18" class="ic" />
      <div class="install-body">
        <b>装到主屏，体验更好</b>
        <span>{{ installHint }} —— 装好可开启信号推送、全屏快速进入</span>
      </div>
      <button v-if="canInstall" class="install-btn focus-ring" type="button" @click="doInstall">安装</button>
    </div>

    <section v-if="aiNotificationsVisible" class="ai-inbox">
      <header class="inbox-head">
        <div>
          <h2><Inbox :size="16" /><span>AI 收件箱</span></h2>
          <span class="muted num">最近 {{ aiNotificationItems.length }} 条 · {{ aiUnreadCount }} 条未读</span>
        </div>
        <div class="inbox-actions">
          <label class="source-filter">
            <select v-model="aiNotificationSource" @change="changeAiNotificationSource">
              <option
                v-for="option in aiNotificationSourceOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <button
            :class="['tiny-toggle', { active: aiUnreadOnly }]"
            type="button"
            @click="toggleAiUnreadOnly"
          >
            未读
          </button>
          <button
            class="icon-mini focus-ring"
            type="button"
            aria-label="刷新 AI 收件箱"
            :disabled="aiNotificationsLoading"
            @click="loadAiNotifications"
          >
            <RefreshCw :size="14" :class="{ spinning: aiNotificationsLoading }" />
          </button>
          <button
            class="icon-mini focus-ring"
            type="button"
            aria-label="全部标为已读"
            :disabled="markingAllNotifications || aiUnreadCount <= 0"
            @click="markAllAiNotificationsRead"
          >
            <CheckCheck :size="15" />
          </button>
        </div>
      </header>

      <button
        class="pref-toggle focus-ring"
        type="button"
        :aria-expanded="aiPreferencesExpanded"
        @click="toggleAiPreferencesExpanded"
      >
        <span class="pref-title">
          <Settings2 :size="15" />
          <span>通知偏好</span>
          <b>{{ aiPreferenceStatus }}</b>
        </span>
        <span class="pref-summary">{{ aiPreferenceSummary }}</span>
        <ChevronDown :size="16" :class="{ open: aiPreferencesExpanded }" />
      </button>

      <section v-if="aiPreferencesExpanded" class="pref-panel" aria-label="AI 通知偏好">
        <div class="pref-grid">
          <p class="pref-note">邮件和 Webhook 暂未开放。</p>
          <label class="check-row">
            <input v-model="aiPreferenceForm.inApp" type="checkbox">
            <span>站内通知</span>
          </label>
          <label class="pref-field">
            <span>最低等级</span>
            <select v-model="aiPreferenceForm.minimumSeverity">
              <option value="info">观察</option>
              <option value="warning">关注</option>
              <option value="critical">重要</option>
            </select>
          </label>
          <label class="pref-field">
            <span>模式</span>
            <select v-model="aiPreferenceForm.deliveryMode">
              <option value="realtime">实时</option>
              <option value="digest">摘要</option>
            </select>
          </label>
          <label class="check-row">
            <input v-model="aiPreferenceForm.quietHoursEnabled" type="checkbox">
            <span>免打扰</span>
          </label>
          <label class="pref-field">
            <span>开始</span>
            <input v-model="aiPreferenceForm.quietHoursStart" type="time" :disabled="!aiPreferenceForm.quietHoursEnabled">
          </label>
          <label class="pref-field">
            <span>结束</span>
            <input v-model="aiPreferenceForm.quietHoursEnd" type="time" :disabled="!aiPreferenceForm.quietHoursEnabled">
          </label>
          <label class="pref-field wide">
            <span>时区</span>
            <input v-model.trim="aiPreferenceForm.quietHoursTimeZone" type="text" placeholder="UTC">
          </label>
        </div>
        <div class="pref-panel-foot">
          <div v-if="aiPreferenceError" class="pref-error">{{ aiPreferenceError }}</div>
          <button
            class="pref-save focus-ring"
            type="button"
            :disabled="aiPreferencesLoading || aiPreferencesSaving"
            @click="saveAiNotificationPreferences"
          >
            <Save :size="14" />
            <span>{{ aiPreferencesSaving ? '保存中' : '保存偏好' }}</span>
          </button>
        </div>
      </section>

      <div v-if="aiNotificationError" class="inbox-error">{{ aiNotificationError }}</div>
      <div v-else-if="aiNotificationsLoading && !aiNotificationItems.length" class="inbox-empty">加载中…</div>
      <div v-else-if="!aiNotificationItems.length" class="inbox-empty">暂无 AI 观察通知</div>
      <div v-else class="inbox-list">
        <article
          v-for="item in aiNotificationItems"
          :key="item.inAppNotificationId"
          :class="['inbox-item', { unread: !item.readAt, expanded: isAiNotificationExpanded(item) }]"
        >
          <div class="inbox-row">
            <button class="inbox-open focus-ring" type="button" @click="toggleAiNotificationExpanded(item)">
              <span class="unread-dot" aria-hidden="true" />
              <span class="inbox-main">
                <span class="item-head">
                  <span class="sev" :class="item.severity.toLowerCase()">{{ severityText(item.severity) }}</span>
                  <span>{{ notificationMetaText(item) }}</span>
                  <span class="num">{{ formatNotificationTime(item.createdAt) }}</span>
                </span>
                <b>{{ item.title }}</b>
                <span class="item-body">{{ item.body }}</span>
              </span>
              <ChevronDown :size="16" :class="{ open: isAiNotificationExpanded(item) }" />
            </button>
            <div class="item-actions">
              <button
                v-if="!item.readAt"
                class="read-btn focus-ring"
                type="button"
                :disabled="markingNotificationId === item.inAppNotificationId"
                @click="markAiNotificationRead(item)"
              >
                <Check :size="14" />
                <span>已读</span>
              </button>
            </div>
          </div>

          <div v-if="isAiNotificationExpanded(item)" class="item-detail">
            <p>{{ item.body }}</p>
            <dl>
              <div v-for="row in notificationDetailRows(item)" :key="row.label">
                <dt>{{ row.label }}</dt>
                <dd>{{ row.value }}</dd>
              </div>
            </dl>
            <div class="detail-actions">
              <NuxtLink
                v-if="notificationTarget(item)"
                :to="notificationTarget(item) || '/'"
                class="subject-link focus-ring"
              >
                查看赛事
              </NuxtLink>
            </div>
          </div>
        </article>
      </div>
    </section>

    <div v-if="pending && !signals.length" class="empty" role="status">加载中…</div>
    <div v-else-if="!signals.length" class="empty" role="status">
      <Flame :size="20" />
      <p>暂无活跃信号</p>
      <span class="muted">信号系统每 30s 扫描一次，新触发将自动推送到这里</span>
    </div>

    <section v-else class="signal-stream">
      <NuxtLink
        v-for="s in signals"
        :key="s.signalId"
        :to="`/football/${s.eventId}`"
        class="signal-card focus-ring"
      >
        <div class="card-head">
          <span class="model">{{ s.modelName }}</span>
          <span class="trig num">{{ formatTime(s.triggeredAt) }}</span>
        </div>
        <div class="card-body">
          <b>{{ s.homeTeam }} vs {{ s.awayTeam }}</b>
        </div>
        <div class="card-foot">
          <span class="status-tag" :class="{ exec: s.status === 'Executable', cond: s.status === 'Conditional' }">{{ s.status }}</span>
          <span v-if="s.triggerCount > 1" class="trig-cnt num">×{{ s.triggerCount }}</span>
          <ChevronRight :size="13" class="chev" />
        </div>
      </NuxtLink>
    </section>
  </section>
</template>

<style scoped>
.push-page {
  display: grid;
  gap: 9px;
  padding: 12px 12px 16px;
}

.page-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px;
  align-items: center;
  gap: 10px;
}

.head-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.head-info h1 {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  color: var(--brand);
  font-size: 1rem;
  font-weight: 820;
}

.muted {
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 720;
}

.refresh-btn {
  display: inline-grid;
  min-height: 30px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--muted);
}

.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.perm-banner {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 9px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #f9fafc;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 720;
}

.perm-banner.active {
  border-color: var(--sell);
  background: #e9f7ef;
  color: var(--sell);
}

.perm-banner.denied {
  border-color: var(--buy);
  background: #fde0e7;
  color: #b1253c;
}

.perm-btn {
  margin-left: auto;
  padding: 3px 9px;
  border: 1px solid var(--brand);
  border-radius: 3px;
  background: var(--brand);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 800;
}

.perm-btn:disabled {
  opacity: 0.6;
}

.perm-btn.ghost {
  background: transparent;
  border-color: currentColor;
  color: inherit;
}

/* 「添加到主屏幕」引导卡（未装成 PWA 时显示） */
.install-card {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 11px;
  border: 1px solid var(--brand);
  border-radius: 6px;
  background: var(--brand-tint);
}

.install-card .ic {
  flex: 0 0 auto;
  color: var(--brand);
}

.install-body {
  display: grid;
  gap: 1px;
  min-width: 0;
  flex: 1 1 auto;
}

.install-body b {
  font-size: 0.84rem;
  font-weight: 820;
  color: var(--ink);
}

.install-body span {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.4;
}

.install-btn {
  flex: 0 0 auto;
  padding: 5px 12px;
  border: 0;
  border-radius: 5px;
  background: var(--brand);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
}

.ai-inbox {
  display: grid;
  gap: 9px;
  padding: 11px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
}

.inbox-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.inbox-head h2 {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0 0 2px;
  color: var(--ink);
  font-size: 0.92rem;
  font-weight: 820;
}

.inbox-actions {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.source-filter {
  display: block;
}

.source-filter select {
  height: 28px;
  width: 112px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--surface);
  color: var(--ink);
  font-size: 0.72rem;
  font-weight: 800;
}

.tiny-toggle,
.icon-mini {
  display: inline-grid;
  min-height: 28px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 800;
}

.tiny-toggle {
  padding: 0 9px;
}

.tiny-toggle.active {
  border-color: var(--brand);
  background: var(--brand-tint);
  color: var(--brand-deep);
}

.icon-mini {
  width: 28px;
  height: 28px;
}

.icon-mini:disabled {
  opacity: 0.5;
}

.pref-toggle {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 7px 8px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  text-align: left;
}

.pref-toggle .open,
.inbox-open .open {
  transform: rotate(180deg);
}

.pref-panel {
  display: grid;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: #f9fafc;
}

.pref-title {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 5px;
  color: var(--ink);
  font-size: 0.8rem;
  font-weight: 820;
}

.pref-summary {
  min-width: 0;
  overflow: hidden;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 740;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pref-title b {
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--chip-mute-bg);
  color: var(--chip-mute-fg);
  font-size: 0.68rem;
  font-weight: 820;
}

.pref-save {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--brand);
  border-radius: 4px;
  background: var(--brand);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 820;
}

.pref-save:disabled {
  opacity: 0.6;
}

.pref-panel-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.pref-panel-foot .pref-error {
  flex: 1 1 auto;
}

.pref-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.pref-note {
  grid-column: span 3;
  margin: 0;
  padding: 7px 8px;
  border-radius: 4px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 720;
  line-height: 1.45;
}

.check-row,
.pref-field {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 32px;
  gap: 5px;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 800;
}

.check-row input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--brand);
}

.pref-field {
  justify-content: space-between;
}

.pref-field.wide {
  grid-column: span 3;
}

.pref-field span {
  flex: 0 0 auto;
}

.pref-field input,
.pref-field select {
  flex: 1 1 auto;
  min-width: 0;
  height: 30px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--surface);
  color: var(--ink);
  font-size: 0.75rem;
  font-weight: 760;
}

.pref-field input {
  padding: 0 7px;
}

.pref-field select {
  padding: 0 5px;
}

.pref-field input:disabled {
  opacity: 0.55;
}

.pref-error {
  padding: 7px 8px;
  border-radius: 4px;
  background: #fde0e7;
  color: #b1253c;
  font-size: 0.74rem;
  font-weight: 760;
}

.inbox-error,
.inbox-empty {
  padding: 10px;
  border-radius: 5px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 740;
}

.inbox-error {
  color: #b1253c;
  background: #fde0e7;
}

.inbox-list {
  display: grid;
  gap: 6px;
  max-height: min(56vh, 540px);
  overflow: auto;
  padding-right: 2px;
}

.inbox-item {
  display: grid;
  gap: 0;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--surface);
  overflow: hidden;
}

.inbox-item.unread {
  border-color: rgba(124, 92, 250, 0.45);
  background: #f4f0ff;
}

.inbox-item.expanded {
  border-color: rgba(124, 92, 250, 0.65);
}

.inbox-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 9px;
}

.inbox-open {
  display: grid;
  grid-template-columns: 7px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.unread-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: transparent;
}

.inbox-item.unread .unread-dot {
  background: var(--brand);
}

.inbox-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.item-head,
.detail-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 740;
}

.item-head > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-head {
  justify-content: space-between;
}

.item-head > span:nth-child(2) {
  flex: 1 1 auto;
}

.inbox-main b,
.item-body {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-main b {
  color: var(--ink);
  font-size: 0.88rem;
  font-weight: 820;
}

.item-body {
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 700;
}

.item-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.item-detail {
  display: grid;
  gap: 9px;
  padding: 0 12px 11px 24px;
  border-top: 1px solid rgba(124, 92, 250, 0.12);
}

.item-detail p {
  margin: 9px 0 0;
  color: var(--ink);
  font-size: 0.8rem;
  font-weight: 720;
  line-height: 1.55;
}

.item-detail dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 10px;
  margin: 0;
}

.item-detail dl > div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.item-detail dt {
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 760;
}

.item-detail dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 780;
}

.sev {
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--chip-mute-bg);
  color: var(--chip-mute-fg);
  font-weight: 820;
}

.sev.warning {
  background: var(--away-bg);
  color: #8a6212;
}

.sev.critical,
.sev.error {
  background: #fde0e7;
  color: #b1253c;
}

.sev.success {
  background: var(--draw-bg);
  color: var(--sell);
}

.subject-link {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 9px;
  border: 1px solid var(--brand);
  border-radius: 4px;
  color: var(--brand);
  background: #fff;
  font-size: 0.72rem;
  font-weight: 820;
  text-decoration: none;
}

.read-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 30px;
  padding: 0 8px;
  border: 1px solid var(--brand);
  border-radius: 4px;
  background: #fff;
  color: var(--brand);
  font-size: 0.72rem;
  font-weight: 820;
}

.read-btn:disabled {
  opacity: 0.6;
}

@media (max-width: 720px) {
  .inbox-head {
    grid-template-columns: 1fr;
  }

  .inbox-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto auto;
  }

  .source-filter select {
    width: 100%;
  }

  .pref-toggle {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .pref-summary {
    grid-column: 1;
    grid-row: 2;
  }

  .pref-toggle > svg:last-child {
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  .pref-grid,
  .item-detail dl {
    grid-template-columns: 1fr;
  }

  .pref-note,
  .pref-field.wide {
    grid-column: auto;
  }

  .inbox-row {
    align-items: start;
  }

  .read-btn span {
    display: none;
  }
}

.empty {
  display: grid;
  place-items: center;
  gap: 5px;
  padding: 32px 16px;
  text-align: center;
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 720;
  border: 1px dashed var(--line);
  border-radius: 5px;
  background: #f9fafc;
}

.empty p {
  margin: 4px 0 0;
  color: var(--ink);
  font-size: 0.92rem;
  font-weight: 800;
}

.signal-stream {
  display: grid;
  gap: 6px;
}

.signal-card {
  display: grid;
  gap: 3px;
  padding: 8px 11px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  color: var(--ink);
  text-decoration: none;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.74rem;
  font-weight: 740;
}

.model {
  padding: 1px 6px;
  border-radius: 2px;
  background: #fde0e7;
  color: #b1253c;
  font-weight: 800;
}

.trig {
  color: var(--muted);
}

.card-body b {
  display: block;
  margin: 2px 0;
  font-size: 0.92rem;
  font-weight: 780;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 720;
}

.status-tag {
  padding: 1px 6px;
  border-radius: 2px;
  background: var(--canvas);
  color: var(--muted);
  font-weight: 800;
}

.status-tag.exec {
  background: var(--draw-bg);
  color: var(--sell);
}

.status-tag.cond {
  background: var(--away-bg);
  color: #8a6212;
}

.trig-cnt {
  padding: 0 5px;
  border-radius: 2px;
  background: #fde0e7;
  color: #b1253c;
  font-weight: 800;
}

.chev {
  margin-left: auto;
  color: var(--brand);
}

/* 桌面：推送流居中限宽 */
@media (min-width: 1024px) {
  .push-page { max-width: var(--w-read); margin-inline: auto; }
}
</style>
