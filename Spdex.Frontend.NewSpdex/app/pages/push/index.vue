<script setup lang="ts">
import { Bell, BellOff, Check, CheckCheck, ChevronRight, Flame, Inbox, RefreshCw, Smartphone } from '@lucide/vue'
import type {
  AiInAppNotificationListResult,
  AiInAppNotificationMarkAllReadResult,
  AiInAppNotificationReadResult,
  AiInAppNotificationRow,
} from '~/types/ai-notification'
import type { ApiResponse } from '~/types/auth'

const { signals, pending, refresh } = useSignals(50)

// 后台 Web Push 订阅（关页/锁屏也能收到信号）
const { supported, subscribed, busy, permission, refreshState, subscribe, unsubscribe } = usePushSubscription()
// PWA 安装引导（充分利用主屏模式：可推送 + 全屏）
const { isStandalone, isIOS, canInstall, promptInstall } = usePwaInstall()
const feedback = ref('')
const aiNotificationsVisible = useAiNotificationVisibility()
const aiNotifications = ref<AiInAppNotificationListResult | null>(null)
const aiNotificationsLoading = ref(false)
const aiNotificationError = ref('')
const aiUnreadOnly = ref(false)
const markingNotificationId = ref('')
const markingAllNotifications = ref(false)

onMounted(async () => {
  await refreshState()
  if (aiNotificationsVisible.value) await loadAiNotifications()
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

async function loadAiNotifications() {
  aiNotificationsLoading.value = true
  aiNotificationError.value = ''
  try {
    aiNotifications.value = await $apiFetch<AiInAppNotificationListResult>(
      '/api/newspdex/ai/notifications/in-app',
      {
        query: {
          unreadOnly: aiUnreadOnly.value || undefined,
          limit: 50,
        },
      },
    )
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string, error_description?: string }, statusCode?: number }
    aiNotificationError.value = fetchError.data?.message || fetchError.data?.error_description || 'AI 收件箱暂不可用'
  }
  finally {
    aiNotificationsLoading.value = false
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

function replaceAiNotification(next: AiInAppNotificationRow) {
  if (!aiNotifications.value) return
  const previous = aiNotifications.value.items.find(item => item.inAppNotificationId === next.inAppNotificationId)
  const unreadDelta = previous && !previous.readAt && next.readAt ? 1 : 0
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

function notificationSubject(item: AiInAppNotificationRow): string {
  const subject = item.payloadRef?.subject
  const matchId = subject?.match_id ?? subject?.matchId
  if (typeof matchId === 'number' || typeof matchId === 'string') return `赛事 ${matchId}`
  const date = subject?.date
  if (typeof date === 'string' && date) return date
  return item.payloadRef?.conditionKind || item.source || 'AI 观察'
}

function notificationTarget(item: AiInAppNotificationRow): string | null {
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
          <span class="muted num">{{ aiNotificationItems.length }} 条 · {{ aiUnreadCount }} 未读</span>
        </div>
        <div class="inbox-actions">
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

      <div v-if="aiNotificationError" class="inbox-error">{{ aiNotificationError }}</div>
      <div v-else-if="aiNotificationsLoading && !aiNotificationItems.length" class="inbox-empty">加载中…</div>
      <div v-else-if="!aiNotificationItems.length" class="inbox-empty">暂无 AI 观察通知</div>
      <div v-else class="inbox-list">
        <article
          v-for="item in aiNotificationItems"
          :key="item.inAppNotificationId"
          :class="['inbox-item', { unread: !item.readAt }]"
        >
          <div class="inbox-main">
            <div class="item-head">
              <span class="sev" :class="item.severity.toLowerCase()">{{ severityText(item.severity) }}</span>
              <span class="num">{{ formatNotificationTime(item.createdAt) }}</span>
            </div>
            <b>{{ item.title }}</b>
            <p>{{ item.body }}</p>
            <div class="item-foot">
              <NuxtLink
                v-if="notificationTarget(item)"
                :to="notificationTarget(item) || '/'"
                class="subject-link focus-ring"
              >
                {{ notificationSubject(item) }}
              </NuxtLink>
              <span v-else>{{ notificationSubject(item) }}</span>
              <span>{{ item.payloadRef?.conditionKind || item.source }}</span>
            </div>
          </div>
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
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
}

.inbox-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  display: inline-flex;
  align-items: center;
  gap: 5px;
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
}

.inbox-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 9px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--surface);
}

.inbox-item.unread {
  border-color: rgba(124, 92, 250, 0.45);
  background: #f4f0ff;
}

.inbox-main {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.item-head,
.item-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 740;
}

.item-head {
  justify-content: space-between;
}

.inbox-main b,
.inbox-main p {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inbox-main b {
  color: var(--ink);
  font-size: 0.86rem;
  font-weight: 820;
}

.inbox-main p {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 700;
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
  color: var(--brand);
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
