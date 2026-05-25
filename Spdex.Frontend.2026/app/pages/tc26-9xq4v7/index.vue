<script setup lang="ts">
import type { ApiResponse } from '~/types/api'
import type { MatchListItem, MatchListResult } from '~/types/match'
import { formatDateCN, formatMatchTimeSlash } from '~/utils/formatters'

definePageMeta({ layout: false })

interface OpenedResponse {
  channelCode: string
  openDate: string
  sport: string
  eventIds: number[]
  matches: MatchListResult
}

const apiKey = ref('')
const selectedDate = ref(todayString())
const selectedLeague = ref('')
const candidates = ref<MatchListItem[]>([])
const candidateLeagues = ref<string[]>([])
const opened = ref<OpenedResponse | null>(null)
const selectedIds = ref<Set<number>>(new Set())
const loading = ref(false)
const saving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const selectedMatches = computed(() => {
  const byId = new Map(candidates.value.map(item => [item.match.eventId, item]))
  return Array.from(selectedIds.value)
    .map(id => byId.get(id) ?? opened.value?.matches.items.find(item => item.match.eventId === id))
    .filter((item): item is MatchListItem => !!item)
})

const canSave = computed(() => apiKey.value.trim().length > 0 && selectedIds.value.size <= 3)

onMounted(() => {
  apiKey.value = localStorage.getItem('spdex_2026_admin_api_key') || ''
  if (apiKey.value) {
    void refreshAll()
  }
})

function todayString(): string {
  const date = new Date()
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function headers() {
  return { 'X-Api-Key': apiKey.value.trim() }
}

function setMessage(type: 'error' | 'success', message: string) {
  errorMsg.value = type === 'error' ? message : ''
  successMsg.value = type === 'success' ? message : ''
}

async function refreshAll() {
  if (!apiKey.value.trim()) {
    setMessage('error', '请输入 Admin API Key')
    return
  }

  localStorage.setItem('spdex_2026_admin_api_key', apiKey.value.trim())
  loading.value = true
  setMessage('success', '')

  try {
    await Promise.all([fetchCandidates(), fetchOpened()])
  }
  catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string }, message?: string }
    setMessage('error', fetchErr.data?.message || fetchErr.message || '加载失败')
  }
  finally {
    loading.value = false
  }
}

async function fetchCandidates() {
  const res = await $fetch<ApiResponse<MatchListResult>>('/api/admin/teaching2026/soccer-candidates', {
    params: {
      date: selectedDate.value,
      league: selectedLeague.value || undefined,
      status: 'all',
      page: 1,
      pageSize: 500,
    },
    headers: headers(),
  })
  candidates.value = res.data?.items ?? []
  candidateLeagues.value = res.data?.leagues ?? []
}

async function fetchOpened() {
  const res = await $fetch<ApiResponse<OpenedResponse>>('/api/admin/teaching2026/opened', {
    params: { date: selectedDate.value },
    headers: headers(),
  })
  opened.value = res.data
  selectedIds.value = new Set(res.data?.eventIds ?? [])
}

async function saveOpened() {
  if (!canSave.value) return

  saving.value = true
  setMessage('success', '')

  try {
    const res = await $fetch<ApiResponse<OpenedResponse>>('/api/admin/teaching2026/opened', {
      method: 'PUT',
      headers: headers(),
      body: {
        date: selectedDate.value,
        eventIds: Array.from(selectedIds.value),
      },
    })
    opened.value = res.data
    selectedIds.value = new Set(res.data?.eventIds ?? [])
    setMessage('success', '已保存 2026频道开放赛事')
  }
  catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string }, message?: string }
    setMessage('error', fetchErr.data?.message || fetchErr.message || '保存失败')
  }
  finally {
    saving.value = false
  }
}

function toggleMatch(eventId: number) {
  const next = new Set(selectedIds.value)
  if (next.has(eventId)) {
    next.delete(eventId)
  }
  else if (next.size < 3) {
    next.add(eventId)
  }
  selectedIds.value = next
}

function onDateChange(value: string) {
  selectedDate.value = value || todayString()
  selectedLeague.value = ''
  void refreshAll()
}

function onLeagueChange(value: string) {
  selectedLeague.value = value
  void refreshAll()
}
</script>

<template>
  <div class="admin-page">
    <header class="admin-header">
      <div>
        <h1>2026教学频道管理</h1>
        <p>足球每天最多开放 3 场；篮球赛事默认全部开放，无需选择</p>
      </div>
      <a href="/" class="home-link">返回频道</a>
    </header>

    <section class="toolbar">
      <label>
        <span>Admin API Key</span>
        <input
          v-model="apiKey"
          type="password"
          placeholder="请输入 X-Api-Key"
          autocomplete="off"
          @keyup.enter="refreshAll"
        >
      </label>
      <label>
        <span>日期</span>
        <input type="date" :value="selectedDate" @change="onDateChange(($event.target as HTMLInputElement).value)">
      </label>
      <label>
        <span>联赛</span>
        <select :value="selectedLeague" @change="onLeagueChange(($event.target as HTMLSelectElement).value)">
          <option value="">全部</option>
          <option v-for="lg in candidateLeagues" :key="lg" :value="lg">{{ lg }}</option>
        </select>
      </label>
      <button class="ghost-btn" :disabled="loading" @click="refreshAll">
        {{ loading ? '加载中...' : '刷新' }}
      </button>
      <button class="save-btn" :disabled="!canSave || saving" @click="saveOpened">
        {{ saving ? '保存中...' : '保存足球开放赛事' }}
      </button>
    </section>

    <div class="status-line">
      <span>{{ formatDateCN(selectedDate) }}</span>
      <strong>足球 {{ selectedIds.size }}/3</strong>
      <span class="basketball-note">篮球：全部开放</span>
      <span v-if="errorMsg" class="error-text">{{ errorMsg }}</span>
      <span v-if="successMsg" class="success-text">{{ successMsg }}</span>
    </div>

    <section class="selected-strip">
      <div v-if="selectedMatches.length === 0" class="empty-selected">尚未选择足球开放赛事</div>
      <button
        v-for="item in selectedMatches"
        :key="item.match.eventId"
        class="selected-chip"
        @click="toggleMatch(item.match.eventId)"
      >
        {{ item.match.homeTeam }} vs {{ item.match.guestTeam }}
      </button>
    </section>

    <main class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="select-col">开放</th>
            <th>时间</th>
            <th>联赛</th>
            <th>主队</th>
            <th>客队</th>
            <th>比分</th>
            <th>EventId</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="candidates.length === 0">
            <td colspan="7" class="empty-cell">{{ loading ? '加载中...' : '暂无候选赛事' }}</td>
          </tr>
          <tr v-for="item in candidates" :key="item.match.eventId" :class="{ picked: selectedIds.has(item.match.eventId) }">
            <td class="select-col">
              <input
                type="checkbox"
                :checked="selectedIds.has(item.match.eventId)"
                :disabled="!selectedIds.has(item.match.eventId) && selectedIds.size >= 3"
                @change="toggleMatch(item.match.eventId)"
              >
            </td>
            <td>{{ formatMatchTimeSlash(item.match.matchTime) }}</td>
            <td>{{ item.match.sortName }}</td>
            <td>{{ item.match.homeTeam }}</td>
            <td>{{ item.match.guestTeam }}</td>
            <td>{{ item.match.final || '-' }}</td>
            <td class="event-id">{{ item.match.eventId }}</td>
          </tr>
        </tbody>
      </table>
    </main>
  </div>
</template>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #f4f6f9;
  color: #263142;
  padding: 24px;
}

.admin-header,
.toolbar,
.selected-strip,
.table-wrap {
  max-width: 1180px;
  margin: 0 auto;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

h1 {
  margin: 0;
  font-size: 24px;
}

p {
  margin: 6px 0 0;
  color: #687589;
}

.home-link {
  color: #3159c9;
  font-weight: 700;
  text-decoration: none;
}

.toolbar {
  display: flex;
  align-items: end;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px;
  background: #fff;
  border: 1px solid #dfe5ee;
  border-radius: 8px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #667287;
  font-size: 12px;
  font-weight: 700;
}

input,
select {
  height: 36px;
  min-width: 160px;
  border: 1px solid #cfd7e3;
  border-radius: 6px;
  padding: 0 10px;
  background: #fff;
  color: #263142;
}

.ghost-btn,
.save-btn {
  height: 36px;
  border: 1px solid #cbd4e2;
  border-radius: 6px;
  padding: 0 14px;
  font-weight: 700;
  cursor: pointer;
}

.ghost-btn {
  background: #fff;
  color: #40506a;
}

.save-btn {
  border-color: #3159c9;
  background: #3159c9;
  color: #fff;
}

button:disabled {
  opacity: 0.55;
  cursor: default;
}

.status-line {
  max-width: 1180px;
  margin: 12px auto;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #687589;
}

.error-text {
  color: #c73737;
}

.success-text {
  color: #24834f;
}

.selected-strip {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.empty-selected,
.selected-chip {
  min-height: 34px;
  border-radius: 6px;
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #dfe5ee;
}

.selected-chip {
  color: #3159c9;
  font-weight: 700;
  cursor: pointer;
}

.table-wrap {
  overflow-x: auto;
  background: #fff;
  border: 1px solid #dfe5ee;
  border-radius: 8px;
}

table {
  width: 100%;
  min-width: 920px;
  border-collapse: collapse;
}

th,
td {
  padding: 10px 12px;
  border-top: 1px solid #edf1f6;
  text-align: left;
  white-space: nowrap;
}

th {
  border-top: 0;
  background: #eef2f7;
  color: #344156;
  font-size: 13px;
}

.picked td {
  background: #f0f6ff;
}

.select-col {
  width: 64px;
  text-align: center;
}

.event-id {
  color: #6c778a;
  font-variant-numeric: tabular-nums;
}

.empty-cell {
  text-align: center;
  color: #7c8799;
}

@media (max-width: 720px) {
  .admin-page {
    padding: 14px;
  }

  .admin-header {
    align-items: flex-start;
    gap: 10px;
    flex-direction: column;
  }

  input,
  select {
    width: 100%;
  }

  label,
  .ghost-btn,
  .save-btn {
    width: 100%;
  }
}
</style>
