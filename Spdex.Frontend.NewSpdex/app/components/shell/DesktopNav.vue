<script setup lang="ts">
import { Bell, Moon, Search, Sun, UserCircle } from '@lucide/vue'

const route = useRoute()
const { isLoggedIn, userName, tier, logout } = useAuth()
const { isDark, toggle } = useTheme()
const { show: showCommand } = useCommandPalette()

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
  await logout()
}
</script>

<template>
  <header class="desktop-nav">
    <div class="nav-inner">
      <NuxtLink to="/" class="brand focus-ring" aria-label="SPdex 超级指数系统">
        <img :src="isDark ? '/logo-s-dark.png' : '/logo-s.png'" alt="SPdex 超级指数系统" class="brand-logo">
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
        <button class="action-btn focus-ring" aria-label="搜索 (⌘K)" @click="showCommand()">
          <Search :size="16" />
        </button>
        <NuxtLink to="/push" class="action-btn focus-ring" aria-label="消息推送">
          <Bell :size="16" />
        </NuxtLink>
        <button class="action-btn focus-ring" :aria-label="isDark ? '日间模式' : '夜间模式'" @click="toggle()">
          <Sun v-if="isDark" :size="16" />
          <Moon v-else :size="16" />
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
  background: var(--panel);
  border-bottom: 2px solid var(--brand);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);
}

.nav-inner {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 18px;
  max-width: var(--w-wide);
  margin: 0 auto;
  padding: 0 var(--gutter);
  height: 56px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* logo：浅色用 logo-s.png（深 dex），深色切 logo-s-dark.png（白 dex），按 isDark 换图（同 AppTopBar） */
.brand-logo {
  height: 34px;
  width: auto;
  display: block;
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
  color: var(--muted);
  font-size: 0.92rem;
  font-weight: 760;
  letter-spacing: 0.01em;
  transition: color 0.15s ease;
}

.nav-link:hover {
  color: var(--brand);
}

.nav-link.active {
  color: var(--brand);
  font-weight: 820;
}

.nav-link.active::after {
  content: '';
  position: absolute;
  right: 14px;
  bottom: -2px;
  left: 14px;
  height: 3px;
  background: var(--brand);
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
  color: var(--muted);
}

.action-btn:hover {
  background: var(--brand-tint);
  color: var(--brand-deep);
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--surface);
  color: var(--ink);
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

.tier-free      { background: var(--chip-mute-bg); color: var(--chip-mute-fg); }
.tier-expert    { background: var(--brand-tint); color: var(--brand-deep); }
.tier-gold      { background: var(--away-bg); color: #8a6212; }
.tier-emerald   { background: var(--draw-bg); color: var(--sell); }
.tier-ruby      { background: #fde0e7; color: #b1253c; }
.tier-platinum  { background: linear-gradient(120deg, var(--accent) 0%, var(--brand) 100%); color: #fff; }

.logout-link {
  padding: 0 0 0 8px;
  margin-left: 4px;
  border: 0;
  border-left: 1px solid var(--line);
  background: transparent;
  color: var(--buy);
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
  background: var(--brand);
  color: #fff;
  font-size: 0.86rem;
  font-weight: 800;
}

.login-chip:hover {
  background: var(--brand-deep);
}

@media (max-width: 1180px) {
  .nav-link {
    padding: 0 10px;
    font-size: 0.86rem;
  }

  .brand-logo {
    height: 28px;
  }
}
</style>
