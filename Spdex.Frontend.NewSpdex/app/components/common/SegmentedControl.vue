<script setup lang="ts">
interface Option {
  label: string
  value: string
  count?: number
}

defineProps<{
  modelValue: string
  options: Option[]
  dense?: boolean
  tone?: 'brand' | 'accent' | 'ink'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div :class="['segmented scrollbar-none', { dense }, `tone-${tone || 'brand'}`]">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :class="['segmented-item focus-ring', { active: modelValue === option.value }]"
      @click="emit('update:modelValue', option.value)"
    >
      <span>{{ option.label }}</span>
      <span v-if="option.count !== undefined" class="count num">{{ option.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 1px 0;
}

.segmented-item {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  gap: 4px;
  padding: 0 11px;
  border: 1px solid #dde2eb;
  border-radius: 4px;
  background: #fff;
  color: #4a5364;
  font-size: 0.8rem;
  font-weight: 740;
  white-space: nowrap;
  transition: all 0.12s ease;
}

.segmented-item:active {
  background: #f3f6fb;
}

.segmented.tone-brand .segmented-item.active {
  border-color: #1a8cd3;
  background: #1a8cd3;
  color: #fff;
}

.segmented.tone-accent .segmented-item.active {
  border-color: #6e5aaf;
  background: #6e5aaf;
  color: #fff;
}

.segmented.tone-ink .segmented-item.active {
  border-color: #1a2233;
  background: #1a2233;
  color: #fff;
}

.segmented.dense .segmented-item {
  min-height: 28px;
  padding: 0 9px;
  font-size: 0.76rem;
}

.count {
  min-width: 16px;
  padding: 0 4px;
  border-radius: 9999px;
  background: rgba(26, 34, 51, 0.08);
  color: inherit;
  font-size: 0.7rem;
  font-weight: 760;
}

.segmented-item.active .count {
  background: rgba(255, 255, 255, 0.22);
}
</style>
