<script setup lang="ts">
import { Bell, Moon, Search, Zap } from '@lucide/vue'

const route = useRoute()

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
      <span class="brand-text">SPdex</span>
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
      <button class="icon-btn focus-ring" aria-label="夜间模式">
        <Moon :size="17" />
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
  background: linear-gradient(180deg, #ffffff 0%, #f7fafd 100%);
  border-bottom: 2px solid #1a8cd3;
  box-shadow: 0 1px 4px rgba(26, 34, 51, 0.06);
}

.brand {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.brand-text {
  font-size: 1.16rem;
  font-weight: 880;
  letter-spacing: 0.02em;
  background: linear-gradient(120deg, #1a8cd3 0%, #6e5aaf 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.top-title {
  min-width: 0;
  padding: 0 8px;
  color: #1a2233;
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
  color: #4a5364;
}

.icon-btn:active {
  background: #e2f1fa;
  color: #1672b3;
}

@media (max-width: 370px) {
  .app-topbar {
    grid-template-columns: minmax(70px, auto) minmax(0, 1fr) auto;
    padding-inline: 6px;
  }

  .brand-text {
    font-size: 1.04rem;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
  }
}
</style>
