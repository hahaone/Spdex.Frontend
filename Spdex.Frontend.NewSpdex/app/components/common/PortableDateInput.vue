<script setup lang="ts">
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
</script>

<template>
  <span class="portable-date-input" :class="{ empty: !modelValue, disabled }">
    <input
      type="date"
      :value="modelValue"
      :min="min"
      :disabled="disabled"
      :aria-label="ariaLabel"
      @input="updateValue"
    >
    <span v-if="!modelValue" class="portable-date-placeholder" aria-hidden="true">
      {{ placeholder }}
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
  box-sizing: border-box;
}

.portable-date-input > input {
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  max-height: 100%;
  padding: 0 var(--portable-date-padding-inline, 8px);
  box-sizing: border-box;
  border: 0;
  outline: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-variant-numeric: tabular-nums;
}

.portable-date-input.empty > input,
.portable-date-input.empty > input::-webkit-datetime-edit {
  color: transparent;
}

.portable-date-input > input::-webkit-calendar-picker-indicator {
  position: relative;
  z-index: 2;
  cursor: pointer;
}

.portable-date-placeholder {
  position: absolute;
  z-index: 1;
  top: 50%;
  left: var(--portable-date-padding-inline, 8px);
  max-width: calc(100% - 30px);
  overflow: hidden;
  color: var(--muted);
  font: inherit;
  font-weight: 720;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
  transform: translateY(-50%);
}

.portable-date-input:focus-within {
  outline: 2px solid var(--brand);
  outline-offset: 1px;
}

.portable-date-input.disabled > input::-webkit-calendar-picker-indicator {
  cursor: not-allowed;
}
</style>
