<script setup lang="ts">
definePageMeta({ layout: false }) // 激活页不使用默认布局

const { activateToken, logout } = useAuth()

const code = ref('')
const errorMsg = ref('')
const loading = ref(false)

async function handleActivate() {
  errorMsg.value = ''

  if (!code.value.trim()) {
    errorMsg.value = '请输入授权令牌'
    return
  }

  loading.value = true
  try {
    const err = await activateToken(code.value.trim())
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
  <div class="activate-page">
    <div class="activate-card">
      <div class="activate-header">
        <img src="/logo.png" alt="SPdex" class="activate-logo">
        <h1 class="activate-title">SPdex 竞彩工作室</h1>
        <p class="activate-subtitle">请输入授权令牌以激活访问权限</p>
      </div>

      <form class="activate-form" @submit.prevent="handleActivate">
        <div class="form-group">
          <label for="tokenCode">授权令牌</label>
          <input
            id="tokenCode"
            v-model="code"
            type="text"
            placeholder="请输入授权令牌码"
            autocomplete="off"
            :disabled="loading"
            @keyup.enter="handleActivate"
          >
        </div>

        <div v-if="errorMsg" class="error-message">
          {{ errorMsg }}
        </div>

        <button type="submit" class="activate-btn" :disabled="loading">
          {{ loading ? '激活中...' : '激 活' }}
        </button>
      </form>

      <div class="activate-footer">
        <button class="logout-link" @click="logout">
          退出登录
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.activate-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 1rem;
}

.activate-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  padding: 2.5rem 2rem;
  width: 100%;
  max-width: 380px;
}

.activate-header {
  text-align: center;
  margin-bottom: 2rem;
}

.activate-logo {
  height: 48px;
  width: auto;
  margin-bottom: 0.75rem;
}

.activate-title {
  font-size: 1.4rem;
  font-weight: 700;
  color: #333;
  margin: 0 0 0.25rem;
}

.activate-subtitle {
  font-size: 0.85rem;
  color: #999;
  margin: 0;
}

.activate-form {
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
  letter-spacing: 0.5px;
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

.activate-btn {
  padding: 0.7rem;
  background: #52c41a;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 0.5rem;
}

.activate-btn:hover:not(:disabled) {
  background: #389e0d;
}

.activate-btn:disabled {
  background: #b7eb8f;
  cursor: not-allowed;
}

.activate-footer {
  text-align: center;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #f0f0f0;
}

.logout-link {
  background: none;
  border: none;
  color: #999;
  font-size: 0.85rem;
  cursor: pointer;
  transition: color 0.2s;
}

.logout-link:hover {
  color: #cf1322;
}
</style>
