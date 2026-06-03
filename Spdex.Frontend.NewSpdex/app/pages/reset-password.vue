<script setup lang="ts">
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound } from '@lucide/vue'

definePageMeta({ layout: false })

const route = useRoute()
const { resetPassword } = useAuth()

const token = computed(() => (route.query.token as string) || '')
const form = reactive({ pw: '', pw2: '' })
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const done = ref(false)

function validate(): boolean {
  if (!token.value) {
    errorMessage.value = '重置链接无效，请重新申请找回密码'
    return false
  }
  if (form.pw.length < 4 || form.pw.length > 64) {
    errorMessage.value = '密码长度需为 4-64 个字符'
    return false
  }
  if (form.pw !== form.pw2) {
    errorMessage.value = '两次输入的密码不一致'
    return false
  }
  errorMessage.value = null
  return true
}

async function submit() {
  if (!validate()) return
  loading.value = true
  const r = await resetPassword(token.value, form.pw)
  loading.value = false
  if (r.ok) { done.value = true; return }
  errorMessage.value = r.error
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel">
      <div class="brand-row">
        <span class="brand-text">SPdex</span>
        <span class="brand-sub">重置密码</span>
      </div>

      <template v-if="!done">
        <h1>设置新密码</h1>

        <div v-if="!token" class="error-banner big">
          <AlertCircle :size="14" />
          <span>重置链接无效或缺少令牌，请从邮件中的链接打开，或重新申请找回密码。</span>
        </div>

        <form v-else class="auth-form" @submit.prevent="submit">
          <label>
            <span class="lbl">新密码 / New Password</span>
            <input v-model="form.pw" type="password" autocomplete="new-password">
          </label>
          <label>
            <span class="lbl">确认新密码 / Confirm</span>
            <input v-model="form.pw2" type="password" autocomplete="new-password">
          </label>

          <div v-if="errorMessage" class="error-banner">
            <AlertCircle :size="14" />
            <span>{{ errorMessage }}</span>
          </div>

          <button type="submit" class="primary-btn focus-ring" :disabled="loading">
            <KeyRound :size="15" />
            <span>{{ loading ? '提交中…' : '重置密码' }}</span>
          </button>
        </form>
      </template>

      <div v-else class="done-state">
        <div class="done-icon"><CheckCircle2 :size="30" /></div>
        <h1>密码已重置</h1>
        <p class="hint">您的密码已更新，请使用新密码登录。</p>
        <NuxtLink to="/login" class="primary-btn focus-ring as-link">前往登录</NuxtLink>
      </div>

      <div v-if="!done" class="auth-links">
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
    radial-gradient(circle at 15% 10%, rgba(124, 92, 250, 0.12) 0, transparent 45%),
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
  margin: 0 0 16px;
  font-size: 1.04rem;
  font-weight: 800;
  text-align: center;
  color: var(--ink);
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
  box-shadow: 0 0 0 3px rgba(124, 92, 250, 0.14);
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
  box-shadow: 0 4px 12px rgba(124, 92, 250, 0.28);
}

.primary-btn:disabled {
  opacity: 0.72;
}

.primary-btn.as-link {
  width: 100%;
  margin-top: 14px;
  text-decoration: none;
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

.error-banner.big {
  align-items: flex-start;
  line-height: 1.5;
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

.hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.84rem;
  line-height: 1.5;
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
