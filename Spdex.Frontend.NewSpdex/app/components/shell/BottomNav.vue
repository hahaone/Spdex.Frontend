<script setup lang="ts">
import { Activity, Dumbbell, Home, Trophy, UserCircle } from '@lucide/vue'

const route = useRoute()

const navItems = [
  { label: '首页', to: '/', icon: Home },
  { label: '足球', to: '/football', icon: Trophy },
  { label: '篮球', to: '/basketball', icon: Dumbbell },
  { label: '实时', to: '/live', icon: Activity },
  { label: '会员', to: '/account', icon: UserCircle },
]

function isActive(to: string): boolean {
  if (to === '/') return route.path === '/'
  return route.path.startsWith(to)
}
</script>

<template>
  <nav class="bottom-nav" aria-label="主导航">
    <NuxtLink
      v-for="item in navItems"
      :key="item.to"
      :to="item.to"
      :class="['nav-item focus-ring', { active: isActive(item.to) }]"
      :aria-label="item.label"
    >
      <component :is="item.icon" :size="15" stroke-width="2.2" />
      <span>{{ item.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  padding: 0 0 env(safe-area-inset-bottom);
  background: #ffffff;
  border-top: 1px solid #dde2eb;
  box-shadow: 0 -2px 10px rgba(26, 34, 51, 0.05);
}

.nav-item {
  display: grid;
  position: relative;
  min-width: 0;
  height: 52px;
  place-items: center;
  gap: 1px;
  color: #6b7280;
  font-size: 0.7rem;
  font-weight: 740;
  line-height: 1;
  transition: color 0.15s ease;
}

.nav-item span {
  letter-spacing: 0;
  white-space: nowrap;
}

.nav-item.active {
  color: #1a8cd3;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  top: 0;
  left: 18%;
  right: 18%;
  height: 2px;
  background: #1a8cd3;
  border-radius: 0 0 2px 2px;
}

.nav-item:active {
  background: #f3f6fb;
}

@media (max-width: 370px) {
  .nav-item {
    font-size: 0.66rem;
  }

  .nav-item span {
    transform: scale(0.96);
    transform-origin: center;
  }
}

@media (min-width: 768px) {
  .bottom-nav {
    right: calc((100% - 520px) / 2);
    left: calc((100% - 520px) / 2);
    border-right: 1px solid #dde2eb;
    border-left: 1px solid #dde2eb;
    border-radius: 10px 10px 0 0;
  }
}
</style>
