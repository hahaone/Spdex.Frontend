<script setup lang="ts">
import {
  Activity,
  ChevronRight,
  Clock,
  Database,
  MinusCircle,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Target,
} from '@lucide/vue'
import {
  statisticToGoalRows,
  statisticToMarketRows,
} from '~/composables/useQuantilearnApi'
import type {
  QuantilearnApiFlashAnalysisResult,
  QuantilearnApiFlashEventSnapshot,
  QuantilearnApiFlashFactorCell,
  QuantilearnApiFlashMatchesResult,
  QuantilearnApiStatisticSummary,
  QuantilearnFlashAnalysisLogic,
} from '~/composables/useQuantilearnApi'
import { toQuantilearnUserError } from '~/utils/quantilearnErrors'

type FlashSnapshotId = 'current' | '1' | '2' | '3' | '6'
type FlashLogic = 'none' | 'max' | 'min' | 'gt-home' | 'gt-away' | 'lt-home' | 'lt-away'
type FlashReportMode = 'full' | 'half'

interface SelectedFlashFactor {
  factorId: string
  name: string
  min: number
  max: number
  minLimit: number
  maxLimit: number
  value?: number
  displayValue: string
  logic: FlashLogic
  rangeStrategy: string
}

interface FlashFactorSection {
  id: string
  title: string
  shortTitle: string
  subtitle: string
  factors: QuantilearnApiFlashFactorCell[]
}

const route = useRoute()
const router = useRouter()
const quantilearnApi = useQuantilearnApi()
const apiBase = quantilearnApi.apiBase

const snapshotOptions: Array<{ id: FlashSnapshotId, label: string }> = [
  { id: 'current', label: '即时' },
  { id: '1', label: '1h' },
  { id: '2', label: '2h' },
  { id: '3', label: '3h' },
  { id: '6', label: '6h' },
]

const logicOptions: Array<{ id: FlashLogic, label: string }> = [
  { id: 'none', label: '不比较' },
  { id: 'max', label: '最大' },
  { id: 'min', label: '最小' },
  { id: 'gt-home', label: '大于同组A' },
  { id: 'gt-away', label: '大于同组B' },
  { id: 'lt-home', label: '小于同组A' },
  { id: 'lt-away', label: '小于同组B' },
]

const leagueOptions = [
  { id: 0, label: '全部' },
  { id: 1, label: '联赛' },
  { id: 2, label: '杯赛' },
  { id: 3, label: '友谊赛' },
]

const eventIdInput = ref(String(route.query.eid || route.query.eventId || '35675743'))
const activeSnapshot = ref<FlashSnapshotId>('current')
const selectedFactors = ref<SelectedFlashFactor[]>([])
const activeSectionId = ref('bf-core')
const activeLeagueType = ref(0)
const activeReportMode = ref<FlashReportMode>('full')
const activeReportDays = ref(365)
const analysisState = ref<'idle' | 'running' | 'done'>('idle')
const analysisResult = ref<QuantilearnApiFlashAnalysisResult | null>(null)
const analysisError = ref('')
const matchesState = ref<'idle' | 'running' | 'done'>('idle')
const matchesResult = ref<QuantilearnApiFlashMatchesResult | null>(null)
const matchesError = ref('')

const eventId = computed(() => String(route.query.eid || route.query.eventId || eventIdInput.value || '').trim())

const errorMessage = (error: unknown) => toQuantilearnUserError(error)

const formatDateTime = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

const factorOrder = (factorId: string) => {
  const match = /^f(\d+)$/i.exec(factorId)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

const factorName = (factor: Pick<QuantilearnApiFlashFactorCell, 'factorId' | 'description'>) => (
  factor.description?.trim() || `指标${factorOrder(factor.factorId)}`
)

const numberText = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return '-'
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2,
  }).format(value)
}

const percentText = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return '-'
  return `${Math.round(value * 100)}%`
}

const returnText = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return '-'
  return `${Math.round(value * 100)}%`
}

const {
  data: flashSnapshot,
  pending: snapshotPending,
  error: snapshotError,
  refresh: refreshSnapshot,
} = await useAsyncData(
  'quantilearn-flash-snapshot',
  () => eventId.value
    ? quantilearnApi.getFlashEventSnapshot(eventId.value, { snapshot: activeSnapshot.value })
    : Promise.resolve(null),
  {
    watch: [eventId, activeSnapshot],
    default: () => null,
  },
)

const snapshot = computed<QuantilearnApiFlashEventSnapshot | null>(() => flashSnapshot.value)
const factorsById = computed(() => new Map((snapshot.value?.factors ?? []).map(factor => [factor.factorId, factor])))
const selectedFactorIds = computed(() => new Set(selectedFactors.value.map(factor => factor.factorId)))
const matrixReady = computed(() => Boolean(snapshot.value?.vendorBaseAvailable && snapshot.value.factors.length))
const selectedLimit = computed(() => 8)
const canAddFactor = computed(() => selectedFactors.value.length < selectedLimit.value)
const flashError = computed(() => errorMessage(snapshotError.value))
const snapshotSourceLabel = computed(() => {
  if (snapshotPending.value) return '读取快照'
  if (flashError.value) return '快照错误'
  if (!snapshot.value) return '等待赛事'
  if (snapshot.value.usedLiveSnapshot) return `${snapshot.value.requestedSnapshot} -> 即时`
  return snapshot.value.snapshot === 'current' ? '即时快照' : `${snapshot.value.snapshot}h 快照`
})
const bestDefaultFactor = computed(() => factorsById.value.get('f36'))
const goalBalanceFactor = computed(() => factorsById.value.get('f40'))
const validValueCount = computed(() => (snapshot.value?.factors ?? []).filter(factor => factor.hasValue).length)

const factorPeerGroups = [
  ['f01', 'f02', 'f03'],
  ['f07', 'f08', 'f09'],
  ['f10', 'f11', 'f12'],
  ['f13', 'f14', 'f15'],
  ['f16', 'f17', 'f18'],
  ['f22', 'f23', 'f24'],
  ['f25', 'f26', 'f27'],
  ['f28', 'f29'],
  ['f30', 'f31'],
  ['f32', 'f33'],
  ['f34', 'f35'],
  ['f41', 'f42', 'f43'],
  ['f44', 'f45', 'f46'],
  ['f47', 'f48', 'f49'],
  ['f50', 'f51', 'f52'],
  ['f53', 'f54'],
  ['f55', 'f56'],
  ['f57', 'f58'],
  ['f59', 'f60'],
]

const sectionDefinitions = [
  { id: 'bf-core', title: '必发标准盘', shortTitle: '标准盘', subtitle: '成交 / 指数 / 价位', ids: ['f01', 'f02', 'f03', 'f04', 'f05', 'f06', 'f07', 'f08', 'f09', 'f10', 'f11', 'f12', 'f13', 'f14', 'f15', 'f16', 'f17', 'f18'] },
  { id: 'market-index', title: '市场指数', shortTitle: '市场', subtitle: '冷热 / 欧赔 / 凯利', ids: ['f19', 'f20', 'f21', 'f22', 'f23', 'f24', 'f25', 'f26', 'f27'] },
  { id: 'goals', title: '进球盘', shortTitle: '进球', subtitle: '大小球 / 均衡 / 仓位', ids: ['f28', 'f29', 'f30', 'f31', 'f32', 'f33', 'f34', 'f35', 'f36', 'f37', 'f38', 'f39', 'f40'] },
  { id: 'inner-outer-sfp', title: '标准盘内外盘', shortTitle: '标盘内外', subtitle: '成交拆分 / 盈亏拆分', ids: ['f41', 'f42', 'f43', 'f44', 'f45', 'f46', 'f47', 'f48', 'f49', 'f50', 'f51', 'f52'] },
  { id: 'inner-outer-goals', title: '进球盘内外盘', shortTitle: '进球内外', subtitle: '进球成交 / 进球盈亏', ids: ['f53', 'f54', 'f55', 'f56', 'f57', 'f58', 'f59', 'f60'] },
]

const factorSections = computed<FlashFactorSection[]>(() => {
  const map = factorsById.value
  return sectionDefinitions
    .map(section => ({
      id: section.id,
      title: section.title,
      shortTitle: section.shortTitle,
      subtitle: section.subtitle,
      factors: section.ids
        .map(id => map.get(id))
        .filter((factor): factor is QuantilearnApiFlashFactorCell => Boolean(factor))
        .sort((left, right) => factorOrder(left.factorId) - factorOrder(right.factorId)),
    }))
    .filter(section => section.factors.length)
})

const activeSection = computed(() => (
  factorSections.value.find(section => section.id === activeSectionId.value)
  ?? factorSections.value[0]
))

const selectedSummary = computed(() => {
  if (!selectedFactors.value.length) return '未选择'
  const names = selectedFactors.value.map(factor => factor.name)
  return names.length > 2 ? `${names.slice(0, 2).join(' / ')} 等 ${names.length} 项` : names.join(' / ')
})

const resetAnalysis = () => {
  analysisState.value = 'idle'
  analysisResult.value = null
  analysisError.value = ''
  matchesState.value = 'idle'
  matchesResult.value = null
  matchesError.value = ''
}

const createSelectedFactor = (factor: QuantilearnApiFlashFactorCell): SelectedFlashFactor => ({
  factorId: factor.factorId,
  name: factorName(factor),
  min: factor.suggestedMin ?? factor.minLimit,
  max: factor.suggestedMax ?? factor.maxLimit,
  minLimit: factor.minLimit,
  maxLimit: factor.maxLimit,
  value: factor.value,
  displayValue: factor.displayValue || numberText(factor.value),
  logic: 'none',
  rangeStrategy: factor.rangeStrategy,
})

const resetDefaultSelection = () => {
  const current = snapshot.value
  if (!current?.factors.length) {
    selectedFactors.value = []
    return
  }

  const defaultIds = current.defaultSelectedFactorIds?.length ? current.defaultSelectedFactorIds : ['f36']
  const defaults = defaultIds
    .map(id => current.factors.find(factor => factor.factorId === id))
    .filter((factor): factor is QuantilearnApiFlashFactorCell => Boolean(factor))

  selectedFactors.value = (defaults.length ? defaults : [current.factors[0]!]).map(createSelectedFactor)
}

watch(snapshot, () => {
  resetDefaultSelection()
  resetAnalysis()
  if (!factorSections.value.some(section => section.id === activeSectionId.value)) {
    activeSectionId.value = factorSections.value[0]?.id ?? 'bf-core'
  }
}, { immediate: true })

const loadEvent = async () => {
  const nextEventId = eventIdInput.value.trim()
  if (!nextEventId) return

  await router.replace({
    path: '/flash',
    query: { ...route.query, eid: nextEventId },
  })
}

const toggleFactor = (factor: QuantilearnApiFlashFactorCell) => {
  const existing = selectedFactors.value.find(item => item.factorId === factor.factorId)
  resetAnalysis()

  if (existing) {
    selectedFactors.value = selectedFactors.value.filter(item => item.factorId !== factor.factorId)
    return
  }

  if (!canAddFactor.value) return
  selectedFactors.value = [...selectedFactors.value, createSelectedFactor(factor)]
}

const removeSelectedFactor = (factorId: string) => {
  selectedFactors.value = selectedFactors.value.filter(factor => factor.factorId !== factorId)
  resetAnalysis()
}

const updateRange = (factorId: string, side: 'min' | 'max', event: Event) => {
  const input = event.target as HTMLInputElement
  const value = Number(input.value)
  if (Number.isNaN(value)) return

  selectedFactors.value = selectedFactors.value.map((factor) => {
    if (factor.factorId !== factorId) return factor
    return { ...factor, [side]: value }
  })
  resetAnalysis()
}

const updateLogic = (factorId: string, event: Event) => {
  const value = (event.target as HTMLSelectElement).value as FlashLogic
  selectedFactors.value = selectedFactors.value.map((factor) => {
    if (factor.factorId !== factorId) return factor
    return { ...factor, logic: value }
  })
  resetAnalysis()
}

const updateLeagueType = (leagueType: number) => {
  activeLeagueType.value = leagueType
  resetAnalysis()
}

const peersForFactor = (factorId: string) => {
  const group = factorPeerGroups.find(ids => ids.includes(factorId))
  return group?.filter(id => id !== factorId) ?? []
}

const peerForSide = (factorId: string, side: 'a' | 'b') => {
  const peers = peersForFactor(factorId)
  return peers[side === 'a' ? 0 : 1] ?? peers[0]
}

const buildAnalysisLogics = () => {
  const logics: QuantilearnFlashAnalysisLogic[] = []

  selectedFactors.value.forEach((factor) => {
    const peers = peersForFactor(factor.factorId)
    if (!peers.length || factor.logic === 'none') return

    if (factor.logic === 'max' || factor.logic === 'min') {
      peers.forEach((peerId) => {
        logics.push({
          comp: factor.logic === 'max' ? 1 : 2,
          compType: factor.logic === 'max' ? 0 : 1,
          x: factor.factorId,
          y: peerId,
        })
      })
      return
    }

    const target = factor.logic.endsWith('home')
      ? peerForSide(factor.factorId, 'a')
      : peerForSide(factor.factorId, 'b')
    if (!target) return

    logics.push({
      comp: factor.logic.startsWith('gt') ? 5 : 3,
      compType: factor.logic.startsWith('gt') ? 0 : 1,
      x: factor.factorId,
      y: target,
    })
  })

  return logics
}

const buildFlashRequestFactors = () => selectedFactors.value.map(factor => ({
  factorId: factor.factorId,
  min: factor.min,
  max: factor.max,
}))

const loadMatches = async () => {
  if (!analysisResult.value || !eventId.value || !selectedFactors.value.length) return

  matchesState.value = 'running'
  matchesError.value = ''

  try {
    matchesResult.value = await quantilearnApi.getFlashEventMatches(eventId.value, {
      factorSetName: 'spdex_v1',
      snapshot: activeSnapshot.value,
      leagueType: activeLeagueType.value,
      days: activeReportDays.value,
      half: activeReportMode.value === 'half',
      limit: 24,
      factors: buildFlashRequestFactors(),
      logics: buildAnalysisLogics(),
    })
    matchesState.value = 'done'
  }
  catch (error) {
    matchesError.value = errorMessage(error)
    matchesState.value = 'idle'
  }
}

const runAnalysis = async () => {
  if (!matrixReady.value || !selectedFactors.value.length || !eventId.value) return

  analysisState.value = 'running'
  analysisError.value = ''
  matchesState.value = 'idle'
  matchesResult.value = null
  matchesError.value = ''

  try {
    analysisResult.value = await quantilearnApi.analyzeFlashEvent(eventId.value, {
      factorSetName: 'spdex_v1',
      snapshot: activeSnapshot.value,
      leagueType: activeLeagueType.value,
      days: [7, 30, 365],
      includeHalf: true,
      factors: buildFlashRequestFactors(),
      logics: buildAnalysisLogics(),
    })
    analysisState.value = 'done'
    await loadMatches()
  }
  catch (error) {
    analysisError.value = errorMessage(error)
    analysisState.value = 'idle'
  }
}

const analysisPeriods = computed(() => analysisResult.value?.periods ?? [])
const activeAnalysisPeriod = computed(() => (
  analysisPeriods.value.find(period => period.days === activeReportDays.value && period.half === (activeReportMode.value === 'half'))
  ?? analysisPeriods.value[0]
))
const activeStatisticSummary = computed(() => (
  activeAnalysisPeriod.value
    ? ({ computed: activeAnalysisPeriod.value.computed } as QuantilearnApiStatisticSummary)
    : null
))
const analysisMarketRows = computed(() => statisticToMarketRows(activeStatisticSummary.value))
const analysisGoalRows = computed(() => statisticToGoalRows(activeStatisticSummary.value))
const bestMarket = computed(() => (
  analysisMarketRows.value.length
    ? [...analysisMarketRows.value].sort((left, right) => right.yearReturn - left.yearReturn)[0]
    : undefined
))
const reportDaysOptions = computed(() => (
  [...new Set(analysisPeriods.value.map(period => period.days))].sort((left, right) => left - right)
))
const matchStateLabel = computed(() => {
  if (matchesState.value === 'running') return '读取样本'
  if (matchesResult.value) return `${numberText(matchesResult.value.windowMatchedCount)} 场内取 ${matchesResult.value.matches.length} 场`
  return '等待分析'
})

const analysisStateLabel = computed(() => {
  if (analysisState.value === 'running') return '正在回测'
  if (analysisState.value === 'done') return '分析完成'
  return '参数就绪'
})

watch([activeReportDays, activeReportMode], () => {
  if (analysisState.value === 'done' && analysisResult.value) {
    void loadMatches()
  }
})

const refreshFlash = async () => {
  resetAnalysis()
  await refreshSnapshot()
}
</script>

<template>
  <div class="flash-page">
    <header class="flash-header">
      <div class="brand-block">
        <img class="brand-logo" src="/images/spdex_logo_s.png" alt="SPdex">
        <div>
          <span class="eyebrow">FlashQ.aspx</span>
          <h1>闪Q单场分析</h1>
        </div>
      </div>

      <form class="event-search" @submit.prevent="loadEvent">
        <label>
          <Search :size="15" />
          <input v-model="eventIdInput" type="search" inputmode="numeric" placeholder="EventId">
        </label>
        <button type="submit" class="primary-button focus-ring">
          <Target :size="15" />
          <span>加载</span>
        </button>
      </form>

      <div class="snapshot-tabs" aria-label="FlashQ snapshot">
        <button
          v-for="option in snapshotOptions"
          :key="option.id"
          type="button"
          :class="['snapshot-tab focus-ring', { active: activeSnapshot === option.id }]"
          @click="activeSnapshot = option.id"
        >
          {{ option.label }}
        </button>
      </div>

      <button type="button" class="icon-button focus-ring" title="刷新快照" @click="refreshFlash">
        <RefreshCw :size="16" />
      </button>
    </header>

    <main class="flash-layout">
      <section class="flash-stage">
        <section class="event-strip">
          <div class="event-title">
            <span :class="['live-dot', { loading: snapshotPending }]" />
            <div>
              <h2>{{ snapshot?.home || '主队' }} <span>vs</span> {{ snapshot?.away || '客队' }}</h2>
              <p>{{ snapshot?.league || '赛事' }} / {{ snapshot?.eventId || eventId || '-' }}</p>
            </div>
          </div>
          <div class="event-metrics">
            <div>
              <span>比赛时间</span>
              <strong>{{ formatDateTime(snapshot?.eventTimeUtc) }}</strong>
            </div>
            <div>
              <span>快照</span>
              <strong>{{ snapshotSourceLabel }}</strong>
            </div>
            <div>
              <span>总成交</span>
              <strong class="num">{{ bestDefaultFactor?.displayValue || '-' }}</strong>
            </div>
            <div>
              <span>进球均衡</span>
              <strong class="num">{{ goalBalanceFactor?.displayValue || '-' }}</strong>
            </div>
            <div>
              <span>有效因子</span>
              <strong class="num">{{ validValueCount }} / {{ snapshot?.factors.length ?? 0 }}</strong>
            </div>
          </div>
        </section>

        <section v-if="flashError" class="state-panel danger">
          <Database :size="16" />
          <span>{{ flashError }}</span>
        </section>

        <section v-else-if="snapshotPending" class="state-panel">
          <Activity :size="16" />
          <span>正在读取单场快照</span>
        </section>

        <section v-else class="matrix-shell">
          <aside class="section-tabs" aria-label="FlashQ factors">
            <button
              v-for="section in factorSections"
              :key="section.id"
              type="button"
              :class="['section-tab focus-ring', { active: activeSection?.id === section.id }]"
              @click="activeSectionId = section.id"
            >
              <strong>
                <span class="section-title-full">{{ section.title }}</span>
                <span class="section-title-compact">{{ section.shortTitle }}</span>
              </strong>
              <span>{{ section.subtitle }}</span>
              <em>{{ section.factors.length }}</em>
            </button>
          </aside>

          <div class="factor-matrix">
            <div class="matrix-title">
              <div>
                <span class="eyebrow">{{ activeSection?.factors.length ?? 0 }} 个可选指标</span>
                <h3>{{ activeSection?.title }}</h3>
              </div>
              <span class="status-chip plain">{{ selectedSummary }}</span>
            </div>

            <div class="factor-grid table-head">
              <span>因子</span>
              <span>当前值</span>
              <span>建议区间</span>
              <span>范围</span>
              <span />
            </div>

            <button
              v-for="factor in activeSection?.factors ?? []"
              :key="factor.factorId"
              type="button"
              :class="['factor-grid', 'factor-row', 'focus-ring', { selected: selectedFactorIds.has(factor.factorId), disabled: !factor.hasValue }]"
              :disabled="!factor.hasValue"
              @click="toggleFactor(factor)"
            >
              <span class="factor-name">
                <strong>{{ factorName(factor) }}</strong>
                <em>{{ factor.rangeStrategy }}</em>
              </span>
              <strong class="num value-cell">{{ factor.displayValue || '-' }}</strong>
              <span class="range-cell">
                <b class="num">{{ factor.suggestedMin === undefined ? '-' : numberText(factor.suggestedMin) }}</b>
                <ChevronRight :size="13" />
                <b class="num">{{ factor.suggestedMax === undefined ? '-' : numberText(factor.suggestedMax) }}</b>
              </span>
              <span class="limit-cell num">{{ numberText(factor.minLimit) }} - {{ numberText(factor.maxLimit) }}</span>
              <span class="select-mark">
                <MinusCircle v-if="selectedFactorIds.has(factor.factorId)" :size="16" />
                <PlusCircle v-else :size="16" />
              </span>
            </button>
          </div>
        </section>

        <section v-if="analysisResult || analysisError" class="report-shell">
          <div class="report-head">
            <div>
              <span class="eyebrow">FlashQ Report</span>
              <h3>临时模型回测</h3>
            </div>
            <div v-if="analysisResult" class="report-controls">
              <div class="snapshot-tabs compact-tabs">
                <button
                  v-for="days in reportDaysOptions"
                  :key="days"
                  type="button"
                  :class="['snapshot-tab focus-ring', { active: activeReportDays === days }]"
                  @click="activeReportDays = days"
                >
                  {{ days === 365 ? '1年' : `${days}日` }}
                </button>
              </div>
              <div class="snapshot-tabs compact-tabs">
                <button
                  type="button"
                  :class="['snapshot-tab focus-ring', { active: activeReportMode === 'full' }]"
                  @click="activeReportMode = 'full'"
                >
                  全场
                </button>
                <button
                  type="button"
                  :class="['snapshot-tab focus-ring', { active: activeReportMode === 'half' }]"
                  @click="activeReportMode = 'half'"
                >
                  半场
                </button>
              </div>
            </div>
          </div>

          <div v-if="analysisError" class="state-panel danger inline-state">
            <Database :size="16" />
            <span>{{ analysisError }}</span>
          </div>

          <template v-else-if="analysisResult && activeAnalysisPeriod">
            <div class="report-summary">
              <div>
                <span>总匹配</span>
                <strong class="num">{{ numberText(analysisResult.finalMatchedCount) }}</strong>
              </div>
              <div>
                <span>周期样本</span>
                <strong class="num">{{ numberText(activeAnalysisPeriod.windowDocumentCount) }}</strong>
              </div>
              <div>
                <span>有效赛果</span>
                <strong class="num">{{ numberText(activeAnalysisPeriod.validResultCount) }}</strong>
              </div>
              <div>
                <span>最佳方向</span>
                <strong>{{ bestMarket?.selection ?? '-' }}</strong>
              </div>
              <div>
                <span>年化估算</span>
                <strong class="num">{{ returnText(bestMarket?.yearReturn) }}</strong>
              </div>
            </div>

            <div class="report-grid">
              <section class="report-table">
                <div class="report-table-title">
                  <strong>市场分布</strong>
                  <span>{{ activeReportMode === 'half' ? '半场' : '全场' }}</span>
                </div>
                <div class="market-row table-head">
                  <span>市场</span>
                  <span>方向</span>
                  <span>数量</span>
                  <span>占比</span>
                  <span>均赔</span>
                  <span>概率</span>
                  <span>年化</span>
                </div>
                <div v-for="row in analysisMarketRows" :key="`${row.market}-${row.selection}`" class="market-row">
                  <span>{{ row.market }}</span>
                  <strong>{{ row.selection }}</strong>
                  <span class="num">{{ numberText(row.count) }}</span>
                  <span class="num">{{ percentText(row.distribution) }}</span>
                  <span class="num">{{ numberText(row.average) }}</span>
                  <span class="num">{{ percentText(row.probability) }}</span>
                  <span class="num">{{ returnText(row.yearReturn) }}</span>
                </div>
              </section>

              <section class="goal-board">
                <div class="report-table-title">
                  <strong>进球分布</strong>
                  <span>{{ activeAnalysisPeriod.computed.hit }} 场</span>
                </div>
                <div class="goal-bars">
                  <div v-for="row in analysisGoalRows" :key="row.label" class="goal-bar">
                    <span>{{ row.label }}</span>
                    <div>
                      <i :style="{ width: `${Math.min(100, activeAnalysisPeriod.computed.hit ? row.value / activeAnalysisPeriod.computed.hit * 100 : 0)}%` }" />
                    </div>
                    <strong class="num">{{ row.value }}</strong>
                  </div>
                </div>
              </section>
            </div>

            <section class="match-board">
              <div class="report-table-title">
                <strong>最近匹配赛事</strong>
                <span>{{ matchStateLabel }}</span>
              </div>
              <div v-if="matchesError" class="state-panel danger inline-state">
                <Database :size="16" />
                <span>{{ matchesError }}</span>
              </div>
              <div v-else-if="matchesState === 'running'" class="state-panel inline-state">
                <Activity :size="16" />
                <span>正在读取匹配赛事</span>
              </div>
              <div v-else-if="!matchesResult?.matches.length" class="empty-match">
                当前参数下暂无可展示样本。
              </div>
              <div v-else class="match-list">
                <div class="match-row table-head">
                  <span>时间</span>
                  <span>赛事</span>
                  <span>比分</span>
                  <span>胜平负</span>
                  <span>让球</span>
                  <span>进球</span>
                  <span>赔率</span>
                </div>
                <div v-for="match in matchesResult.matches" :key="match.eventId" class="match-row">
                  <span>{{ formatDateTime(match.eventTimeUtc) }}</span>
                  <div>
                    <strong>{{ match.home }} vs {{ match.away }}</strong>
                    <span>{{ match.league || match.eventId }}</span>
                  </div>
                  <strong class="num">{{ activeReportMode === 'half' && match.halfScore ? match.halfScore : match.score }}</strong>
                  <span>{{ match.oddsSelection }}</span>
                  <span>{{ match.asianSelection }}</span>
                  <span>{{ match.goalSelection }}</span>
                  <span class="num">{{ numberText(match.homeOdds) }} / {{ numberText(match.drawOdds) }} / {{ numberText(match.awayOdds) }}</span>
                </div>
              </div>
            </section>
          </template>
        </section>
      </section>

      <aside class="flash-sidebar">
        <section class="side-panel">
          <div class="panel-title">
            <div>
              <span class="eyebrow">Parameters</span>
              <h3>多因子参数</h3>
            </div>
            <span :class="['status-chip', selectedFactors.length >= selectedLimit ? 'warn' : 'good']">
              {{ selectedFactors.length }} / {{ selectedLimit }}
            </span>
          </div>

          <div class="selected-stack">
            <div v-for="factor in selectedFactors" :key="factor.factorId" class="selected-factor">
              <div class="selected-head">
                <div>
                  <strong>{{ factor.name }}</strong>
                  <span>当前 {{ factor.displayValue || numberText(factor.value) }}</span>
                </div>
                <button type="button" class="icon-button compact focus-ring" title="移除因子" @click="removeSelectedFactor(factor.factorId)">
                  <MinusCircle :size="15" />
                </button>
              </div>
              <div class="range-editor">
                <label>
                  <span>最小</span>
                  <input
                    :value="factor.min"
                    type="number"
                    :min="factor.minLimit"
                    :max="factor.maxLimit"
                    step="0.01"
                    @input="updateRange(factor.factorId, 'min', $event)"
                  >
                </label>
                <label>
                  <span>最大</span>
                  <input
                    :value="factor.max"
                    type="number"
                    :min="factor.minLimit"
                    :max="factor.maxLimit"
                    step="0.01"
                    @input="updateRange(factor.factorId, 'max', $event)"
                  >
                </label>
                <label>
                  <span>逻辑</span>
                  <select :value="factor.logic" @change="updateLogic(factor.factorId, $event)">
                    <option v-for="option in logicOptions" :key="option.id" :value="option.id">
                      {{ option.label }}
                    </option>
                  </select>
                </label>
              </div>
              <div class="factor-foot">
                <span>当前 {{ factor.displayValue || numberText(factor.value) }}</span>
                <span>{{ factor.rangeStrategy }}</span>
              </div>
            </div>
          </div>
        </section>

        <section class="side-panel action-panel">
          <div class="action-summary">
            <div>
              <span>匹配赛事</span>
              <strong>{{ snapshot?.eventId || '-' }}</strong>
            </div>
            <div>
              <span>快照路径</span>
              <strong>{{ snapshot?.vendorBasePath || '-' }}</strong>
            </div>
            <div>
              <span>默认市场</span>
              <strong>胜平负 / 进球盘</strong>
            </div>
            <div v-if="analysisResult">
              <span>总匹配</span>
              <strong>{{ numberText(analysisResult.finalMatchedCount) }}</strong>
            </div>
          </div>

          <div class="league-tabs">
            <button
              v-for="option in leagueOptions"
              :key="option.id"
              type="button"
              :class="['snapshot-tab focus-ring', { active: activeLeagueType === option.id }]"
              @click="updateLeagueType(option.id)"
            >
              {{ option.label }}
            </button>
          </div>

          <button type="button" class="analyze-button focus-ring" :disabled="!matrixReady || !selectedFactors.length || analysisState === 'running'" @click="runAnalysis">
            <PlayCircle :size="20" />
            <span>{{ analysisState === 'running' ? '分析中' : '分析' }}</span>
          </button>

          <div :class="['analysis-state', { active: analysisState !== 'idle' }]">
            <SlidersHorizontal :size="15" />
            <span>{{ analysisStateLabel }}</span>
          </div>
        </section>

        <section class="side-panel">
          <div class="panel-title compact-title">
            <div>
              <span class="eyebrow">Runtime</span>
              <h3>数据状态</h3>
            </div>
            <Clock :size="16" />
          </div>
          <div class="runtime-list">
            <div><span>API</span><strong>{{ apiBase }}</strong></div>
            <div><span>更新</span><strong>{{ formatDateTime(snapshot?.updateTimeUtc) }}</strong></div>
            <div><span>原始盘</span><strong>{{ snapshot?.vendorBaseAvailable ? '可用' : '缺失' }}</strong></div>
            <div v-if="snapshot?.warnings.length"><span>提示</span><strong>{{ snapshot.warnings[0] }}</strong></div>
          </div>
        </section>
      </aside>
    </main>

    <div class="mobile-run-bar">
      <div>
        <span>已选 {{ selectedFactors.length }} / {{ selectedLimit }}</span>
        <strong>{{ analysisStateLabel }}</strong>
      </div>
      <button type="button" class="primary-button focus-ring" :disabled="!matrixReady || !selectedFactors.length || analysisState === 'running'" @click="runAnalysis">
        <PlayCircle :size="17" />
        <span>{{ analysisState === 'running' ? '分析中' : '分析' }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.flash-page {
  min-height: 100vh;
  color: var(--ink);
}

.mobile-run-bar {
  display: none;
}

.flash-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(260px, 360px) auto auto;
  gap: 10px;
  align-items: center;
  min-height: 58px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
}

.brand-block,
.event-search,
.event-search label,
.snapshot-tabs,
.event-title,
.matrix-title,
.report-head,
.report-controls,
.report-table-title,
.goal-bar,
.range-cell,
.selected-head,
.factor-foot,
.analysis-state,
.league-tabs {
  display: flex;
  align-items: center;
  min-width: 0;
}

.brand-block {
  gap: 10px;
}

.brand-logo {
  display: block;
  flex: 0 0 96px;
  width: 96px;
  height: auto;
  max-height: 32px;
  object-fit: contain;
}

h1,
h2,
h3,
p {
  margin: 0;
  letter-spacing: 0;
}

h1 {
  font-size: 1rem;
  font-weight: 850;
}

.event-search {
  gap: 7px;
}

.event-search label {
  width: 100%;
  min-height: 34px;
  gap: 7px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted);
}

.event-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
}

.snapshot-tabs {
  gap: 5px;
}

.snapshot-tab {
  min-height: 34px;
  min-width: 42px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--muted);
  font-weight: 780;
}

.snapshot-tab.active {
  border-color: #132331;
  background: #132331;
  color: #ffffff;
}

.flash-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 12px;
  max-width: 1580px;
  margin: 0 auto;
  padding: 12px;
}

.flash-stage,
.flash-sidebar,
.selected-stack,
.runtime-list {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
}

.event-strip,
.matrix-shell,
.report-shell,
.side-panel,
.state-panel {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow);
}

.event-strip {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(0, 2fr);
  gap: 12px;
  padding: 10px 12px;
}

.event-title {
  gap: 10px;
}

.live-dot {
  flex: 0 0 10px;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--teal);
  box-shadow: 0 0 0 4px var(--teal-soft);
}

.live-dot.loading {
  background: var(--amber);
  box-shadow: 0 0 0 4px var(--amber-soft);
}

.event-title h2 {
  overflow-wrap: anywhere;
  font-size: 1.12rem;
  font-weight: 860;
  line-height: 1.18;
}

.event-title h2 span {
  color: var(--subtle);
  font-size: 0.82rem;
}

.event-title p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 0.76rem;
}

.event-metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
}

.event-metrics div,
.action-summary div,
.runtime-list div {
  min-width: 0;
  border-radius: 6px;
  background: var(--surface);
}

.event-metrics div {
  display: grid;
  gap: 2px;
  min-height: 48px;
  padding: 7px 8px;
}

.event-metrics span,
.action-summary span,
.runtime-list span {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-metrics strong,
.action-summary strong,
.runtime-list strong {
  overflow: hidden;
  color: var(--ink);
  font-size: 0.84rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state-panel {
  display: flex;
  align-items: center;
  min-height: 48px;
  gap: 8px;
  padding: 0 12px;
  color: var(--muted);
  font-weight: 780;
}

.state-panel.danger {
  background: var(--rose-soft);
  color: var(--rose);
}

.matrix-shell {
  display: grid;
  grid-template-columns: 178px minmax(0, 1fr);
  min-height: calc(100vh - 150px);
  overflow: hidden;
}

.section-tabs {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 10px;
  border-right: 1px solid var(--line);
  background: #f8fafc;
}

.section-tab {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 8px;
  min-height: 48px;
  padding: 7px 8px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  text-align: left;
}

.section-tab strong {
  overflow: hidden;
  color: inherit;
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-title-compact {
  display: none;
}

.section-tab span {
  grid-column: 1 / 2;
  color: var(--subtle);
  font-size: 0.7rem;
}

.section-tab em {
  grid-row: 1 / 3;
  grid-column: 2 / 3;
  align-self: center;
  font-style: normal;
  font-weight: 820;
}

.section-tab.active {
  border-color: #8bd4cc;
  background: #e8f7f5;
  color: #0b6f67;
}

.factor-matrix {
  min-width: 0;
  padding: 10px;
  overflow-x: auto;
}

.matrix-title {
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.matrix-title h3 {
  font-size: 0.98rem;
  font-weight: 840;
}

.factor-grid {
  display: grid;
  grid-template-columns: minmax(210px, 1.55fr) minmax(92px, 0.7fr) minmax(158px, 0.95fr) minmax(132px, 0.8fr) 34px;
  gap: 8px;
  align-items: center;
  min-width: 680px;
}

.factor-row {
  width: 100%;
  min-height: 42px;
  padding: 0 8px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: inherit;
  text-align: left;
}

.factor-row:hover {
  background: #f6fbfa;
}

.factor-row.selected {
  background: #e8f7f5;
}

.factor-row.disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.factor-name {
  display: grid;
  min-width: 0;
}

.factor-name strong,
.limit-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.factor-name strong {
  font-size: 0.8rem;
}

.factor-name em,
.limit-cell {
  color: var(--muted);
  font-size: 0.72rem;
  font-style: normal;
}

.value-cell {
  font-size: 0.86rem;
}

.range-cell {
  gap: 4px;
  color: var(--muted);
}

.range-cell b {
  color: var(--ink);
  font-size: 0.78rem;
}

.select-mark {
  display: grid;
  place-items: center;
  color: var(--teal);
}

.report-shell {
  display: grid;
  gap: 10px;
  padding: 10px;
}

.report-head {
  justify-content: space-between;
  gap: 10px;
}

.report-head h3 {
  font-size: 0.98rem;
  font-weight: 840;
}

.report-controls {
  gap: 8px;
  justify-content: flex-end;
}

.compact-tabs .snapshot-tab {
  min-height: 30px;
  min-width: 40px;
  padding: 0 9px;
  font-size: 0.76rem;
}

.inline-state {
  min-height: 40px;
  box-shadow: none;
}

.report-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
}

.report-summary div {
  display: grid;
  gap: 2px;
  min-width: 0;
  min-height: 48px;
  padding: 7px 8px;
  border-radius: 6px;
  background: var(--surface);
}

.report-summary span,
.report-table-title span,
.goal-bar span {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-summary strong {
  overflow: hidden;
  color: var(--ink);
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(280px, 0.9fr);
  gap: 10px;
  align-items: start;
}

.report-table,
.goal-board,
.match-board {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  background: var(--panel);
}

.report-table-title {
  justify-content: space-between;
  min-height: 38px;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
}

.report-table-title strong {
  font-size: 0.82rem;
}

.market-row {
  display: grid;
  grid-template-columns: minmax(58px, 0.8fr) minmax(64px, 0.9fr) repeat(5, minmax(52px, 0.7fr));
  gap: 8px;
  align-items: center;
  min-height: 34px;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
  font-size: 0.76rem;
}

.market-row:last-child {
  border-bottom: 0;
}

.market-row span,
.market-row strong,
.match-row span,
.match-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-board,
.match-list {
  display: grid;
}

.match-row {
  display: grid;
  grid-template-columns: 80px minmax(180px, 1.35fr) 52px 58px 68px 72px minmax(118px, 0.85fr);
  gap: 8px;
  align-items: center;
  min-height: 38px;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
  font-size: 0.74rem;
}

.match-row:last-child {
  border-bottom: 0;
}

.match-row div {
  display: grid;
  min-width: 0;
}

.match-row div span {
  color: var(--muted);
  font-size: 0.68rem;
}

.empty-match {
  min-height: 42px;
  padding: 12px;
  color: var(--muted);
  font-size: 0.78rem;
}

.goal-bars {
  display: grid;
  gap: 7px;
  padding: 10px;
}

.goal-bar {
  gap: 8px;
}

.goal-bar span {
  flex: 0 0 42px;
}

.goal-bar div {
  position: relative;
  flex: 1 1 auto;
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface);
}

.goal-bar i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: #189891;
}

.goal-bar strong {
  flex: 0 0 34px;
  text-align: right;
  font-size: 0.76rem;
}

.flash-sidebar {
  position: sticky;
  top: 70px;
  max-height: calc(100vh - 82px);
  overflow: auto;
}

.side-panel {
  display: grid;
  gap: 10px;
  padding: 10px;
}

.compact-title {
  align-items: start;
}

.selected-factor {
  display: grid;
  gap: 8px;
  padding: 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.selected-head {
  justify-content: space-between;
  gap: 8px;
}

.selected-head div {
  min-width: 0;
}

.selected-head strong {
  display: block;
  overflow: hidden;
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-head span {
  display: block;
  overflow: hidden;
  margin-top: 2px;
  color: var(--muted);
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.range-editor {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.range-editor label {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.range-editor span {
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 760;
}

.range-editor input,
.range-editor select {
  width: 100%;
  min-width: 0;
  min-height: 30px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--ink);
  font-size: 0.78rem;
}

.range-editor input {
  padding: 0 7px;
}

.range-editor select {
  padding: 0 4px;
}

.factor-foot {
  justify-content: space-between;
  gap: 8px;
  color: var(--subtle);
  font-size: 0.68rem;
}

.action-panel {
  background: linear-gradient(180deg, #ffffff 0%, #eef8f7 100%);
}

.action-summary,
.runtime-list {
  display: grid;
  gap: 6px;
}

.league-tabs {
  flex-wrap: wrap;
  gap: 5px;
}

.league-tabs .snapshot-tab {
  flex: 1 1 auto;
  min-height: 30px;
  min-width: 64px;
  font-size: 0.75rem;
}

.action-summary div,
.runtime-list div {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 32px;
  padding: 0 8px;
}

.analyze-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 74px;
  gap: 8px;
  border: 1px solid #0f8d83;
  border-radius: 999px;
  background: #128fcb;
  color: #ffffff;
  font-size: 1.08rem;
  font-weight: 850;
  box-shadow: 0 12px 24px rgba(15, 141, 131, 0.22);
}

.analyze-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.analysis-state {
  justify-content: center;
  min-height: 32px;
  gap: 6px;
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 780;
}

.analysis-state.active {
  background: var(--amber-soft);
  color: var(--amber);
}

@media (max-width: 1180px) {
  .flash-header {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "brand refresh"
      "search search"
      "snapshots snapshots";
  }

  .brand-block {
    grid-area: brand;
  }

  .event-search {
    grid-area: search;
  }

  .snapshot-tabs {
    grid-area: snapshots;
    overflow-x: auto;
  }

  .flash-layout {
    grid-template-columns: 1fr;
  }

  .flash-sidebar {
    position: static;
    max-height: none;
  }
}

@media (max-width: 760px) {
  .flash-page {
    padding-bottom: 74px;
  }

  .flash-layout {
    padding: 8px;
  }

  .flash-header {
    gap: 8px;
    padding: 8px;
  }

  .brand-logo {
    flex-basis: 82px;
    width: 82px;
    max-height: 28px;
  }

  h1 {
    font-size: 0.94rem;
  }

  .event-search {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .event-search label,
  .primary-button,
  .snapshot-tab {
    min-height: 36px;
  }

  .event-strip,
  .matrix-shell,
  .report-grid {
    grid-template-columns: 1fr;
  }

  .event-metrics,
  .report-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .section-tabs {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 7px;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  .section-tab {
    min-height: 46px;
    padding: 7px;
  }

  .section-title-full {
    display: none;
  }

  .section-title-compact {
    display: inline;
  }

  .section-tab strong {
    font-size: 0.78rem;
  }

  .section-tab span {
    font-size: 0.65rem;
  }

  .section-tab em {
    font-size: 0.78rem;
  }

  .factor-matrix {
    padding: 8px;
    overflow-x: visible;
  }

  .matrix-title {
    align-items: flex-start;
  }

  .matrix-title .status-chip {
    max-width: 42vw;
  }

  .factor-grid.table-head {
    display: none;
  }

  .factor-grid {
    min-width: 0;
  }

  .factor-row {
    grid-template-columns: minmax(0, 1fr) auto 28px;
    grid-template-areas:
      "name value mark"
      "range range mark"
      "limit limit mark";
    gap: 5px 8px;
    min-height: 76px;
    margin-bottom: 7px;
    padding: 9px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
  }

  .factor-row:last-child {
    margin-bottom: 0;
  }

  .factor-name {
    grid-area: name;
    gap: 2px;
  }

  .factor-name strong {
    font-size: 0.82rem;
    line-height: 1.25;
    white-space: normal;
  }

  .value-cell {
    grid-area: value;
    align-self: start;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--surface);
    font-size: 0.82rem;
  }

  .range-cell {
    grid-area: range;
    justify-content: flex-start;
    min-width: 0;
  }

  .range-cell::before {
    color: var(--muted);
    font-size: 0.68rem;
    font-weight: 760;
    content: '建议';
  }

  .limit-cell {
    grid-area: limit;
    font-size: 0.68rem;
  }

  .limit-cell::before {
    content: '范围 ';
  }

  .select-mark {
    grid-area: mark;
    align-self: center;
  }

  .report-head {
    display: grid;
    align-items: start;
  }

  .report-controls {
    justify-content: stretch;
    overflow-x: auto;
  }

  .market-row {
    grid-template-columns: minmax(54px, 0.8fr) minmax(54px, 0.8fr) repeat(3, minmax(48px, 0.7fr));
    min-width: 0;
    font-size: 0.72rem;
  }

  .market-row span:nth-child(6),
  .market-row span:nth-child(7),
  .market-row.table-head span:nth-child(6),
  .market-row.table-head span:nth-child(7) {
    display: none;
  }

  .match-row.table-head {
    display: none;
  }

  .match-row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "teams score"
      "time time"
      "markets markets";
    gap: 4px 8px;
    min-height: 72px;
    padding: 9px 10px;
    font-size: 0.74rem;
  }

  .match-row > span:first-child {
    grid-area: time;
    color: var(--muted);
  }

  .match-row > div {
    grid-area: teams;
  }

  .match-row > .num {
    grid-area: score;
    align-self: start;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--surface);
  }

  .match-row > span:nth-child(4),
  .match-row > span:nth-child(5),
  .match-row > span:nth-child(6) {
    grid-row: 3;
    color: var(--muted);
  }

  .match-row > span:nth-child(4)::before {
    content: '胜平负 ';
  }

  .match-row > span:nth-child(5)::before {
    content: '让球 ';
  }

  .match-row > span:nth-child(6)::before {
    content: '进球 ';
  }

  .match-row > span:nth-child(7) {
    display: none;
  }

  .range-editor {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .range-editor label:last-child {
    grid-column: 1 / -1;
  }

  .analyze-button {
    min-height: 54px;
    border-radius: 8px;
  }

  .mobile-run-bar {
    position: fixed;
    right: 8px;
    bottom: 8px;
    left: 8px;
    z-index: 30;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    min-height: 56px;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 18px 42px rgba(15, 23, 42, 0.18);
    backdrop-filter: blur(14px);
  }

  .mobile-run-bar div {
    display: grid;
    min-width: 0;
  }

  .mobile-run-bar span {
    color: var(--muted);
    font-size: 0.68rem;
    font-weight: 760;
  }

  .mobile-run-bar strong {
    overflow: hidden;
    color: var(--ink);
    font-size: 0.82rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-run-bar .primary-button {
    min-height: 40px;
  }
}

@media (max-width: 430px) {
  .section-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
