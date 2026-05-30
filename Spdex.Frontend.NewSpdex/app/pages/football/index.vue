<script setup lang="ts">
import { ChevronLeft, ChevronRight, Filter, Lock, RefreshCw } from '@lucide/vue'
import type { MatchListFilters } from '~/composables/useMatchList'

const day = ref('today')
const status = ref<'upcoming' | 'started' | 'all' | 'jc'>('upcoming')
const league = ref('all')

const dayOptions = [
  { label: '今日', value: 'today' },
  { label: '明日', value: 'tomorrow' },
  { label: '昨日', value: 'yesterday' },
]

const statusOptions = [
  { label: '未开', value: 'upcoming' },
  { label: '已开', value: 'started' },
  { label: '全部', value: 'all' },
  { label: '竞彩', value: 'jc' },
]

const dayToDate = (d: string): string | undefined => {
  const now = new Date()
  // "today" 走特殊时间窗：过去 4 小时 ~ 明天中午 12:00（NewSpdex 移动端定义）
  if (d === 'today') return 'today-window'
  if (d === 'tomorrow') {
    const next = new Date(now)
    next.setDate(now.getDate() + 1)
    return next.toISOString().slice(0, 10)
  }
  if (d === 'yesterday') {
    const prev = new Date(now)
    prev.setDate(now.getDate() - 1)
    return prev.toISOString().slice(0, 10)
  }
  return undefined
}

const filters = computed<MatchListFilters>(() => ({
  date: dayToDate(day.value),
  league: league.value,
  status: status.value,
  page: 1,
  pageSize: 50,
}))

const { items: matches, leagues, totalCount, prematchSixHourLockApplied, pending, refresh } = useMatchList(filters)

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
    <aside class="filter-band">
      <div class="filter-head">
        <h2>赛事筛选</h2>
        <span class="muted num">{{ matches.length }} 场</span>
      </div>

      <div class="date-row">
        <button class="square-btn focus-ring" aria-label="上一日">
          <ChevronLeft :size="16" />
        </button>
        <SegmentedControl v-model="day" :options="dayOptions" dense />
        <button class="square-btn focus-ring" aria-label="下一日">
          <ChevronRight :size="16" />
        </button>
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
      <span>免费会员已隐去赛前 6 小时内未开赛赛事</span>
    </div>

    <section class="match-list">
      <div v-if="pending && !matches.length" class="match-skeleton">
        <div v-for="i in 4" :key="i" class="skeleton-card" />
      </div>
      <MatchCard v-for="match in matches" v-else :key="match.eventId" :match="match" />
      <div v-if="!pending && !matches.length" class="empty">
        暂无赛事
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
  grid-template-columns: 32px minmax(0, 1fr) 32px;
  gap: 6px;
  align-items: center;
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
