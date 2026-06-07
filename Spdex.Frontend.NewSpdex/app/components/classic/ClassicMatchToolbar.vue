<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'

interface Option {
  label: string
  value: string
}

const props = withDefaults(defineProps<{
  count: number
  pending: boolean
  selectedCount: number
  archiveMinDate: string
  daySeg: string
  customDate: string
  status: string
  lottery: string
  league: string
  sortMode: string
  dayOptions: Option[]
  statusOptions: Option[]
  lotteryOptions: Option[]
  leagueOptions: Option[]
  backcheckLocked?: boolean
  showLotteryFilters?: boolean
  isMetricFiltered?: boolean
  metricLabel?: string
}>(), {
  backcheckLocked: false,
  showLotteryFilters: true,
  metricLabel: '',
})

const emit = defineEmits<{
  'update:daySeg': [value: string]
  'update:customDate': [value: string]
  'update:status': [value: string]
  'update:lottery': [value: string]
  'update:league': [value: string]
  'update:sortMode': [value: string]
  refresh: []
  clearMetric: []
  collapseAll: []
  expandAll: []
  pinSelected: []
  retainSelected: []
  deleteSelected: []
  restore: []
}>()

const hasSelection = computed(() => props.selectedCount > 0)

function updateDay(value: string) {
  if (props.backcheckLocked) return
  if (value === 'custom') return
  emit('update:daySeg', value)
}
</script>

<template>
  <section class="classic-toolbar">
    <div class="toolbar-row main">
      <div class="toolbar-title">
        <button type="button" class="event-menu">赛事选择⌄</button>
        <button type="button" class="tab-btn" :class="{ active: status === 'all' && lottery === 'all' }" @click="emit('update:status', 'all'); emit('update:lottery', 'all')">全部赛事</button>
        <button type="button" class="tab-btn" :class="{ active: status === 'upcoming' }" @click="emit('update:status', 'upcoming')">未开赛</button>
        <button v-if="showLotteryFilters" type="button" class="tab-btn" :class="{ active: lottery === 'lottery' }" @click="emit('update:lottery', 'lottery')">胜负彩赛事</button>
        <button v-if="showLotteryFilters" type="button" class="tab-btn" :class="{ active: lottery === 'jc' }" @click="emit('update:lottery', 'jc')">竞彩赛事</button>
        <button type="button" class="tab-btn muted-tab">简洁版</button>
        <button type="button" class="tab-btn muted-tab">数据回查</button>
      </div>

      <div v-if="isMetricFiltered" class="metric-actions">
        <button type="button" class="classic-btn" @click="emit('clearMetric')">清除筛选</button>
      </div>
      <span v-else class="toolbar-count num">{{ count }} 场</span>
    </div>

    <div v-if="!isMetricFiltered" class="toolbar-row filters">
      <label class="classic-field">
        <span>日期</span>
        <select :value="daySeg || 'custom'" :disabled="backcheckLocked" @change="updateDay(($event.target as HTMLSelectElement).value)">
          <option v-for="option in dayOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          <option value="custom">自选</option>
        </select>
      </label>

      <label class="classic-field">
        <span>回查</span>
        <input
          type="date"
          :value="customDate"
          :min="archiveMinDate"
          :disabled="backcheckLocked"
          @input="emit('update:customDate', ($event.target as HTMLInputElement).value)"
        >
      </label>

      <label v-if="showLotteryFilters" class="classic-field">
        <span>状态</span>
        <select :value="status" @change="emit('update:status', ($event.target as HTMLSelectElement).value)">
          <option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>

      <label class="classic-field">
        <span>赛事</span>
        <select :value="lottery" @change="emit('update:lottery', ($event.target as HTMLSelectElement).value)">
          <option v-for="option in lotteryOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>

      <label class="classic-field league">
        <span>联赛</span>
        <select :value="league" @change="emit('update:league', ($event.target as HTMLSelectElement).value)">
          <option v-for="option in leagueOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
      </label>

      <button type="button" class="classic-btn icon" :disabled="pending" aria-label="刷新" @click="emit('refresh')">
        <RefreshCw :size="14" :class="{ spinning: pending }" />
        <span>刷新</span>
      </button>
    </div>

    <div class="toolbar-row tools">
      <button type="button" class="classic-btn" @click="emit('collapseAll')">收起所有</button>
      <button type="button" class="classic-btn" @click="emit('expandAll')">展开所有</button>
      <button type="button" class="classic-btn" :disabled="!hasSelection" @click="emit('pinSelected')">置前</button>
      <button type="button" class="classic-btn" :disabled="!hasSelection" @click="emit('retainSelected')">保留</button>
      <button type="button" class="classic-btn" :disabled="!hasSelection" @click="emit('deleteSelected')">删除</button>
      <button type="button" class="classic-btn" @click="emit('restore')">还原</button>

      <label class="classic-field sort">
        <span>排序</span>
        <select :value="sortMode" @change="emit('update:sortMode', ($event.target as HTMLSelectElement).value)">
          <option value="league">按赛事排序</option>
          <option value="time">按时间排序</option>
          <option value="amount">按成交量排序</option>
        </select>
      </label>

      <span v-if="selectedCount" class="selected-count num">已选 {{ selectedCount }}</span>
    </div>
  </section>
</template>

<style scoped>
.classic-toolbar {
  display: grid;
  gap: 0;
  border: 1px solid var(--classic-border);
  border-radius: var(--classic-radius);
  overflow: hidden;
  background: var(--classic-panel);
  box-shadow: var(--classic-shadow);
}

.toolbar-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border-bottom: 1px solid var(--classic-border);
}

.toolbar-row:last-child {
  border-bottom: 0;
}

.toolbar-row.main {
  justify-content: space-between;
  padding: 0;
  background: var(--classic-purple-soft);
}

.toolbar-title {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
}

.toolbar-title strong {
  color: var(--classic-text);
  font-size: 0.9rem;
}

.toolbar-count {
  align-self: center;
  padding-right: 10px;
  color: var(--classic-title-muted);
  font-size: 0.78rem;
  font-weight: 780;
}

.classic-field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: var(--classic-text);
  font-size: 0.75rem;
  font-weight: 760;
}

.classic-field.league {
  flex: 1 1 160px;
}

.classic-field.sort {
  margin-left: auto;
}

.classic-field select,
.classic-field input {
  min-width: 78px;
  height: 28px;
  padding: 0 7px;
  border: 1px solid var(--classic-border);
  border-radius: 2px;
  background: var(--classic-panel);
  color: var(--classic-text);
  font-size: 0.76rem;
  font-weight: 740;
}

.classic-field select:disabled,
.classic-field input:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.event-menu {
  width: 160px;
  height: 42px;
  border: 0;
  border-right: 1px solid var(--classic-border);
  border-radius: 0;
  background: var(--classic-purple-soft);
  color: var(--classic-text);
  font-size: 0.9rem;
  font-weight: 840;
}

.tab-btn {
  min-width: 116px;
  height: 42px;
  padding: 0 18px;
  border: 0;
  border-right: 1px solid var(--classic-border);
  background: transparent;
  color: var(--classic-text);
  font-size: 0.88rem;
  font-weight: 840;
}

.tab-btn {
  transition: background 0.12s ease, color 0.12s ease;
}

.tab-btn:hover:not(.active) {
  background: rgba(255, 255, 255, 0.45);
}

.tab-btn.active {
  background: var(--classic-panel);
  color: var(--classic-link);
  box-shadow: inset 0 -3px 0 var(--classic-green);
}

.tab-btn.muted-tab {
  color: var(--classic-text);
}

.classic-field.league select {
  width: 100%;
}

.classic-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--classic-border);
  border-radius: 2px;
  background: var(--classic-green);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 800;
}

.classic-btn.icon {
  min-width: 72px;
}

.classic-btn:hover:not(:disabled) {
  filter: brightness(1.04);
}

.classic-btn:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.selected-count {
  color: var(--classic-title-muted);
  font-size: 0.75rem;
  font-weight: 760;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
