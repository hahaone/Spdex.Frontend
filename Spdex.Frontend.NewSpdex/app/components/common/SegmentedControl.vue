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
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 740;
  white-space: nowrap;
  transition: all 0.12s ease;
}

.segmented-item:active {
  background: var(--surface);
}

.segmented.tone-brand .segmented-item.active {
  border-color: var(--brand);
  background: var(--brand);
  color: #fff;
}

.segmented.tone-accent .segmented-item.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.segmented.tone-ink .segmented-item.active {
  border-color: var(--ink);
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
