<script setup lang="ts">
import { ChevronLeft, ChevronRight, Filter, Lock, RefreshCw } from '@lucide/vue'
import type { MatchListFilters } from '~/composables/useMatchList'
import { isFreeMembership } from '~/utils/membership'

const route = useRoute()
const { user } = useAuth()
const routeDay = route.query.day === 'tomorrow' ? 'tomorrow' : route.query.day === 'yesterday' ? 'yesterday' : 'today'
// 默认「全部赛事」;仅保留 全部/未开 两个筛选(已移除「已开」)。?status=started 回落全部。
const routeStatus = ['upcoming', 'all'].includes(String(route.query.status)) ? String(route.query.status) as 'upcoming' | 'all' : 'all'
const archiveMinDate = '2012-08-01'
const pad2 = (n: number) => String(n).padStart(2, '0')
const toLocalYmd = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
const isSelectableArchiveDate = (value: unknown): value is string => (
  typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && value >= archiveMinDate
)
const routeCustomDate = isSelectableArchiveDate(route.query.date) ? route.query.date : ''

const day = ref(routeDay)
const status = ref<'upcoming' | 'started' | 'all'>(routeStatus)
const league = ref(typeof route.query.league === 'string' ? route.query.league : 'all')
const customDate = ref(routeCustomDate)
const lottery = ref('all')
const backcheckLocked = computed(() => isFreeMembership(user.value))

const dayOptions = [
  { label: '今日', value: 'today' },
  { label: '明日', value: 'tomorrow' },
  { label: '昨日', value: 'yesterday' },
]

const statusOptions = [
  { label: '全部', value: 'all' },
  { label: '未开', value: 'upcoming' },
]
const lotteryOptions = [{ label: '不限', value: 'all' }]

const dayToDate = (d: string): string | undefined => {
  const now = new Date()
  // "today" 走特殊时间窗：过去 4 小时 ~ 明天中午 12:00（NewSpdex 移动端定义）
  if (d === 'today') return 'today-window'
  if (d === 'tomorrow') {
    const next = new Date(now)
    next.setDate(now.getDate() + 1)
    return toLocalYmd(next)
  }
  if (d === 'yesterday') {
    const prev = new Date(now)
    prev.setDate(now.getDate() - 1)
    return toLocalYmd(prev)
  }
  return undefined
}

const effectiveDate = computed(() => backcheckLocked.value ? dayToDate('today') : customDate.value || dayToDate(day.value))

const daySeg = computed({
  get: () => (customDate.value ? '' : day.value),
  set: (v: string) => {
    if (backcheckLocked.value) return
    customDate.value = ''
    day.value = v
  },
})

watch(backcheckLocked, (locked) => {
  if (!locked) return
  customDate.value = ''
  day.value = 'today'
})

function normalizeDayForDate(ymd: string): 'today' | 'tomorrow' | 'yesterday' | null {
  const now = new Date()
  const today = toLocalYmd(now)
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (ymd === today) return 'today'
  if (ymd === toLocalYmd(tomorrow)) return 'tomorrow'
  if (ymd === toLocalYmd(yesterday)) return 'yesterday'
  return null
}

function activeDateForShift(): Date {
  if (customDate.value) return new Date(`${customDate.value}T00:00:00`)
  const value = dayToDate(day.value)
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date()
}

function shiftDay(delta: number) {
  if (backcheckLocked.value) return
  const next = activeDateForShift()
  next.setDate(next.getDate() + delta)
  const ymd = toLocalYmd(next)
  if (ymd < archiveMinDate) {
    customDate.value = archiveMinDate
    return
  }
  const shortcut = normalizeDayForDate(ymd)
  if (shortcut) {
    customDate.value = ''
    day.value = shortcut
    return
  }
  customDate.value = ymd
}

const filters = computed<MatchListFilters>(() => ({
  date: effectiveDate.value,
  league: league.value,
  status: status.value,
  sport: 'basketball',
  page: 1,
  pageSize: 50,
}))

const { items: matches, leagues, prematchSixHourLockApplied, pending, refresh } = useMatchList(filters)
const { isClassicDesktop } = useDesktopViewMode()

const leagueOptions = computed(() => {
  const opts = [{ label: '全部联赛', value: 'all' }]
  for (const code of leagues.value) {
    if (code) opts.push({ label: code, value: code })
  }
  return opts
})

const listReturnQuery = computed(() => {
  const query: Record<string, string> = {}
  if (!backcheckLocked.value && customDate.value) query.date = customDate.value
  else if (!backcheckLocked.value && day.value !== 'today') query.day = day.value
  if (status.value !== 'all') query.status = status.value
  if (league.value !== 'all') query.league = league.value
  return query
})

// 筛选条件持久化:任一筛选变化即写回 URL(replace 不进历史),刷新后由顶部 route.query 初始化恢复。
// 只盯筛选 ref(navigateTo 不改这些 ref → 无回环)。
watch([day, status, league, customDate], () => {
  navigateTo({ query: listReturnQuery.value }, { replace: true })
})

function detailRoute(eventId: number) {
  return { path: `/basketball/${eventId}`, query: listReturnQuery.value }
}
</script>

<template>
  <ClassicMatchWorkbenchList
    v-if="isClassicDesktop"
    v-model:day-seg="daySeg"
    v-model:custom-date="customDate"
    v-model:status="status"
    v-model:lottery="lottery"
    v-model:league="league"
    :matches="matches"
    :pending="pending"
    :archive-min-date="archiveMinDate"
    :day-options="dayOptions"
    :status-options="statusOptions"
    :lottery-options="lotteryOptions"
    :league-options="leagueOptions"
    :backcheck-locked="backcheckLocked"
    :prematch-six-hour-lock-applied="prematchSixHourLockApplied"
    :detail-route="detailRoute"
    :two-way="true"
    :sport="'basketball'"
    :show-flash-q="false"
    :show-lottery-filters="false"
    @refresh="refresh()"
  />

  <div v-else class="basketball-page">
    <aside class="filter-band">
      <div class="filter-head">
        <h2>今日篮球</h2>
        <span class="muted num">{{ matches.length }} 场</span>
      </div>

      <div
        :class="['date-row', { locked: backcheckLocked }]"
        :title="backcheckLocked ? '当前会籍未开放回查' : undefined"
      >
        <button class="square-btn focus-ring" aria-label="上一日" :disabled="backcheckLocked" @click="shiftDay(-1)">
          <ChevronLeft :size="16" />
        </button>
        <SegmentedControl v-model="daySeg" :options="dayOptions" dense />
        <button class="square-btn focus-ring" aria-label="下一日" :disabled="backcheckLocked" @click="shiftDay(1)">
          <ChevronRight :size="16" />
        </button>
        <input
          v-model="customDate"
          type="date"
          class="date-input focus-ring"
          aria-label="选择日期"
          :min="archiveMinDate"
          :disabled="backcheckLocked"
        >
      </div>

      <div class="status-row">
        <SegmentedControl v-model="status" :options="statusOptions" dense />
        <button class="square-btn focus-ring" aria-label="刷新" :disabled="pending" @click="refresh()">
          <RefreshCw :size="15" :class="{ spinning: pending }" />
        </button>
      </div>

      <div class="select-row">
        <select v-model="league" class="focus-ring">
          <option v-for="option in leagueOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <button class="filter-btn focus-ring">
          <Filter :size="14" />
          <span>胜负</span>
        </button>
      </div>
    </aside>

    <div v-if="prematchSixHourLockApplied" class="lock-banner">
      <Lock :size="13" />
      <span>免费会员已隐去赛前 6 小时内及 24 小时以外的未开赛赛事</span>
    </div>

    <section class="match-list">
      <div v-if="pending && !matches.length" class="match-skeleton">
        <div v-for="i in 4" :key="i" class="skeleton-card" />
      </div>
      <MatchCard
        v-for="match in matches"
        v-else
        :key="match.eventId"
        :match="match"
        :two-way="true"
        :to="detailRoute(match.eventId)"
        :show-flash-q="false"
      />
      <div v-if="!pending && !matches.length" class="empty" role="status">
        暂无赛事
      </div>
    </section>
  </div>
</template>

<style scoped>
.basketball-page {
  display: grid;
}

.filter-band {
  display: grid;
  gap: 7px;
  padding: 9px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
}

.filter-head {
  display: none;
  align-items: baseline;
  justify-content: space-between;
}

.filter-head h2 {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 820;
}

.date-row {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 32px;
  gap: 6px;
  align-items: center;
}

.date-input {
  grid-column: 1 / -1;
  width: 100%;
  min-width: 0;
  min-height: 30px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--ink);
  font-size: 0.8rem;
  font-weight: 720;
  font-variant-numeric: tabular-nums;
}

.date-row.locked {
  opacity: 0.58;
}

.date-row.locked :deep(.segmented) {
  pointer-events: none;
}

.date-row.locked .date-input,
.date-row.locked .square-btn {
  cursor: not-allowed;
}

.status-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px;
  gap: 6px;
  align-items: center;
}

.select-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
}

.square-btn,
.filter-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  gap: 4px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 740;
}

select {
  min-height: 30px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--ink);
  outline: none;
  font-size: 0.8rem;
  font-weight: 740;
  cursor: pointer;
}

.filter-btn {
  padding: 0 10px;
}

.match-list {
  display: grid;
  gap: 7px;
  padding: 9px 10px 16px;
}

.match-card-link {
  display: block;
}

.empty {
  padding: 30px 0;
  color: var(--muted);
  text-align: center;
  font-size: 0.84rem;
  font-weight: 720;
}

.lock-banner {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 8px 10px 0;
  padding: 5px 9px;
  border: 1px solid var(--away-strong);
  border-radius: 4px;
  background: var(--away-bg);
  color: #8a6212;
  font-size: 0.74rem;
  font-weight: 720;
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.match-skeleton {
  display: grid;
  gap: 7px;
}

.skeleton-card {
  height: 90px;
  border: 1px solid var(--divider);
  border-radius: 6px;
  background: linear-gradient(90deg, var(--surface) 0%, var(--divider) 50%, var(--surface) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (min-width: 1024px) {
  .basketball-page {
    grid-template-columns: 260px minmax(0, 1fr);
    align-items: start;
    gap: 16px;
    padding: 16px 0;
  }

  .filter-band {
    position: sticky;
    top: 72px;
    gap: 10px;
    padding: 14px 14px 16px;
    border: 1px solid var(--line);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(26, 34, 51, 0.05);
  }

  .filter-head {
    display: flex;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--divider);
  }

  .match-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding: 0;
  }
}

@media (min-width: 1280px) {
  .match-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .match-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
