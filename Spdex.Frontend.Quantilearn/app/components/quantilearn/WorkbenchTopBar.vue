<script setup lang="ts">
import {
  BarChart3,
  CircleDot,
  Layers,
  RefreshCw,
  Trophy,
  Workflow,
  Zap,
} from '@lucide/vue'
import type { WorkspaceIcon, WorkspaceId, WorkspaceItem } from '~/data/quantilearnPrototype'

defineProps<{
  apiBase: string
  activeWorkspace: WorkspaceId
  selectedWorkspaceLabel: string
  selectedModelName: string
  workspaces: WorkspaceItem[]
}>()

const emit = defineEmits<{
  selectWorkspace: [workspace: WorkspaceId]
}>()

const iconMap: Record<WorkspaceIcon, typeof Layers> = {
  layers: Layers,
  workflow: Workflow,
  report: BarChart3,
  events: Zap,
  hall: Trophy,
}
</script>

<template>
  <header class="top-bar">
    <a class="brand-area focus-ring" href="https://new.spdex.com" aria-label="返回 SPdex 首页">
      <img class="brand-logo" src="/images/spdex_logo_s.png" alt="SPdex">
      <div class="brand-copy">
        <h1>量化模型</h1>
        <p>{{ selectedWorkspaceLabel }} / {{ selectedModelName }}</p>
      </div>
    </a>

    <nav class="workspace-tabs" aria-label="量化模型工作台">
      <button
        v-for="item in workspaces"
        :key="item.id"
        type="button"
        :class="['workspace-tab focus-ring', { active: activeWorkspace === item.id }]"
        :title="item.hint"
        @click="emit('selectWorkspace', item.id)"
      >
        <component :is="iconMap[item.icon]" :size="15" />
        <span>{{ item.label }}</span>
        <em>{{ item.count }}</em>
      </button>
    </nav>

    <div class="top-actions">
      <div class="api-pill" :title="apiBase">
        <CircleDot :size="13" />
        <span>{{ apiBase }}</span>
      </div>
      <button type="button" class="icon-button focus-ring" title="刷新工作台">
        <RefreshCw :size="16" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(220px, 300px) minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  min-height: 58px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
}

.brand-area,
.workspace-tabs,
.top-actions,
.api-pill {
  display: flex;
  align-items: center;
  min-width: 0;
}

.brand-area {
  gap: 10px;
  color: inherit;
  text-decoration: none;
}

.brand-logo {
  display: block;
  flex: 0 0 96px;
  width: 96px;
  height: auto;
  max-height: 32px;
  object-fit: contain;
}

.brand-copy {
  min-width: 0;
}

h1,
p {
  margin: 0;
  letter-spacing: 0;
}

h1 {
  font-size: 1rem;
  font-weight: 840;
}

p {
  max-width: 250px;
  margin-top: 1px;
  overflow: hidden;
  color: var(--muted);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-tabs {
  justify-content: center;
  gap: 5px;
  overflow: hidden;
}

.workspace-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 780;
  white-space: nowrap;
}

.workspace-tab em {
  color: var(--subtle);
  font-size: 0.67rem;
  font-style: normal;
  font-weight: 760;
}

.workspace-tab.active {
  border-color: #132331;
  background: #132331;
  color: #ffffff;
}

.workspace-tab.active em {
  color: rgba(255, 255, 255, 0.72);
}

.top-actions {
  justify-content: flex-end;
  gap: 7px;
}

.api-pill {
  max-width: 240px;
  min-height: 32px;
  gap: 6px;
  padding: 0 9px;
  border: 1px solid #b7ddd8;
  border-radius: 999px;
  background: var(--teal-soft);
  color: #0b6f67;
  font-size: 0.74rem;
  font-weight: 760;
}

.api-pill span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 980px) {
  .top-bar {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "brand actions"
      "tabs tabs";
    min-height: 92px;
  }

  .brand-area {
    grid-area: brand;
  }

  .workspace-tabs {
    grid-area: tabs;
    justify-content: flex-start;
    overflow-x: auto;
    padding-bottom: 1px;
  }

  .top-actions {
    grid-area: actions;
  }
}

@media (max-width: 560px) {
  .top-bar {
    padding: 8px;
  }

  .brand-logo {
    flex-basis: 82px;
    width: 82px;
    max-height: 28px;
  }

  .brand-copy p,
  .api-pill {
    display: none;
  }

  .workspace-tab {
    min-height: 32px;
    padding: 0 8px;
    font-size: 0.76rem;
  }
}
</style>
