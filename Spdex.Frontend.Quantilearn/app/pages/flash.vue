<script setup lang="ts">
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Database,
  ExternalLink,
  Lock,
  MinusCircle,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
} from '@lucide/vue'
import {
  statisticToGoalRows,
  statisticToMarketRows,
} from '~/composables/useQuantilearnApi'
import type {
  QuantilearnApiFlashAnalysisResult,
  QuantilearnApiSuperBigTradesResult,
  QuantilearnApiFlashAccessStatus,
  QuantilearnApiFlashEventSnapshot,
  QuantilearnApiFlashFactorCell,
  QuantilearnApiFlashMatchesResult,
  QuantilearnApiPermissionProfile,
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

interface FlashFactorCard {
  id: string
  title: string
  subtitle: string
  factors: QuantilearnApiFlashFactorCell[]
}

interface SelectedFactorGroup {
  id: string
  title: string
  subtitle: string
  ids: string[]
  factors: SelectedFlashFactor[]
}

interface ClassicBacktestBar {
  label: string
  count: number
  percent: number
  average?: number
  probability?: number
  yearReturn?: number
}

interface ClassicBacktestChart {
  id: string
  title: string
  bars: ClassicBacktestBar[]
  wide?: boolean
}

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const quantilearnApi = useQuantilearnApi()

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

const activeSnapshot = ref<FlashSnapshotId>('current')
const selectedFactors = ref<SelectedFlashFactor[]>([])
const activeSectionId = ref('bf-core')
const activeLeagueType = ref(0)
const activeReportMode = ref<FlashReportMode>('full')
const activeReportDays = ref(365)
const parametersCollapsed = ref(false)
const expandedSelectedFactorId = ref<string | null>(null)
const reportPanel = ref<HTMLElement | null>(null)
const analysisState = ref<'idle' | 'running' | 'done'>('idle')
const analysisResult = ref<QuantilearnApiFlashAnalysisResult | null>(null)
const analysisResultsByLeagueType = ref<Record<number, QuantilearnApiFlashAnalysisResult>>({})
const analysisError = ref('')
const matchesState = ref<'idle' | 'running' | 'done'>('idle')
const matchesResult = ref<QuantilearnApiFlashMatchesResult | null>(null)
const matchesResultsByKey = ref<Record<string, QuantilearnApiFlashMatchesResult>>({})
const matchesError = ref('')
const purchaseState = ref<'idle' | 'running' | 'done'>('idle')
const purchaseError = ref('')
const bigTradesState = ref<'idle' | 'running' | 'done'>('idle')
const bigTradesResult = ref<QuantilearnApiSuperBigTradesResult | null>(null)
const bigTradesError = ref('')

const eventId = computed(() => String(route.query.eid || route.query.eventId || '').trim())
const hasValidEventId = computed(() => /^\d+$/.test(eventId.value))
const newspdexOrigin = computed(() => {
  try {
    return new URL(String(runtimeConfig.public.newspdexLoginUrl || 'https://new.spdex.com/login')).origin
  }
  catch {
    return 'https://new.spdex.com'
  }
})
const newspdexReturnUrl = computed(() => {
  const id = eventId.value
  return /^\d+$/.test(id)
    ? `${newspdexOrigin.value}/football/${id}`
    : `${newspdexOrigin.value}/football`
})
const newspdexUpgradeUrl = computed(() => `${newspdexOrigin.value}/account/upgrade`)

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

const moneyText = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return '-'
  return Math.round(value).toLocaleString('en-US')
}

const accessDateText = (value?: string) => {
  if (!value) return '-'
  return formatDateTime(value)
}

const {
  data: permissions,
  error: permissionsError,
  refresh: refreshPermissions,
} = await useAsyncData<QuantilearnApiPermissionProfile | null>(
  'quantilearn-flash-permissions',
  () => quantilearnApi.getPermissions(),
  { default: () => null },
)

const {
  data: flashAccess,
  pending: accessPending,
  error: accessError,
  refresh: refreshAccess,
} = await useAsyncData<QuantilearnApiFlashAccessStatus | null>(
  'quantilearn-flash-access',
  () => quantilearnApi.getFlashAccessStatus(true),
  { default: () => null },
)

const flashAccessStatus = computed(() => flashAccess.value ?? permissions.value?.flashQ ?? null)
const isFreeFlashRole = computed(() => {
  const role = String(permissions.value?.role || '').toLowerCase()
  return Boolean(
    (permissions.value?.roleId !== undefined && permissions.value.roleId <= 2)
    || role.includes('free')
    || role.includes('免费')
  )
})
const flashEntryBlocked = computed(() => isFreeFlashRole.value)
const flashEntryBlockMessage = computed(() => '免费版暂未开放闪Q，请升级会籍后使用。')
const eventEntryError = computed(() => (
  hasValidEventId.value
    ? ''
    : '缺少有效赛事 ID，请从赛事详情页进入闪Q单场分析。'
))
const canUseFlashWorkspace = computed(() => !flashEntryBlocked.value && hasValidEventId.value)

const {
  data: flashSnapshot,
  pending: snapshotPending,
  error: snapshotError,
  refresh: refreshSnapshot,
} = await useAsyncData(
  'quantilearn-flash-snapshot',
  () => hasValidEventId.value && !flashEntryBlocked.value
    ? quantilearnApi.getFlashEventSnapshot(eventId.value, { snapshot: activeSnapshot.value })
    : Promise.resolve(null),
  {
    watch: [eventId, activeSnapshot, flashEntryBlocked, hasValidEventId],
    default: () => null,
  },
)

const snapshot = computed<QuantilearnApiFlashEventSnapshot | null>(() => flashSnapshot.value)
const factorsById = computed(() => new Map((snapshot.value?.factors ?? []).map(factor => [factor.factorId, factor])))
const selectedFactorIds = computed(() => new Set(selectedFactors.value.map(factor => factor.factorId)))
const matrixReady = computed(() => Boolean(snapshot.value?.vendorBaseAvailable && snapshot.value.factors.length))
const selectedLimit = computed(() => permissions.value?.factor ?? flashAccessStatus.value?.factorLimit ?? 8)
const canUseGoalBalance = computed(() => permissions.value?.flashQCanUseGoalBalance ?? true)
const canUseInnerOuter = computed(() => permissions.value?.flashQCanUseInnerOuter ?? true)
const canUseLogics = computed(() => permissions.value?.flashQCanUseLogics ?? true)
const canUseInnerOuterLogics = computed(() => permissions.value?.flashQCanUseInnerOuterLogics ?? true)
const canAddFactor = computed(() => selectedFactors.value.length < selectedLimit.value)
const flashError = computed(() => {
  if (flashEntryBlocked.value) return ''
  if (eventEntryError.value) return eventEntryError.value
  return errorMessage(snapshotError.value)
})
const permissionError = computed(() => errorMessage(permissionsError.value || accessError.value))
const snapshotSourceLabel = computed(() => {
  if (snapshotPending.value) return '读取快照'
  if (eventEntryError.value) return '等待赛事'
  if (flashError.value) return '快照错误'
  if (!snapshot.value) return '等待赛事'
  if (snapshot.value.usedLiveSnapshot) return `${snapshot.value.requestedSnapshot} -> 即时`
  return snapshot.value.snapshot === 'current' ? '即时快照' : `${snapshot.value.snapshot}h 快照`
})
const totalAmountFactor = computed(() => factorsById.value.get('f36'))
const goalBalanceFactor = computed(() => factorsById.value.get('f40'))
const validValueCount = computed(() => (snapshot.value?.factors ?? []).filter(factor => factor.hasValue).length)
const flashAccessLabel = computed(() => {
  const status = flashAccessStatus.value
  if (accessPending.value) return '读取权限'
  if (permissionError.value) return '权限异常'
  return status?.message || '权限就绪'
})
const flashAccessTone = computed(() => {
  const status = flashAccessStatus.value
  if (!status) return 'plain'
  if (status.canAnalyze) return 'good'
  if (status.requiresPurchase) return 'warn'
  return 'danger'
})
const roleLabel = computed(() => {
  const raw = String(permissions.value?.role || '').trim()
  const clean = raw.split(/[：:]/)[0]?.trim()
  if (clean) return clean

  switch (permissions.value?.roleId) {
    case 11: return '翡翠版'
    case 12: return '红宝石版'
    case 5:
    case 13: return '白金版'
    default: return '黄金版'
  }
})
const flashCostLabel = computed(() => {
  const status = flashAccessStatus.value
  if (!status?.bagCount) return '免费'
  return `${status.bagCount} 锦囊 / ${status.hours}h`
})
const canPurchaseFlash = computed(() => (
  Boolean(flashAccessStatus.value?.requiresPurchase) && purchaseState.value !== 'running'
))
const flashRechargeUrl = computed(() => {
  const status = flashAccessStatus.value
  const base = String(runtimeConfig.public.newspdexSilkRechargeUrl || 'https://new.spdex.com/account/silkbag/recharge')
  const returnUrl = typeof window !== 'undefined'
    ? window.location.href
    : `${runtimeConfig.public.quantilearnPublicBaseUrl || ''}${route.fullPath}`
  const params = new URLSearchParams({
    product: 'flashq',
    returnUrl,
    required: String(status?.bagCount ?? 0),
    balance: String(status?.silkBalance ?? 0),
  })
  return `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`
})
const flashAccessBlocksAnalysis = computed(() => {
  const status = flashAccessStatus.value
  return Boolean(status && !status.canAnalyze)
})
const canRunAnalysis = computed(() => (
  hasValidEventId.value
  && matrixReady.value
  && selectedFactors.value.length > 0
  && analysisState.value !== 'running'
  && !flashAccessBlocksAnalysis.value
))

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
  { id: 'goals', title: '进球盘及总成交', shortTitle: '进球/总成', subtitle: '大小球 / 均衡 / 仓位', ids: ['f28', 'f29', 'f30', 'f31', 'f32', 'f33', 'f34', 'f35', 'f36', 'f37', 'f38', 'f39', 'f40'] },
  { id: 'inner-outer-sfp', title: '标准盘内外盘', shortTitle: '标盘内外', subtitle: '成交拆分 / 盈亏拆分', ids: ['f41', 'f42', 'f43', 'f44', 'f45', 'f46', 'f47', 'f48', 'f49', 'f50', 'f51', 'f52'] },
  { id: 'inner-outer-goals', title: '进球盘内外盘', shortTitle: '进球内外', subtitle: '进球成交 / 进球盈亏', ids: ['f53', 'f54', 'f55', 'f56', 'f57', 'f58', 'f59', 'f60'] },
]

const factorCardDefinitions: Array<{ id: string, title: string, subtitle: string, ids: string[] }> = [
  { id: 'bf-index', title: '必发指数', subtitle: '标准盘 主 / 平 / 客', ids: ['f01', 'f02', 'f03'] },
  { id: 'bf-volume', title: '成交量', subtitle: '标准盘 主 / 平 / 客', ids: ['f04', 'f05', 'f06'] },
  { id: 'bf-ratio', title: '比例', subtitle: '标准盘 主 / 平 / 客', ids: ['f07', 'f08', 'f09'] },
  { id: 'bf-profit', title: '模拟盈亏', subtitle: '标准盘 主 / 平 / 客', ids: ['f10', 'f11', 'f12'] },
  { id: 'bf-odds', title: '价位', subtitle: '标准盘 主 / 平 / 客', ids: ['f13', 'f14', 'f15'] },
  { id: 'bf-hot', title: '冷热/盈亏', subtitle: '标准盘 主 / 平 / 客', ids: ['f16', 'f17', 'f18'] },
  { id: 'market-hot', title: '挂牌指数', subtitle: '指数 主 / 平 / 客', ids: ['f19', 'f20', 'f21'] },
  { id: 'euro-average', title: '欧洲平均', subtitle: '欧赔 主 / 平 / 客', ids: ['f22', 'f23', 'f24'] },
  { id: 'kelly', title: '凯利方差', subtitle: '凯利 主 / 平 / 客', ids: ['f25', 'f26', 'f27'] },
  { id: 'goal-index', title: '进球指数', subtitle: '大 / 小', ids: ['f28', 'f29'] },
  { id: 'goal-volume', title: '进球成交', subtitle: '大 / 小', ids: ['f30', 'f31'] },
  { id: 'goal-ratio', title: '进球占比', subtitle: '大 / 小', ids: ['f32', 'f33'] },
  { id: 'goal-profit', title: '进球盈亏', subtitle: '大 / 小', ids: ['f34', 'f35'] },
  { id: 'goal-total', title: '总成交', subtitle: '标准盘 / 进球盘', ids: ['f36', 'f37'] },
  { id: 'goal-balance', title: '进球均衡', subtitle: '亚盘 / 比分 / 均衡', ids: ['f38', 'f39', 'f40'] },
  { id: 'sfp-io-volume', title: '标准盘成交拆分', subtitle: '主 / 平 / 客', ids: ['f41', 'f42', 'f43'] },
  { id: 'sfp-io-profit', title: '标准盘盈亏拆分', subtitle: '主 / 平 / 客', ids: ['f44', 'f45', 'f46'] },
  { id: 'sfp-io-hot', title: '标准盘冷热拆分', subtitle: '主 / 平 / 客', ids: ['f47', 'f48', 'f49'] },
  { id: 'sfp-io-index', title: '标准盘指数拆分', subtitle: '主 / 平 / 客', ids: ['f50', 'f51', 'f52'] },
  { id: 'goal-io-volume', title: '进球成交拆分', subtitle: '大 / 小', ids: ['f53', 'f54'] },
  { id: 'goal-io-profit', title: '进球盈亏拆分', subtitle: '大 / 小', ids: ['f55', 'f56'] },
  { id: 'goal-io-hot', title: '进球冷热拆分', subtitle: '大 / 小', ids: ['f57', 'f58'] },
  { id: 'goal-io-index', title: '进球指数拆分', subtitle: '大 / 小', ids: ['f59', 'f60'] },
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

const isGoalBalanceFactor = (factorId: string) => factorId.toLowerCase() === 'f40'

const isInnerOuterFactor = (factorId: string) => {
  const order = factorOrder(factorId)
  return order >= 41 && order <= 60
}

const factorPermissionMessage = (factorId: string) => {
  if (isGoalBalanceFactor(factorId) && !canUseGoalBalance.value) return '当前角色暂不可用进球均衡因子'
  if (isInnerOuterFactor(factorId) && !canUseInnerOuter.value) return '当前角色暂不可用内外盘因子'
  return ''
}

const isFactorAllowed = (factorId: string) => !factorPermissionMessage(factorId)

const logicOptionsForFactor = (factorId: string) => {
  if (!canUseLogics.value) return logicOptions.slice(0, 1)
  if (isInnerOuterFactor(factorId) && !canUseInnerOuterLogics.value) return logicOptions.slice(0, 1)
  return logicOptions
}

const activeSection = computed(() => (
  factorSections.value.find(section => section.id === activeSectionId.value)
  ?? factorSections.value[0]
))

const activeFactorCards = computed<FlashFactorCard[]>(() => {
  const section = activeSection.value
  if (!section) return []

  const map = new Map(section.factors.map(factor => [factor.factorId, factor]))
  const used = new Set<string>()
  const cards = factorCardDefinitions
    .map((card) => {
      const factors = card.ids
        .map(id => map.get(id))
        .filter((factor): factor is QuantilearnApiFlashFactorCell => Boolean(factor))
        .sort((left, right) => factorOrder(left.factorId) - factorOrder(right.factorId))

      factors.forEach(factor => used.add(factor.factorId))
      return { id: card.id, title: card.title, subtitle: card.subtitle, factors }
    })
    .filter(card => card.factors.length)

  const leftovers = section.factors.filter(factor => !used.has(factor.factorId))
  leftovers.forEach((factor) => {
    cards.push({
      id: factor.factorId,
      title: factorName(factor),
      subtitle: factor.factorId.toUpperCase(),
      factors: [factor],
    })
  })

  return cards
})

const activeFactorRowCount = computed(() => Math.max(0, ...activeFactorCards.value.map(card => card.factors.length)))

const factorBoardStyle = computed(() => {
  const columns = Math.max(activeFactorCards.value.length, 1)
  const labelWidth = activeSection.value?.id === 'goals' ? 48 : 58
  const columnWidth = activeSection.value?.id === 'goals' ? 124 : 136
  return {
    gridTemplateColumns: `${labelWidth}px repeat(${columns}, minmax(${columnWidth}px, 1fr))`,
    minWidth: `${labelWidth + columns * columnWidth}px`,
  }
})

const factorAt = (card: FlashFactorCard, rowNumber: number) => card.factors[rowNumber - 1]

const factorAxisLabel = (factor: QuantilearnApiFlashFactorCell, siblings: QuantilearnApiFlashFactorCell[]) => {
  const name = factorName(factor)
  if (/主队|主胜|标准盘主|主$/u.test(name)) return '主'
  if (/平局|标准盘平|平$/u.test(name)) return '平'
  if (/客队|客胜|标准盘客|客$/u.test(name)) return '客'
  if (/大球|大于|进球盘大|大$/u.test(name)) return '大'
  if (/小球|小于|进球盘小|小$/u.test(name)) return '小'
  if (/均衡/u.test(name)) return '均'

  const index = siblings.findIndex(item => item.factorId === factor.factorId)
  if (siblings.length === 3) return ['主', '平', '客'][index] ?? factor.factorId.toUpperCase()
  if (siblings.length === 2) return ['大', '小'][index] ?? factor.factorId.toUpperCase()
  return factor.factorId.toUpperCase()
}

const compactFactorName = (factor: QuantilearnApiFlashFactorCell, cardTitle: string) => {
  const name = factorName(factor)
  const compact = name
    .replace(cardTitle, '')
    .replace(/^[，,、\s]+/u, '')
    .trim()

  return compact || factor.factorId.toUpperCase()
}

const activeFactorRowLabel = (rowNumber: number) => {
  const card = activeFactorCards.value.find(item => factorAt(item, rowNumber))
  const factor = card ? factorAt(card, rowNumber) : undefined
  return factor && card ? factorAxisLabel(factor, card.factors) : String(rowNumber)
}

const factorValueText = (factor?: QuantilearnApiFlashFactorCell) => (
  factor ? factor.displayValue || numberText(factor.value) : '-'
)

const factorSuggestionText = (factor?: QuantilearnApiFlashFactorCell) => {
  if (!factor) return '-'
  const min = factor.suggestedMin === undefined ? '-' : numberText(factor.suggestedMin)
  const max = factor.suggestedMax === undefined ? '-' : numberText(factor.suggestedMax)
  return `${min} > ${max}`
}

const factorCellName = (factor: QuantilearnApiFlashFactorCell | undefined, card: FlashFactorCard) => (
  factor ? compactFactorName(factor, card.title) : ''
)

const factorCellHint = (factor?: QuantilearnApiFlashFactorCell) => (
  factor ? factorPermissionMessage(factor.factorId) || factor.rangeStrategy : ''
)

const factorCellSelected = (factor?: QuantilearnApiFlashFactorCell) => (
  Boolean(factor && selectedFactorIds.value.has(factor.factorId))
)

const factorCellDisabled = (factor?: QuantilearnApiFlashFactorCell) => (
  !factor || !factor.hasValue || !isFactorAllowed(factor.factorId)
)

const factorCellLocked = (factor?: QuantilearnApiFlashFactorCell) => (
  Boolean(factor && !isFactorAllowed(factor.factorId))
)

const toggleFactorCell = (factor?: QuantilearnApiFlashFactorCell) => {
  if (factor) toggleFactor(factor)
}

const selectedSummary = computed(() => {
  if (!selectedFactors.value.length) return '未选择'
  const names = selectedFactors.value.map(factor => factor.name)
  return names.length > 2 ? `${names.slice(0, 2).join(' / ')} 等 ${names.length} 项` : names.join(' / ')
})

const selectedFactorBrief = computed(() => selectedFactors.value.slice(0, 6).map(factor => ({
  id: factor.factorId,
  label: factor.name,
  range: `${numberText(factor.min)} - ${numberText(factor.max)}`,
  logic: logicOptions.find(option => option.id === factor.logic)?.label ?? '不比较',
})))

const hiddenSelectedFactorCount = computed(() => Math.max(0, selectedFactors.value.length - selectedFactorBrief.value.length))

const selectedFactorGroups = computed<SelectedFactorGroup[]>(() => {
  const selected = new Map(selectedFactors.value.map(factor => [factor.factorId, factor]))
  const used = new Set<string>()

  const groups = factorCardDefinitions
    .map((card) => {
      const factors = card.ids
        .map(id => selected.get(id))
        .filter((factor): factor is SelectedFlashFactor => Boolean(factor))

      if (!factors.length) return null
      factors.forEach(factor => used.add(factor.factorId))
      return {
        id: card.id,
        title: card.title,
        subtitle: card.subtitle,
        ids: card.ids,
        factors,
      }
    })
    .filter((group): group is SelectedFactorGroup => Boolean(group))

  const leftovers = selectedFactors.value.filter(factor => !used.has(factor.factorId))
  if (leftovers.length) {
    groups.push({
      id: 'other',
      title: '其他指标',
      subtitle: '自定义选择',
      ids: leftovers.map(factor => factor.factorId),
      factors: leftovers,
    })
  }

  return groups
})

const selectedFactorAxisLabel = (factor: SelectedFlashFactor, group: SelectedFactorGroup) => {
  const source = factorsById.value.get(factor.factorId)
  const siblings = group.ids
    .map(id => factorsById.value.get(id))
    .filter((item): item is QuantilearnApiFlashFactorCell => Boolean(item))

  if (source) return factorAxisLabel(source, siblings.length ? siblings : [source])

  const index = group.ids.findIndex(id => id === factor.factorId)
  if (group.ids.length === 3) return ['主', '平', '客'][index] ?? factor.factorId.toUpperCase()
  if (group.ids.length === 2) return ['大', '小'][index] ?? factor.factorId.toUpperCase()
  return factor.factorId.toUpperCase()
}

const selectedFactorValueText = (factor: SelectedFlashFactor) => (
  factor.displayValue || numberText(factor.value)
)

const selectedFactorRangeText = (factor: SelectedFlashFactor) => (
  `${numberText(factor.min)} - ${numberText(factor.max)}`
)

const selectedFactorLogicText = (factor: SelectedFlashFactor) => (
  logicOptions.find(option => option.id === factor.logic)?.label ?? '不比较'
)

const toggleSelectedEditor = (factorId: string) => {
  expandedSelectedFactorId.value = expandedSelectedFactorId.value === factorId ? null : factorId
}

const activeLeagueLabel = computed(() => (
  leagueOptions.find(option => option.id === activeLeagueType.value)?.label ?? '全部'
))

const resetAnalysis = () => {
  analysisState.value = 'idle'
  analysisResult.value = null
  analysisResultsByLeagueType.value = {}
  analysisError.value = ''
  matchesState.value = 'idle'
  matchesResult.value = null
  matchesResultsByKey.value = {}
  matchesError.value = ''
  bigTradesState.value = 'idle'
  bigTradesResult.value = null
  bigTradesError.value = ''
  parametersCollapsed.value = false
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

const syncSelectedFactorsWithSnapshot = () => {
  const current = snapshot.value
  if (!current?.factors.length) {
    selectedFactors.value = []
    return
  }

  const currentFactors = new Map(current.factors.map(factor => [factor.factorId, factor]))
  const nextFactors: SelectedFlashFactor[] = []
  selectedFactors.value.forEach((selected) => {
    const factor = currentFactors.get(selected.factorId)
    if (!factor?.hasValue || !isFactorAllowed(factor.factorId)) return

    const min = Math.max(factor.minLimit, Math.min(selected.min, factor.maxLimit))
    const max = Math.max(factor.minLimit, Math.min(selected.max, factor.maxLimit))
    const allowedValues = new Set(logicOptionsForFactor(factor.factorId).map(option => option.id))
    nextFactors.push({
      ...selected,
      name: factorName(factor),
      min: Math.min(min, max),
      max: Math.max(min, max),
      minLimit: factor.minLimit,
      maxLimit: factor.maxLimit,
      value: factor.value,
      displayValue: factor.displayValue || numberText(factor.value),
      logic: allowedValues.has(selected.logic) ? selected.logic : 'none',
      rangeStrategy: factor.rangeStrategy,
    })
  })
  selectedFactors.value = nextFactors
}

watch(snapshot, () => {
  syncSelectedFactorsWithSnapshot()
  resetAnalysis()
  if (!factorSections.value.some(section => section.id === activeSectionId.value)) {
    activeSectionId.value = factorSections.value[0]?.id ?? 'bf-core'
  }
}, { immediate: true })

const toggleFactor = (factor: QuantilearnApiFlashFactorCell) => {
  if (!factor.hasValue || !isFactorAllowed(factor.factorId)) return

  const existing = selectedFactors.value.find(item => item.factorId === factor.factorId)
  resetAnalysis()

  if (existing) {
    selectedFactors.value = selectedFactors.value.filter(item => item.factorId !== factor.factorId)
    if (expandedSelectedFactorId.value === factor.factorId) {
      expandedSelectedFactorId.value = null
    }
    return
  }

  if (!canAddFactor.value) return
  selectedFactors.value = [...selectedFactors.value, createSelectedFactor(factor)]
  expandedSelectedFactorId.value = factor.factorId
}

const removeSelectedFactor = (factorId: string) => {
  selectedFactors.value = selectedFactors.value.filter(factor => factor.factorId !== factorId)
  if (expandedSelectedFactorId.value === factorId) {
    expandedSelectedFactorId.value = null
  }
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
  const allowedValues = new Set(logicOptionsForFactor(factorId).map(option => option.id))
  selectedFactors.value = selectedFactors.value.map((factor) => {
    if (factor.factorId !== factorId) return factor
    return { ...factor, logic: allowedValues.has(value) ? value : 'none' }
  })
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

const createMatchesKey = (
  leagueType = activeLeagueType.value,
  days = activeReportDays.value,
  mode: FlashReportMode = activeReportMode.value,
) => `${leagueType}:${days}:${mode}`

const syncActiveMatchesFromCache = () => {
  const cached = matchesResultsByKey.value[createMatchesKey()]
  matchesResult.value = cached ?? null
  matchesState.value = cached ? 'done' : 'idle'
  matchesError.value = ''
}

const setActiveAnalysisResult = () => {
  analysisResult.value = analysisResultsByLeagueType.value[activeLeagueType.value] ?? null
  syncActiveMatchesFromCache()
}

const isActiveMatchesKey = (leagueType: number, key: string) => (
  leagueType === activeLeagueType.value && key === createMatchesKey()
)

const loadMatches = async (leagueType = activeLeagueType.value) => {
  const leagueAnalysis = analysisResultsByLeagueType.value[leagueType]
    ?? (analysisResult.value?.leagueType === leagueType ? analysisResult.value : null)
  if (!leagueAnalysis || !eventId.value || !selectedFactors.value.length) return

  const key = createMatchesKey(leagueType)
  const cached = matchesResultsByKey.value[key]
  if (cached) {
    if (isActiveMatchesKey(leagueType, key)) {
      matchesResult.value = cached
      matchesState.value = 'done'
      matchesError.value = ''
    }
    return
  }

  if (leagueType === activeLeagueType.value) {
    matchesState.value = 'running'
    matchesError.value = ''
  }

  try {
    const result = await quantilearnApi.getFlashEventMatches(eventId.value, {
      factorSetName: 'spdex_v1',
      snapshot: activeSnapshot.value,
      leagueType,
      days: activeReportDays.value,
      half: activeReportMode.value === 'half',
      limit: 24,
      factors: buildFlashRequestFactors(),
      logics: buildAnalysisLogics(),
    })
    matchesResultsByKey.value = {
      ...matchesResultsByKey.value,
      [key]: result,
    }
    if (isActiveMatchesKey(leagueType, key)) {
      matchesResult.value = result
      matchesState.value = 'done'
    }
  }
  catch (error) {
    if (isActiveMatchesKey(leagueType, key)) {
      matchesError.value = errorMessage(error)
      matchesState.value = 'idle'
    }
  }
}

const loadMatchesForAllLeagueTypes = async () => {
  await Promise.all(leagueOptions.map(option => loadMatches(option.id)))
}

const updateLeagueType = (leagueType: number) => {
  if (activeLeagueType.value === leagueType) return

  activeLeagueType.value = leagueType
  if (analysisState.value === 'done') {
    setActiveAnalysisResult()
    void loadMatches(leagueType)
  }
}

const loadBigTrades = async () => {
  bigTradesState.value = 'running'
  bigTradesError.value = ''

  try {
    bigTradesResult.value = await quantilearnApi.getFlashSuperBigTrades(20)
    bigTradesState.value = 'done'
  }
  catch (error) {
    bigTradesError.value = errorMessage(error)
    bigTradesState.value = 'idle'
  }
}

const runAnalysis = async () => {
  if (!matrixReady.value || !selectedFactors.value.length || !eventId.value) return

  if (flashAccessBlocksAnalysis.value) {
    analysisError.value = flashAccessStatus.value?.message || '当前账号暂不可使用闪Q分析。'
    return
  }

  analysisState.value = 'running'
  analysisError.value = ''
  analysisResultsByLeagueType.value = {}
  matchesState.value = 'idle'
  matchesResult.value = null
  matchesResultsByKey.value = {}
  matchesError.value = ''

  try {
    const scopeResult = await quantilearnApi.analyzeFlashEventScopes(eventId.value, {
      factorSetName: 'spdex_v1',
      snapshot: activeSnapshot.value,
      leagueType: 0,
      days: [7, 30, 365],
      includeHalf: true,
      factors: buildFlashRequestFactors(),
      logics: buildAnalysisLogics(),
    })
    analysisResultsByLeagueType.value = scopeResult.results.reduce<Record<number, QuantilearnApiFlashAnalysisResult>>((result, item) => {
      result[item.leagueType] = item
      return result
    }, {})
    setActiveAnalysisResult()
    analysisState.value = 'done'
    parametersCollapsed.value = true
    await refreshAccess()
    await Promise.all([
      loadMatchesForAllLeagueTypes(),
      loadBigTrades(),
    ])
    await nextTick()
    reportPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  catch (error) {
    analysisError.value = errorMessage(error)
    analysisState.value = 'idle'
    await refreshAccess()
  }
}

const purchaseFlashAccess = async () => {
  if (!canPurchaseFlash.value) return

  purchaseState.value = 'running'
  purchaseError.value = ''

  try {
    const result = await quantilearnApi.purchaseFlashAccess()
    purchaseState.value = result.success ? 'done' : 'idle'
    if (!result.success) {
      purchaseError.value = result.message || '闪Q开通失败。'
    }
    await Promise.all([refreshAccess(), refreshPermissions()])
  }
  catch (error) {
    purchaseError.value = errorMessage(error)
    purchaseState.value = 'idle'
    await refreshAccess()
  }
}

const goToSilkRecharge = () => {
  if (typeof window !== 'undefined') {
    window.location.href = flashRechargeUrl.value
  }
}

const analysisPeriods = computed(() => analysisResult.value?.periods ?? [])
const activeAnalysisPeriod = computed(() => (
  analysisPeriods.value.find(period => period.days === activeReportDays.value && period.half === (activeReportMode.value === 'half'))
  ?? analysisPeriods.value[0]
))
const hasAnalysisReport = computed(() => Boolean(analysisResult.value && activeAnalysisPeriod.value))
const activeStatisticSummary = computed(() => (
  activeAnalysisPeriod.value
    ? ({ computed: activeAnalysisPeriod.value.computed } as QuantilearnApiStatisticSummary)
    : null
))
const analysisMarketRows = computed(() => statisticToMarketRows(activeStatisticSummary.value))
const analysisGoalRows = computed(() => statisticToGoalRows(activeStatisticSummary.value))
const analysisGoalDiffRows = computed(() => {
  const report = activeAnalysisPeriod.value?.computed
  if (!report) return []

  return [
    { label: '主胜2+', value: report.homeWin2 },
    { label: '主胜1', value: report.homeWin1 },
    { label: '平局', value: report.draw0 },
    { label: '客胜1', value: report.awayWin1 },
    { label: '客胜2+', value: report.awayWin2 },
  ]
})

const reportHitRatio = (count: number) => {
  const hit = activeAnalysisPeriod.value?.computed.hit ?? 0
  return hit ? count / hit : 0
}

const reportDaysShortLabel = computed(() => {
  const days = activeAnalysisPeriod.value?.days ?? activeReportDays.value
  return days === 365 ? '1年' : `${days}日`
})

const classicMarketCharts = computed<ClassicBacktestChart[]>(() => {
  const report = activeAnalysisPeriod.value?.computed
  if (!report) return []

  const suffix = `${reportDaysShortLabel.value}回测匹配${numberText(report.hit)}场`
  return [
    {
      id: 'odds',
      title: `胜负平${suffix}`,
      bars: [
        { label: '主胜', count: report.homeOddsCount, percent: report.homeOddsPer, average: report.avrHomeOdds, probability: report.probHomeOdds, yearReturn: report.oddsHomeYearReturn },
        { label: '平局', count: report.drawOddsCount, percent: report.drawOddsPer, average: report.avrDrawOdds, probability: report.probDrawOdds, yearReturn: report.oddsDrawYearReturn },
        { label: '客胜', count: report.awayOddsCount, percent: report.awayOddsPer, average: report.avrAwayOdds, probability: report.probAwayOdds, yearReturn: report.oddsAwayYearReturn },
      ],
    },
    {
      id: 'asian',
      title: `让球${suffix}`,
      bars: [
        { label: '让球主', count: report.homeAsianCount, percent: report.homeAsianPer, average: report.avrAsianOddsHome, probability: report.homeAsianPer, yearReturn: report.asianHomeYearReturn },
        { label: '走盘', count: report.drawAsianCount, percent: reportHitRatio(report.drawAsianCount) },
        { label: '让球客', count: report.awayAsianCount, percent: report.awayAsianPer, average: report.avrAsianOddsAway, probability: report.awayAsianPer, yearReturn: report.asianAwayYearReturn },
      ],
    },
    {
      id: 'goals-market',
      title: `进球${suffix}`,
      bars: [
        { label: '大于2.5球', count: report.over25Count, percent: report.over25Per, average: report.avrOver25, probability: report.probOver25, yearReturn: report.over25YearReturn },
        { label: '小于2.5球', count: report.under25Count, percent: report.under25Per, average: report.avrUnder25, probability: report.probUnder25, yearReturn: report.under25YearReturn },
      ],
    },
  ]
})

const classicDistributionCharts = computed<ClassicBacktestChart[]>(() => {
  const report = activeAnalysisPeriod.value?.computed
  if (!report) return []

  const suffix = `${reportDaysShortLabel.value}回测匹配${numberText(report.hit)}场`
  return [
    {
      id: 'goal-distribution',
      title: `命中场次进球分布${suffix}`,
      wide: true,
      bars: analysisGoalRows.value.map(row => ({
        label: row.label,
        count: row.value,
        percent: reportHitRatio(row.value),
      })),
    },
    {
      id: 'goal-diff',
      title: `净胜球${suffix}`,
      bars: analysisGoalDiffRows.value.map(row => ({
        label: row.label,
        count: row.value,
        percent: reportHitRatio(row.value),
      })),
    },
  ]
})

const classicBacktestCharts = computed(() => [
  ...classicMarketCharts.value,
  ...classicDistributionCharts.value,
])

const classicChartColors = ['#83b3e6', '#46464f', '#9fe589', '#efa95f', '#7f7edf', '#dc6081', '#e2d55f', '#5c9ca1']

const classicChartBarColor = (index: number) => classicChartColors[index % classicChartColors.length]

const classicChartBarHeight = (bar: ClassicBacktestBar, chart: ClassicBacktestChart) => {
  const max = Math.max(...chart.bars.map(item => item.count), 1)
  if (!bar.count) return '4px'
  return `${Math.max(22, Math.round((bar.count / max) * 140))}px`
}

const bestMarket = computed(() => (
  analysisMarketRows.value.length
    ? [...analysisMarketRows.value].sort((left, right) => right.yearReturn - left.yearReturn)[0]
    : undefined
))
const rankedMarketRows = computed(() => [...analysisMarketRows.value].sort((left, right) => right.yearReturn - left.yearReturn))
const reportPeriodLabel = computed(() => {
  if (!activeAnalysisPeriod.value) return '等待分析'
  const days = activeAnalysisPeriod.value.days === 365 ? '近1年' : `近${activeAnalysisPeriod.value.days}日`
  return `${days} / ${activeAnalysisPeriod.value.half ? '半场' : '全场'}`
})
const reportKpis = computed(() => [
  { label: '总匹配', value: numberText(analysisResult.value?.finalMatchedCount) },
  { label: '周期样本', value: numberText(activeAnalysisPeriod.value?.windowDocumentCount) },
  { label: '有效赛果', value: numberText(activeAnalysisPeriod.value?.validResultCount) },
  { label: '命中分布', value: percentText(bestMarket.value?.distribution) },
  { label: '均赔', value: numberText(bestMarket.value?.average) },
  { label: '模型条件', value: `${selectedFactors.value.length} 因子 / ${buildAnalysisLogics().length} 逻辑` },
])
const returnTone = (value?: number) => {
  if (value === undefined || Number.isNaN(value)) return 'plain'
  if (value > 0.18) return 'good'
  if (value < 0) return 'danger'
  return 'warn'
}
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

const superBigTradeEvents = computed(() => (
  (bigTradesResult.value?.events ?? [])
    .filter(event => event.trades.length)
))

watch([activeReportDays, activeReportMode], () => {
  if (analysisState.value === 'done' && analysisResult.value) {
    void loadMatches()
  }
})

watch([selectedLimit, canUseGoalBalance, canUseInnerOuter, canUseLogics, canUseInnerOuterLogics], () => {
  const next = selectedFactors.value
    .filter(factor => isFactorAllowed(factor.factorId))
    .slice(0, selectedLimit.value)
    .map((factor) => {
      const allowedValues = new Set(logicOptionsForFactor(factor.factorId).map(option => option.id))
      return allowedValues.has(factor.logic) ? factor : { ...factor, logic: 'none' as FlashLogic }
    })

  if (next.length !== selectedFactors.value.length || next.some((factor, index) => factor !== selectedFactors.value[index])) {
    selectedFactors.value = next
    resetAnalysis()
  }
})

watch(() => selectedFactors.value.map(factor => factor.factorId).join('|'), () => {
  if (expandedSelectedFactorId.value && !selectedFactors.value.some(factor => factor.factorId === expandedSelectedFactorId.value)) {
    expandedSelectedFactorId.value = null
  }
})

const refreshFlash = async () => {
  resetAnalysis()
  await Promise.all([refreshSnapshot(), refreshAccess(), refreshPermissions()])
}
</script>

<template>
  <div class="flash-page">
    <header class="flash-header">
      <a class="brand-block focus-ring" href="https://new.spdex.com" aria-label="返回首页">
        <img class="brand-logo" src="/images/spdex_logo_s.png" alt="SPdex">
        <div>
          <h1>闪Q单场分析</h1>
        </div>
      </a>

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

      <div class="header-actions">
        <a class="return-link focus-ring" :href="newspdexReturnUrl" aria-label="返回赛事">
          <ArrowLeft :size="15" />
          <span>返回赛事</span>
        </a>
        <button type="button" class="icon-button header-refresh focus-ring" title="刷新赛事数据" @click="refreshFlash">
          <RefreshCw :size="16" />
        </button>
      </div>
    </header>

    <main :class="['flash-layout', { 'report-focus': parametersCollapsed && hasAnalysisReport }]">
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
              <strong class="num">{{ totalAmountFactor?.displayValue || '-' }}</strong>
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

        <section v-if="flashEntryBlocked" class="state-panel warn flash-access-block">
          <Lock :size="16" />
          <span>{{ flashEntryBlockMessage }}</span>
          <a class="inline-upgrade-link focus-ring" :href="newspdexUpgradeUrl">升级会籍</a>
        </section>

        <section v-else-if="flashError" class="state-panel danger">
          <Database :size="16" />
          <span>{{ flashError }}</span>
        </section>

        <section v-else-if="snapshotPending" class="state-panel">
          <Activity :size="16" />
          <span>正在读取单场快照</span>
        </section>

        <section v-else class="parameter-region">
          <section v-if="parametersCollapsed" class="parameter-collapsed">
            <div class="parameter-collapsed-head">
              <div>
                <span class="eyebrow">Parameters</span>
                <h3>{{ selectedSummary }}</h3>
              </div>
              <button type="button" class="ghost-button focus-ring" @click="parametersCollapsed = false">
                <ChevronDown :size="15" />
                <span>展开参数</span>
              </button>
            </div>
            <div class="condition-chips">
              <span v-for="factor in selectedFactorBrief" :key="factor.id" class="condition-chip">
                <strong>{{ factor.label }}</strong>
                <em>{{ factor.range }}</em>
              </span>
              <span v-if="hiddenSelectedFactorCount" class="condition-chip muted-chip">
                +{{ hiddenSelectedFactorCount }}
              </span>
            </div>
          </section>

          <section v-show="!parametersCollapsed" class="matrix-shell">
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
                <div class="matrix-actions">
                  <span class="status-chip plain">{{ selectedSummary }}</span>
                  <button type="button" class="ghost-button focus-ring" :disabled="!selectedFactors.length" @click="parametersCollapsed = true">
                    <ChevronUp :size="15" />
                    <span>收起参数</span>
                  </button>
                </div>
              </div>

              <div class="factor-board-shell">
                <div :class="['factor-board', activeSection ? `section-${activeSection.id}` : '']" :style="factorBoardStyle">
                  <div class="factor-board-title corner-cell">
                    类型
                  </div>
                  <div v-for="card in activeFactorCards" :key="card.id" class="factor-board-title">
                    <strong>{{ card.title }}</strong>
                    <span>{{ card.subtitle }}</span>
                  </div>

                  <template v-for="rowIndex in activeFactorRowCount" :key="`row-${rowIndex}`">
                    <div class="factor-row-label">
                      {{ activeFactorRowLabel(rowIndex) }}
                    </div>
                    <template v-for="card in activeFactorCards" :key="`${card.id}-${rowIndex}`">
                      <button
                        v-if="factorAt(card, rowIndex)"
                        type="button"
                        :class="['factor-cell', 'focus-ring', { selected: factorCellSelected(factorAt(card, rowIndex)), disabled: factorCellDisabled(factorAt(card, rowIndex)), locked: factorCellLocked(factorAt(card, rowIndex)) }]"
                        :disabled="factorCellDisabled(factorAt(card, rowIndex))"
                        :title="factorCellHint(factorAt(card, rowIndex))"
                        @click="toggleFactorCell(factorAt(card, rowIndex))"
                      >
                        <span class="factor-cell-name">
                          <strong>{{ factorCellName(factorAt(card, rowIndex), card) }}</strong>
                          <em>{{ factorCellHint(factorAt(card, rowIndex)) }}</em>
                        </span>
                        <strong class="num factor-cell-value">{{ factorValueText(factorAt(card, rowIndex)) }}</strong>
                        <span class="factor-cell-range">{{ factorSuggestionText(factorAt(card, rowIndex)) }}</span>
                        <span class="select-mark">
                          <Lock v-if="factorCellLocked(factorAt(card, rowIndex))" :size="15" />
                          <MinusCircle v-else-if="factorCellSelected(factorAt(card, rowIndex))" :size="16" />
                          <PlusCircle v-else :size="16" />
                        </span>
                      </button>
                      <div v-else class="factor-cell empty-cell">
                        -
                      </div>
                    </template>
                  </template>
                </div>
              </div>

              <div class="factor-mobile-groups">
                <article v-for="card in activeFactorCards" :key="`mobile-${card.id}`" class="factor-mobile-card">
                  <div class="factor-mobile-head">
                    <div>
                      <strong>{{ card.title }}</strong>
                      <span>{{ card.subtitle }}</span>
                    </div>
                    <em>{{ card.factors.length }}</em>
                  </div>

                  <div class="factor-mobile-grid">
                    <button
                      v-for="factor in card.factors"
                      :key="factor.factorId"
                      type="button"
                      :class="['mobile-factor-row', 'focus-ring', { selected: factorCellSelected(factor), disabled: factorCellDisabled(factor), locked: factorCellLocked(factor) }]"
                      :disabled="factorCellDisabled(factor)"
                      :title="`${factorCellName(factor, card)} / ${factorCellHint(factor)}`"
                      @click="toggleFactorCell(factor)"
                    >
                      <span class="mobile-factor-axis">{{ factorAxisLabel(factor, card.factors) }}</span>
                      <span class="mobile-factor-body">
                        <strong>{{ factorValueText(factor) }}</strong>
                        <small>{{ factorSuggestionText(factor) }}</small>
                      </span>
                      <span class="select-mark">
                        <Lock v-if="factorCellLocked(factor)" :size="15" />
                        <MinusCircle v-else-if="factorCellSelected(factor)" :size="16" />
                        <PlusCircle v-else :size="16" />
                      </span>
                    </button>
                  </div>
                </article>
              </div>
            </div>
          </section>
        </section>

        <section v-if="analysisResult || analysisError" ref="reportPanel" :class="['report-shell', { focused: parametersCollapsed && hasAnalysisReport }]">
          <div class="report-head">
            <div>
              <span class="eyebrow">FlashQ Report</span>
              <h3>临时模型回测</h3>
            </div>
            <div v-if="analysisResult" class="report-controls">
              <button type="button" class="ghost-button focus-ring" @click="parametersCollapsed = !parametersCollapsed">
                <component :is="parametersCollapsed ? ChevronDown : ChevronUp" :size="15" />
                <span>{{ parametersCollapsed ? '展开参数' : '收起参数' }}</span>
              </button>
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
            <section class="report-overview">
              <div class="primary-signal">
                <span class="eyebrow">Best Signal</span>
                <div>
                  <strong>{{ bestMarket?.selection ?? '-' }}</strong>
                  <em :class="['num', returnTone(bestMarket?.yearReturn)]">{{ returnText(bestMarket?.yearReturn) }}</em>
                </div>
                <p>{{ reportPeriodLabel }} / {{ activeLeagueLabel }} / {{ snapshotSourceLabel }}</p>
              </div>
              <div class="report-kpi-grid">
                <div v-for="item in reportKpis" :key="item.label">
                  <span>{{ item.label }}</span>
                  <strong class="num">{{ item.value }}</strong>
                </div>
              </div>
            </section>

            <section class="report-condition-strip">
              <div class="condition-strip-title">
                <BarChart3 :size="16" />
                <strong>当前模型条件</strong>
              </div>
              <div class="condition-chips">
                <span v-for="factor in selectedFactorBrief" :key="factor.id" class="condition-chip">
                  <strong>{{ factor.label }}</strong>
                  <em>{{ factor.range }} / {{ factor.logic }}</em>
                </span>
                <span v-if="hiddenSelectedFactorCount" class="condition-chip muted-chip">
                  +{{ hiddenSelectedFactorCount }}
                </span>
              </div>
            </section>

            <section class="classic-backtest-grid">
              <article
                v-for="chart in classicBacktestCharts"
                :key="chart.id"
                :class="['classic-chart-card', { wide: chart.wide }]"
              >
                <h4>{{ chart.title }}</h4>
                <div :class="['classic-bars', { compact: chart.bars.length <= 3, dense: chart.bars.length >= 5 }]">
                  <div v-for="(bar, index) in chart.bars" :key="bar.label" class="classic-bar-item">
                    <div class="classic-bar-value">
                      <strong>数量 {{ numberText(bar.count) }}</strong>
                      <span>占比 {{ percentText(bar.percent) }}</span>
                    </div>
                    <i
                      class="classic-bar-column"
                      :style="{ height: classicChartBarHeight(bar, chart), backgroundColor: classicChartBarColor(index) }"
                    />
                    <div class="classic-bar-foot">
                      <strong>{{ bar.label }}</strong>
                      <span v-if="bar.average !== undefined">平均价位:{{ numberText(bar.average) }}</span>
                      <span v-if="bar.probability !== undefined">平均概率:{{ percentText(bar.probability) }}</span>
                      <em v-if="bar.yearReturn !== undefined" :class="returnTone(bar.yearReturn)">年化收益: {{ returnText(bar.yearReturn) }}</em>
                    </div>
                  </div>
                </div>
              </article>
            </section>

            <section class="report-table report-detail-table">
              <div class="report-table-title">
                <strong>市场明细</strong>
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
              <div
                v-for="row in rankedMarketRows"
                :key="`${row.market}-${row.selection}`"
                :class="['market-row', { leader: row === bestMarket }, returnTone(row.yearReturn)]"
              >
                <span>{{ row.market }}</span>
                <strong>{{ row.selection }}</strong>
                <span class="num">{{ numberText(row.count) }}</span>
                <span class="num">{{ percentText(row.distribution) }}</span>
                <span class="num">{{ numberText(row.average) }}</span>
                <span class="num">{{ percentText(row.probability) }}</span>
                <span class="num">{{ returnText(row.yearReturn) }}</span>
              </div>
            </section>

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

            <section class="big-trades-board">
              <div class="report-table-title">
                <strong>今日超级大注</strong>
                <span>{{ bigTradesState === 'running' ? '读取中' : bigTradesResult?.accessLocked ? '权限锁定' : `命中 ${superBigTradeEvents.length} 场 / 扫描 ${bigTradesResult?.scannedEvents ?? 0} 场` }}</span>
              </div>
              <div v-if="bigTradesError" class="state-panel danger inline-state">
                <Database :size="16" />
                <span>{{ bigTradesError }}</span>
              </div>
              <div v-else-if="bigTradesResult?.accessLocked" class="state-panel inline-state">
                <Lock :size="16" />
                <span>{{ bigTradesResult.lockMessage || '当前会员暂不可查看完整大注提示。' }}</span>
              </div>
              <div v-else-if="bigTradesState === 'running'" class="state-panel inline-state">
                <Activity :size="16" />
                <span>正在读取重大成交</span>
              </div>
              <div v-else-if="!superBigTradeEvents.length" class="empty-match">
                当前未完场赛事暂无符合条件的今日超级大注。
              </div>
              <div v-else class="super-trade-list">
                <article v-for="event in superBigTradeEvents" :key="event.eventId" class="super-trade-event">
                  <div class="super-trade-event-head">
                    <div>
                      <strong>{{ event.homeTeam }} vs {{ event.awayTeam }}</strong>
                      <span>{{ event.league || event.eventId }} · {{ formatDateTime(event.matchTime) }}</span>
                    </div>
                    <div class="super-trade-meta">
                      <span class="num">总成交 {{ moneyText(event.totalAmount) }}</span>
                      <span>{{ event.trades.length }} 笔</span>
                    </div>
                  </div>
                  <div class="super-trade-row table-head">
                    <span>方向</span>
                    <span>成交</span>
                    <span>价位</span>
                    <span>属性</span>
                    <span>占比</span>
                    <span>发生</span>
                    <span>临场</span>
                    <span>维持</span>
                    <span>本场最大</span>
                  </div>
                  <div v-for="trade in event.trades" :key="`${event.eventId}-${trade.pcId}`" class="super-trade-row">
                    <strong>{{ trade.selection }}</strong>
                    <span class="num">{{ moneyText(trade.amount) }}</span>
                    <span class="num">{{ numberText(trade.price) }}</span>
                    <span>{{ trade.side }}</span>
                    <span :class="['num', 'trade-per', `hl${trade.highlight}`]">{{ percentText(trade.per) }}</span>
                    <span class="num">{{ formatDateTime(trade.updateTime) }}</span>
                    <span :class="['flag-cell', { on: trade.onTime }]">{{ trade.onTime ? '是' : '-' }}</span>
                    <span :class="['flag-cell', { on: trade.hold, strong: trade.hold2 }]">{{ trade.hold2 ? '维持2' : trade.hold ? '是' : '-' }}</span>
                    <span class="num">{{ trade.bossSelection }} {{ moneyText(trade.bossAmount) }} @{{ numberText(trade.bossPrice) }}</span>
                  </div>
                </article>
              </div>
            </section>
          </template>
        </section>
      </section>

      <aside class="flash-sidebar">
        <section v-if="canUseFlashWorkspace" :class="['side-panel', 'parameter-side-panel', { collapsed: parametersCollapsed && hasAnalysisReport }]">
          <div class="panel-title">
            <div>
              <span class="eyebrow">Parameters</span>
              <h3>多因子参数</h3>
            </div>
            <div class="panel-actions">
              <span :class="['status-chip', selectedFactors.length >= selectedLimit ? 'warn' : 'good']">
                {{ selectedFactors.length }} / {{ selectedLimit }}
              </span>
              <button
                v-if="hasAnalysisReport"
                type="button"
                class="icon-button compact focus-ring"
                :title="parametersCollapsed ? '展开参数' : '收起参数'"
                @click="parametersCollapsed = !parametersCollapsed"
              >
                <ChevronDown v-if="parametersCollapsed" :size="15" />
                <ChevronUp v-else :size="15" />
              </button>
            </div>
          </div>

          <div v-if="parametersCollapsed && hasAnalysisReport" class="selected-compact">
            <span v-for="factor in selectedFactorBrief.slice(0, 4)" :key="factor.id">
              {{ factor.label }}
            </span>
            <strong v-if="hiddenSelectedFactorCount">+{{ hiddenSelectedFactorCount }}</strong>
          </div>

          <div v-else-if="selectedFactorGroups.length" class="selected-group-stack">
            <article v-for="group in selectedFactorGroups" :key="group.id" class="selected-param-group">
              <div class="selected-param-group-head">
                <div>
                  <strong>{{ group.title }}</strong>
                  <span>{{ group.subtitle }}</span>
                </div>
                <em>{{ group.factors.length }}</em>
              </div>

              <div class="selected-param-grid">
                <button
                  v-for="factor in group.factors"
                  :key="factor.factorId"
                  type="button"
                  :class="['selected-param-chip', { expanded: expandedSelectedFactorId === factor.factorId }]"
                  :title="factor.name"
                  @click="toggleSelectedEditor(factor.factorId)"
                >
                  <span class="selected-param-axis">{{ selectedFactorAxisLabel(factor, group) }}</span>
                  <span class="selected-param-main">
                    <strong>{{ selectedFactorValueText(factor) }}</strong>
                    <em>{{ selectedFactorRangeText(factor) }}</em>
                  </span>
                  <span class="selected-param-logic">{{ selectedFactorLogicText(factor) }}</span>
                  <ChevronUp v-if="expandedSelectedFactorId === factor.factorId" class="selected-param-caret" :size="14" />
                  <ChevronDown v-else class="selected-param-caret" :size="14" />
                </button>
              </div>

              <template v-for="factor in group.factors" :key="`editor-${factor.factorId}`">
                <div v-if="expandedSelectedFactorId === factor.factorId" class="selected-factor selected-factor-editor">
                  <div class="selected-head">
                    <div>
                      <strong>{{ factor.name }}</strong>
                      <span>当前 {{ selectedFactorValueText(factor) }}</span>
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
                        <option v-for="option in logicOptionsForFactor(factor.factorId)" :key="option.id" :value="option.id">
                          {{ option.label }}
                        </option>
                      </select>
                    </label>
                  </div>
                  <div class="factor-foot">
                    <span>{{ selectedFactorRangeText(factor) }}</span>
                    <span>{{ factor.rangeStrategy }}</span>
                  </div>
                </div>
              </template>
            </article>
          </div>

          <div v-else class="empty-match">
            请选择因子。
          </div>
        </section>

        <section class="side-panel action-panel">
          <div class="panel-title compact-title">
            <div>
              <span class="eyebrow">Access</span>
              <h3>闪Q权限</h3>
            </div>
            <span :class="['status-chip', flashAccessTone]">
              {{ roleLabel }}
            </span>
          </div>

          <div class="access-card">
            <div class="access-line">
              <ShieldCheck :size="16" />
              <span>{{ flashAccessLabel }}</span>
            </div>
            <div class="access-facts">
              <div>
                <span>锦囊余额</span>
                <strong class="num">{{ flashAccessStatus?.silkBalance === undefined ? '-' : moneyText(flashAccessStatus.silkBalance) }}</strong>
              </div>
              <div>
                <span>开通成本</span>
                <strong>{{ flashCostLabel }}</strong>
              </div>
              <div>
                <span>因子上限</span>
                <strong>{{ selectedLimit }} 个</strong>
              </div>
              <div>
                <span>到期</span>
                <strong>{{ accessDateText(flashAccessStatus?.expiredAtUtc) }}</strong>
              </div>
            </div>
            <button
              v-if="flashAccessStatus?.requiresPurchase"
              type="button"
              class="purchase-button focus-ring"
              :disabled="!canPurchaseFlash"
              @click="purchaseFlashAccess"
            >
              <Wallet :size="16" />
              <span>{{ purchaseState === 'running' ? '开通中' : '消耗锦囊开通' }}</span>
            </button>
            <div v-if="flashAccessStatus?.requiresRecharge" class="access-warning">
              <AlertTriangle :size="15" />
              <span>锦囊余额不足，请先充值后再开通闪Q。</span>
            </div>
            <button
              v-if="flashAccessStatus?.requiresRecharge"
              type="button"
              class="purchase-button recharge-button focus-ring"
              @click="goToSilkRecharge"
            >
              <ExternalLink :size="16" />
              <span>购买锦囊</span>
            </button>
            <div v-if="purchaseError" class="access-warning danger-text">
              <AlertTriangle :size="15" />
              <span>{{ purchaseError }}</span>
            </div>
            <div v-if="permissionError" class="access-warning danger-text">
              <AlertTriangle :size="15" />
              <span>{{ permissionError }}</span>
            </div>
          </div>

          <div v-if="canUseFlashWorkspace" class="league-tabs">
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

          <button v-if="canUseFlashWorkspace" type="button" class="analyze-button focus-ring" :disabled="!canRunAnalysis" @click="runAnalysis">
            <PlayCircle :size="20" />
            <span>{{ analysisState === 'running' ? '分析中' : '分析' }}</span>
          </button>

          <div v-if="canUseFlashWorkspace" :class="['analysis-state', { active: analysisState !== 'idle' }]">
            <SlidersHorizontal :size="15" />
            <span>{{ analysisStateLabel }}</span>
          </div>
        </section>

      </aside>
    </main>

    <div v-if="canUseFlashWorkspace" class="mobile-run-bar">
      <div>
        <span>已选 {{ selectedFactors.length }} / {{ selectedLimit }}</span>
        <strong>{{ analysisStateLabel }}</strong>
      </div>
      <button type="button" class="primary-button focus-ring" :disabled="!canRunAnalysis" @click="runAnalysis">
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
  grid-template-columns: minmax(220px, 1fr) auto auto;
  gap: 10px;
  align-items: center;
  min-height: 58px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
}

.brand-block,
.header-actions,
.snapshot-tabs,
.event-title,
.matrix-title,
.report-head,
.report-controls,
.report-table-title,
.parameter-collapsed-head,
.matrix-actions,
.panel-actions,
.condition-strip-title,
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
  color: inherit;
  text-decoration: none;
}

.header-actions {
  justify-self: end;
  gap: 8px;
}

.return-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  color: var(--ink);
  text-decoration: none;
  font-size: 0.86rem;
  font-weight: 850;
  white-space: nowrap;
  box-shadow: 0 2px 5px rgba(21, 32, 43, 0.05);
}

.return-link:hover {
  border-color: rgba(58, 160, 151, 0.42);
  background: #f4fbfa;
  color: var(--teal-dark);
}

.header-refresh {
  flex: 0 0 auto;
  justify-self: end;
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

.flash-layout.report-focus {
  grid-template-columns: minmax(0, 1fr) 320px;
}

.flash-stage,
.flash-sidebar,
.selected-group-stack,
.selected-stack {
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

.event-metrics div {
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

.event-metrics span {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-metrics strong {
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

.state-panel.warn {
  background: #fff8e5;
  color: #9a6519;
}

.flash-access-block {
  flex-wrap: wrap;
  align-items: center;
  padding: 10px 12px;
}

.inline-upgrade-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  margin-left: auto;
  padding: 0 12px;
  border: 1px solid #e4c681;
  border-radius: 6px;
  background: #fff2bd;
  color: #4f3510;
  font-size: 0.78rem;
  font-weight: 820;
  text-decoration: none;
}

.matrix-shell {
  display: grid;
  grid-template-columns: 178px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
}

.parameter-region {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.parameter-collapsed {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff 0%, #f6faf9 100%);
  box-shadow: var(--shadow);
}

.parameter-collapsed-head {
  justify-content: space-between;
  gap: 10px;
}

.parameter-collapsed-head h3 {
  overflow: hidden;
  max-width: 68vw;
  font-size: 0.92rem;
  font-weight: 840;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.condition-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.condition-chip {
  display: inline-grid;
  gap: 1px;
  max-width: 220px;
  min-height: 38px;
  padding: 5px 8px;
  border: 1px solid #d7e6e4;
  border-radius: 7px;
  background: #f7fbfa;
}

.condition-chip strong,
.condition-chip em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.condition-chip strong {
  color: var(--ink);
  font-size: 0.74rem;
}

.condition-chip em {
  color: var(--muted);
  font-size: 0.66rem;
  font-style: normal;
}

.muted-chip {
  place-items: center;
  min-width: 42px;
  color: var(--muted);
  font-weight: 820;
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

.matrix-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.factor-board-shell {
  min-width: 0;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
}

.factor-board {
  display: grid;
  min-width: 0;
}

.factor-board-title,
.factor-row-label,
.factor-cell {
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.factor-board-title {
  display: grid;
  align-content: center;
  gap: 2px;
  min-width: 0;
  min-height: 54px;
  padding: 8px 10px;
  background: #8ccfd0;
  color: #ffffff;
  text-align: center;
}

.factor-board-title strong,
.factor-board-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.factor-board-title strong {
  font-size: 0.8rem;
  font-weight: 850;
}

.factor-board-title span {
  color: rgba(255, 255, 255, 0.86);
  font-size: 0.64rem;
  font-weight: 760;
}

.corner-cell {
  background: #68b8ba;
  font-size: 0.74rem;
  font-weight: 850;
}

.factor-row-label {
  display: grid;
  place-items: center;
  min-height: 78px;
  background: #f7fbfb;
  color: #557378;
  font-size: 0.82rem;
  font-weight: 860;
}

.factor-cell {
  display: grid;
  grid-template-areas:
    "value mark"
    "name mark"
    "range mark";
  grid-template-columns: minmax(0, 1fr) 24px;
  gap: 3px 6px;
  align-content: center;
  width: 100%;
  min-width: 0;
  min-height: 78px;
  padding: 9px 8px;
  border-top: 0;
  border-left: 0;
  background: #ffffff;
  color: var(--ink);
  text-align: left;
}

.factor-cell:hover {
  background: #f6fbfa;
}

.factor-cell.selected {
  background: #e7f6f5;
  box-shadow: inset 0 3px 0 #58aaa5;
}

.factor-cell.disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.factor-cell.locked {
  background: #fbf7f1;
}

.factor-cell.empty-cell {
  display: grid;
  place-items: center;
  color: var(--subtle);
  background: #fbfcfd;
  font-weight: 760;
}

.factor-cell-name {
  grid-area: name;
  display: grid;
  min-width: 0;
}

.factor-cell-name strong,
.factor-cell-name em,
.factor-cell-value,
.factor-cell-range {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.factor-cell-name strong {
  color: var(--ink);
  font-size: 0.7rem;
  font-weight: 800;
}

.factor-cell-name em {
  color: var(--subtle);
  font-size: 0.62rem;
  font-style: normal;
}

.factor-cell-value {
  grid-area: value;
  font-size: 0.96rem;
  font-weight: 850;
}

.factor-cell-range {
  grid-area: range;
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 760;
}

.factor-cell .select-mark {
  grid-area: mark;
  align-self: center;
}

.factor-board.section-goals .factor-board-title {
  min-height: 48px;
  padding: 7px 8px;
}

.factor-board.section-goals .factor-row-label,
.factor-board.section-goals .factor-cell {
  min-height: 66px;
}

.factor-board.section-goals .factor-cell {
  padding: 7px;
}

.factor-board.section-goals .factor-cell-value {
  font-size: 0.9rem;
}

.factor-mobile-groups {
  display: none;
}

.factor-mobile-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
}

.factor-mobile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 38px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  background: #8ccfd0;
  color: #ffffff;
}

.factor-mobile-head div {
  display: grid;
  min-width: 0;
}

.factor-mobile-head strong,
.factor-mobile-head span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.factor-mobile-head strong {
  font-size: 0.78rem;
  font-weight: 850;
}

.factor-mobile-head span {
  color: rgba(255, 255, 255, 0.86);
  font-size: 0.62rem;
  font-weight: 760;
}

.factor-mobile-head em {
  display: grid;
  place-items: center;
  flex: 0 0 26px;
  min-height: 24px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.24);
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 850;
}

.factor-mobile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(94px, 1fr));
  gap: 0;
}

.mobile-factor-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 22px;
  grid-template-areas:
    "axis mark"
    "body mark";
  gap: 3px 4px;
  align-content: center;
  width: 100%;
  min-width: 0;
  min-height: 68px;
  padding: 7px 7px;
  border: 0;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  background: #ffffff;
  color: var(--ink);
  text-align: left;
}

.mobile-factor-row:last-child {
  border-bottom: 0;
}

.mobile-factor-row.selected {
  background: #e7f6f5;
  box-shadow: inset 0 3px 0 #58aaa5;
}

.mobile-factor-row.disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.mobile-factor-row.locked {
  background: #fbf7f1;
}

.mobile-factor-axis {
  grid-area: axis;
  width: fit-content;
  min-width: 22px;
  min-height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #f1f7f7;
  color: #557378;
  font-size: 0.68rem;
  font-weight: 860;
  line-height: 20px;
}

.mobile-factor-body {
  grid-area: body;
  display: grid;
  min-width: 0;
}

.mobile-factor-body strong,
.mobile-factor-body em,
.mobile-factor-body small,
.mobile-factor-hint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-factor-body strong {
  color: var(--ink);
  font-size: 0.86rem;
  font-weight: 850;
}

.mobile-factor-body em {
  color: var(--ink);
  font-size: 0.76rem;
  font-style: normal;
  font-weight: 780;
}

.mobile-factor-body small,
.mobile-factor-hint {
  color: var(--muted);
  font-size: 0.62rem;
  font-weight: 760;
}

.mobile-factor-hint {
  text-align: right;
}

.mobile-factor-row .select-mark {
  grid-area: mark;
  align-self: center;
  justify-self: end;
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

.factor-row.locked {
  background: #fbf7f1;
  opacity: 0.72;
}

.factor-row.locked .select-mark {
  color: var(--amber);
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
  scroll-margin-top: 150px;
}

.report-shell.focused {
  border-color: #9fd8d3;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.11);
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

.report-overview {
  display: grid;
  grid-template-columns: minmax(240px, 0.9fr) minmax(0, 1.8fr);
  gap: 10px;
  min-width: 0;
}

.primary-signal {
  display: grid;
  align-content: center;
  min-width: 0;
  min-height: 112px;
  padding: 12px;
  border: 1px solid #bedbd8;
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(234, 248, 246, 0.96) 100%);
}

.primary-signal div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.primary-signal strong {
  overflow: hidden;
  color: var(--ink);
  font-size: 1.42rem;
  font-weight: 900;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.primary-signal em {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.9rem;
  font-style: normal;
  font-weight: 850;
}

.primary-signal p {
  margin-top: 8px;
  color: var(--muted);
  font-size: 0.76rem;
}

.report-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
  min-width: 0;
}

.report-kpi-grid div {
  display: grid;
  align-content: center;
  gap: 3px;
  min-width: 0;
  min-height: 52px;
  padding: 8px 9px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
}

.report-kpi-grid span {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-kpi-grid strong {
  overflow: hidden;
  color: var(--ink);
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-condition-strip {
  display: grid;
  gap: 7px;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fbfcfd;
}

.condition-strip-title {
  gap: 7px;
  color: var(--muted);
  font-size: 0.76rem;
}

.condition-strip-title strong {
  color: var(--ink);
}

.good {
  color: #0b6f67;
}

.warn {
  color: #9a5d00;
}

.danger {
  color: var(--rose);
}

.primary-signal .good,
.market-row.good span:last-child {
  background: var(--teal-soft);
  color: #0b6f67;
}

.primary-signal .warn,
.market-row.warn span:last-child {
  background: var(--amber-soft);
  color: #9a5d00;
}

.primary-signal .danger,
.market-row.danger span:last-child {
  background: var(--rose-soft);
  color: var(--rose);
}

.classic-backtest-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-items: start;
}

.classic-chart-card {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  min-height: 238px;
  padding: 12px 14px 10px;
  border: 1px solid #dfe7f0;
  border-radius: 4px;
  background: #ffffff;
}

.classic-chart-card.wide {
  grid-column: span 2;
}

.classic-chart-card h4 {
  overflow: hidden;
  margin: 0;
  color: #2b2f36;
  font-size: 1rem;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.classic-bars {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(58px, 1fr));
  gap: 14px;
  align-items: end;
  min-height: 194px;
}

.classic-bars.compact {
  grid-template-columns: repeat(auto-fit, minmax(58px, 1fr));
  gap: 12px;
}

.classic-bars.dense {
  grid-template-columns: repeat(auto-fit, minmax(42px, 1fr));
  gap: 8px;
}

.classic-bar-item {
  display: grid;
  grid-template-rows: auto 1fr auto;
  justify-items: center;
  min-width: 0;
  min-height: 194px;
}

.classic-bar-value {
  align-self: end;
  width: max-content;
  max-width: 100%;
  margin-bottom: 5px;
  color: #111827;
  font-size: 0.68rem;
  font-weight: 860;
  line-height: 1.18;
  text-align: left;
}

.classic-bar-value strong,
.classic-bar-value span,
.classic-bar-foot strong,
.classic-bar-foot span,
.classic-bar-foot em {
  display: block;
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.classic-bar-value span {
  margin-top: 1px;
}

.classic-bar-column {
  align-self: end;
  display: block;
  width: min(68%, 72px);
  min-width: 34px;
}

.classic-bar-foot {
  display: grid;
  justify-items: center;
  gap: 1px;
  width: 100%;
  min-height: 58px;
  padding-top: 7px;
  border-top: 1px solid #cfd9ea;
  color: #5a6270;
  font-size: 0.68rem;
  font-weight: 780;
  line-height: 1.18;
  text-align: center;
}

.classic-bar-foot strong {
  color: #555b64;
  font-size: 0.75rem;
  font-weight: 900;
}

.classic-bar-foot em {
  color: #ff3b2f;
  font-style: normal;
  font-weight: 900;
}

.classic-bar-foot em.good,
.classic-bar-foot em.warn {
  color: #ff3b2f;
}

.classic-bar-foot em.danger {
  color: #c94d64;
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
  grid-template-columns: minmax(0, 1.5fr) repeat(2, minmax(230px, 0.78fr));
  gap: 10px;
  align-items: start;
}

.report-table,
.goal-board,
.match-board,
.big-trades-board {
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

.market-row.leader {
  background: #f2fbfa;
}

.market-row.leader strong {
  color: #0b6f67;
}

.market-row.good span:last-child,
.market-row.warn span:last-child,
.market-row.danger span:last-child {
  justify-self: start;
  min-width: 52px;
  padding: 2px 7px;
  border-radius: 999px;
  font-weight: 840;
}

.market-row span,
.market-row strong,
.match-row span,
.match-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.report-detail-table {
  overflow-x: auto;
}

.match-board,
.match-list {
  display: grid;
}

.big-trades-board {
  display: grid;
}

.super-trade-list {
  display: grid;
  gap: 8px;
  padding: 8px;
}

.super-trade-event {
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
}

.super-trade-event-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 42px;
  padding: 7px 9px;
  border-bottom: 1px solid var(--line);
  background: #f7fafc;
}

.super-trade-event-head div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.super-trade-event-head strong,
.super-trade-event-head span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.super-trade-event-head strong {
  color: var(--ink);
  font-size: 0.78rem;
}

.super-trade-event-head span {
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 760;
}

.super-trade-meta {
  justify-items: end;
}

.super-trade-row {
  display: grid;
  grid-template-columns: 38px minmax(76px, 0.9fr) 44px 48px 52px 74px 42px 50px minmax(112px, 1fr);
  gap: 6px;
  align-items: center;
  min-width: 720px;
  min-height: 31px;
  padding: 0 8px;
  border-bottom: 1px solid var(--line);
  font-size: 0.69rem;
}

.super-trade-row:last-child {
  border-bottom: 0;
}

.super-trade-row.table-head {
  border-bottom-color: rgba(255, 255, 255, 0.18);
  background: #7d7aee;
  color: #ffffff;
  font-weight: 820;
}

.super-trade-row span,
.super-trade-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flag-cell {
  color: var(--muted);
  font-weight: 780;
}

.flag-cell.on {
  color: var(--teal);
}

.flag-cell.strong {
  color: var(--rose);
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

.big-trades-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 8px;
}

.big-trade-group {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--surface);
}

.big-trade-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 34px;
  padding: 0 8px;
  border-bottom: 1px solid var(--line);
}

.big-trade-head strong {
  overflow: hidden;
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.big-trade-head span {
  color: var(--muted);
  font-size: 0.74rem;
}

.big-trade-row {
  display: grid;
  grid-template-columns: 34px minmax(58px, 0.9fr) 42px 42px 48px 74px;
  gap: 6px;
  align-items: center;
  min-height: 30px;
  padding: 0 8px;
  border-bottom: 1px solid var(--line);
  font-size: 0.7rem;
}

.big-trade-row:last-child {
  border-bottom: 0;
}

.big-trade-row span,
.big-trade-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trade-per {
  color: var(--muted);
  font-weight: 780;
}

.trade-per.hl1 {
  color: var(--amber);
}

.trade-per.hl2 {
  color: var(--rose);
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

.panel-actions {
  justify-content: flex-end;
  gap: 6px;
}

.parameter-side-panel.collapsed {
  gap: 8px;
}

.selected-compact {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}

.selected-compact span,
.selected-compact strong {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 26px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 760;
}

.selected-compact span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-group-stack {
  gap: 8px;
}

.selected-param-group {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}

.selected-param-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  min-height: 38px;
  padding: 7px 8px;
  border-bottom: 1px solid var(--line);
  background: #f6faf9;
}

.selected-param-group-head div {
  min-width: 0;
}

.selected-param-group-head strong,
.selected-param-group-head span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-param-group-head strong {
  color: var(--ink);
  font-size: 0.78rem;
}

.selected-param-group-head span {
  margin-top: 1px;
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 740;
}

.selected-param-group-head em {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: #dff4f1;
  color: var(--teal);
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 860;
}

.selected-param-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(138px, 1fr));
  background: var(--line);
  gap: 1px;
}

.selected-param-chip {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto 14px;
  gap: 6px;
  align-items: center;
  min-width: 0;
  min-height: 58px;
  padding: 7px;
  border: 0;
  background: #ffffff;
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.selected-param-chip:hover,
.selected-param-chip.expanded {
  background: #eaf8f6;
}

.selected-param-chip.expanded {
  box-shadow: inset 0 3px 0 #22a39b;
}

.selected-param-axis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: #eef7f6;
  color: #476b6c;
  font-size: 0.8rem;
  font-weight: 900;
}

.selected-param-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.selected-param-main strong,
.selected-param-main em,
.selected-param-logic {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-param-main strong {
  font-size: 0.9rem;
  font-weight: 900;
  line-height: 1.1;
}

.selected-param-main em {
  color: var(--muted);
  font-size: 0.68rem;
  font-style: normal;
  font-weight: 760;
}

.selected-param-logic {
  max-width: 56px;
  padding: 2px 6px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.62rem;
  font-weight: 780;
}

.selected-param-caret {
  color: var(--muted);
}

.selected-factor {
  display: grid;
  gap: 8px;
  padding: 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.selected-factor-editor {
  border-width: 1px 0 0;
  border-radius: 0;
  background: #fbfefd;
  box-shadow: none;
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

.access-card {
  display: grid;
  gap: 8px;
  padding: 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.76);
}

.access-line,
.access-warning,
.purchase-button {
  display: flex;
  align-items: center;
  min-width: 0;
}

.access-line {
  gap: 7px;
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 780;
}

.access-line span,
.access-warning span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.access-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.access-facts div {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 6px 7px;
  border-radius: 6px;
  background: var(--surface);
}

.access-facts span {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.access-facts strong {
  overflow: hidden;
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.purchase-button {
  justify-content: center;
  min-height: 34px;
  gap: 6px;
  border: 1px solid #0f8d83;
  border-radius: 6px;
  background: #128fcb;
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 820;
}

.purchase-button:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.recharge-button {
  border-color: #c08418;
  background: #b7791f;
}

.access-warning {
  gap: 6px;
  color: var(--amber);
  font-size: 0.72rem;
  font-weight: 760;
}

.danger-text {
  color: var(--rose);
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
      "brand actions"
      "snapshots snapshots";
  }

  .brand-block {
    grid-area: brand;
  }

  .snapshot-tabs {
    grid-area: snapshots;
    overflow-x: auto;
  }

  .header-actions {
    grid-area: actions;
  }

  .flash-layout {
    grid-template-columns: 1fr;
  }

  .flash-layout.report-focus {
    grid-template-columns: 1fr;
  }

  .flash-sidebar {
    position: static;
    max-height: none;
  }
}

@media (max-width: 980px) {
  .factor-board-shell {
    display: none;
  }

  .factor-mobile-groups {
    display: grid;
    gap: 8px;
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

  .primary-button,
  .snapshot-tab {
    min-height: 36px;
  }

  .event-strip,
  .matrix-shell,
  .report-overview,
  .report-grid,
  .classic-backtest-grid {
    grid-template-columns: 1fr;
  }

  .classic-chart-card.wide {
    grid-column: auto;
  }

  .classic-chart-card h4 {
    white-space: normal;
  }

  .classic-bars,
  .classic-bars.compact {
    gap: 10px;
    min-height: 174px;
  }

  .classic-bar-item {
    min-height: 174px;
  }

  .classic-bar-column {
    min-width: 28px;
  }

  .big-trades-grid {
    grid-template-columns: 1fr;
  }

  .event-metrics,
  .report-summary,
  .report-kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .parameter-collapsed-head,
  .report-head {
    display: grid;
    align-items: start;
  }

  .parameter-collapsed-head h3 {
    max-width: none;
    white-space: normal;
  }

  .condition-chip {
    max-width: 100%;
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

  .factor-mobile-groups {
    gap: 7px;
  }

  .factor-mobile-grid {
    grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
  }

  .mobile-factor-row {
    grid-template-columns: minmax(0, 1fr) 22px;
    grid-template-areas:
      "axis mark"
      "body mark";
    min-height: 64px;
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

  .selected-param-grid {
    grid-template-columns: repeat(auto-fit, minmax(126px, 1fr));
  }

  .selected-param-chip {
    grid-template-columns: 24px minmax(0, 1fr) 14px;
    grid-template-areas:
      "axis main caret"
      "axis logic caret";
    min-height: 62px;
  }

  .selected-param-axis {
    grid-area: axis;
    width: 24px;
    height: 24px;
  }

  .selected-param-main {
    grid-area: main;
  }

  .selected-param-logic {
    grid-area: logic;
    justify-self: start;
    max-width: 100%;
  }

  .selected-param-caret {
    grid-area: caret;
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

  .selected-param-grid {
    grid-template-columns: repeat(auto-fit, minmax(116px, 1fr));
  }

  .selected-param-main strong {
    font-size: 0.84rem;
  }

  .selected-param-logic {
    max-width: 76px;
  }
}
</style>
