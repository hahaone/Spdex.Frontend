<script setup lang="ts">
import type { MatchListResult, ApiResponse } from '~/types/match'
import { formatMoney, formatBfAmount, formatDateCN, formatMatchTimeSlash, formatDateTime } from '~/utils/formatters'

// --- 筛选状态 ---
const selectedDate = ref('')
const selectedLeague = ref('')
const currentPage = ref(1)
const pageSize = 20

// 构建查询参数（响应式）
const queryParams = computed(() => ({
  date: selectedDate.value || undefined,
  league: selectedLeague.value || undefined,
  page: currentPage.value,
  pageSize,
}))

// --- API 调用 ---
const { data: response, status, refreshing, manualRefresh } = useMatchList(queryParams)

// --- 加载状态（参数变化或手动刷新） ---
const isLoading = computed(() => status.value === 'pending' || refreshing.value)

// 解包数据
const result = computed<MatchListResult | null>(() => response.value?.data ?? null)
const matches = computed(() => result.value?.items ?? [])
const leagues = computed(() => result.value?.leagues ?? [])
const totalCount = computed(() => result.value?.totalCount ?? 0)
const totalPages = computed(() => Math.ceil(totalCount.value / pageSize))

// --- 事件处理 ---
function onLeagueChange(league: string) {
  selectedLeague.value = league
  currentPage.value = 1
}

function onDateChange(date: string) {
  selectedDate.value = date
  selectedLeague.value = ''
  currentPage.value = 1
}

/** 日期前后切换 */
function shiftDate(days: number) {
  const base = selectedDate.value ? new Date(selectedDate.value) : new Date()
  base.setDate(base.getDate() + days)
  const yyyy = base.getFullYear()
  const mm = String(base.getMonth() + 1).padStart(2, '0')
  const dd = String(base.getDate()).padStart(2, '0')
  onDateChange(`${yyyy}-${mm}-${dd}`)
}

// 格式化函数 → 已移至 ~/utils/formatters.ts
// 保留 formatMatchTime 别名兼容模板调用
const formatMatchTime = formatMatchTimeSlash

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

// 最大单注列表单元格摘要（简短显示在表格中）
function formatMaxBetSummary(item: typeof matches.value[0]): string {
  if (!item.maxBet) return ''
  const amount = formatMoney(item.maxBet)
  const per = item.maxBetPercent.toFixed(0)
  const attr = item.maxBetAttr || '-'
  const selection = item.maxBetSelection || '-'
  return `${amount} (${per}%, ${attr}) ${selection}`
}

// 最大单注赔率低于2时标红（与旧站 lastPrice < 2 逻辑一致）
function isMaxBetHighlight(item: typeof matches.value[0]): boolean {
  return item.maxBet > 0 && item.maxBetOdds > 0 && item.maxBetOdds < 2
}

// --- 最大单注弹窗（定位在点击元素附近） ---
const maxBetPopover = ref<{
  visible: boolean
  item: typeof matches.value[0] | null
  top: number
  left: number
}>({ visible: false, item: null, top: 0, left: 0 })

function openMaxBetPopover(event: MouseEvent, item: typeof matches.value[0]) {
  if (!item.maxBet) return
  const el = event.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  // 弹窗出现在点击元素的正下方
  let top = rect.bottom + 6
  let left = rect.left
  // 防止弹窗超出右侧视口
  const popoverWidth = 380
  if (left + popoverWidth > window.innerWidth - 12) {
    left = window.innerWidth - popoverWidth - 12
  }
  if (left < 12) left = 12
  // 如果下方空间不足，改到上方
  const popoverHeight = 400
  if (top + popoverHeight > window.innerHeight - 12) {
    top = rect.top - popoverHeight - 6
    if (top < 12) top = 12
  }
  maxBetPopover.value = { visible: true, item, top, left }
}

function closeMaxBetPopover() {
  maxBetPopover.value = { visible: false, item: null, top: 0, left: 0 }
}


// 分页按钮范围
const pageRange = computed(() => {
  const pages: number[] = []
  const start = Math.max(1, currentPage.value - 4)
  const end = Math.min(totalPages.value, currentPage.value + 4)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

// 明细链接配置
const detailLinks = [
  { path: 'cs', label: 'GL', title: 'Goal Line', color: '#2563eb' },
  { path: 'cs2', label: '波', title: '波胆2', color: '#5f9ea0' },
  { path: 'cs3', label: '标', title: '胜平负', color: '#a0522d' },
  { path: 'cs4', label: 'UO', title: '大小', color: '#556b2f' },
  { path: 'cs5', label: '亚', title: '亚盘', color: '#8a2be2' },
  { path: 'cs7', label: '角', title: '角球', color: '#ff7f50' },
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
      <!-- 加载遮罩 -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner" />
        <span>数据加载中...</span>
      </div>
      <table class="match-table">
        <thead>
          <tr>
            <th class="col-league">
              联赛
            </th>
            <th class="col-time">
              开赛时间
            </th>
            <th class="col-teams">
              对阵
            </th>
            <th class="col-let">
              让球
            </th>
            <th class="col-maxbet">
              最大单注
            </th>
            <th class="col-score">
              比分
            </th>
            <th class="col-bf">
              总成交
            </th>
            <th class="col-pmark">
              P标记
            </th>
            <th class="col-detail">
              明细
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="matches.length === 0">
            <td colspan="9" class="empty">
              {{ status === 'pending' ? '加载中...' : '暂无赛事数据' }}
            </td>
          </tr>
          <tr v-for="item in matches" :key="item.match.eventId">
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
            <td class="col-let">
              {{ item.asianAvrLet ?? '-' }}
            </td>
            <td class="col-maxbet">
              <span
                v-if="item.maxBet > 0"
                class="maxbet-cell"
                :class="{ highlight: isMaxBetHighlight(item) }"
                @click="openMaxBetPopover($event, item)"
              >
                {{ formatMaxBetSummary(item) }}
              </span>
              <span v-else>-</span>
            </td>
            <td class="col-score">
              <span class="score">{{ item.match.final || '-' }}</span>
              <span v-if="item.match.half" class="half">({{ item.match.half }})</span>
            </td>
            <td class="col-bf">
              {{ formatBfAmount(item.bfAmount) }}
            </td>
            <td class="col-pmark">
              <span v-if="item.pMark" class="pmark-tag" :class="'pmark-' + item.pMark.toLowerCase()">
                {{ item.pMark }}
              </span>
              <span v-else>-</span>
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

    <!-- 最大单注详情浮层（定位在点击元素附近） -->
    <Teleport to="body">
      <div v-if="maxBetPopover.visible && maxBetPopover.item" class="popover-overlay" @click.self="closeMaxBetPopover">
        <div
          class="popover-box"
          :style="{ top: maxBetPopover.top + 'px', left: maxBetPopover.left + 'px' }"
        >
          <div class="popover-header">
            <span class="popover-title">最大单注详情</span>
            <button class="popover-close" @click="closeMaxBetPopover">
              &times;
            </button>
          </div>
          <div class="popover-match">
            {{ maxBetPopover.item.match.sortName }} &middot;
            {{ maxBetPopover.item.match.homeTeam }} vs {{ maxBetPopover.item.match.guestTeam }}
          </div>
          <table class="popover-detail">
            <tbody>
              <tr>
                <td class="label">交易量</td>
                <td class="value">{{ formatMoney(maxBetPopover.item.maxBet) }}</td>
              </tr>
              <tr>
                <td class="label">占比</td>
                <td class="value">{{ maxBetPopover.item.maxBetPercent.toFixed(1) }}%</td>
              </tr>
              <tr>
                <td class="label">交易属性</td>
                <td class="value">{{ maxBetPopover.item.maxBetAttr || '-' }}</td>
              </tr>
              <tr>
                <td class="label">价位 (赔率)</td>
                <td class="value" :class="{ 'text-red': maxBetPopover.item.maxBetOdds > 0 && maxBetPopover.item.maxBetOdds < 2 }">
                  {{ maxBetPopover.item.maxBetOdds }}
                </td>
              </tr>
              <tr>
                <td class="label">价格变化</td>
                <td class="value">{{ maxBetPopover.item.maxBetPriceChange }}</td>
              </tr>
              <tr>
                <td class="label">比分项</td>
                <td class="value">{{ maxBetPopover.item.maxBetSelection || '-' }}</td>
              </tr>
              <tr>
                <td class="label">刷新时间</td>
                <td class="value">{{ maxBetPopover.item.maxBetTime || '-' }}</td>
              </tr>
              <tr>
                <td class="label">比赛时间</td>
                <td class="value">{{ formatDateTime(maxBetPopover.item.match.matchTime) }}</td>
              </tr>
              <tr>
                <td class="label">P标记</td>
                <td class="value">
                  <span v-if="maxBetPopover.item.pMark" class="pmark-tag" :class="'pmark-' + maxBetPopover.item.pMark.toLowerCase()">
                    {{ maxBetPopover.item.pMark }}
                  </span>
                  <span v-else>-</span>
                </td>
              </tr>
              <tr>
                <td class="label">总成交</td>
                <td class="value">{{ formatBfAmount(maxBetPopover.item.bfAmount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Teleport>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="pagination">
      <button :disabled="currentPage <= 1" @click="goToPage(1)">
        首页
      </button>
      <button :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">
        上一页
      </button>
      <button
        v-for="p in pageRange"
        :key="p"
        :class="{ active: p === currentPage }"
        @click="goToPage(p)"
      >
        {{ p }}
      </button>
      <button :disabled="currentPage >= totalPages" @click="goToPage(currentPage + 1)">
        下一页
      </button>
      <button :disabled="currentPage >= totalPages" @click="goToPage(totalPages)">
        尾页
      </button>
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
  font-size: 0.85rem;
  color: #666;
  white-space: nowrap;
}

.filter-group input,
.filter-group select {
  padding: 0.4rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.85rem;
  background: #fff;
}

/* --- 日期选择器增强 --- */
.date-picker-group {
  flex-wrap: wrap;
}

.date-picker-wrap {
  display: flex;
  align-items: center;
  gap: 2px;
}

.date-picker-wrap input[type="date"] {
  padding: 0.4rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 0.85rem;
  background: #fff;
}

.date-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 30px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  font-size: 1.1rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
}

.date-nav-btn:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  color: #1e40af;
}

.date-today-btn {
  padding: 0.35rem 0.55rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  font-size: 0.78rem;
  color: #475569;
  cursor: pointer;
  margin-left: 2px;
  transition: all 0.15s;
}

.date-today-btn:hover {
  background: #dbeafe;
  border-color: #93c5fd;
  color: #1e40af;
}

.date-display {
  font-size: 0.8rem;
  color: #64748b;
  margin-left: 0.5rem;
  white-space: nowrap;
}

/* --- 刷新按钮 --- */
.filter-actions {
  display: flex;
  align-items: center;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.7rem;
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

.refresh-icon {
  font-size: 1rem;
  display: inline-block;
}

.refresh-icon.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* --- 加载遮罩 --- */
.table-wrap {
  position: relative;
}

.table-wrap.is-loading table {
  opacity: 0.4;
  pointer-events: none;
  transition: opacity 0.2s;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  z-index: 10;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  min-height: 120px;
}

.loading-overlay span {
  font-size: 0.85rem;
  color: #64748b;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.filter-info {
  margin-left: auto;
}

.badge {
  font-size: 0.85rem;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-weight: 500;
}

.badge.loading {
  background: #fef3c7;
  color: #92400e;
}

.badge.count {
  background: #dbeafe;
  color: #1e40af;
}

/* --- 表格 --- */
.table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.match-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.match-table thead {
  background: #f8fafc;
}

.match-table th {
  padding: 0.6rem 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}

.match-table td {
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.match-table tbody tr:hover {
  background: #f8fafc;
}

.col-league { width: 90px; }
.col-time { width: 110px; white-space: nowrap; }
.col-teams { min-width: 200px; }
.col-let { width: 60px; text-align: center; }
.col-maxbet { min-width: 240px; }
.col-score { width: 90px; white-space: nowrap; }
.col-bf { width: 65px; text-align: right; white-space: nowrap; }
.col-pmark { width: 55px; text-align: center; }
.col-detail { width: 160px; }

.league-tag {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  background: #f1f5f9;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #475569;
  white-space: nowrap;
}

.team-home {
  font-weight: 500;
}

.team-vs {
  color: #94a3b8;
  margin: 0 0.35rem;
  font-size: 0.78rem;
}

.team-away {
  color: #475569;
}

.score {
  font-weight: 600;
  color: #1e40af;
}

.half {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-left: 0.25rem;
}

.empty {
  text-align: center;
  padding: 2rem !important;
  color: #94a3b8;
}

/* --- 最大单注 --- */
.maxbet-cell {
  cursor: pointer;
  border-bottom: 1px dashed #94a3b8;
  transition: color 0.15s;
}

.maxbet-cell:hover {
  color: #1e40af;
}

.col-maxbet .highlight {
  color: #dc2626;
}

.col-maxbet .highlight:hover {
  color: #991b1b;
}

/* --- P标记 --- */
.pmark-tag {
  display: inline-block;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
}

.pmark-ps {
  background: #f59e0b;
  color: #fff;
}

.pmark-p {
  background: #ef4444;
  color: #fff;
}

.pmark-p0 {
  background: #f97316;
  color: #fff;
}

.pmark-p1 {
  background: #eab308;
  color: #333;
}

.pmark-p2 {
  background: #84cc16;
  color: #333;
}

.pmark-p6 {
  background: #14b8a6;
  color: #fff;
}

.pmark-p12 {
  background: #06b6d4;
  color: #fff;
}

/* --- 明细链接 --- */
.detail-links {
  display: flex;
  gap: 4px;
}

.detail-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 18px;
  padding: 0 3px;
  border-radius: 3px;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 600;
  text-decoration: none;
  opacity: 0.8;
  transition: opacity 0.15s, transform 0.15s;
  line-height: 1;
}

.detail-btn:hover {
  opacity: 1;
  transform: scale(1.15);
}

/* --- 分页 --- */
.pagination {
  display: flex;
  justify-content: center;
  gap: 0.35rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.pagination button {
  padding: 0.35rem 0.7rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  font-size: 0.85rem;
  cursor: pointer;
  color: #374151;
  transition: all 0.15s;
}

.pagination button:hover:not(:disabled):not(.active) {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.pagination button.active {
  background: #1e40af;
  color: #fff;
  border-color: #1e40af;
}

.pagination button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* --- 最大单注浮层 --- */
.popover-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.popover-box {
  position: fixed;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.05);
  width: 380px;
  max-width: 92vw;
  overflow: hidden;
  animation: popover-in 0.15s ease-out;
}

@keyframes popover-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.85rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.popover-title {
  font-weight: 600;
  font-size: 0.85rem;
  color: #1e293b;
}

.popover-close {
  background: none;
  border: none;
  font-size: 1.2rem;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
  padding: 0 0.2rem;
}

.popover-close:hover {
  color: #475569;
}

.popover-match {
  padding: 0.5rem 0.85rem;
  font-size: 0.82rem;
  color: #475569;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
}

.popover-detail {
  width: 100%;
  border-collapse: collapse;
}

.popover-detail tr {
  border-bottom: 1px solid #f1f5f9;
}

.popover-detail tr:last-child {
  border-bottom: none;
}

.popover-detail td {
  padding: 0.4rem 0.85rem;
  font-size: 0.82rem;
}

.popover-detail .label {
  color: #64748b;
  width: 90px;
  white-space: nowrap;
}

.popover-detail .value {
  color: #1e293b;
  font-weight: 500;
}

.popover-detail .text-red {
  color: #dc2626;
  font-weight: 600;
}
</style>
