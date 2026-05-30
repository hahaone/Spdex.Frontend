<script setup lang="ts">
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound } from '@lucide/vue'

const { changePassword, isLoggedIn } = useAuth()

const form = reactive({ old: '', pw: '', pw2: '' })
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const done = ref(false)

function validate(): boolean {
  if (!form.old) { errorMessage.value = '请输入原密码'; return false }
  if (form.pw.length < 4 || form.pw.length > 64) { errorMessage.value = '新密码长度需为 4-64 个字符'; return false }
  if (form.pw !== form.pw2) { errorMessage.value = '两次输入的新密码不一致'; return false }
  if (form.pw === form.old) { errorMessage.value = '新密码不能与原密码相同'; return false }
  errorMessage.value = null
  return true
}

async function submit() {
  if (!validate()) return
  loading.value = true
  const r = await changePassword(form.old, form.pw)
  loading.value = false
  if (r.ok) {
    done.value = true
    form.old = ''; form.pw = ''; form.pw2 = ''
    return
  }
  errorMessage.value = r.error
}
</script>

<template>
  <section class="cp-page">
    <div class="page-head">
      <NuxtLink to="/account" class="back-link">
        <ArrowLeft :size="14" />
        <span>返回</span>
      </NuxtLink>
      <h1>修改密码</h1>
      <span />
    </div>

    <div v-if="!isLoggedIn" class="card empty">请先登录后再修改密码。</div>

    <div v-else class="card">
      <div v-if="done" class="done-banner">
        <CheckCircle2 :size="15" />
        <span>密码已修改成功，其它设备的登录已失效。</span>
      </div>

      <form class="cp-form" @submit.prevent="submit">
        <label>
          <span class="lbl">原密码</span>
          <input v-model="form.old" type="password" autocomplete="current-password">
        </label>
        <label>
          <span class="lbl">新密码（4-64 位）</span>
          <input v-model="form.pw" type="password" autocomplete="new-password">
        </label>
        <label>
          <span class="lbl">确认新密码</span>
          <input v-model="form.pw2" type="password" autocomplete="new-password">
        </label>

        <div v-if="errorMessage" class="error-banner">
          <AlertCircle :size="14" />
          <span>{{ errorMessage }}</span>
        </div>

        <button type="submit" class="primary-btn focus-ring" :disabled="loading">
          <KeyRound :size="15" />
          <span>{{ loading ? '提交中…' : '确认修改' }}</span>
        </button>
      </form>
    </div>
  </section>
</template>

<style scoped>
.cp-page {
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
}

.page-head h1 {
  margin: 0;
  text-align: center;
  font-size: 0.96rem;
  font-weight: 820;
  color: var(--ink);
}

.card {
  padding: 16px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--card-shadow);
}

.card.empty {
  text-align: center;
  color: var(--muted);
  font-size: 0.86rem;
}

.cp-form {
  display: grid;
  gap: 12px;
  max-width: 360px;
  margin: 0 auto;
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
  margin-top: 2px;
  border: 0;
  border-radius: 4px;
  background: linear-gradient(180deg, var(--brand) 0%, var(--brand-deep) 100%);
  color: #fff;
  font-weight: 820;
  font-size: 0.96rem;
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

.done-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--draw-bg);
  color: var(--sell);
  font-size: 0.82rem;
  font-weight: 720;
}
</style>
