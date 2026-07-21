<script setup lang="ts">
import { CalendarDays } from '@lucide/vue'

withDefaults(defineProps<{
  modelValue: string
  min?: string
  disabled?: boolean
  ariaLabel?: string
  placeholder?: string
}>(), {
  min: undefined,
  disabled: false,
  ariaLabel: '选择日期',
  placeholder: 'dd/mm/yyyy',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function updateValue(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function displayDate(value: string) {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}
</script>

<template>
  <span class="portable-date-input" :class="{ disabled }">
    <input
      type="date"
      :value="modelValue"
      :min="min"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @input="updateValue"
    >
    <span class="portable-date-display" aria-hidden="true">
      <span :class="['portable-date-text', { placeholder: !modelValue }]">
        {{ modelValue ? displayDate(modelValue) : placeholder }}
      </span>
      <CalendarDays :size="14" :stroke-width="2" />
    </span>
  </span>
</template>

<style scoped>
.portable-date-input {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 0;
  width: 100%;
  height: var(--portable-date-height, 30px);
  min-height: var(--portable-date-height, 30px);
  max-height: var(--portable-date-height, 30px);
  overflow: hidden;
  box-sizing: border-box;
}

.portable-date-input > input {
  position: absolute;
  z-index: 2;
  inset: 0;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  border: 0;
  outline: 0;
  background: transparent;
  color: transparent;
  font: inherit;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  opacity: 0;
}

.portable-date-display {
  position: absolute;
  z-index: 1;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;
  padding: 0 var(--portable-date-padding-inline, 8px);
  color: var(--ink);
  font: inherit;
  font-weight: 720;
  pointer-events: none;
}

.portable-date-text {
  min-width: 0;
  overflow: hidden;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.portable-date-text.placeholder {
  color: var(--muted);
}

.portable-date-input:focus-within {
  outline: 2px solid var(--brand);
  outline-offset: 1px;
}

.portable-date-input.disabled > input {
  cursor: not-allowed;
}
</style>
