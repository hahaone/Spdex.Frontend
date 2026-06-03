import type {
  FactorDefinition,
  FactorGroupId,
  GoalRow,
  HallModel,
  HallType,
  HitEvent,
  MarketRow,
  ModelState,
  PermissionProfile,
  QuantModel,
  ReportPeriod,
  SelectedFactor,
} from '~/data/quantilearnPrototype'

interface QuantilearnApiResponse<T> {
  code: number
  message: string
  data: T
}

export interface QuantilearnApiModelFactor {
  factorId: string
  min: number
  max: number
}

export interface QuantilearnApiModelLogic {
  comp: number
  compType: number
  x: string
  y: string
}

export interface QuantilearnApiModel {
  userId: number
  name: string
  description: string
  createTime: string
  isPublished: number
  factors: QuantilearnApiModelFactor[]
  logics: QuantilearnApiModelLogic[]
}

export interface QuantilearnApiModelDetail {
  id: string
  updateTime: string
  isOwner: boolean
  isLocked: boolean
  isSimilarity: boolean
  similarTo?: string
  model: QuantilearnApiModel
}

export interface QuantilearnApiFactorDefinition {
  uniqueId: string
  fieldName: string
  min: number
  max: number
  description: string
}

export interface QuantilearnApiAnalysisSummary {
  modelId: string
  canAnalyze: boolean
  errors: string[]
  warnings: string[]
  modelFactorCount: number
  regularFactorCount: number
  extraFactorCount: number
  appliedExtraFactorCount: number
  unsupportedExtraFactorCount: number
  logicCount: number
  appliedLogicCount: number
  regularFactorMatchedCount: number
  logicMatchedCount: number
  finalMatchedCount: number
}

export interface QuantilearnApiStatisticCoreReport {
  hit: number
  homeOddsCount: number
  drawOddsCount: number
  awayOddsCount: number
  homeAsianCount: number
  drawAsianCount: number
  awayAsianCount: number
  over25Count: number
  under25Count: number
  homeOddsPer: number
  drawOddsPer: number
  awayOddsPer: number
  homeAsianPer: number
  awayAsianPer: number
  over25Per: number
  under25Per: number
  avrHomeOdds: number
  avrDrawOdds: number
  avrAwayOdds: number
  avrOver25: number
  avrUnder25: number
  probHomeOdds: number
  probDrawOdds: number
  probAwayOdds: number
  probOver25: number
  probUnder25: number
  avrAsianOddsHome: number
  avrAsianOddsAway: number
  goal0: number
  goal1: number
  goal2: number
  goal3: number
  goal4: number
  goal5: number
  goal6: number
  goal7: number
  homeWin2: number
  homeWin1: number
  draw0: number
  awayWin1: number
  awayWin2: number
}

export interface QuantilearnApiStatisticSummary {
  modelId: string
  modelUpdateTime?: string
  canAnalyze: boolean
  errors: string[]
  warnings: string[]
  days: number
  half?: boolean
  anchorUtc: string
  storedReportPath: string
  hasStoredReport: boolean
  finalMatchedCount: number
  windowDocumentCount: number
  validResultCount: number
  computed: QuantilearnApiStatisticCoreReport
  stored?: QuantilearnApiStatisticCoreReport
}

export interface QuantilearnMongoCollectionSummary {
  name: string
  exists: boolean
  estimatedDocumentCount: number
}

export interface QuantilearnMongoDiagnostics {
  checkedAtUtc: string
  databaseName: string
  isConfigured: boolean
  canConnect: boolean
  collections: QuantilearnMongoCollectionSummary[]
}

export interface QuantilearnApiHitEventSummary {
  modelId: string
  modelName: string
  modelState: number
  userId: number
  eventId: string
  eventTime: string
  updateTime?: string
  state: number
  status: 'new' | 'used' | 'settled' | string
  league: string
  home: string
  away: string
  score: string
  hasResult: boolean
  selection: string
}

export interface QuantilearnApiHallModelSummary {
  modelId: string
  name: string
  userId: number
  state: number
  updateTime: string
  market: string
  selection: string
  hit: number
  distribution: number
  yearReturn: number
  threeYearDistribution: number
  averageOdds: number
  subscribers: number
  price: number
  subscriptionState: 'none' | 'active' | 'mine' | string
  isOwner: boolean
  isLocked: boolean
  meetsRules: boolean
  ruleWarnings: string[]
}

export interface QuantilearnHallRequest {
  type?: HallType
  order?: 'return' | 'hit' | 'distribution' | 'price' | 'updated'
  keyword?: string
  page?: number
  pageSize?: number
  strict?: boolean
}

export interface QuantilearnApiPermissionProfile {
  isAuthenticated: boolean
  userId?: number
  roleId: number
  role: string
  source: string
  isDevelopmentFallback: boolean
  establish: number
  publish: number
  factor: number
  usedDraft: number
  usedPublish: number
  extraPublish: number
  extraPublishExpiresAtUtc?: string
  disabledFactors: string[]
  warnings: string[]
}

export interface QuantilearnApiFlashFactorCell {
  factorId: string
  fieldName: string
  description: string
  group: string
  value?: number
  displayValue: string
  hasValue: boolean
  valueSource: string
  minLimit: number
  maxLimit: number
  suggestedMin?: number
  suggestedMax?: number
  suggestedDecimals: number
  rangeStrategy: string
  isDefaultSelected: boolean
}

export interface QuantilearnApiFlashEventSnapshot {
  eventId: string
  factorSetName: string
  requestedSnapshot: string
  snapshot: string
  vendorBasePath: string
  usedLiveSnapshot: boolean
  vendorBaseAvailable: boolean
  eventTimeUtc?: string
  updateTimeUtc?: string
  league: string
  home: string
  away: string
  score: string
  hasResult: boolean
  factors: QuantilearnApiFlashFactorCell[]
  defaultSelectedFactorIds: string[]
  vendorBase: Record<string, unknown>
  warnings: string[]
}

export interface QuantilearnFlashSnapshotRequest {
  snapshot?: 'current' | '1' | '2' | '3' | '6' | string
  factorSet?: string
}

export interface QuantilearnFlashAnalysisFactor {
  factorId: string
  min: number
  max: number
}

export interface QuantilearnFlashAnalysisLogic {
  comp: number
  compType: number
  x: string
  y: string
}

export interface QuantilearnFlashAnalysisRequest {
  factorSetName?: string
  snapshot?: 'current' | '1' | '2' | '3' | '6' | string
  leagueType?: number
  days?: number[]
  anchorUtc?: string
  includeHalf?: boolean
  factors: QuantilearnFlashAnalysisFactor[]
  logics?: QuantilearnFlashAnalysisLogic[]
}

export interface QuantilearnApiFlashAnalysisPeriod {
  days: number
  half: boolean
  windowDocumentCount: number
  validResultCount: number
  computed: QuantilearnApiStatisticCoreReport
}

export interface QuantilearnApiFlashAnalysisResult {
  eventId: string
  factorSetName: string
  snapshot: string
  vendorBasePath: string
  leagueType: number
  anchorUtc: string
  canAnalyze: boolean
  errors: string[]
  warnings: string[]
  modelFactorCount: number
  regularFactorCount: number
  extraFactorCount: number
  appliedExtraFactorCount: number
  unsupportedExtraFactorCount: number
  logicCount: number
  appliedLogicCount: number
  regularFactorMatchedCount: number
  logicMatchedCount: number
  finalMatchedCount: number
  periods: QuantilearnApiFlashAnalysisPeriod[]
}

export interface QuantilearnFlashMatchesRequest {
  factorSetName?: string
  snapshot?: 'current' | '1' | '2' | '3' | '6' | string
  leagueType?: number
  days?: number
  anchorUtc?: string
  half?: boolean
  limit?: number
  factors: QuantilearnFlashAnalysisFactor[]
  logics?: QuantilearnFlashAnalysisLogic[]
}

export interface QuantilearnApiFlashMatchedEvent {
  eventId: string
  eventTimeUtc: string
  league: string
  home: string
  away: string
  score: string
  halfScore: string
  oddsSelection: string
  asianSelection: string
  goalSelection: string
  homeOdds: number
  drawOdds: number
  awayOdds: number
  over25Odds: number
  under25Odds: number
}

export interface QuantilearnApiFlashMatchesResult {
  eventId: string
  factorSetName: string
  snapshot: string
  vendorBasePath: string
  leagueType: number
  days: number
  half: boolean
  limit: number
  anchorUtc: string
  canAnalyze: boolean
  errors: string[]
  warnings: string[]
  finalMatchedCount: number
  windowMatchedCount: number
  matches: QuantilearnApiFlashMatchedEvent[]
}

const trimSlash = (value: string) => value.replace(/\/+$/, '')

const formatDate = (value?: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

const toModelState = (isPublished: number): ModelState => (isPublished > 0 ? 'published' : 'draft')

const factorNumber = (factorId: string) => {
  const match = /^f(\d+)$/i.exec(factorId)
  return match ? Number(match[1]) : Number.NaN
}

const factorGroupId = (factorId: string): FactorGroupId => {
  const id = factorNumber(factorId)

  if (id >= 1 && id <= 3) return 'bf-index'
  if (id >= 4 && id <= 6) return 'bf-volume'
  if (id >= 7 && id <= 9) return 'ratio'
  if (id >= 13 && id <= 15) return 'odds'
  if ((id >= 10 && id <= 12) || (id >= 16 && id <= 21)) return 'profit'
  if (id >= 22 && id <= 24) return 'euro'
  if (id >= 25 && id <= 27) return 'kelly'
  if (id >= 28 && id <= 40) return 'goals'

  return 'inside'
}

const factorRole = (factorId: string): FactorDefinition['role'] => {
  const id = factorNumber(factorId)
  if (id >= 28) return 'premium'
  if ([1, 2, 3, 7, 8, 9, 10, 11, 12, 16, 17, 18, 22, 23, 24].includes(id)) return 'logic'
  return 'basic'
}

const formatRange = (min: number, max: number) => `${min} - ${max}`

const returnByDistribution = (distribution: number, average: number) => {
  if (!distribution || !average) return 0
  return distribution * average - 1
}

const formatShortDate = (value?: string) => {
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

const hallTypeByMarket = (market: string): HallType => {
  if (market === '胜平负') return 'sfp'
  if (market === '让球') return 'asian'
  if (market === '进球') return 'ou'
  return 'all'
}

const eventState = (status: string): HitEvent['state'] => {
  if (status === 'settled') return 'settled'
  if (status === 'used') return 'used'
  return 'new'
}

export const toFactorDefinition = (factor: QuantilearnApiFactorDefinition): FactorDefinition => ({
  id: factor.uniqueId,
  name: factor.description || factor.uniqueId,
  field: factor.fieldName,
  group: factorGroupId(factor.uniqueId),
  range: formatRange(factor.min, factor.max),
  role: factorRole(factor.uniqueId),
})

export const toSelectedFactors = (
  model: QuantilearnApiModelDetail | undefined,
  factors: FactorDefinition[],
): SelectedFactor[] => {
  if (!model) return []

  const factorMap = new Map(factors.map(factor => [factor.id, factor]))
  return model.model.factors.map((factor) => {
    const definition = factorMap.get(factor.factorId)

    return {
      id: factor.factorId,
      name: definition?.name ?? factor.factorId,
      min: factor.min,
      max: factor.max,
      logic: '区间过滤',
    }
  })
}

export const statisticToMarketRows = (summary?: QuantilearnApiStatisticSummary | null): MarketRow[] => {
  if (!summary?.computed) return []

  const report = summary.computed
  return [
    {
      market: '胜平负',
      selection: '主',
      count: report.homeOddsCount,
      distribution: report.homeOddsPer,
      average: report.avrHomeOdds,
      probability: report.probHomeOdds,
      yearReturn: returnByDistribution(report.homeOddsPer, report.avrHomeOdds),
    },
    {
      market: '胜平负',
      selection: '平',
      count: report.drawOddsCount,
      distribution: report.drawOddsPer,
      average: report.avrDrawOdds,
      probability: report.probDrawOdds,
      yearReturn: returnByDistribution(report.drawOddsPer, report.avrDrawOdds),
    },
    {
      market: '胜平负',
      selection: '客',
      count: report.awayOddsCount,
      distribution: report.awayOddsPer,
      average: report.avrAwayOdds,
      probability: report.probAwayOdds,
      yearReturn: returnByDistribution(report.awayOddsPer, report.avrAwayOdds),
    },
    {
      market: '让球',
      selection: '让球主',
      count: report.homeAsianCount,
      distribution: report.homeAsianPer,
      average: report.avrAsianOddsHome,
      probability: report.homeAsianPer,
      yearReturn: returnByDistribution(report.homeAsianPer, report.avrAsianOddsHome),
    },
    {
      market: '让球',
      selection: '让球客',
      count: report.awayAsianCount,
      distribution: report.awayAsianPer,
      average: report.avrAsianOddsAway,
      probability: report.awayAsianPer,
      yearReturn: returnByDistribution(report.awayAsianPer, report.avrAsianOddsAway),
    },
    {
      market: '进球',
      selection: '大于 2.5',
      count: report.over25Count,
      distribution: report.over25Per,
      average: report.avrOver25,
      probability: report.probOver25,
      yearReturn: returnByDistribution(report.over25Per, report.avrOver25),
    },
    {
      market: '进球',
      selection: '小于 2.5',
      count: report.under25Count,
      distribution: report.under25Per,
      average: report.avrUnder25,
      probability: report.probUnder25,
      yearReturn: returnByDistribution(report.under25Per, report.avrUnder25),
    },
  ]
}

export const statisticToGoalRows = (summary?: QuantilearnApiStatisticSummary | null): GoalRow[] => {
  if (!summary?.computed) return []

  const report = summary.computed
  return [
    { label: '0球', value: report.goal0 },
    { label: '1球', value: report.goal1 },
    { label: '2球', value: report.goal2 },
    { label: '3球', value: report.goal3 },
    { label: '4球', value: report.goal4 },
    { label: '5球', value: report.goal5 },
    { label: '6球', value: report.goal6 },
    { label: '7球+', value: report.goal7 },
  ]
}

export const bestMarketRow = (rows: MarketRow[]) => {
  if (!rows.length) return undefined
  return [...rows].sort((left, right) => right.yearReturn - left.yearReturn)[0]
}

export const statisticsToReportPeriods = (summaries: QuantilearnApiStatisticSummary[]): ReportPeriod[] => (
  summaries
    .filter(summary => summary.canAnalyze)
    .map((summary) => {
      const best = bestMarketRow(statisticToMarketRows(summary))
      const hasHit = summary.computed.hit > 0

      return {
        label: summary.days === 365 ? '1年' : `${summary.days}日`,
        hit: summary.computed.hit,
        selection: hasHit ? best?.selection ?? '-' : '-',
        yearReturn: hasHit ? best?.yearReturn ?? 0 : 0,
        distribution: hasHit ? best?.distribution ?? 0 : 0,
      }
    })
)

export const toQuantModel = (
  detail: QuantilearnApiModelDetail,
  statistic?: QuantilearnApiStatisticSummary | null,
): QuantModel => {
  const rows = statisticToMarketRows(statistic)
  const best = bestMarketRow(rows)
  const state = toModelState(detail.model.isPublished)

  return {
    id: detail.id,
    name: detail.model.name || '(未命名模型)',
    objectId: detail.id,
    description: detail.model.description || '无描述',
    state,
    owner: `User ${detail.model.userId}`,
    ownerType: detail.isOwner ? 'self' : 'subscribed',
    createdAt: formatDate(detail.model.createTime),
    updatedAt: formatDate(detail.updateTime),
    isOwner: detail.isOwner,
    isLocked: detail.isLocked,
    isSimilarity: detail.isSimilarity,
    similarTo: detail.similarTo,
    factorCount: detail.model.factors.length,
    logicCount: detail.model.logics.length,
    hitEvents: 0,
    subscriptions: 0,
    bestSelection: best?.selection ?? (statistic ? '-' : '待分析'),
    yearReturn: best?.yearReturn ?? 0,
    distribution: best?.distribution ?? 0,
    hit: statistic?.computed.hit ?? 0,
    avgOdds: best?.average ?? 0,
    price: 0,
    sample365: statistic?.finalMatchedCount ?? 0,
    note: detail.isLocked
      ? '被有效订阅锁定'
      : detail.isSimilarity
        ? `与 ${detail.similarTo ?? '已有模型'} 相似`
        : state === 'published'
          ? '已发布模型，编辑前需要取消发布'
          : '可编辑，可发布；发布时会做相似性校验',
  }
}

export const toHitEvent = (event: QuantilearnApiHitEventSummary): HitEvent => ({
  id: `${event.modelId}-${event.eventId}`,
  model: event.modelId,
  league: event.league || '未知赛事',
  teams: event.home && event.away ? `${event.home} vs ${event.away}` : event.eventId,
  time: formatShortDate(event.eventTime),
  score: event.score || (event.hasResult ? '-' : '未赛'),
  state: eventState(event.status),
  update: formatShortDate(event.updateTime),
  selection: event.selection || '-',
})

export const toHallModel = (model: QuantilearnApiHallModelSummary): HallModel => ({
  id: model.modelId,
  name: model.name || '(未命名模型)',
  author: `User ${model.userId}`,
  type: hallTypeByMarket(model.market),
  selection: `${model.market} ${model.selection}`.trim(),
  yearReturn: model.yearReturn,
  distribution: model.distribution,
  threeYearDistribution: model.threeYearDistribution,
  hit: model.hit,
  price: model.price,
  subscribers: model.subscribers,
  subscription: model.subscriptionState === 'mine'
    ? 'mine'
    : model.subscriptionState === 'active'
      ? 'active'
      : 'none',
  meetsRules: model.meetsRules,
  ruleWarnings: model.ruleWarnings,
})

export const toPermissionProfile = (profile: QuantilearnApiPermissionProfile): PermissionProfile => ({
  isAuthenticated: profile.isAuthenticated,
  userId: profile.userId,
  roleId: profile.roleId,
  role: profile.role || 'Quantilearn',
  source: profile.source,
  isDevelopmentFallback: profile.isDevelopmentFallback,
  establish: profile.establish,
  publish: profile.publish,
  factor: profile.factor,
  usedDraft: profile.usedDraft,
  usedPublish: profile.usedPublish,
  extraPublish: profile.extraPublish,
  extraPublishExpiresAtUtc: profile.extraPublishExpiresAtUtc,
  disabledFactors: profile.disabledFactors,
  warnings: profile.warnings,
})

export const useQuantilearnApi = () => {
  const config = useRuntimeConfig()
  const apiBase = computed(() => trimSlash(String(config.public.quantilearnApiBase ?? 'http://127.0.0.1:5176')))

  const redirectToLogin = () => {
    if (!config.public.requireAuth || import.meta.server) return

    const loginUrl = String(config.public.newspdexLoginUrl || 'https://new.spdex.com/login')
    window.location.href = `${loginUrl}?redirect=${encodeURIComponent(window.location.href)}`
  }

  const request = async <T>(
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
    options: { method?: 'GET' | 'POST', body?: unknown } = {},
  ) => {
    const headers = import.meta.server ? useRequestHeaders(['authorization', 'cookie']) : undefined
    let response: QuantilearnApiResponse<T>
    try {
      response = await $fetch<QuantilearnApiResponse<T>>(`${apiBase.value}${path}`, {
        method: options.method,
        body: options.body as Record<string, unknown> | BodyInit | null | undefined,
        query,
        headers,
      })
    }
    catch (error) {
      const fetchError = error as { statusCode?: number, status?: number }
      if ((fetchError.statusCode === 401 || fetchError.status === 401) && config.public.requireAuth) {
        redirectToLogin()
      }
      throw error
    }

    if (response.code !== 0) {
      if (response.code === 401 && config.public.requireAuth) {
        redirectToLogin()
      }
      throw new Error(response.message || `Quantilearn API returned code ${response.code}`)
    }

    return response.data
  }

  return {
    apiBase,
    getModels: (limit = 50) => request<QuantilearnApiModelDetail[]>('/api/quantilearn/models', { limit }),
    getFactors: (set = 'spdex_v1') => request<QuantilearnApiFactorDefinition[]>('/api/quantilearn/factors', { set }),
    getFundamentSummary: (id: string) => request<QuantilearnApiAnalysisSummary>(`/api/quantilearn/analysis/models/${id}/fundaments/summary`),
    getStatisticSummary: (id: string, days = 365, half = false) => request<QuantilearnApiStatisticSummary>(`/api/quantilearn/analysis/models/${id}/statistics/summary`, { days, half }),
    getPermissions: () => request<QuantilearnApiPermissionProfile>('/api/quantilearn/me/permissions'),
    getCurrentEvents: (hours = 24 * 30, limit = 80) => request<QuantilearnApiHitEventSummary[]>('/api/quantilearn/events/current', { hours, limit }),
    getFlashEventSnapshot: (eventId: string, query: QuantilearnFlashSnapshotRequest = {}) => request<QuantilearnApiFlashEventSnapshot>(`/api/quantilearn/flash/events/${encodeURIComponent(eventId)}`, {
      snapshot: query.snapshot ?? 'current',
      factorSet: query.factorSet ?? 'spdex_v1',
    }),
    analyzeFlashEvent: (eventId: string, body: QuantilearnFlashAnalysisRequest) => request<QuantilearnApiFlashAnalysisResult>(`/api/quantilearn/flash/events/${encodeURIComponent(eventId)}/analysis`, undefined, {
      method: 'POST',
      body,
    }),
    getFlashEventMatches: (eventId: string, body: QuantilearnFlashMatchesRequest) => request<QuantilearnApiFlashMatchesResult>(`/api/quantilearn/flash/events/${encodeURIComponent(eventId)}/matches`, undefined, {
      method: 'POST',
      body,
    }),
    getHallModels: (query: QuantilearnHallRequest = {}) => request<QuantilearnApiHallModelSummary[]>('/api/quantilearn/hall', {
      type: query.type ?? 'all',
      order: query.order ?? 'return',
      keyword: query.keyword,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 30,
      strict: query.strict ?? false,
    }),
  }
}
