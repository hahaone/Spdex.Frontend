<script setup lang="ts">
import { Bell, Moon, Search, Sun, Zap } from '@lucide/vue'

const route = useRoute()
const { isDark, toggle } = useTheme()

const title = computed(() => {
  if (route.path.startsWith('/football')) return '今日足球'
  if (route.path.startsWith('/live')) return '实时赛事'
  if (route.path.startsWith('/basketball')) return '今日篮球'
  if (route.path.startsWith('/volume')) return '量化模型'
  if (route.path.startsWith('/signals')) return '推荐信号'
  if (route.path.startsWith('/account')) return '会员中心'
  return '首页'
})
</script>

<template>
  <header class="app-topbar">
    <NuxtLink to="/" class="brand focus-ring" aria-label="返回首页">
      <img src="/logo-s.png" alt="SPdex 超级指数系统" :class="['brand-logo', { 'logo-dark': isDark }]">
    </NuxtLink>

    <div class="top-title">
      {{ title }}
    </div>

    <div class="top-actions" aria-label="页面工具">
      <button class="icon-btn focus-ring" aria-label="搜索">
        <Search :size="17" />
      </button>
      <button class="icon-btn focus-ring" aria-label="闪Q分析">
        <Zap :size="17" />
      </button>
      <button class="icon-btn focus-ring" aria-label="消息">
        <Bell :size="17" />
      </button>
      <button class="icon-btn focus-ring" :aria-label="isDark ? '日间模式' : '夜间模式'" @click="toggle()">
        <Sun v-if="isDark" :size="17" />
        <Moon v-else :size="17" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-topbar {
  position: sticky;
  top: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: minmax(86px, auto) minmax(0, 1fr) auto;
  align-items: center;
  min-height: 44px;
  padding: max(6px, env(safe-area-inset-top)) 10px 6px;
  background: var(--panel);
  border-bottom: 2px solid var(--brand);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.brand {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

/* logo 为黑字白底 PNG（无 alpha）：浅色面板纯白(#fff)无缝融合，用 multiply 抹掉白底；
   深色模式 invert 翻成白字黑底，再用 screen 抹掉黑底 */
.brand-logo {
  height: 26px;
  width: auto;
  display: block;
  mix-blend-mode: multiply;
}

/* 深色：invert 翻成白字黑底，screen 抹掉黑底（由 isDark 切类，避开 scoped :global 失效） */
.brand-logo.logo-dark {
  filter: invert(1);
  mix-blend-mode: screen;
}

.top-title {
  min-width: 0;
  padding: 0 8px;
  color: var(--ink);
  font-size: 0.95rem;
  font-weight: 780;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  gap: 0;
}

.icon-btn {
  display: inline-grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
}

.icon-btn:active {
  background: var(--brand-tint);
  color: var(--brand-deep);
}

@media (max-width: 370px) {
  .app-topbar {
    grid-template-columns: minmax(70px, auto) minmax(0, 1fr) auto;
    padding-inline: 6px;
  }

  .brand-logo {
    height: 22px;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
  }
}
</style>
