<script setup lang="ts">
import type { MatchListResult } from '~/types/match'
import type { ApiResponse } from '~/types/api'
import { formatBfAmount, formatDateCN, formatMatchTimeSlash, formatDateTime } from '~/utils/formatters'

// --- 关注（置顶）功能 ---
const {
  pinnedItems,
  pinnedEventIds,
  isPinned,
  togglePin,
  refreshPinnedData,
  purgeExpired,
  clearAll: clearPinnedMatches,
} = usePinnedMatches()

// --- 筛选状态 ---
const selectedDate = ref('')
const selectedLeague = ref('')
const selectedStatus = ref<'upcoming' | 'started' | 'all'>('upcoming')
const currentPage = ref(1)
const pageSize = 20

// 构建查询参数（响应式）— 篮球专用
const queryParams = computed(() => ({
  date: selectedDate.value || undefined,
  league: selectedLeague.value || undefined,
  status: selectedStatus.value,
  sport: 'basketball',
  page: currentPage.value,
  pageSize,
}))

// --- API 调用 ---
const { data: response, status, refreshing, manualRefresh } = useMatchList(queryParams)

// --- 加载状态 ---
const isLoading = computed(() => status.value === 'pending' || refreshing.value)

// 解包数据
const result = computed<MatchListResult | null>(() => response.value?.data ?? null)
const apiMatches = computed(() => result.value?.items ?? [])
const leagues = computed(() => result.value?.leagues ?? [])
const totalCount = computed(() => result.value?.totalCount ?? 0)
const totalPages = computed(() => Math.ceil(totalCount.value / pageSize))

// 用最新 API 数据刷新已关注赛事的缓存，并清理过期关注
watch(apiMatches, (items) => {
  if (items.length > 0) {
    refreshPinnedData(items)
    purgeExpired()
  }
})

/**
 * 合并后的显示列表：
 * 关注的赛事始终置顶，然后是 API 返回的非关注赛事。
 */
const matches = computed(() => {
  let apiItems = apiMatches.value

  // 已开赛按开赛时间倒序
  if (selectedStatus.value === 'started') {
    apiItems = [...apiItems].sort((a, b) =>
      new Date(b.match.matchTime).getTime() - new Date(a.match.matchTime).getTime(),
    )
  }

  const ids = pinnedEventIds.value
  if (ids.size === 0) return apiItems

  const apiPinned: typeof apiItems = []
  const apiNormal: typeof apiItems = []
  const apiIdSet = new Set<number>()
  for (const item of apiItems) {
    apiIdSet.add(item.match.eventId)
    if (ids.has(item.match.eventId)) {
      apiPinned.push(item)
    }
    else {
      apiNormal.push(item)
    }
  }

  const extraPinned = pinnedItems.value.filter(
    item => !apiIdSet.has(item.match.eventId),
  )

  return [...apiPinned, ...extraPinned, ...apiNormal]
})

// --- 事件处理 ---
function onLeagueChange(league: string) {
  selectedLeague.value = league
  currentPage.value = 1
}

function isToday(dateStr: string): boolean {
  if (!dateStr) return true
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return dateStr === `${yyyy}-${mm}-${dd}`
}

function onDateChange(date: string) {
  selectedDate.value = date
  selectedLeague.value = ''
  currentPage.value = 1
  clearPinnedMatches()
  if (!date || isToday(date)) {
    selectedStatus.value = 'upcoming'
  } else {
    selectedStatus.value = 'all'
  }
}

function onStatusChange(status: 'upcoming' | 'started' | 'all') {
  selectedStatus.value = status
  selectedLeague.value = ''
  currentPage.value = 1
}

function shiftDate(days: number) {
  const base = selectedDate.value ? new Date(selectedDate.value) : new Date()
  base.setDate(base.getDate() + days)
  const yyyy = base.getFullYear()
  const mm = String(base.getMonth() + 1).padStart(2, '0')
  const dd = String(base.getDate()).padStart(2, '0')
  onDateChange(`${yyyy}-${mm}-${dd}`)
}

const formatMatchTime = formatMatchTimeSlash

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

const pageRange = computed(() => {
  const pages: number[] = []
  const start = Math.max(1, currentPage.value - 4)
  const end = Math.min(totalPages.value, currentPage.value + 4)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

// 篮球明细链接：仅大小和亚盘
const detailLinks = [
  { path: 'bk/uo', label: 'OU', title: '大小', color: '#556b2f' },
  { path: 'bk/handicap', label: '亚', title: '亚盘', color: '#8a2be2' },
]
</script>

<template>
  <div class="match-page">
    <!-- 筛选栏 -->
    <div class="filter-bar">
      <div class="filter-group date-picker-group">
        <label>日期</label>
        <div class="date-picker-wrap">
          <button class="date-nav-btn" title="前一天" @click="shiftDate(-1)">
            &lsaquo;
          </button>
          <input
            type="date"
            :value="selectedDate"
            min="2018-08-01"
            lang="zh-CN"
            @change="onDateChange(($event.target as HTMLInputElement).value)"
          >
          <button class="date-nav-btn" title="后一天" @click="shiftDate(1)">
            &rsaquo;
          </button>
          <button class="date-today-btn" title="回到今天" @click="onDateChange('')">
            今天
          </button>
        </div>
        <span v-if="selectedDate" class="date-display">{{ formatDateCN(selectedDate) }}</span>
      </div>
      <div class="filter-group status-group">
        <button
          :class="['status-btn', { active: selectedStatus === 'upcoming' }]"
          @click="onStatusChange('upcoming')"
        >未开赛</button>
        <button
          :class="['status-btn', { active: selectedStatus === 'started' }]"
          @click="onStatusChange('started')"
        >已开赛</button>
        <button
          :class="['status-btn', { active: selectedStatus === 'all' }]"
          @click="onStatusChange('all')"
        >全部</button>
      </div>
      <div class="filter-group">
        <label>联赛</label>
        <select
          :value="selectedLeague"
          @change="onLeagueChange(($event.target as HTMLSelectElement).value)"
        >
          <option value="">
            全部
          </option>
          <option v-for="lg in leagues" :key="lg" :value="lg">
            {{ lg }}
          </option>
        </select>
      </div>
      <div class="filter-actions">
        <button
          class="refresh-btn"
          :disabled="isLoading"
          title="刷新数据"
          @click="manualRefresh"
        >
          <span class="refresh-icon" :class="{ spinning: isLoading }">&#8635;</span>
          刷新
        </button>
      </div>
      <div class="filter-info">
        <span v-if="isLoading" class="badge loading">加载中...</span>
        <span v-else class="badge count">{{ totalCount }} 场赛事</span>
      </div>
    </div>

    <!-- 赛事表格 -->
    <div class="table-wrap" :class="{ 'is-loading': isLoading }">
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner" />
        <span>数据加载中...</span>
      </div>
      <table class="match-table">
        <thead>
          <tr>
            <th class="col-pin">关注</th>
            <th class="col-league">联赛</th>
            <th class="col-time">开赛时间</th>
            <th class="col-teams">对阵</th>
            <th class="col-asian">亚盘总成交</th>
            <th class="col-score">比分</th>
            <th class="col-detail">明细</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="matches.length === 0">
            <td colspan="7" class="empty">
              {{ status === 'pending' ? '加载中...' : '暂无赛事数据' }}
            </td>
          </tr>
          <tr v-for="item in matches" :key="item.match.eventId" :class="{ 'row-pinned': isPinned(item.match.eventId) }">
            <td class="col-pin">
              <button
                class="pin-btn"
                :class="{ active: isPinned(item.match.eventId) }"
                :title="isPinned(item.match.eventId) ? '取消关注' : '关注赛事'"
                @click="togglePin(item)"
              >
                &#9733;
              </button>
            </td>
            <td class="col-league">
              <span class="league-tag">{{ item.match.sortName }}</span>
            </td>
            <td class="col-time">
              {{ formatMatchTime(item.match.matchTime) }}
            </td>
            <td class="col-teams">
              <span class="team-home">{{ item.match.homeTeam }}</span>
              <span class="team-vs">vs</span>
              <span class="team-away">{{ item.match.guestTeam }}</span>
            </td>
            <td class="col-asian">
              {{ formatBfAmount(item.asianAmount) }}
            </td>
            <td class="col-score">
              <span class="score">{{ item.match.final || '-' }}</span>
              <span v-if="item.match.half" class="half">({{ item.match.half }})</span>
            </td>
            <td class="col-detail">
              <div class="detail-links">
                <NuxtLink
                  v-for="link in detailLinks"
                  :key="link.path"
                  :to="`/${link.path}/details?id=${item.match.eventId}`"
                  :title="link.title"
                  class="detail-btn"
                  :style="{ backgroundColor: link.color }"
                  target="_blank"
                >
                  {{ link.label }}
                </NuxtLink>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="pagination">
      <button :disabled="currentPage <= 1" @click="goToPage(1)">首页</button>
      <button :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">上一页</button>
      <button
        v-for="p in pageRange"
        :key="p"
        :class="{ active: p === currentPage }"
        @click="goToPage(p)"
      >
        {{ p }}
      </button>
      <button :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">下一页</button>
      <button :disabled="currentPage >= totalPages" @click="goToPage(totalPages)">尾页</button>
    </div>
  </div>
</template>

<style scoped>
.match-page {
  max-width: 100%;
}

/* --- 筛选栏 --- */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.75rem 1rem;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-group label {
  font-size: 0.9rem;
  color: #666;
  white-space: nowrap;
}

.filter-group input,
.filter-group select {
  padding: 0.4rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.9rem;
  background: #fff;
}

.date-picker-group { flex-wrap: wrap; }
.date-picker-wrap { display: flex; align-items: center; gap: 2px; }
.date-picker-wrap input[type="date"] {
  padding: 0.4rem 0.6rem; border: 1px solid #d1d5db; border-radius: 4px;
  font-size: 0.9rem; background: #fff;
}

.date-nav-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 30px; border: 1px solid #d1d5db; border-radius: 4px;
  background: #fff; font-size: 1.1rem; font-weight: 600; color: #475569;
  cursor: pointer; transition: all 0.15s;
}
.date-nav-btn:hover { background: #f1f5f9; border-color: #94a3b8; color: #1e40af; }

.date-today-btn {
  padding: 0.35rem 0.55rem; border: 1px solid #d1d5db; border-radius: 4px;
  background: #fff; font-size: 0.85rem; color: #475569; cursor: pointer;
  margin-left: 2px; transition: all 0.15s;
}
.date-today-btn:hover { background: #dbeafe; border-color: #93c5fd; color: #1e40af; }

.date-display { font-size: 0.88rem; color: #64748b; margin-left: 0.5rem; white-space: nowrap; }

.status-group { display: flex; gap: 0; }
.status-btn {
  padding: 0.35rem 0.7rem; border: 1px solid #d1d5db; background: #fff;
  font-size: 0.85rem; color: #475569; cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.status-btn:first-child { border-radius: 4px 0 0 4px; }
.status-btn:last-child { border-radius: 0 4px 4px 0; }
.status-btn:not(:first-child) { border-left: none; }
.status-btn:hover:not(.active) { background: #f1f5f9; color: #1e40af; }
.status-btn.active { background: #1e40af; color: #fff; border-color: #1e40af; }
.status-btn.active + .status-btn { border-left-color: #1e40af; }

.filter-actions { display: flex; align-items: center; }
.refresh-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.4rem 0.7rem; border: 1px solid #d1d5db; border-radius: 4px;
  background: #fff; font-size: 0.88rem; color: #475569; cursor: pointer; transition: all 0.15s;
}
.refresh-btn:hover:not(:disabled) { background: #f0fdf4; border-color: #86efac; color: #166534; }
.refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.refresh-icon { font-size: 1rem; display: inline-block; }
.refresh-icon.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.table-wrap { position: relative; overflow-x: auto; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
.table-wrap.is-loading table { opacity: 0.4; pointer-events: none; transition: opacity 0.2s; }
.loading-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 0.75rem; z-index: 10;
  background: rgba(255,255,255,0.5); border-radius: 8px; min-height: 120px;
}
.loading-overlay span { font-size: 0.9rem; color: #64748b; }
.loading-spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.7s linear infinite; }

.filter-info { margin-left: auto; }
.badge { font-size: 0.9rem; padding: 0.25rem 0.75rem; border-radius: 12px; font-weight: 500; }
.badge.loading { background: #fef3c7; color: #92400e; }
.badge.count { background: #dbeafe; color: #1e40af; }

/* --- 表格 --- */
.match-table { width: 100%; min-width: 800px; border-collapse: collapse; font-size: 0.9rem; }
.match-table thead { background: #f8fafc; }
.match-table th {
  padding: 0.6rem 0.75rem; text-align: left; font-weight: 600; color: #475569;
  border-bottom: 2px solid #e2e8f0; white-space: nowrap;
}
.match-table td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.match-table tbody tr:hover { background: #f8fafc; }

.col-pin { width: 36px; text-align: center; }
.pin-btn {
  background: none; border: none; font-size: 1.1rem; color: #d1d5db; cursor: pointer;
  padding: 0; line-height: 1; transition: color 0.15s, transform 0.15s;
}
.pin-btn:hover { color: #facc15; transform: scale(1.2); }
.pin-btn.active { color: #f59e0b; }
.row-pinned { background: #fffbeb; }
.row-pinned:hover { background: #fef3c7 !important; }

.col-league { width: 90px; }
.col-time { width: 110px; white-space: nowrap; }
.col-teams { min-width: 200px; }
.col-asian { width: 80px; text-align: right; white-space: nowrap; }
.col-score { width: 90px; white-space: nowrap; }
.col-detail { width: 80px; white-space: nowrap; }

.league-tag {
  display: inline-block; padding: 0.15rem 0.5rem; background: #f1f5f9;
  border-radius: 4px; font-size: 0.9rem; color: #475569; white-space: nowrap;
}
.team-home { font-weight: 500; }
.team-vs { color: #94a3b8; margin: 0 0.35rem; font-size: 0.85rem; }
.team-away { color: #475569; }
.score { font-weight: 600; color: #1e40af; }
.half { font-size: 0.88rem; color: #94a3b8; margin-left: 0.25rem; }
.empty { text-align: center; padding: 2rem !important; color: #94a3b8; }

.detail-links { display: flex; gap: 4px; flex-wrap: nowrap; }
.detail-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 24px; height: 20px; padding: 0 4px; border-radius: 3px;
  color: #fff; font-size: 0.78rem; font-weight: 600; text-decoration: none;
  opacity: 0.8; transition: opacity 0.15s, transform 0.15s; line-height: 1;
}
.detail-btn:hover { opacity: 1; transform: scale(1.15); }

/* --- 分页 --- */
.pagination {
  display: flex; justify-content: center; gap: 0.35rem; margin-top: 1rem; flex-wrap: wrap;
}
.pagination button {
  padding: 0.35rem 0.7rem; border: 1px solid #d1d5db; border-radius: 4px;
  background: #fff; font-size: 0.9rem; cursor: pointer; color: #374151; transition: all 0.15s;
}
.pagination button:hover:not(:disabled):not(.active) { background: #f3f4f6; border-color: #9ca3af; }
.pagination button.active { background: #1e40af; color: #fff; border-color: #1e40af; }
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
