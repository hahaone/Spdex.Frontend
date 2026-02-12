<script setup lang="ts">
const navItems = [
  { label: '首页', to: '/' },
]

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
          SPdex 竞彩工作室
        </NuxtLink>
        <nav class="main-nav">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nav-link"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
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
  background-color: #1a1a2e;
  color: #fff;
  padding: 0 1rem;
}

.header-inner {
  max-width: 1440px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  text-decoration: none;
}

.main-nav {
  display: flex;
  gap: 1.5rem;
}

.nav-link {
  color: #fff;
  text-decoration: none;
  font-size: 0.95rem;
  transition: color 0.2s;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: #fff;
  opacity: 0.85;
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
