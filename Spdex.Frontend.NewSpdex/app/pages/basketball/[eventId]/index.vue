<script setup lang="ts">
import { ArrowLeft, BarChart3, Clock, Lock, RefreshCw, Table2 } from '@lucide/vue'
import type { MatchSnapshot } from '~/composables/useMatchSnapshot'
import type { MarketTab } from '~/types/market'

const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))
const basketballBackRoute = computed(() => {
  const query: Record<string, string> = {}
  for (const key of ['day', 'date', 'status', 'league']) {
    const value = route.query[key]
    if (typeof value === 'string' && value) query[key] = value
  }
  return Object.keys(query).length ? { path: '/basketball', query } : '/basketball'
})

const { entitlements } = useAuth()
const { detail, access, pending, refresh } = useMatchDetail(eventId)
const { points: chartPoints, status: chartStatus, refresh: refreshChart } = useChartSeries(eventId, ref('1X2'))
const { fetchSnapshot } = useMatchSnapshot()

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
const effectiveHandicap = computed(() => snapshot.value ? (snapshot.value.handicap ?? []) : (detail.value?.handicap ?? []))
const isSnapshotMode = computed(() => snapshot.value !== null)

// 篮球去掉 Poly tab（NBA/WNBA 在 Polymarket 上的覆盖较少）
const tab = ref<MarketTab>('all')
const baseOptions = [
  { label: '全部', value: 'all' },
  { label: '标盘', value: 'standard' },
  { label: '大小', value: 'goals' },
  { label: '让分', value: 'handicap' },
]
// 时光机:让分(El* 必发欧式让球胜平负)只有当前快照、无历史时间窗 → 回看历史时刻时不提供"让分"分段
const options = computed(() => baseOptions.filter(o => !(o.value === 'handicap' && isSnapshotMode.value)))

watchEffect(() => {
  // 时光机模式下"让分"分段不可用(让分无历史快照)→ 回退到"全部"
  if (tab.value === 'handicap' && isSnapshotMode.value) {
    tab.value = 'all'
  }
})

type BasketballSectionKey = 'standard' | 'poly' | 'goals' | 'handicap'
const sectionMode = computed<BasketballSectionKey | null>(() => {
  const t = tab.value
  if (t === 'standard' || t === 'poly' || t === 'goals' || t === 'handicap') return t
  return null
})
const sectionRows = computed(() => {
  if (!sectionMode.value || !detail.value) return []
  if (sectionMode.value === 'standard') return effectiveStandard.value
  if (sectionMode.value === 'goals') return effectiveGoals.value
  if (sectionMode.value === 'handicap') return effectiveHandicap.value
  return detail.value[sectionMode.value]
})
const sectionTitle = computed(() => {
  const suffix = isSnapshotMode.value ? `（${snapshot.value?.actualHoursOffset}h 前）` : ''
  if (sectionMode.value === 'standard') return `标盘核心${suffix}`
  if (sectionMode.value === 'goals') return `大小核心${suffix}`
  if (sectionMode.value === 'handicap') return `让分核心${suffix}`
  return ''
})

// 锁定项合并为一张升级卡（替代散落的 dashed 空卡）
const lockedFeatures = computed(() => {
  const f: string[] = []
  if (!access.value.standard) f.push('标盘')
  if (!access.value.goals) f.push('大小')
  if (!access.value.handicap) f.push('让分')
  return f
})
const hasUnlockedData = computed(() => !!(
  access.value.standard
  || access.value.goals
  || access.value.handicap
  || chartPoints.value.length
))
const sectionLabelMap: Record<BasketballSectionKey, string> = {
  standard: '标盘', poly: 'Poly', goals: '大小', handicap: '让分',
}
const sectionLocked = computed(() => {
  const m = sectionMode.value
  if (m === 'standard') return !access.value.standard
  if (m === 'goals') return !access.value.goals
  if (m === 'handicap') return !access.value.handicap
  return false
})
const sectionLockLabel = computed(() => (sectionMode.value ? sectionLabelMap[sectionMode.value] : ''))

const match = computed(() => detail.value?.match)

function jumpTo(target: 'standard' | 'poly' | 'goals' | 'handicap') {
  tab.value = target
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
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
        <NuxtLink :to="basketballBackRoute" class="back focus-ring">
          <ArrowLeft :size="15" />
          <span>返回赛事</span>
        </NuxtLink>
        <div class="header-row">
          <div class="header-main">
            <div class="league-line">
              <span v-if="match.leagueCode" class="code">{{ match.leagueCode }}</span>
              <span>{{ match.leagueName }}</span>
              <span class="num kick">{{ match.matchTime.slice(11, 16) }}</span>
              <span class="tag tag-mute">{{ match.marketType }}</span>
            </div>
            <div class="teams">
              <span class="team home">{{ match.homeTeam }}</span>
              <b class="handicap">{{ match.handicap || 'VS' }}</b>
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
          <span v-if="snapshotLoading" class="tm-active num">读取中...</span>
          <span v-else-if="isSnapshotMode" class="tm-active num">
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

      <div v-if="hasUnlockedData" class="detail-grid">
        <div class="main-col">
          <section v-if="tab === 'all'" class="all-grid">
            <MarketSummaryCard
              v-if="access.standard"
              :title="isSnapshotMode ? `标盘（${snapshot?.actualHoursOffset}h 前）` : '标盘'"
              tone="standard"
              :rows="effectiveStandard"
              index-label="必指"
              @open="jumpTo('standard')"
            />
            <MarketSummaryCard
              v-if="access.goals"
              :title="isSnapshotMode ? `大小（${snapshot?.actualHoursOffset}h 前）` : '大小'"
              tone="goals"
              :rows="effectiveGoals"
              index-label="必指"
              @open="jumpTo('goals')"
            />
            <MarketSummaryCard
              v-if="access.handicap && !isSnapshotMode"
              :title="isSnapshotMode ? `让分（${snapshot?.actualHoursOffset}h 前）` : '让分'"
              tone="handicap"
              :rows="effectiveHandicap"
              index-label="必指"
              @open="jumpTo('handicap')"
            />
            <UpgradeUnlockCard
              v-if="lockedFeatures.length"
              class="span-all"
              variant="inline"
              :features="lockedFeatures"
            />
          </section>

          <template v-else-if="sectionMode">
            <UpgradeUnlockCard
              v-if="sectionLocked"
              variant="inline"
              :features="sectionLockLabel ? [sectionLockLabel] : []"
              :subline="sectionLockLabel ? `${sectionLockLabel}数据未对当前会籍开放` : ''"
            />
            <MarketMetricTable v-else :title="sectionTitle" :rows="sectionRows" :mode="sectionMode" />
          </template>
        </div>

        <aside class="side-col">
          <section class="chart-preview">
            <div class="chart-title-row">
              <h2>走势图</h2>
              <div class="chart-actions">
                <NuxtLink :to="`/basketball/${match.eventId}/chart`" class="icon-link focus-ring" aria-label="走势图">
                  <BarChart3 :size="15" />
                </NuxtLink>
                <NuxtLink :to="`/basketball/${match.eventId}/trades`" class="icon-link focus-ring" aria-label="明细表">
                  <Table2 :size="15" />
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

          <section class="quick-stats">
            <h3>赛事概览</h3>
            <div class="stat-row">
              <span>让分</span>
              <b class="num">{{ match.handicap || '—' }}</b>
            </div>
            <div class="stat-row">
              <span>开赛时间</span>
              <b class="num">{{ match.matchTime.slice(11, 16) }}</b>
            </div>
            <div class="stat-row">
              <span>必指</span>
              <b class="num">{{ match.bfIndex.join(' / ') }}</b>
            </div>
          </section>
        </aside>
      </div>

      <div v-else class="detail-locked">
        <UpgradeUnlockCard
          variant="hero"
          :features="lockedFeatures"
          headline="解锁完整赛事数据"
          subline="标盘 · 大小 · 让分 · 走势图 · 成交明细等暂未对当前会籍开放"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail-page { display: grid; }
.loading, .empty {
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
  background: var(--sell);
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
.handicap {
  padding: 2px 8px;
  border-radius: 3px;
  background: var(--sell);
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
.dot { opacity: 0.4; }
.tab-band {
  padding: 8px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
}
.tab-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}
.band-label {
  font-size: 0.86rem;
  font-weight: 800;
  color: var(--accent-deep);
}
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
.tm-lock,
.tm-active {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  color: #8a6212;
  font-size: 0.7rem;
  font-weight: 760;
}
.tm-active {
  color: var(--brand);
}
.tm-buttons {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 3px;
}
.tm-btn {
  min-height: 28px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--accent-deep);
  font-size: 0.74rem;
  font-weight: 800;
}
.tm-btn.active {
  border-color: var(--brand);
  background: var(--brand);
  color: #fff;
}
.tm-btn.disabled {
  color: var(--soft);
  cursor: not-allowed;
}
.detail-grid { display: grid; }
.all-grid {
  display: grid;
  gap: 8px;
  padding: 10px 10px;
  background: var(--surface);
}
.span-all { grid-column: 1 / -1; }
.detail-locked {
  padding: 12px 10px 18px;
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
  gap: 4px;
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
.stat-row:first-of-type { border-top: 0; }
.stat-row b {
  color: var(--ink);
  font-weight: 780;
}

@media (min-width: 1024px) {
  .detail-page { padding: 16px 0; gap: 12px; }
  .match-header {
    border-radius: 6px;
    padding: 14px 18px;
    border: 1px solid var(--line);
  }
  .teams .team { font-size: 1.24rem; }
  .handicap { font-size: 0.96rem; }
  .tab-band {
    border-radius: 6px;
    padding: 12px 16px;
    border: 1px solid var(--line);
    /* 桌面：盘口 tab 子导航吸顶 */
    position: sticky;
    top: 56px;
    z-index: 6;
  }
  .time-machine-band {
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 6px;
  }
  .detail-grid {
    grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.7fr);
    gap: 14px;
    align-items: start;
  }
  .main-col, .side-col { display: grid; gap: 12px; }
  /* 桌面：右侧信息栏吸顶(让开 sticky tab-band) */
  .side-col { position: sticky; top: 120px; align-self: start; }
  .all-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    padding: 0;
    background: transparent;
  }
  .detail-locked {
    max-width: 760px;
    margin: 0 auto;
    padding: 4px 0 24px;
  }
  .chart-preview, .quick-stats {
    border-radius: 6px;
    border: 1px solid var(--line);
  }
}

/* 超宽屏：盘口卡三列 */
@media (min-width: 1440px) {
  .detail-grid { grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.6fr); gap: 18px; }
  .all-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .all-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
