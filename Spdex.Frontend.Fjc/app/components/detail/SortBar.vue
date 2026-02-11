<script setup lang="ts">
/**
 * 排序按钮 + 刷新按钮组件。
 * cs3/cs4/cs5 detail 页面共用。
 */

interface SortOption {
  value: number
  label: string
}

withDefaults(defineProps<{
  order: number
  refreshing: boolean
  options?: SortOption[]
}>(), {
  options: () => [
    { value: 0, label: 'Hold ↓' },
    { value: 1, label: '时间 ↓' },
    { value: 2, label: '序号 ↑' },
  ],
})

const emit = defineEmits<{
  'update:order': [value: number]
  'refresh': []
}>()
</script>

<template>
  <div class="sort-bar">
    <span class="sort-label">排序：</span>
    <button
      v-for="opt in options"
      :key="opt.value"
      :class="['sort-btn', { active: order === opt.value }]"
      @click="emit('update:order', opt.value)"
    >{{ opt.label }}</button>

    <button
      class="refresh-btn"
      :disabled="refreshing"
      @click="emit('refresh')"
    >
      <span :class="{ spin: refreshing }">↻</span>
      {{ refreshing ? '刷新中...' : '刷新数据' }}
    </button>
  </div>
</template>

<style scoped>
.sort-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.sort-label {
  font-size: 0.82rem;
  color: #64748b;
}

.sort-btn {
  padding: 0.3rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  font-size: 0.82rem;
  cursor: pointer;
  color: #475569;
  transition: all 0.15s;
}

.sort-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.sort-btn.active {
  background: #1e40af;
  color: #fff;
  border-color: #1e40af;
}

.refresh-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  font-size: 0.82rem;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
}

.refresh-btn:hover:not(:disabled) {
  background: #f0fdf4;
  border-color: #86efac;
  color: #166534;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin {
  display: inline-block;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
