<script setup lang="ts">
const route = useRoute()
const { user, isLoggedIn, isJcOnly, logout } = useAuth()

/** 令牌类型显示文本 */
const tokenLabel = computed(() => {
  if (!user.value?.tokenType) return ''
  return user.value.tokenType === 'jc' ? '竞彩版' : '完整版'
})

/** 令牌类型 CSS class */
const tokenClass = computed(() => {
  if (!user.value?.tokenType) return ''
  return user.value.tokenType === 'jc' ? 'token-jc' : 'token-full'
})

const navItems = [
  { label: '足球', to: '/', icon: '⚽' },
  { label: '篮球', to: '/bk', icon: '🏀' },
]

/** 当前选中的运动：路径以 /bk 开头视为篮球，否则足球 */
function isActive(to: string): boolean {
  if (to === '/bk') return route.path.startsWith('/bk')
  return !route.path.startsWith('/bk')
}

const config = useRuntimeConfig()
const buildSha = computed(() => {
  const sha = config.public.buildSha as string
  return sha && sha.length > 7 ? sha.slice(0, 7) : sha
})
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <div class="header-inner">
        <NuxtLink to="/" class="logo">
          <img src="/logo.png" alt="SPdex" class="logo-img">
        </NuxtLink>
        <nav class="main-nav">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :class="['nav-pill', { active: isActive(item.to) }]"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.label }}</span>
          </NuxtLink>
        </nav>
        <div v-if="isLoggedIn" class="user-area">
          <span v-if="tokenLabel" :class="['token-badge', tokenClass]">{{ tokenLabel }}</span>
          <span class="user-name">{{ user?.userName }}</span>
          <button class="logout-btn" @click="logout">退出</button>
        </div>
      </div>
    </header>

    <main class="app-main">
      <slot />
    </main>

    <footer class="app-footer">
      <p>&copy; {{ new Date().getFullYear() }} SPdex 竞彩工作室 <span v-if="buildSha && buildSha !== 'dev'" class="build-tag">build: {{ buildSha }}</span></p>
    </footer>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  background-color: #f5f5f5;
  color: #333;
  padding: 0 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.header-inner {
  max-width: 1440px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  height: 52px;
  gap: 2rem;
}

.logo {
  display: flex;
  align-items: center;
  text-decoration: none;
  flex-shrink: 0;
}

.logo-img {
  height: 36px;
  width: auto;
  object-fit: contain;
}

/* ── 导航胶囊按钮 ── */
.main-nav {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #eaeaea;
  border-radius: 8px;
  padding: 3px;
}

.nav-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 16px;
  border-radius: 6px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  transition: all 0.2s ease;
  user-select: none;
  white-space: nowrap;
}

.nav-pill:hover {
  color: #333;
  background: rgba(255, 255, 255, 0.5);
}

.nav-pill.active {
  color: #333;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  font-weight: 600;
}

.nav-icon {
  font-size: 14px;
  line-height: 1;
}

.nav-label {
  line-height: 1;
}

/* ── 用户区域 ── */
.user-area {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.token-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
}

.token-jc {
  background: #fff1f0;
  color: #cf1322;
  border: 1px solid #ffa39e;
}

.token-full {
  background: #f6ffed;
  color: #389e0d;
  border: 1px solid #b7eb8f;
}

.user-name {
  font-size: 13px;
  color: #555;
  font-weight: 500;
}

.logout-btn {
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  border-color: #cf1322;
  color: #cf1322;
  background: #fff2f0;
}

.app-main {
  flex: 1;
  max-width: 1440px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.app-footer {
  background-color: #f5f5f5;
  text-align: center;
  padding: 1rem;
  font-size: 0.9rem;
  color: #666;
}

.build-tag {
  font-family: monospace;
  font-size: 0.82rem;
  color: #999;
  margin-left: 0.5rem;
}
</style>
