<script setup lang="ts">
import type { ApiResponse } from '~/types/api'
import type {
  Signal,
  SignalListResult,
  SignalModelSummary,
  SignalHistoryResult,
  SignalStats,
  SignalRecord,
  ConditionResult,
  SignalSnapshot,
} from '~/types/signal'
import { formatMatchTimeSlash, formatDateTime, formatMoney } from '~/utils/formatters'

// ── 访问控制 ──
const { canAccessSignals } = useSignalAccess()
if (!canAccessSignals.value) {
  navigateTo('/')
}

// ── 使用指南 ──
const showGuide = ref(false)

// ── Tab 切换 ──
const activeTab = ref<'realtime' | 'history' | 'stats'>('realtime')

// ── 实时信号 Tab ──
const rtStatusFilter = ref<string>('')
const rtModelFilter = ref<string>('')
const rtParams = computed(() => ({
  status: rtStatusFilter.value || undefined,
  modelId: rtModelFilter.value || undefined,
}))
const { data: rtResponse, status: rtStatus, refreshing: rtRefreshing, manualRefresh: rtRefresh } = useSignalList(rtParams)
const rtResult = computed<SignalListResult | null>(() => rtResponse.value?.data ?? null)
const rtSignals = computed(() => rtResult.value?.signals ?? [])
const rtStatusCounts = computed(() => rtResult.value?.statusCounts ?? {})
const rtLoading = computed(() => rtStatus.value === 'pending' || rtRefreshing.value)

// 30s 自动刷新（仅在实时 Tab 活跃时）
let rtTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  rtTimer = setInterval(() => {
    if (activeTab.value === 'realtime') rtRefresh()
  }, 30000)
})
onUnmounted(() => {
  if (rtTimer) clearInterval(rtTimer)
})

// ── 模型列表（共享） ──
const { data: modelsResponse } = useSignalModels()
const models = computed<SignalModelSummary[]>(() => modelsResponse.value?.data ?? [])

// ── 信号详情弹窗 ──
const detailSignal = ref<Signal | null>(null)
function openDetail(signal: Signal) {
  detailSignal.value = signal
}
function closeDetail() {
  detailSignal.value = null
}

// 解析 JSON 快照（历史记录用）
function parseSnapshot(json: string | null): SignalSnapshot | null {
  if (!json) return null
  try { return JSON.parse(json) } catch { return null }
}
function parseConditions(json: string | null): ConditionResult[] {
  if (!json) return []
  try { return JSON.parse(json) } catch { return [] }
}

// ── 信号操作 ──
async function handleAck(signalId: string) {
  const res = await ackSignal(signalId, 'web-user')
  if (res?.code === 200) await rtRefresh()
  else alert(res?.message ?? '操作失败')
}

async function handleExpire(signalId: string) {
  if (!confirm('确定要取消此信号吗？')) return
  const res = await expireSignal(signalId)
  if (res?.code === 200) await rtRefresh()
  else alert(res?.message ?? '操作失败')
}

// ── 历史记录 Tab ──
const histModelFilter = ref<string>('')
const histStatusFilter = ref<string>('')
const histDateFrom = ref<string>('')
const histDateTo = ref<string>('')
const histEventId = ref<string>('')
const histPage = ref(1)
const histPageSize = 20

const histParams = computed(() => ({
  modelId: histModelFilter.value || undefined,
  status: histStatusFilter.value || undefined,
  dateFrom: histDateFrom.value || undefined,
  dateTo: histDateTo.value || undefined,
  eventId: histEventId.value ? Number(histEventId.value) : undefined,
  page: histPage.value,
  pageSize: histPageSize,
}))

const { data: histResponse, status: histStatus, refreshing: histRefreshing, manualRefresh: histRefresh } = useSignalHistory(histParams)
const histResult = computed<SignalHistoryResult | null>(() => histResponse.value?.data ?? null)

/** 历史记录（后端已按 EventId+ModelId 去重，直接使用） */
const histItems = computed(() => histResult.value?.items ?? [])
const histTotal = computed(() => histResult.value?.total ?? 0)
const histTotalPages = computed(() => histResult.value?.totalPages ?? 0)
const histLoading = computed(() => histStatus.value === 'pending' || histRefreshing.value)

function histGoToPage(page: number) {
  if (page >= 1 && page <= histTotalPages.value) histPage.value = page
}

const histPageRange = computed(() => {
  const pages: number[] = []
  const start = Math.max(1, histPage.value - 4)
  const end = Math.min(histTotalPages.value, histPage.value + 4)
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})

// 重置筛选时回到第1页
watch([histModelFilter, histStatusFilter, histDateFrom, histDateTo, histEventId], () => {
  histPage.value = 1
})

// ── 统计 Tab ──
const statsModelFilter = ref<string>('')
const statsDays = ref(30)
const statsParams = computed(() => ({
  modelId: statsModelFilter.value || undefined,
  days: statsDays.value,
}))
const { data: statsResponse, status: statsStatus } = useSignalStats(statsParams)
const statsData = computed<SignalStats[]>(() => statsResponse.value?.data ?? [])
const statsLoading = computed(() => statsStatus.value === 'pending')

// ── 状态颜色映射 ──
function statusColor(status: string): string {
  switch (status) {
    case 'Triggered': return '#f59e0b'
    case 'Conditional': return '#3b82f6'
    case 'Executable': return '#22c55e'
    case 'Expired': return '#6b7280'
    case 'Executed': return '#8b5cf6'
    case 'Cancelled': return '#ef4444'
    default: return '#94a3b8'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'Triggered': return '已触发'
    case 'Conditional': return '等待条件'
    case 'Executable': return '可执行'
    case 'Expired': return '已过期'
    case 'Executed': return '已执行'
    case 'Cancelled': return '已撤销'
    default: return status
  }
}

const allStatuses = ['Triggered', 'Conditional', 'Executable', 'Expired', 'Executed', 'Cancelled']

/** 百分比格式化 */
function pct(hit: number, total: number): string {
  if (total <= 0) return '0%'
  return `${((hit / total) * 100).toFixed(0)}%`
}

/** 命中率颜色：>=60% 绿色，>=40% 橙色，<40% 灰色 */
function hitRateColor(hit: number, total: number): string {
  if (total <= 0) return '#6b7280'
  const rate = hit / total
  if (rate >= 0.6) return '#22c55e'
  if (rate >= 0.4) return '#d97706'
  return '#6b7280'
}
</script>

<template>
  <div class="signals-page">
    <div class="page-header">
      <h2 class="page-title">信号监控</h2>
      <button class="guide-toggle" @click="showGuide = !showGuide">
        {{ showGuide ? '收起指南' : '使用指南' }}
      </button>
    </div>

    <!-- 使用指南 -->
    <div v-if="showGuide" class="guide-panel">
      <div class="guide-section">
        <h4>信号引擎工作原理</h4>
        <p>系统每 <b>30 秒</b>自动扫描所有未开赛足球比赛的 GoalLine 市场数据，按照配置的模型条件进行评估。当所有条件满足时产生交易信号。</p>
      </div>
      <div class="guide-section">
        <h4>信号生命周期</h4>
        <div class="lifecycle">
          <span class="lc-step" style="background: #fef3c7; color: #92400e;">已触发 Triggered</span>
          <span class="lc-arrow">&rarr;</span>
          <span class="lc-step" style="background: #dbeafe; color: #1e40af;">等待条件 Conditional</span>
          <span class="lc-arrow">&rarr;</span>
          <span class="lc-step" style="background: #dcfce7; color: #166534;">可执行 Executable</span>
          <span class="lc-arrow">&rarr;</span>
          <span class="lc-step" style="background: #ede9fe; color: #6d28d9;">已执行 Executed</span>
        </div>
        <p class="guide-note">注：无等待条件的模型直接从 Triggered 跳到 Executable。信号开赛后自动过期。</p>
      </div>
      <div class="guide-section">
        <h4>如何对接自动化系统</h4>
        <ol>
          <li><b>轮询可执行信号</b>：定时请求 <code>GET /api/signals?status=executable</code>，获取当前可执行的信号列表</li>
          <li><b>读取信号详情</b>：通过 <code>GET /api/signals/{signalId}</code> 获取完整的触发快照和条件数据</li>
          <li><b>确认执行</b>：Bot 执行投注后调用 <code>POST /api/signals/{signalId}/ack</code>，Body 传入 <code>{"executedBy":"bot-v1"}</code></li>
          <li><b>取消信号</b>：如需手动取消，调用 <code>DELETE /api/signals/{signalId}</code></li>
        </ol>
      </div>
      <div class="guide-section">
        <h4>如何新增模型</h4>
        <p>在 <code>appsettings.json</code> 的 <code>SignalEngine.Models</code> 数组中添加新模型配置。支持 5 种条件类型：阈值(Threshold)、字段比较(CompareFields)、环比(PeriodOverPeriod)、方差高亮(ItemVariance)、排除时段(ExcludeTimeWindow)。保存后自动热重载，无需重启服务。</p>
      </div>
      <div class="guide-section">
        <h4>页面功能说明</h4>
        <ul>
          <li><b>实时信号</b>：展示内存中的活跃信号，30 秒自动刷新。可按状态和模型筛选，支持查看详情、确认执行、取消操作。</li>
          <li><b>历史记录</b>：查询数据库中的所有信号记录，支持按模型、状态、日期范围、赛事 ID 分页查询。</li>
          <li><b>统计概览</b>：按模型分组展示比赛数、已执行场次、已过期场次和执行率；同一场比赛多次触发只统计一次，支持按天数范围筛选。</li>
        </ul>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="tab-bar">
      <button
        :class="['tab-btn', { active: activeTab === 'realtime' }]"
        @click="activeTab = 'realtime'"
      >
        实时信号
        <span v-if="rtResult" class="tab-count">{{ rtResult.totalCount }}</span>
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'history' }]"
        @click="activeTab = 'history'"
      >
        历史记录
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'stats' }]"
        @click="activeTab = 'stats'"
      >
        统计概览
      </button>
    </div>

    <!-- ========== Tab 1: 实时信号 ========== -->
    <div v-show="activeTab === 'realtime'">
      <!-- 筛选栏 -->
      <div class="filter-bar">
        <div class="filter-group status-group">
          <button
            :class="['status-btn', { active: rtStatusFilter === '' }]"
            @click="rtStatusFilter = ''"
          >全部</button>
          <button
            v-for="s in allStatuses"
            :key="s"
            :class="['status-btn', { active: rtStatusFilter === s }]"
            @click="rtStatusFilter = s"
          >{{ statusLabel(s) }}</button>
        </div>
        <div class="filter-group">
          <label>模型</label>
          <select v-model="rtModelFilter">
            <option value="">全部</option>
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div class="filter-actions">
          <button class="refresh-btn" :disabled="rtLoading" @click="rtRefresh">
            <span class="refresh-icon" :class="{ spinning: rtLoading }">&#8635;</span>
            刷新
          </button>
        </div>
        <div class="filter-info">
          <span v-if="rtLoading" class="badge loading">加载中...</span>
          <template v-else>
            <span
              v-for="(count, st) in rtStatusCounts"
              :key="String(st)"
              class="badge status-count"
              :style="{ background: statusColor(String(st)) + '20', color: statusColor(String(st)) }"
            >
              {{ statusLabel(String(st)) }} {{ count }}
            </span>
          </template>
        </div>
      </div>

      <!-- 信号表格 -->
      <div class="table-wrap" :class="{ 'is-loading': rtLoading }">
        <div v-if="rtLoading" class="loading-overlay">
          <div class="loading-spinner" />
          <span>数据加载中...</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>模型</th>
              <th>赛事</th>
              <th>开赛时间</th>
              <th>状态</th>
              <th>触发时间</th>
              <th>条件概要</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="rtSignals.length === 0">
              <td colspan="7" class="empty">暂无信号</td>
            </tr>
            <tr v-for="sig in rtSignals" :key="sig.signalId">
              <td>
                <span class="model-tag">{{ sig.modelName }}</span>
              </td>
              <td>
                <span class="team-home">{{ sig.homeTeam }}</span>
                <span class="team-vs">vs</span>
                <span class="team-away">{{ sig.guestTeam }}</span>
              </td>
              <td class="col-time">{{ formatMatchTimeSlash(sig.matchTime) }}</td>
              <td>
                <span
                  class="status-badge"
                  :style="{ background: statusColor(sig.status) + '18', color: statusColor(sig.status), borderColor: statusColor(sig.status) }"
                >
                  {{ statusLabel(sig.status) }}
                </span>
              </td>
              <td class="col-time">{{ formatMatchTimeSlash(sig.triggeredAt) }}</td>
              <td>
                <span class="condition-summary">
                  {{ sig.conditionResults.filter(c => c.passed).length }}/{{ sig.conditionResults.length }} 通过
                </span>
              </td>
              <td class="col-actions">
                <button class="action-btn view-btn" title="查看详情" @click="openDetail(sig)">详情</button>
                <button
                  v-if="sig.status === 'Executable'"
                  class="action-btn ack-btn"
                  title="确认执行"
                  @click="handleAck(sig.signalId)"
                >执行</button>
                <button
                  v-if="sig.status !== 'Expired' && sig.status !== 'Executed' && sig.status !== 'Cancelled'"
                  class="action-btn expire-btn"
                  title="取消信号"
                  @click="handleExpire(sig.signalId)"
                >取消</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ========== Tab 2: 历史记录 ========== -->
    <div v-show="activeTab === 'history'">
      <div class="filter-bar">
        <div class="filter-group">
          <label>模型</label>
          <select v-model="histModelFilter">
            <option value="">全部</option>
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>状态</label>
          <select v-model="histStatusFilter">
            <option value="">全部</option>
            <option v-for="s in allStatuses" :key="s" :value="s">{{ statusLabel(s) }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>从</label>
          <input type="date" v-model="histDateFrom">
        </div>
        <div class="filter-group">
          <label>到</label>
          <input type="date" v-model="histDateTo">
        </div>
        <div class="filter-group">
          <label>赛事ID</label>
          <input type="number" v-model="histEventId" placeholder="可选" class="input-narrow">
        </div>
        <div class="filter-actions">
          <button class="refresh-btn" :disabled="histLoading" @click="histRefresh">
            <span class="refresh-icon" :class="{ spinning: histLoading }">&#8635;</span>
            刷新
          </button>
        </div>
        <div class="filter-info">
          <span v-if="histLoading" class="badge loading">加载中...</span>
          <span v-else class="badge count">共 {{ histTotal }} 条</span>
        </div>
      </div>

      <div class="table-wrap" :class="{ 'is-loading': histLoading }">
        <div v-if="histLoading" class="loading-overlay">
          <div class="loading-spinner" />
          <span>数据加载中...</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>模型</th>
              <th>赛事</th>
              <th>开赛时间</th>
              <th>状态</th>
              <th>触发时间</th>
              <th>半场比分</th>
              <th>全场比分</th>
              <th>命中</th>
              <th>半场O1.5</th>
              <th>全场O2.5</th>
              <th>BTS</th>
              <th>触发次数</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="histItems.length === 0">
              <td colspan="12" class="empty">暂无历史记录</td>
            </tr>
            <tr v-for="rec in histItems" :key="rec.id">
              <td>
                <span class="model-tag">{{ rec.modelName }}</span>
              </td>
              <td>
                <span class="team-home">{{ rec.homeTeam || '-' }}</span>
                <span class="team-vs">vs</span>
                <span class="team-away">{{ rec.guestTeam || '-' }}</span>
              </td>
              <td class="col-time">{{ formatMatchTimeSlash(rec.matchTime) }}</td>
              <td>
                <span
                  class="status-badge"
                  :style="{ background: statusColor(rec.status) + '18', color: statusColor(rec.status), borderColor: statusColor(rec.status) }"
                >
                  {{ statusLabel(rec.status) }}
                </span>
              </td>
              <td class="col-time">
                {{ formatMatchTimeSlash(rec.triggeredAt) }}
                <span v-if="rec.triggerWindowLabel" class="window-label">{{ rec.triggerWindowLabel }}</span>
              </td>
              <td class="col-score">{{ rec.halfScore || '-' }}</td>
              <td class="col-score">{{ rec.finalScore || '-' }}</td>
              <td class="col-hit">
                <span v-if="rec.isHit === true" class="hit-yes">✅</span>
                <span v-else-if="rec.isHit === false" class="hit-no">❌</span>
                <span v-else>-</span>
              </td>
              <td class="col-hit">
                <span v-if="rec.halfOver15 === true" class="hit-yes">✅</span>
                <span v-else-if="rec.halfOver15 === false" class="hit-no">❌</span>
                <span v-else>-</span>
              </td>
              <td class="col-hit">
                <span v-if="rec.fullOver25 === true" class="hit-yes">✅</span>
                <span v-else-if="rec.fullOver25 === false" class="hit-no">❌</span>
                <span v-else>-</span>
              </td>
              <td class="col-hit">
                <span v-if="rec.bothTeamsScored === true" class="hit-yes">✅</span>
                <span v-else-if="rec.bothTeamsScored === false" class="hit-no">❌</span>
                <span v-else>-</span>
              </td>
              <td class="col-trigger-count">
                <span :class="{ 'trigger-multi': rec.triggerCount > 1 }">{{ rec.triggerCount }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页 -->
      <div v-if="histTotalPages > 1" class="pagination">
        <button :disabled="histPage <= 1" @click="histGoToPage(1)">首页</button>
        <button :disabled="histPage <= 1" @click="histGoToPage(histPage - 1)">上一页</button>
        <button
          v-for="p in histPageRange"
          :key="p"
          :class="{ active: p === histPage }"
          @click="histGoToPage(p)"
        >{{ p }}</button>
        <button :disabled="histPage >= histTotalPages" @click="histGoToPage(histPage + 1)">下一页</button>
        <button :disabled="histPage >= histTotalPages" @click="histGoToPage(histTotalPages)">尾页</button>
      </div>
    </div>

    <!-- ========== Tab 3: 统计概览 ========== -->
    <div v-show="activeTab === 'stats'">
      <div class="filter-bar">
        <div class="filter-group">
          <label>模型</label>
          <select v-model="statsModelFilter">
            <option value="">全部</option>
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label>统计天数</label>
          <select v-model.number="statsDays">
            <option :value="7">最近 7 天</option>
            <option :value="30">最近 30 天</option>
            <option :value="90">最近 90 天</option>
            <option :value="0">全部</option>
          </select>
        </div>
        <div class="filter-info">
          <span v-if="statsLoading" class="badge loading">加载中...</span>
        </div>
      </div>

      <div v-if="statsData.length === 0 && !statsLoading" class="empty-state">
        暂无统计数据
      </div>

      <div class="stats-grid">
        <div v-for="stat in statsData" :key="stat.modelId" class="stat-card">
          <div class="stat-header">
            <span class="stat-model-name">{{ stat.modelName }}</span>
            <span class="stat-model-id">{{ stat.modelId }}</span>
          </div>
          <div class="stat-body">
            <div class="stat-item">
              <span class="stat-label">总比赛</span>
              <span class="stat-value">{{ stat.totalTriggered }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">已执行</span>
              <span class="stat-value" style="color: #8b5cf6">{{ stat.totalExecuted }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">已过期</span>
              <span class="stat-value" style="color: #6b7280">{{ stat.totalExpired }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">已撤销</span>
              <span class="stat-value" style="color: #ef4444">{{ stat.totalCancelled }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">活跃中</span>
              <span class="stat-value" style="color: #22c55e">{{ stat.totalActive }}</span>
            </div>
            <div class="stat-item stat-rate">
              <span class="stat-label">执行率</span>
              <span class="stat-value stat-rate-value">
                {{ stat.totalTriggered > 0 ? ((stat.totalExecuted / stat.totalTriggered) * 100).toFixed(1) : '0.0' }}%
              </span>
            </div>
          </div>
          <!-- 命中统计 -->
          <div v-if="stat.totalFinished > 0" class="stat-hit-section">
            <div class="stat-hit-title">命中统计（已完赛 {{ stat.totalFinished }} 场）</div>
            <div class="stat-body">
              <div class="stat-item">
                <span class="stat-label">半场有球</span>
                <span class="stat-value" :style="{ color: hitRateColor(stat.hitFirstHalfGoal, stat.totalFinished) }">
                  {{ stat.hitFirstHalfGoal }}/{{ stat.totalFinished }}
                  <small class="stat-pct">{{ pct(stat.hitFirstHalfGoal, stat.totalFinished) }}</small>
                </span>
              </div>
              <div class="stat-item">
                <span class="stat-label">半场O1.5</span>
                <span class="stat-value" :style="{ color: hitRateColor(stat.hitHalfOver15, stat.totalFinished) }">
                  {{ stat.hitHalfOver15 }}/{{ stat.totalFinished }}
                  <small class="stat-pct">{{ pct(stat.hitHalfOver15, stat.totalFinished) }}</small>
                </span>
              </div>
              <div class="stat-item">
                <span class="stat-label">全场O2.5</span>
                <span class="stat-value" :style="{ color: hitRateColor(stat.hitFullOver25, stat.totalFinished) }">
                  {{ stat.hitFullOver25 }}/{{ stat.totalFinished }}
                  <small class="stat-pct">{{ pct(stat.hitFullOver25, stat.totalFinished) }}</small>
                </span>
              </div>
              <div class="stat-item">
                <span class="stat-label">BTS</span>
                <span class="stat-value" :style="{ color: hitRateColor(stat.hitBothTeamsScored, stat.totalFinished) }">
                  {{ stat.hitBothTeamsScored }}/{{ stat.totalFinished }}
                  <small class="stat-pct">{{ pct(stat.hitBothTeamsScored, stat.totalFinished) }}</small>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 信号详情弹窗 ========== -->
    <Teleport to="body">
      <div v-if="detailSignal" class="popover-overlay" @click.self="closeDetail">
        <div class="detail-dialog">
          <div class="detail-header">
            <span class="detail-title">信号详情</span>
            <button class="popover-close" @click="closeDetail">&times;</button>
          </div>

          <div class="detail-content">
            <!-- 基本信息 -->
            <div class="detail-section">
              <h4>基本信息</h4>
              <table class="detail-table">
                <tbody>
                  <tr><td class="label">信号ID</td><td>{{ detailSignal.signalId }}</td></tr>
                  <tr><td class="label">模型</td><td>{{ detailSignal.modelName }} ({{ detailSignal.modelId }})</td></tr>
                  <tr><td class="label">赛事</td><td>{{ detailSignal.homeTeam }} vs {{ detailSignal.guestTeam }}</td></tr>
                  <tr><td class="label">赛事ID</td><td>{{ detailSignal.eventId }}</td></tr>
                  <tr><td class="label">开赛时间</td><td>{{ formatDateTime(detailSignal.matchTime) }}</td></tr>
                  <tr>
                    <td class="label">状态</td>
                    <td>
                      <span
                        class="status-badge"
                        :style="{ background: statusColor(detailSignal.status) + '18', color: statusColor(detailSignal.status), borderColor: statusColor(detailSignal.status) }"
                      >{{ statusLabel(detailSignal.status) }}</span>
                    </td>
                  </tr>
                  <tr><td class="label">触发时间</td><td>{{ formatDateTime(detailSignal.triggeredAt) }}</td></tr>
                  <tr v-if="detailSignal.executableAt"><td class="label">可执行时间</td><td>{{ formatDateTime(detailSignal.executableAt) }}</td></tr>
                  <tr v-if="detailSignal.executedAt"><td class="label">执行时间</td><td>{{ formatDateTime(detailSignal.executedAt) }}</td></tr>
                  <tr v-if="detailSignal.executedBy"><td class="label">执行者</td><td>{{ detailSignal.executedBy }}</td></tr>
                </tbody>
              </table>
            </div>

            <!-- 条件结果 -->
            <div v-if="detailSignal.conditionResults.length > 0" class="detail-section">
              <h4>条件评估结果</h4>
              <table class="detail-table condition-table">
                <thead>
                  <tr>
                    <th>类型</th>
                    <th>描述</th>
                    <th>结果</th>
                    <th>实际值</th>
                    <th>阈值</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(cond, i) in detailSignal.conditionResults" :key="i">
                    <td>{{ cond.type }}</td>
                    <td>{{ cond.description }}</td>
                    <td>
                      <span :class="cond.passed ? 'cond-pass' : 'cond-fail'">
                        {{ cond.passed ? '通过' : '未通过' }}
                      </span>
                    </td>
                    <td>{{ cond.actualValue.toLocaleString() }}</td>
                    <td>{{ cond.expectedThreshold.toLocaleString() }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 等待条件 -->
            <div v-if="detailSignal.waitCondition" class="detail-section">
              <h4>等待条件</h4>
              <table class="detail-table">
                <tbody>
                  <tr><td class="label">描述</td><td>{{ detailSignal.waitCondition.description }}</td></tr>
                  <tr><td class="label">市场</td><td>{{ detailSignal.waitCondition.marketDescription }}</td></tr>
                  <tr><td class="label">选项</td><td>{{ detailSignal.waitCondition.selection }}</td></tr>
                  <tr><td class="label">盘口</td><td>{{ detailSignal.waitCondition.handicap }}</td></tr>
                  <tr><td class="label">价格条件</td><td>{{ detailSignal.waitCondition.priceOperator }} {{ detailSignal.waitCondition.priceThreshold }}</td></tr>
                  <tr><td class="label">动作</td><td>{{ detailSignal.waitCondition.action }}</td></tr>
                </tbody>
              </table>
            </div>

            <!-- 快照数据 -->
            <div v-if="detailSignal.snapshot" class="detail-section">
              <h4>触发快照</h4>
              <table class="detail-table">
                <tbody>
                  <tr><td class="label">触发时段</td><td>{{ detailSignal.snapshot.triggerWindowLabel }}</td></tr>
                  <tr><td class="label">Over 汇总</td><td>{{ formatMoney(detailSignal.snapshot.overTotalBet) }}</td></tr>
                  <tr><td class="label">Under 汇总</td><td>{{ formatMoney(detailSignal.snapshot.underTotalBet) }}</td></tr>
                  <tr><td class="label">Over/Under 比率</td><td>{{ detailSignal.snapshot.overUnderRatio.toFixed(2) }}</td></tr>
                  <tr><td class="label">环比倍率</td><td>{{ detailSignal.snapshot.periodOverPeriodRatio.toFixed(2) }}</td></tr>
                  <tr><td class="label">高亮盘口</td><td>{{ detailSignal.snapshot.highlightHandicap }}</td></tr>
                  <tr><td class="label">高亮交易量</td><td>{{ formatMoney(detailSignal.snapshot.highlightTotalBet) }}</td></tr>
                  <tr><td class="label">3σ 阈值</td><td>{{ formatMoney(detailSignal.snapshot.highlight3Sigma) }}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.signals-page {
  max-width: 100%;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.page-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.guide-toggle {
  padding: 0.35rem 0.8rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 0.85rem;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
}

.guide-toggle:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  color: #1e40af;
}

/* ── 使用指南面板 ── */
.guide-panel {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 1.2rem 1.5rem;
  margin-bottom: 1rem;
  animation: popover-in 0.15s ease-out;
}

.guide-section {
  margin-bottom: 1rem;
}

.guide-section:last-child {
  margin-bottom: 0;
}

.guide-section h4 {
  font-size: 0.92rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.4rem 0;
}

.guide-section p {
  font-size: 0.88rem;
  color: #475569;
  line-height: 1.6;
  margin: 0;
}

.guide-section ol,
.guide-section ul {
  font-size: 0.88rem;
  color: #475569;
  line-height: 1.7;
  margin: 0.3rem 0 0 0;
  padding-left: 1.2rem;
}

.guide-section code {
  background: #e2e8f0;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.82rem;
  color: #1e293b;
}

.guide-note {
  font-size: 0.82rem !important;
  color: #94a3b8 !important;
  margin-top: 0.4rem !important;
}

.lifecycle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  margin: 0.4rem 0;
}

.lc-step {
  display: inline-block;
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
}

.lc-arrow {
  color: #94a3b8;
  font-size: 1rem;
}

/* ── Tab 栏 ── */
.tab-bar {
  display: flex;
  gap: 0;
  margin-bottom: 1rem;
  border-bottom: 2px solid #e5e7eb;
}

.tab-btn {
  padding: 0.6rem 1.2rem;
  border: none;
  background: none;
  font-size: 0.95rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.tab-btn:hover {
  color: #1e40af;
}

.tab-btn.active {
  color: #1e40af;
  border-bottom-color: #1e40af;
  font-weight: 600;
}

.tab-count {
  font-size: 0.78rem;
  background: #dbeafe;
  color: #1e40af;
  padding: 0.1rem 0.45rem;
  border-radius: 10px;
  font-weight: 600;
}

/* ── 筛选栏 ── */
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

.input-narrow {
  width: 100px;
}

/* ── 状态按钮组 ── */
.status-group {
  display: flex;
  gap: 0;
}

.status-btn {
  padding: 0.35rem 0.7rem;
  border: 1px solid #d1d5db;
  background: #fff;
  font-size: 0.85rem;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.status-btn:first-child {
  border-radius: 4px 0 0 4px;
}

.status-btn:last-child {
  border-radius: 0 4px 4px 0;
}

.status-btn:not(:first-child) {
  border-left: none;
}

.status-btn:hover:not(.active) {
  background: #f1f5f9;
  color: #1e40af;
}

.status-btn.active {
  background: #1e40af;
  color: #fff;
  border-color: #1e40af;
}

.status-btn.active + .status-btn {
  border-left-color: #1e40af;
}

/* ── 刷新按钮 ── */
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
  font-size: 0.88rem;
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

.filter-info {
  margin-left: auto;
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.badge {
  font-size: 0.85rem;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.badge.loading {
  background: #fef3c7;
  color: #92400e;
}

.badge.count {
  background: #dbeafe;
  color: #1e40af;
}

.badge.status-count {
  font-size: 0.8rem;
  padding: 0.15rem 0.5rem;
}

/* ── 表格 ── */
.table-wrap {
  position: relative;
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
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
  font-size: 0.9rem;
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

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.data-table thead {
  background: #f8fafc;
}

.data-table th {
  padding: 0.6rem 0.75rem;
  text-align: left;
  font-weight: 600;
  color: #475569;
  border-bottom: 2px solid #e2e8f0;
  white-space: nowrap;
}

.data-table td {
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.data-table tbody tr:hover {
  background: #f8fafc;
}

.col-time {
  white-space: nowrap;
}

.col-actions {
  white-space: nowrap;
}

.empty {
  text-align: center;
  padding: 2rem !important;
  color: #94a3b8;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
  font-size: 0.95rem;
}

/* ── 模型标签 ── */
.model-tag {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  background: #ede9fe;
  color: #6d28d9;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  white-space: nowrap;
}

/* ── 比分/命中/触发次数 ── */
.col-score {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.col-hit {
  text-align: center;
}
.hit-yes { font-size: 1rem; }
.hit-no { font-size: 1rem; }
.col-trigger-count {
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.trigger-multi {
  color: #d97706;
  font-weight: 700;
}

.window-label {
  display: inline-block;
  margin-left: 0.3rem;
  padding: 0.05rem 0.35rem;
  background: #dbeafe;
  color: #2563eb;
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 600;
}

/* ── 队伍 ── */
.team-home {
  font-weight: 500;
}

.team-vs {
  color: #94a3b8;
  margin: 0 0.35rem;
  font-size: 0.85rem;
}

.team-away {
  color: #475569;
}

/* ── 状态徽章 ── */
.status-badge {
  display: inline-block;
  padding: 0.15rem 0.55rem;
  border-radius: 12px;
  font-size: 0.82rem;
  font-weight: 600;
  border: 1px solid;
  white-space: nowrap;
}

/* ── 条件概要 ── */
.condition-summary {
  font-size: 0.85rem;
  color: #64748b;
}

/* ── 操作按钮 ── */
.action-btn {
  padding: 0.25rem 0.55rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.15s;
  margin-right: 4px;
}

.view-btn {
  color: #1e40af;
  border-color: #93c5fd;
}

.view-btn:hover {
  background: #dbeafe;
}

.ack-btn {
  color: #166534;
  border-color: #86efac;
}

.ack-btn:hover {
  background: #dcfce7;
}

.expire-btn {
  color: #991b1b;
  border-color: #fca5a5;
}

.expire-btn:hover {
  background: #fee2e2;
}

/* ── 分页 ── */
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
  font-size: 0.9rem;
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

/* ── 统计卡片 ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.stat-model-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.95rem;
}

.stat-model-id {
  font-size: 0.8rem;
  color: #94a3b8;
  font-family: monospace;
}

.stat-body {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0;
}

.stat-hit-section {
  border-top: 1px dashed #e2e8f0;
}

.stat-hit-title {
  padding: 0.4rem 1rem 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
}

.stat-hit-section .stat-body {
  grid-template-columns: repeat(4, 1fr);
}

.stat-pct {
  display: block;
  font-size: 0.7rem;
  font-weight: 400;
  opacity: 0.7;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 0.5rem;
  border-right: 1px solid #f1f5f9;
}

.stat-item:last-child {
  border-right: none;
}

.stat-label {
  font-size: 0.78rem;
  color: #94a3b8;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.2rem;
  font-weight: 700;
  color: #1e293b;
}

.stat-rate {
  background: #f8fafc;
}

.stat-rate-value {
  color: #1e40af !important;
}

/* ── 详情弹窗 ── */
.popover-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-dialog {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
  width: 680px;
  max-width: 95vw;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: popover-in 0.15s ease-out;
}

@keyframes popover-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.8rem 1.2rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.detail-title {
  font-weight: 700;
  font-size: 1rem;
  color: #1e293b;
}

.popover-close {
  background: none;
  border: none;
  font-size: 1.4rem;
  color: #94a3b8;
  cursor: pointer;
  line-height: 1;
  padding: 0 0.2rem;
}

.popover-close:hover {
  color: #475569;
}

.detail-content {
  padding: 1rem 1.2rem;
  overflow-y: auto;
}

.detail-section {
  margin-bottom: 1.25rem;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-section h4 {
  font-size: 0.9rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.5rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid #f1f5f9;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
}

.detail-table td,
.detail-table th {
  padding: 0.35rem 0.6rem;
  border-bottom: 1px solid #f1f5f9;
}

.detail-table .label {
  color: #64748b;
  width: 110px;
  white-space: nowrap;
  font-weight: 500;
}

.condition-table th {
  text-align: left;
  font-weight: 600;
  color: #475569;
  font-size: 0.82rem;
  background: #f8fafc;
}

.cond-pass {
  color: #166534;
  font-weight: 600;
}

.cond-fail {
  color: #991b1b;
  font-weight: 600;
}
</style>
