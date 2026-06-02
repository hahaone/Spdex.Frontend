<script setup lang="ts">
import { ArrowLeft, BarChart3, Clock, Lock, RefreshCw } from '@lucide/vue'
import type { MarketMetricRow, MarketTab } from '~/types/market'
import type { MatchSnapshot } from '~/composables/useMatchSnapshot'

const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))

const { entitlements } = useAuth()
const { detail, access, euroOdds, pending, refresh } = useMatchDetail(eventId)
const { points: chartPoints, status: chartStatus, refresh: refreshChart } = useChartSeries(eventId, ref('1X2'))
const { fetchSnapshot } = useMatchSnapshot()

// 时光机：现在 / -1h / -2h / -6h / -12h / -24h
const timeMachinePoints = [
  { label: '现在', hours: 0 },
  { label: '-1h', hours: -1 },
  { label: '-2h', hours: -2 },
  { label: '-6h', hours: -6 },
  { label: '-12h', hours: -12 },
  { label: '-24h', hours: -24 },
]
const activeTimeOffset = ref<number | null>(null)
const snapshot = ref<MatchSnapshot | null>(null)
const snapshotLoading = ref(false)
const hasTimeMachine = computed(() => entitlements.value?.timeMachine === true)

async function selectTimePoint(hours: number) {
  if (hours === 0) {
    activeTimeOffset.value = null
    snapshot.value = null
    return
  }
  if (!hasTimeMachine.value) return
  if (!detail.value?.match) return

  snapshotLoading.value = true
  activeTimeOffset.value = hours
  const matchTime = new Date(detail.value.match.matchTime)
  const targetTime = new Date(matchTime.getTime() + hours * 3600 * 1000)
  const iso = targetTime.toISOString().slice(0, 19)
  snapshot.value = await fetchSnapshot(eventId.value, iso)
  snapshotLoading.value = false
}

const effectiveStandard = computed(() => snapshot.value?.standard ?? detail.value?.standard ?? [])
const effectiveGoals = computed(() => snapshot.value?.goals ?? detail.value?.goals ?? [])
const effectiveHandicap = computed(() => snapshot.value?.handicap ?? detail.value?.handicap ?? [])
const isSnapshotMode = computed(() => snapshot.value !== null)

// B1：进球/让分去掉独立"盘口"行，盘口线挪到卡片标题并格式化为 2 位小数（>2.50 / -1.50）
function fmtLine(s: string): string {
  return (s || '').replace(/-?\d+(?:\.\d+)?/g, m => Number.parseFloat(m).toFixed(2))
}
function dropLineRow(rows: MarketMetricRow[]): MarketMetricRow[] {
  return rows.filter(r => r.key !== 'line')
}
function lineLabel(rows: MarketMetricRow[]): string {
  return fmtLine(rows.find(r => r.key === 'line')?.price ?? '')
}
const goalsLine = computed(() => lineLabel(effectiveGoals.value))
const handicapLine = computed(() => lineLabel(effectiveHandicap.value))
const goalsRows = computed(() => dropLineRow(effectiveGoals.value))
const handicapRows = computed(() => dropLineRow(effectiveHandicap.value))

const goalsTitle = computed(() => {
  const base = isSnapshotMode.value ? `进球（${snapshot.value?.actualHoursOffset}h 前）` : '进球'
  return goalsLine.value ? `${base} ${goalsLine.value}` : base
})
const handicapTitle = computed(() => {
  const base = isSnapshotMode.value ? `让分（${snapshot.value?.actualHoursOffset}h 前）` : '让分'
  return handicapLine.value ? `${base} ${handicapLine.value}` : base
})

const tab = ref<MarketTab>('all')
const options = [
  { label: '全部', value: 'all' },
  { label: '标盘', value: 'standard' },
  { label: 'Poly', value: 'poly' },
  { label: '进球', value: 'goals' },
  { label: '让分', value: 'handicap' },
  { label: '比分', value: 'cs' },
  { label: '角球', value: 'corner' },
]

type SectionKey = 'standard' | 'poly' | 'goals' | 'handicap' | 'cs' | 'corner'

const sectionMode = computed<SectionKey | null>(() =>
  tab.value === 'all' ? null : (tab.value as SectionKey))

const sectionRows = computed(() => {
  if (!sectionMode.value || !detail.value) return []
  const rows = detail.value[sectionMode.value]
  // 进球/让分去掉"盘口"行（与全部页一致）
  return (sectionMode.value === 'goals' || sectionMode.value === 'handicap') ? dropLineRow(rows) : rows
})

const sectionTitle = computed(() => {
  switch (sectionMode.value) {
    case 'standard': return '标盘核心'
    case 'poly': return 'Poly 核心'
    case 'goals': return goalsLine.value ? `进球核心 ${goalsLine.value}` : '进球核心'
    case 'handicap': return handicapLine.value ? `让分核心 ${handicapLine.value}` : '让分核心'
    case 'cs': return '比分 CS Top 6'
    case 'corner': return '角球 区间分布'
    default: return ''
  }
})

const match = computed(() => detail.value?.match)

function jumpTo(target: SectionKey) {
  tab.value = target
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>

<template>
  <div class="detail-page">
    <div v-if="pending && !detail" class="loading">加载赛事中…</div>
    <div v-else-if="!detail" class="empty">赛事不存在或暂无可用数据</div>

    <template v-else-if="match">
      <section class="match-header">
        <NuxtLink to="/football" class="back focus-ring">
          <ArrowLeft :size="15" />
          <span>返回赛事</span>
        </NuxtLink>
        <div class="header-row">
          <div class="header-main">
            <div class="league-line">
              <span v-if="match.leagueCode" class="code">{{ match.leagueCode }}</span>
              <span>{{ match.leagueName }}</span>
              <span class="num kick">{{ match.matchTime.slice(11, 16) }}</span>
              <span v-if="match.isJc" class="tag tag-brand">竞彩</span>
              <span class="tag tag-mute">{{ match.marketType }}</span>
            </div>
            <div class="teams">
              <span class="team home">{{ match.homeTeam }}</span>
              <b class="handicap">{{ match.handicap || '—' }}</b>
              <span class="team away">{{ match.awayTeam }}</span>
            </div>
            <div class="meta-row">
              <span>开赛 {{ match.matchTime.slice(0, 10) }}</span>
              <span class="dot">·</span>
              <span>状态 {{ match.status === 'upcoming' ? '未开赛' : match.status === 'started' ? '进行中' : '已完场' }}</span>
              <span v-for="flag in match.flags" :key="flag" class="tag tag-signal">{{ flag }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="tab-band">
        <div class="tab-row">
          <span class="band-label">指数成交</span>
          <SegmentedControl v-model="tab" :options="options" dense tone="accent" />
        </div>
      </section>

      <section class="time-machine-band">
        <div class="tm-head">
          <Clock :size="13" />
          <b>时光机</b>
          <span v-if="!hasTimeMachine" class="tm-lock">
            <Lock :size="11" /> 黄金及以上可用
          </span>
          <span v-if="isSnapshotMode" class="tm-active num">
            实际匹配偏移 {{ snapshot?.actualHoursOffset }}h
          </span>
        </div>
        <div class="tm-buttons">
          <button
            v-for="pt in timeMachinePoints"
            :key="pt.hours"
            type="button"
            :class="['tm-btn focus-ring', { active: pt.hours === 0 ? !isSnapshotMode : activeTimeOffset === pt.hours, disabled: !hasTimeMachine && pt.hours !== 0 }]"
            :disabled="!hasTimeMachine && pt.hours !== 0"
            @click="selectTimePoint(pt.hours)"
          >
            {{ pt.label }}
          </button>
        </div>
      </section>

      <div class="detail-grid">
        <div class="main-col">
          <section v-if="tab === 'all'" class="all-grid">
            <template v-if="access.standard">
              <MarketSummaryCard
                :title="isSnapshotMode ? `标盘（${snapshot?.actualHoursOffset}h 前）` : '标盘'"
                tone="standard"
                :rows="effectiveStandard"
                index-label="必指"
                @open="jumpTo('standard')"
              />
            </template>
            <div v-else class="access-card">
              <Lock :size="14" />
              <span>标盘数据未对当前会籍开放</span>
            </div>

            <MarketSummaryCard
              v-if="detail.poly.length"
              title="Poly"
              tone="poly"
              :rows="detail.poly"
              index-label="P指"
              turnover-prefix="$"
              @open="jumpTo('poly')"
            />
            <div v-else class="access-card poly">
              <span>本场暂无 Poly 成交数据</span>
            </div>

            <template v-if="access.goals">
              <MarketSummaryCard
                :title="goalsTitle"
                tone="goals"
                :rows="goalsRows"
                index-label="必指"
                @open="jumpTo('goals')"
              />
            </template>
            <div v-else class="access-card">
              <Lock :size="14" />
              <span>进球数据未对当前会籍开放</span>
            </div>

            <template v-if="access.handicap">
              <MarketSummaryCard
                :title="handicapTitle"
                tone="handicap"
                :rows="handicapRows"
                index-label="必指"
                @open="jumpTo('handicap')"
              />
            </template>
            <div v-else class="access-card">
              <Lock :size="14" />
              <span>让分数据未对当前会籍开放</span>
            </div>

            <template v-if="access.cs">
              <MarketSummaryCard
                v-if="detail.cs.length"
                title="比分 CS"
                tone="goals"
                :rows="detail.cs.slice(0, 3)"
                index-label="大注"
                index-format="amount"
                @open="jumpTo('cs')"
              />
            </template>
            <div v-else class="access-card">
              <Lock :size="14" />
              <span>比分 · 白金会员专属</span>
            </div>

            <template v-if="access.corner">
              <MarketSummaryCard
                v-if="detail.corner.length"
                title="角球"
                tone="goals"
                :rows="detail.corner"
                index-label="区间"
                wide-option
                @open="jumpTo('corner')"
              />
            </template>
            <div v-else class="access-card">
              <Lock :size="14" />
              <span>角球 · 白金会员专属</span>
            </div>
          </section>

          <template v-else-if="sectionMode">
            <div
              v-if="(sectionMode === 'cs' && !access.cs) || (sectionMode === 'corner' && !access.corner)"
              class="access-card"
            >
              <Lock :size="14" />
              <span>{{ sectionMode === 'cs' ? '比分' : '角球' }} · 白金会员专属</span>
            </div>
            <MarketMetricTable v-else :title="sectionTitle" :rows="sectionRows" :mode="sectionMode" />
          </template>
        </div>

        <aside class="side-col">
          <section class="chart-preview">
            <div class="chart-title-row">
              <h2>走势图</h2>
              <div class="chart-actions">
                <NuxtLink :to="`/football/${match.eventId}/chart`" class="more-link focus-ring">
                  <span>更多</span>
                  <BarChart3 :size="14" />
                </NuxtLink>
                <button class="icon-link focus-ring" aria-label="刷新" @click="refresh(); refreshChart()">
                  <RefreshCw :size="15" />
                </button>
              </div>
            </div>
            <StaticTrendChart v-if="chartPoints.length" :points="chartPoints" :height="180" />
            <div v-else class="chart-empty">
              {{ chartStatus === 'pending' ? '走势图待接入' : '暂无走势' }}
            </div>
          </section>

          <BigTradesSummary v-if="access.tradeDetails" :event-id="match.eventId" />

          <EuroOddsTable v-if="access.euroOdds && euroOdds" :euro="euroOdds" />
          <section v-else-if="!access.euroOdds" class="access-card">
            <Lock :size="14" />
            <span>欧赔数据未对当前会籍开放</span>
          </section>

          <LadderPanel v-if="access.tradeDetails" :event-id="match.eventId" />
          <section v-else class="access-card">
            <Lock :size="14" />
            <span>盘口明细未对当前会籍开放</span>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail-page {
  display: grid;
  /* 单列且可收缩：约束列宽为容器宽度，宽内容（表格）内部滚动而非撑大整页。 */
  grid-template-columns: minmax(0, 1fr);
}

.loading,
.empty {
  padding: 40px 16px;
  text-align: center;
  color: var(--muted);
  font-size: 0.86rem;
  font-weight: 720;
}

.access-card {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border: 1px dashed var(--line);
  border-radius: 6px;
  background: #f9fafc;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 720;
}

.access-card.poly {
  border-color: var(--lavender-strong);
  background: #faf8fd;
  color: var(--accent);
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 180px;
  border: 1px dashed var(--line);
  border-radius: 4px;
  background: #f9fafc;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 720;
}

.match-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
  padding: 8px 12px 10px;
  background: linear-gradient(180deg, var(--panel) 0%, var(--surface) 100%);
  border-bottom: 1px solid var(--divider);
}

.back {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 4px;
  color: var(--brand);
  font-size: 0.78rem;
  font-weight: 740;
}

.header-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
}

.header-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
}

.league-line {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  font-weight: 760;
  color: var(--ink);
}

.code {
  padding: 0 5px;
  border-radius: 3px;
  background: #1a2233;
  color: #fff;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  line-height: 1.5;
}

.kick {
  margin-left: 4px;
  color: var(--muted);
  font-size: 0.76rem;
}

.teams {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  text-align: center;
}

.team {
  min-width: 0;
  overflow: hidden;
  font-size: 1.02rem;
  font-weight: 820;
  letter-spacing: 0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 限定在赛事头内，避免 scoped 样式经子组件根继承泄漏到 .summary-card.handicap 卡片。 */
.teams .handicap {
  padding: 2px 8px;
  border-radius: 3px;
  background: var(--brand);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.meta-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 720;
}

.dot {
  opacity: 0.4;
}

.tab-band {
  padding: 8px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
}

.tab-row {
  display: grid;
  /* 移动端：标签隐藏，tab 占满整行（容纳 7 个 tab 不溢出）。桌面端恢复 标签+tab 双列。 */
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.band-label {
  display: none;
  font-size: 0.86rem;
  font-weight: 800;
  color: var(--accent-deep);
}

.detail-grid {
  display: grid;
  /* 移动端单列，桌面端在 @media(min-width:1024px) 改为双列。 */
  grid-template-columns: minmax(0, 1fr);
  /* 作为 .detail-page 的网格项，允许收缩到列宽，避免侧栏宽表格把整页撑出视口。 */
  min-width: 0;
}

/* 主/侧两列允许收缩，避免内部宽内容把整列撑出视口。 */
.main-col,
.side-col {
  min-width: 0;
}

.all-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  padding: 10px 10px;
  background: var(--surface);
}

.chart-preview {
  padding: 10px 12px;
  background: var(--panel);
  border-top: 1px solid var(--divider);
}

.chart-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.chart-title-row h2 {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 820;
}

.chart-actions {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.more-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--brand);
  font-size: 0.76rem;
  font-weight: 760;
  text-decoration: none;
}

.icon-link {
  display: inline-grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--muted);
}

.icon-link:active {
  background: var(--surface);
}

.quick-stats {
  padding: 10px 12px;
  background: var(--panel);
  border-top: 1px solid var(--divider);
}

.quick-stats h3 {
  margin: 0 0 8px;
  font-size: 0.84rem;
  font-weight: 800;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 0;
  border-top: 1px solid var(--canvas);
  font-size: 0.8rem;
  font-weight: 720;
  color: var(--muted);
}

.stat-row:first-of-type {
  border-top: 0;
}

.stat-row b {
  color: var(--ink);
  font-weight: 780;
}

@media (min-width: 1024px) {
  .detail-page {
    padding: 16px 0;
    gap: 12px;
  }

  .match-header {
    border-radius: 6px;
    padding: 14px 18px;
    border: 1px solid var(--line);
  }

  .header-main {
    gap: 8px;
  }

  .teams .team {
    font-size: 1.24rem;
  }

  .teams .handicap {
    font-size: 0.96rem;
  }

  .tab-band {
    border-radius: 6px;
    padding: 12px 16px;
    border: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }

  .tab-row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .band-label {
    display: block;
  }

  .detail-grid {
    grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.7fr);
    gap: 14px;
    align-items: start;
  }

  .main-col,
  .side-col {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .all-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 0;
    background: transparent;
  }

  .chart-preview,
  .quick-stats {
    border-radius: 6px;
    border: 1px solid var(--line);
    border-top: 1px solid var(--line);
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .all-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* ─── 时光机 ─── */
.time-machine-band {
  display: grid;
  gap: 5px;
  padding: 7px 12px;
  background: linear-gradient(180deg, #faf8fd 0%, #f3edf9 100%);
  border-bottom: 1px solid var(--divider);
}

.tm-head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--accent-deep);
  font-size: 0.78rem;
  font-weight: 760;
}

.tm-head b {
  font-weight: 800;
}

.tm-lock {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 2px;
  background: var(--away-bg);
  color: #8a6212;
  font-size: 0.7rem;
  font-weight: 740;
}

.tm-active {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 2px;
  background: var(--accent);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 800;
}

.tm-buttons {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 4px;
}

.tm-btn {
  min-height: 28px;
  padding: 0 6px;
  border: 1px solid var(--lavender-strong);
  border-radius: 4px;
  background: var(--panel);
  color: var(--accent-deep);
  font-size: 0.78rem;
  font-weight: 720;
  cursor: pointer;
}

.tm-btn:hover:not(.disabled):not(:disabled) {
  border-color: var(--accent);
}

.tm-btn.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
  font-weight: 800;
}

.tm-btn:disabled,
.tm-btn.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

</style>
