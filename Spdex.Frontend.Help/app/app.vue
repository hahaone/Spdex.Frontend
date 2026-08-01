<script setup lang="ts">
import { Bot, ExternalLink, Home, LifeBuoy, Menu, Server, X } from '@lucide/vue'

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const navOpen = ref(false)

const navItems = [
  { label: '首页', to: '/', icon: Home },
  { label: 'AI 帮助', to: '/ai', icon: Bot },
  { label: 'MCP 接入', to: '/ai/mcp-quickstart', icon: Server },
  { label: '客服反馈', to: '/ai/safe-usage', icon: LifeBuoy },
]

watch(() => route.fullPath, () => {
  navOpen.value = false
})

function isActive(to: string) {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="page-shell topbar-inner">
        <NuxtLink class="brand focus-ring" to="/" aria-label="SPdex 帮助中心首页">
          <img src="/logo-s.png" alt="SPdex" class="brand-logo">
          <span>帮助中心</span>
        </NuxtLink>

        <nav class="desktop-nav" aria-label="帮助中心导航">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :class="['nav-link', 'focus-ring', { active: isActive(item.to) }]"
          >
            <component :is="item.icon" :size="15" />
            <span>{{ item.label }}</span>
          </NuxtLink>
        </nav>

        <a class="newspdex-link focus-ring" :href="runtimeConfig.public.newspdexUrl" target="_blank" rel="noreferrer">
          <span>进入 NewSpdex</span>
          <ExternalLink :size="14" />
        </a>

        <button class="mobile-menu focus-ring" type="button" :aria-label="navOpen ? '关闭导航' : '打开导航'" @click="navOpen = !navOpen">
          <X v-if="navOpen" :size="20" />
          <Menu v-else :size="20" />
        </button>
      </div>

      <nav v-if="navOpen" class="mobile-nav page-shell" aria-label="移动导航">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :class="['mobile-nav-link', 'focus-ring', { active: isActive(item.to) }]"
        >
          <component :is="item.icon" :size="16" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>
    </header>

    <NuxtPage />

    <footer class="site-footer">
      <div class="page-shell footer-inner">
        <span>SPdex 帮助中心 · AI 试点文档</span>
        <span>公开域名上线前，内容以试点说明为准。</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app-shell { min-height: 100vh; display: grid; grid-template-rows: auto 1fr auto; }
.topbar { position: sticky; top: 0; z-index: 20; border-bottom: 1px solid var(--line); background: rgba(255, 255, 255, .96); backdrop-filter: blur(12px); }
.topbar-inner { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 18px; min-height: 62px; }
.brand { display: inline-flex; min-width: 0; align-items: center; gap: 10px; font-weight: 820; color: var(--ink); }
.brand-logo { width: 104px; height: auto; }
.brand span { padding-left: 10px; border-left: 1px solid var(--line); white-space: nowrap; }
.desktop-nav { display: flex; align-items: center; justify-content: center; gap: 4px; }
.nav-link { display: inline-flex; min-height: 34px; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 6px; color: var(--muted); font-size: .86rem; font-weight: 720; }
.nav-link.active, .nav-link:hover { background: #e9f5f2; color: var(--accent-strong); }
.newspdex-link { display: inline-flex; min-height: 34px; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--ink); font-size: .82rem; font-weight: 760; }
.mobile-menu { display: none; width: 38px; height: 38px; place-items: center; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--ink); }
.mobile-nav { display: none; padding-bottom: 12px; }
.mobile-nav-link { display: flex; min-height: 38px; align-items: center; gap: 8px; border-radius: 6px; padding: 8px 10px; color: var(--muted); font-weight: 720; }
.mobile-nav-link.active { background: #e9f5f2; color: var(--accent-strong); }
.site-footer { border-top: 1px solid var(--line); background: #eef2f6; color: var(--muted); }
.footer-inner { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; padding-top: 18px; padding-bottom: 18px; font-size: .82rem; }
@media (max-width: 820px) {
  .topbar-inner { grid-template-columns: minmax(0, 1fr) auto; gap: 10px; min-height: 56px; }
  .desktop-nav, .newspdex-link { display: none; }
  .mobile-menu { display: inline-grid; }
  .mobile-nav { display: grid; gap: 4px; }
  .brand-logo { width: 96px; }
}
</style>
