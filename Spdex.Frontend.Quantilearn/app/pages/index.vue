<script setup lang="ts">
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  Flag,
  Layers,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Star,
  Target,
  TrendingUp,
  XCircle,
} from '@lucide/vue'
import ContextRail from '~/components/quantilearn/ContextRail.vue'
import MetricStrip from '~/components/quantilearn/MetricStrip.vue'
import ModelHero from '~/components/quantilearn/ModelHero.vue'
import ModelScopePanel from '~/components/quantilearn/ModelScopePanel.vue'
import ReportWorkspace from '~/components/quantilearn/ReportWorkspace.vue'
import WorkbenchTopBar from '~/components/quantilearn/WorkbenchTopBar.vue'
import { toQuantilearnUserError } from '~/utils/quantilearnErrors'
import {
  statisticToGoalRows,
  statisticToMarketRows,
  statisticsToReportPeriods,
  toFactorDefinition,
  toHallModel,
  toHitEvent,
  toPermissionProfile,
  toQuantModel,
  toSelectedFactors,
} from '~/composables/useQuantilearnApi'
import type {
  FactorDefinition,
  FactorGroupId,
  HallModel,
  HallType,
  LeagueScope,
  ModelFilter,
  ModelId,
  QuantModel,
  ReportView,
  SelectedFactor,
  WorkspaceId,
} from '~/data/quantilearnPrototype'
import {
  actionState,
  factorGroups,
  factorDefinitions as prototypeFactorDefinitions,
  finalMarketRows as prototypeFinalMarketRows,
  goalRows as prototypeGoalRows,
  hallModels,
  halfMarketRows,
  hitEvents,
  modelFilters,
  models as prototypeModels,
  permissions as prototypePermissions,
  reportPeriods as prototypeReportPeriods,
  selectedFactors as prototypeSelectedFactors,
  stateLabel,
  stateTone,
  timeline,
  workspaces,
} from '~/data/quantilearnPrototype'

const quantilearnApi = useQuantilearnApi()

const activeWorkspace = ref<WorkspaceId>('models')
const selectedModelId = ref<ModelId>('')
const modelFilter = ref<ModelFilter>('all')
const searchText = ref('')
const leagueScope = ref<LeagueScope>('all')
const reportView = ref<ReportView>('final')
const activeFactorGroup = ref<FactorGroupId>('bf-index')
const expandedBuilderFactorId = ref<string | null>(null)
const hallType = ref<HallType>('all')
const hallOrder = ref<'return' | 'hit' | 'distribution' | 'price' | 'updated'>('return')
const hallKeyword = ref('')
const hallStrict = ref(false)
const hallPageSize = ref(50)
const currentOnly = ref(true)

const apiBase = quantilearnApi.apiBase
const hitEventSnapshots = ref<Record<string, { league: string, home: string, away: string, score: string }>>({})
const pendingHitEventSnapshotIds = new Set<string>()
const subscriptionBusyModelId = ref('')
const subscriptionNotice = ref('')
const subscriptionError = ref('')

const hallTypeOptions: Array<{ id: HallType, label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'sfp', label: '胜平负' },
  { id: 'asian', label: '让球' },
  { id: 'ou', label: '大小' },
]

const hallOrderOptions: Array<{ id: 'return' | 'hit' | 'distribution' | 'price' | 'updated', label: string }> = [
  { id: 'return', label: '年化' },
  { id: 'distribution', label: '分布' },
  { id: 'hit', label: '样本' },
  { id: 'price', label: '价格' },
  { id: 'updated', label: '最新' },
]

const errorMessage = (error: unknown) => toQuantilearnUserError(error)

const {
  data: apiModelDetails,
  pending: modelsPending,
  error: modelsError,
  refresh: refreshModels,
} = await useAsyncData('quantilearn-models', () => quantilearnApi.getModels(50), {
  default: () => [],
})

const {
  data: apiFactors,
  pending: factorsPending,
  error: factorsError,
} = await useAsyncData('quantilearn-factors', () => quantilearnApi.getFactors(), {
  default: () => [],
})

const {
  data: apiPermissions,
  pending: permissionsPending,
  error: permissionsError,
  refresh: refreshPermissions,
} = await useAsyncData('quantilearn-permissions', () => quantilearnApi.getPermissions(), {
  default: () => null,
})

const hasApiModels = computed(() => apiModelDetails.value.length > 0)

if (apiModelDetails.value.length && !selectedModelId.value) {
  selectedModelId.value = apiModelDetails.value[0]!.id
}

const {
  data: apiStatistics,
  pending: reportPending,
  error: reportError,
  refresh: refreshReport,
} = await useAsyncData(
  'quantilearn-selected-statistics',
  async () => {
    if (!hasApiModels.value || !selectedModelId.value) return []

    return Promise.all([7, 30, 365].map(days => quantilearnApi.getStatisticSummary(selectedModelId.value, days)))
  },
  {
    watch: [selectedModelId],
    default: () => [],
  },
)

const {
  data: apiHalfStatistics,
  pending: halfReportPending,
  error: halfReportError,
  refresh: refreshHalfReport,
} = await useAsyncData(
  'quantilearn-selected-half-statistics',
  async () => {
    if (!hasApiModels.value || !selectedModelId.value) return []

    return Promise.all([7, 30, 365].map(days => quantilearnApi.getStatisticSummary(selectedModelId.value, days, true)))
  },
  {
    watch: [selectedModelId],
    default: () => [],
  },
)

const {
  data: apiAnalysis,
  pending: analysisPending,
  error: analysisError,
  refresh: refreshAnalysis,
} = await useAsyncData(
  'quantilearn-selected-analysis',
  () => (hasApiModels.value && selectedModelId.value
    ? quantilearnApi.getFundamentSummary(selectedModelId.value)
    : Promise.resolve(null)),
  {
    watch: [selectedModelId],
    default: () => null,
  },
)

const {
  data: apiHitEvents,
  pending: eventsPending,
  error: eventsError,
  refresh: refreshEvents,
} = await useAsyncData('quantilearn-current-events', () => quantilearnApi.getCurrentEvents(24 * 30, 80), {
  default: () => [],
})

const {
  data: apiHallModels,
  pending: hallPending,
  error: hallError,
  refresh: refreshHall,
} = await useAsyncData(
  'quantilearn-hall-models',
  () => quantilearnApi.getHallModels({
    type: hallType.value,
    order: hallOrder.value,
    keyword: hallKeyword.value.trim() || undefined,
    pageSize: hallPageSize.value,
    strict: hallStrict.value,
  }),
  {
    watch: [hallType, hallOrder, hallKeyword, hallPageSize, hallStrict],
    default: () => [],
  },
)

watch(apiModelDetails, (details) => {
  if (!details.length) return
  if (!details.some(model => model.id === selectedModelId.value)) {
    selectedModelId.value = details[0]!.id
  }
}, { immediate: true })

const selectedApiModelDetail = computed(() => apiModelDetails.value.find(model => model.id === selectedModelId.value))
const report365 = computed(() => apiStatistics.value.find(summary => summary.days === 365) ?? null)
const halfReport365 = computed(() => apiHalfStatistics.value.find(summary => summary.days === 365 && summary.half === true) ?? null)
const modelSourceLabel = computed(() => (hasApiModels.value ? `当前账号 ${apiModelDetails.value.length} 个模型` : '静态原型模型'))
const modelLoadError = computed(() => errorMessage(modelsError.value))
const reportLoadError = computed(() => errorMessage(reportError.value || halfReportError.value || analysisError.value))
const reportSourceLabel = computed(() => {
  if (!hasApiModels.value) return '静态回测原型'
  if (reportView.value === 'half') {
    if (halfReport365.value) return `Mongo 半场 ${halfReport365.value.days}d / ${halfReport365.value.validResultCount} 有效样本`
    return '等待半场统计'
  }
  if (report365.value) return `Mongo ${report365.value.days}d / ${report365.value.finalMatchedCount} 匹配样本`
  return '等待回测统计'
})
const factorSourceLabel = computed(() => (apiFactors.value.length ? `Mongo 因子 ${apiFactors.value.length}` : '静态因子原型'))
const livePermissions = computed(() => (apiPermissions.value ? toPermissionProfile(apiPermissions.value) : prototypePermissions))
const publishSlotsUsed = computed(() => livePermissions.value.usedPublish + livePermissions.value.extraPublish)
const publishLimit = computed(() => livePermissions.value.publish + livePermissions.value.extraPublish)
const permissionSourceLabel = computed(() => {
  if (apiPermissions.value) {
    const source = apiPermissions.value.isDevelopmentFallback ? '开发身份' : apiPermissions.value.source
    return `${apiPermissions.value.role} / ${source}`
  }

  if (permissionsError.value) return '静态权限原型'
  return permissionsPending.value ? '读取权限...' : '静态权限原型'
})
const eventsSourceLabel = computed(() => {
  if (apiHitEvents.value.length) return `Mongo HitEvents ${apiHitEvents.value.length}`
  if (eventsError.value) return '等待赛事 API 部署'
  return '静态赛事原型'
})
const hallSourceLabel = computed(() => {
  if (hallError.value) return '等待广场 API 部署'
  return `Mongo 模型广场 ${apiHallModels.value.length}`
})
const hallSubscriptionAvailable = computed(() => !hallError.value && !hallPending.value)

const hitEventNeedsSnapshot = (event: { eventId: string, league?: string, home?: string, away?: string }) => (
  Boolean(event.eventId)
  && (!event.league?.trim() || !event.home?.trim() || !event.away?.trim())
)

const enrichHitEvents = async () => {
  const eventIds = apiHitEvents.value
    .filter(hitEventNeedsSnapshot)
    .map(event => event.eventId)
    .filter((eventId, index, source) => source.indexOf(eventId) === index)
    .filter(eventId => !hitEventSnapshots.value[eventId] && !pendingHitEventSnapshotIds.has(eventId))
    .slice(0, 40)

  if (!eventIds.length) return

  for (const eventId of eventIds) {
    pendingHitEventSnapshotIds.add(eventId)
  }

  const snapshots = await Promise.allSettled(eventIds.map(async (eventId) => {
    const snapshot = await quantilearnApi.getFlashEventSnapshot(eventId)
    return {
      eventId,
      league: snapshot.league,
      home: snapshot.home,
      away: snapshot.away,
      score: snapshot.score,
    }
  }))

  const nextSnapshots = { ...hitEventSnapshots.value }
  snapshots.forEach((result) => {
    if (result.status === 'fulfilled') {
      nextSnapshots[result.value.eventId] = result.value
    }
  })
  hitEventSnapshots.value = nextSnapshots

  for (const eventId of eventIds) {
    pendingHitEventSnapshotIds.delete(eventId)
  }
}

if (import.meta.client) {
  watch(apiHitEvents, () => {
    void enrichHitEvents()
  }, { immediate: true })
}

const liveFactorDefinitions = computed(() => {
  const factors = apiFactors.value.map(toFactorDefinition)
  return factors.length ? factors : prototypeFactorDefinitions
})
const factorDefinitionMap = computed(() => new Map(liveFactorDefinitions.value.map(factor => [factor.id, factor])))
const liveReportPeriods = computed(() => {
  const periods = statisticsToReportPeriods(apiStatistics.value)
  return periods.length ? periods : prototypeReportPeriods
})
const liveFinalMarketRows = computed(() => {
  const rows = statisticToMarketRows(report365.value)
  return rows.length ? rows : prototypeFinalMarketRows
})
const liveHalfMarketRows = computed(() => {
  const rows = statisticToMarketRows(halfReport365.value)
  return rows.length ? rows : halfMarketRows
})
const liveGoalRows = computed(() => {
  const rows = statisticToGoalRows(reportView.value === 'half' ? halfReport365.value : report365.value)
  return rows.length ? rows : prototypeGoalRows
})
const selectedModelFactors = computed(() => {
  const factors = toSelectedFactors(selectedApiModelDetail.value, liveFactorDefinitions.value)
  return factors.length ? factors : prototypeSelectedFactors
})
const liveModels = computed(() => {
  if (!apiModelDetails.value.length) return prototypeModels

  return apiModelDetails.value.map(detail => toQuantModel(
    detail,
    detail.id === selectedModelId.value ? report365.value : undefined,
  ))
})
const liveHitEvents = computed(() => {
  const events = apiHitEvents.value.map((event) => {
    const hitEvent = toHitEvent(event)
    const snapshot = hitEventSnapshots.value[event.eventId]
    if (!snapshot) return hitEvent

    const teams = snapshot.home && snapshot.away ? `${snapshot.home} vs ${snapshot.away}` : hitEvent.teams
    return {
      ...hitEvent,
      league: hitEvent.league === '未知赛事' && snapshot.league ? snapshot.league : hitEvent.league,
      teams: hitEvent.teams === '赛事资料待同步' ? teams : hitEvent.teams,
      score: (!hitEvent.score || hitEvent.score === '-' || hitEvent.score === '未赛') && snapshot.score ? snapshot.score : hitEvent.score,
    }
  })
  return events.length ? events : hitEvents
})
const liveHallModels = computed(() => {
  const models = apiHallModels.value.map(toHallModel)
  if (models.length) return models
  if (hallPending.value || !hallError.value) return []
  return hallModels
})
const liveWorkspaces = computed(() => workspaces.map((workspace) => {
  if (workspace.id === 'models') return { ...workspace, count: String(liveModels.value.length) }
  if (workspace.id === 'builder') return { ...workspace, count: String(livePermissions.value.factor) }
  if (workspace.id === 'report' && report365.value) return { ...workspace, count: `${report365.value.days}d` }
  if (workspace.id === 'events') return { ...workspace, count: String(liveHitEvents.value.length) }
  if (workspace.id === 'hall') return { ...workspace, count: String(liveHallModels.value.length) }
  return workspace
}))
const selectedModel = computed(() => (
  liveModels.value.find(model => model.id === selectedModelId.value)
  ?? liveModels.value[0]
  ?? prototypeModels[0]!
))
const selectedWorkspace = computed(() => liveWorkspaces.value.find(item => item.id === activeWorkspace.value) ?? liveWorkspaces.value[0]!)
const visibleFactors = computed(() => liveFactorDefinitions.value.filter(item => item.group === activeFactorGroup.value))
const activeFactorGroupInfo = computed(() => factorGroups.find(group => group.id === activeFactorGroup.value) ?? factorGroups[0]!)
const selectedModelFactorIds = computed(() => new Set(selectedModelFactors.value.map(factor => factor.id)))
const selectedFactorGroups = computed<Array<{ id: string, label: string, summary: string, factors: SelectedFactor[] }>>(() => {
  const used = new Set<string>()
  const groups: Array<{ id: string, label: string, summary: string, factors: SelectedFactor[] }> = []

  factorGroups.forEach((group) => {
    const factors = selectedModelFactors.value.filter((factor) => {
      const definition = factorDefinitionMap.value.get(factor.id)
      return definition?.group === group.id
    })

    if (!factors.length) return
    factors.forEach(factor => used.add(factor.id))
    groups.push({
      id: group.id,
      label: group.label,
      summary: group.summary,
      factors,
    })
  })

  const leftovers = selectedModelFactors.value.filter(factor => !used.has(factor.id))
  if (leftovers.length) {
    groups.push({
      id: 'other',
      label: '其他条件',
      summary: '模型扩展因子',
      factors: leftovers,
    })
  }

  return groups
})
const visibleMarketRows = computed(() => (reportView.value === 'half' ? liveHalfMarketRows.value : liveFinalMarketRows.value))
const visibleHitEvents = computed(() => liveHitEvents.value.filter(item => !currentOnly.value || item.state !== 'settled'))
const visibleHallModels = computed(() => {
  const keyword = hallKeyword.value.trim().toLowerCase()
  const models = liveHallModels.value
    .filter(item => hallType.value === 'all' || item.type === hallType.value)
    .filter(item => !hallStrict.value || item.meetsRules !== false)
    .filter(item => !keyword || `${item.name} ${item.selection} ${item.author}`.toLowerCase().includes(keyword))

  return [...models].sort((left, right) => {
    if (hallOrder.value === 'hit') return right.hit - left.hit
    if (hallOrder.value === 'distribution') return right.distribution - left.distribution
    if (hallOrder.value === 'price') return left.price - right.price
    if (hallOrder.value === 'updated') return 0
    return right.yearReturn - left.yearReturn
  })
})

const hallSubscriptionLabel = (model: { subscription: 'none' | 'active' | 'mine', expires?: string }) => {
  if (model.subscription === 'mine') return '我的模型'
  if (model.subscription === 'active') return model.expires ? `已订阅至 ${model.expires}` : '已订阅'
  return '未订阅'
}

const hallSubscriptionActionLabel = (model: { subscription: 'none' | 'active' | 'mine' }) => {
  if (model.subscription === 'mine') return '我的模型'
  if (model.subscription === 'active') return '续订'
  return '订阅'
}

const clearSubscriptionMessage = () => {
  subscriptionNotice.value = ''
  subscriptionError.value = ''
}

const filteredModels = computed(() => liveModels.value.filter((model) => {
  const stateMatched = modelFilter.value === 'all'
    || (modelFilter.value === 'locked' ? model.isLocked : model.state === modelFilter.value)
  const text = `${model.name} ${model.objectId} ${model.description} ${model.bestSelection}`.toLowerCase()
  return stateMatched && (!searchText.value || text.includes(searchText.value.toLowerCase()))
}))

const selectedCountForGroup = (groupId: FactorGroupId) => selectedModelFactors.value.filter((factor) => {
  const definition = factorDefinitionMap.value.get(factor.id)
  return definition?.group === groupId
}).length

const builderRoleLabel = (role?: FactorDefinition['role']) => {
  if (role === 'premium') return '高级'
  if (role === 'logic') return '逻辑'
  return '基础'
}

const builderRoleTone = (role?: FactorDefinition['role']) => {
  if (role === 'premium') return 'warn'
  if (role === 'logic') return 'good'
  return 'plain'
}

const builderFactorAxis = (name: string, index: number, total: number) => {
  if (/主队|主胜|标准盘主|主$/u.test(name)) return '主'
  if (/平局|标准盘平|平$/u.test(name)) return '平'
  if (/客队|客胜|标准盘客|客$/u.test(name)) return '客'
  if (/大于|大球|进球盘大|大$/u.test(name)) return '大'
  if (/小于|小球|进球盘小|小$/u.test(name)) return '小'
  if (/均衡/u.test(name)) return '均'
  if (total === 3) return ['主', '平', '客'][index] ?? String(index + 1)
  if (total === 2) return ['大', '小'][index] ?? String(index + 1)
  return String(index + 1)
}

const compactBuilderFactorName = (name: string) => (
  name
    .replace(/^(必发指数|成交量|比例|盈亏|冷热|价位|欧洲平均|凯利方差)[，,、\s]*/u, '')
    .replace(/^进球盘/u, '')
    .replace(/^内外盘/u, '')
    .trim() || name
)

const catalogFactorAxis = (factor: FactorDefinition) => {
  const index = visibleFactors.value.findIndex(item => item.id === factor.id)
  return builderFactorAxis(factor.name, index, visibleFactors.value.length)
}

const selectedFactorName = (factor: SelectedFactor) => factorDefinitionMap.value.get(factor.id)?.name ?? factor.name

const selectedFactorField = (factor: SelectedFactor) => factorDefinitionMap.value.get(factor.id)?.field ?? factor.id

const selectedFactorLimit = (factor: SelectedFactor) => factorDefinitionMap.value.get(factor.id)?.range ?? '自定义范围'

const selectedFactorRole = (factor: SelectedFactor) => factorDefinitionMap.value.get(factor.id)?.role

const selectedFactorAxis = (factor: SelectedFactor, groupFactors: SelectedFactor[]) => {
  const index = groupFactors.findIndex(item => item.id === factor.id)
  return builderFactorAxis(selectedFactorName(factor), index, groupFactors.length)
}

const selectedFactorRangeText = (factor: SelectedFactor) => `${factor.min} - ${factor.max}`

const toggleBuilderFactor = (factorId: string) => {
  expandedBuilderFactorId.value = expandedBuilderFactorId.value === factorId ? null : factorId
}

const rangeBounds = (factor: { id: string, min: number, max: number }) => {
  const range = factorDefinitionMap.value.get(factor.id)?.range
  const values = range?.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  const minLimit = Number.isFinite(values[0]) ? values[0]! : Math.min(0, factor.min)
  const maxLimit = Number.isFinite(values[1]) ? values[1]! : Math.max(100, factor.max)

  if (maxLimit <= minLimit) {
    return { minLimit: 0, maxLimit: 100 }
  }

  return { minLimit, maxLimit }
}

const rangeTrackStyle = (factor: { id: string, min: number, max: number }) => {
  const { minLimit, maxLimit } = rangeBounds(factor)
  const span = maxLimit - minLimit
  const start = Math.max(0, Math.min(100, ((Math.min(factor.min, factor.max) - minLimit) / span) * 100))
  const end = Math.max(0, Math.min(100, ((Math.max(factor.min, factor.max) - minLimit) / span) * 100))
  const width = Math.max(3, end - start)
  const left = Math.min(start, 100 - width)

  return {
    left: `${left}%`,
    width: `${width}%`,
  }
}

watch(selectedModelId, () => {
  expandedBuilderFactorId.value = null
})

const refreshLiveData = async () => {
  await Promise.all([refreshModels(), refreshReport(), refreshHalfReport(), refreshAnalysis(), refreshEvents(), refreshHall(), refreshPermissions()])
}

const subscribeHallModel = async (model: HallModel) => {
  if (model.subscription === 'mine' || !hallSubscriptionAvailable.value || subscriptionBusyModelId.value) return

  clearSubscriptionMessage()
  subscriptionBusyModelId.value = model.id
  try {
    const subscription = model.subscription === 'active'
      ? await quantilearnApi.renewSubscription(model.id, { months: 1 })
      : await quantilearnApi.subscribeModel({ modelId: model.id, months: 1 })
    subscriptionNotice.value = `${model.name} ${model.subscription === 'active' ? '续订' : '订阅'}成功，到期 ${new Date(subscription.expiresAtUtc).toLocaleDateString('zh-CN')}。`
    await refreshHall()
  }
  catch (error) {
    subscriptionError.value = errorMessage(error)
  }
  finally {
    subscriptionBusyModelId.value = ''
  }
}

const cancelHallSubscription = async (model: HallModel) => {
  if (model.subscription !== 'active' || !hallSubscriptionAvailable.value || subscriptionBusyModelId.value) return
  if (import.meta.client && !window.confirm(`确认取消订阅「${model.name}」？`)) return

  clearSubscriptionMessage()
  subscriptionBusyModelId.value = model.id
  try {
    await quantilearnApi.cancelSubscription(model.id)
    subscriptionNotice.value = `${model.name} 已取消订阅。`
    await refreshHall()
  }
  catch (error) {
    subscriptionError.value = errorMessage(error)
  }
  finally {
    subscriptionBusyModelId.value = ''
  }
}

const openWorkspace = (workspace: WorkspaceId) => {
  activeWorkspace.value = workspace
}

const selectModel = (model: QuantModel, workspace?: WorkspaceId) => {
  selectedModelId.value = model.id
  if (workspace) activeWorkspace.value = workspace
}

const selectModelById = (modelId: ModelId, workspace?: WorkspaceId) => {
  selectedModelId.value = modelId
  if (workspace) activeWorkspace.value = workspace
}
</script>

<template>
  <div class="quant-page">
    <WorkbenchTopBar
      :api-base="apiBase"
      :active-workspace="activeWorkspace"
      :selected-workspace-label="selectedWorkspace.label"
      :selected-model-name="selectedModel.name"
      :workspaces="liveWorkspaces"
      @select-workspace="openWorkspace"
    />

    <main class="workbench">
      <ModelScopePanel
        :models="filteredModels"
        :selected-model-id="selectedModelId"
        :model-filter="modelFilter"
        :search-text="searchText"
        :model-filters="modelFilters"
        :loading="modelsPending"
        :error="modelLoadError"
        :source-label="modelSourceLabel"
        @select-model="selectModel"
        @change-filter="modelFilter = $event"
        @change-search="searchText = $event"
      />

      <section class="main-stage">
        <ModelHero :model="selectedModel" @open-workspace="openWorkspace" />
        <MetricStrip :model="selectedModel" />

        <section v-if="activeWorkspace === 'models'" class="workspace-panel">
          <div class="panel-title workspace-title">
            <div>
              <span class="eyebrow">Legacy Flow</span>
              <h3>我的模型</h3>
              <p>集中管理当前账号创建的模型状态、额度、锁定和可操作性。</p>
            </div>
            <button type="button" class="primary-button focus-ring" @click="openWorkspace('builder')">
              <Plus :size="16" />
              <span>新建模型</span>
            </button>
          </div>

          <div class="quota-grid">
            <div>
              <span>{{ hasApiModels ? '我的模型' : '可创建模型' }}</span>
              <strong class="num">{{ hasApiModels ? liveModels.length : `${livePermissions.usedDraft} / ${livePermissions.establish}` }}</strong>
              <em>{{ hasApiModels ? '当前账号创建模型' : '模型创建额度' }}</em>
            </div>
            <div>
              <span>可发布模型</span>
              <strong class="num">{{ publishSlotsUsed }} / {{ publishLimit }}</strong>
              <em>{{ permissionSourceLabel }}</em>
            </div>
            <div>
              <span>匹配样本</span>
              <strong class="num">{{ apiAnalysis?.finalMatchedCount ?? selectedModel.sample365 }}</strong>
              <em>{{ analysisPending ? '分析中' : 'Fundaments summary' }}</em>
            </div>
          </div>

          <div class="action-matrix">
            <div class="action-head table-head">
              <span>模型</span>
              <span>状态</span>
              <span>限制原因</span>
              <span>操作</span>
            </div>
            <p v-if="!filteredModels.length" class="empty-state">
              当前账号没有符合筛选条件的模型。
            </p>
            <div v-for="model in filteredModels" :key="`${model.id}-actions`" class="action-row">
              <div>
                <strong>{{ model.name }}</strong>
                <span>创建 {{ model.createdAt }} / 更新 {{ model.updatedAt }}</span>
              </div>
              <span :class="['status-chip', stateTone(model.state)]">{{ stateLabel(model.state) }}</span>
              <span class="reason">{{ model.note }}</span>
              <div class="action-buttons">
                <button type="button" class="icon-button compact focus-ring" title="编辑" :disabled="Boolean(actionState(model, 'edit', livePermissions))">
                  <Pencil :size="14" />
                </button>
                <button type="button" class="icon-button compact focus-ring" title="发布" :disabled="Boolean(actionState(model, 'publish', livePermissions))">
                  <Flag :size="14" />
                </button>
                <button type="button" class="icon-button compact focus-ring" title="取消发布" :disabled="Boolean(actionState(model, 'unpublish', livePermissions))">
                  <XCircle :size="14" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section v-else-if="activeWorkspace === 'builder'" class="workspace-panel">
          <div class="panel-title workspace-title">
            <div>
              <span class="eyebrow">ModelAdd.aspx</span>
              <h3>因子建模器</h3>
              <p>因子目录、区间、比较逻辑和会员权限额度。</p>
            </div>
            <div class="status-chip good">
              <CheckCircle2 :size="14" />
              <span>已选 {{ selectedModelFactors.length }} / {{ livePermissions.factor }}</span>
            </div>
            <div :class="['status-chip', permissionsError ? 'warn' : 'plain']">
              <span>{{ permissionSourceLabel }}</span>
            </div>
            <div :class="['status-chip', factorsError ? 'danger' : 'plain']">
              <span>{{ factorsError ? errorMessage(factorsError) : (factorsPending ? '读取因子...' : factorSourceLabel) }}</span>
            </div>
          </div>

          <div class="builder-layout">
            <div class="factor-groups">
              <button
                v-for="group in factorGroups"
                :key="group.id"
                type="button"
                :class="['factor-group-button focus-ring', { active: activeFactorGroup === group.id }]"
                @click="activeFactorGroup = group.id"
              >
                <span>{{ group.label }}</span>
                <em>{{ group.summary }}</em>
                <strong v-if="selectedCountForGroup(group.id)">{{ selectedCountForGroup(group.id) }}</strong>
              </button>
            </div>

            <div class="factor-catalog">
              <div class="builder-catalog-head">
                <div>
                  <strong>{{ activeFactorGroupInfo.label }}</strong>
                  <span>{{ activeFactorGroupInfo.summary }}</span>
                </div>
                <span class="status-chip plain">{{ visibleFactors.length }} 因子</span>
              </div>

              <div class="builder-factor-grid">
                <article
                  v-for="factor in visibleFactors"
                  :key="factor.id"
                  :class="['builder-factor-card', { selected: selectedModelFactorIds.has(factor.id) }]"
                >
                  <div class="builder-factor-main">
                    <span class="builder-factor-axis">{{ catalogFactorAxis(factor) }}</span>
                    <div>
                      <strong>{{ compactBuilderFactorName(factor.name) }}</strong>
                      <span>{{ factor.field }}</span>
                    </div>
                    <CheckCircle2 v-if="selectedModelFactorIds.has(factor.id)" :size="15" />
                  </div>
                  <div class="builder-factor-meta">
                    <span>{{ factor.range }}</span>
                    <span :class="['status-chip', builderRoleTone(factor.role)]">{{ builderRoleLabel(factor.role) }}</span>
                  </div>
                </article>
              </div>
            </div>
          </div>

          <section class="builder-selected-panel">
            <div class="builder-selected-head">
              <div>
                <span class="eyebrow">Selected Factors</span>
                <h4>模型条件</h4>
              </div>
              <span :class="['status-chip', selectedModelFactors.length >= livePermissions.factor ? 'warn' : 'good']">
                {{ selectedModelFactors.length }} / {{ livePermissions.factor }}
              </span>
            </div>

            <div v-if="selectedFactorGroups.length" class="builder-selected-groups">
              <article v-for="group in selectedFactorGroups" :key="group.id" class="builder-selected-group">
                <div class="builder-selected-group-head">
                  <div>
                    <strong>{{ group.label }}</strong>
                    <span>{{ group.summary }}</span>
                  </div>
                  <em>{{ group.factors.length }}</em>
                </div>

                <div class="builder-selected-grid">
                  <button
                    v-for="factor in group.factors"
                    :key="factor.id"
                    type="button"
                    :class="['builder-selected-chip', 'focus-ring', { expanded: expandedBuilderFactorId === factor.id }]"
                    :title="selectedFactorName(factor)"
                    @click="toggleBuilderFactor(factor.id)"
                  >
                    <span class="builder-factor-axis">{{ selectedFactorAxis(factor, group.factors) }}</span>
                    <span class="builder-selected-main">
                      <strong>{{ selectedFactorRangeText(factor) }}</strong>
                      <em>{{ compactBuilderFactorName(selectedFactorName(factor)) }}</em>
                    </span>
                    <span class="builder-selected-logic">{{ factor.logic }}</span>
                    <ChevronUp v-if="expandedBuilderFactorId === factor.id" class="builder-selected-caret" :size="14" />
                    <ChevronDown v-else class="builder-selected-caret" :size="14" />
                  </button>
                </div>

                <template v-for="factor in group.factors" :key="`builder-editor-${factor.id}`">
                  <div v-if="expandedBuilderFactorId === factor.id" class="builder-selected-detail">
                    <div class="builder-detail-title">
                      <div>
                        <strong>{{ selectedFactorName(factor) }}</strong>
                        <span>{{ selectedFactorField(factor) }}</span>
                      </div>
                      <span :class="['status-chip', builderRoleTone(selectedFactorRole(factor))]">
                        {{ builderRoleLabel(selectedFactorRole(factor)) }}
                      </span>
                    </div>
                    <div class="range-line">
                      <span class="num">{{ factor.min }}</span>
                      <span class="range-track"><i :style="rangeTrackStyle(factor)" /></span>
                      <span class="num">{{ factor.max }}</span>
                    </div>
                    <div class="builder-detail-facts">
                      <div>
                        <span>默认范围</span>
                        <strong>{{ selectedFactorLimit(factor) }}</strong>
                      </div>
                      <div>
                        <span>比较逻辑</span>
                        <strong>{{ factor.logic }}</strong>
                      </div>
                    </div>
                  </div>
                </template>
              </article>
            </div>

            <p v-else class="empty-state">
              当前模型还没有配置因子。
            </p>
          </section>
        </section>

        <ReportWorkspace
          v-else-if="activeWorkspace === 'report'"
          :model="selectedModel"
          :league-scope="leagueScope"
          :report-view="reportView"
          :report-periods="liveReportPeriods"
          :market-rows="visibleMarketRows"
          :goal-rows="liveGoalRows"
          :timeline="timeline"
          :loading="reportPending || halfReportPending"
          :error="reportLoadError"
          :source-label="reportSourceLabel"
          @change-league-scope="leagueScope = $event"
          @change-report-view="reportView = $event"
          @refresh-report="refreshLiveData"
        />

        <section v-else-if="activeWorkspace === 'events'" class="workspace-panel">
          <div class="panel-title workspace-title">
            <div>
              <span class="eyebrow">CurrentEventsV3.aspx</span>
              <h3>模型赛事</h3>
              <p>HitEvents 当前命中、已读状态和完场状态。</p>
            </div>
            <label class="switch-row">
              <input v-model="currentOnly" type="checkbox">
              <span class="switch-track" />
              <span>隐藏已完场</span>
            </label>
            <div :class="['status-chip', eventsError ? 'warn' : 'plain']">
              <span>{{ eventsPending ? '读取赛事...' : eventsSourceLabel }}</span>
            </div>
          </div>

          <div class="event-list">
            <p v-if="!visibleHitEvents.length" class="empty-state">
              当前筛选下没有命中赛事。
            </p>
            <button
              v-for="event in visibleHitEvents"
              :key="event.id"
              type="button"
              class="event-row focus-ring"
              @click="selectModelById(event.model, 'events')"
            >
              <div class="event-main">
                <strong>{{ event.teams }}</strong>
                <span>{{ event.league }} / {{ event.time }}</span>
                <em>赛事ID {{ event.eventId || event.id }} / 更新 {{ event.update }}</em>
              </div>
              <span class="status-chip plain">{{ event.modelName || liveModels.find(model => model.id === event.model)?.name || '旧站命中模型' }}</span>
              <span class="event-score num">{{ event.score }}</span>
              <span :class="['status-chip', event.state === 'new' ? 'good' : event.state === 'used' ? 'warn' : 'plain']">
                {{ event.state === 'new' ? '未读命中' : event.state === 'used' ? '已处理' : '已完场' }}
              </span>
              <strong>{{ event.selection }}</strong>
            </button>
          </div>
        </section>

        <section v-else-if="activeWorkspace === 'hall'" class="workspace-panel">
          <div class="panel-title workspace-title">
            <div>
              <span class="eyebrow">ModelsHall.aspx</span>
              <h3>模型广场</h3>
              <p>上架规则、订阅状态、定价和相似性门槛。</p>
            </div>
            <div :class="['status-chip', hallError ? 'warn' : 'plain']">
              <span>{{ hallPending ? '读取广场...' : hallSourceLabel }}</span>
            </div>
          </div>

          <section class="hall-filter-panel" aria-label="模型广场筛选">
            <div class="hall-filter-group">
              <span>玩法</span>
              <div class="toolbar">
                <button
                  v-for="option in hallTypeOptions"
                  :key="option.id"
                  type="button"
                  :class="['tab-button focus-ring', { active: hallType === option.id }]"
                  @click="hallType = option.id"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <div class="hall-filter-group">
              <span>排序</span>
              <div class="toolbar">
                <button
                  v-for="option in hallOrderOptions"
                  :key="option.id"
                  type="button"
                  :class="['tab-button focus-ring', { active: hallOrder === option.id }]"
                  @click="hallOrder = option.id"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <label class="hall-search">
              <Search :size="15" />
              <input v-model="hallKeyword" type="search" placeholder="搜索模型、作者、方向">
            </label>

            <label class="switch-row hall-strict">
              <input v-model="hallStrict" type="checkbox">
              <span class="switch-track" />
              <span>只看达标</span>
            </label>

            <label class="hall-page-size">
              <span>数量</span>
              <select v-model.number="hallPageSize">
                <option :value="30">30</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
              </select>
            </label>
          </section>

          <div class="hall-rules">
            <div><Star :size="15" /><span>已发布</span></div>
            <div><TrendingUp :size="15" /><span>1年收益 >= 50%</span></div>
            <div><Target :size="15" /><span>1年分布 >= 62%</span></div>
            <div><Layers :size="15" /><span>3年分布 >= 55%</span></div>
            <div><Filter :size="15" /><span>排除相似性模型</span></div>
          </div>

          <div v-if="subscriptionNotice || subscriptionError" :class="['subscription-message', subscriptionError ? 'warn' : 'good']">
            {{ subscriptionError || subscriptionNotice }}
          </div>

          <div class="hall-list">
            <p v-if="!visibleHallModels.length" class="empty-state">
              当前筛选下没有可展示模型。
            </p>
            <div v-for="model in visibleHallModels" :key="model.id" class="hall-row">
              <div>
                <div class="hall-title">
                  <strong>{{ model.name }}</strong>
                  <span class="status-chip good">{{ model.selection }}</span>
                  <span :class="['status-chip', model.meetsRules === false ? 'warn' : 'plain']">{{ model.meetsRules === false ? '候选' : '达标' }}</span>
                </div>
                <span>作者 {{ model.author }} / 订阅 {{ model.subscribers }} / 命中 {{ model.hit }}{{ model.ruleWarnings?.length ? ` / ${model.ruleWarnings[0]}` : '' }}</span>
              </div>
              <div class="hall-stats">
                <div><span>年化</span><strong class="num">{{ Math.round(model.yearReturn * 100) }}%</strong></div>
                <div><span>分布</span><strong class="num">{{ Math.round(model.distribution * 100) }}%</strong></div>
                <div><span>价格/月</span><strong class="num">{{ model.price }}</strong></div>
              </div>
              <div class="hall-action-group">
                <span :class="['hall-subscription-state', model.subscription === 'active' ? 'good' : model.subscription === 'mine' ? 'plain' : 'warn']">
                  {{ hallSubscriptionLabel(model) }}
                </span>
                <div>
                  <button
                    type="button"
                    class="primary-button focus-ring"
                    :disabled="model.subscription === 'mine' || !hallSubscriptionAvailable || subscriptionBusyModelId === model.id"
                    :title="hallSubscriptionAvailable ? '' : '等待模型广场 API 可用后操作'"
                    @click="subscribeHallModel(model)"
                  >
                    <ShoppingCart :size="15" />
                    <span>{{ subscriptionBusyModelId === model.id ? '处理中' : hallSubscriptionActionLabel(model) }}</span>
                  </button>
                  <button
                    v-if="model.subscription === 'active'"
                    type="button"
                    class="ghost-button compact focus-ring"
                    :disabled="!hallSubscriptionAvailable || subscriptionBusyModelId === model.id"
                    :title="hallSubscriptionAvailable ? '' : '等待模型广场 API 可用后操作'"
                    @click="cancelHallSubscription(model)"
                  >
                    <XCircle :size="15" />
                    <span>取消</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

      </section>

      <ContextRail :model="selectedModel" :workspace="selectedWorkspace" :permissions="livePermissions" />
    </main>
  </div>
</template>

<style scoped>
.quant-page {
  min-height: 100vh;
  color: var(--ink);
}

.workbench {
  display: grid;
  grid-template-columns: 286px minmax(0, 1fr) 284px;
  gap: 12px;
  max-width: 1580px;
  margin: 0 auto;
  padding: 12px;
}

.main-stage {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
}

.workspace-panel {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow);
}

.workspace-title {
  margin-bottom: 10px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tab-button {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--muted);
  font-weight: 780;
}

.tab-button.active {
  border-color: #132331;
  background: #132331;
  color: #ffffff;
}

.quota-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.quota-grid div,
.selected-factor-card {
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.quota-grid div {
  display: grid;
  gap: 2px;
  min-height: 62px;
  padding: 8px 10px;
}

.quota-grid span,
.quota-grid em {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.74rem;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quota-grid strong {
  font-size: 1rem;
}

.action-matrix {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.factor-catalog {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}

.action-head,
.action-row {
  grid-template-columns: minmax(150px, 1.2fr) 92px minmax(180px, 1.4fr) 112px;
  min-width: 620px;
  column-gap: 8px;
  padding: 0 9px;
}

.action-row {
  display: grid;
  align-items: center;
  min-height: 44px;
  border-top: 1px solid rgba(220, 227, 235, 0.72);
}

.action-row div:first-child {
  display: grid;
  min-width: 0;
}

.action-row strong,
.factor-row strong,
.hall-title strong,
.event-row strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-row .mono,
.factor-row .mono {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reason {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  gap: 5px;
}

.builder-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.factor-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(116px, 1fr));
  gap: 6px;
}

.factor-group-button {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "label count"
    "summary state";
  gap: 4px 8px;
  align-items: center;
  min-height: 46px;
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--muted);
  text-align: left;
}

.factor-group-button.active {
  border-color: #132331;
  background: #132331;
  color: #ffffff;
}

.factor-group-button span {
  grid-area: label;
  overflow: hidden;
  font-weight: 780;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.factor-group-button em {
  grid-area: summary;
  color: inherit;
  font-size: 0.68rem;
  font-style: normal;
  opacity: 0.7;
}

.factor-group-button strong {
  display: inline-flex;
  grid-area: count;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  min-height: 24px;
  border-radius: 999px;
  background: #dff4f1;
  color: var(--teal);
  font-size: 0.72rem;
}

.factor-group-button.active strong {
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
}

.factor-group-button::after {
  grid-area: state;
  justify-self: end;
  color: inherit;
  font-size: 0.74rem;
  font-weight: 820;
  content: '选择';
  opacity: 0.58;
}

.factor-group-button.active::after {
  content: '当前';
  opacity: 0.9;
}

.factor-head,
.factor-row {
  grid-template-columns: minmax(220px, 1.5fr) minmax(120px, 0.7fr) 86px;
  min-width: 480px;
  column-gap: 8px;
  padding: 0 9px;
}

.factor-row {
  display: grid;
  align-items: center;
  min-height: 42px;
  border-top: 1px solid rgba(220, 227, 235, 0.72);
}

.builder-catalog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 10px;
  border-bottom: 1px solid var(--line);
  background: #f7fafc;
}

.builder-catalog-head div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.builder-catalog-head strong,
.builder-catalog-head span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.builder-catalog-head strong {
  font-size: 0.86rem;
}

.builder-catalog-head div span {
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 760;
}

.builder-factor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 8px;
  padding: 8px;
  background: #f7fafc;
}

.builder-factor-card {
  display: grid;
  align-content: start;
  gap: 8px;
  min-width: 0;
  min-height: 94px;
  padding: 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
}

.builder-factor-card.selected {
  background: #eaf8f6;
  box-shadow: inset 0 3px 0 #22a39b;
}

.builder-factor-main {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 16px;
  gap: 7px;
  align-items: start;
  min-width: 0;
}

.builder-factor-axis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #eef7f6;
  color: #476b6c;
  font-weight: 900;
}

.builder-factor-main div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.builder-factor-main strong,
.builder-factor-main span,
.builder-factor-meta > span:first-child,
.builder-selected-main strong,
.builder-selected-main em,
.builder-selected-logic,
.builder-detail-title strong,
.builder-detail-title span,
.builder-detail-facts strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.builder-factor-main strong {
  font-size: 0.84rem;
}

.builder-factor-main span {
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 720;
}

.builder-factor-main svg {
  color: var(--teal);
}

.builder-factor-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.builder-factor-meta > span:first-child {
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 780;
}

.builder-selected-panel {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.builder-selected-head,
.builder-selected-group-head,
.builder-detail-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.builder-selected-head h4 {
  margin: 1px 0 0;
  font-size: 0.95rem;
}

.builder-selected-groups {
  display: grid;
  gap: 8px;
}

.builder-selected-group {
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}

.builder-selected-group-head {
  min-height: 38px;
  padding: 7px 8px;
  border-bottom: 1px solid var(--line);
  background: #f7fafc;
}

.builder-selected-group-head div {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.builder-selected-group-head strong,
.builder-selected-group-head span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.builder-selected-group-head strong {
  font-size: 0.8rem;
}

.builder-selected-group-head span {
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 760;
}

.builder-selected-group-head em {
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

.builder-selected-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(156px, 1fr));
  gap: 6px;
  padding: 6px;
  background: #f7fafc;
}

.builder-selected-chip {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto 14px;
  gap: 7px;
  align-items: center;
  min-width: 0;
  min-height: 62px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  color: var(--ink);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.builder-selected-chip:hover,
.builder-selected-chip.expanded {
  background: #eaf8f6;
}

.builder-selected-chip.expanded {
  box-shadow: inset 0 3px 0 #22a39b;
}

.builder-selected-main {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.builder-selected-main strong {
  font-size: 0.86rem;
  font-weight: 900;
}

.builder-selected-main em {
  color: var(--muted);
  font-size: 0.66rem;
  font-style: normal;
  font-weight: 760;
}

.builder-selected-logic {
  max-width: 78px;
  padding: 2px 6px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.62rem;
  font-weight: 780;
}

.builder-selected-caret {
  color: var(--muted);
}

.builder-selected-detail {
  display: grid;
  gap: 9px;
  padding: 10px;
  border-top: 1px solid var(--line);
  background: #fbfefd;
}

.builder-detail-title > div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.builder-detail-title strong {
  font-size: 0.84rem;
}

.builder-detail-title span {
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 720;
}

.builder-detail-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.builder-detail-facts div {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 7px 8px;
  border-radius: 6px;
  background: var(--surface);
}

.builder-detail-facts span {
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 760;
}

.builder-detail-facts strong {
  font-size: 0.76rem;
}

.range-line {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 34px;
  gap: 7px;
  align-items: center;
}

.range-track {
  position: relative;
  overflow: hidden;
  height: 6px;
  border-radius: 999px;
  background: #d9e2ec;
}

.range-track i {
  position: absolute;
  top: 0;
  bottom: 0;
  border-radius: inherit;
  background: var(--teal);
  min-width: 3px;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--muted);
  font-weight: 760;
}

.switch-row input {
  position: absolute;
  opacity: 0;
}

.switch-track {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 18px;
  border-radius: 999px;
  background: #d9e2ec;
}

.switch-track::after {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #ffffff;
  content: '';
  transition: transform 0.16s ease;
}

.switch-row input:checked + .switch-track {
  background: var(--teal);
}

.switch-row input:checked + .switch-track::after {
  transform: translateX(16px);
}

.event-list,
.hall-list {
  display: grid;
  gap: 8px;
}

.empty-state {
  min-height: 44px;
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.8rem;
}

.action-matrix .empty-state {
  min-width: 620px;
  border-width: 0;
  border-top: 1px solid rgba(220, 227, 235, 0.72);
  border-radius: 0;
}

.event-row,
.hall-row {
  display: grid;
  align-items: center;
  gap: 9px;
  min-width: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.event-row {
  grid-template-columns: minmax(260px, 1.55fr) minmax(130px, 0.82fr) 70px 88px 52px;
  min-height: 64px;
  padding: 8px 10px;
  color: inherit;
  text-align: left;
}

.event-main,
.hall-row > div:first-child {
  display: grid;
  min-width: 0;
}

.event-main {
  gap: 2px;
}

.event-row span,
.hall-row span {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-main strong {
  overflow: hidden;
  color: var(--ink);
  font-size: 0.9rem;
  font-weight: 860;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-main em {
  overflow: hidden;
  color: var(--subtle);
  font-size: 0.68rem;
  font-style: normal;
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-score {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  border-radius: 6px;
  background: #edf3f7;
  color: var(--ink) !important;
  font-weight: 860;
}

.hall-filter-panel {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(220px, 1.1fr) minmax(220px, 1fr) auto auto;
  gap: 8px;
  align-items: end;
  margin-bottom: 10px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
}

.hall-filter-group,
.hall-search,
.hall-page-size {
  min-width: 0;
}

.hall-filter-group {
  display: grid;
  gap: 5px;
}

.hall-filter-group > span,
.hall-page-size > span {
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 800;
}

.hall-filter-panel .tab-button {
  min-height: 28px;
  padding: 0 9px;
  font-size: 0.72rem;
}

.hall-search {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 34px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--muted);
}

.hall-search input {
  min-width: 0;
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
}

.hall-strict {
  min-height: 34px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  white-space: nowrap;
}

.hall-page-size {
  display: grid;
  gap: 4px;
}

.hall-page-size select {
  min-height: 34px;
  padding: 0 28px 0 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--ink);
  font-weight: 780;
}

.hall-rules {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
  margin-bottom: 10px;
}

.hall-rules div {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  min-width: 0;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
}

.hall-rules span {
  overflow: hidden;
  font-size: 0.74rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subscription-message {
  min-height: 34px;
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 0.76rem;
  font-weight: 780;
}

.subscription-message.good {
  border: 1px solid rgba(17, 137, 126, 0.22);
  background: #e7f5f2;
  color: #116e68;
}

.subscription-message.warn {
  border: 1px solid rgba(200, 66, 94, 0.18);
  background: #fce7eb;
  color: #c8425e;
}

.hall-row {
  grid-template-columns: minmax(220px, 1.3fr) minmax(250px, 1fr) auto;
  min-height: 58px;
  padding: 9px 10px;
}

.hall-title,
.hall-stats {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.hall-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.hall-stats div {
  display: grid;
  gap: 2px;
}

.hall-action-group {
  display: grid;
  justify-items: end;
  gap: 6px;
  min-width: 190px;
}

.hall-action-group > div {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

.hall-subscription-state {
  max-width: 190px;
  overflow: hidden;
  font-size: 0.72rem;
  font-weight: 780;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hall-subscription-state.good {
  color: #11897e;
}

.hall-subscription-state.warn {
  color: #c0892f;
}

.hall-subscription-state.plain {
  color: var(--muted);
}

.ghost-button.compact {
  min-height: 34px;
  padding: 0 9px;
}

@media (max-width: 1240px) {
  .workbench {
    grid-template-columns: 276px minmax(0, 1fr);
  }
}

@media (max-width: 1180px) {
  .workbench {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .workbench {
    padding: 8px;
  }

  .workspace-panel {
    padding: 10px;
  }

  .workspace-title {
    display: grid;
  }

  .quota-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .factor-groups {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .factor-group-button {
    min-height: 42px;
    padding: 6px 7px;
  }

  .factor-group-button span {
    font-size: 0.76rem;
  }

  .factor-group-button em,
  .factor-group-button::after {
    font-size: 0.64rem;
  }

  .hall-filter-panel {
    grid-template-columns: 1fr;
  }

  .hall-filter-panel .toolbar {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 1px;
  }

  .hall-filter-panel .tab-button {
    flex: 0 0 auto;
  }

  .factor-head,
  .factor-row {
    grid-template-columns: minmax(0, 1fr) 82px 66px;
    min-width: 0;
    padding: 0 8px;
  }

  .factor-row {
    min-height: 48px;
  }

  .factor-row strong {
    white-space: normal;
  }

  .builder-factor-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .builder-factor-card {
    min-height: 88px;
  }

  .builder-factor-main {
    grid-template-columns: 26px minmax(0, 1fr) 15px;
  }

  .builder-factor-axis {
    width: 26px;
    height: 26px;
  }

  .builder-selected-grid {
    grid-template-columns: repeat(auto-fit, minmax(126px, 1fr));
  }

  .builder-selected-chip {
    grid-template-columns: 26px minmax(0, 1fr) 14px;
    grid-template-areas:
      "axis main caret"
      "axis logic caret";
    min-height: 64px;
  }

  .builder-selected-chip .builder-factor-axis {
    grid-area: axis;
  }

  .builder-selected-main {
    grid-area: main;
  }

  .builder-selected-logic {
    grid-area: logic;
    justify-self: start;
    max-width: 100%;
  }

  .builder-selected-caret {
    grid-area: caret;
  }

  .event-row,
  .hall-row {
    grid-template-columns: 1fr;
  }

  .event-row {
    gap: 7px;
  }

  .event-row > .status-chip,
  .event-score,
  .event-row > strong {
    justify-self: start;
  }

  .hall-rules {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hall-action-group {
    justify-items: start;
    min-width: 0;
  }

  .hall-action-group > div {
    justify-content: flex-start;
  }
}

@media (max-width: 430px) {
  .quota-grid,
  .builder-detail-facts {
    grid-template-columns: 1fr;
  }

  .factor-groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .builder-factor-grid,
  .builder-selected-grid {
    grid-template-columns: 1fr;
  }
}
</style>
