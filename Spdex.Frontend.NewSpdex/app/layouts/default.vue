<script setup lang="ts">
const route = useRoute()
const { maybeAutoStart } = useOnboarding()

onMounted(() => {
  // 仅首页首次访问自动弹新手引导（看过一次后 cookie 记 seen）
  if (route.path === '/') maybeAutoStart()
})
</script>

<template>
  <div class="viewport-shell">
    <DesktopNav class="desktop-only" />
    <div class="app-frame">
      <AppTopBar class="mobile-only" />
      <main class="app-content">
        <div class="content-inner">
          <slot />
        </div>
      </main>
      <BottomNav class="mobile-only" />
    </div>
    <OnboardingTour />
  </div>
</template>

<style scoped>
.viewport-shell {
  min-height: 100vh;
}

.app-frame {
  min-height: 100vh;
  margin: 0 auto;
  background: var(--surface);
}

.app-content {
  min-height: calc(100vh - 44px);
  padding-bottom: calc(60px + env(safe-area-inset-bottom));
}

.content-inner {
  margin: 0 auto;
}

.desktop-only {
  display: none;
}

/* Tablet: keep mobile shell but expand width */
@media (min-width: 768px) and (max-width: 1023px) {
  .app-frame {
    max-width: 720px;
    border-right: 1px solid var(--line);
    border-left: 1px solid var(--line);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.10);
  }
}

/* Desktop: full responsive */
@media (min-width: 1024px) {
  .mobile-only {
    display: none;
  }

  .desktop-only {
    display: block;
  }

  .app-frame {
    max-width: none;
    background: transparent;
    box-shadow: none;
    border: 0;
  }

  .app-content {
    min-height: calc(100vh - 56px);
    padding-bottom: 32px;
  }

  .content-inner {
    max-width: 1280px;
    padding: 0 20px;
  }
}
</style>
