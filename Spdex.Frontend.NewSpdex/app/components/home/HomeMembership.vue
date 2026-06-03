<script setup lang="ts">
/** 首页固定模块「会员中心」：等级/到期 + 升级 CTA(免费/专家) + 账户入口 + 权益速览。 */
import { Bot, ChevronRight, Crown } from '@lucide/vue'

const { user, tier } = useAuth()

const tierLabel: Record<string, string> = {
  Free: '免费版',
  Expert: '专家版',
  Gold: '黄金版',
  Emerald: '翡翠版',
  Ruby: '红宝石版',
  Platinum: '白金版',
}

const tierDisplay = computed(() => tierLabel[tier.value] ?? tier.value)
const endDateDisplay = computed(() => {
  const raw = user.value?.endDate
  if (!raw) return '永久'
  return raw.slice(0, 10)
})
const showUpgradeCta = computed(() => tier.value === 'Free' || tier.value === 'Expert')
</script>

<template>
  <section class="col-ai">
    <div class="col-head">
      <h2>会员中心</h2>
      <span class="muted">当前 {{ tierDisplay }} · 到期 {{ endDateDisplay }}</span>
    </div>

    <NuxtLink v-if="showUpgradeCta" to="/account/upgrade" class="upgrade-box focus-ring">
      <span class="upgrade-icon">
        <Crown :size="20" />
      </span>
      <div class="upgrade-text">
        <b>升级解锁全部能力</b>
        <span>黄金及以上享时光机 / 让分异动 / 优惠付费闪Q</span>
      </div>
      <ChevronRight :size="16" />
    </NuxtLink>

    <NuxtLink to="/account" class="account-box focus-ring">
      <span class="account-icon">
        <Bot :size="20" />
      </span>
      <div class="account-text">
        <b>{{ tierDisplay }}</b>
        <span>查看锦囊余额 / 订单历史</span>
      </div>
      <ChevronRight :size="16" />
    </NuxtLink>

    <div class="info-card">
      <div class="info-head">
        <span class="dot brand" />
        <h3>会员权益速览</h3>
      </div>
      <ul>
        <li>免费版：基础数据 + 20 锦囊/天</li>
        <li>专家版：冷热指数 + 亚指 + 走势图</li>
        <li>黄金以上：时光机、独立 Q 系统、必发明细</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.col-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}

.col-head h2 {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 820;
  color: var(--ink);
}

.col-head .muted {
  font-size: 0.74rem;
  font-weight: 720;
}

.upgrade-box,
.account-box {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 5px;
  color: var(--ink);
  text-decoration: none;
}

.upgrade-box {
  margin-bottom: 8px;
  border: 1px solid #c8a64b;
  background: linear-gradient(180deg, var(--away-bg) 0%, var(--panel) 100%);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
}

.account-box {
  border: 1px solid var(--lavender-strong);
  background: linear-gradient(180deg, var(--lavender) 0%, var(--panel) 100%);
}

.upgrade-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 5px;
  background: #c8a64b;
  color: #fff;
}

.account-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 5px;
  background: var(--accent);
  color: #fff;
}

.upgrade-text,
.account-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.upgrade-text b {
  font-size: 0.92rem;
  font-weight: 820;
  color: #8a6212;
}

.account-text b {
  font-size: 0.92rem;
  font-weight: 820;
  color: var(--accent-deep);
}

.upgrade-text span,
.account-text span {
  font-size: 0.72rem;
  font-weight: 720;
  color: var(--muted);
}

/* 权益速览卡 */
.info-card {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
}

.info-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.info-head .dot {
  width: 4px;
  height: 14px;
  border-radius: 1px;
}

.info-head .dot.brand {
  background: var(--brand);
}

.info-head h3 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 800;
}

.info-card ul {
  display: grid;
  gap: 4px;
  margin: 0;
  padding-left: 14px;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 720;
  line-height: 1.45;
}
</style>
