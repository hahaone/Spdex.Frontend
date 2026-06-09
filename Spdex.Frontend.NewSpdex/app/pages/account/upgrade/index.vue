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
const compareMonths = [2, 3, 6, 12]
const comparisonPlans = computed(() => availablePlans.value.filter(p => p.prices.length > 0))
const comparisonRows = computed(() => comparisonPlans.value.map(plan => ({
  plan,
  unitPrice: stageUnitPrice(plan),
  cells: compareMonths.map(month => stageForMonth(plan, month)),
})))

const benefitRows = [
  { feature: '基础赛事', free: '主流赛事', expert: '全部开放', gold: '全部开放', ruby: '全部开放', emerald: '全部开放', platinum: '全部开放' },
  { feature: '数据回查', free: '不可用', expert: '可用', gold: '可用', ruby: '可用', emerald: '可用', platinum: '可用' },
  { feature: '经典版', free: '基础列表', expert: '走势图/明细', gold: '时光机/明细', ruby: '增强指数', emerald: '增强指数', platinum: '全量盘口' },
  { feature: '走势图', free: '未开放', expert: '标盘/指数', gold: '标盘/指数', ruby: '完整走势', emerald: '完整走势', platinum: '完整走势' },
  { feature: 'FlashQ', free: '不可用', expert: '20 次/天', gold: '10 次/天', ruby: '按锦囊', emerald: '按锦囊', platinum: '不限量' },
  { feature: 'Q 系统', free: '不可用', expert: '不可用', gold: '5 模型', ruby: '5 模型/内外盘', emerald: '5 模型/进球均衡', platinum: '10 模型/全量' },
  { feature: '比分/角球', free: '不可用', expert: '不可用', gold: '不可用', ruby: '不可用', emerald: '不可用', platinum: '开放' },
]

function pickStage(plan: PaymentPlan, stage: PriceStage) {
  if (!canPurchaseTarget(user.value, plan.roleId)) return
  navigateTo({
    path: '/account/upgrade/result',
    query: { roleId: plan.roleId, stageId: stage.stageId, channel: 'choose' },
  })
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—'
  const rounded = Math.round(value)
  const digits = Math.abs(value - rounded) < 0.005 ? 0 : 2
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function stageForMonth(plan: PaymentPlan, month: number): PriceStage | null {
  return plan.prices.find(stage => Math.abs(stage.month - month) < 0.01) ?? null
}

function monthDurationDays(month: number): number {
  if (Math.abs(month - 12) < 0.01) return 365
  return Math.round(month * 30)
}

function displayStageDays(stage: PriceStage): number | null {
  if (stage.month > 0) return monthDurationDays(stage.month)
  if (stage.days <= 0) return null
  return [30, 60, 90, 180, 365].find(days => stage.days >= days && stage.days <= days + 3) ?? stage.days
}

function stageDurationLabel(stage: PriceStage): string {
  const days = displayStageDays(stage)
  if (days) return `${days}天`
  return stage.stageName
}

function durationLabelForMonth(month: number): string {
  return `${monthDurationDays(month)}天`
}

function stageDiscountLabel(plan: PaymentPlan, stage: PriceStage): string {
  if (stage.discountLabel) return stage.discountLabel
  const days = displayStageDays(stage)
  if (plan.roleId === 12 && days && days >= 365) return '7折'
  return ''
}

function stageUnitPrice(plan: PaymentPlan): string {
  const monthly = stageForMonth(plan, 1) ?? plan.prices[0]
  return monthly ? `¥${formatPrice(monthly.price)} / 30天` : plan.unit || '—'
}

function stageAriaLabel(plan: PaymentPlan, stage: PriceStage): string {
  return `${plan.roleName}${stageDurationLabel(stage)}，${formatPrice(stage.price)}元`
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
              :aria-label="stageAriaLabel(plan, stage)"
              @click="pickStage(plan, stage)"
            >
              <span class="stage-name">
                {{ stageDurationLabel(stage) }}
                <b v-if="stageDiscountLabel(plan, stage)" class="discount-chip">{{ stageDiscountLabel(plan, stage) }}</b>
              </span>
              <span class="price-stack">
                <s v-if="stage.originalPrice && stage.originalPrice > stage.price" class="original-price num">
                  ¥{{ formatPrice(stage.originalPrice) }}
                </s>
                <span class="price-amount num">¥{{ formatPrice(stage.price) }}</span>
              </span>
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
              :aria-label="stageAriaLabel(plan, stage)"
              @click="pickStage(plan, stage)"
            >
              <span class="stage-name">
                {{ stageDurationLabel(stage) }}
                <b v-if="stageDiscountLabel(plan, stage)" class="discount-chip">{{ stageDiscountLabel(plan, stage) }}</b>
              </span>
              <span class="price-stack">
                <s v-if="stage.originalPrice && stage.originalPrice > stage.price" class="original-price num">
                  ¥{{ formatPrice(stage.originalPrice) }}
                </s>
                <span class="price-amount num">¥{{ formatPrice(stage.price) }}</span>
              </span>
            </button>
          </div>
          <p v-else class="free-hint">永久免费</p>
        </article>

        <!-- #14 工作室版:纯展示卡(并列于套餐卡),仅联系客服开通、不在线下单,不进套餐体系。 -->
        <article class="plan-card standard studio-card">
          <div class="card-head">
            <h3><Sparkles :size="13" /> 工作室版</h3>
            <p class="desc">联系客服了解开通</p>
          </div>
          <ul class="studio-feats">
            <li>日金版全功能</li>
            <li>毫秒现场</li>
            <li>专属模型</li>
            <li>Poly 明细</li>
            <li>Kalshi 明细</li>
          </ul>
          <div class="studio-contact">
            <span>联系客服 QQ</span>
            <b class="num">{{ customerQQ }}</b>
            <span>了解开通</span>
          </div>
        </article>
      </section>

      <!-- 支付方式说明 -->
      <section class="pay-info">
        <h2>支持的支付方式</h2>
        <div class="pay-methods">
          <span class="pay-item"><CreditCard :size="13" /> 支付宝</span>
          <span class="pay-item"><QrCode :size="13" /> 扫码支付（微信/支付宝）</span>
          <span class="pay-item"><Coins :size="13" /> 锦囊扣点</span>
          <span class="pay-item muted"><QrCode :size="13" /> 微信扫码（限额）</span>
        </div>
        <p class="pay-hint">
          <CheckCircle :size="12" />
          <span>支付成功后请重新登录或停留 30 秒，会籍状态会自动刷新。</span>
        </p>
      </section>

      <section v-if="comparisonPlans.length" class="compare-band">
        <div class="compare-head">
          <h2>套餐对照</h2>
          <span>按时长快速比较价格</span>
        </div>
        <div class="compare-scroll">
          <table>
            <thead>
              <tr>
                <th>会籍</th>
                <th>30天价</th>
                <th v-for="month in compareMonths" :key="month">{{ durationLabelForMonth(month) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in comparisonRows" :key="row.plan.roleId">
                <th>
                  <span>{{ row.plan.roleName }}</span>
                  <small>{{ row.plan.roleDescription || '—' }}</small>
                </th>
                <td>{{ row.unitPrice }}</td>
                <td v-for="(stage, index) in row.cells" :key="compareMonths[index]">
                  <template v-if="stage">
                    <button
                      class="compare-price focus-ring"
                      type="button"
                      @click="pickStage(row.plan, stage)"
                    >
                      <span class="num">¥{{ formatPrice(stage.price) }}</span>
                      <b v-if="stageDiscountLabel(row.plan, stage)">{{ stageDiscountLabel(row.plan, stage) }}</b>
                    </button>
                  </template>
                  <span v-else class="dash">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="benefits-band">
        <div class="compare-head">
          <h2>会籍权益说明</h2>
          <span>按当前开放能力展示</span>
        </div>
        <div class="benefits-scroll">
          <table>
            <thead>
              <tr>
                <th>能力</th>
                <th>免费</th>
                <th>专家</th>
                <th>黄金</th>
                <th>红宝石</th>
                <th>翡翠</th>
                <th>白金</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in benefitRows" :key="row.feature">
                <th>{{ row.feature }}</th>
                <td>{{ row.free }}</td>
                <td>{{ row.expert }}</td>
                <td>{{ row.gold }}</td>
                <td>{{ row.ruby }}</td>
                <td>{{ row.emerald }}</td>
                <td>{{ row.platinum }}</td>
              </tr>
            </tbody>
          </table>
        </div>
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

.stage-name {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: var(--muted);
}

.discount-chip {
  padding: 1px 5px;
  border-radius: 3px;
  background: #fff3d2;
  color: #9a650e;
  font-size: 0.64rem;
  font-weight: 820;
  white-space: nowrap;
}

.price-stack {
  display: inline-grid;
  justify-items: end;
  gap: 1px;
}

.original-price {
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 720;
}

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
/* #14 工作室版纯展示卡(并列于套餐卡;沿用 .plan-card.standard 卡框)。 */
.studio-card .card-head h3 {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.studio-feats {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  gap: 4px;
}

.studio-feats li {
  position: relative;
  padding-left: 15px;
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 720;
}

.studio-feats li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--accent-deep);
  font-weight: 820;
}

.studio-contact {
  margin-top: 10px;
  padding: 8px 10px;
  border: 1px dashed var(--accent);
  border-radius: 5px;
  background: #faf8fd;
  text-align: center;
  color: var(--ink);
  font-size: 0.8rem;
  font-weight: 740;
}

.studio-contact b {
  margin: 0 5px;
  color: var(--accent-deep);
  font-weight: 820;
  letter-spacing: 0.02em;
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

.pay-item.muted {
  color: #9aa4b2;
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

/* ─── 套餐对照 ─── */
.compare-band,
.benefits-band {
  display: grid;
  gap: 8px;
  padding: 10px 11px 12px;
  border: 1px solid var(--divider);
  border-radius: 5px;
  background: var(--panel);
}

.compare-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.compare-head h2 {
  margin: 0;
  font-size: 0.84rem;
  font-weight: 820;
}

.compare-head span {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 720;
}

.compare-scroll,
.benefits-scroll {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 5px;
}

.compare-scroll table,
.benefits-scroll table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  font-size: 0.76rem;
}

.compare-scroll th,
.compare-scroll td,
.benefits-scroll th,
.benefits-scroll td {
  padding: 8px 9px;
  border-top: 1px solid var(--line);
  text-align: right;
  vertical-align: top;
  white-space: nowrap;
}

.compare-scroll thead th,
.benefits-scroll thead th {
  border-top: 0;
  background: #f7f8fc;
  color: var(--muted);
  font-weight: 800;
}

.compare-scroll th:first-child,
.compare-scroll td:first-child,
.benefits-scroll th:first-child,
.benefits-scroll td:first-child {
  text-align: left;
}

.compare-scroll tbody th,
.benefits-scroll tbody th {
  color: var(--ink);
  font-weight: 820;
}

.compare-scroll tbody th span,
.compare-scroll tbody th small {
  display: block;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.compare-scroll tbody th small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 680;
}

.compare-price {
  display: inline-grid;
  justify-items: end;
  gap: 1px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #b1253c;
  font: inherit;
  font-weight: 820;
  cursor: pointer;
}

.compare-price b {
  color: #9a650e;
  font-size: 0.64rem;
  font-weight: 820;
}

.dash {
  color: var(--muted);
}

@media (min-width: 768px) {
  .featured-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .standard-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

/* 桌面：聚焦居中，套餐卡不被拉伸到整屏 */
@media (min-width: 1024px) {
  .upgrade-page { max-width: 1080px; margin-inline: auto; gap: 14px; }
}
</style>
