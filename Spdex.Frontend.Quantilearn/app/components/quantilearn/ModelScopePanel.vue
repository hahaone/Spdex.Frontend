<script setup lang="ts">
import { ChevronRight, Lock, Search, SlidersHorizontal } from '@lucide/vue'
import type { ModelFilter, ModelId, QuantModel } from '~/data/quantilearnPrototype'
import { stateLabel, stateTone } from '~/data/quantilearnPrototype'

defineProps<{
  models: QuantModel[]
  selectedModelId: ModelId
  modelFilter: ModelFilter
  searchText: string
  modelFilters: Array<{ id: ModelFilter, label: string }>
  loading?: boolean
  error?: string
  sourceLabel?: string
}>()

const emit = defineEmits<{
  selectModel: [model: QuantModel]
  changeFilter: [filter: ModelFilter]
  changeSearch: [text: string]
}>()

const onSearchInput = (event: Event) => {
  emit('changeSearch', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <aside class="model-scope">
    <section class="scope-tools">
      <div class="panel-title">
        <div>
          <span class="eyebrow">Model Scope</span>
          <h2>模型集合</h2>
        </div>
        <button type="button" class="icon-button compact focus-ring" title="筛选模型">
          <SlidersHorizontal :size="15" />
        </button>
      </div>

      <label class="search-box">
        <Search :size="15" />
        <input :value="searchText" type="search" placeholder="搜索名称、方向、状态" @input="onSearchInput">
      </label>

      <div class="segment-row">
        <button
          v-for="filter in modelFilters"
          :key="filter.id"
          type="button"
          :class="['segment-button focus-ring', { active: modelFilter === filter.id }]"
          @click="emit('changeFilter', filter.id)"
        >
          {{ filter.label }}
        </button>
      </div>

      <div :class="['scope-status', { error }]">
        <span>{{ error || (loading ? '正在读取 Mongo 模型...' : sourceLabel || '实时模型') }}</span>
      </div>
    </section>

    <section class="model-list" aria-label="Models">
      <div v-if="!models.length" class="empty-state">
        没有匹配的模型
      </div>
      <button
        v-for="model in models"
        :key="model.id"
        type="button"
        :class="['model-row focus-ring', { selected: selectedModelId === model.id }]"
        @click="emit('selectModel', model)"
      >
        <div class="row-head">
          <span :class="['state-dot', stateTone(model.state)]" />
          <strong>{{ model.name }}</strong>
          <ChevronRight :size="14" />
        </div>
        <div class="row-meta">
          <span :class="['status-chip', stateTone(model.state)]">{{ stateLabel(model.state) }}</span>
          <span v-if="model.isLocked" class="status-chip danger">
            <Lock :size="12" />锁定
          </span>
          <span v-if="model.isSimilarity" class="status-chip warn">相似</span>
        </div>
        <div class="row-score">
          <span>{{ model.hasStatistics ? '年化' : '统计' }}</span>
          <strong v-if="model.hasStatistics" class="num">{{ Math.round(model.yearReturn * 100) }}%</strong>
          <strong v-else class="pending-text">待回测</strong>
        </div>
      </button>
    </section>
  </aside>
</template>

<style scoped>
.model-scope {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
}

.scope-tools,
.model-row {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow);
}

.scope-tools {
  padding: 10px;
}

.search-box {
  display: flex;
  align-items: center;
  min-height: 34px;
  gap: 7px;
  margin-top: 10px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted);
}

.search-box input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
}

.segment-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
  margin-top: 8px;
}

.segment-button {
  min-height: 30px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 780;
}

.segment-button.active {
  border-color: #132331;
  background: #132331;
  color: #ffffff;
}

.model-list {
  display: grid;
  gap: 7px;
}

.scope-status,
.empty-state {
  display: flex;
  align-items: center;
  min-height: 28px;
  margin-top: 8px;
  padding: 0 8px;
  border-radius: 6px;
  background: var(--teal-soft);
  color: #0b6f67;
  font-size: 0.72rem;
  font-weight: 760;
}

.scope-status.error {
  background: var(--rose-soft);
  color: var(--rose);
}

.empty-state {
  margin-top: 0;
  border: 1px dashed var(--line);
  background: var(--surface);
  color: var(--muted);
}

.model-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 8px;
  align-items: center;
  width: 100%;
  min-height: 74px;
  padding: 8px;
  color: inherit;
  text-align: left;
}

.model-row.selected {
  border-color: #78c9bf;
  background: linear-gradient(180deg, #ffffff 0%, #f1fbfa 100%);
}

.row-head {
  grid-column: 1 / 2;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 7px;
  align-items: center;
}

.row-head strong {
  overflow: hidden;
  font-size: 0.86rem;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--muted);
}

.state-dot.good {
  background: var(--teal);
}

.state-dot.warn {
  background: var(--amber);
}

.state-dot.purple {
  background: #7656d6;
}

.row-meta {
  grid-column: 1 / 2;
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
}

.row-score {
  grid-column: 2 / 3;
  grid-row: 1;
  display: grid;
  gap: 1px;
  align-items: center;
  color: var(--muted);
  font-size: 0.74rem;
  text-align: right;
}

.row-score span {
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 760;
}

.row-score strong {
  color: var(--teal);
  font-size: 0.9rem;
}

.row-score .pending-text {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 820;
}

@media (max-width: 1180px) {
  .model-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .segment-row {
    overflow-x: auto;
    display: flex;
    padding-bottom: 1px;
  }

  .segment-button {
    flex: 0 0 auto;
    padding: 0 9px;
  }

  .model-list {
    grid-template-columns: 1fr;
  }
}
</style>
