<script setup lang="ts">
import { AlertCircle, Bot, RefreshCw, ShieldCheck } from '@lucide/vue'

definePageMeta({ layout: false })

const { login } = useAuth()

const form = reactive({
  userName: '',
  password: '',
  captcha: 'ABCD',
})
const captcha = ref('ABCD')
const loading = ref(false)
const errorMessage = ref<string | null>(null)

function refreshCaptcha() {
  captcha.value = captcha.value === 'ABCD' ? 'S7P9' : 'ABCD'
  form.captcha = captcha.value
}

async function submit() {
  if (!form.userName.trim() || !form.password) {
    errorMessage.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  errorMessage.value = null

  const err = await login(form.userName.trim(), form.password)
  loading.value = false

  if (err) {
    errorMessage.value = err
    refreshCaptcha()
    return
  }

  await navigateTo('/')
}
</script>

<template>
  <main class="login-page">
    <section class="login-panel">
      <div class="brand-row">
        <span class="brand-text">SPdex</span>
        <span class="brand-sub">超级指数系统</span>
      </div>

      <h1>会员登录</h1>

      <form class="login-form" @submit.prevent="submit">
        <label>
          <span class="lbl">用户名 / UserName</span>
          <input v-model="form.userName" autocomplete="username">
        </label>

        <label>
          <span class="lbl">密码 / Password</span>
          <input v-model="form.password" type="password" autocomplete="current-password">
        </label>

        <label>
          <span class="lbl">验证码</span>
          <div class="captcha-row">
            <input v-model="form.captcha" maxlength="6">
            <button type="button" class="captcha-code focus-ring" @click="refreshCaptcha">
              <span class="num">{{ captcha }}</span>
              <RefreshCw :size="13" />
            </button>
          </div>
        </label>

        <div v-if="errorMessage" class="error-banner">
          <AlertCircle :size="14" />
          <span>{{ errorMessage }}</span>
        </div>

        <button type="submit" class="login-btn focus-ring" :disabled="loading">
          <ShieldCheck :size="16" />
          <span>{{ loading ? '登录中…' : '登录' }}</span>
        </button>
      </form>

      <div class="login-links">
        <NuxtLink to="/account">免费注册</NuxtLink>
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
    linear-gradient(180deg, #eef1f6 0%, #e2e7f1 100%);
}

.login-panel {
  width: min(100%, 380px);
  padding: 22px 18px;
  border: 1px solid #dcd2ed;
  border-radius: 8px;
  background: #fff;
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
  background: linear-gradient(120deg, #1a8cd3 0%, #6e5aaf 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.brand-sub {
  color: #6b7280;
  font-size: 0.76rem;
  font-weight: 720;
}

h1 {
  margin: 0 0 16px;
  font-size: 1.04rem;
  font-weight: 800;
  text-align: center;
  color: #1a2233;
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
  color: #4a5364;
  font-size: 0.78rem;
  font-weight: 740;
}

input {
  width: 100%;
  min-height: 38px;
  padding: 0 10px;
  border: 1px solid #dde2eb;
  border-radius: 4px;
  background: #fff;
  color: #1a2233;
  outline: none;
  font-size: 0.92rem;
}

input:focus {
  border-color: #1a8cd3;
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
  border: 1px solid #dde2eb;
  border-radius: 4px;
  background: linear-gradient(180deg, #ece5f4 0%, #dcd2ed 100%);
  color: #4f3f86;
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
  background: linear-gradient(180deg, #1a8cd3 0%, #1672b3 100%);
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
  color: #1a8cd3;
  font-size: 0.78rem;
  font-weight: 740;
}

.login-links .divider {
  color: #9aa3b0;
}

.ai-entry {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  padding: 8px 11px;
  border: 1px solid #dcd2ed;
  border-radius: 5px;
  background: linear-gradient(180deg, #faf8fd 0%, #f3edf9 100%);
}

.ai-icon {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 4px;
  background: #6e5aaf;
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
  color: #4f3f86;
}

.ai-text span {
  color: #6b7280;
  font-size: 0.7rem;
  font-weight: 720;
}
</style>
