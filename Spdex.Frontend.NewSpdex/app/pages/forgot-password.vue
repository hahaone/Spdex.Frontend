<script setup lang="ts">
import { AlertCircle, ArrowLeft, MailCheck, Send } from '@lucide/vue'

definePageMeta({ layout: false })

const { forgotPassword } = useAuth()
const { enabled: captchaEnabled, setup: setupCaptcha } = useCaptcha()

const userName = ref('')
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const done = ref(false)

function validate(): boolean {
  if (!userName.value.trim()) {
    errorMessage.value = '请输入用户名'
    return false
  }
  errorMessage.value = null
  return true
}

async function submitDirect() {
  if (!validate()) return
  loading.value = true
  const r = await forgotPassword(userName.value.trim())
  loading.value = false
  if (r.ok) { done.value = true; return }
  errorMessage.value = r.error
}

async function captchaVerify(captchaVerifyParam: string) {
  if (!validate()) return { captchaResult: true, bizResult: false }
  loading.value = true
  const r = await forgotPassword(userName.value.trim(), captchaVerifyParam)
  loading.value = false
  if (r.captchaFailed) return { captchaResult: false, bizResult: false }
  errorMessage.value = r.ok ? null : r.error
  return { captchaResult: true, bizResult: r.ok }
}

function onBizResult(bizResult: boolean) {
  if (bizResult) done.value = true
}

function onSubmit() {
  if (captchaEnabled.value) return
  submitDirect()
}

onMounted(() => {
  if (captchaEnabled.value) {
    setupCaptcha({
      buttonId: 'forgot-submit',
      elementId: 'forgot-captcha-element',
      verify: captchaVerify,
      onBizResult,
    })
  }
})
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel">
      <div class="brand-row">
        <span class="brand-text">SPdex</span>
        <span class="brand-sub">找回密码</span>
      </div>

      <template v-if="!done">
        <h1>找回密码</h1>
        <p class="hint">输入用户名，我们会向该账号绑定的邮箱发送重置链接（30 分钟内有效）。</p>

        <form class="auth-form" @submit.prevent="onSubmit">
          <label>
            <span class="lbl">用户名 / UserName</span>
            <input v-model="userName" autocomplete="username">
          </label>

          <div v-if="errorMessage" class="error-banner">
            <AlertCircle :size="14" />
            <span>{{ errorMessage }}</span>
          </div>

          <button id="forgot-submit" type="button" class="primary-btn focus-ring" :disabled="loading" @click="onSubmit">
            <Send :size="15" />
            <span>{{ loading ? '提交中…' : '发送重置链接' }}</span>
          </button>
          <div id="forgot-captcha-element" />
        </form>
      </template>

      <div v-else class="done-state">
        <div class="done-icon"><MailCheck :size="30" /></div>
        <h1>请查收邮件</h1>
        <p class="hint">若该账号已绑定邮箱，重置链接已发送，请在邮箱（含垃圾邮件箱）中查收并按提示重置密码。</p>
      </div>

      <div class="auth-links">
        <NuxtLink to="/login"><ArrowLeft :size="13" /> 返回登录</NuxtLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 16px;
  background:
    radial-gradient(circle at 15% 10%, rgba(26, 140, 211, 0.12) 0, transparent 45%),
    radial-gradient(circle at 90% 85%, rgba(110, 90, 175, 0.12) 0, transparent 45%),
    var(--app-bg);
}

.auth-panel {
  width: min(100%, 380px);
  padding: 22px 18px;
  border: 1px solid var(--lavender-strong);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 16px 38px rgba(0, 0, 0, 0.14);
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
  margin: 0 0 8px;
  font-size: 1.04rem;
  font-weight: 800;
  text-align: center;
  color: var(--ink);
}

.hint {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1.5;
  text-align: center;
}

.auth-form {
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

.primary-btn {
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
  box-shadow: 0 4px 12px rgba(26, 140, 211, 0.28);
}

.primary-btn:disabled {
  opacity: 0.72;
}

.error-banner {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--red-soft-bg);
  color: var(--red-soft-fg);
  font-size: 0.78rem;
  font-weight: 740;
}

.done-state {
  text-align: center;
  padding: 6px 0 4px;
}

.done-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  margin: 0 auto 10px;
  border-radius: 16px;
  background: var(--draw-bg);
  color: var(--sell);
}

.auth-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 14px;
  color: var(--brand);
  font-size: 0.8rem;
  font-weight: 740;
}

.auth-links a {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
</style>
