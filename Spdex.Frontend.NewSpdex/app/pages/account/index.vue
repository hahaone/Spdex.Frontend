<script setup lang="ts">
import { Activity, ArrowUpRight, Coins, CreditCard, LogOut, Mail, ShieldCheck, Smartphone, UserCircle } from '@lucide/vue'

const { user, userName, tier, logout } = useAuth()
const { summary, orders, ordersServiceAvailable, pending, refresh } = useAccount()

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

const channelLabel: Record<string, string> = {
  yft: '扫码（YFT）',
  alipay: '支付宝',
  silk: '锦囊扣点',
  wechat: '微信',
  qq: 'QQ 钱包',
}

const statusToneMap: Record<number, string> = {
  0: 'mute',
  1: 'positive',
  2: 'negative',
  3: 'mute',
}

async function handleLogout() {
  logout()
  await navigateTo('/login')
}

onMounted(async () => {
  await refresh()
})
</script>

<template>
  <section class="account-page">
    <div class="account-head">
      <div class="avatar">
        <UserCircle :size="36" stroke-width="1.6" />
      </div>
      <div class="account-info">
        <b>{{ summary?.userName || userName || '—' }}</b>
        <span>SPdex · 会员中心</span>
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
        <Activity :size="18" />
        <div class="sc-body">
          <span class="sc-label">RoleId</span>
          <b class="sc-value num">{{ summary?.roleId ?? user?.roleId ?? '-' }}</b>
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

    <section class="orders-band">
      <div class="band-head">
        <h2>订单历史</h2>
        <span class="muted num">{{ orders.length }} 条</span>
      </div>

      <div v-if="pending && !orders.length" class="loading">加载中…</div>
      <div v-else-if="!ordersServiceAvailable" class="empty service-down">
        订单查询服务暂时不可访问。如有疑问请联系客服核对支付记录。
      </div>
      <div v-else-if="!orders.length" class="empty">暂无订单</div>
      <div v-else class="order-table">
        <div class="order-head">
          <span>时间</span>
          <span>套餐</span>
          <span>渠道</span>
          <span>金额</span>
          <span>状态</span>
        </div>
        <div v-for="order in orders" :key="order.orderId" class="order-row">
          <span class="num">{{ order.createTime?.slice(0, 16) ?? '—' }}</span>
          <span>{{ order.roleName ?? order.roleId }} · {{ order.dueMonths }}月</span>
          <span>{{ channelLabel[order.channel] ?? order.channel }}</span>
          <span class="num">¥{{ order.amount }}</span>
          <span :class="['tag', `tone-${statusToneMap[order.status] ?? 'mute'}`]">{{ order.statusText ?? '—' }}</span>
        </div>
      </div>
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
  background: linear-gradient(120deg, #1a8cd3 0%, #6e5aaf 100%);
  color: #fff;
  box-shadow: 0 4px 14px rgba(26, 140, 211, 0.25);
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

.upgrade-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 5px 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.92);
  color: #1a2233;
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
  border: 1px solid #dde2eb;
  border-radius: 5px;
  background: #fff;
}

.summary-card.tone-brand svg { color: #1a8cd3; }
.summary-card.tone-accent svg { color: #6e5aaf; }
.summary-card.tone-warm svg { color: #c46613; }
.summary-card.tone-mute svg { color: #6b7280; }

.sc-body {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.sc-label {
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 720;
}

.sc-value {
  color: #1a2233;
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
  border: 1px solid #eaeef4;
  border-radius: 5px;
  background: #fff;
  color: #4a5364;
  font-size: 0.78rem;
  font-weight: 720;
}

.contact-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.orders-band {
  display: grid;
  gap: 6px;
  padding: 10px 11px 11px;
  border: 1px solid #dde2eb;
  border-radius: 5px;
  background: #fff;
}

.band-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.band-head h2 {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 820;
}

.muted {
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 720;
}

.loading,
.empty {
  padding: 14px;
  text-align: center;
  color: #6b7280;
  font-size: 0.78rem;
  font-weight: 720;
}

.empty.service-down {
  color: #8a6212;
  background: #fff8e3;
  border: 1px solid #fce4a8;
  border-radius: 4px;
}

.order-table {
  border: 1px solid #eaeef4;
  border-radius: 4px;
  overflow: hidden;
}

.order-head,
.order-row {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 80px 64px 56px;
  gap: 6px;
  padding: 5px 8px;
  font-size: 0.76rem;
  font-weight: 720;
}

.order-head {
  background: #f4f6fb;
  color: #4f3f86;
  font-weight: 800;
  font-size: 0.72rem;
}

.order-row {
  border-top: 1px solid #eaeef4;
  color: #1a2233;
}

.tag {
  display: inline-grid;
  place-items: center;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 760;
}

.tag.tone-positive { background: rgba(46, 156, 95, 0.16); color: #246b3b; }
.tag.tone-negative { background: rgba(214, 50, 76, 0.16); color: #b1253c; }
.tag.tone-mute { background: rgba(107, 114, 128, 0.14); color: #4a5364; }

.logout-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  gap: 6px;
  border: 1px solid #d6324c;
  border-radius: 5px;
  background: #fff;
  color: #d6324c;
  font-weight: 800;
  font-size: 0.86rem;
}

.logout-btn:active { background: #fde8eb; }

@media (min-width: 768px) {
  .summary-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
