<script setup lang="ts">
import { Bell, BellOff, ChevronRight, Flame, RefreshCw, Smartphone } from '@lucide/vue'
import type { ApiResponse } from '~/types/auth'

const { signals, pending, refresh } = useSignals(50)

// 后台 Web Push 订阅（关页/锁屏也能收到信号）
const { supported, subscribed, busy, permission, refreshState, subscribe, unsubscribe } = usePushSubscription()
// PWA 安装引导（充分利用主屏模式：可推送 + 全屏）
const { isStandalone, isIOS, canInstall, promptInstall } = usePwaInstall()
const feedback = ref('')

onMounted(async () => {
  await refreshState()
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
  .push-page { max-width: 820px; margin-inline: auto; }
}
</style>
