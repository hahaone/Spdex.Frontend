<script setup lang="ts">
import { Lock, RefreshCw } from '@lucide/vue'
import type { MatchListFilters } from '~/composables/useMatchList'

const day = ref('today')
// 状态筛选与「竞彩/胜负彩」拆成两组独立控件（G2/G3）
const status = ref<'upcoming' | 'started' | 'all'>('upcoming')
const lottery = ref<'all' | 'jc' | 'lottery'>('all')
const league = ref('all')
// 数据回查：自选日期，非空时覆盖「今日/昨日」
const customDate = ref('')

const dayOptions = [
  { label: '今日', value: 'today' },
  { label: '昨日', value: 'yesterday' },
]

const statusOptions = [
  { label: '未开', value: 'upcoming' },
  { label: '已开', value: 'started' },
  { label: '全部', value: 'all' },
]

const lotteryOptions = [
  { label: '不限', value: 'all' },
  { label: '竞彩', value: 'jc' },
  { label: '胜负彩', value: 'lottery' },
]

const dayToDate = (d: string): string | undefined => {
  const now = new Date()
  // "today" = 今日及所有未来赛事（后端 today-onward 窗口：过去 4h ~ +14 天）
  if (d === 'today') return 'today-onward'
  if (d === 'yesterday') {
    const prev = new Date(now)
    prev.setDate(now.getDate() - 1)
    return prev.toISOString().slice(0, 10)
  }
  return undefined
}

/** 当前生效日期：自选日期优先，否则按快捷「今日/昨日」。 */
const effectiveDate = computed(() => customDate.value || dayToDate(day.value))

/** 快捷段控件：选了自选日期时不高亮今日/昨日；点今日/昨日则清空自选日期（今日即回到默认）。 */
const daySeg = computed({
  get: () => (customDate.value ? '' : day.value),
  set: (v: string) => { customDate.value = ''; day.value = v },
})

// ── 首页异动指标点击落地：?metric=xxx&events=1,2,3 → 只显示命中的这些比赛 ──
const route = useRoute()
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

const { items: matches, leagues, totalCount, prematchSixHourLockApplied, pending, refresh } = useMatchList(filters)

/** 异动筛选生效时只显示命中的比赛 */
const displayMatches = computed(() => {
  if (!isMetricFiltered.value) return matches.value
  return matches.value.filter(m => eventIdSet.value.has(m.eventId))
})

/** 联赛筛选选项：「全部联赛」+ 后端实际返回的联赛代码 */
const leagueOptions = computed(() => {
  const opts = [{ label: '全部联赛', value: 'all' }]
  for (const code of leagues.value) {
    if (code) opts.push({ label: code, value: code })
  }
  return opts
})
</script>

<template>
  <div class="football-page">
    <aside v-if="!isMetricFiltered" class="filter-band">
      <div class="filter-head">
        <h2>赛事筛选</h2>
        <span class="muted num">{{ displayMatches.length }} 场</span>
      </div>

      <!-- 日期：今日/昨日 快捷 + 任选日期回查，合并一行（今日含所有未来；前日直接选日期） -->
      <div class="date-row">
        <SegmentedControl v-model="daySeg" :options="dayOptions" dense />
        <input v-model="customDate" type="date" class="date-input focus-ring" aria-label="选择日期">
      </div>

      <!-- 状态 + 竞彩/胜负彩 + 刷新 合并一行，按钮铺满横向 -->
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

    <div v-if="prematchSixHourLockApplied" class="lock-banner">
      <Lock :size="13" />
      <span>免费会员已隐去赛前 6 小时内未开赛赛事</span>
    </div>

    <section class="match-list">
      <div v-if="pending && !displayMatches.length" class="match-skeleton">
        <div v-for="i in 4" :key="i" class="skeleton-card" />
      </div>
      <MatchCard v-for="match in displayMatches" v-else :key="match.eventId" :match="match" />
      <div v-if="!pending && !displayMatches.length" class="empty">
        {{ isMetricFiltered ? '该指标暂无命中赛事（可能已开赛或不在当前窗口）' : '暂无赛事' }}
      </div>
    </section>
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

/* 状态(0.9fr) + 彩种(1.1fr，"胜负彩"略宽) + 刷新；段控件按钮 flex:1 铺满，消除右侧留白 */
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
