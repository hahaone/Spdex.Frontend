<script setup lang="ts">
import { ArrowLeft, BarChart3, Lock, RefreshCw, Table2 } from '@lucide/vue'
import type { MarketTab } from '~/types/market'

const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))

const { detail, access, pending, refresh } = useMatchDetail(eventId)
const { points: chartPoints, status: chartStatus, refresh: refreshChart } = useChartSeries(eventId, ref('1X2'))

const tab = ref<MarketTab>('all')
const options = [
  { label: '全部', value: 'all' },
  { label: '标盘', value: 'standard' },
  { label: 'Poly', value: 'poly' },
  { label: '进球', value: 'goals' },
  { label: '让分', value: 'handicap' },
]

const sectionMode = computed<'standard' | 'poly' | 'goals' | 'handicap' | null>(() => {
  return tab.value === 'all' ? null : tab.value
})
const sectionRows = computed(() => {
  if (!sectionMode.value || !detail.value) return []
  return detail.value[sectionMode.value]
})
const sectionTitle = computed(() => {
  if (sectionMode.value === 'standard') return '标盘核心'
  if (sectionMode.value === 'poly') return 'Poly 核心'
  if (sectionMode.value === 'goals') return '进球核心'
  if (sectionMode.value === 'handicap') return '让分核心'
  return ''
})

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

      <div class="detail-grid">
        <div class="main-col">
          <section v-if="tab === 'all'" class="all-grid">
            <template v-if="access.standard">
              <MarketSummaryCard
                title="标盘"
                tone="standard"
                :rows="detail.standard"
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
              @open="jumpTo('poly')"
            />
            <div v-else class="access-card poly">
              <Lock :size="14" />
              <span>Poly 数据待 stage 3.5 接入</span>
            </div>

            <template v-if="access.goals">
              <MarketSummaryCard
                title="进球"
                tone="goals"
                :rows="detail.goals"
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
                title="让分"
                tone="handicap"
                :rows="detail.handicap"
                index-label="必指"
                @open="jumpTo('handicap')"
              />
            </template>
            <div v-else class="access-card">
              <Lock :size="14" />
              <span>让分数据未对当前会籍开放</span>
            </div>
          </section>

          <MarketMetricTable v-else-if="sectionMode" :title="sectionTitle" :rows="sectionRows" :mode="sectionMode" />
        </div>

        <aside class="side-col">
          <section class="chart-preview">
            <div class="chart-title-row">
              <h2>走势图</h2>
              <div class="chart-actions">
                <NuxtLink :to="`/football/${match.eventId}/chart`" class="icon-link focus-ring" aria-label="走势图">
                  <BarChart3 :size="15" />
                </NuxtLink>
                <NuxtLink :to="`/football/${match.eventId}/trades`" class="icon-link focus-ring" aria-label="明细表">
                  <Table2 :size="15" />
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

          <section class="quick-stats">
            <h3>赛事概览</h3>
            <div class="stat-row">
              <span>盘口</span>
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
            <div class="stat-row">
              <span>P 指</span>
              <b class="num">{{ match.polyIndex.join(' / ') }}</b>
            </div>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail-page {
  display: grid;
}

.loading,
.empty {
  padding: 40px 16px;
  text-align: center;
  color: #6b7280;
  font-size: 0.86rem;
  font-weight: 720;
}

.access-card {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border: 1px dashed #dde2eb;
  border-radius: 6px;
  background: #f9fafc;
  color: #6b7280;
  font-size: 0.78rem;
  font-weight: 720;
}

.access-card.poly {
  border-color: #dcd2ed;
  background: #faf8fd;
  color: #6e5aaf;
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 180px;
  border: 1px dashed #dde2eb;
  border-radius: 4px;
  background: #f9fafc;
  color: #6b7280;
  font-size: 0.78rem;
  font-weight: 720;
}

.match-header {
  display: grid;
  gap: 6px;
  padding: 8px 12px 10px;
  background: linear-gradient(180deg, #ffffff 0%, #f7fafd 100%);
  border-bottom: 1px solid #eaeef4;
}

.back {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 4px;
  color: #1a8cd3;
  font-size: 0.78rem;
  font-weight: 740;
}

.header-row {
  display: grid;
  gap: 6px;
}

.header-main {
  display: grid;
  gap: 6px;
}

.league-line {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8rem;
  font-weight: 760;
  color: #1a2233;
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
  color: #4a5364;
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
  background: #1a8cd3;
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
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 720;
}

.dot {
  opacity: 0.4;
}

.tab-band {
  padding: 8px 10px;
  background: #ffffff;
  border-bottom: 1px solid #eaeef4;
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
  color: #4f3f86;
}

.detail-grid {
  display: grid;
}

.all-grid {
  display: grid;
  gap: 8px;
  padding: 10px 10px;
  background: #f3f6fb;
}

.chart-preview {
  padding: 10px 12px;
  background: #fff;
  border-top: 1px solid #eaeef4;
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
  border: 1px solid #dde2eb;
  border-radius: 4px;
  background: #fff;
  color: #4a5364;
}

.icon-link:active {
  background: #f3f6fb;
}

.quick-stats {
  padding: 10px 12px;
  background: #fff;
  border-top: 1px solid #eaeef4;
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
  border-top: 1px solid #eef1f6;
  font-size: 0.8rem;
  font-weight: 720;
  color: #4a5364;
}

.stat-row:first-of-type {
  border-top: 0;
}

.stat-row b {
  color: #1a2233;
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
    border: 1px solid #dde2eb;
  }

  .header-main {
    gap: 8px;
  }

  .teams .team {
    font-size: 1.24rem;
  }

  .handicap {
    font-size: 0.96rem;
  }

  .tab-band {
    border-radius: 6px;
    padding: 12px 16px;
    border: 1px solid #dde2eb;
    border-bottom: 1px solid #dde2eb;
  }

  .detail-grid {
    grid-template-columns: minmax(0, 1.45fr) minmax(280px, 0.7fr);
    gap: 14px;
    align-items: start;
  }

  .main-col,
  .side-col {
    display: grid;
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
    border: 1px solid #dde2eb;
    border-top: 1px solid #dde2eb;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .all-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
