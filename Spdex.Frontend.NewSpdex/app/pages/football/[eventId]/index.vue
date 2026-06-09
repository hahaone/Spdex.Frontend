<script setup lang="ts">
import { ArrowLeft, BarChart3, Clock, Lock, RefreshCw, Zap } from '@lucide/vue'
import type { MarketMetricRow, MarketTab } from '~/types/market'
import type { MatchSnapshot } from '~/composables/useMatchSnapshot'
import { formatHandicapLine } from '~/utils/handicap'

const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))

const { entitlements } = useAuth()
const { detail, access, euroOdds, pending, refresh } = useMatchDetail(eventId)
const { points: chartPoints, status: chartStatus, refresh: refreshChart } = useChartSeries(eventId, ref('1X2'))
const { fetchSnapshot } = useMatchSnapshot()
const { buildFlashQLink } = useFlashQLink()
const { canOpenFlashQ, flashQLockMessage } = useFlashQAccess()
const flashQUrl = computed(() => buildFlashQLink(eventId.value))
const footballBackRoute = computed(() => {
  const query: Record<string, string> = {}
  for (const key of ['date', 'day', 'status', 'lottery', 'league', 'metric', 'events']) {
    const value = route.query[key]
    if (typeof value === 'string' && value) query[key] = value
  }
  return Object.keys(query).length ? { path: '/football', query } : '/football'
})

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
function fmtHandicapLine(s: string): string {
  return formatHandicapLine(s, { fixed: 2 })
}
function dropLineRow(rows: MarketMetricRow[]): MarketMetricRow[] {
  return rows.filter(r => r.key !== 'line')
}
function lineLabel(rows: MarketMetricRow[], signed = false): string {
  const raw = rows.find(r => r.key === 'line')?.price ?? ''
  return signed ? fmtHandicapLine(raw) : fmtLine(raw)
}
const goalsLine = computed(() => lineLabel(effectiveGoals.value))
const handicapLine = computed(() => lineLabel(effectiveHandicap.value, true))
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
const baseOptions = [
  { label: '全部', value: 'all' },
  { label: '标盘', value: 'standard' },
  { label: 'Poly', value: 'poly' },
  { label: '进球', value: 'goals' },
  { label: '让分', value: 'handicap' },
  { label: '比分', value: 'cs' },
  { label: '角球', value: 'corner' },
]
const options = computed(() => baseOptions.filter(option =>
  option.value !== 'poly' || (detail.value?.poly.length ?? 0) > 0))

watchEffect(() => {
  if (tab.value === 'poly' && !(detail.value?.poly.length)) {
    tab.value = 'all'
  }
})

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

const sectionLockMessage = computed(() => {
  switch (sectionMode.value) {
    case 'standard': return access.value.standard ? '' : '标盘数据未对当前会籍开放'
    case 'goals': return access.value.goals ? '' : '进球数据未对当前会籍开放'
    case 'handicap': return access.value.handicap ? '' : '让分数据未对当前会籍开放'
    case 'cs': return access.value.cs ? '' : '比分 · 白金会员专属'
    case 'corner': return access.value.corner ? '' : '角球 · 白金会员专属'
    default: return ''
  }
})

// 锁定项合并到一张升级卡：列出未对当前会籍开放的功能（替代散落的 dashed 空卡）
const lockedFeatures = computed(() => {
  const f: string[] = []
  if (!access.value.standard) f.push('标盘')
  if (!access.value.goals) f.push('进球')
  if (!access.value.handicap) f.push('让分')
  if (!access.value.cs) f.push('比分')
  if (!access.value.corner) f.push('角球')
  if (!access.value.euroOdds) f.push('欧赔')
  if (!access.value.tradeDetails) f.push('盘口明细')
  return f
})

// 是否有任意可见数据（盘口/Poly/欧赔/成交/走势之一）。
// 全锁（免费会籍）→ 主区单列居中升级 hero；有任意解锁 → 网格 + 末尾合并升级条。
const hasUnlockedData = computed(() => {
  const d = detail.value
  return !!(
    access.value.standard
    || d?.poly.length
    || access.value.goals
    || access.value.handicap
    || (access.value.cs && d?.cs.length)
    || (access.value.corner && d?.corner.length)
    || access.value.euroOdds
    || access.value.tradeDetails
    || chartPoints.value.length
  )
})

const sectionLabelMap: Record<SectionKey, string> = {
  standard: '标盘', poly: 'Poly', goals: '进球', handicap: '让分', cs: '比分', corner: '角球',
}
const sectionLockLabel = computed(() => (sectionMode.value ? sectionLabelMap[sectionMode.value] : ''))

const match = computed(() => detail.value?.match)
const ladderMarket = ref<'standard' | 'goals' | 'cs'>('standard')
const ladderAnchor = ref<HTMLElement | null>(null)

function chartRoute(marketName: string, metricName: string, series?: 'home' | 'draw' | 'away') {
  const query: Record<string, string> = { market: marketName, metric: metricName }
  if (series) query.series = series
  return { path: `/football/${eventId.value}/chart`, query }
}

function parseAmountText(value: string | undefined): number {
  if (!value) return 0
  const n = Number.parseFloat(value.replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function sumTurnover(rows: MarketMetricRow[]): number {
  return rows.reduce((sum, row) => sum + parseAmountText(row.turnover), 0)
}

const goalsBalance = computed(() => {
  const standard = sumTurnover(effectiveStandard.value)
  const goals = sumTurnover(goalsRows.value)
  if (standard <= 0 || goals <= 0) return ''
  return ((goals / standard) * 10).toFixed(2)
})

function jumpTo(target: SectionKey) {
  tab.value = target
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function openLadderMarket(target: 'standard' | 'goals' | 'cs') {
  ladderMarket.value = target
  nextTick(() => {
    ladderAnchor.value?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  })
}
</script>

<template>
  <div class="detail-page">
    <div v-if="pending && !detail" class="loading" role="status">加载赛事中…</div>
    <div v-else-if="!detail" class="empty" role="status">
      <p>赛事不存在或暂无可用数据</p>
      <button class="retry-btn focus-ring" type="button" @click="refresh(); refreshChart()">重试</button>
    </div>

    <template v-else-if="match">
      <section class="match-header">
        <NuxtLink :to="footballBackRoute" class="back focus-ring">
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
              <a v-if="canOpenFlashQ" :href="flashQUrl" class="flashq-versus focus-ring" aria-label="使用闪Q分析">
                <Zap :size="13" />
                <span>闪Q</span>
              </a>
              <button
                v-else
                type="button"
                class="flashq-versus locked focus-ring"
                :title="flashQLockMessage"
                aria-label="免费版暂未开放闪Q"
                disabled
              >
                <Zap :size="13" />
                <span>闪Q</span>
              </button>
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

      <section v-if="hasUnlockedData" class="tab-band">
        <div class="tab-row">
          <span class="band-label">指数成交</span>
          <SegmentedControl v-model="tab" :options="options" dense tone="accent" />
        </div>
      </section>

      <section v-if="hasUnlockedData" class="time-machine-band">
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

      <div v-if="hasUnlockedData" :class="['detail-grid', { 'all-mode': tab === 'all' }]">
        <template v-if="tab === 'all'">
          <MarketSummaryCard
            v-if="access.standard"
            class="market-panel market-standard"
            :title="isSnapshotMode ? `标盘（${snapshot?.actualHoursOffset}h 前）` : '标盘'"
            tone="standard"
            :rows="effectiveStandard"
            index-label="必指"
            @open="jumpTo('standard')"
          />

          <MarketSummaryCard
            v-if="detail.poly.length"
            class="market-panel market-poly"
            title="Poly"
            tone="poly"
            :rows="detail.poly"
            index-label="P指"
            turnover-prefix="$"
            @open="jumpTo('poly')"
          />

          <MarketSummaryCard
            v-if="access.goals"
            class="market-panel market-goals"
            :title="goalsTitle"
            tone="goals"
            :rows="goalsRows"
            index-label="必指"
            @open="jumpTo('goals')"
          />

          <MarketSummaryCard
            v-if="access.handicap"
            class="market-panel market-handicap"
            :title="handicapTitle"
            tone="handicap"
            :rows="handicapRows"
            index-label="必指"
            @open="jumpTo('handicap')"
          />

          <MarketSummaryCard
            v-if="access.cs && detail.cs.length"
            class="market-panel market-cs"
            title="比分 CS"
            tone="goals"
            :rows="detail.cs.slice(0, 3)"
            index-label="大注"
            index-format="amount"
            @open="jumpTo('cs')"
          />

          <MarketSummaryCard
            v-if="access.corner && detail.corner.length"
            class="market-panel market-corner"
            title="角球"
            tone="goals"
            :rows="detail.corner"
            index-label="区间"
            wide-option
            @open="jumpTo('corner')"
          />
        </template>

        <template v-else-if="sectionMode">
          <UpgradeUnlockCard
            v-if="sectionLockMessage"
            class="panel-section"
            variant="inline"
            :features="sectionLockLabel ? [sectionLockLabel] : []"
            :subline="sectionLockMessage"
          />
          <MarketMetricTable v-else class="panel-section" :title="sectionTitle" :rows="sectionRows" :mode="sectionMode" />
        </template>

        <section class="chart-preview panel-chart">
          <div class="chart-title-row">
            <h2>走势图</h2>
            <div class="chart-actions">
              <NuxtLink :to="chartRoute('standard', 'odds')" class="more-link focus-ring">
                <span>更多</span>
                <BarChart3 :size="14" />
              </NuxtLink>
              <button class="icon-link focus-ring" aria-label="刷新" @click="refresh(); refreshChart()">
                <RefreshCw :size="15" />
              </button>
            </div>
          </div>
          <LazyStaticTrendChart v-if="chartPoints.length" :points="chartPoints" :height="180" />
          <div v-else class="chart-empty">
            {{ chartStatus === 'no-access' ? '走势图未对当前会籍开放' : chartStatus === 'pending' ? '走势图待接入' : '暂无走势' }}
          </div>
        </section>

        <section class="quick-stats panel-shortcuts">
          <h3>关键入口</h3>
          <div class="shortcut-grid">
            <button v-if="access.tradeDetails" class="shortcut-link focus-ring" type="button" @click="openLadderMarket('standard')">必发明细</button>
            <button v-if="access.tradeDetails" class="shortcut-link focus-ring" type="button" @click="openLadderMarket('goals')">进球明细</button>
            <button v-if="access.cs" class="shortcut-link focus-ring" type="button" @click="openLadderMarket('cs')">比分明细</button>
            <NuxtLink :to="chartRoute('standard', 'exchange')" class="shortcut-link focus-ring">挂牌倾向</NuxtLink>
            <NuxtLink :to="chartRoute('goals', 'exchange')" class="shortcut-link focus-ring">进球挂牌</NuxtLink>
            <NuxtLink :to="chartRoute('handicap', 'bfindex')" class="shortcut-link focus-ring">亚洲指数</NuxtLink>
            <NuxtLink v-if="access.cs" :to="chartRoute('cs', 'bfindex')" class="shortcut-link focus-ring">比分指数</NuxtLink>
          </div>
          <div v-if="goalsBalance" class="stat-row">
            <span>进球均衡</span>
            <b>{{ goalsBalance }}</b>
          </div>
        </section>

        <BigTradesSummary v-if="access.tradeDetails" class="panel-big-trades" :event-id="match.eventId" />

        <EuroOddsTable v-if="access.euroOdds && euroOdds" class="panel-euro" :euro="euroOdds" />

        <div v-if="access.tradeDetails" ref="ladderAnchor" class="panel-ladder">
          <LadderPanel :event-id="match.eventId" :initial-market="ladderMarket" />
        </div>

        <UpgradeUnlockCard
          v-if="tab === 'all' && lockedFeatures.length"
          class="span-all"
          variant="inline"
          :features="lockedFeatures"
        />
      </div>

      <div v-else class="detail-locked">
        <UpgradeUnlockCard
          variant="hero"
          :features="lockedFeatures"
          headline="解锁完整赛事数据"
          subline="标盘 · 进球 · 让分 · 走势图 · 成交明细等暂未对当前会籍开放"
        />
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

.retry-btn {
  margin-top: 10px;
  padding: 6px 18px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--brand-deep);
  font-size: 0.82rem;
  font-weight: 760;
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

.flashq-versus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 54px;
  min-height: 28px;
  gap: 4px;
  padding: 0 9px;
  border: 1px solid #e8cf83;
  border-radius: 4px;
  background: #fff2bd;
  color: #252d3a;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 860;
  text-decoration: none;
  white-space: nowrap;
}

.flashq-versus.locked {
  cursor: not-allowed;
  border-color: #ddd0a2;
  background: #f7efd3;
  color: var(--muted);
  opacity: 0.68;
}

.flashq-versus:active {
  transform: translateY(1px);
}

.flashq-versus.locked:active {
  transform: none;
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
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  padding: 10px;
  background: var(--surface);
  grid-auto-flow: dense;
  align-items: start;
  min-width: 0;
}

/* 合并升级条跨整行；全锁 hero 居中限宽，避免散落空卡 */
.span-all {
  grid-column: 1 / -1;
}

.detail-locked {
  padding: 12px 10px 18px;
}

@media (min-width: 1024px) {
  .detail-locked {
    max-width: 760px;
    margin: 0 auto;
    padding: 4px 0 24px;
  }
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

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 8px;
}

.shortcut-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 0.76rem;
  font-weight: 760;
  text-decoration: none;
  white-space: nowrap;
}

.shortcut-link:hover {
  border-color: var(--brand);
  color: var(--brand-deep);
}

@media (min-width: 1024px) {
  .detail-page {
    width: min(100%, 1280px);
    margin: 0 auto;
    padding: 16px 0;
    gap: 12px;
  }

  .match-header {
    border-radius: 6px;
    padding: 14px 18px;
    border: 1px solid var(--line);
  }

  .header-main {
    width: min(100%, 900px);
    margin: 0 auto;
    gap: 8px;
  }

  .teams .team {
    font-size: 1.24rem;
  }

  .flashq-versus {
    min-width: 60px;
    min-height: 30px;
    font-size: 0.82rem;
  }

  .tab-band {
    border-radius: 6px;
    padding: 12px 16px;
    border: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    /* 桌面：盘口 tab 子导航吸顶(贴在顶部主导航下方) */
    position: sticky;
    top: 56px;
    z-index: 6;
  }

  .tab-row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .band-label {
    display: block;
  }

  .detail-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    padding: 0;
    background: transparent;
  }

  .market-panel,
  .panel-section,
  .panel-shortcuts,
  .panel-chart,
  .panel-big-trades,
  .panel-euro,
  .panel-ladder {
    min-width: 0;
  }

  .panel-section {
    grid-column: span 2;
  }

  .panel-chart,
  .panel-shortcuts,
  .panel-big-trades {
    grid-column: span 1;
  }

  .panel-euro,
  .panel-ladder {
    grid-column: span 2;
  }

  .span-all { grid-column: 1 / -1; }

  .panel-euro {
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 6px;
    box-shadow: var(--card-shadow);
  }

  .chart-preview,
  .quick-stats {
    border-radius: 6px;
    border: 1px solid var(--line);
    border-top: 1px solid var(--line);
  }
}

/* 超宽屏：使用四列密集网格，长表跨列，避免左侧大片空白、右侧单列过长。 */
@media (min-width: 1440px) {
  .detail-page {
    width: min(100%, 1360px);
  }

  .detail-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
  }

  .panel-section,
  .panel-euro,
  .panel-ladder {
    grid-column: span 2;
  }

  .panel-big-trades {
    grid-column: span 1;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panel-section,
  .panel-euro,
  .panel-ladder,
  .span-all {
    grid-column: 1 / -1;
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

@media (min-width: 1024px) {
  .time-machine-band {
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 6px;
  }
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
