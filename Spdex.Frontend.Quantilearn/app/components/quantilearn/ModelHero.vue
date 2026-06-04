<script setup lang="ts">
import { Eye, LineChart, ShieldCheck, Users } from '@lucide/vue'
import type { QuantModel, WorkspaceId } from '~/data/quantilearnPrototype'
import { stateLabel } from '~/data/quantilearnPrototype'

defineProps<{
  model: QuantModel
}>()

const emit = defineEmits<{
  openWorkspace: [workspace: WorkspaceId]
}>()
</script>

<template>
  <section class="model-hero">
    <div class="model-heading">
      <div class="model-kicker">
        <ShieldCheck v-if="model.isOwner" :size="15" />
        <Users v-else :size="15" />
        <span>{{ stateLabel(model.state) }} / {{ model.owner }}</span>
      </div>
      <h2>{{ model.name }}</h2>
      <p>{{ model.description }}</p>
      <div class="model-meta">
        <span>创建 {{ model.createdAt }}</span>
        <span>更新 {{ model.updatedAt }}</span>
      </div>
    </div>

    <div class="hero-actions">
      <button type="button" class="primary-button focus-ring" @click="emit('openWorkspace', 'report')">
        <LineChart :size="16" />
        <span>回测报告</span>
      </button>
      <button type="button" class="ghost-button focus-ring" @click="emit('openWorkspace', 'events')">
        <Eye :size="16" />
        <span>当前赛事</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.model-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 12px;
  border: 1px solid #0f4f4a;
  border-radius: 8px;
  background: linear-gradient(135deg, #102a2e 0%, #0f4f4a 100%);
  color: #f7fbfb;
  box-shadow: var(--shadow);
}

.model-heading {
  min-width: 0;
}

.model-kicker,
.model-meta,
.hero-actions {
  display: flex;
  align-items: center;
}

.model-kicker {
  gap: 6px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.74rem;
  font-weight: 760;
}

h2,
p {
  margin: 0;
  letter-spacing: 0;
}

h2 {
  margin-top: 4px;
  overflow-wrap: anywhere;
  font-size: 1.22rem;
  font-weight: 850;
  line-height: 1.2;
}

p {
  max-width: 860px;
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 0.82rem;
}

.model-meta {
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.66);
  font-size: 0.72rem;
}

.hero-actions {
  gap: 7px;
}

.ghost-button {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

@media (max-width: 760px) {
  .model-hero {
    grid-template-columns: 1fr;
  }

  .hero-actions {
    justify-content: flex-start;
  }
}
</style>
