<script setup lang="ts">
import { AlertCircle, ArrowLeft, CheckCircle, Coins, CreditCard, Loader2, QrCode, RefreshCw } from '@lucide/vue'
import type {
  AlipayOrderResult,
  PaymentChannel,
  SilkNeed,
  SilkOrderResult,
  WxCodeOrderResult,
} from '~/types/billing'

const route = useRoute()
const router = useRouter()

const roleId = computed(() => Number(route.query.roleId) || 0)
const stageId = computed(() => Number(route.query.stageId) || 0)
const initialChannel = computed<PaymentChannel | 'choose'>(() => {
  const raw = String(route.query.channel || 'choose')
  if (raw === 'yft') return 'wxcode'
  return (['wxcode', 'alipay', 'silk', 'choose'].includes(raw) ? raw : 'choose') as PaymentChannel | 'choose'
})

const channel = ref<PaymentChannel | 'choose'>(initialChannel.value)
const phase = ref<'idle' | 'creating' | 'showing' | 'success' | 'error'>('idle')
const errorMessage = ref<string>('')

const wxResult = ref<WxCodeOrderResult | null>(null)
const alipayResult = ref<AlipayOrderResult | null>(null)
const silkResult = ref<SilkOrderResult | null>(null)
const silkNeed = ref<SilkNeed | null>(null)

const { createWxCodeOrder, createAlipayOrder, createSilkOrder, getSilkNeed } = useCreateOrder()
const { refreshToken } = useAuth()

// 进入页面后立即拉取锦囊所需点数（即使没选锦囊也展示）
onMounted(async () => {
  if (roleId.value > 0 && stageId.value > 0) {
    silkNeed.value = await getSilkNeed(roleId.value, stageId.value)
  }
})

async function startWxCode() {
  channel.value = 'wxcode'
  phase.value = 'creating'
  errorMessage.value = ''
  const res = await createWxCodeOrder(roleId.value, stageId.value)
  if (!res) {
    phase.value = 'error'
    errorMessage.value = '下单失败，请稍后重试或更换支付方式'
    return
  }
  wxResult.value = res
  phase.value = 'showing'
}

async function startAlipay() {
  channel.value = 'alipay'
  phase.value = 'creating'
  errorMessage.value = ''
  const res = await createAlipayOrder(roleId.value, stageId.value)
  if (!res) {
    phase.value = 'error'
    errorMessage.value = '下单失败，请稍后重试或更换支付方式'
    return
  }
  alipayResult.value = res
  phase.value = 'showing'

  // 自动 submit 支付宝表单（如果有 formHtml）
  if (res.formHtml && typeof window !== 'undefined') {
    await nextTick()
    const container = document.getElementById('alipay-form-container')
    if (container) {
      container.innerHTML = res.formHtml
      const form = container.querySelector('form')
      if (form) {
        setTimeout(() => form.submit(), 600)
      }
    }
  }
}

async function startSilk() {
  channel.value = 'silk'
  phase.value = 'creating'
  errorMessage.value = ''
  const res = await createSilkOrder(roleId.value, stageId.value)
  silkResult.value = res
  if (!res.success) {
    phase.value = 'error'
    errorMessage.value = res.message ?? '锦囊扣点失败'
    return
  }
  phase.value = 'success'

  // 锦囊扣点即时生效：刷新 JWT 拿新 RoleId
  setTimeout(async () => {
    await refreshToken()
  }, 1500)
}

async function checkRefresh() {
  await refreshToken()
  await router.push('/account')
}

function goBack() {
  router.push('/account/upgrade')
}
</script>

<template>
  <section class="result-page">
    <div class="page-head">
      <button class="back-link focus-ring" type="button" @click="goBack">
        <ArrowLeft :size="14" />
        <span>返回</span>
      </button>
      <h1>支付确认</h1>
      <span class="spacer" />
    </div>

    <!-- 通道选择（初次进入） -->
    <section v-if="channel === 'choose'" class="channel-band">
      <h2>选择支付方式</h2>
      <div class="channel-grid">
        <button class="channel-btn wxcode focus-ring" type="button" @click="startWxCode">
          <QrCode :size="18" />
          <b>微信扫码</b>
          <span>微信支付 · 推荐</span>
        </button>
        <button class="channel-btn alipay focus-ring" type="button" @click="startAlipay">
          <CreditCard :size="18" />
          <b>支付宝</b>
          <span>跳转支付宝完成</span>
        </button>
        <button class="channel-btn silk focus-ring" type="button" :disabled="!silkNeed?.sufficient" @click="startSilk">
          <Coins :size="18" />
          <b>锦囊扣点</b>
          <span v-if="silkNeed">需要 {{ silkNeed.silkRequired }} 锦囊 · {{ silkNeed.sufficient ? '余额充足' : '余额不足' }}</span>
          <span v-else>查询中…</span>
        </button>
      </div>
    </section>

    <!-- 下单中 -->
    <div v-else-if="phase === 'creating'" class="loading-band">
      <Loader2 :size="22" class="spinning" />
      <span>下单中，请稍候…</span>
    </div>

    <!-- 错误 -->
    <div v-else-if="phase === 'error'" class="error-band">
      <AlertCircle :size="18" />
      <span>{{ errorMessage }}</span>
      <button class="retry-btn focus-ring" type="button" @click="goBack">
        重新选择支付方式
      </button>
    </div>

    <!-- 微信二维码 -->
    <section v-else-if="channel === 'wxcode' && phase === 'showing'" class="wxcode-band">
      <h2>请使用微信扫码</h2>
      <div v-if="wxResult?.qrImageBase64" class="qr-box">
        <img :src="`data:image/png;base64,${wxResult.qrImageBase64}`" alt="微信支付二维码">
      </div>
      <p class="hint">订单号：<span class="num">{{ wxResult?.orderId }}</span></p>
      <p class="hint">支付完成后约 30 秒内自动到账，可点击下方按钮刷新会籍状态。</p>
      <button class="action-btn focus-ring" type="button" @click="checkRefresh">
        <RefreshCw :size="14" />
        <span>已支付，刷新会籍</span>
      </button>
    </section>

    <!-- 支付宝跳转 -->
    <section v-else-if="channel === 'alipay' && phase === 'showing'" class="alipay-band">
      <h2>跳转支付宝</h2>
      <p>正在跳转到支付宝完成支付…</p>
      <div id="alipay-form-container" />
      <p class="hint">订单号：<span class="num">{{ alipayResult?.orderId }}</span></p>
      <button class="action-btn focus-ring" type="button" @click="checkRefresh">
        <RefreshCw :size="14" />
        <span>已支付，刷新会籍</span>
      </button>
    </section>

    <!-- 锦囊扣点成功 -->
    <section v-else-if="phase === 'success'" class="success-band">
      <CheckCircle :size="40" />
      <h2>扣点成功！</h2>
      <p>已扣除锦囊 · 剩余余额 <b class="num">{{ silkResult?.remainingSilk }}</b></p>
      <p v-if="silkResult?.newEndDate" class="hint">
        新到期日：<b class="num">{{ silkResult.newEndDate.slice(0, 10) }}</b>
      </p>
      <p class="hint">会籍正在刷新…</p>
      <button class="action-btn focus-ring" type="button" @click="checkRefresh">
        <RefreshCw :size="14" />
        <span>进入个人中心</span>
      </button>
    </section>
  </section>
</template>

<style scoped>
.result-page {
  display: grid;
  gap: 12px;
  padding: 12px 12px 16px;
}

.page-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 50px;
  align-items: center;
  gap: 10px;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: none;
  background: transparent;
  color: var(--brand);
  font-size: 0.78rem;
  font-weight: 740;
}

.page-head h1 {
  margin: 0;
  text-align: center;
  font-size: 0.96rem;
  font-weight: 820;
}

/* ─── 通道选择 ─── */
.channel-band h2 {
  margin: 0 0 8px;
  font-size: 0.92rem;
  font-weight: 820;
}

.channel-grid {
  display: grid;
  gap: 8px;
}

.channel-btn {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 11px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  color: var(--ink);
  cursor: pointer;
  text-align: left;
}

.channel-btn svg {
  grid-row: 1 / 3;
  grid-column: 1;
}

.channel-btn b {
  font-size: 0.92rem;
  font-weight: 800;
}

.channel-btn span {
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 720;
}

.channel-btn.wxcode { border-color: var(--brand); }
.channel-btn.alipay { border-color: #0984e3; }
.channel-btn.silk { border-color: #c8a64b; }

.channel-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ─── 下单状态 ─── */
.loading-band,
.error-band {
  display: grid;
  gap: 8px;
  place-items: center;
  padding: 30px 16px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  color: var(--muted);
  font-size: 0.86rem;
}

.error-band {
  border-color: var(--buy);
  background: #fde8eb;
  color: #b1253c;
}

.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.retry-btn {
  margin-top: 6px;
  padding: 8px 14px;
  border: 1px solid #b1253c;
  border-radius: 4px;
  background: var(--panel);
  color: #b1253c;
  font-size: 0.82rem;
  font-weight: 800;
}

/* ─── 二维码 ─── */
.wxcode-band,
.alipay-band,
.success-band {
  display: grid;
  gap: 8px;
  padding: 14px 14px 16px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
}

.wxcode-band h2,
.alipay-band h2,
.success-band h2 {
  margin: 0;
  text-align: center;
  font-size: 0.96rem;
  font-weight: 820;
}

.qr-box {
  display: grid;
  place-items: center;
  padding: 14px;
}

.qr-box img {
  width: 200px;
  height: 200px;
  border: 1px solid var(--divider);
  border-radius: 4px;
  background: var(--panel);
}

.qr-fallback {
  display: grid;
  gap: 4px;
  padding: 14px;
  text-align: center;
}

.pay-link {
  color: var(--brand);
  font-size: 0.78rem;
  font-weight: 740;
  word-break: break-all;
}

.success-band {
  border-color: var(--sell);
  background: linear-gradient(180deg, #e9f7ef 0%, var(--panel) 80%);
  color: var(--ink);
  text-align: center;
}

.success-band svg {
  margin: 4px auto 0;
  color: var(--sell);
}

.hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 720;
  text-align: center;
  line-height: 1.55;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 6px;
  padding: 9px 14px;
  border: 1px solid var(--brand);
  border-radius: 4px;
  background: var(--brand);
  color: #fff;
  font-size: 0.86rem;
  font-weight: 800;
  cursor: pointer;
}

.action-btn:active { background: var(--brand-deep); }
</style>
