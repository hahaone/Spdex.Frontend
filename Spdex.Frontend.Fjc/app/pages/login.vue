<script setup lang="ts">
definePageMeta({ layout: false }) // 登录页不使用默认布局

const { login } = useAuth()

const form = reactive({
  userName: '',
  password: '',
})
const errorMsg = ref('')
const loading = ref(false)

async function handleLogin() {
  errorMsg.value = ''

  if (!form.userName.trim() || !form.password.trim()) {
    errorMsg.value = '请输入用户名和密码'
    return
  }

  loading.value = true
  try {
    const err = await login(form.userName.trim(), form.password)
    if (err) {
      errorMsg.value = err
    }
    else {
      await navigateTo('/')
    }
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <img src="/logo.png" alt="SPdex" class="login-logo">
        <h1 class="login-title">SPdex 竞彩工作室</h1>
        <p class="login-subtitle">仅限白金会籍会员访问</p>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="userName">用户名</label>
          <input
            id="userName"
            v-model="form.userName"
            type="text"
            placeholder="请输入 sp1x2.net 用户名"
            autocomplete="username"
            :disabled="loading"
          >
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
            :disabled="loading"
            @keyup.enter="handleLogin"
          >
        </div>

        <div v-if="errorMsg" class="error-message">
          {{ errorMsg }}
        </div>

        <button type="submit" class="login-btn" :disabled="loading">
          {{ loading ? '登录中...' : '登 录' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 1rem;
}

.login-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 380px;
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-logo {
  height: 48px;
  width: auto;
  margin-bottom: 0.75rem;
}

.login-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #333;
  margin: 0 0 0.25rem;
}

.login-subtitle {
  font-size: 0.85rem;
  color: #999;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 500;
  color: #555;
}

.form-group input {
  padding: 0.65rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
  outline: none;
}

.form-group input:focus {
  border-color: #4a90d9;
  box-shadow: 0 0 0 3px rgba(74, 144, 217, 0.1);
}

.form-group input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.error-message {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  color: #cf1322;
  font-size: 0.85rem;
  text-align: center;
}

.login-btn {
  padding: 0.7rem;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 0.5rem;
}

.login-btn:hover:not(:disabled) {
  background: #357abd;
}

.login-btn:disabled {
  background: #a0c4e8;
  cursor: not-allowed;
}
</style>
