<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'

interface Option {
  label: string
  value: string
}

interface LeagueChip {
  code: string
  name: string
  count: number
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
  leagueChips?: LeagueChip[]
  selectedLeagues?: string[]
  backcheckLocked?: boolean
  showLotteryFilters?: boolean
  isMetricFiltered?: boolean
  metricLabel?: string
}>(), {
  backcheckLocked: false,
  showLotteryFilters: true,
  metricLabel: '',
  leagueChips: () => [],
  selectedLeagues: () => [],
})

const emit = defineEmits<{
  'update:daySeg': [value: string]
  'update:customDate': [value: string]
  'update:status': [value: string]
  'update:lottery': [value: string]
  'update:league': [value: string]
  'update:selectedLeagues': [value: string[]]
  'update:sortMode': [value: string]
  refresh: []
  clearMetric: []
  collapseAll: []
  expandAll: []
  pinSelected: []
  retainSelected: []
  deleteSelected: []
  restore: []
  resetFilters: []
}>()

const hasSelection = computed(() => props.selectedCount > 0)

function updateDay(value: string) {
  if (props.backcheckLocked) return
  if (value === 'custom') return
  emit('update:daySeg', value)
}

// ===== 赛事选择(联赛多选)弹层 =====
// 用 Teleport 挂到 body,绕开 .classic-toolbar 的 overflow:hidden 裁剪;固定定位锚定按钮下方。
const menuOpen = ref(false)
const menuBtn = ref<HTMLElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const menuPos = ref({ top: 0, left: 0 })
const draft = ref<Set<string>>(new Set())

const selectedLeagueCount = computed(() => props.selectedLeagues?.length ?? 0)

function openMenu() {
  const el = menuBtn.value
  if (!el) return
  const r = el.getBoundingClientRect()
  menuPos.value = { top: r.bottom + 4, left: r.left }
  draft.value = new Set(props.selectedLeagues ?? [])
  menuOpen.value = true
}
function closeMenu() { menuOpen.value = false }
function toggleMenu() { if (menuOpen.value) closeMenu(); else openMenu() }
function toggleLeague(code: string) {
  const next = new Set(draft.value)
  if (next.has(code)) next.delete(code)
  else next.add(code)
  draft.value = next
}
function selectAllLeagues() { draft.value = new Set((props.leagueChips ?? []).map(c => c.code)) }
function clearLeagues() { draft.value = new Set() }
function applyLeagues() {
  emit('update:selectedLeagues', [...draft.value])
  closeMenu()
}

function onMenuScroll(e: Event) {
  // 仅「页面」滚动才关闭弹层;菜单内部(联赛列表 overflow 滚动)不关闭——
  // 否则赛事多到列表需要滚动时,一滚就触发 capture 阶段 scroll 把弹层关掉、无法继续下拉。
  const t = e.target as Node | null
  if (t && menuEl.value?.contains(t)) return
  closeMenu()
}
function onMenuKey(e: KeyboardEvent) { if (e.key === 'Escape') closeMenu() }
watch(menuOpen, (open) => {
  if (!import.meta.client) return
  if (open) {
    window.addEventListener('scroll', onMenuScroll, true)
    window.addEventListener('keydown', onMenuKey)
  }
  else {
    window.removeEventListener('scroll', onMenuScroll, true)
    window.removeEventListener('keydown', onMenuKey)
  }
})
onBeforeUnmount(() => {
  if (!import.meta.client) return
  window.removeEventListener('scroll', onMenuScroll, true)
  window.removeEventListener('keydown', onMenuKey)
})
</script>

<template>
  <section class="classic-toolbar">
    <div class="toolbar-row main">
      <div class="toolbar-title">
        <button ref="menuBtn" type="button" class="event-menu" :class="{ active: menuOpen || selectedLeagueCount }" @click="toggleMenu">
          赛事选择<span v-if="selectedLeagueCount" class="em-badge num">{{ selectedLeagueCount }}</span><span class="em-caret">⌄</span>
        </button>
        <button type="button" class="tab-btn" :class="{ active: status === 'all' && lottery === 'all' }" @click="emit('update:status', 'all'); emit('update:lottery', 'all')">全部赛事</button>
        <button type="button" class="tab-btn" :class="{ active: status === 'upcoming' }" @click="emit('update:status', 'upcoming')">未开赛</button>
        <button v-if="showLotteryFilters" type="button" class="tab-btn" :class="{ active: lottery === 'lottery' }" @click="emit('update:lottery', 'lottery')">胜负彩赛事</button>
        <button v-if="showLotteryFilters" type="button" class="tab-btn" :class="{ active: lottery === 'jc' }" @click="emit('update:lottery', 'jc')">竞彩赛事</button>
      </div>

      <div v-if="isMetricFiltered" class="metric-actions">
        <button type="button" class="classic-btn" @click="emit('clearMetric')">清除筛选</button>
      </div>
      <span v-else class="toolbar-count num">{{ count }} 场</span>
    </div>

    <div class="toolbar-row controls">
      <template v-if="!isMetricFiltered">
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

        <button type="button" class="classic-btn icon" :disabled="pending" aria-label="刷新" @click="emit('refresh')">
          <RefreshCw :size="14" :class="{ spinning: pending }" />
          <span>刷新</span>
        </button>
      </template>

      <div class="tools-group">
        <button type="button" class="classic-btn" @click="emit('collapseAll')">收起所有</button>
        <button type="button" class="classic-btn" @click="emit('expandAll')">展开所有</button>
        <button type="button" class="classic-btn" :disabled="!hasSelection" @click="emit('pinSelected')">置前</button>
        <button type="button" class="classic-btn" :disabled="!hasSelection" @click="emit('retainSelected')">保留</button>
        <button type="button" class="classic-btn" :disabled="!hasSelection" @click="emit('deleteSelected')">删除</button>
        <button type="button" class="classic-btn" @click="emit('restore')">还原</button>
        <button type="button" class="classic-btn ghost" @click="emit('resetFilters')">清除筛选</button>

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
    </div>

    <Teleport to="body">
      <template v-if="menuOpen">
        <div class="league-menu-backdrop" @click="closeMenu" />
        <div ref="menuEl" class="league-menu classic-desktop" :style="{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }">
          <div class="league-menu-head">
            <span>赛事选择 · 联赛</span>
            <div class="lm-quick">
              <button type="button" @click="selectAllLeagues">全选</button>
              <button type="button" @click="clearLeagues">清空</button>
            </div>
          </div>
          <div class="league-menu-body">
            <label v-for="chip in leagueChips" :key="chip.code" class="lm-item">
              <input type="checkbox" :checked="draft.has(chip.code)" @change="toggleLeague(chip.code)">
              <span class="lm-name">{{ chip.name }}</span>
              <span class="lm-count num">{{ chip.count }}</span>
            </label>
            <div v-if="!leagueChips.length" class="lm-empty">暂无联赛</div>
          </div>
          <div class="league-menu-foot">
            <button type="button" class="lm-cancel" @click="closeMenu">关闭</button>
            <button type="button" class="lm-ok" @click="applyLeagues">确定（{{ draft.size }}）</button>
          </div>
        </div>
      </template>
    </Teleport>
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
  margin-left: 2px;
}

/* 第二行:筛选(左) + 工具(右)合并一行,优化纵向空间 */
.toolbar-row.controls {
  gap: 7px 8px;
}

.tools-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 128px;
  height: 38px;
  border: 0;
  border-right: 1px solid var(--classic-border);
  border-radius: 0;
  background: var(--classic-purple-soft);
  color: var(--classic-text);
  font-size: 0.86rem;
  font-weight: 840;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.event-menu:hover {
  background: rgba(255, 255, 255, 0.45);
}

.event-menu.active {
  background: var(--classic-panel);
  color: var(--classic-link);
}

.em-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--classic-green);
  color: #fff;
  font-size: 0.66rem;
  font-weight: 820;
}

.em-caret {
  font-size: 0.8rem;
  opacity: 0.7;
}

/* 赛事选择多选弹层(Teleport 到 body) */
.league-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
}

.league-menu {
  position: fixed;
  z-index: 1201;
  display: flex;
  flex-direction: column;
  width: 264px;
  max-height: min(60vh, 460px);
  border: 1px solid var(--classic-border);
  border-radius: 6px;
  background: var(--classic-panel);
  box-shadow: 0 12px 34px rgba(15, 23, 42, 0.22);
  overflow: hidden;
}

.league-menu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-bottom: 1px solid var(--classic-border);
  color: var(--classic-title);
  font-size: 0.78rem;
  font-weight: 860;
}

.lm-quick button {
  margin-left: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--classic-link);
  font-size: 0.74rem;
  font-weight: 800;
  cursor: pointer;
}

.lm-quick button:hover {
  text-decoration: underline;
}

.league-menu-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.lm-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  color: var(--classic-text);
  font-size: 0.78rem;
  font-weight: 720;
  cursor: pointer;
}

.lm-item:hover {
  background: var(--classic-row-hover);
}

.lm-item input {
  width: 14px;
  height: 14px;
  accent-color: var(--classic-green);
  cursor: pointer;
}

.lm-name {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.lm-count {
  color: var(--classic-title-muted);
  font-size: 0.72rem;
  font-weight: 760;
}

.lm-empty {
  padding: 18px 12px;
  color: var(--muted);
  font-size: 0.76rem;
  text-align: center;
}

.league-menu-foot {
  display: flex;
  gap: 8px;
  padding: 9px 12px;
  border-top: 1px solid var(--classic-border);
}

.league-menu-foot button {
  flex: 1;
  height: 30px;
  border-radius: 3px;
  font-size: 0.78rem;
  font-weight: 820;
  cursor: pointer;
}

.lm-cancel {
  border: 1px solid var(--classic-border);
  background: var(--classic-panel);
  color: var(--classic-text);
}

.lm-cancel:hover {
  background: var(--classic-row-hover);
}

.lm-ok {
  border: 1px solid var(--classic-green);
  background: var(--classic-green);
  color: #fff;
}

.lm-ok:hover {
  filter: brightness(1.05);
}

.tab-btn {
  min-width: 100px;
  height: 38px;
  padding: 0 14px;
  border: 0;
  border-right: 1px solid var(--classic-border);
  background: transparent;
  color: var(--classic-text);
  font-size: 0.85rem;
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

/* 「清除筛选」用中性描边样式,区别于绿色操作按钮(保留/删除等) */
.classic-btn.ghost {
  background: var(--classic-panel);
  color: var(--classic-text);
}

.classic-btn.ghost:hover:not(:disabled) {
  background: var(--classic-row-hover);
  filter: none;
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
