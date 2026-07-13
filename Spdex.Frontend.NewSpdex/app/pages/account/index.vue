<script setup lang="ts">
import { ArrowUpRight, ChevronRight, Clock, Coins, Compass, CreditCard, Headphones, KeyRound, LogOut, Mail, ReceiptText, ShieldCheck, Smartphone, UserCircle } from '@lucide/vue'
import type { OrderRecord } from '~/types/billing'
import { effectiveMembershipDisplayName } from '~/utils/membership'

const route = useRoute()
const router = useRouter()
const { user, userName, tier, logout, refreshToken } = useAuth()
const { summary, orders, ordersServiceAvailable, refresh } = useAccount()
const { start: startOnboarding } = useOnboarding()
const { getCustomerService, syncAlipayOrder } = useCreateOrder()

// 客服 QQ（优先取后端配置，回退默认）
const customerQQ = ref('2735629769')
const qqCopied = ref(false)
const paymentNotice = ref('')
const syncingPayment = ref(false)
const showSilkRechargeEntry = false

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
  const roleId = summary.value?.roleId ?? user.value?.roleId
  const roleName = summary.value?.roleName ?? user.value?.roleName
  const t = summary.value?.tier ?? tier.value
  const rawEndDate = summary.value?.endDate ?? user.value?.endDate
  return effectiveMembershipDisplayName(roleId, roleName, t, rawEndDate) || tierLabel[t] || t
})

const endDate = computed(() => {
  const raw = summary.value?.endDate ?? user.value?.endDate
  if (!raw) return '永久'
  return raw.slice(0, 10)
})

const silkTotal = computed(() => Math.round(summary.value?.silkBalance?.total ?? 0))

const isTest = computed(() => summary.value?.isTestAccount === true)
const recentOrders = computed(() => orders.value.slice(0, 5))

const lastLogin = computed(() => {
  return formatCompactLocalTime(summary.value?.lastActivityDate)
})

async function handleLogout() {
  await logout()
}

function queryStringValue(value: unknown) {
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
}

async function reconcileAlipayReturn() {
  if (queryStringValue(route.query.payment) !== 'alipay') return

  const orderId = queryStringValue(route.query.out_trade_no || route.query.orderId)
  if (!orderId) {
    paymentNotice.value = '支付宝支付结果确认中'
    return
  }

  syncingPayment.value = true
  paymentNotice.value = '正在确认支付宝支付结果'
  const result = await syncAlipayOrder(orderId)
  syncingPayment.value = false

  if (result?.paid) {
    paymentNotice.value = '支付已确认，会籍已更新'
    await refreshToken()
  }
  else {
    paymentNotice.value = result?.message || '支付结果仍在确认中'
  }

  await router.replace('/account')
}

function channelLabel(channel: string) {
  const key = channel.toLowerCase()
  if (key === 'alipay') return '支付宝'
  if (key === 'yft') return '支付宝扫码'
  if (key === 'wxcode' || key === 'wechat') return '微信（已停用）'
  if (key === 'silk') return '锦囊'
  return channel || '—'
}

function formatAmount(amount: number) {
  return `¥${amount.toFixed(2)}`
}

function parseApiDateTime(raw: string) {
  const text = raw.trim()
  const isoLike = text.includes('T') ? text : text.replace(' ', 'T')
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(isoLike) ? isoLike : `${isoLike}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatCompactLocalTime(raw?: string | null) {
  if (!raw) return '—'
  const date = parseApiDateTime(raw)
  if (!date) return '—'
  return `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function formatOrderTime(raw: string | null) {
  return formatCompactLocalTime(raw)
}

function orderStatusClass(order: OrderRecord) {
  if (order.status === 1) return 'is-paid'
  if (order.status === 0) return 'is-pending'
  return 'is-failed'
}

onMounted(async () => {
  await reconcileAlipayReturn()
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

    <div v-if="paymentNotice" class="payment-notice" :class="{ syncing: syncingPayment }">
      <CreditCard :size="14" />
      <span>{{ paymentNotice }}</span>
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
      <NuxtLink v-if="showSilkRechargeEntry" to="/account/silkbag/recharge" class="setting-row focus-ring">
        <Coins :size="15" />
        <span>充值锦囊</span>
        <b class="qq-val num">余额 {{ silkTotal }}</b>
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

    <section class="orders-band">
      <div class="band-head">
        <span>
          <ReceiptText :size="15" />
          <b>最近订单</b>
        </span>
        <em v-if="!ordersServiceAvailable">历史订单暂不可用</em>
      </div>
      <div v-if="recentOrders.length" class="order-list">
        <div v-for="order in recentOrders" :key="order.orderId" class="order-row">
          <div class="order-main">
            <b class="num">{{ order.orderId }}</b>
            <span>{{ channelLabel(order.channel) }} · {{ formatOrderTime(order.createTime) }}</span>
          </div>
          <div class="order-side">
            <b class="num">{{ formatAmount(order.amount) }}</b>
            <span class="order-status" :class="orderStatusClass(order)">{{ order.statusText || '—' }}</span>
          </div>
        </div>
      </div>
      <div v-else class="empty-orders">暂无订单</div>
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

.payment-notice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 8px 10px;
  border: 1px solid #b7e4c7;
  border-radius: 5px;
  background: #f0fff4;
  color: #1b6a3a;
  font-size: 0.8rem;
  font-weight: 780;
}

.payment-notice.syncing {
  border-color: #d8cdfc;
  background: #f6f2ff;
  color: var(--brand);
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
  text-decoration: none;
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

.orders-band {
  display: grid;
  gap: 0;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  overflow: hidden;
}

.band-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--divider);
}

.band-head span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink);
  font-size: 0.86rem;
}

.band-head svg {
  color: var(--brand);
}

.band-head em {
  color: var(--muted);
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 720;
}

.order-list {
  display: grid;
}

.order-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
}

.order-row + .order-row {
  border-top: 1px solid var(--divider);
}

.order-main,
.order-side {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.order-main b {
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 820;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.order-main span {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 720;
}

.order-side {
  justify-items: end;
}

.order-side b {
  color: var(--ink);
  font-size: 0.8rem;
  font-weight: 820;
}

.order-status {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 820;
}

.order-status.is-paid {
  background: #e9f9ef;
  color: #17703b;
}

.order-status.is-pending {
  background: #fff7e6;
  color: #9a5a00;
}

.order-status.is-failed {
  background: #fdecef;
  color: #b4233c;
}

.empty-orders {
  padding: 13px 12px;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 720;
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
  .account-page { max-width: var(--w-read); margin-inline: auto; }
}
</style>
