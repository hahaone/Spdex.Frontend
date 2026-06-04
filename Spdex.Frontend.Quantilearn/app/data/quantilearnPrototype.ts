export type WorkspaceId = 'models' | 'builder' | 'report' | 'events' | 'hall'
export type WorkspaceIcon = 'layers' | 'workflow' | 'report' | 'events' | 'hall'
export type ModelId = string
export type ModelState = 'draft' | 'published' | 'temp' | 'subscription'
export type ModelFilter = 'all' | 'draft' | 'published' | 'locked'
export type LeagueScope = 'all' | 'league' | 'cup' | 'friendly'
export type ReportView = 'final' | 'half' | 'goals'
export type FactorGroupId = 'bf-index' | 'bf-volume' | 'ratio' | 'profit' | 'odds' | 'euro' | 'kelly' | 'goals' | 'inside'
export type EventState = 'new' | 'used' | 'settled'
export type HallType = 'all' | 'sfp' | 'asian' | 'ou'
export type Tone = 'good' | 'warn' | 'purple' | 'plain'

export interface WorkspaceItem {
  id: WorkspaceId
  label: string
  hint: string
  icon: WorkspaceIcon
  count: string
}

export interface PermissionProfile {
  isAuthenticated?: boolean
  userId?: number
  roleId?: number
  role: string
  source?: string
  isDevelopmentFallback?: boolean
  establish: number
  publish: number
  factor: number
  usedDraft: number
  usedPublish: number
  extraPublish: number
  extraPublishExpiresAtUtc?: string
  flashQCanUseGoalBalance?: boolean
  flashQCanUseInnerOuter?: boolean
  flashQCanUseLogics?: boolean
  flashQCanUseInnerOuterLogics?: boolean
  disabledFactors?: string[]
  warnings?: string[]
}

export interface QuantModel {
  id: ModelId
  name: string
  objectId: string
  description: string
  state: ModelState
  owner: string
  ownerType: 'self' | 'subscribed'
  createdAt: string
  updatedAt: string
  isOwner: boolean
  isLocked: boolean
  isSimilarity: boolean
  similarTo?: string
  factorCount: number
  logicCount: number
  hitEvents: number
  subscriptions: number
  bestSelection: string
  hasStatistics: boolean
  yearReturn: number
  distribution: number
  hit: number
  avgOdds: number
  price: number
  sample365: number
  note: string
}

export interface FactorGroup {
  id: FactorGroupId
  label: string
  summary: string
}

export interface FactorDefinition {
  id: string
  name: string
  field: string
  group: FactorGroupId
  range: string
  role: 'basic' | 'logic' | 'premium'
}

export interface SelectedFactor {
  id: string
  name: string
  min: number
  max: number
  logic: string
}

export interface ReportPeriod {
  label: string
  hit: number
  selection: string
  yearReturn: number
  distribution: number
}

export interface MarketRow {
  market: string
  selection: string
  count: number
  distribution: number
  average: number
  probability: number
  yearReturn: number
}

export interface GoalRow {
  label: string
  value: number
}

export interface TimelinePoint {
  label: string
  positive: number
  negative: number
}

export interface HitEvent {
  id: string
  model: ModelId
  modelName?: string
  eventId?: string
  league: string
  teams: string
  time: string
  score: string
  state: EventState
  update: string
  selection: string
}

export interface HallModel {
  id: string
  name: string
  author: string
  type: HallType
  selection: string
  yearReturn: number
  distribution: number
  threeYearDistribution: number
  hit: number
  price: number
  subscribers: number
  subscription: 'none' | 'active' | 'mine'
  expires?: string
  meetsRules?: boolean
  ruleWarnings?: string[]
}

export const permissions: PermissionProfile = {
  role: '黄金版',
  establish: 5,
  publish: 3,
  factor: 8,
  usedDraft: 4,
  usedPublish: 2,
  extraPublish: 1,
}

export const workspaces: WorkspaceItem[] = [
  { id: 'models', label: '我的模型', hint: '当前账号的草稿、已发布和锁定模型', icon: 'layers', count: '8' },
  { id: 'builder', label: '建模器', hint: '因子区间、比较逻辑和权限额度', icon: 'workflow', count: `${permissions.factor}` },
  { id: 'report', label: '回测报告', hint: '7日、30日、1年和半场统计', icon: 'report', count: '365d' },
  { id: 'events', label: '模型赛事', hint: 'HitEvents 当前命中和已读状态', icon: 'events', count: '14' },
  { id: 'hall', label: '模型广场', hint: '发布、订阅、定价和相似性门槛', icon: 'hall', count: '500' },
]

export const modelFilters: Array<{ id: ModelFilter, label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'draft', label: '未发布' },
  { id: 'published', label: '已发布' },
  { id: 'locked', label: '锁定' },
]

export const leagueScopes: Array<{ id: LeagueScope, label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'league', label: '联赛' },
  { id: 'cup', label: '杯赛' },
  { id: 'friendly', label: '友谊赛' },
]

export const models: QuantModel[] = [
  {
    id: 'home-edge',
    name: '主胜防守修正',
    objectId: '636a422dc8251d022c086404',
    description: '必发指数主队、标准盘比例、凯利方差组合，带 X > Y 比较逻辑。',
    state: 'published',
    owner: 'timmbp',
    ownerType: 'self',
    createdAt: '2023-11-18',
    updatedAt: '2026-06-03 03:14',
    isOwner: true,
    isLocked: true,
    factorCount: 7,
    logicCount: 3,
    hitEvents: 5,
    subscriptions: 14,
    bestSelection: '主',
    hasStatistics: true,
    yearReturn: 1.74,
    distribution: 0.68,
    hit: 426,
    avgOdds: 2.18,
    price: 250,
    sample365: 6819,
    isSimilarity: false,
    note: '被订阅中，不能编辑、删除或取消发布。',
  },
  {
    id: 'asian-stable',
    name: '让球客稳定分布',
    objectId: '689da9dd6317df1c303e586d',
    description: '让球盘价格、内外盘比例和进球均衡因子，回测分布稳定。',
    state: 'draft',
    owner: 'timmbp',
    ownerType: 'self',
    createdAt: '2024-08-14',
    updatedAt: '2026-06-02 21:08',
    isOwner: true,
    isLocked: false,
    factorCount: 6,
    logicCount: 2,
    hitEvents: 3,
    subscriptions: 0,
    bestSelection: '让球客',
    hasStatistics: true,
    yearReturn: 0.92,
    distribution: 0.63,
    hit: 162,
    avgOdds: 1.91,
    price: 100,
    sample365: 4120,
    isSimilarity: false,
    note: '可编辑，可发布；发布时会做相似性校验。',
  },
  {
    id: 'goal-cold',
    name: '进球冷门过滤临时模型',
    objectId: '66b89f2f857231d840c2a921',
    description: '临时模型用于调试，不进入我的正式模型额度。',
    state: 'temp',
    owner: 'timmbp',
    ownerType: 'self',
    createdAt: '2025-02-05',
    updatedAt: '2026-06-03 00:42',
    isOwner: true,
    isLocked: false,
    factorCount: 5,
    logicCount: 1,
    hitEvents: 2,
    subscriptions: 0,
    bestSelection: '2球或以下',
    hasStatistics: true,
    yearReturn: 0.48,
    distribution: 0.57,
    hit: 88,
    avgOdds: 1.78,
    price: 100,
    sample365: 1902,
    isSimilarity: true,
    similarTo: '636a422dc8251d022c086404',
    note: '相似性标记存在，不能进入模型广场。',
  },
  {
    id: 'hall-sub',
    name: '客胜热度反向订阅',
    objectId: '66fb321dc8251d01871274ac',
    description: '来自模型广场的订阅模型，可参与报表和当前赛事。',
    state: 'subscription',
    owner: 'hall: 48271',
    ownerType: 'subscribed',
    createdAt: '2024-04-11',
    updatedAt: '2026-06-01 17:30',
    isOwner: false,
    isLocked: true,
    factorCount: 8,
    logicCount: 4,
    hitEvents: 4,
    subscriptions: 31,
    bestSelection: '客',
    hasStatistics: true,
    yearReturn: 2.13,
    distribution: 0.71,
    hit: 238,
    avgOdds: 3.24,
    price: 500,
    sample365: 5128,
    isSimilarity: false,
    note: '订阅有效至 2026-07-03，可续订，不能编辑源模型。',
  },
]

export const factorGroups: FactorGroup[] = [
  { id: 'bf-index', label: '必发指数', summary: '标准盘指数' },
  { id: 'bf-volume', label: '必发成交', summary: '成交量级' },
  { id: 'ratio', label: '标准盘比例', summary: '主平客占比' },
  { id: 'profit', label: '盈亏/冷热', summary: '盈亏与热度' },
  { id: 'odds', label: '价位', summary: '赔率价位' },
  { id: 'euro', label: '欧洲平均', summary: '欧赔均值' },
  { id: 'kelly', label: '凯利方差', summary: '凯利偏差' },
  { id: 'goals', label: '进球盘', summary: '大小球维度' },
  { id: 'inside', label: '内外盘', summary: '内外盘拆分' },
]

export const factorDefinitions: FactorDefinition[] = [
  { id: 'f01', name: '必发指数，标准盘主队', field: 'VendorBase.HomeIndex', group: 'bf-index', range: '0 - 100', role: 'logic' },
  { id: 'f02', name: '必发指数，标准盘平局', field: 'VendorBase.DrawIndex', group: 'bf-index', range: '0 - 100', role: 'logic' },
  { id: 'f03', name: '必发指数，标准盘客队', field: 'VendorBase.AwayIndex', group: 'bf-index', range: '0 - 100', role: 'logic' },
  { id: 'f04', name: '成交量，标准盘主队', field: 'VendorBase.HomeTrade', group: 'bf-volume', range: '0 - 10000000', role: 'basic' },
  { id: 'f05', name: '成交量，标准盘平局', field: 'VendorBase.DrawTrade', group: 'bf-volume', range: '0 - 10000000', role: 'basic' },
  { id: 'f07', name: '比例，标准盘主队', field: 'VendorBase.HomeRatio', group: 'ratio', range: '0 - 100', role: 'logic' },
  { id: 'f08', name: '比例，标准盘平局', field: 'VendorBase.DrawRatio', group: 'ratio', range: '0 - 100', role: 'logic' },
  { id: 'f10', name: '盈亏，标准盘主队', field: 'VendorBase.HomeProfit', group: 'profit', range: '-200 - 200', role: 'logic' },
  { id: 'f16', name: '冷热，标准盘主队', field: 'VendorBase.HomeHot', group: 'profit', range: '-100 - 100', role: 'logic' },
  { id: 'f13', name: '价位，标准盘主队', field: 'VendorBase.HomeOdds', group: 'odds', range: '0 - 1000', role: 'basic' },
  { id: 'f22', name: '欧洲平均，主队', field: 'VendorBase.EuroHome', group: 'euro', range: '0 - 1000', role: 'logic' },
  { id: 'f25', name: '凯利方差，主队', field: 'VendorBase.KellyHome', group: 'kelly', range: '0 - 500', role: 'basic' },
  { id: 'f28', name: '进球盘大于 2.5 成交', field: 'VendorBase.Over25Trade', group: 'goals', range: '0 - 10000000', role: 'premium' },
  { id: 'f40', name: '进球均衡', field: 'VendorBase.GoalBalance', group: 'goals', range: '-100 - 100', role: 'premium' },
  { id: 'f41', name: '内外盘主胜偏差', field: 'VendorBase.InOutHome', group: 'inside', range: '-100 - 100', role: 'premium' },
]

export const selectedFactors: SelectedFactor[] = [
  { id: 'f01', name: '必发指数，标准盘主队', min: 42, max: 86, logic: '大于 平、客' },
  { id: 'f07', name: '比例，标准盘主队', min: 37, max: 64, logic: '最大' },
  { id: 'f13', name: '价位，标准盘主队', min: 185, max: 245, logic: '不比较' },
  { id: 'f25', name: '凯利方差，主队', min: 0, max: 118, logic: '小于 平、客' },
  { id: 'c69', name: '第一个进球时间点', min: 0, max: 80, logic: '额外样本过滤' },
]

export const reportPeriods: ReportPeriod[] = [
  { label: '7日', hit: 18, selection: '主', yearReturn: 1.22, distribution: 0.67 },
  { label: '30日', hit: 64, selection: '主', yearReturn: 1.45, distribution: 0.66 },
  { label: '1年', hit: 426, selection: '主', yearReturn: 1.74, distribution: 0.68 },
]

export const finalMarketRows: MarketRow[] = [
  { market: '胜平负', selection: '主', count: 290, distribution: 0.68, average: 2.18, probability: 0.46, yearReturn: 1.74 },
  { market: '胜平负', selection: '平', count: 82, distribution: 0.19, average: 3.42, probability: 0.29, yearReturn: -0.18 },
  { market: '胜平负', selection: '客', count: 54, distribution: 0.13, average: 3.76, probability: 0.26, yearReturn: -0.42 },
  { market: '让球', selection: '让球主', count: 221, distribution: 0.52, average: 1.94, probability: 0.51, yearReturn: 0.64 },
  { market: '进球', selection: '3球或以上', count: 201, distribution: 0.47, average: 1.92, probability: 0.52, yearReturn: 0.27 },
]

export const halfMarketRows: MarketRow[] = [
  { market: '半场胜平负', selection: '主', count: 151, distribution: 0.35, average: 2.74, probability: 0.36, yearReturn: 0.41 },
  { market: '半场胜平负', selection: '平', count: 196, distribution: 0.46, average: 2.08, probability: 0.48, yearReturn: 0.18 },
  { market: '半场胜平负', selection: '客', count: 79, distribution: 0.19, average: 3.68, probability: 0.27, yearReturn: -0.24 },
  { market: '下半场进球', selection: '大于 1.5', count: 214, distribution: 0.50, average: 1.88, probability: 0.53, yearReturn: 0.52 },
]

export const goalRows: GoalRow[] = [
  { label: '0球', value: 31 },
  { label: '1球', value: 78 },
  { label: '2球', value: 116 },
  { label: '3球', value: 94 },
  { label: '4球', value: 62 },
  { label: '5球+', value: 45 },
]

export const timeline: TimelinePoint[] = [
  { label: 'D-6', positive: 12, negative: 4 },
  { label: 'D-5', positive: 18, negative: 7 },
  { label: 'D-4', positive: 23, negative: 8 },
  { label: 'D-3', positive: 31, negative: 11 },
  { label: 'D-2', positive: 42, negative: 15 },
  { label: 'D-1', positive: 53, negative: 18 },
  { label: '今日', positive: 61, negative: 21 },
]

export const hitEvents: HitEvent[] = [
  { id: 'e-001', model: 'home-edge', league: '英超', teams: '曼彻斯特城 vs 托特纳姆', time: '今天 19:30', score: '未赛', state: 'new', update: '2分钟前', selection: '主' },
  { id: 'e-002', model: 'home-edge', league: '德甲', teams: '勒沃库森 vs 多特蒙德', time: '今天 21:00', score: '未赛', state: 'new', update: '5分钟前', selection: '主' },
  { id: 'e-003', model: 'asian-stable', league: '西甲', teams: '皇家社会 vs 比利亚雷亚尔', time: '明天 00:15', score: '未赛', state: 'used', update: '18分钟前', selection: '让球客' },
  { id: 'e-004', model: 'hall-sub', league: '意甲', teams: '亚特兰大 vs 拉齐奥', time: '昨天 20:45', score: '1 - 2', state: 'settled', update: '1小时前', selection: '客' },
]

export const hallModels: HallModel[] = [
  { id: 'h1', name: '主胜强分布公开模型', author: '48271', type: 'sfp', selection: '主', yearReturn: 2.34, distribution: 0.72, threeYearDistribution: 0.67, hit: 188, price: 500, subscribers: 31, subscription: 'active', expires: '2026-07-03' },
  { id: 'h2', name: '让球客价格稳定模型', author: '77512', type: 'asian', selection: '让球客', yearReturn: 1.46, distribution: 0.66, threeYearDistribution: 0.58, hit: 126, price: 150, subscribers: 8, subscription: 'none' },
  { id: 'h3', name: '进球小盘回撤模型', author: 'timmbp', type: 'ou', selection: '2球或以下', yearReturn: 1.12, distribution: 0.64, threeYearDistribution: 0.56, hit: 91, price: 100, subscribers: 0, subscription: 'mine' },
]

export const stateLabel = (state: ModelState) => {
  if (state === 'published') return '已发布'
  if (state === 'temp') return '临时模型'
  if (state === 'subscription') return '订阅模型'
  return '未发布'
}

export const stateTone = (state: ModelState): Tone => {
  if (state === 'published') return 'good'
  if (state === 'temp') return 'warn'
  if (state === 'subscription') return 'purple'
  return 'plain'
}

export const actionState = (
  model: QuantModel,
  action: 'edit' | 'publish' | 'unpublish' | 'delete',
  profile: PermissionProfile,
) => {
  const usedPublish = profile.usedPublish + profile.extraPublish
  const publishLimit = profile.publish + profile.extraPublish

  if (model.ownerType === 'subscribed') return '订阅模型不可编辑'
  if (model.isLocked && ['edit', 'unpublish', 'delete'].includes(action)) return '被有效订阅锁定'
  if (action === 'publish' && model.state !== 'draft') return '只有未发布模型可发布'
  if (action === 'publish' && usedPublish >= publishLimit) return '发布额度已满'
  if (action === 'unpublish' && model.state !== 'published') return '未发布模型无需取消'
  if (action === 'edit' && model.state === 'published') return '已发布模型先取消发布'
  return ''
}
