<script setup lang="ts">
import { AlertCircle, Bot, ShieldCheck } from '@lucide/vue'

definePageMeta({ layout: false })

const { login } = useAuth()
const { enabled: captchaEnabled, setup: setupCaptcha } = useCaptcha()

const form = reactive({
  userName: '',
  password: '',
})
const loading = ref(false)
const errorMessage = ref<string | null>(null)

function validate(): boolean {
  if (!form.userName.trim() || !form.password) {
    errorMessage.value = '请输入用户名和密码'
    return false
  }
  errorMessage.value = null
  return true
}

// 验证码关闭：直接提交
async function submitDirect() {
  if (!validate()) return
  loading.value = true
  const r = await login(form.userName.trim(), form.password)
  loading.value = false
  if (r.ok) { await navigateTo('/'); return }
  errorMessage.value = r.error
}

// 验证码开启：滑块通过后由 SDK 回调此函数发登录请求
async function captchaVerify(captchaVerifyParam: string) {
  if (!validate()) return { captchaResult: true, bizResult: false }
  loading.value = true
  const r = await login(form.userName.trim(), form.password, captchaVerifyParam)
  loading.value = false
  if (r.captchaFailed) return { captchaResult: false, bizResult: false }
  errorMessage.value = r.ok ? null : r.error
  return { captchaResult: true, bizResult: r.ok }
}

function onBizResult(bizResult: boolean) {
  if (bizResult) navigateTo('/')
}

// 验证码开启时由 SDK 接管 #login-submit 的点击（弹滑块）；关闭时直接提交
function onSubmit() {
  if (captchaEnabled.value) return
  submitDirect()
}

onMounted(() => {
  if (captchaEnabled.value) {
    setupCaptcha({
      buttonId: 'login-submit',
      elementId: 'login-captcha-element',
      verify: captchaVerify,
      onBizResult,
    })
  }
})
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="brand-row">
        <span class="brand-text">SPdex</span>
        <span class="brand-sub">超级指数系统</span>
      </div>

      <h1>会员登录</h1>

      <form class="login-form" @submit.prevent="onSubmit">
        <label>
          <span class="lbl">用户名 / UserName</span>
          <input v-model="form.userName" autocomplete="username">
        </label>

        <label>
          <span class="lbl">密码 / Password</span>
          <input v-model="form.password" type="password" autocomplete="current-password">
        </label>

        <div v-if="errorMessage" class="error-banner">
          <AlertCircle :size="14" />
          <span>{{ errorMessage }}</span>
        </div>

        <button id="login-submit" type="button" class="login-btn focus-ring" :disabled="loading" @click="onSubmit">
          <ShieldCheck :size="16" />
          <span>{{ loading ? '登录中…' : '登录' }}</span>
        </button>
        <div id="login-captcha-element" />
      </form>

      <div class="login-links">
        <NuxtLink to="/register">免费注册</NuxtLink>
        <span class="divider">·</span>
        <NuxtLink to="/forgot-password">忘记密码</NuxtLink>
        <span class="divider">·</span>
        <NuxtLink to="/account">会员权益</NuxtLink>
      </div>

      <NuxtLink class="ai-entry focus-ring" to="/">
        <span class="ai-icon">
          <Bot :size="16" />
        </span>
        <div class="ai-text">
          <b>超级指数智能问答</b>
          <span>体验 SPdex AI</span>
        </div>
      </NuxtLink>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 16px;
  background:
    radial-gradient(circle at 15% 10%, rgba(26, 140, 211, 0.12) 0, transparent 45%),
    radial-gradient(circle at 90% 85%, rgba(110, 90, 175, 0.12) 0, transparent 45%),
    linear-gradient(180deg, var(--canvas) 0%, #e2e7f1 100%);
}

.login-panel {
  width: min(100%, 380px);
  padding: 22px 18px;
  border: 1px solid var(--lavender-strong);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 16px 38px rgba(26, 34, 51, 0.14);
}

.brand-row {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 6px;
  margin-bottom: 8px;
}

.brand-text {
  font-size: 1.42rem;
  font-weight: 880;
  letter-spacing: 0.02em;
  background: linear-gradient(120deg, var(--brand) 0%, var(--accent) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.brand-sub {
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 720;
}

h1 {
  margin: 0 0 16px;
  font-size: 1.04rem;
  font-weight: 800;
  text-align: center;
  color: var(--ink);
  letter-spacing: 0.02em;
}

.login-form {
  display: grid;
  gap: 10px;
}

label {
  display: grid;
  gap: 4px;
}

.lbl {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 740;
}

input {
  width: 100%;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--ink);
  outline: none;
  font-size: 0.92rem;
}

input:focus {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px rgba(26, 140, 211, 0.14);
}

.captcha-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 100px;
  gap: 6px;
}

.captcha-code {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  gap: 5px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: linear-gradient(180deg, var(--lavender) 0%, var(--lavender-strong) 100%);
  color: var(--accent-deep);
  font-weight: 800;
  letter-spacing: 0.08em;
}

.login-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  gap: 6px;
  margin-top: 4px;
  border: 0;
  border-radius: 4px;
  background: linear-gradient(180deg, var(--brand) 0%, var(--brand-deep) 100%);
  color: #fff;
  font-weight: 820;
  font-size: 0.96rem;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 12px rgba(26, 140, 211, 0.28);
}

.login-btn:disabled {
  opacity: 0.72;
}

.error-banner {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border: 1px solid #f9c1c8;
  border-radius: 4px;
  background: #fdebe9;
  color: #b1253c;
  font-size: 0.78rem;
  font-weight: 740;
}

.error-banner svg {
  flex: 0 0 auto;
}

.login-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 14px 0 12px;
  color: var(--brand);
  font-size: 0.78rem;
  font-weight: 740;
}

.login-links .divider {
  color: var(--soft);
}

.ai-entry {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  padding: 8px 11px;
  border: 1px solid var(--lavender-strong);
  border-radius: 5px;
  background: linear-gradient(180deg, #faf8fd 0%, #f3edf9 100%);
}

.ai-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 4px;
  background: var(--accent);
  color: #fff;
}

.ai-text {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.ai-text b {
  font-size: 0.88rem;
  font-weight: 800;
  color: var(--accent-deep);
}

.ai-text span {
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 720;
}
</style>
