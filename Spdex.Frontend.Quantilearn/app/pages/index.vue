<script setup lang="ts">
import {
  Activity,
  CheckCircle2,
  Database,
  FileText,
  Filter,
  Flag,
  Layers,
  Pencil,
  Plus,
  ServerCog,
  ShoppingCart,
  Star,
  TableProperties,
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
  FactorGroupId,
  HallType,
  LeagueScope,
  ModelFilter,
  ModelId,
  QuantModel,
  ReportView,
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
const hallType = ref<HallType>('all')
const currentOnly = ref(true)

const apiBase = quantilearnApi.apiBase

const errorMessage = (error: unknown) => {
  if (!error) return ''
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '')
  return String(error)
}

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
  data: diagnostics,
  pending: diagnosticsPending,
  error: diagnosticsError,
  refresh: refreshDiagnostics,
} = await useAsyncData('quantilearn-diagnostics', () => quantilearnApi.getDiagnostics(), {
  default: () => null,
})

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
  () => quantilearnApi.getHallModels({ type: hallType.value, order: 'return', pageSize: 50, strict: false }),
  {
    watch: [hallType],
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
const modelSourceLabel = computed(() => (hasApiModels.value ? `Mongo ${apiModelDetails.value.length} 个模型` : '静态原型模型'))
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
const diagnosticsSourceLabel = computed(() => diagnostics.value?.canConnect ? 'Mongo Connected' : 'Mongo Pending')
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
  if (apiHallModels.value.length) return `Mongo 模型广场 ${apiHallModels.value.length}`
  if (hallError.value) return '等待广场 API 部署'
  return '静态广场原型'
})

const liveFactorDefinitions = computed(() => {
  const factors = apiFactors.value.map(toFactorDefinition)
  return factors.length ? factors : prototypeFactorDefinitions
})
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
  const events = apiHitEvents.value.map(toHitEvent)
  return events.length ? events : hitEvents
})
const liveHallModels = computed(() => {
  const models = apiHallModels.value.map(toHallModel)
  return models.length ? models : hallModels
})
const liveWorkspaces = computed(() => workspaces.map((workspace) => {
  if (workspace.id === 'models') return { ...workspace, count: String(liveModels.value.length) }
  if (workspace.id === 'builder') return { ...workspace, count: String(livePermissions.value.factor) }
  if (workspace.id === 'data') return { ...workspace, count: String(diagnostics.value?.collections.length ?? workspace.count) }
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
const visibleMarketRows = computed(() => (reportView.value === 'half' ? liveHalfMarketRows.value : liveFinalMarketRows.value))
const visibleHitEvents = computed(() => liveHitEvents.value.filter(item => !currentOnly.value || item.state !== 'settled'))
const visibleHallModels = computed(() => liveHallModels.value.filter(item => hallType.value === 'all' || item.type === hallType.value))

const filteredModels = computed(() => liveModels.value.filter((model) => {
  const stateMatched = modelFilter.value === 'all' || model.state === modelFilter.value
  const text = `${model.name} ${model.objectId} ${model.description} ${model.bestSelection}`.toLowerCase()
  return stateMatched && (!searchText.value || text.includes(searchText.value.toLowerCase()))
}))

const collectionCount = (name: string) => (
  diagnostics.value?.collections.find(collection => collection.name === name)?.estimatedDocumentCount ?? 0
)
const shortCount = (count: number) => {
  if (count >= 10000) return `${Math.round(count / 10000)}w+`
  return String(count)
}
const refreshLiveData = async () => {
  await Promise.all([refreshModels(), refreshReport(), refreshHalfReport(), refreshAnalysis(), refreshDiagnostics(), refreshEvents(), refreshHall(), refreshPermissions()])
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
              <p>旧 WebV2 模型状态、额度、锁定和可操作性映射。</p>
            </div>
            <button type="button" class="primary-button focus-ring" @click="openWorkspace('builder')">
              <Plus :size="16" />
              <span>新建模型</span>
            </button>
          </div>

          <div class="quota-grid">
            <div>
              <span>{{ hasApiModels ? '加载模型' : '可创建模型' }}</span>
              <strong class="num">{{ hasApiModels ? `${liveModels.length} / ${collectionCount('ColQuantiModel') || '-'}` : `${livePermissions.usedDraft} / ${livePermissions.establish}` }}</strong>
              <em>{{ hasApiModels ? 'Mongo ColQuantiModel' : 'MyPermission.Establish' }}</em>
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
            <div v-for="model in liveModels" :key="`${model.id}-actions`" class="action-row">
              <div>
                <strong>{{ model.name }}</strong>
                <span class="mono">{{ model.objectId }}</span>
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
              </button>
            </div>

            <div class="factor-catalog">
              <div class="factor-head table-head">
                <span>因子</span>
                <span>字段</span>
                <span>默认范围</span>
                <span>权限</span>
              </div>
              <div v-for="factor in visibleFactors" :key="factor.id" class="factor-row">
                <div>
                  <strong>{{ factor.name }}</strong>
                  <span class="mono">{{ factor.id }}</span>
                </div>
                <span class="mono field-cell">{{ factor.field }}</span>
                <span>{{ factor.range }}</span>
                <span :class="['status-chip', factor.role === 'premium' ? 'warn' : 'plain']">{{ factor.role }}</span>
              </div>
            </div>
          </div>

          <div class="selected-factor-grid">
            <div v-for="factor in selectedModelFactors" :key="factor.id" class="selected-factor-card">
              <div>
                <strong>{{ factor.name }}</strong>
                <span class="mono">{{ factor.id }}</span>
              </div>
              <div class="range-line">
                <span class="num">{{ factor.min }}</span>
                <span class="range-track"><i :style="{ left: `${Math.min(factor.min, 100)}%`, right: `${Math.max(0, 100 - Math.min(factor.max, 100))}%` }" /></span>
                <span class="num">{{ factor.max }}</span>
              </div>
              <em>{{ factor.logic }}</em>
            </div>
          </div>
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
              <div>
                <strong>{{ event.teams }}</strong>
                <span>{{ event.league }} / {{ event.time }} / {{ event.update }}</span>
              </div>
              <span class="status-chip plain">{{ liveModels.find(model => model.id === event.model)?.name ?? '旧站命中模型' }}</span>
              <span class="num">{{ event.score }}</span>
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
            <div class="toolbar">
              <button type="button" :class="['tab-button focus-ring', { active: hallType === 'all' }]" @click="hallType = 'all'">全部</button>
              <button type="button" :class="['tab-button focus-ring', { active: hallType === 'sfp' }]" @click="hallType = 'sfp'">胜平负</button>
              <button type="button" :class="['tab-button focus-ring', { active: hallType === 'asian' }]" @click="hallType = 'asian'">让球</button>
              <button type="button" :class="['tab-button focus-ring', { active: hallType === 'ou' }]" @click="hallType = 'ou'">大小</button>
            </div>
            <div :class="['status-chip', hallError ? 'warn' : 'plain']">
              <span>{{ hallPending ? '读取广场...' : hallSourceLabel }}</span>
            </div>
          </div>

          <div class="hall-rules">
            <div><Star :size="15" /><span>已发布</span></div>
            <div><TrendingUp :size="15" /><span>1年收益 >= 50%</span></div>
            <div><Target :size="15" /><span>1年分布 >= 62%</span></div>
            <div><Layers :size="15" /><span>3年分布 >= 55%</span></div>
            <div><Filter :size="15" /><span>排除相似性模型</span></div>
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
              <button type="button" class="primary-button focus-ring" :disabled="model.subscription === 'mine'">
                <ShoppingCart :size="15" />
                <span>{{ model.subscription === 'active' ? `续订至 ${model.expires}` : model.subscription === 'mine' ? '我的模型' : '订阅' }}</span>
              </button>
            </div>
          </div>
        </section>

        <section v-else class="workspace-panel">
          <div class="panel-title workspace-title">
            <div>
              <span class="eyebrow">Runtime</span>
              <h3>数据诊断</h3>
              <p>本地 Nuxt 前端通过私网 API 或 SSH 隧道访问 Quantilearn Mongo 服务。</p>
            </div>
            <div :class="['status-chip', diagnostics?.canConnect ? 'good' : diagnosticsError ? 'danger' : 'plain']">
              <ServerCog :size="14" />
              <span>{{ diagnosticsError ? errorMessage(diagnosticsError) : diagnosticsPending ? 'Mongo Checking' : diagnosticsSourceLabel }}</span>
            </div>
          </div>

          <div class="diagnostic-grid">
            <div>
              <Database :size="17" />
              <span>Database</span>
              <strong>{{ diagnostics?.databaseName ?? 'SpdexQuantilearn' }}</strong>
            </div>
            <div>
              <TableProperties :size="17" />
              <span>ColQuantiModel</span>
              <strong class="num">{{ collectionCount('ColQuantiModel') || liveModels.length }}</strong>
            </div>
            <div>
              <FileText :size="17" />
              <span>ColFundament</span>
              <strong class="num">{{ shortCount(collectionCount('ColFundament')) }}</strong>
            </div>
            <div>
              <Activity :size="17" />
              <span>API</span>
              <strong>{{ apiBase }}</strong>
            </div>
          </div>

          <div class="endpoint-list">
            <div><span>GET</span><code>/api/quantilearn/health</code><em>健康检查</em></div>
            <div><span>GET</span><code>/api/quantilearn/factors?set=spdex_v1</code><em>因子定义</em></div>
            <div><span>GET</span><code>/api/quantilearn/models</code><em>模型集合</em></div>
            <div><span>GET</span><code>/api/quantilearn/me/permissions</code><em>身份权限</em></div>
            <div><span>GET</span><code>/api/quantilearn/analysis/models/{{ selectedModel.objectId }}/fundaments/summary</code><em>模型样本</em></div>
            <div><span>GET</span><code>/api/quantilearn/analysis/models/{{ selectedModel.objectId }}/statistics/summary</code><em>统计摘要</em></div>
            <div><span>GET</span><code>/api/quantilearn/events/current</code><em>当前命中</em></div>
            <div><span>GET</span><code>/api/quantilearn/hall</code><em>模型广场</em></div>
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
.selected-factor-card,
.diagnostic-grid div {
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

.action-matrix,
.factor-catalog,
.endpoint-list {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
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
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 10px;
}

.factor-groups {
  display: grid;
  gap: 6px;
}

.factor-group-button {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 34px;
  padding: 0 9px;
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
  overflow: hidden;
  font-weight: 780;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.factor-group-button em {
  color: inherit;
  font-size: 0.68rem;
  font-style: normal;
  opacity: 0.7;
}

.factor-head,
.factor-row {
  grid-template-columns: minmax(160px, 1.2fr) minmax(180px, 1.2fr) 94px 76px;
  min-width: 600px;
  column-gap: 8px;
  padding: 0 9px;
}

.factor-row {
  display: grid;
  align-items: center;
  min-height: 42px;
  border-top: 1px solid rgba(220, 227, 235, 0.72);
}

.selected-factor-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.selected-factor-card {
  display: grid;
  gap: 7px;
  padding: 9px;
}

.selected-factor-card div:first-child {
  display: grid;
}

.selected-factor-card strong {
  overflow: hidden;
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-factor-card em {
  color: var(--muted);
  font-size: 0.74rem;
  font-style: normal;
}

.range-line {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 34px;
  gap: 7px;
  align-items: center;
}

.range-track {
  position: relative;
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
  grid-template-columns: minmax(220px, 1.4fr) minmax(120px, 0.9fr) 72px 92px 54px;
  min-height: 46px;
  padding: 8px 10px;
  color: inherit;
  text-align: left;
}

.event-row div:first-child,
.hall-row > div:first-child {
  display: grid;
  min-width: 0;
}

.event-row span,
.hall-row span {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.diagnostic-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.diagnostic-grid div {
  display: grid;
  gap: 4px;
  min-height: 72px;
  padding: 10px;
}

.diagnostic-grid svg {
  color: var(--teal);
}

.diagnostic-grid span {
  color: var(--muted);
  font-size: 0.74rem;
}

.diagnostic-grid strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.endpoint-list {
  display: grid;
}

.endpoint-list div {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) minmax(90px, 0.4fr);
  gap: 8px;
  align-items: center;
  min-height: 36px;
  padding: 0 9px;
  border-top: 1px solid rgba(220, 227, 235, 0.72);
}

.endpoint-list div:first-child {
  border-top: 0;
}

.endpoint-list span {
  color: var(--teal);
  font-size: 0.72rem;
  font-weight: 820;
}

.endpoint-list code {
  overflow: hidden;
  color: var(--ink);
  font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.endpoint-list em {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.72rem;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
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

  .main-stage {
    order: 2;
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

  .quota-grid,
  .selected-factor-grid,
  .diagnostic-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .builder-layout {
    grid-template-columns: 1fr;
  }

  .factor-groups {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .event-row,
  .hall-row {
    grid-template-columns: 1fr;
  }

  .hall-rules {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 430px) {
  .quota-grid,
  .selected-factor-grid,
  .diagnostic-grid {
    grid-template-columns: 1fr;
  }

  .factor-groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
