<script setup lang="ts">
import { Lock, RefreshCw } from '@lucide/vue'
import type { MatchListFilters } from '~/composables/useMatchList'
import { backcheckMinDateForUser, isFreeMembership } from '~/utils/membership'

const route = useRoute()
const { user } = useAuth()
const routeDay = route.query.day === 'yesterday' ? 'yesterday' : 'today'
const routeLottery = ['all', 'jc', 'lottery'].includes(String(route.query.lottery)) ? String(route.query.lottery) as 'all' | 'jc' | 'lottery' : 'all'
const archiveStartDate = '2012-08-01'
const backcheckLocked = computed(() => isFreeMembership(user.value))
const archiveMinDate = computed(() => backcheckMinDateForUser(user.value))
const pad2 = (n: number) => String(n).padStart(2, '0')
const toLocalYmd = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
const isSelectableArchiveDate = (value: unknown): value is string => (
  typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && value >= archiveStartDate
)
const routeCustomDate = isSelectableArchiveDate(route.query.date) ? route.query.date : ''
// 默认「全部赛事」(含未开/已开/完场);仅保留 全部/未开 两个筛选(已移除「已开」)。?status=started 回落全部。
const routeStatus = ['upcoming', 'all'].includes(String(route.query.status))
  ? String(route.query.status) as 'upcoming' | 'all'
  : 'all'

const day = ref(routeDay)
// 状态筛选与「竞彩/足彩」拆成两组独立控件（G2/G3）
const status = ref<'upcoming' | 'started' | 'all'>(routeStatus)
const lottery = ref<'all' | 'jc' | 'lottery'>(routeLottery)
const league = ref(typeof route.query.league === 'string' ? route.query.league : 'all')
// 数据回查：自选日期，非空时覆盖「今日/昨日」
const customDate = ref(routeCustomDate)

const dayOptions = [
  { label: '今日', value: 'today' },
  { label: '昨日', value: 'yesterday' },
]

const statusOptions = [
  { label: '全部', value: 'all' },
  { label: '未开', value: 'upcoming' },
]

const lotteryOptions = [
  { label: '不限', value: 'all' },
  { label: '竞彩', value: 'jc' },
  { label: '足彩', value: 'lottery' },
]

const dayToDate = (d: string): string | undefined => {
  const now = new Date()
  // "today" = 过去 2h ~ 明天中午 12:00（后端 today-window 窗口；与今日篮球一致，不再纳入 +14 天的远期赛事）
  if (d === 'today') return 'today-window'
  if (d === 'yesterday') {
    const prev = new Date(now)
    prev.setDate(now.getDate() - 1)
    return toLocalYmd(prev)
  }
  return undefined
}

function normalizeBackcheckDate(value: string): string {
  if (!value || backcheckLocked.value) return ''
  return value < archiveMinDate.value ? archiveMinDate.value : value
}

/** 当前生效日期：自选日期优先，否则按快捷「今日/昨日」。 */
const effectiveDate = computed(() => backcheckLocked.value ? dayToDate('today') : customDate.value || dayToDate(day.value))

/** 快捷段控件：选了自选日期时不高亮今日/昨日；点今日/昨日则清空自选日期（今日即回到默认）。 */
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

watch(archiveMinDate, () => {
  const normalized = normalizeBackcheckDate(customDate.value)
  if (normalized !== customDate.value) customDate.value = normalized
}, { immediate: true })

// 回查:点选自选(过去)日期时,状态默认跳「全部赛事」(过去日期无「未开」会空)。
watch(customDate, (d) => {
  const normalized = normalizeBackcheckDate(d)
  if (normalized !== d) {
    customDate.value = normalized
    return
  }
  if (d) status.value = 'all'
})

// ── 首页异动指标点击落地：?metric=xxx&events=1,2,3 → 只显示命中的这些比赛 ──
const metricKey = computed(() => (route.query.metric as string) || '')
const isMetricFiltered = computed(() => metricKey.value !== '')
const eventIdSet = computed(() => {
  const raw = route.query.events
  const ids = (typeof raw === 'string' ? raw.split(',') : []).map(Number).filter(n => Number.isFinite(n) && n > 0)
  return new Set(ids)
})
const metricLabels: Record<string, string> = {
  'bf-volume': '必发成交 100万+',
  'poly-volume': 'POLY 成交 200K+',
  'bf-index': '必发指数 60+',
  'poly-index': 'POLY 指数 90+',
}
const metricLabel = computed(() => metricLabels[metricKey.value] ?? '今日异动')

const filters = computed<MatchListFilters>(() => {
  // 异动落地：与 dashboard 同口径（不传 date → 后端默认 -2h~+48h 窗口）+ 全部状态 + 大页，
  // 确保命中的赛事一定在结果集里，再按 eventId 客户端精筛。
  if (isMetricFiltered.value) {
    return { date: undefined, league: 'all', status: 'all', page: 1, pageSize: 200 }
  }
  return {
    date: effectiveDate.value,
    league: league.value,
    status: status.value,
    jc: lottery.value === 'jc',
    lottery: lottery.value === 'lottery',
    page: 1,
    pageSize: 50,
  }
})

const { items: matches, leagues, prematchSixHourLockApplied, pending, refresh } = useMatchList(filters)
const { isClassicDesktop } = useDesktopViewMode()

/** 异动筛选生效时只显示命中的比赛；统一按开赛时间升序（最早在前） */
const displayMatches = computed(() => {
  const list = isMetricFiltered.value
    ? matches.value.filter(m => eventIdSet.value.has(m.eventId))
    : matches.value
  return [...list].sort((a, b) => a.matchTime.localeCompare(b.matchTime))
})

/** 联赛筛选选项：「全部联赛」+ 后端实际返回的联赛代码 */
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
  if (lottery.value !== 'all') query.lottery = lottery.value
  if (league.value !== 'all') query.league = league.value
  if (typeof route.query.view === 'string' && route.query.view) query.view = route.query.view
  if (metricKey.value) {
    query.metric = metricKey.value
    if (typeof route.query.events === 'string') query.events = route.query.events
  }
  return query
})

// 筛选条件持久化:任一筛选变化即写回 URL(replace 不进历史),刷新后由顶部 route.query 初始化恢复。
// 只盯筛选 ref(navigateTo 不改这些 ref → 无回环);回调写 listReturnQuery 以一并保留 metric/events 下钻态。
watch([day, status, lottery, league, customDate], () => {
  navigateTo({ query: listReturnQuery.value }, { replace: true })
})

function detailRoute(eventId: number) {
  return { path: `/football/${eventId}`, query: listReturnQuery.value }
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
    :matches="displayMatches"
    :pending="pending"
    :archive-min-date="archiveMinDate"
    :day-options="dayOptions"
    :status-options="statusOptions"
    :lottery-options="lotteryOptions"
    :league-options="leagueOptions"
    :backcheck-locked="backcheckLocked"
    :prematch-six-hour-lock-applied="prematchSixHourLockApplied"
    :is-metric-filtered="isMetricFiltered"
    :metric-label="metricLabel"
    :detail-route="detailRoute"
    :show-flash-q="true"
    @refresh="refresh()"
    @clear-metric="navigateTo('/football')"
  />

  <div v-else :class="['football-page', { 'is-metric-filtered': isMetricFiltered }]">
    <aside v-if="!isMetricFiltered" class="filter-band">
      <div class="filter-head">
        <h2>赛事筛选</h2>
        <span class="muted num">{{ displayMatches.length }} 场</span>
      </div>

      <!-- 日期：今日/昨日 快捷 + 任选日期回查，合并一行（今日含所有未来；前日直接选日期） -->
      <div
        :class="['date-row', { locked: backcheckLocked }]"
        :title="backcheckLocked ? '当前会籍未开放回查' : undefined"
      >
        <SegmentedControl v-model="daySeg" :options="dayOptions" dense />
        <input
          v-model="customDate"
          type="date"
          class="date-input focus-ring"
          aria-label="选择日期"
          :min="archiveMinDate"
          :disabled="backcheckLocked"
        >
      </div>

      <!-- 状态 + 竞彩/足彩 + 刷新 合并一行，按钮铺满横向 -->
      <div class="filters-row">
        <SegmentedControl v-model="status" :options="statusOptions" dense />
        <SegmentedControl v-model="lottery" :options="lotteryOptions" dense />
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
      </div>
    </aside>

    <div v-if="isMetricFiltered" class="metric-filter-band">
      <div class="mf-info">
        <span class="mf-tag">异动筛选</span>
        <b>{{ metricLabel }}</b>
        <span class="muted num">· {{ displayMatches.length }} 场</span>
      </div>
      <NuxtLink to="/football" class="mf-clear focus-ring">清除筛选</NuxtLink>
    </div>

    <div class="football-main">
      <div v-if="prematchSixHourLockApplied" class="lock-banner">
        <Lock :size="13" />
        <span>免费会员已隐去赛前 6 小时内及 24 小时以外的未开赛赛事</span>
      </div>

      <section class="match-list">
        <div v-if="pending && !displayMatches.length" class="match-skeleton">
          <div v-for="i in 4" :key="i" class="skeleton-card" />
        </div>
        <MatchCard v-for="match in displayMatches" v-else :key="match.eventId" :match="match" :to="detailRoute(match.eventId)" />
        <div v-if="!pending && !displayMatches.length" class="empty" role="status">
          {{ isMetricFiltered ? '该指标暂无命中赛事（可能已开赛或不在当前窗口）' : '暂无赛事' }}
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.football-page {
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
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px;
  align-items: center;
}

/* 状态(0.9fr) + 彩种(1.1fr，"足彩"略宽) + 刷新；段控件按钮 flex:1 铺满，消除右侧留白 */
.filters-row {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr 32px;
  gap: 6px;
  align-items: center;
}

.filters-row :deep(.segmented) {
  width: 100%;
}

.filters-row :deep(.segmented-item) {
  flex: 1 1 0;
  min-width: 0;
  padding-inline: 4px;
}

.select-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
  align-items: center;
}

.date-input {
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

.date-row.locked .date-input {
  cursor: not-allowed;
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

.square-btn:active,
.filter-btn:active {
  background: var(--surface);
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

.football-main {
  display: grid;
  gap: 8px;
  min-width: 0;
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
  color: var(--warn);
  font-size: 0.74rem;
  font-weight: 720;
}

.metric-filter-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 9px 10px 0;
  padding: 8px 11px;
  border: 1px solid var(--brand-tint-strong);
  border-radius: 5px;
  background: var(--brand-tint);
  color: var(--ink);
}

.mf-info {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 0.84rem;
}

.mf-tag {
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--brand);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 800;
}

.mf-info b {
  font-weight: 800;
}

.mf-clear {
  flex: 0 0 auto;
  padding: 4px 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--brand);
  font-size: 0.76rem;
  font-weight: 760;
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
  height: 116px;
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
  .football-page {
    grid-template-columns: 260px minmax(0, 1fr);
    align-items: start;
    gap: 14px;
    width: min(100%, 1180px);
    margin: 0 auto;
    padding: 16px 0;
  }

  .football-page.is-metric-filtered {
    grid-template-columns: minmax(0, 1fr);
  }

  .filter-band {
    position: sticky;
    top: 72px;
    grid-column: 1;
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

  .football-main {
    grid-column: 2;
    gap: 10px;
  }

  .match-list {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 10px;
    padding: 0;
  }

  .lock-banner {
    width: fit-content;
    margin: 0;
  }

  .metric-filter-band {
    grid-column: 1 / -1;
    margin: 0;
  }

  .football-page.is-metric-filtered .football-main {
    grid-column: 1;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .match-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
