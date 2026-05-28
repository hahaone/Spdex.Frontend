<script setup lang="ts">
import { Bell, Moon, Search, UserCircle } from '@lucide/vue'

const route = useRoute()
const { isLoggedIn, userName, tier, logout } = useAuth()

const tierLabel: Record<string, string> = {
  Free: '免费版',
  Expert: '专家版',
  Gold: '黄金版',
  Emerald: '翡翠版',
  Ruby: '红宝石版',
  Platinum: '白金版',
}

const tierClass: Record<string, string> = {
  Free: 'tier-free',
  Expert: 'tier-expert',
  Gold: 'tier-gold',
  Emerald: 'tier-emerald',
  Ruby: 'tier-ruby',
  Platinum: 'tier-platinum',
}

const tierDisplay = computed(() => tierLabel[tier.value] ?? tier.value)
const tierToneClass = computed(() => tierClass[tier.value] ?? 'tier-free')

const navItems = [
  { label: '首页', to: '/' },
  { label: '今日足球', to: '/football' },
  { label: '今日篮球', to: '/basketball' },
  { label: '实时赛事', to: '/live' },
  { label: '会员中心', to: '/account' },
]

function isActive(to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}

async function handleLogout() {
  logout()
  await navigateTo('/login')
}
</script>

<template>
  <header class="desktop-nav">
    <div class="nav-inner">
      <NuxtLink to="/" class="brand focus-ring">
        <span class="brand-text">SPdex</span>
        <span class="brand-sub">超级指数系统</span>
      </NuxtLink>

      <nav class="nav-links" aria-label="主导航">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :class="['nav-link focus-ring', { active: isActive(item.to) }]"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="nav-actions">
        <button class="action-btn focus-ring" aria-label="搜索">
          <Search :size="16" />
        </button>
        <button class="action-btn focus-ring" aria-label="消息">
          <Bell :size="16" />
        </button>
        <button class="action-btn focus-ring" aria-label="夜间模式">
          <Moon :size="16" />
        </button>

        <div v-if="isLoggedIn" class="user-chip focus-ring">
          <UserCircle :size="16" />
          <span class="user-name">{{ userName }}</span>
          <span :class="['tier-badge', tierToneClass]">{{ tierDisplay }}</span>
          <button class="logout-link" type="button" @click="handleLogout">退出</button>
        </div>
        <NuxtLink v-else to="/login" class="login-chip focus-ring">
          登录
        </NuxtLink>
      </div>
    </div>
  </header>
</template>

<style scoped>
.desktop-nav {
  position: sticky;
  top: 0;
  z-index: 30;
  background: #ffffff;
  border-bottom: 2px solid #1a8cd3;
  box-shadow: 0 1px 6px rgba(26, 34, 51, 0.08);
}

.nav-inner {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 18px;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 20px;
  height: 56px;
}

.brand {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}

.brand-text {
  font-size: 1.4rem;
  font-weight: 900;
  letter-spacing: 0.02em;
  background: linear-gradient(120deg, #1a8cd3 0%, #6e5aaf 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  line-height: 1;
}

.brand-sub {
  color: #6b7280;
  font-size: 0.78rem;
  font-weight: 720;
}

.nav-links {
  display: flex;
  align-items: stretch;
  height: 100%;
  gap: 2px;
}

.nav-link {
  display: inline-flex;
  position: relative;
  align-items: center;
  padding: 0 14px;
  color: #4a5364;
  font-size: 0.92rem;
  font-weight: 760;
  letter-spacing: 0.01em;
  transition: color 0.15s ease;
}

.nav-link:hover {
  color: #1a8cd3;
}

.nav-link.active {
  color: #1a8cd3;
  font-weight: 820;
}

.nav-link.active::after {
  content: '';
  position: absolute;
  right: 14px;
  bottom: -2px;
  left: 14px;
  height: 3px;
  background: #1a8cd3;
  border-radius: 3px 3px 0 0;
}

.nav-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.action-btn {
  display: inline-grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #4a5364;
}

.action-btn:hover {
  background: #e2f1fa;
  color: #1672b3;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
  padding: 4px 10px;
  border: 1px solid #dde2eb;
  border-radius: 5px;
  background: #f3f6fb;
  color: #1a2233;
  font-size: 0.84rem;
  font-weight: 760;
}

.user-name {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tier-badge {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.tier-free      { background: #eef1f6; color: #4a5364; }
.tier-expert    { background: #e2f1fa; color: #1672b3; }
.tier-gold      { background: #fff4d8; color: #8a6212; }
.tier-emerald   { background: #e6f3e6; color: #246b3b; }
.tier-ruby      { background: #fde0e7; color: #b1253c; }
.tier-platinum  { background: linear-gradient(120deg, #6e5aaf 0%, #1a8cd3 100%); color: #fff; }

.logout-link {
  padding: 0 0 0 8px;
  margin-left: 4px;
  border: 0;
  border-left: 1px solid #c4ccd9;
  background: transparent;
  color: #d6324c;
  font-size: 0.78rem;
  font-weight: 720;
  cursor: pointer;
}

.login-chip {
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  padding: 5px 14px;
  border-radius: 5px;
  background: #1a8cd3;
  color: #fff;
  font-size: 0.86rem;
  font-weight: 800;
}

.login-chip:hover {
  background: #1672b3;
}

@media (max-width: 1180px) {
  .nav-link {
    padding: 0 10px;
    font-size: 0.86rem;
  }

  .brand-sub {
    display: none;
  }
}
</style>
