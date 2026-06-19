<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { P } from '~/utils/permissions'

interface TierCount { roleId: number | null, tier: string, count: number }
interface LabelCount { label: string, count: number }
interface TrendPoint { date: string, pv: number, uv: number, anonPv: number }
interface AccessOverview {
  begin: string
  end: string
  pageViews: number
  uniqueUsers: number
  anonymousViews: number
  dauToday: number
  pvToday: number
  activeUsers: number
  newUsers: number
  returningUsers: number
  byTier: TierCount[]
  byTierUsers: TierCount[]
  byViewMode: LabelCount[]
  topPaths: LabelCount[]
  trend: TrendPoint[]
  hourly: { hour: number, count: number }[]
}
interface TrailRow { id: number, path: string, viewMode: string | null, sessionId: string | null, ip: string | null, createdAt: string }
interface UserTrail { userId: number, total: number, sessionCount: number, page: number, pageSize: number, rows: TrailRow[] }
interface PathRow { id: number, userId: number | null, userName: string | null, tier: string, viewMode: string | null, ip: string | null, createdAt: string }
interface PathTrail { path: string, total: number, page: number, pageSize: number, rows: PathRow[] }

const api = useAdminApi()
const { can } = usePermission()
const message = useMessage()

// ── 区间筛选 ──
function dayMs(offsetDays: number): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.getTime()
}
const range = ref<[number, number]>([dayMs(0), dayMs(0)])   // 默认今日
function toYmd(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function quickRange(days: number) {
  range.value = [dayMs(-(days - 1)), dayMs(0)]
  loadOverview()
}
function quickDay(offset: number) {
  range.value = [dayMs(offset), dayMs(offset)]
  loadOverview()
}

const overview = ref<AccessOverview | null>(null)
const loading = ref(false)

async function loadOverview() {
  loading.value = true
  const res = await api.get<AccessOverview>('analytics/overview', {
    begin: toYmd(range.value[0]),
    end: toYmd(range.value[1]),
  })
  loading.value = false
  overview.value = res.code === 0 ? res.data : null
}

// ── SVG 迷你趋势图（PV / UV 两条线 + hover tooltip，无图表库依赖）──
const hoverIdx = ref<number | null>(null)
const chart = computed(() => {
  const pts = overview.value?.trend ?? []
  if (pts.length < 1) return null
  const W = 760, H = 150, pad = 6
  const max = Math.max(1, ...pts.map(p => Math.max(p.pv, p.uv)))
  const x = (i: number) => (pts.length === 1 ? W / 2 : pad + (W - pad * 2) * (i / (pts.length - 1)))
  const y = (v: number) => pad + (H - pad * 2) * (1 - v / max)
  const line = (key: 'pv' | 'uv') => (pts.length < 2 ? '' : pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' '))
  const points = pts.map((p, i) => ({
    xPct: +(x(i) / W * 100).toFixed(2),
    pvTop: +(y(p.pv) / H * 100).toFixed(2),
    uvTop: +(y(p.uv) / H * 100).toFixed(2),
    date: p.date, pv: p.pv, uv: p.uv, anonPv: p.anonPv,
  }))
  return { W, H, max, pv: line('pv'), uv: line('uv'), points, first: pts[0]!.date, last: pts[pts.length - 1]!.date }
})

const tierMax = computed(() => Math.max(1, ...(overview.value?.byTier ?? []).map(t => t.count)))
const modeMax = computed(() => Math.max(1, ...(overview.value?.byViewMode ?? []).map(m => m.count)))

// 各会籍去重人数 → roleId 映射
const tierUsersMap = computed(() => {
  const m = new Map<number, number>()
  for (const t of overview.value?.byTierUsers ?? []) if (t.roleId != null) m.set(t.roleId, t.count)
  return m
})
function tierUsers(roleId: number | null): string {
  if (roleId == null) return '—'
  return `${tierUsersMap.value.get(roleId) ?? 0} 人`
}

// 时段分布 24 柱
const hourMax = computed(() => Math.max(1, ...(overview.value?.hourly ?? []).map(h => h.count)))

// 页面访问明细弹窗（需 analytics.user.tracking）
const showPath = ref(false)
const pathOf = ref('')
const pathTrail = ref<PathTrail | null>(null)
const pathLoading = ref(false)
async function openPath(p: string) {
  if (!canTrack) return
  pathOf.value = p
  showPath.value = true
  pathTrail.value = null
  pathLoading.value = true
  const res = await api.get<PathTrail>('analytics/path', {
    path: p, begin: toYmd(range.value[0]), end: toYmd(range.value[1]), page: 1, pageSize: 100,
  })
  pathLoading.value = false
  pathTrail.value = res.code === 0 ? res.data : null
}
const pathColumns = [
  { title: '时间', key: 'createdAt', width: 170 },
  { title: '用户', key: 'userName', render: (r: PathRow) => (r.userName ? `${r.userName}${r.userId ? ` #${r.userId}` : ''}` : '匿名') },
  { title: '会籍', key: 'tier', width: 90 },
  { title: '端', key: 'viewMode', width: 70, render: (r: PathRow) => modeLabel(r.viewMode) },
  { title: 'IP', key: 'ip', width: 140 },
]

// ── 单用户访问追踪 ──
const canTrack = can(P.analyticsUserTracking)
const trackUserId = ref<number | null>(null)
const trail = ref<UserTrail | null>(null)
const trailLoading = ref(false)

async function loadTrail() {
  if (!trackUserId.value || trackUserId.value <= 0) { message.warning('请输入用户 ID'); return }
  trailLoading.value = true
  const res = await api.get<UserTrail>(`analytics/user/${trackUserId.value}`, {
    begin: toYmd(range.value[0]),
    end: toYmd(range.value[1]),
    page: 1,
    pageSize: 100,
  })
  trailLoading.value = false
  if (res.code === 0) { trail.value = res.data }
  else { trail.value = null; message.error(res.message || '查询失败') }
}

const trailColumns = [
  { title: '时间', key: 'createdAt', width: 170 },
  { title: '页面', key: 'path' },
  { title: '端', key: 'viewMode', width: 80, render: (r: TrailRow) => modeLabel(r.viewMode) },
  { title: 'IP', key: 'ip', width: 140 },
]
function modeLabel(m: string | null) {
  return m === 'modern' ? '新版' : m === 'classic' ? '经典' : m === 'mobile' ? '移动端' : '—'
}

onMounted(loadOverview)
</script>

<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-xl font-semibold">用户访问统计</h2>
      <NSpace align="center">
        <NButton size="small" @click="quickDay(0)">今日</NButton>
        <NButton size="small" @click="quickDay(-1)">昨日</NButton>
        <NButton size="small" @click="quickDay(-2)">前日</NButton>
        <NButton size="small" @click="quickRange(7)">近 7 天</NButton>
        <NButton size="small" @click="quickRange(30)">近 30 天</NButton>
        <NDatePicker v-model:value="range" type="daterange" :is-date-disabled="(ts: number) => ts > Date.now()" />
        <NButton type="primary" :loading="loading" @click="loadOverview">查询</NButton>
      </NSpace>
    </div>

    <NSpin :show="loading">
      <!-- 概览指标卡 -->
      <NGrid :cols="5" :x-gap="12" responsive="screen" class="mb-4">
        <NGi><NCard size="small"><NStatistic label="区间 PV" :value="overview?.pageViews ?? '—'" /></NCard></NGi>
        <NGi><NCard size="small"><NStatistic label="活跃用户(去重)" :value="overview?.activeUsers ?? '—'" /></NCard></NGi>
        <NGi><NCard size="small"><NStatistic label="匿名 PV" :value="overview?.anonymousViews ?? '—'" /></NCard></NGi>
        <NGi><NCard size="small"><NStatistic label="今日 PV" :value="overview?.pvToday ?? '—'" /></NCard></NGi>
        <NGi><NCard size="small"><NStatistic label="今日 DAU" :value="overview?.dauToday ?? '—'" /></NCard></NGi>
      </NGrid>

      <!-- 趋势图 -->
      <NCard size="small" title="访问趋势（按天）" class="mb-4">
        <div v-if="chart" class="trend-wrap">
          <div class="trend-legend">
            <span><i class="dot pv" /> PV</span>
            <span><i class="dot uv" /> UV(去重用户)</span>
            <span class="trend-max">峰值 {{ chart.max }}</span>
          </div>
          <svg class="trend-svg" :viewBox="`0 0 ${chart.W} ${chart.H}`" preserveAspectRatio="none">
            <path :d="chart.pv" fill="none" stroke="#7c5cfa" stroke-width="2" vector-effect="non-scaling-stroke" />
            <path :d="chart.uv" fill="none" stroke="#18a058" stroke-width="2" vector-effect="non-scaling-stroke" />
          </svg>
          <div class="trend-axis">
            <span>{{ chart.first }}</span>
            <span>{{ chart.last }}</span>
          </div>
        </div>
        <NEmpty v-else description="所选区间暂无足够数据绘制趋势" />
      </NCard>

      <NGrid :cols="2" :x-gap="12" responsive="screen" class="mb-4">
        <!-- 热门页面 -->
        <NGi>
          <NCard size="small" title="热门页面 Top 10">
            <template v-if="canTrack" #header-extra>
              <span class="text-gray-400" style="font-size:12px">点击行看访问明细</span>
            </template>
            <NEmpty v-if="!overview?.topPaths.length" description="暂无数据" />
            <table v-else class="brk-table">
              <tbody>
                <tr v-for="p in overview.topPaths" :key="p.label" :class="{ clickable: canTrack }" @click="openPath(p.label)">
                  <td class="brk-label">{{ p.label }}</td>
                  <td class="brk-num">{{ p.count }}</td>
                </tr>
              </tbody>
            </table>
          </NCard>
        </NGi>
        <!-- 会籍 + 端 分布 -->
        <NGi>
          <NCard size="small" title="会籍分布" class="mb-3">
            <NEmpty v-if="!overview?.byTier.length" description="暂无数据" />
            <div v-for="t in overview?.byTier" v-else :key="String(t.roleId)" class="brk-bar-row tier4">
              <span class="brk-bar-label">{{ t.tier }}</span>
              <span class="brk-bar"><i :style="{ width: `${(t.count / tierMax) * 100}%` }" /></span>
              <span class="brk-bar-num">{{ t.count }}</span>
              <span class="brk-bar-users">{{ tierUsers(t.roleId) }}</span>
            </div>
          </NCard>
          <NCard size="small" title="端分布（新版 / 经典 / 移动端）">
            <NEmpty v-if="!overview?.byViewMode.length" description="暂无数据" />
            <div v-for="m in overview?.byViewMode" v-else :key="m.label" class="brk-bar-row">
              <span class="brk-bar-label">{{ m.label }}</span>
              <span class="brk-bar"><i :style="{ width: `${(m.count / modeMax) * 100}%` }" /></span>
              <span class="brk-bar-num">{{ m.count }}</span>
            </div>
          </NCard>
        </NGi>
      </NGrid>

      <!-- 时段分布 + 新老访客 -->
      <NGrid :cols="3" :x-gap="12" responsive="screen" class="mb-4">
        <NGi :span="2">
          <NCard size="small" title="时段分布（按小时·北京时间）">
            <NEmpty v-if="!overview?.hourly?.length" description="暂无数据" />
            <div v-else class="hours">
              <div v-for="h in overview.hourly" :key="h.hour" class="hour-col" :title="`${h.hour}:00 — ${h.count} 次`">
                <span class="hour-bar"><i :style="{ height: `${(h.count / hourMax) * 100}%` }" /></span>
                <span class="hour-label">{{ h.hour % 6 === 0 || h.hour === 23 ? h.hour : '' }}</span>
              </div>
            </div>
          </NCard>
        </NGi>
        <NGi :span="1">
          <NCard size="small" title="新老访客（区间内活跃登录用户）">
            <div class="nr">
              <div class="nr-item"><b class="nr-new">{{ overview?.newUsers ?? '—' }}</b><span>新访客</span></div>
              <div class="nr-item"><b class="nr-ret">{{ overview?.returningUsers ?? '—' }}</b><span>回访</span></div>
            </div>
            <div v-if="overview && (overview.newUsers + overview.returningUsers) > 0" class="nr-bar">
              <i :style="{ width: `${(overview.newUsers / (overview.newUsers + overview.returningUsers)) * 100}%` }" />
            </div>
            <p class="nr-hint">新 = 区间内首次出现的登录用户；回访 = 此前已来过（受 90 天留存范围影响）。</p>
          </NCard>
        </NGi>
      </NGrid>

      <!-- 单用户追踪 -->
      <NCard v-if="canTrack" size="small" title="单用户访问追踪">
        <NSpace class="mb-3" align="center">
          <NInputNumber v-model:value="trackUserId" :show-button="false" placeholder="用户 ID" style="width:160px" />
          <NButton type="primary" :loading="trailLoading" @click="loadTrail">查询轨迹</NButton>
          <span v-if="trail" class="text-gray-500">共 {{ trail.total }} 条访问 · {{ trail.sessionCount }} 个会话（区间内）</span>
        </NSpace>
        <NDataTable
          v-if="trail"
          :columns="trailColumns"
          :data="trail.rows"
          :max-height="420"
          size="small"
        />
      </NCard>
    </NSpin>

    <NModal v-model:show="showPath" preset="card" :title="`页面访问明细 · ${pathOf}`" style="width:760px">
      <NSpin :show="pathLoading">
        <div v-if="pathTrail" class="mb-2 text-gray-500">共 {{ pathTrail.total }} 次访问（区间内，最多显示 100 条）</div>
        <NDataTable v-if="pathTrail" :columns="pathColumns" :data="pathTrail.rows" :max-height="460" size="small" />
        <NEmpty v-else-if="!pathLoading" description="暂无明细" />
      </NSpin>
    </NModal>
  </div>
</template>

<style scoped>
.trend-wrap { display: flex; flex-direction: column; gap: 6px; }
.trend-legend { display: flex; gap: 18px; align-items: center; font-size: 13px; color: #666; }
.trend-legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
.trend-legend .dot.pv { background: #7c5cfa; }
.trend-legend .dot.uv { background: #18a058; }
.trend-max { margin-left: auto; color: #999; }
.trend-svg { width: 100%; height: 150px; display: block; }
.trend-axis { display: flex; justify-content: space-between; font-size: 12px; color: #999; }

.brk-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.brk-table td { padding: 6px 4px; border-bottom: 1px solid #f0f0f0; }
.brk-label { color: #333; word-break: break-all; }
.brk-num { text-align: right; font-weight: 600; width: 80px; color: #7c5cfa; }

.brk-bar-row { display: grid; grid-template-columns: 80px 1fr 60px; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 13px; }
.brk-bar-label { color: #333; }
.brk-bar { height: 10px; background: #f0f0f3; border-radius: 5px; overflow: hidden; }
.brk-bar i { display: block; height: 100%; background: #7c5cfa; }
.brk-bar-num { text-align: right; font-weight: 600; color: #555; }

.brk-bar-row.tier4 { grid-template-columns: 72px 1fr 52px 52px; }
.brk-bar-users { text-align: right; color: #18a058; font-size: 12px; }
.brk-table tr.clickable { cursor: pointer; }
.brk-table tr.clickable:hover { background: #f5f3ff; }

/* 时段分布 24 柱 */
.hours { display: flex; align-items: flex-end; gap: 3px; height: 130px; padding-top: 8px; }
.hour-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.hour-bar { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.hour-bar i { display: block; width: 100%; min-height: 1px; background: #7c5cfa; border-radius: 2px 2px 0 0; }
.hour-label { height: 16px; line-height: 16px; font-size: 11px; color: #999; }

/* 新老访客 */
.nr { display: flex; gap: 24px; padding: 4px 0 10px; }
.nr-item { display: flex; flex-direction: column; }
.nr-item b { font-size: 26px; font-weight: 700; line-height: 1.1; }
.nr-item span { font-size: 12px; color: #999; }
.nr-new { color: #7c5cfa; }
.nr-ret { color: #18a058; }
.nr-bar { height: 8px; background: #18a058; border-radius: 4px; overflow: hidden; }
.nr-bar i { display: block; height: 100%; background: #7c5cfa; }
.nr-hint { margin: 8px 0 0; font-size: 12px; color: #999; line-height: 1.5; }
</style>
