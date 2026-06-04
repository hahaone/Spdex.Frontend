<script setup lang="ts">
import { AlertCircle, ArrowLeft, CheckCircle, Coins, CreditCard, Loader2, QrCode, RefreshCw } from '@lucide/vue'
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
const estimatedTotal = computed(() => (product.value?.unitPrice ?? 0) * number.value)
const qrSrc = computed(() => {
  const raw = order.value?.qrImageBase64
  if (!raw) return ''
  return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
})

onMounted(async () => {
  try {
    const [productResult, balanceResult] = await Promise.all([
      getSilkProduct(),
      getSilkBalance(),
    ])
    product.value = productResult
    balance.value = balanceResult
    phase.value = 'idle'
  }
  catch {
    phase.value = 'error'
    errorMessage.value = '锦囊商品加载失败，请稍后重试。'
  }
})

async function startRecharge(channel: SilkRechargeChannel) {
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
    const fetchError = error as { data?: { message?: string } }
    phase.value = 'error'
    errorMessage.value = fetchError?.data?.message || '充值下单失败，请稍后重试。'
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
          max="10000"
          step="1"
        >
      </div>

      <div class="price-row">
        <span>单价 {{ product?.unitPrice ? `¥${product.unitPrice}` : '-' }}</span>
        <strong>预计 ¥{{ estimatedTotal.toFixed(2) }}</strong>
      </div>

      <div class="channel-grid">
        <button class="channel-btn focus-ring" type="button" :disabled="phase === 'paying'" @click="startRecharge('alipay')">
          <CreditCard :size="17" />
          <span>支付宝</span>
        </button>
        <button class="channel-btn focus-ring" type="button" :disabled="phase === 'paying'" @click="startRecharge('wxcode')">
          <QrCode :size="17" />
          <span>微信扫码</span>
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
      <img v-if="qrSrc" class="qr-img" :src="qrSrc" alt="微信支付二维码">
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

.channel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

.qr-img {
  width: min(220px, 100%);
  aspect-ratio: 1;
  justify-self: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
  padding: 8px;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
