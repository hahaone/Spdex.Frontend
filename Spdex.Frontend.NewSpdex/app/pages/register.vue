<script setup lang="ts">
import { AlertCircle, ShieldCheck } from '@lucide/vue'

definePageMeta({ layout: false })

const { register } = useAuth()
const { enabled: captchaEnabled, setup: setupCaptcha } = useCaptcha()
const route = useRoute()

const form = reactive({
  userName: '',
  password: '',
  confirmPassword: '',
})
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const loginTarget = computed(() => ({
  path: '/login',
  query: typeof route.query.redirect === 'string' ? { redirect: route.query.redirect } : {},
}))

function postAuthTarget() {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
  if (!redirect) return '/'

  try {
    const target = new URL(redirect, window.location.origin)
    if (target.origin === window.location.origin || target.hostname.endsWith('.spdex.com')) {
      return target.href
    }
  }
  catch {
    return '/'
  }

  return '/'
}

function validate(): boolean {
  errorMessage.value = null
  const userName = form.userName.trim()
  if (!userName || !form.password) {
    errorMessage.value = '请输入用户名和密码'
    return false
  }
  if (userName.length < 2 || userName.length > 50) {
    errorMessage.value = '用户名长度需为 2-50 个字符'
    return false
  }
  if (form.password.length < 4) {
    errorMessage.value = '密码至少需要 4 位'
    return false
  }
  if (form.password !== form.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致'
    return false
  }
  return true
}

// 验证码关闭：直接提交
async function submitDirect() {
  if (!validate()) return
  loading.value = true
  const r = await register({ userName: form.userName.trim(), password: form.password })
  loading.value = false
  if (r.ok) { await navigateTo(postAuthTarget(), { external: true }); return }
  errorMessage.value = r.error
}

// 验证码开启：滑块通过后由 SDK 回调此函数发注册请求
async function captchaVerify(captchaVerifyParam: string) {
  if (!validate()) return { captchaResult: true, bizResult: false }
  loading.value = true
  const r = await register({ userName: form.userName.trim(), password: form.password, captchaVerifyParam })
  loading.value = false
  if (r.captchaFailed) return { captchaResult: false, bizResult: false }
  errorMessage.value = r.ok ? null : r.error
  return { captchaResult: true, bizResult: r.ok }
}

function onBizResult(bizResult: boolean) {
  if (bizResult) navigateTo(postAuthTarget(), { external: true })
}

// 验证码开启时由 SDK 接管 #register-submit 的点击（弹滑块）；关闭时直接提交
function onSubmit() {
  if (captchaEnabled.value) return
  submitDirect()
}

onMounted(() => {
  if (captchaEnabled.value) {
    setupCaptcha({
      buttonId: 'register-submit',
      elementId: 'register-captcha-element',
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

      <h1>会员注册</h1>

      <form class="login-form" @submit.prevent="onSubmit">
        <label>
          <span class="lbl">用户名 / UserName</span>
          <input v-model="form.userName" autocomplete="username" placeholder="2-50 个字符">
        </label>

        <label>
          <span class="lbl">密码 / Password</span>
          <input v-model="form.password" type="password" autocomplete="new-password" placeholder="至少 4 位">
        </label>

        <label>
          <span class="lbl">确认密码 / Confirm</span>
          <input v-model="form.confirmPassword" type="password" autocomplete="new-password">
        </label>

        <div v-if="errorMessage" class="error-banner">
          <AlertCircle :size="14" />
          <span>{{ errorMessage }}</span>
        </div>

        <button id="register-submit" type="button" class="login-btn focus-ring" :disabled="loading" @click="onSubmit">
          <ShieldCheck :size="16" />
          <span>{{ loading ? '注册中…' : '注册并登录' }}</span>
        </button>
        <div id="register-captcha-element" />
      </form>

      <div class="login-links">
        <span class="hint">已有账号？</span>
        <NuxtLink :to="loginTarget">返回登录</NuxtLink>
      </div>

      <p class="reg-note">注册即创建免费会员，可查看主流赛事数据，随时可升级会籍。</p>
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
    radial-gradient(circle at 15% 10%, rgba(124, 92, 250, 0.12) 0, transparent 45%),
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
  box-shadow: 0 0 0 3px rgba(124, 92, 250, 0.14);
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
  box-shadow: 0 4px 12px rgba(124, 92, 250, 0.28);
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
  gap: 8px;
  margin: 14px 0 10px;
  font-size: 0.78rem;
  font-weight: 740;
}

.login-links .hint {
  color: var(--soft);
}

.login-links a {
  color: var(--brand);
}

.reg-note {
  margin: 0;
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.5;
  text-align: center;
}
</style>
