<script setup lang="ts">
import { ArrowLeft, CheckCircle, Coins, CreditCard, Flame, QrCode, Sparkles } from '@lucide/vue'
import type { PaymentPlan, PriceStage } from '~/types/billing'
import { canPurchaseTarget } from '~/utils/membership'

const { user } = useAuth()
const { plans, pending, error } = useBillingPlans()
const { getSilkBalance, getCustomerService } = useCreateOrder()

// 当前用户余额（用于锦囊不足提示）
const silkBalance = ref<number>(0)
const customerQQ = ref<string>('')

onMounted(async () => {
  const [balance, cs] = await Promise.all([getSilkBalance(), getCustomerService()])
  silkBalance.value = Math.round(balance?.total ?? 0)
  customerQQ.value = cs?.qq || '2735629769'
})

// V3 风格的卡片配色
const tierTones: Record<number, string> = {
  11: 'emerald',
  5: 'platinum',
  10: 'gold',
  12: 'ruby',
  4: 'expert',
  2: 'free',
}

function tierTone(roleId: number): string {
  return tierTones[roleId] ?? 'mute'
}

function isCurrentTier(roleId: number): boolean {
  return user.value?.roleId === roleId
}

const availablePlans = computed(() =>
  plans.value.filter(plan =>
    plan.prices.length > 0
      ? canPurchaseTarget(user.value, plan.roleId)
      : isCurrentTier(plan.roleId)))

const featuredPlans = computed(() => availablePlans.value.filter(p => p.hot > 0))
const standardPlans = computed(() => availablePlans.value.filter(p => p.hot === 0))

function pickStage(plan: PaymentPlan, stage: PriceStage) {
  if (!canPurchaseTarget(user.value, plan.roleId)) return
  navigateTo({
    path: '/account/upgrade/result',
    query: { roleId: plan.roleId, stageId: stage.stageId, channel: 'choose' },
  })
}
</script>

<template>
  <section class="upgrade-page">
    <div class="page-head">
      <NuxtLink to="/account" class="back-link">
        <ArrowLeft :size="14" />
        <span>返回</span>
      </NuxtLink>
      <h1>会员升级</h1>
      <span class="silk">
        <Coins :size="13" />
        <span class="num">{{ silkBalance }}</span>
        <span class="silk-label">锦囊</span>
      </span>
    </div>

    <div v-if="pending && !plans.length" class="loading" role="status">加载套餐中…</div>
    <div v-else-if="error" class="empty" role="status">套餐加载失败：{{ error.message ?? '网关无响应' }}</div>

    <template v-else>
      <!-- 顶部 3 张大卡（推荐区） -->
      <section v-if="featuredPlans.length" class="featured-grid">
        <article
          v-for="plan in featuredPlans"
          :key="plan.roleId"
          :class="['plan-card', 'featured', `tone-${tierTone(plan.roleId)}`]"
        >
          <div class="card-head">
            <span class="hot-tag"><Flame :size="11" /> HOT</span>
            <h2>{{ plan.roleName }}</h2>
            <p class="desc">{{ plan.roleDescription || '解锁更多专业指数与走势图' }}</p>
            <span v-if="isCurrentTier(plan.roleId)" class="current-tag">当前会籍</span>
          </div>
          <div class="price-list">
            <button
              v-for="stage in plan.prices"
              :key="stage.stageId"
              class="price-row focus-ring"
              type="button"
              @click="pickStage(plan, stage)"
            >
              <span class="stage-name">{{ stage.stageName }}</span>
              <span class="price-amount num">¥{{ stage.price }}</span>
            </button>
          </div>
          <p v-if="plan.discountDes" class="discount">{{ plan.discountDes }}</p>
        </article>
      </section>

      <!-- 底部 4 张小卡 -->
      <section v-if="standardPlans.length" class="standard-grid">
        <article
          v-for="plan in standardPlans"
          :key="plan.roleId"
          :class="['plan-card', 'standard', `tone-${tierTone(plan.roleId)}`]"
        >
          <div class="card-head">
            <h3>{{ plan.roleName }}</h3>
            <p class="desc">{{ plan.roleDescription || '—' }}</p>
            <span v-if="isCurrentTier(plan.roleId)" class="current-tag">当前会籍</span>
          </div>
          <div v-if="plan.prices.length" class="price-list">
            <button
              v-for="stage in plan.prices"
              :key="stage.stageId"
              class="price-row focus-ring"
              type="button"
              @click="pickStage(plan, stage)"
            >
              <span class="stage-name">{{ stage.stageName }}</span>
              <span class="price-amount num">¥{{ stage.price }}</span>
            </button>
          </div>
          <p v-else class="free-hint">永久免费</p>
        </article>
      </section>

      <!-- 工作室版客服联系（V3 等价） -->
      <section class="studio-band">
        <div class="studio-head">
          <Sparkles :size="14" />
          <b>工作室版需联系客服开通</b>
        </div>
        <div class="studio-body">
          <span>客服 QQ：</span>
          <b class="num">{{ customerQQ }}</b>
        </div>
        <p class="studio-hint">工作室版含定制研究群、专属信号、独立 Q 系统。请添加客服 QQ 沟通。</p>
      </section>

      <!-- 支付方式说明 -->
      <section class="pay-info">
        <h2>支持的支付方式</h2>
        <div class="pay-methods">
          <span class="pay-item"><CreditCard :size="13" /> 支付宝</span>
          <span class="pay-item"><QrCode :size="13" /> 扫码支付</span>
          <span class="pay-item"><Coins :size="13" /> 锦囊扣点</span>
          <span class="pay-item"><QrCode :size="13" /> 微信扫码</span>
        </div>
        <p class="pay-hint">
          <CheckCircle :size="12" />
          <span>支付成功后请重新登录或停留 30 秒，会籍状态会自动刷新。</span>
        </p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.upgrade-page {
  display: grid;
  gap: 10px;
  padding: 12px 12px 18px;
}

.page-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--brand);
  font-size: 0.78rem;
  font-weight: 740;
  text-decoration: none;
}

.page-head h1 {
  margin: 0;
  text-align: center;
  font-size: 0.96rem;
  font-weight: 820;
}

.silk {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 9px;
  border: 1px solid var(--away-strong);
  border-radius: 3px;
  background: var(--away-bg);
  color: #8a6212;
  font-size: 0.74rem;
  font-weight: 800;
}

.silk-label { font-size: 0.68rem; opacity: 0.84; }

.loading,
.empty {
  padding: 28px;
  text-align: center;
  color: var(--muted);
  font-size: 0.84rem;
}

/* ─── 卡片网格 ─── */
.featured-grid {
  display: grid;
  gap: 8px;
}

.standard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.plan-card {
  display: grid;
  gap: 8px;
  padding: 11px 12px 12px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  position: relative;
}

.plan-card.tone-emerald { border-color: var(--sell); background: linear-gradient(180deg, #e9f7ef 0%, var(--panel) 80%); }
.plan-card.tone-platinum { border-color: var(--accent); background: linear-gradient(180deg, var(--lavender) 0%, var(--panel) 80%); }
.plan-card.tone-gold { border-color: #c8a64b; background: linear-gradient(180deg, var(--away-bg) 0%, var(--panel) 80%); }
.plan-card.tone-ruby { border-color: #b1253c; background: linear-gradient(180deg, #fde8eb 0%, var(--panel) 80%); }
.plan-card.tone-expert { border-color: var(--brand); }
.plan-card.tone-free { border-color: #c0c8d4; }

.card-head h2 { margin: 0; font-size: 1.04rem; font-weight: 820; }
.card-head h3 { margin: 0; font-size: 0.92rem; font-weight: 800; }

.hot-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 4px;
  padding: 2px 8px;
  border-radius: 3px;
  background: #b1253c;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 800;
}

.desc {
  margin: 0;
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 720;
  line-height: 1.45;
}

.current-tag {
  position: absolute;
  top: 9px;
  right: 9px;
  padding: 2px 7px;
  border-radius: 3px;
  background: var(--sell);
  color: #fff;
  font-size: 0.66rem;
  font-weight: 800;
}

.price-list {
  display: grid;
  gap: 4px;
}

.price-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--ink);
  font-size: 0.82rem;
  font-weight: 760;
  cursor: pointer;
  text-align: left;
}

.price-row:active { background: #f4f6fb; }

.stage-name { color: var(--muted); }

.price-amount { color: #b1253c; font-weight: 820; }

.discount {
  margin: 0;
  color: #c46613;
  font-size: 0.72rem;
  font-weight: 720;
}

.free-hint {
  margin: 0;
  padding: 6px 0;
  text-align: center;
  color: var(--sell);
  font-size: 0.8rem;
  font-weight: 800;
}

/* ─── 工作室版 ─── */
.studio-band {
  display: grid;
  gap: 4px;
  padding: 11px 12px 12px;
  border: 1px dashed var(--accent);
  border-radius: 5px;
  background: #faf8fd;
}

.studio-head {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent-deep);
  font-size: 0.86rem;
  font-weight: 820;
}

.studio-body {
  color: var(--ink);
  font-size: 0.82rem;
  font-weight: 740;
}

.studio-body b {
  color: var(--accent-deep);
  font-weight: 820;
  letter-spacing: 0.02em;
}

.studio-hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 720;
  line-height: 1.55;
}

/* ─── 支付方式说明 ─── */
.pay-info {
  display: grid;
  gap: 6px;
  padding: 9px 11px 10px;
  border: 1px solid var(--divider);
  border-radius: 5px;
  background: var(--panel);
}

.pay-info h2 {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 820;
}

.pay-methods {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.pay-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 9px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--panel);
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 740;
}

.pay-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: var(--sell);
  font-size: 0.72rem;
  font-weight: 720;
  line-height: 1.55;
}

@media (min-width: 768px) {
  .featured-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .standard-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
</style>
