<script setup lang="ts">
import { ArrowUpRight, ChevronRight, Clock, Coins, Compass, CreditCard, Headphones, KeyRound, LogOut, Mail, ShieldCheck, Smartphone, UserCircle } from '@lucide/vue'

const { user, userName, tier, logout } = useAuth()
const { summary, refresh } = useAccount()
const { start: startOnboarding } = useOnboarding()
const { getCustomerService } = useCreateOrder()

// 客服 QQ（优先取后端配置，回退默认）
const customerQQ = ref('2735629769')
const qqCopied = ref(false)

async function copyQQ() {
  try {
    await navigator.clipboard.writeText(customerQQ.value)
    qqCopied.value = true
    setTimeout(() => { qqCopied.value = false }, 1500)
  }
  catch {
    // 剪贴板不可用（非安全上下文等）时忽略，号码本身已可见
  }
}

const tierLabel: Record<string, string> = {
  Free: '免费版',
  Expert: '专家版',
  Gold: '黄金版',
  Emerald: '翡翠版',
  Ruby: '红宝石版',
  Platinum: '白金版',
}

const tierDisplay = computed(() => {
  const t = summary.value?.tier ?? tier.value
  return tierLabel[t] ?? t
})

const endDate = computed(() => {
  const raw = summary.value?.endDate ?? user.value?.endDate
  if (!raw) return '永久'
  return raw.slice(0, 10)
})

const silkTotal = computed(() => Math.round(summary.value?.silkBalance?.total ?? 0))

const isTest = computed(() => summary.value?.isTestAccount === true)

const lastLogin = computed(() => {
  const raw = summary.value?.lastActivityDate
  if (!raw) return '—'
  return raw.slice(5, 16).replace('T', ' ') // "...T17:30" → "06-01 17:30"（紧凑，适配卡片宽度）
})

async function handleLogout() {
  await logout()
}

onMounted(async () => {
  await refresh()
  const cs = await getCustomerService().catch(() => null)
  if (cs?.qq) customerQQ.value = cs.qq
})
</script>

<template>
  <section class="account-page">
    <div class="account-head">
      <div class="avatar">
        <UserCircle :size="36" stroke-width="1.6" />
      </div>
      <div class="account-info">
        <b>{{ summary?.userName || userName || '—' }}<span v-if="isTest" class="test-badge">测试账号</span></b>
        <span>{{ isTest ? 'SPdex · 会员中心 · 测试账号（支付 0.01 元）' : 'SPdex · 会员中心' }}</span>
      </div>
      <NuxtLink to="/account/upgrade" class="upgrade-btn">
        <ArrowUpRight :size="14" />
        <span>升级</span>
      </NuxtLink>
    </div>

    <div class="summary-grid">
      <div class="summary-card tone-brand">
        <ShieldCheck :size="18" />
        <div class="sc-body">
          <span class="sc-label">当前会籍</span>
          <b class="sc-value">{{ tierDisplay }}</b>
        </div>
      </div>
      <div class="summary-card tone-accent">
        <CreditCard :size="18" />
        <div class="sc-body">
          <span class="sc-label">到期时间</span>
          <b class="sc-value">{{ endDate }}</b>
        </div>
      </div>
      <div class="summary-card tone-warm">
        <Coins :size="18" />
        <div class="sc-body">
          <span class="sc-label">锦囊余额</span>
          <b class="sc-value num">{{ silkTotal }}</b>
        </div>
      </div>
      <div class="summary-card tone-mute">
        <Clock :size="18" />
        <div class="sc-body">
          <span class="sc-label">上次登录</span>
          <b class="sc-value num">{{ lastLogin }}</b>
        </div>
      </div>
    </div>

    <div v-if="summary?.email || summary?.mobile" class="contact-row">
      <span v-if="summary?.email" class="contact-item">
        <Mail :size="13" />
        <span>{{ summary.email }}</span>
      </span>
      <span v-if="summary?.mobile" class="contact-item">
        <Smartphone :size="13" />
        <span>{{ summary.mobile }}</span>
      </span>
    </div>

    <section class="settings-band">
      <NuxtLink to="/account/change-password" class="setting-row focus-ring">
        <KeyRound :size="15" />
        <span>修改密码</span>
        <ChevronRight :size="15" class="chev" />
      </NuxtLink>
      <button type="button" class="setting-row focus-ring" @click="startOnboarding">
        <Compass :size="15" />
        <span>新手引导</span>
        <ChevronRight :size="15" class="chev" />
      </button>
      <button type="button" class="setting-row focus-ring" @click="copyQQ">
        <Headphones :size="15" />
        <span>客服 QQ</span>
        <b class="qq-val num">{{ qqCopied ? '已复制' : customerQQ }}</b>
      </button>
    </section>

    <button class="logout-btn focus-ring" type="button" @click="handleLogout">
      <LogOut :size="15" />
      <span>退出登录</span>
    </button>
  </section>
</template>

<style scoped>
.account-page {
  display: grid;
  gap: 10px;
  padding: 12px 12px 16px;
}

.account-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 12px 12px;
  border-radius: 6px;
  background: linear-gradient(120deg, var(--brand) 0%, var(--accent) 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(124, 92, 250, 0.25);
}

.avatar {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.18);
}

.account-info {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.account-info b {
  font-size: 1rem;
  font-weight: 820;
  letter-spacing: 0.02em;
}

.account-info span {
  opacity: 0.84;
  font-size: 0.74rem;
  font-weight: 720;
}

.test-badge {
  margin-left: 7px;
  padding: 1px 7px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.24);
  font-size: 0.62rem;
  font-weight: 820;
  letter-spacing: 0.03em;
  vertical-align: middle;
}

.upgrade-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 5px 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 800;
  text-decoration: none;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.summary-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 10px 11px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
}

.summary-card.tone-brand svg { color: var(--brand); }
.summary-card.tone-accent svg { color: var(--accent); }
.summary-card.tone-warm svg { color: #c46613; }
.summary-card.tone-mute svg { color: var(--muted); }

.sc-body {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.sc-label {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 720;
}

.sc-value {
  color: var(--ink);
  font-size: 0.92rem;
  font-weight: 800;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.contact-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 6px 11px;
  border: 1px solid var(--divider);
  border-radius: 5px;
  background: var(--panel);
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 720;
}

.contact-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.settings-band {
  display: grid;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  overflow: hidden;
}

.setting-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 11px 12px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: 0.86rem;
  font-weight: 740;
  text-align: left;
  cursor: pointer;
}

.setting-row + .setting-row {
  border-top: 1px solid var(--divider);
}

.setting-row > svg:first-child {
  color: var(--brand);
}

.setting-row .chev {
  color: var(--soft);
}

.setting-row .qq-val {
  color: var(--brand);
  font-weight: 800;
  font-size: 0.84rem;
  letter-spacing: 0.02em;
}

.setting-row:active {
  background: var(--surface);
}

.logout-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  gap: 6px;
  border: 1px solid var(--buy);
  border-radius: 5px;
  background: var(--panel);
  color: var(--buy);
  font-weight: 800;
  font-size: 0.86rem;
}

.logout-btn:active { background: #fde8eb; }

@media (min-width: 768px) {
  .summary-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

/* 桌面：内容居中限宽，避免单列拉伸到整屏 */
@media (min-width: 1024px) {
  .account-page { max-width: 880px; margin-inline: auto; }
}
</style>
