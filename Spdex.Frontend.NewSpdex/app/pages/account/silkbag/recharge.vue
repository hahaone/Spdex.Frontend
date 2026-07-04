<script setup lang="ts">
import { AlertCircle, ArrowLeft, CheckCircle, Coins, CreditCard, Loader2, RefreshCw } from '@lucide/vue'
import type { SilkBalance, SilkProduct, SilkRechargeChannel, SilkRechargeOrderResult } from '~/types/billing'

const route = useRoute()

const {
  createSilkRechargeOrder,
  getSilkBalance,
  getSilkProduct,
} = useCreateOrder()

const product = ref<SilkProduct | null>(null)
const balance = ref<SilkBalance | null>(null)
const order = ref<SilkRechargeOrderResult | null>(null)
const phase = ref<'idle' | 'loading' | 'paying' | 'error'>('loading')
const errorMessage = ref('')

const required = computed(() => Math.max(0, Number(route.query.required) || 0))
const initialBalance = computed(() => Math.max(0, Number(route.query.balance) || 0))
const returnUrl = computed(() => String(route.query.returnUrl || ''))
const productLabel = computed(() => String(route.query.product || '') === 'flashq' ? '闪Q开通' : '锦囊消费')
const number = ref(Math.max(1, Math.ceil(required.value > 0 ? Math.max(required.value - initialBalance.value, 1) : 10)))

const currentBalance = computed(() => balance.value?.total ?? initialBalance.value)
const dailyLimit = computed(() => product.value?.dailyLimit ?? 3)
const maxAmount = computed(() => product.value?.maxAmount ?? 500)
const maxNumber = computed(() => {
  if (product.value?.maxNumber) return product.value.maxNumber
  const unitPrice = product.value?.unitPrice ?? 1
  return Math.max(1, Math.floor(maxAmount.value / Math.max(unitPrice, 0.01)))
})
const estimatedTotal = computed(() => (product.value?.unitPrice ?? 0) * number.value)
const rechargeDisabled = computed(() => phase.value === 'paying' || number.value < 1 || number.value > maxNumber.value || estimatedTotal.value > maxAmount.value)

function normalizeNumber() {
  const next = Math.round(Number(number.value) || 0)
  number.value = Math.min(maxNumber.value, Math.max(1, next))
}

onMounted(async () => {
  try {
    const [productResult, balanceResult] = await Promise.all([
      getSilkProduct(),
      getSilkBalance(),
    ])
    product.value = productResult
    balance.value = balanceResult
    normalizeNumber()
    phase.value = 'idle'
  }
  catch {
    phase.value = 'error'
    errorMessage.value = '锦囊商品加载失败，请稍后重试。'
  }
})

async function startRecharge(channel: SilkRechargeChannel) {
  normalizeNumber()
  if (rechargeDisabled.value) {
    errorMessage.value = `单次最多充值 ¥${maxAmount.value.toFixed(0)}`
    phase.value = 'error'
    return
  }

  phase.value = 'paying'
  errorMessage.value = ''
  order.value = null

  try {
    const result = await createSilkRechargeOrder(channel, Math.max(1, Math.round(number.value)))
    if (!result) {
      phase.value = 'error'
      errorMessage.value = '充值下单失败，请稍后重试。'
      return
    }

    order.value = result
    phase.value = 'idle'

    if (result.formHtml && typeof window !== 'undefined') {
      await nextTick()
      const container = document.getElementById('silk-alipay-form')
      if (container) {
        container.innerHTML = result.formHtml
        const form = container.querySelector('form')
        setTimeout(() => form?.submit(), 500)
      }
    }
  }
  catch (error: unknown) {
    const fetchError = error as {
      data?: { message?: string }
      response?: { _data?: { message?: string } }
      message?: string
    }
    phase.value = 'error'
    errorMessage.value = fetchError?.data?.message
      || fetchError?.response?._data?.message
      || fetchError?.message
      || '充值下单失败，请稍后重试。'
  }
}

async function refreshBalance() {
  balance.value = await getSilkBalance()
}

async function refreshAndReturn() {
  await refreshBalance()
  if (returnUrl.value && typeof window !== 'undefined') {
    window.location.assign(returnUrl.value)
  }
}
</script>

<template>
  <section class="silk-page">
    <header class="silk-head">
      <button class="plain-btn focus-ring" type="button" @click="navigateTo('/account')">
        <ArrowLeft :size="14" />
        <span>返回</span>
      </button>
      <div>
        <span>Silk Bag</span>
        <h1>购买锦囊</h1>
      </div>
    </header>

    <section class="summary-band">
      <div>
        <span>当前余额</span>
        <strong class="num">{{ Math.round(currentBalance) }}</strong>
      </div>
      <div>
        <span>用途</span>
        <strong>{{ productLabel }}</strong>
      </div>
      <div>
        <span>建议补充</span>
        <strong class="num">{{ number }}</strong>
      </div>
    </section>

    <section class="recharge-panel">
      <div class="field-row">
        <label for="silk-number">购买数量</label>
        <input
          id="silk-number"
          v-model.number="number"
          class="num"
          type="number"
          min="1"
          :max="maxNumber"
          step="1"
          @blur="normalizeNumber"
        >
      </div>

      <div class="price-row">
        <span>单价 {{ product?.unitPrice ? `¥${product.unitPrice}` : '-' }}</span>
        <strong>预计 ¥{{ estimatedTotal.toFixed(2) }}</strong>
      </div>
      <p class="limit-text">
        每天最多 {{ dailyLimit }} 次，单次不超过 ¥{{ maxAmount.toFixed(0) }}
      </p>

      <div class="channel-grid">
        <button class="channel-btn focus-ring" type="button" :disabled="rechargeDisabled" @click="startRecharge('alipay')">
          <CreditCard :size="17" />
          <span>支付宝</span>
        </button>
      </div>
    </section>

    <section v-if="phase === 'paying'" class="state-band">
      <Loader2 :size="18" class="spinning" />
      <span>正在创建订单…</span>
    </section>

    <section v-if="phase === 'error'" class="state-band danger">
      <AlertCircle :size="18" />
      <span>{{ errorMessage }}</span>
    </section>

    <section v-if="order" class="order-band">
      <div class="order-title">
        <CheckCircle :size="18" />
        <span>订单已创建</span>
      </div>
      <p v-if="order.orderId" class="hint num">订单号：{{ order.orderId }}</p>
      <div id="silk-alipay-form" />
      <p class="hint">支付成功后约 30 秒内到账。</p>
      <div class="order-actions">
        <button class="ghost-btn focus-ring" type="button" @click="refreshBalance">
          <RefreshCw :size="14" />
          <span>刷新余额</span>
        </button>
        <button v-if="returnUrl" class="primary-btn focus-ring" type="button" @click="refreshAndReturn">
          <Coins :size="14" />
          <span>返回继续</span>
        </button>
      </div>
    </section>
  </section>
</template>

<style scoped>
.silk-page {
  display: grid;
  gap: 12px;
  padding: 12px;
}

.silk-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.silk-head h1 {
  margin: 1px 0 0;
  color: var(--ink);
  font-size: 1.1rem;
}

.silk-head span,
.summary-band span,
.price-row span,
.limit-text,
.hint {
  color: var(--muted);
  font-size: 0.76rem;
}

.plain-btn,
.ghost-btn,
.primary-btn,
.channel-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 8px;
  font-weight: 800;
}

.plain-btn {
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  min-height: 34px;
  padding: 0 10px;
}

.summary-band {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.summary-band div,
.recharge-panel,
.state-band,
.order-band {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.summary-band div {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 10px;
}

.summary-band strong {
  overflow: hidden;
  color: var(--ink);
  font-size: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recharge-panel,
.order-band {
  display: grid;
  gap: 12px;
  padding: 12px;
}

.field-row {
  display: grid;
  gap: 6px;
}

.field-row label {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 760;
}

.field-row input {
  width: 100%;
  min-height: 42px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  color: var(--ink);
  font-size: 1.1rem;
  font-weight: 850;
  padding: 0 10px;
}

.price-row,
.order-title,
.order-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.price-row strong {
  color: var(--ink);
}

.limit-text {
  margin: -4px 0 0;
  font-weight: 720;
}

.channel-grid {
  display: grid;
  gap: 8px;
}

.channel-btn,
.primary-btn {
  min-height: 40px;
  border: 1px solid var(--brand);
  background: var(--brand);
  color: #fff;
}

.channel-btn:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.ghost-btn {
  min-height: 36px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  padding: 0 12px;
}

.primary-btn {
  padding: 0 14px;
}

.state-band {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 780;
}

.state-band.danger {
  color: var(--down);
}

.order-title {
  justify-content: flex-start;
  color: var(--brand);
  font-weight: 850;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 桌面：充值页居中限宽，避免单列拉伸到整屏 */
@media (min-width: 1024px) {
  .silk-page { max-width: var(--w-read); margin-inline: auto; }
}
</style>
