<script setup lang="ts">
const { desktopViewMode, isDesktopModeAvailable, setDesktopViewMode } = useDesktopViewMode()
</script>

<template>
  <div v-if="isDesktopModeAvailable" class="classic-toggle" role="group" aria-label="桌面显示模式">
    <button
      type="button"
      :class="['toggle-item', { active: desktopViewMode === 'modern' }]"
      aria-label="使用新版桌面模式"
      @click="setDesktopViewMode('modern')"
    >
      新版
    </button>
    <button
      type="button"
      :class="['toggle-item', { active: desktopViewMode === 'classic' }]"
      aria-label="使用经典桌面模式"
      @click="setDesktopViewMode('classic')"
    >
      经典
    </button>
  </div>
</template>

<style scoped>
.classic-toggle {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(42px, auto));
  align-items: center;
  padding: 2px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--surface);
}

.toggle-item {
  min-height: 28px;
  padding: 0 9px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 800;
}

.toggle-item.active {
  background: var(--brand);
  color: #fff;
  box-shadow: 0 1px 3px rgba(26, 34, 51, 0.16);
}

.toggle-item:not(.active):hover {
  color: var(--brand-deep);
  background: var(--brand-tint);
}
</style>
