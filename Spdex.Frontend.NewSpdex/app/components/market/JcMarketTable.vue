<script setup lang="ts">
import type { ChartSeriesLabels } from '~/composables/useChartSeries'
import type {
  ChartPoint,
  JcAnalyzeItem,
  JcEuroRow,
  JcInjuryGroup,
  JcIntelligence,
  JcMarket,
  JcNewsItem,
  JcOfficialEuroChange,
  JcRecommendation,
  JcSampleDistribution,
  JcSection,
  JcTrendMarket,
  JcTrendPoint,
  JcTrendValue,
} from '~/types/market'

const props = defineProps<{
  jc: JcSection
  title?: string
}>()

const selectedTrendKey = ref('')
const selectedTrendValueKeys = ref<string[]>([])
const historyListExpanded = ref(false)
type JcSubTabKey = 'odds' | 'popularity' | 'index' | 'intelligence'
const activeSubTab = ref<JcSubTabKey>('odds')

const officialMarkets = computed(() => props.jc.markets)
const coreMarket = computed(() => officialMarkets.value.find(m => m.key === 'SportteryNWDL') ?? null)
const extensionMarkets = computed(() =>
  ['SportteryWDL', 'SportteryTotalGoals', 'SportteryHalfFull']
    .map(key => officialMarkets.value.find(m => m.key === key))
    .filter((market): market is JcMarket => Boolean(market)))
const scoreMarket = computed(() => officialMarkets.value.find(m => m.key === 'SportteryScore') ?? null)
const extraMarkets = computed(() =>
  officialMarkets.value.filter(m =>
    !['SportteryNWDL', 'SportteryWDL', 'SportteryTotalGoals', 'SportteryHalfFull', 'SportteryScore'].includes(m.key)))
const trendMarkets = computed(() => props.jc.trendMarkets ?? [])
const indexTrend = computed(() => props.jc.indexTrend ?? {
  companyEuroSnapshot: [],
  officialEuroChanges: [],
  euroList: [],
  sampleDistributions: [],
})
const intelligence = computed<JcIntelligence>(() => props.jc.intelligence ?? {
  injuryAnalysis: null,
  injuryGroups: [],
  news: [],
  analyzeItems: [],
  recommendations: [],
})
const companyEuroSnapshot = computed(() => indexTrend.value.companyEuroSnapshot ?? [])
const officialEuroChanges = computed(() => indexTrend.value.officialEuroChanges ?? [])
const euroList = computed(() => indexTrend.value.euroList ?? [])
const sampleDistributions = computed(() => indexTrend.value.sampleDistributions ?? [])
const injuryGroups = computed<JcInjuryGroup[]>(() => intelligence.value.injuryGroups ?? [])
const newsItems = computed<JcNewsItem[]>(() => intelligence.value.news ?? [])
const analyzeItems = computed<JcAnalyzeItem[]>(() => intelligence.value.analyzeItems ?? [])
const recommendations = computed<JcRecommendation[]>(() => intelligence.value.recommendations ?? [])
const hasIntelligence = computed(() =>
  Boolean(intelligence.value.injuryAnalysis)
  || injuryGroups.value.length > 0
  || newsItems.value.length > 0
  || analyzeItems.value.length > 0
  || recommendations.value.length > 0)
const selectedTrend = computed(() =>
  trendMarkets.value.find(m => m.key === selectedTrendKey.value) ?? trendMarkets.value[0] ?? null)

const trendValueOptions = computed<JcTrendValue[]>(() => {
  const market = selectedTrend.value
  if (!market) return []
  const seen = new Map<string, JcTrendValue>()
  for (const point of [...market.points].reverse()) {
    for (const value of point.values) {
      if (!seen.has(value.key)) seen.set(value.key, value)
    }
  }
  return Array.from(seen.values())
})

const selectedTrendValues = computed(() =>
  selectedTrendValueKeys.value
    .map(key => trendValueOptions.value.find(value => value.key === key))
    .filter((value): value is JcTrendValue => Boolean(value))
    .slice(0, 3))

const trendChartPoints = computed<ChartPoint[]>(() => {
  const market = selectedTrend.value
  const values = selectedTrendValues.value
  if (!market || values.length === 0) return []
  return market.points.map(point => ({
    time: fmtShortTime(point.time),
    ts: point.time,
    home: trendValueOdds(point, values[0]?.key),
    draw: trendValueOdds(point, values[1]?.key),
    away: trendValueOdds(point, values[2]?.key),
    volume: 0,
  }))
})

const trendLabels = computed<ChartSeriesLabels>(() => ({
  home: selectedTrendValues.value[0]?.selection ?? '选项1',
  draw: selectedTrendValues.value[1]?.selection ?? null,
  away: selectedTrendValues.value[2]?.selection ?? null,
}))

const recentTrendPoints = computed(() =>
  [...(selectedTrend.value?.points ?? [])].reverse().slice(0, 10))
const visibleTrendPoints = computed(() =>
  historyListExpanded.value ? recentTrendPoints.value : recentTrendPoints.value.slice(0, 3))

const sampleCards = computed(() => {
  const map = new Map<string, JcSampleDistribution[]>()
  for (const item of sampleDistributions.value) {
    if (!map.has(item.title)) map.set(item.title, [])
    map.get(item.title)!.push(item)
  }
  return Array.from(map.entries()).map(([title, rows]) => ({ title, rows }))
})

const scoreGroups = computed(() => {
  const market = scoreMarket.value
  if (!market) return []
  const groupDefs = [
    { key: 'home', title: '主胜比分', keys: ['10', '20', '21', '30', '31', '32', '40', '41', '42', '50', '51', '52', '43'] },
    { key: 'draw', title: '平局比分', keys: ['00', '11', '22', '33', '44'] },
    { key: 'away', title: '客胜比分', keys: ['01', '02', '12', '03', '13', '23', '04', '14', '24', '05', '15', '25', '34'] },
  ]
  const rowMap = new Map(market.rows.map(row => [row.key, row]))
  return groupDefs
    .map(group => ({
      ...group,
      rows: group.keys.map(key => rowMap.get(key)).filter((row): row is typeof market.rows[number] => Boolean(row)),
    }))
    .filter(group => group.rows.length > 0)
})

const popularityCards = computed(() =>
  officialMarkets.value
    .map(market => {
      const rows = market.rows
        .filter(row => typeof row.distribution === 'number' && Number.isFinite(row.distribution))
        .sort((a, b) => (b.distribution ?? 0) - (a.distribution ?? 0))
        .slice(0, market.key === 'SportteryNWDL' || market.key === 'SportteryWDL' ? 3 : 6)
      return { key: market.key, title: market.title, market, rows }
    })
    .filter(card => card.rows.length > 0))

const hasPopularity = computed(() =>
  Boolean(props.jc.totalHeat || props.jc.currentRank || props.jc.historicalHighest || popularityCards.value.length))
const hasIndexData = computed(() =>
  trendMarkets.value.length > 0
  || companyEuroSnapshot.value.length > 0
  || officialEuroChanges.value.length > 0
  || euroList.value.length > 0
  || sampleCards.value.length > 0)
const indexDataCount = computed(() =>
  trendMarkets.value.reduce((sum, market) => sum + market.points.length, 0)
  + companyEuroSnapshot.value.length
  + officialEuroChanges.value.length
  + euroList.value.length
  + sampleCards.value.length)
const intelligenceCount = computed(() =>
  injuryGroups.value.reduce((sum, group) => sum + group.injuries.length, 0)
  + newsItems.value.length
  + analyzeItems.value.length
  + recommendations.value.length
  + (intelligence.value.injuryAnalysis ? 1 : 0))
const subTabs = computed(() => [
  { key: 'odds' as const, label: '赔率分析', count: officialMarkets.value.length },
  { key: 'popularity' as const, label: '选号分布', count: popularityCards.value.length },
  { key: 'index' as const, label: '指数走势', count: indexDataCount.value },
  { key: 'intelligence' as const, label: '情报推荐', count: intelligenceCount.value },
])

watchEffect(() => {
  if (!trendMarkets.value.length) {
    selectedTrendKey.value = ''
    return
  }
  if (trendMarkets.value.some(m => m.key === selectedTrendKey.value)) return
  selectedTrendKey.value = trendMarkets.value.find(m => m.key === 'SportteryNWDL')?.key ?? trendMarkets.value[0]!.key
})

watch(() => selectedTrend.value?.key, () => {
  selectedTrendValueKeys.value = defaultTrendValueKeys(trendValueOptions.value, selectedTrend.value)
  historyListExpanded.value = false
}, { immediate: true })

watchEffect(() => {
  const available = new Set(trendValueOptions.value.map(value => value.key))
  if (!available.size) {
    if (selectedTrendValueKeys.value.length) selectedTrendValueKeys.value = []
    return
  }

  const kept = selectedTrendValueKeys.value.filter(key => available.has(key)).slice(0, 3)
  if (kept.length === selectedTrendValueKeys.value.length && kept.length > 0) return
  selectedTrendValueKeys.value = kept.length > 0
    ? kept
    : defaultTrendValueKeys(trendValueOptions.value, selectedTrend.value)
})

function defaultTrendValueKeys(values: JcTrendValue[], market: JcTrendMarket | null): string[] {
  if (!values.length) return []
  const allKeys = values.map(value => value.key)
  const preferred = market?.key === 'SportteryScore' ? ['10', '20', '21'] : allKeys
  const keys = preferred.filter(key => allKeys.includes(key))
  return (keys.length ? keys : allKeys).slice(0, 3)
}

function toggleTrendValue(key: string) {
  const current = selectedTrendValueKeys.value
  if (current.includes(key)) {
    selectedTrendValueKeys.value = current.filter(item => item !== key)
    return
  }
  selectedTrendValueKeys.value = current.length >= 3 ? [...current.slice(1), key] : [...current, key]
}

function trendValueOdds(point: JcTrendPoint, key: string | undefined): number {
  if (!key) return 0
  return point.values.find(value => value.key === key)?.odds ?? 0
}

function historySummary(point: JcTrendPoint): string {
  const head = point.values
    .slice(0, 3)
    .map(value => `${value.selection} ${fmtOddsLoose(value.odds)}`)
    .join(' / ')
  return point.values.length > 3 ? `${head} · 共${point.values.length}项` : head
}

function fmtAmount(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value).toLocaleString('en-US') : '-'
}

function fmtOdds(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-'
}

function fmtOddsLoose(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function fmtRate(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-'
}

function fmtProbability(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1).replace(/\.0$/, '') : '-'
}

function fmtRatioPercent(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '-'
}

function fmtDifference(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function fmtRatioPercentBlank(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : ''
}

function fmtDifferenceBlank(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(0)}%`
}

function fmtSamplePercent(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : '-'
}

function fmtShortTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '-')
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '-')
}

function fmtKickoffDistance(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  const text = fmtDuration(Math.abs(Math.round(value)))
  return value >= 0 ? `距开赛 ${text}` : `开赛后 ${text}`
}

function fmtDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours > 0 && rest > 0) return `${hours}小时${rest}分钟`
  if (hours > 0) return `${hours}小时`
  return `${rest}分钟`
}

function sourceLabel(value: string | null | undefined): string {
  if (value === 'matchlist') return '赛程快照'
  if (value === 'matchoptions') return '官方玩法'
  return value || '官方快照'
}

function compactText(value: string | null | undefined, maxLength = 120): string {
  if (!value) return ''
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function playTypeLabel(value: string | null | undefined): string {
  const raw = value ?? ''
  if (raw.includes('NWDL')) return '胜平负'
  if (raw.includes('WDL')) return '让球胜平负'
  if (raw.includes('TotalGoals')) return '总进球'
  if (raw.includes('HalfFull')) return '半全场'
  if (raw.includes('Score')) return '比分'
  return raw || '-'
}

function popularityLabel(market: JcMarket, key: string, selection: string): string {
  if (market.key === 'SportteryNWDL') {
    if (key === '3') return '主胜'
    if (key === '1') return '平'
    if (key === '0') return '客胜'
  }
  return selection
}

function popularityWidth(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0%'
  return `${Math.min(Math.max(value * 100, 0), 100)}%`
}

function marketTime(market: JcMarket): string | null {
  return market.sourceUpdatedAt ?? market.capturedAt
}

function marketMeta(market: JcMarket): string {
  const parts = [
    market.betId ? `betId ${market.betId}` : '',
    market.note ?? '',
    sourceLabel(market.source),
    marketTime(market) ? fmtDateTime(marketTime(market)) : '',
  ].filter(Boolean)
  return parts.join(' · ')
}

function singleLabel(market: JcMarket): string {
  return market.isSingle === '1' ? '单关' : market.isSingle === '0' ? '过关' : ''
}

function oddsTriple(row: JcEuroRow | JcOfficialEuroChange, type: 'first' | 'current' = 'current'): string {
  if (type === 'first' && 'firstHome' in row) {
    return [row.firstHome, row.firstDraw, row.firstAway].map(fmtOddsLoose).join(' / ')
  }
  return [row.home, row.draw, row.away].map(fmtOddsLoose).join(' / ')
}

function maskBetCompany(value: string): string {
  return value.replace(/bet/gi, 'b*t')
}

function probabilityTriple(row: JcEuroRow): string {
  return [row.probabilityHome, row.probabilityDraw, row.probabilityAway].map(fmtProbability).join(' / ')
}

function changeMark(value: number | null | undefined): string {
  if (typeof value !== 'number') return ''
  if (value > 0) return '↑'
  if (value < 0) return '↓'
  return '·'
}

function changeClass(value: number | null | undefined): Record<string, boolean> {
  return {
    up: typeof value === 'number' && value > 0,
    down: typeof value === 'number' && value < 0,
    flat: value === 0,
  }
}
</script>

<template>
  <section class="jc-section">
    <div class="jc-title-row">
      <div>
        <h2>{{ title || jc.title }}</h2>
        <p>BSW 竞彩详情 · 官方玩法 / 指数走势</p>
      </div>
      <span v-if="jc.snapshotStatus === 'matched'" class="tag tag-brand">历史赔率</span>
      <span v-else-if="jc.snapshotStatus" class="tag tag-mute">{{ jc.snapshotStatus === 'future' ? '未到时刻' : '无历史' }}</span>
    </div>

    <div class="jc-meta-strip">
      <span>玩法 <b class="num">{{ officialMarkets.length }}</b></span>
      <span>走势 <b class="num">{{ trendMarkets.reduce((sum, market) => sum + market.points.length, 0) }}</b></span>
      <span v-if="jc.totalHeat">总热度 <b class="num">{{ fmtAmount(jc.totalHeat) }}</b></span>
      <span v-if="jc.currentRank">排名 <b class="num">{{ jc.currentRank }}</b></span>
      <span v-if="jc.historicalHighest">历史最高 <b class="num">{{ fmtAmount(jc.historicalHighest) }}</b></span>
      <span v-if="jc.matchedAt">更新 <b class="num">{{ fmtShortTime(jc.matchedAt) }}</b></span>
    </div>

    <p v-if="jc.note" class="jc-note">{{ jc.note }}</p>

    <div class="jc-subtabs" role="tablist" aria-label="竞彩数据分类">
      <button
        v-for="tab in subTabs"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="activeSubTab === tab.key"
        :class="['jc-subtab focus-ring', { active: activeSubTab === tab.key }]"
        @click="activeSubTab = tab.key"
      >
        <span>{{ tab.label }}</span>
        <b class="num">{{ tab.count }}</b>
      </button>
    </div>

    <div
      v-show="activeSubTab === 'odds' || activeSubTab === 'index'"
      :class="['jc-layout', activeSubTab === 'index' ? 'index-layout' : 'odds-layout']"
    >
      <section v-show="activeSubTab === 'odds'" class="official-panel">
        <article v-if="coreMarket" class="official-market design-market">
          <div class="market-head design-title">
            <div>
              <h4>竞彩核心-{{ coreMarket.title }}</h4>
              <p>{{ marketMeta(coreMarket) }}</p>
            </div>
            <span v-if="singleLabel(coreMarket)" class="single-tag">{{ singleLabel(coreMarket) }}</span>
          </div>

          <div class="table-scroll market-table-scroll">
            <table class="jc-odds-table">
              <colgroup>
                <col class="selection-col">
                <col class="odds-col">
                <col class="odds-col">
                <col class="ratio-col">
                <col class="ratio-col">
                <col class="ratio-col">
              </colgroup>
              <thead>
                <tr>
                  <th>选项</th>
                  <th>官方</th>
                  <th>还原</th>
                  <th>方案分布</th>
                  <th>还原概率</th>
                  <th>差异率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in coreMarket.rows" :key="row.key">
                  <td>{{ row.selection }}</td>
                  <td class="num">{{ fmtOddsLoose(row.officialOdds) }}</td>
                  <td class="num">{{ fmtOddsLoose(row.restoredOdds) }}</td>
                  <td class="num">{{ fmtRatioPercent(row.distribution) }}</td>
                  <td class="num">{{ fmtRatioPercent(row.restoredProbability) }}</td>
                  <td class="num" :class="changeClass(row.differenceRate)">{{ fmtDifference(row.differenceRate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article
          v-for="market in extensionMarkets"
          :key="market.key"
          class="official-market design-market"
        >
          <div class="market-head design-title">
            <div>
              <h4>竞彩扩展-{{ market.title }}</h4>
              <p>{{ marketMeta(market) }}</p>
            </div>
            <span v-if="singleLabel(market)" class="single-tag">{{ singleLabel(market) }}</span>
          </div>

          <div class="table-scroll market-table-scroll">
            <table class="jc-odds-table">
              <colgroup>
                <col class="selection-col">
                <col class="odds-col">
                <col class="odds-col">
                <col class="ratio-col">
                <col class="ratio-col">
                <col class="ratio-col">
              </colgroup>
              <thead>
                <tr>
                  <th>选项</th>
                  <th>官方</th>
                  <th>还原</th>
                  <th>方案分布</th>
                  <th>还原概率</th>
                  <th>差异率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in market.rows" :key="row.key">
                  <td>{{ row.selection }}</td>
                  <td class="num">{{ fmtOddsLoose(row.officialOdds) }}</td>
                  <td class="num">{{ fmtOddsLoose(row.restoredOdds) }}</td>
                  <td class="num">{{ fmtRatioPercent(row.distribution) }}</td>
                  <td class="num">{{ fmtRatioPercent(row.restoredProbability) }}</td>
                  <td class="num" :class="changeClass(row.differenceRate)">{{ fmtDifference(row.differenceRate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <article v-if="scoreMarket" class="official-market design-market score-design">
          <div class="market-head design-title">
            <div>
              <h4>竞彩扩展-比分(方案、差异率)</h4>
              <p>{{ marketMeta(scoreMarket) }}</p>
            </div>
            <span v-if="singleLabel(scoreMarket)" class="single-tag">{{ singleLabel(scoreMarket) }}</span>
          </div>

          <div class="score-groups">
            <div v-for="group in scoreGroups" :key="group.key" class="score-group">
              <div class="score-group-title">{{ group.title }}</div>
              <div class="score-list">
                <div v-for="row in group.rows" :key="row.key" class="score-row">
                  <b>{{ row.selection }}</b>
                  <span class="num">{{ fmtOddsLoose(row.officialOdds) }}</span>
                  <span class="num muted">{{ fmtRatioPercentBlank(row.distribution) }}</span>
                  <span class="num" :class="changeClass(row.differenceRate)">{{ fmtDifferenceBlank(row.differenceRate) }}</span>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article
          v-for="market in extraMarkets"
          :key="market.key"
          class="official-market design-market"
        >
          <div class="market-head design-title">
            <div>
              <h4>竞彩扩展-{{ market.title }}</h4>
              <p>{{ marketMeta(market) }}</p>
            </div>
            <span v-if="singleLabel(market)" class="single-tag">{{ singleLabel(market) }}</span>
          </div>

          <div class="table-scroll market-table-scroll">
            <table class="jc-odds-table">
              <thead>
                <tr>
                  <th>选项</th>
                  <th>官方</th>
                  <th>还原</th>
                  <th>方案分布</th>
                  <th>还原概率</th>
                  <th>差异率</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in market.rows" :key="row.key">
                  <td>{{ row.selection }}</td>
                  <td class="num">{{ fmtOddsLoose(row.officialOdds) }}</td>
                  <td class="num">{{ fmtOddsLoose(row.restoredOdds) }}</td>
                  <td class="num">{{ fmtRatioPercent(row.distribution) }}</td>
                  <td class="num">{{ fmtRatioPercent(row.restoredProbability) }}</td>
                  <td class="num" :class="changeClass(row.differenceRate)">{{ fmtDifference(row.differenceRate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>

        <div v-if="!officialMarkets.length" class="empty-box">暂无官方玩法数据</div>
      </section>

      <aside v-show="activeSubTab === 'index'" class="trend-panel">
        <div class="panel-head">
          <h3>标准化竞彩官方欧赔历史</h3>
          <span>可选择最多3项对比</span>
        </div>

        <div v-if="trendMarkets.length" class="trend-body">
          <div class="trend-tabs">
            <button
              v-for="market in trendMarkets"
              :key="market.key"
              type="button"
              :class="['trend-tab focus-ring', { active: selectedTrendKey === market.key }]"
              @click="selectedTrendKey = market.key"
            >
              {{ market.title }}
            </button>
          </div>

          <div v-if="trendValueOptions.length > 3" class="value-tabs">
            <button
              v-for="value in trendValueOptions"
              :key="value.key"
              type="button"
              :class="['value-tab focus-ring', { active: selectedTrendValueKeys.includes(value.key) }]"
              @click="toggleTrendValue(value.key)"
            >
              {{ value.selection }}
            </button>
          </div>

          <div class="trend-chart">
            <LazyStaticTrendChart
              v-if="trendChartPoints.length >= 2"
              :points="trendChartPoints"
              :series-labels="trendLabels"
              :height="176"
            />
            <div v-else class="chart-state">暂无足够走势点</div>
          </div>

          <div class="history-list">
            <details v-for="point in visibleTrendPoints" :key="point.time" class="history-row">
              <summary class="history-summary">
                <div class="history-time">
                  <b class="num">{{ fmtDateTime(point.time) }}</b>
                  <span>{{ fmtKickoffDistance(point.minutesToKickoff) }}</span>
                </div>
                <strong class="num">{{ historySummary(point) }}</strong>
                <span class="summary-action" aria-hidden="true" />
              </summary>
              <div :class="['history-values', { dense: point.values.length > 12 }]">
                <span v-for="value in point.values" :key="value.key">
                  <i>{{ value.selection }}</i>
                  <b class="num">{{ fmtOddsLoose(value.odds) }}</b>
                </span>
              </div>
            </details>
            <button
              v-if="recentTrendPoints.length > 3"
              type="button"
              class="history-more focus-ring"
              @click="historyListExpanded = !historyListExpanded"
            >
              {{ historyListExpanded ? '收起历史列表' : `展开最近 ${recentTrendPoints.length} 条` }}
            </button>
          </div>
        </div>

        <div v-else class="empty-box">暂无指数走势数据</div>
      </aside>
    </div>

    <section v-if="hasIntelligence" v-show="activeSubTab === 'intelligence'" class="intel-panel">
      <div class="data-head">
        <h3>情报内参</h3>
        <span>密报、伤停解读和内参条目</span>
      </div>

      <div class="intel-body">
        <p v-if="intelligence.injuryAnalysis" class="intel-highlight">{{ intelligence.injuryAnalysis }}</p>

        <div v-if="injuryGroups.length" class="injury-grid">
          <article v-for="group in injuryGroups" :key="group.label" class="injury-card">
            <h4>{{ group.label }}伤停</h4>
            <div class="injury-list">
              <div v-for="injury in group.injuries" :key="`${group.label}:${injury.name}`" class="injury-row">
                <div>
                  <b>{{ injury.name }}</b>
                  <span>{{ injury.position }} · {{ injury.role || injury.stats || '-' }}</span>
                </div>
                <strong>{{ injury.reason || '-' }}</strong>
              </div>
            </div>
          </article>
        </div>

        <div v-if="newsItems.length" class="intel-card-grid">
          <article v-for="item in newsItems" :key="item.id" class="intel-card">
            <div class="intel-card-meta">
              <span>{{ item.tag }}</span>
              <i>{{ item.time || '' }}</i>
            </div>
            <h4>{{ item.title }}</h4>
            <p v-if="item.content">{{ item.content }}</p>
          </article>
        </div>

        <div v-if="analyzeItems.length" class="analyze-list">
          <article v-for="item in analyzeItems" :key="item.title">
            <h4>{{ item.title }}</h4>
            <p>{{ item.text }}</p>
          </article>
        </div>

        <div v-if="recommendations.length" class="recommend-grid">
          <article v-for="item in recommendations" :key="item.contentId" class="recommend-card">
            <div class="recommend-head">
              <div>
                <h4>{{ item.title || item.contentId }}</h4>
                <span>{{ item.recommenderName || item.recommenderId || '专家' }} · {{ item.miniTypeText || item.lotteryStyleText || '-' }} · {{ fmtDateTime(item.saleTimeUtc) }}</span>
              </div>
              <b v-if="item.price">{{ item.price }}</b>
            </div>
            <p v-if="item.summary || item.content">{{ compactText(item.summary || item.content, 160) }}</p>
            <div v-if="item.matches.length" class="recommend-matches">
              <span v-for="match in item.matches" :key="`${item.contentId}:${match.serialNo}:${match.lotteryType}`">
                {{ match.serialNo || '-' }} · {{ match.hostNameS || '-' }} vs {{ match.guestNameS || '-' }} · {{ playTypeLabel(match.lotteryType) }}
              </span>
            </div>
          </article>
        </div>
      </div>
    </section>
    <div v-show="activeSubTab === 'intelligence' && !hasIntelligence" class="tab-empty empty-box">暂无情报推荐数据</div>

    <section v-if="hasPopularity" v-show="activeSubTab === 'popularity'" class="popularity-panel">
      <div class="data-head">
        <h3>选号分布</h3>
        <span>用户选号热度和各玩法选项占比</span>
      </div>

      <div class="popularity-body">
        <div class="popularity-metrics">
          <div class="popularity-metric">
            <span>总热度</span>
            <b class="num">{{ fmtAmount(jc.totalHeat) }}</b>
          </div>
          <div class="popularity-metric">
            <span>当前排名</span>
            <b class="num">{{ jc.currentRank ?? '-' }}</b>
          </div>
          <div class="popularity-metric">
            <span>历史最高</span>
            <b class="num">{{ fmtAmount(jc.historicalHighest) }}</b>
          </div>
        </div>

        <div v-if="popularityCards.length" class="popularity-grid">
          <article v-for="card in popularityCards" :key="card.key" class="popularity-card">
            <h4>{{ card.title }}</h4>
            <div class="popularity-bars">
              <div v-for="row in card.rows" :key="`${card.key}:${row.key}`" class="popularity-bar-row">
                <div class="popularity-bar-label">
                  <span>{{ popularityLabel(card.market, row.key, row.selection) }}</span>
                  <b class="num">{{ fmtRatioPercent(row.distribution) }}</b>
                </div>
                <div class="popularity-track">
                  <i :style="{ width: popularityWidth(row.distribution) }" />
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
    <div v-show="activeSubTab === 'popularity' && !hasPopularity" class="tab-empty empty-box">暂无选号分布数据</div>

    <div v-show="activeSubTab === 'index'" class="index-grid">
      <section v-if="companyEuroSnapshot.length" class="data-panel">
        <div class="data-head">
          <h3>标准化公司欧指快照</h3>
          <span>公司即时欧赔摘要</span>
        </div>
        <div class="table-scroll">
          <table class="data-table compact-table">
            <thead>
              <tr>
                <th>公司</th>
                <th>初指</th>
                <th>即时</th>
                <th>概率</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in companyEuroSnapshot" :key="`snap-${row.company}`">
                <td>{{ maskBetCompany(row.company) }}</td>
                <td class="num muted">{{ oddsTriple(row, 'first') }}</td>
                <td class="num strong">{{ oddsTriple(row) }}</td>
                <td class="num muted">{{ probabilityTriple(row) }}</td>
                <td class="muted">{{ row.updatedAt ? fmtDateTime(row.updatedAt) : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="officialEuroChanges.length" class="data-panel">
        <div class="data-head">
          <h3>竞彩官方欧指变化</h3>
          <span>胜 / 平 / 负</span>
        </div>
        <div class="table-scroll">
          <table class="data-table change-table">
            <thead>
              <tr>
                <th>更新时间</th>
                <th>距开赛</th>
                <th>胜</th>
                <th>平</th>
                <th>负</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in officialEuroChanges" :key="`${row.updatedAt}-${row.home}-${row.draw}-${row.away}`">
                <td>{{ fmtDateTime(row.updatedAt) }}</td>
                <td class="muted">{{ fmtKickoffDistance(row.minutesToKickoff).replace('距开赛 ', '') }}</td>
                <td class="num" :class="changeClass(row.homeChange)">{{ fmtOddsLoose(row.home) }} {{ changeMark(row.homeChange) }}</td>
                <td class="num" :class="changeClass(row.drawChange)">{{ fmtOddsLoose(row.draw) }} {{ changeMark(row.drawChange) }}</td>
                <td class="num" :class="changeClass(row.awayChange)">{{ fmtOddsLoose(row.away) }} {{ changeMark(row.awayChange) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="euroList.length" class="data-panel wide">
        <div class="data-head">
          <h3>欧指列表</h3>
          <span>完整公司列表，含返还率</span>
        </div>
        <div class="table-scroll">
          <table class="data-table euro-table">
            <thead>
              <tr>
                <th>公司</th>
                <th>初指</th>
                <th>即时</th>
                <th>返还率</th>
                <th>概率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in euroList" :key="`euro-${row.company}`">
                <td>{{ maskBetCompany(row.company) }}</td>
                <td class="num muted">{{ oddsTriple(row, 'first') }}</td>
                <td class="num strong">
                  <span :class="changeClass(row.homeChange)">{{ fmtOddsLoose(row.home) }} {{ changeMark(row.homeChange) }}</span>
                  <span :class="changeClass(row.drawChange)">{{ fmtOddsLoose(row.draw) }} {{ changeMark(row.drawChange) }}</span>
                  <span :class="changeClass(row.awayChange)">{{ fmtOddsLoose(row.away) }} {{ changeMark(row.awayChange) }}</span>
                </td>
                <td class="num muted">{{ fmtRate(row.returnRate) }}</td>
                <td class="num muted">{{ probabilityTriple(row) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="sampleCards.length" class="data-panel wide">
        <div class="data-head">
          <h3>样本分布</h3>
          <span>初指同赔 / 即时同赔</span>
        </div>
        <div class="sample-grid">
          <article v-for="card in sampleCards" :key="card.title" class="sample-card">
            <h4>{{ card.title }}</h4>
            <div v-for="row in card.rows" :key="`${card.title}-${row.type}`" class="sample-row">
              <div>
                <b>{{ row.type }}</b>
                <span>{{ fmtAmount(row.total) }} 场</span>
              </div>
              <div class="sample-values">
                <span>胜 <b class="num">{{ fmtSamplePercent(row.homePercent) }}</b></span>
                <span>平 <b class="num">{{ fmtSamplePercent(row.drawPercent) }}</b></span>
                <span>负 <b class="num">{{ fmtSamplePercent(row.awayPercent) }}</b></span>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
    <div v-show="activeSubTab === 'index' && !hasIndexData" class="tab-empty empty-box">暂无指数走势数据</div>
  </section>
</template>

<style scoped>
.jc-section {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  box-shadow: var(--card-shadow);
}

.jc-title-row,
.panel-head,
.market-head,
.jc-meta-strip,
.data-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.jc-title-row h2,
.panel-head h3,
.market-head h4,
.data-head h3,
.sample-card h4 {
  margin: 0;
  color: var(--ink);
  font-weight: 840;
}

.jc-title-row h2 {
  font-size: 0.94rem;
}

.jc-title-row p,
.panel-head span,
.market-head p,
.jc-note,
.history-time span,
.data-head span,
.muted {
  margin: 0;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 720;
}

.jc-meta-strip {
  flex-wrap: wrap;
  justify-content: flex-start;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 760;
}

.jc-meta-strip b,
.strong {
  color: var(--ink);
}

.jc-subtabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
}

.jc-subtab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  height: 32px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  color: var(--muted);
  font: inherit;
  font-size: 0.74rem;
  font-weight: 820;
  cursor: pointer;
}

.jc-subtab span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.jc-subtab b {
  flex: 0 0 auto;
  min-width: 22px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 860;
}

.jc-subtab.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.jc-subtab.active b {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.jc-layout,
.index-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
}

.jc-layout.odds-layout,
.jc-layout.index-layout {
  grid-template-columns: minmax(0, 1fr);
}

.official-panel,
.trend-panel,
.data-panel {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
}

.panel-head,
.data-head {
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: linear-gradient(180deg, var(--lavender) 0%, var(--lavender-strong) 100%);
}

.panel-head h3,
.data-head h3 {
  color: var(--accent-deep);
  font-size: 0.86rem;
}

.official-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 9px;
}

.official-market,
.data-panel,
.sample-card {
  overflow: hidden;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
}

.market-head {
  align-items: flex-start;
  padding: 8px 9px;
  border-bottom: 1px solid var(--divider);
  background: var(--surface);
}

.market-head h4 {
  font-size: 0.82rem;
}

.market-head p {
  margin-top: 3px;
}

.design-market + .design-market {
  margin-top: 2px;
}

.design-title {
  border-bottom-color: #111827;
  background: #fff;
}

.design-title h4 {
  font-size: 0.84rem;
}

.single-tag {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--signal-bg);
  color: var(--up);
  font-size: 0.68rem;
  font-weight: 820;
}

.history-values i {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.7rem;
  font-style: normal;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.market-table-scroll {
  overflow-x: auto;
}

.jc-odds-table {
  width: 100%;
  min-width: 0;
  border-collapse: collapse;
  table-layout: fixed;
  color: var(--ink);
  font-size: 0.72rem;
  font-weight: 760;
}

.jc-odds-table.score {
  min-width: 0;
}

.jc-odds-table .selection-col {
  width: 16%;
}

.jc-odds-table .odds-col {
  width: 15%;
}

.jc-odds-table .ratio-col {
  width: 18%;
}

.jc-odds-table th,
.jc-odds-table td {
  overflow: hidden;
  padding: 7px 6px;
  border-bottom: 1px solid var(--divider);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.jc-odds-table tr:last-child td {
  border-bottom: 0;
}

.jc-odds-table th {
  background: var(--surface);
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 820;
}

.jc-odds-table th:first-child,
.jc-odds-table td:first-child {
  text-align: left;
}

.jc-odds-table td:first-child {
  color: var(--ink);
  font-weight: 840;
}

.score-design {
  overflow: visible;
}

.score-groups {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 10px;
}

.score-group {
  min-width: 0;
  border-top: 1px solid #111827;
}

.score-group-title {
  padding: 6px 0;
  color: var(--ink);
  font-size: 0.74rem;
  font-weight: 860;
  text-align: center;
}

.score-list {
  display: grid;
  gap: 2px;
}

.score-row {
  display: grid;
  grid-template-columns: minmax(34px, 0.8fr) minmax(44px, 0.9fr) minmax(48px, 0.9fr) minmax(44px, 0.8fr);
  gap: 4px;
  align-items: baseline;
  min-width: 0;
  padding: 3px 2px;
  color: var(--ink);
  font-size: 0.72rem;
}

.score-row b,
.score-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-row b {
  font-weight: 860;
}

.score-row span {
  text-align: right;
  font-weight: 760;
}

.trend-body {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.trend-tabs,
.value-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.trend-tab,
.value-tab {
  height: 27px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 800;
  cursor: pointer;
}

.value-tab {
  height: 25px;
  padding: 0 8px;
  font-size: 0.68rem;
}

.trend-tab.active,
.value-tab.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.trend-chart {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
}

.chart-state,
.empty-box {
  display: flex;
  min-height: 128px;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 760;
}

.history-list {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
}

.history-row {
  border-bottom: 1px solid var(--divider);
}

.history-row:last-of-type {
  border-bottom: 0;
}

.history-summary {
  display: grid;
  grid-template-columns: minmax(112px, 0.28fr) minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-width: 0;
  padding: 8px 9px;
  list-style: none;
  cursor: pointer;
}

.history-summary::-webkit-details-marker {
  display: none;
}

.history-time {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.history-time b,
.history-summary strong,
.history-values b {
  color: var(--ink);
  font-size: 0.76rem;
  font-weight: 820;
}

.history-summary strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-action {
  min-width: 34px;
  color: var(--accent);
  font-size: 0.7rem;
  font-weight: 820;
  text-align: right;
}

.summary-action::before {
  content: "展开";
}

.history-row[open] .summary-action::before {
  content: "收起";
}

.history-row[open] .history-summary {
  background: var(--surface);
}

.history-values {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 4px;
  min-width: 0;
  padding: 0 9px 9px;
}

.history-values.dense {
  grid-template-columns: repeat(auto-fill, minmax(58px, 1fr));
}

.history-values span {
  display: grid;
  gap: 1px;
  min-width: 0;
  padding: 5px 6px;
  border-radius: 4px;
  background: var(--surface);
}

.history-more {
  width: 100%;
  height: 32px;
  border: 0;
  border-top: 1px solid var(--divider);
  background: var(--panel);
  color: var(--accent);
  font: inherit;
  font-size: 0.72rem;
  font-weight: 820;
  cursor: pointer;
}

.history-more:hover {
  background: var(--surface);
}

.data-panel {
  gap: 0;
}

.data-panel .data-head {
  border-width: 0 0 1px;
  border-radius: 0;
}

.table-scroll {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
  color: var(--ink);
  font-size: 0.72rem;
  font-weight: 760;
}

.compact-table {
  min-width: 760px;
}

.change-table {
  min-width: 560px;
}

.data-table th,
.data-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--divider);
  text-align: left;
  white-space: nowrap;
}

.data-table th {
  background: var(--surface);
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 820;
}

.data-table tr:last-child td {
  border-bottom: 0;
}

.euro-table td.strong {
  display: flex;
  gap: 10px;
}

.up {
  color: var(--down);
}

.down {
  color: var(--up);
}

.flat {
  color: var(--muted);
}

.sample-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
  padding: 8px;
}

.sample-card {
  display: grid;
  gap: 7px;
  padding: 9px;
  box-shadow: none;
}

.sample-card h4 {
  font-size: 0.78rem;
}

.sample-row {
  display: grid;
  gap: 5px;
  padding-top: 7px;
  border-top: 1px solid var(--divider);
}

.sample-row > div:first-child,
.sample-values {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sample-row b {
  color: var(--ink);
  font-size: 0.72rem;
}

.sample-row span,
.sample-values span {
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 740;
}

.sample-values {
  justify-content: flex-start;
  flex-wrap: wrap;
}

.intel-panel {
  overflow: hidden;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
}

.intel-body {
  display: grid;
  gap: 10px;
  padding: 10px;
}

.intel-highlight {
  margin: 0;
  padding: 10px;
  border: 1px solid #f2d36b;
  border-radius: 5px;
  background: #fff8db;
  color: #8a4f12;
  font-size: 0.76rem;
  font-weight: 740;
  line-height: 1.75;
}

.injury-grid,
.intel-card-grid,
.recommend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
}

.injury-card,
.intel-card,
.recommend-card,
.analyze-list {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
}

.injury-card,
.intel-card,
.recommend-card {
  padding: 10px;
}

.injury-card h4,
.intel-card h4,
.recommend-card h4,
.analyze-list h4 {
  margin: 0;
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 840;
}

.injury-list {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}

.injury-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 7px 8px;
  border-radius: 5px;
  background: var(--surface);
}

.injury-row div {
  display: grid;
  min-width: 0;
}

.injury-row b,
.injury-row strong {
  color: var(--ink);
  font-size: 0.72rem;
  font-weight: 820;
}

.injury-row span,
.intel-card-meta,
.recommend-head span,
.recommend-matches span {
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 720;
}

.injury-row strong {
  flex: 0 0 auto;
  color: var(--muted);
}

.intel-card-meta,
.recommend-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
}

.intel-card-meta span,
.recommend-head b {
  flex: 0 0 auto;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-style: normal;
  font-weight: 820;
}

.intel-card-meta i {
  overflow: hidden;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.intel-card p,
.recommend-card p,
.analyze-list p {
  margin: 7px 0 0;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 720;
  line-height: 1.65;
  white-space: pre-line;
}

.analyze-list {
  overflow: hidden;
}

.analyze-list article {
  padding: 10px;
  border-bottom: 1px solid var(--divider);
}

.analyze-list article:last-child {
  border-bottom: 0;
}

.recommend-head {
  align-items: flex-start;
  margin-bottom: 0;
}

.recommend-head > div {
  min-width: 0;
}

.recommend-head h4 {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommend-matches {
  display: grid;
  gap: 4px;
  margin-top: 8px;
}

.recommend-matches span {
  overflow: hidden;
  padding: 6px 7px;
  border-radius: 5px;
  background: var(--surface);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popularity-panel {
  overflow: hidden;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
}

.popularity-body {
  display: grid;
  gap: 12px;
  padding: 10px;
}

.popularity-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.popularity-metric {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
}

.popularity-metric span {
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 760;
}

.popularity-metric b {
  color: var(--ink);
  font-size: 0.98rem;
  font-weight: 860;
}

.popularity-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.popularity-card {
  display: grid;
  gap: 9px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
}

.popularity-card h4 {
  margin: 0;
  color: var(--ink);
  font-size: 0.8rem;
  font-weight: 840;
}

.popularity-bars {
  display: grid;
  gap: 8px;
}

.popularity-bar-row {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.popularity-bar-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 760;
}

.popularity-bar-label b {
  flex: 0 0 auto;
  color: var(--ink);
  font-weight: 840;
}

.popularity-track {
  overflow: hidden;
  height: 7px;
  border-radius: 999px;
  background: var(--surface);
}

.popularity-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #2563eb;
}

@media (min-width: 900px) {
  .official-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .official-market.score {
    grid-column: 1 / -1;
  }

  .index-grid {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .data-panel.wide {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1180px) {
  .jc-section {
    padding: 12px;
  }

  .jc-layout {
    grid-template-columns: minmax(0, 1.35fr) minmax(400px, 0.9fr);
    align-items: start;
  }
}

@media (max-width: 640px) {
  .jc-title-row,
  .sample-row > div:first-child {
    display: grid;
    justify-content: stretch;
  }

  .jc-subtabs {
    display: flex;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .jc-subtabs::-webkit-scrollbar {
    display: none;
  }

  .jc-subtab {
    flex: 0 0 104px;
  }

  .history-summary {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .history-summary strong {
    grid-column: 1 / -1;
    grid-row: 2;
    white-space: normal;
  }

  .history-values,
  .history-values.dense {
    grid-template-columns: repeat(auto-fill, minmax(62px, 1fr));
  }

  .score-groups {
    grid-template-columns: minmax(0, 1fr);
  }

  .popularity-metrics,
  .popularity-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .jc-odds-table {
    min-width: 560px;
  }

  .jc-odds-table.score {
    min-width: 620px;
  }
}
</style>
