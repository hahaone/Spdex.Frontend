<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { MatchSummary } from '~/types/match'

interface Option {
  label: string
  value: string
}

type SortMode = 'league' | 'time' | 'amount'
type LotterySort = 'jc' | 'lottery'

const props = defineProps<{
  matches: MatchSummary[]
  pending: boolean
  initialLoading?: boolean
  archiveMinDate: string
  daySeg: string
  customDate: string
  status: string
  lottery: string
  league: string
  dayOptions: Option[]
  statusOptions: Option[]
  lotteryOptions: Option[]
  leagueOptions: Option[]
  backcheckLocked?: boolean
  twoWay?: boolean
  sport?: 'football' | 'basketball'
  showFlashQ?: boolean
  showLotteryFilters?: boolean
  prematchSixHourLockApplied?: boolean
  isMetricFiltered?: boolean
  metricLabel?: string
  detailRoute: (eventId: number) => RouteLocationRaw
}>()

const emit = defineEmits<{
  'update:daySeg': [value: string]
  'update:customDate': [value: string]
  'update:status': [value: string]
  'update:lottery': [value: string]
  'update:league': [value: string]
  refresh: []
  clearMetric: []
}>()

const selectedIds = ref<Set<number>>(new Set())
const collapsedIds = ref<Set<number>>(new Set())
const pinnedIds = ref<Set<number>>(new Set())
const deletedIds = ref<Set<number>>(new Set())
const retainedIds = ref<Set<number>>(new Set())
const sortMode = ref<SortMode>('time')
// 联赛多选(客户端筛选):空数组 = 全部联赛。由工具栏「赛事选择」面板维护。
const selectedLeagues = ref<string[]>([])

const selectedCount = computed(() => selectedIds.value.size)
const activeLotterySort = computed<LotterySort | null>(() => lotterySortOf(props.lottery))
const isListLoading = computed(() => Boolean(props.initialLoading || (props.pending && !props.matches.length)))
const toolbarPending = computed(() => Boolean(props.pending || props.initialLoading))

const activeIds = computed(() => new Set(props.matches.map(match => match.eventId)))

watch(activeIds, (ids) => {
  selectedIds.value = intersectSet(selectedIds.value, ids)
  collapsedIds.value = intersectSet(collapsedIds.value, ids)
  pinnedIds.value = intersectSet(pinnedIds.value, ids)
  deletedIds.value = intersectSet(deletedIds.value, ids)
  retainedIds.value = intersectSet(retainedIds.value, ids)
})

// 「赛事选择」多选面板可选项:取当前窗口比赛去重,带场次计数,按场次降序。
const leagueChips = computed(() => {
  const map = new Map<string, { code: string, name: string, count: number }>()
  for (const m of props.matches) {
    const code = m.leagueCode || m.leagueName
    if (!code) continue
    const cur = map.get(code)
    if (cur) cur.count++
    else map.set(code, { code, name: m.leagueName || code, count: 1 })
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
})

const visibleMatches = computed(() => {
  const hasRetained = retainedIds.value.size > 0
  const leagueSet = selectedLeagues.value.length ? new Set(selectedLeagues.value) : null
  const base = props.matches.filter((match) => {
    if (deletedIds.value.has(match.eventId)) return false
    if (hasRetained && !retainedIds.value.has(match.eventId)) return false
    if (leagueSet && !leagueSet.has(match.leagueCode || match.leagueName)) return false
    return true
  })

  const sorted = [...base].sort((a, b) => {
    const pinnedDelta = Number(pinnedIds.value.has(b.eventId)) - Number(pinnedIds.value.has(a.eventId))
    if (pinnedDelta !== 0) return pinnedDelta

    const lotterySort = activeLotterySort.value
    if (sortMode.value === 'time') return compareByTime(a, b)
    if (sortMode.value === 'amount') {
      const amountDelta = (b.bfAmount ?? 0) - (a.bfAmount ?? 0)
      return amountDelta || (lotterySort ? compareByLotteryOrder(a, b, lotterySort) : compareByTime(a, b))
    }

    if (lotterySort) return compareByLotteryOrder(a, b, lotterySort)

    const leagueDelta = (a.leagueCode || a.leagueName).localeCompare(b.leagueCode || b.leagueName)
    return leagueDelta || compareByTime(a, b)
  })

  return sorted
})

// 旧站式分页:把当前页赛事块数压到 PAGE_SIZE,从而把「视口懒加载详情/图表」的并发也一并压住。
const PAGE_SIZE = 5
const page = ref(1)
const pageCount = computed(() => Math.max(1, Math.ceil(visibleMatches.value.length / PAGE_SIZE)))
const pagedMatches = computed(() => visibleMatches.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const pageList = computed(() => Array.from({ length: pageCount.value }, (_, i) => i + 1))
watch(pageCount, (n) => { if (page.value > n) page.value = n })
watch(sortMode, () => { page.value = 1 })
watch(() => props.lottery, (lottery) => {
  applyLotteryDefaultSort(lottery)
  page.value = 1
}, { immediate: true })
watch(selectedLeagues, () => { page.value = 1 })
// 数据切换(改日期/刷新)后,剔除已不在结果集中的联赛选择,避免残留筛选导致空列表(与 selectedIds 收敛口径一致)。
watch(leagueChips, (chips) => {
  if (!selectedLeagues.value.length) return
  const avail = new Set(chips.map(c => c.code))
  const next = selectedLeagues.value.filter(code => avail.has(code))
  if (next.length !== selectedLeagues.value.length) selectedLeagues.value = next
})
function goPage(p: number) {
  page.value = Math.min(pageCount.value, Math.max(1, p))
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

function intersectSet(source: Set<number>, available: Set<number>): Set<number> {
  return new Set([...source].filter(id => available.has(id)))
}

function isSortMode(value: unknown): value is SortMode {
  return value === 'league' || value === 'time' || value === 'amount'
}

function lotterySortOf(value: string): LotterySort | null {
  const kind = value.split(':')[0]
  return kind === 'jc' || kind === 'lottery' ? kind : null
}

function sortableLotteryNumber(value: number | undefined): number {
  return typeof value === 'number' && value > 0 ? value : Number.MAX_SAFE_INTEGER
}

function compareByTime(a: MatchSummary, b: MatchSummary): number {
  return a.matchTime.localeCompare(b.matchTime) || a.eventId - b.eventId
}

function compareByLotteryOrder(a: MatchSummary, b: MatchSummary, lottery: LotterySort): number {
  const issueA = sortableLotteryNumber(lottery === 'jc' ? a.jcIssue : a.sfcIssue)
  const issueB = sortableLotteryNumber(lottery === 'jc' ? b.jcIssue : b.sfcIssue)
  if (issueA !== issueB) return issueA - issueB

  const orderA = sortableLotteryNumber(lottery === 'jc' ? a.jcOrder : a.sfcOrder)
  const orderB = sortableLotteryNumber(lottery === 'jc' ? b.jcOrder : b.sfcOrder)
  if (orderA !== orderB) return orderA - orderB

  return compareByTime(a, b)
}

function applyLotteryDefaultSort(lottery: string) {
  if (lotterySortOf(lottery) && sortMode.value === 'time') sortMode.value = 'league'
}

function setSortMode(value: string) {
  if (isSortMode(value)) sortMode.value = value
}

function setWithToggle(source: Set<number>, id: number): Set<number> {
  const next = new Set(source)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

function toggleSelected(eventId: number) {
  selectedIds.value = setWithToggle(selectedIds.value, eventId)
}

function toggleCollapsed(eventId: number) {
  collapsedIds.value = setWithToggle(collapsedIds.value, eventId)
}

function collapseAll() {
  collapsedIds.value = new Set(visibleMatches.value.map(match => match.eventId))
}

function expandAll() {
  collapsedIds.value = new Set()
}

function pinSelected() {
  pinnedIds.value = new Set([...pinnedIds.value, ...selectedIds.value])
}

function retainSelected() {
  retainedIds.value = new Set(selectedIds.value)
}

function deleteSelected() {
  deletedIds.value = new Set([...deletedIds.value, ...selectedIds.value])
  selectedIds.value = new Set()
}

function restore() {
  selectedIds.value = new Set()
  collapsedIds.value = new Set()
  pinnedIds.value = new Set()
  deletedIds.value = new Set()
  retainedIds.value = new Set()
}

// 清除筛选/重置列表:清空工作台选择(勾选/保留/删除/置前/收起)+ 赛事选择联赛 + 排序回默认,
// 并把顶部状态/赛事下拉回默认;保留当前日期/回查。localStorage(下方 watch)与 URL(父页 watch)随之清空。
function resetFilters() {
  restore()
  selectedLeagues.value = []
  sortMode.value = 'time'
  page.value = 1
  emit('update:status', 'all')
  emit('update:lottery', 'all')
  emit('update:league', 'all')
}

// 经典工作台编辑状态持久化:保留/删除/置前/收起/排序/联赛多选 → localStorage(按运动分键),刷新后恢复。
// 只存 eventId/联赛码;换日期或隔天的陈旧 ID 由上方 watch(activeIds)/watch(leagueChips) 自动剔除,无需在此判活。
const workbenchStorageKey = `spdex:classic-wb:${props.sport ?? 'football'}`

onMounted(() => {
  try {
    const raw = localStorage.getItem(workbenchStorageKey)
    if (!raw) return
    const s = JSON.parse(raw) as Record<string, unknown>
    const toIdSet = (v: unknown) =>
      new Set((Array.isArray(v) ? v : []).filter((x): x is number => typeof x === 'number'))
    selectedIds.value = toIdSet(s.selected)
    retainedIds.value = toIdSet(s.retained)
    deletedIds.value = toIdSet(s.deleted)
    pinnedIds.value = toIdSet(s.pinned)
    collapsedIds.value = toIdSet(s.collapsed)
    if (Array.isArray(s.leagues))
      selectedLeagues.value = s.leagues.filter((x): x is string => typeof x === 'string')
    if (isSortMode(s.sort)) sortMode.value = s.sort
    applyLotteryDefaultSort(props.lottery)
  } catch { /* 损坏的存储忽略 */ }
})

watch([selectedIds, retainedIds, deletedIds, pinnedIds, collapsedIds, selectedLeagues, sortMode], () => {
  if (!import.meta.client) return
  try {
    localStorage.setItem(workbenchStorageKey, JSON.stringify({
      selected: [...selectedIds.value],
      retained: [...retainedIds.value],
      deleted: [...deletedIds.value],
      pinned: [...pinnedIds.value],
      collapsed: [...collapsedIds.value],
      leagues: selectedLeagues.value,
      sort: sortMode.value,
    }))
  } catch { /* 配额/隐私模式忽略 */ }
})
</script>

<template>
  <div class="classic-workbench">
    <ClassicMatchToolbar
      :count="visibleMatches.length"
      :pending="toolbarPending"
      :selected-count="selectedCount"
      :archive-min-date="archiveMinDate"
      :day-seg="daySeg"
      :custom-date="customDate"
      :status="status"
      :lottery="lottery"
      :league="league"
      :sort-mode="sortMode"
      :day-options="dayOptions"
      :status-options="statusOptions"
      :lottery-options="lotteryOptions"
      :league-options="leagueOptions"
      :league-chips="leagueChips"
      :selected-leagues="selectedLeagues"
      :backcheck-locked="backcheckLocked"
      :show-lottery-filters="showLotteryFilters !== false"
      :is-metric-filtered="isMetricFiltered"
      :metric-label="metricLabel"
      @update:day-seg="emit('update:daySeg', $event)"
      @update:custom-date="emit('update:customDate', $event)"
      @update:status="emit('update:status', $event)"
      @update:lottery="emit('update:lottery', $event)"
      @update:league="emit('update:league', $event)"
      @update:selected-leagues="selectedLeagues = $event"
      @update:sort-mode="setSortMode"
      @refresh="emit('refresh')"
      @clear-metric="emit('clearMetric')"
      @collapse-all="collapseAll"
      @expand-all="expandAll"
      @pin-selected="pinSelected"
      @retain-selected="retainSelected"
      @delete-selected="deleteSelected"
      @restore="restore"
      @reset-filters="resetFilters"
    />

    <div v-if="prematchSixHourLockApplied" class="classic-lock">
      免费会员已隐去赛前 6 小时内及 24 小时以外的未开赛赛事
    </div>

    <div v-if="isListLoading" class="classic-loading" role="status" aria-live="polite">
      <div class="classic-loading-inner">
        <strong>加载赛事中</strong>
        <span>正在读取赛事列表，请稍候</span>
      </div>
      <div class="classic-loading-lines" aria-hidden="true">
        <span v-for="i in 5" :key="i" />
      </div>
    </div>

    <div v-else-if="!visibleMatches.length" class="classic-empty">
      {{ isMetricFiltered ? '该指标暂无命中赛事' : '暂无赛事' }}
    </div>

    <div v-else class="classic-list">
      <ClassicMatchWorkbenchCard
        v-for="match in pagedMatches"
        :key="match.eventId"
        :match="match"
        :selected="selectedIds.has(match.eventId)"
        :collapsed="collapsedIds.has(match.eventId)"
        :detail-to="detailRoute(match.eventId)"
        :two-way="twoWay"
        :sport="sport ?? 'football'"
        :show-flash-q="showFlashQ !== false"
        @toggle-selected="toggleSelected"
        @toggle-collapsed="toggleCollapsed"
      />
    </div>

    <nav v-if="pageCount > 1" class="classic-pager" aria-label="赛事分页">
      <button type="button" class="pager-btn" :disabled="page <= 1" @click="goPage(page - 1)">上一页</button>
      <button
        v-for="p in pageList"
        :key="p"
        type="button"
        :class="['pager-num', { active: p === page }]"
        @click="goPage(p)"
      >
        {{ p }}
      </button>
      <button type="button" class="pager-btn" :disabled="page >= pageCount" @click="goPage(page + 1)">下一页</button>
    </nav>
  </div>
</template>

<style scoped>
.classic-workbench {
  display: grid;
  gap: 10px;
  width: 100%;
  margin: 0 auto;
  padding: 12px 0 24px;
  background: var(--classic-bg);
}

.classic-list {
  display: grid;
  gap: 12px;
}

.classic-lock {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--away-strong);
  background: var(--away-bg);
  color: var(--warn);
  font-size: 0.76rem;
  font-weight: 780;
}

.classic-empty {
  min-height: 120px;
  display: grid;
  place-items: center;
  border: 1px solid var(--classic-border);
  background: var(--classic-panel);
  color: var(--classic-title-muted);
  font-size: 0.86rem;
  font-weight: 780;
}

.classic-loading {
  min-height: 360px;
  display: grid;
  place-items: center;
  gap: 14px;
  padding: 42px 16px;
  border: 1px solid var(--classic-border);
  background: var(--classic-panel);
  color: var(--classic-title-muted);
}

.classic-loading-inner {
  display: grid;
  gap: 6px;
  justify-items: center;
}

.classic-loading-inner strong {
  color: var(--classic-text);
  font-size: 0.9rem;
  font-weight: 860;
}

.classic-loading-inner span {
  font-size: 0.78rem;
  font-weight: 760;
}

.classic-loading-lines {
  display: grid;
  width: min(560px, 82%);
  gap: 8px;
}

.classic-loading-lines span {
  height: 10px;
  border-radius: 2px;
  background: var(--classic-grid);
}

.classic-loading-lines span:nth-child(2) {
  width: 86%;
}

.classic-loading-lines span:nth-child(3) {
  width: 74%;
}

.classic-loading-lines span:nth-child(4) {
  width: 92%;
}

.classic-loading-lines span:nth-child(5) {
  width: 66%;
}

.classic-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 0 2px;
}

.pager-btn,
.pager-num {
  min-width: 30px;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--classic-border);
  border-radius: 2px;
  background: var(--classic-panel);
  color: var(--classic-text);
  font-size: 0.78rem;
  font-weight: 760;
}

.pager-num.active {
  background: var(--classic-green);
  border-color: var(--classic-green);
  color: #fff;
}

.pager-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
