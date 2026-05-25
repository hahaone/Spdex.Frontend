<script setup lang="ts">
/**
 * 时间窗口 Tab 切换组件。
 * 显示 10 个时间窗口标签（当前、-15分、-30分 等），支持 v-model。
 */

defineProps<{
  /** 窗口列表，每个窗口至少有 label 字段 */
  windows: { label: string }[]
  /** 当前选中的 tab 索引 */
  modelValue: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()
</script>

<template>
  <div class="tab-bar">
    <button
      v-for="(w, idx) in windows"
      :key="idx"
      :class="['tab-btn', { active: modelValue === idx }]"
      @click="emit('update:modelValue', idx)"
    >{{ w.label }}</button>
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  gap: 0;
  margin-bottom: 1rem;
  border-bottom: 2px solid #e2e8f0;
  overflow-x: auto;
}

.tab-btn {
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  font-size: 0.82rem;
  color: #64748b;
  cursor: pointer;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.15s;
}

.tab-btn:hover {
  color: #1e40af;
  background: #f8fafc;
}

.tab-btn.active {
  color: #1e40af;
  font-weight: 600;
  border-bottom-color: #1e40af;
}
</style>
