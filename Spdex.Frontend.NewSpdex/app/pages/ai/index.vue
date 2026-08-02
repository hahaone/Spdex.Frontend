<script setup lang="ts">
import {
  Activity,
  Bookmark,
  Bot,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  CircleHelp,
  Clock3,
  ListChecks,
  Play,
  Plus,
  Search,
  Send,
  Share2,
  ShieldAlert,
  Trash2,
  X,
} from '@lucide/vue'
import type {
  AiAnswerFeedbackResponse,
  AiAnswerFeedbackType,
  AiAgentAutomationTaskListResponse,
  AiAgentAutomationTaskMutationResponse,
  AiAgentAutomationTaskRecord,
  AiAgentAutomationRunListResponse,
  AiAgentAutomationRunPreflightResponse,
  AiAgentAutomationRunRecord,
  AiAgentHistoryListResponse,
  AiAgentHistoryMutationResponse,
  AiAgentHistoryRecord,
  AiAgentHistoryUsageResponse,
  AiAgentHistoryUsageSummary,
  AiAgentTurnResponse,
  AiAgentWorkflowListResponse,
  AiAgentWorkflowMutationResponse,
  AiAgentWorkflowRecord,
  AiAgentWorkflowStep,
  GoodSampleMatchChoice,
  GoodSampleResponse,
} from '~/types/good-sample'
import type { MatchSummary } from '~/types/match'

type Preset = 'today_hot' | 'search' | 'snapshot' | 'trend' | 'anomaly' | 'metric'
type FeedbackSendState = 'idle' | 'sending' | 'sent' | 'failed'
type TurnStatus = 'pending' | 'complete' | 'failed' | 'cancelled'
type AutomationTriggerType = 'scheduled' | 'match_status' | 'watch_condition'
type AutomationCadence = 'daily' | 'hourly' | 'before_kickoff' | 'live_window' | 'on_signal'
type AutomationScope = 'daily_watchlist' | 'selected_match' | 'ask_each_run'

interface ScenarioTemplate {
  id: string
  title: string
  audience: string
  question: string
  preset: Preset
  requiresMatch?: boolean
  market?: string
  interval?: string
  metricKey?: string
  badges: string[]
}

interface TurnFeedbackState {
  selected: AiAnswerFeedbackType | ''
  sendState: FeedbackSendState
  panelOpen: boolean
  issueTags: string[]
  commentText: string
  message: string
}

interface AnalysisTurn {
  id: string
  answerId: string
  question: string
  preset: Preset
  match: GoodSampleMatchChoice | null
  status: TurnStatus
  startedAt: number
  completedAt?: number
  errorMessage?: string
  response?: GoodSampleResponse
  agentResponse?: AiAgentTurnResponse
  market?: string
  interval?: string
  metricKey?: string
  feedback: TurnFeedbackState
}

interface WorkflowRunOutcome {
  success: boolean
  completed: number
  total: number
  toolUsageUnits: number
  durationMs: number
  traceId: string
}

const route = useRoute()
const router = useRouter()
const presets: Array<{ value: Preset, label: string, icon: typeof Bot }> = [
  { value: 'today_hot', label: '今日重点赛事', icon: CalendarDays },
  { value: 'search', label: '搜索赛事', icon: Search },
  { value: 'snapshot', label: '单场数据快照', icon: Bot },
  { value: 'trend', label: '盘口走势', icon: ChartNoAxesCombined },
  { value: 'anomaly', label: '异常证据', icon: ShieldAlert },
  { value: 'metric', label: '指标解释', icon: CircleHelp },
]
const scenarioTemplates: ScenarioTemplate[] = [
  {
    id: 'watchlist',
    title: '今日观察列表',
    audience: '先筛比赛',
    preset: 'today_hot',
    question: '请生成今天值得先看的比赛观察列表，按关注度说明原因，并给出每场后续适合追问什么。',
    badges: ['排行', '简报'],
  },
  {
    id: 'single-diagnosis',
    title: '单场诊断',
    audience: '先看全貌',
    preset: 'snapshot',
    requiresMatch: true,
    question: '请按单场分析工作流分析这场比赛：先给直接结论，再说明盘口、成交、异常、数据边界和下一步追问。',
    badges: ['快照', '工作流'],
  },
  {
    id: 'trade-flow',
    title: '成交深挖',
    audience: '看量价时序',
    preset: 'trend',
    requiresMatch: true,
    market: 'trade_volume',
    interval: '15m',
    question: '能否查看这场更详细的成交量时间分布？请说明峰值时间、主要方向和是否连续放大。',
    badges: ['时序', '买卖流'],
  },
  {
    id: 'big-trade-check',
    title: '大额复核',
    audience: '排除噪声',
    preset: 'anomaly',
    requiresMatch: true,
    question: '这场有没有明显大额交易？请区分单笔噪声和连续成交，并说明是否与盘口变化同步。',
    badges: ['大单', '异常'],
  },
  {
    id: 'external-divergence',
    title: '外部背离',
    audience: '跨市场对照',
    preset: 'snapshot',
    requiresMatch: true,
    question: '请比较这场的 SPdex 标盘和 Poly/Kalshi 外部预测市场，说明是否存在背离、流动性限制和数据边界。',
    badges: ['预测市场', '背离'],
  },
  {
    id: 'mcp-plan',
    title: 'MCP 分析路径',
    audience: '高级用法',
    preset: 'snapshot',
    requiresMatch: true,
    question: '如果我用 SPdex MCP 做这场的赛前复盘，应该按什么工具顺序查？请给出步骤、每步目的和可继续追问方向。',
    badges: ['MCP', '路径'],
  },
]
const feedbackIssueOptions = [
  { value: 'wrong_data', label: '数据不准确' },
  { value: 'missing_critical_context', label: '缺少关键背景' },
  { value: 'ranking_issue', label: '排序不合理' },
  { value: 'threshold_issue', label: '阈值需校准' },
  { value: 'field_name_issue', label: '字段不清楚' },
  { value: 'prediction_market_gap', label: '背离解释不足' },
  { value: 'unclear_wording', label: '表达看不懂' },
]
const automationTriggerOptions: Array<{ value: AutomationTriggerType, label: string, description: string }> = [
  { value: 'scheduled', label: '定时运行', description: '适合每日观察列表、固定时间复盘。' },
  { value: 'match_status', label: '比赛阶段', description: '适合开赛前或赛中窗口复查。' },
  { value: 'watch_condition', label: '信号触发', description: '适合配合观察条件，等出现信号后再跑。' },
]
const automationCadenceOptions: Record<AutomationTriggerType, Array<{ value: AutomationCadence, label: string }>> = {
  scheduled: [
    { value: 'daily', label: '每天一次' },
    { value: 'hourly', label: '每小时一次' },
  ],
  match_status: [
    { value: 'before_kickoff', label: '开赛前复查' },
    { value: 'live_window', label: '赛中窗口复查' },
  ],
  watch_condition: [
    { value: 'on_signal', label: '出现信号时' },
  ],
}
const automationScopeOptions: Array<{ value: AutomationScope, label: string }> = [
  { value: 'daily_watchlist', label: '每日重点赛事' },
  { value: 'selected_match', label: '当前选中比赛' },
  { value: 'ask_each_run', label: '试跑时选择比赛' },
]

const routePreset = String(route.query.preset || '')
const selected = ref<Preset>(presets.some(item => item.value === routePreset) ? routePreset as Preset : 'today_hot')
const loading = ref(false)
const errorMessage = ref('')
const followUp = ref('')
const turns = ref<AnalysisTurn[]>([])
const historyItems = ref<AiAgentHistoryRecord[]>([])
const historyPending = ref(false)
const historySavedOnly = ref(false)
const historyMessage = ref('')
const usageSummary = ref<AiAgentHistoryUsageSummary | null>(null)
const workflowItems = ref<AiAgentWorkflowRecord[]>([])
const workflowPending = ref(false)
const workflowMessage = ref('')
const workflowDraftOpen = ref(false)
const workflowDraftName = ref('')
const workflowDraftDescription = ref('')
const workflowSaving = ref(false)
const workflowRunningId = ref('')
const workflowRunningStep = ref(0)
const pendingWorkflow = ref<AiAgentWorkflowRecord | null>(null)
const automationItems = ref<AiAgentAutomationTaskRecord[]>([])
const automationPending = ref(false)
const automationMessage = ref('')
const automationDraftOpen = ref(false)
const automationSaving = ref(false)
const automationRunningId = ref('')
const automationRuns = ref<AiAgentAutomationRunRecord[]>([])
const automationRunsPending = ref(false)
const automationDraft = reactive({
  name: '',
  description: '',
  workflowId: '',
  enabled: false,
  triggerType: 'scheduled' as AutomationTriggerType,
  cadence: 'daily' as AutomationCadence,
  scope: 'daily_watchlist' as AutomationScope,
  dailyRunLimit: '3',
  monthlyUnitBudget: '300',
  notifyInApp: true,
  notifyEmail: false,
  notifyWebhook: false,
})
const selectorOpen = ref(false)
const selectorQuery = ref('')
const saveState = ref('')
const shareState = ref('')
const chatStream = ref<HTMLElement | null>(null)
const chatEnd = ref<HTMLElement | null>(null)
const activeRequestController = shallowRef<AbortController | null>(null)
const elapsedSeconds = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null

const routeMatchId = Number(route.query.matchId)
const selectedMatch = ref<GoodSampleMatchChoice | null>(
  Number.isFinite(routeMatchId) && routeMatchId > 0
    ? {
        matchId: routeMatchId,
        homeTeam: String(route.query.home || '主队'),
        awayTeam: String(route.query.away || '客队'),
        leagueName: String(route.query.league || ''),
        matchTime: String(route.query.matchTime || ''),
      }
    : null,
)

const form = reactive({
  matchId: Number.isFinite(routeMatchId) && routeMatchId > 0 ? String(routeMatchId) : '',
  date: /^\d{4}-\d{2}-\d{2}$/.test(String(route.query.date || ''))
    ? String(route.query.date)
    : new Date().toISOString().slice(0, 10),
  query: '',
  market: 'trade_volume',
  interval: '15m',
  metricKey: 'trade_volume',
})

const needsMatch = computed(() => ['snapshot', 'trend', 'anomaly'].includes(selected.value))
const latestTurn = computed(() => [...turns.value].reverse().find(turn => turn.status === 'complete') ?? null)
const completedTurns = computed(() => turns.value.filter(turn => turn.status === 'complete'))
const selectedLabel = computed(() => presets.find(item => item.value === selected.value)?.label || '数据分析')
const contextSummary = computed(() => {
  if (selectedMatch.value) {
    return `${selectedMatch.value.leagueName || '赛事'} · ${selectedMatch.value.homeTeam} vs ${selectedMatch.value.awayTeam}`
  }
  if (selected.value === 'today_hot') return `${form.date} · 重点赛事观察`
  if (selected.value === 'search') return form.query.trim() ? `搜索：${form.query.trim()}` : '按球队、联赛或比赛 ID 搜索'
  if (selected.value === 'trend') return `${marketLabel(form.market)} · ${intervalLabel(form.interval)}`
  if (selected.value === 'metric') return metricLabel(form.metricKey)
  return '请选择一场比赛'
})
const canSubmit = computed(() => !loading.value && Boolean(followUp.value.trim()))
const canSaveWorkflow = computed(() => !loading.value && completedTurns.value.length > 0 && !workflowSaving.value)
const workflowDraftSteps = computed(() => buildWorkflowSteps())
const workflowSaveHint = computed(() => {
  const count = workflowDraftSteps.value.length
  if (!count) return '完成一次分析后，可以把连续提问保存为可复用流程。'
  return `将保存最近 ${count} 个已完成问题，之后可对其他比赛一键复用。`
})
const automationCadenceChoices = computed(() => automationCadenceOptions[automationDraft.triggerType] ?? automationCadenceOptions.scheduled)
const selectedAutomationWorkflow = computed(() => workflowItems.value.find(item => item.workflowId === automationDraft.workflowId) ?? null)
const canSaveAutomationTask = computed(() => Boolean(
  automationDraft.name.trim()
  && automationDraft.workflowId
  && !automationSaving.value,
))
const composerPlaceholder = computed(() => selectedMatch.value
  ? `继续问 ${selectedMatch.value.homeTeam} vs ${selectedMatch.value.awayTeam}`
  : '直接提问今天的重点比赛、成交放大、异常信号或指标含义')
const loadingStage = computed(() => {
  const seconds = elapsedSeconds.value
  if (seconds < 2) return '正在理解问题'
  if (seconds < 8) return '正在查询 SPdex 数据'
  if (seconds < 18) return '正在组织证据'
  if (seconds < 45) return '模型正在生成回答'
  return '仍在等待模型返回'
})
const loadingSteps = computed(() => {
  const current = elapsedSeconds.value
  return [
    { label: '理解问题', done: current >= 1 },
    { label: '读取比赛上下文', done: current >= 4 },
    { label: '调用分析工具', done: current >= 8 },
    { label: '整理结论', done: current >= 14 },
  ]
})
const matchFilters = computed(() => ({
  date: form.date,
  league: 'all',
  status: 'all' as const,
  page: 1,
  pageSize: 50,
}))
const { items: availableMatches, pending: matchesPending } = useMatchList(matchFilters)
const filteredMatches = computed(() => {
  const query = selectorQuery.value.trim().toLocaleLowerCase()
  const matches = query
    ? availableMatches.value.filter((match) => {
        const haystack = `${match.eventId} ${match.homeTeam} ${match.awayTeam} ${match.leagueName} ${match.leagueCode}`.toLocaleLowerCase()
        return haystack.includes(query)
      })
    : availableMatches.value
  return matches.slice(0, 12)
})
watch(() => automationDraft.triggerType, (value) => {
  const choices = automationCadenceOptions[value] ?? automationCadenceOptions.scheduled
  if (!choices.some(choice => choice.value === automationDraft.cadence)) {
    automationDraft.cadence = choices[0]?.value ?? 'daily'
  }
})
const suggestions = computed(() => {
  const agentFollowups = latestTurn.value?.agentResponse?.answer?.followups ?? []
  if (agentFollowups.length) return agentFollowups.slice(0, 4)
  return selectedMatch.value
    ? [
      '这场比赛的数据概览',
      '最近的成交量走势如何？',
      '这场比赛有没有明显的大额交易？',
      '这场比赛有什么异常信号？',
      '胜平负赔率是什么意思？',
    ]
    : [
      '今天有哪些重点比赛？',
      '成交量是什么意思？',
    ]
})

watch(availableMatches, (matches) => {
  if (!selectedMatch.value && form.matchId) {
    const match = matches.find(item => item.eventId === Number(form.matchId))
    if (match) selectLocalMatch(match, false)
  }
})

watch(selected, (preset) => {
  errorMessage.value = ''
  router.replace({
    query: {
      ...route.query,
      preset,
    },
  })
}, { flush: 'sync' })

watch(historySavedOnly, () => {
  loadAgentHistory()
})

async function execute(preset: Preset | 'follow_up', question?: string) {
  if (['snapshot', 'trend', 'anomaly'].includes(preset) && !selectedMatch.value) {
    selectorOpen.value = true
    errorMessage.value = '请先选择一场比赛'
    return
  }

  const requestMatch = selectedMatch.value ? { ...selectedMatch.value } : null
  const requestPreset = preset === 'follow_up' ? selected.value : preset
  const questionText = question || defaultQuestionForPreset(requestPreset, requestMatch)
  await executeAgentTurn(questionText, requestPreset, requestMatch)
}

async function applyScenario(template: ScenarioTemplate) {
  if (loading.value) return
  selected.value = template.preset
  errorMessage.value = ''
  if (template.market) form.market = template.market
  if (template.interval) form.interval = template.interval
  if (template.metricKey) form.metricKey = template.metricKey

  followUp.value = template.question
  if (template.requiresMatch && !selectedMatch.value) {
    selectorOpen.value = true
    errorMessage.value = '请先选择一场比赛，问题已放入输入框。'
    await nextTick()
    scrollToChatEnd('smooth')
    return
  }

  await submitFollowUp(template.question)
}

async function submitFollowUp(question?: string) {
  if (loading.value) return
  const value = (question || followUp.value).trim()
  if (!value) return
  followUp.value = ''

  const requestMatch = selectedMatch.value ? { ...selectedMatch.value } : null
  await executeAgentTurn(value, selected.value, requestMatch)
}

async function executeAgentTurn(
  questionText: string,
  requestPreset: Preset,
  requestMatch: GoodSampleMatchChoice | null,
) {
  if (loading.value) return false

  const previousTraceId = latestTurn.value?.answerId ?? null
  const pendingTurn = createPendingTurn(questionText, requestPreset, requestMatch)
  turns.value = [...turns.value, pendingTurn]
  beginLoading()
  errorMessage.value = ''
  saveState.value = ''
  shareState.value = ''
  await nextTick()
  scrollToChatEnd('smooth')

  const controller = new AbortController()
  activeRequestController.value = controller
  try {
    const response = await $apiFetch<AiAgentTurnResponse>('/api/newspdex/ai/agent/turn', {
      method: 'POST',
      timeout: 170_000,
      signal: controller.signal,
      body: {
        question: questionText,
        matchId: requestMatch?.matchId ?? null,
        preset: requestPreset,
        date: form.date,
        market: form.market,
        interval: form.interval,
        clientTraceId: previousTraceId,
        context: {
          source: 'newspdex_ai',
          match: requestMatch,
        },
        history: turns.value
          .filter(turn => turn.status === 'complete')
          .slice(-4)
          .flatMap(turn => [
            {
              role: 'user',
              content: turn.question,
            },
            {
              role: 'assistant',
              content: turn.agentResponse?.answer?.directAnswer
                || (turn.response?.success
                  ? turnDisplayName(turn)
                  : ''),
            },
          ])
          .filter(item => item.content),
      },
    })
    if (!response.success || !response.answer) {
      throw new Error(response.message || response.error || 'AI Agent 未返回有效回答')
    }

    completeAgentTurn(pendingTurn.id, response)
    await refreshAgentRecords()
    await nextTick()
    scrollToChatEnd('smooth')
    return true
  }
  catch (error: unknown) {
    const aborted = controller.signal.aborted || (error as { name?: string })?.name === 'AbortError'
    failTurn(
      pendingTurn.id,
      aborted ? '已取消本次分析。' : errorText(error, 'AI Agent 暂时没有返回有效回答，请稍后重试。'),
      aborted ? 'cancelled' : 'failed',
    )
    errorMessage.value = aborted ? '' : errorText(error, '分析请求失败')
    await nextTick()
    scrollToChatEnd('smooth')
    return false
  }
  finally {
    if (activeRequestController.value === controller) {
      activeRequestController.value = null
    }
    finishLoading()
  }
}

function selectLocalMatch(match: MatchSummary, switchPreset = true) {
  selectMatch({
    matchId: match.eventId,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    leagueName: match.leagueName || match.leagueCode,
    matchTime: match.matchTime,
  }, switchPreset)
}

function selectMatch(match: GoodSampleMatchChoice, switchPreset = true) {
  selectedMatch.value = match
  form.matchId = String(match.matchId)
  selectorOpen.value = false
  if (pendingWorkflow.value) {
    workflowMessage.value = `已选择比赛，可运行「${pendingWorkflow.value.name}」`
  }
  if (switchPreset) selected.value = 'snapshot'
  router.replace({
    query: {
      ...route.query,
      preset: switchPreset ? 'snapshot' : selected.value,
      matchId: String(match.matchId),
      home: match.homeTeam,
      away: match.awayTeam,
      league: match.leagueName || undefined,
      matchTime: match.matchTime || undefined,
      date: form.date,
    },
  })
}

async function analyzeMatch(match: GoodSampleMatchChoice) {
  if (loading.value) return
  selectMatch(match)
  await nextTick()
  await execute('snapshot', `${match.homeTeam} vs ${match.awayTeam} 数据快照`)
}

function clearMatch() {
  selectedMatch.value = null
  form.matchId = ''
  router.replace({
    query: {
      preset: selected.value,
      date: form.date,
    },
  })
}

async function refreshAgentRecords() {
  await Promise.allSettled([loadAgentHistory(), loadAgentUsage()])
}

async function refreshAgentLibrary() {
  await Promise.allSettled([
    refreshAgentRecords(),
    loadAgentWorkflows(),
    loadAgentAutomationTasks(),
    loadAgentAutomationRuns(),
  ])
}

async function loadAgentHistory() {
  historyPending.value = true
  historyMessage.value = ''
  try {
    const query = new URLSearchParams({
      limit: '30',
      savedOnly: String(historySavedOnly.value),
    })
    const response = await $apiFetch<AiAgentHistoryListResponse>(`/api/newspdex/ai/agent/history?${query.toString()}`)
    historyItems.value = response.items ?? []
  }
  catch {
    historyMessage.value = '分析记录暂时无法读取'
  }
  finally {
    historyPending.value = false
  }
}

async function loadAgentUsage() {
  try {
    const response = await $apiFetch<AiAgentHistoryUsageResponse>('/api/newspdex/ai/agent/usage/me?days=30')
    usageSummary.value = response.summary
  }
  catch {
    usageSummary.value = null
  }
}

async function loadAgentWorkflows() {
  workflowPending.value = true
  workflowMessage.value = ''
  try {
    const response = await $apiFetch<AiAgentWorkflowListResponse>('/api/newspdex/ai/agent/workflows?limit=30')
    workflowItems.value = response.items ?? []
    if (!automationDraft.workflowId && workflowItems.value.length) {
      automationDraft.workflowId = workflowItems.value[0]!.workflowId
    }
  }
  catch {
    workflowMessage.value = '流程库暂时无法读取'
  }
  finally {
    workflowPending.value = false
  }
}

async function loadAgentAutomationTasks() {
  automationPending.value = true
  automationMessage.value = ''
  try {
    const response = await $apiFetch<AiAgentAutomationTaskListResponse>('/api/newspdex/ai/agent/automation-tasks?limit=30')
    automationItems.value = response.items ?? []
  }
  catch {
    automationMessage.value = '自动化任务暂时无法读取'
  }
  finally {
    automationPending.value = false
  }
}

async function loadAgentAutomationRuns() {
  automationRunsPending.value = true
  try {
    const response = await $apiFetch<AiAgentAutomationRunListResponse>('/api/newspdex/ai/agent/automation-tasks/runs?limit=30')
    automationRuns.value = response.items ?? []
  }
  catch {
    automationRuns.value = []
  }
  finally {
    automationRunsPending.value = false
  }
}

async function saveLatest() {
  const latest = latestTurn.value
  if (!latest) return
  const match = latest.match ?? selectedMatch.value
  const title = match
    ? `${match.homeTeam} vs ${match.awayTeam} · ${latest.question}`
    : latest.question
  const traceId = turnTraceId(latest)
  if (!traceId) {
    saveState.value = '暂无可保存记录'
    return
  }
  saveState.value = '保存中'
  try {
    await $apiFetch<AiAgentHistoryMutationResponse>('/api/newspdex/ai/agent/history/save', {
      method: 'POST',
      body: {
        traceId,
        title,
        saved: true,
      },
    })
    saveState.value = '已保存'
    await loadAgentHistory()
  }
  catch {
    saveState.value = '保存失败'
  }
}

function openWorkflowDraft() {
  if (!completedTurns.value.length) {
    workflowMessage.value = '先完成至少一次分析，再保存为流程'
    return
  }
  workflowDraftOpen.value = true
  workflowMessage.value = ''
  if (!workflowDraftName.value.trim()) {
    workflowDraftName.value = suggestedWorkflowName()
  }
  if (!workflowDraftDescription.value.trim()) {
    workflowDraftDescription.value = '按当前对话顺序复用这组分析问题。'
  }
}

function closeWorkflowDraft() {
  if (workflowSaving.value) return
  workflowDraftOpen.value = false
}

async function saveCurrentWorkflow() {
  if (!canSaveWorkflow.value) return
  const steps = buildWorkflowSteps()
  if (!steps.length) {
    workflowMessage.value = '当前对话没有可保存的分析步骤'
    return
  }

  workflowSaving.value = true
  workflowMessage.value = '保存流程中'
  try {
    const response = await $apiFetch<AiAgentWorkflowMutationResponse>('/api/newspdex/ai/agent/workflows', {
      method: 'POST',
      body: {
        name: workflowDraftName.value.trim() || suggestedWorkflowName(),
        description: workflowDraftDescription.value.trim() || null,
        matchRequired: steps.some(step => step.requiresMatch),
        steps,
      },
    })
    workflowItems.value = [
      response.item,
      ...workflowItems.value.filter(item => item.workflowId !== response.item.workflowId),
    ].slice(0, 30)
    workflowDraftOpen.value = false
    workflowDraftName.value = ''
    workflowDraftDescription.value = ''
    workflowMessage.value = '流程已保存'
  }
  catch {
    workflowMessage.value = '流程保存失败，请稍后重试'
  }
  finally {
    workflowSaving.value = false
  }
}

function openAutomationDraft(workflow?: AiAgentWorkflowRecord) {
  if (!workflowItems.value.length && !workflow) {
    automationMessage.value = '请先保存一个分析流程，再创建自动化任务'
    return
  }

  const targetWorkflow = workflow ?? selectedAutomationWorkflow.value ?? workflowItems.value[0] ?? null
  automationDraft.workflowId = targetWorkflow?.workflowId ?? ''
  automationDraft.name = targetWorkflow ? `${targetWorkflow.name}自动任务` : ''
  automationDraft.description = targetWorkflow?.description || '按设定规则运行这套分析流程。'
  automationDraft.enabled = false
  automationDraft.triggerType = targetWorkflow?.matchRequired ? 'match_status' : 'scheduled'
  automationDraft.cadence = targetWorkflow?.matchRequired ? 'before_kickoff' : 'daily'
  automationDraft.scope = targetWorkflow?.matchRequired
    ? selectedMatch.value ? 'selected_match' : 'ask_each_run'
    : 'daily_watchlist'
  automationDraft.dailyRunLimit = targetWorkflow?.matchRequired ? '6' : '3'
  automationDraft.monthlyUnitBudget = targetWorkflow?.matchRequired ? '500' : '300'
  automationDraft.notifyInApp = true
  automationDraft.notifyEmail = false
  automationDraft.notifyWebhook = false
  automationDraftOpen.value = true
  automationMessage.value = ''
}

async function saveAutomationTask() {
  if (!canSaveAutomationTask.value) return
  if (automationDraft.scope === 'selected_match' && !selectedMatch.value) {
    selectorOpen.value = true
    automationMessage.value = '请先选择一场比赛，再保存固定比赛任务'
    return
  }

  automationSaving.value = true
  automationMessage.value = '保存自动化任务中'
  try {
    const notifyChannels = [
      automationDraft.notifyInApp ? 'in_app' : '',
      automationDraft.notifyEmail ? 'email' : '',
      automationDraft.notifyWebhook ? 'webhook' : '',
    ].filter(Boolean)
    const response = await $apiFetch<AiAgentAutomationTaskMutationResponse>('/api/newspdex/ai/agent/automation-tasks', {
      method: 'POST',
      body: {
        name: automationDraft.name.trim(),
        description: automationDraft.description.trim() || null,
        workflowId: automationDraft.workflowId,
        enabled: automationDraft.enabled,
        triggerType: automationDraft.triggerType,
        cadence: automationDraft.cadence,
        scope: automationDraft.scope,
        matchId: automationDraft.scope === 'selected_match' ? selectedMatch.value?.matchId ?? null : null,
        matchTitle: automationDraft.scope === 'selected_match' && selectedMatch.value
          ? `${selectedMatch.value.homeTeam} vs ${selectedMatch.value.awayTeam}`
          : null,
        dailyRunLimit: parsePositiveInt(automationDraft.dailyRunLimit, 3),
        monthlyUnitBudget: parsePositiveInt(automationDraft.monthlyUnitBudget, 0) || null,
        notifyChannels,
      },
    })
    automationItems.value = [
      response.item,
      ...automationItems.value.filter(item => item.taskId !== response.item.taskId),
    ].slice(0, 30)
    automationDraftOpen.value = false
    automationMessage.value = response.item.enabled
      ? '自动化任务已创建，后台调度将在测试开关打开后接管'
      : '自动化任务已保存，可先手动试跑'
  }
  catch {
    automationMessage.value = '自动化任务保存失败，请稍后重试'
  }
  finally {
    automationSaving.value = false
  }
}

async function toggleAutomationTask(task: AiAgentAutomationTaskRecord) {
  try {
    const response = await $apiFetch<AiAgentAutomationTaskMutationResponse>(`/api/newspdex/ai/agent/automation-tasks/${encodeURIComponent(task.taskId)}/enabled`, {
      method: 'POST',
      body: {
        enabled: !task.enabled,
      },
    })
    upsertAutomationTask(response.item)
    automationMessage.value = response.item.enabled ? '任务已启用' : '任务已暂停'
  }
  catch {
    automationMessage.value = '任务状态更新失败'
  }
}

async function runAutomationTask(task: AiAgentAutomationTaskRecord) {
  if (loading.value || automationRunningId.value) return
  const workflow = workflowItems.value.find(item => item.workflowId === task.workflowId)
  if (!workflow) {
    automationMessage.value = '关联流程不存在，请重新选择流程'
    return
  }
  const budget = automationBudgetState(task)
  if (budget.exhausted) {
    automationMessage.value = `本月预算已用完：${task.name}`
    return
  }
  const preflight = await preflightAutomationTask(task, workflow)
  if (!preflight) return

  const previousMatch = selectedMatch.value
  if (task.scope === 'selected_match' && task.matchId) {
    selectedMatch.value = automationMatchChoice(task)
  }

  automationRunningId.value = task.taskId
  automationMessage.value = `正在试跑「${task.name}」`
  const outcome = await runWorkflow(workflow)
  try {
    const response = await $apiFetch<AiAgentAutomationTaskMutationResponse>(`/api/newspdex/ai/agent/automation-tasks/${encodeURIComponent(task.taskId)}/run`, {
      method: 'POST',
      body: {
        status: outcome.success ? 'success' : 'partial',
        triggerSource: 'manual',
        stepCount: outcome.total,
        completedStepCount: outcome.completed,
        toolUsageUnits: outcome.toolUsageUnits,
        durationMs: outcome.durationMs,
        traceId: outcome.traceId || null,
      },
    })
    upsertAutomationTask(response.item)
    await loadAgentAutomationRuns()
  }
  catch {
    // 统计回写失败不阻断用户查看试跑结果。
  }
  finally {
    if (task.scope === 'selected_match' && previousMatch?.matchId !== selectedMatch.value?.matchId) {
      selectedMatch.value = previousMatch
    }
    automationRunningId.value = ''
    automationMessage.value = outcome.success ? `试跑完成：${task.name}` : `试跑未完整完成：${task.name}`
  }
}

async function preflightAutomationTask(task: AiAgentAutomationTaskRecord, workflow: AiAgentWorkflowRecord) {
  automationMessage.value = `正在检查「${task.name}」的运行额度`
  try {
    const response = await $apiFetch<AiAgentAutomationRunPreflightResponse>(`/api/newspdex/ai/agent/automation-tasks/${encodeURIComponent(task.taskId)}/preflight`, {
      method: 'POST',
      body: {
        triggerSource: 'manual',
        estimatedStepCount: workflow.steps.length,
        estimatedToolUsageUnits: estimateWorkflowToolUnits(workflow),
      },
    })
    if (!response.item.allowed) {
      automationMessage.value = response.item.message || `当前不能试跑「${task.name}」`
      await loadAgentAutomationRuns()
      return false
    }
    return true
  }
  catch {
    automationMessage.value = '自动化任务额度检查失败，请稍后重试'
    return false
  }
}

async function deleteAutomationTask(taskId: string) {
  try {
    await $apiFetch<AiAgentAutomationTaskMutationResponse>(`/api/newspdex/ai/agent/automation-tasks/${encodeURIComponent(taskId)}`, {
      method: 'DELETE',
    })
    automationItems.value = automationItems.value.filter(item => item.taskId !== taskId)
    automationMessage.value = '自动化任务已删除'
  }
  catch {
    automationMessage.value = '自动化任务删除失败'
  }
}

function upsertAutomationTask(task: AiAgentAutomationTaskRecord) {
  automationItems.value = [
    task,
    ...automationItems.value.filter(item => item.taskId !== task.taskId),
  ].slice(0, 30)
}

async function runWorkflow(workflow: AiAgentWorkflowRecord): Promise<WorkflowRunOutcome> {
  const startedAt = Date.now()
  const turnStartIndex = turns.value.length
  const emptyOutcome = (completed = 0): WorkflowRunOutcome => ({
    success: false,
    completed,
    total: workflow.steps.length,
    toolUsageUnits: workflowRunToolUnits(turnStartIndex),
    durationMs: Date.now() - startedAt,
    traceId: latestTurn.value ? turnTraceId(latestTurn.value) : '',
  })
  if (loading.value || workflowRunningId.value) return emptyOutcome()
  if (!workflow.steps.length) {
    workflowMessage.value = '这个流程没有可运行的步骤'
    return emptyOutcome()
  }
  if (workflow.matchRequired && !selectedMatch.value) {
    pendingWorkflow.value = workflow
    selected.value = normalizePreset(workflow.steps[0]?.preset) ?? 'snapshot'
    selectorOpen.value = true
    workflowMessage.value = `请先选择比赛，再运行「${workflow.name}」`
    return emptyOutcome()
  }

  workflowRunningId.value = workflow.workflowId
  workflowRunningStep.value = 0
  workflowMessage.value = `正在运行「${workflow.name}」`
  pendingWorkflow.value = null
  try {
    await $apiFetch<AiAgentWorkflowMutationResponse>(`/api/newspdex/ai/agent/workflows/${encodeURIComponent(workflow.workflowId)}/run`, {
      method: 'POST',
    })
  }
  catch {
    // 运行计数失败不阻断用户分析流程。
  }

  let completed = 0
  try {
    for (const [index, step] of workflow.steps.entries()) {
      workflowRunningStep.value = index + 1
      applyWorkflowStepConfig(step)
      const preset = normalizePreset(step.preset) ?? 'snapshot'
      const requestMatch = step.requiresMatch ? selectedMatch.value : null
      const ok = await executeAgentTurn(step.question, preset, requestMatch)
      if (!ok) break
      completed += 1
    }
    workflowMessage.value = completed === workflow.steps.length
      ? `流程已完成：${workflow.name}`
      : `流程已停止：已完成 ${completed}/${workflow.steps.length} 步`
    await loadAgentWorkflows()
    return {
      success: completed === workflow.steps.length,
      completed,
      total: workflow.steps.length,
      toolUsageUnits: workflowRunToolUnits(turnStartIndex),
      durationMs: Date.now() - startedAt,
      traceId: latestTurn.value ? turnTraceId(latestTurn.value) : '',
    }
  }
  finally {
    workflowRunningId.value = ''
    workflowRunningStep.value = 0
  }
}

async function deleteWorkflow(workflowId: string) {
  try {
    await $apiFetch<AiAgentWorkflowMutationResponse>(`/api/newspdex/ai/agent/workflows/${encodeURIComponent(workflowId)}`, {
      method: 'DELETE',
    })
    workflowItems.value = workflowItems.value.filter(item => item.workflowId !== workflowId)
    if (pendingWorkflow.value?.workflowId === workflowId) pendingWorkflow.value = null
    workflowMessage.value = '流程已删除'
  }
  catch {
    workflowMessage.value = '流程删除失败，请稍后重试'
  }
}

async function shareLatest() {
  const latest = latestTurn.value
  if (!latest) return
  const match = latest.match ?? selectedMatch.value
  const heading = match
    ? `${match.homeTeam} vs ${match.awayTeam}`
    : 'SPdex AI 观察助手'
  const text = buildShareText(heading, latest)
  try {
    if (navigator.share) {
      await navigator.share({ title: heading, text })
      shareState.value = '已分享'
      return
    }
    await navigator.clipboard.writeText(text)
    shareState.value = '已复制'
  }
  catch (error: unknown) {
    if ((error as { name?: string })?.name !== 'AbortError') shareState.value = '分享失败'
  }
}

function restoreHistory(item: AiAgentHistoryRecord) {
  const match = historyMatchChoice(item)
  selected.value = normalizePreset(item.preset) ?? 'snapshot'
  selectedMatch.value = match
  form.matchId = match ? String(match.matchId) : ''
  router.replace({
    query: {
      preset: selected.value,
      date: form.date,
      matchId: match ? String(match.matchId) : undefined,
      home: match?.homeTeam || undefined,
      away: match?.awayTeam || undefined,
      league: match?.leagueName || undefined,
      matchTime: match?.matchTime || undefined,
    },
  })
  turns.value.push({
    id: cryptoId(),
    answerId: `hist_${item.recordId}`,
    question: item.question,
    preset: selected.value,
    match,
    status: 'complete',
    startedAt: new Date(item.createdAtUtc).getTime() || Date.now(),
    completedAt: new Date(item.updatedAtUtc).getTime() || Date.now(),
    agentResponse: {
      success: Boolean(item.answer),
      answer: item.answer,
      traceId: item.traceId,
      provider: item.provider,
      model: item.model,
      toolCalls: item.toolCalls ?? [],
      usage: item.usage,
      generatedAtUtc: item.createdAtUtc,
    },
    feedback: createFeedbackState(),
  })
  nextTick(() => scrollToChatEnd('smooth'))
}

async function deleteHistory(recordId: string) {
  try {
    await $apiFetch<AiAgentHistoryMutationResponse>(`/api/newspdex/ai/agent/history/${encodeURIComponent(recordId)}`, {
      method: 'DELETE',
    })
    historyItems.value = historyItems.value.filter(item => item.recordId !== recordId)
    await loadAgentUsage()
  }
  catch {
    historyMessage.value = '删除失败，请稍后重试'
  }
}

function clearTurns() {
  cancelActiveRequest()
  turns.value = []
  errorMessage.value = ''
}

function createPendingTurn(
  questionText: string,
  requestPreset: Preset,
  requestMatch: GoodSampleMatchChoice | null,
): AnalysisTurn {
  return {
    id: cryptoId(),
    answerId: `ans_${cryptoId().replaceAll('-', '')}`,
    question: questionText,
    preset: requestPreset,
    match: requestMatch ? { ...requestMatch } : null,
    status: 'pending',
    startedAt: Date.now(),
    market: form.market,
    interval: form.interval,
    metricKey: form.metricKey,
    feedback: createFeedbackState(),
  }
}

function completeAgentTurn(turnId: string, response: AiAgentTurnResponse) {
  const completedAt = Date.now()
  turns.value = turns.value.map(turn => turn.id === turnId
    ? {
        ...turn,
        status: 'complete',
        completedAt,
        agentResponse: response,
        errorMessage: '',
      }
    : turn)
}

function failTurn(turnId: string, message: string, status: Extract<TurnStatus, 'failed' | 'cancelled'> = 'failed') {
  const completedAt = Date.now()
  turns.value = turns.value.map(turn => turn.id === turnId
    ? {
        ...turn,
        status,
        completedAt,
        errorMessage: message,
      }
    : turn)
}

function beginLoading() {
  finishLoading()
  loading.value = true
  elapsedSeconds.value = 0
  elapsedTimer = setInterval(() => {
    elapsedSeconds.value += 1
  }, 1000)
}

function finishLoading() {
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
  loading.value = false
}

function cancelActiveRequest() {
  activeRequestController.value?.abort()
}

function scrollToChatEnd(behavior: ScrollBehavior = 'auto') {
  const stream = chatStream.value
  if (stream) {
    stream.scrollTo({ top: stream.scrollHeight, behavior })
    return
  }
  chatEnd.value?.scrollIntoView({ behavior, block: 'end' })
}

function errorText(error: unknown, fallback: string) {
  const fetchError = error as {
    data?: { message?: string, error?: string, error_description?: string }
    message?: string
    name?: string
  }
  const message = fetchError.data?.message
    || fetchError.data?.error_description
    || fetchError.data?.error
    || fetchError.message
    || ''
  if (/timeout|timed out|aborted due to timeout/i.test(message)) {
    return 'AI 回答等待时间过长，请稍后重试，或把问题缩小到一场比赛。'
  }
  if (/network|fetch failed/i.test(message)) {
    return '网络请求没有完成，请检查连接后重试。'
  }
  return message || fallback
}

function defaultQuestionForPreset(preset: Preset, match: GoodSampleMatchChoice | null) {
  const matchTitle = match ? `${match.homeTeam} vs ${match.awayTeam}` : '当前比赛'
  const dateText = form.date || new Date().toISOString().slice(0, 10)
  const query = form.query.trim()
  switch (preset) {
    case 'today_hot':
      return `请分析 ${dateText} 的重点比赛，按关注度排序，并用用户能理解的方式说明每场为什么值得关注。`
    case 'search':
      return `请搜索 ${dateText} ${query || '相关'} 比赛，并说明哪些比赛更值得继续观察。`
    case 'snapshot':
      return `请给出 ${matchTitle} 的数据概览：先给一句直接结论，再说明关键指标、主要观察点和数据边界。`
    case 'trend':
      return `请分析 ${matchTitle} 的${marketLabel(form.market)}最近${intervalLabel(form.interval)}走势，说明成交或价格变化是否值得关注。`
    case 'anomaly':
      return `请判断 ${matchTitle} 是否有明显异常或大额交易信号：先给一句直接结论，再列关键依据和数据限制。`
    case 'metric':
      return `请解释${metricLabel(form.metricKey)}是什么意思，以及普通用户在 SPdex 里应该如何使用这个指标。`
  }
  return '请基于 SPdex 数据给出一段清晰的足球市场观察。'
}

function marketLabel(value: string) {
  const labels: Record<string, string> = {
    trade_volume: '成交量',
    match_odds: '胜平负',
    asian_handicap: '亚洲让球',
    over_under: '大小球',
  }
  return labels[value] || '市场'
}

function intervalLabel(value: string) {
  const labels: Record<string, string> = {
    '1m': '1 分钟',
    '5m': '5 分钟',
    '15m': '15 分钟',
    '1h': '1 小时',
  }
  return labels[value] || value
}

function metricLabel(value: string) {
  const labels: Record<string, string> = {
    trade_volume: '成交量',
    match_odds: '胜平负指数',
    asian_handicap: '亚洲指数',
    over_under: '大小球指数',
    implied_probability: '隐含概率',
  }
  return labels[value] || '指标'
}

function normalizePreset(value?: string | null): Preset | null {
  return presets.some(item => item.value === value) ? value as Preset : null
}

function historyMatchChoice(item: AiAgentHistoryRecord): GoodSampleMatchChoice | null {
  if (!item.matchId) return null
  const parts = (item.matchTitle || '').split(/\s+vs\s+/i)
  return {
    matchId: item.matchId,
    homeTeam: parts[0] || '主队',
    awayTeam: parts[1] || '客队',
    leagueName: item.leagueName || '',
    matchTime: item.matchTime || '',
  }
}

function suggestedWorkflowName() {
  const match = selectedMatch.value
  if (match) return `${match.homeTeam} vs ${match.awayTeam} 分析流程`
  const first = completedTurns.value[0]?.question || '我的分析流程'
  return first.length > 22 ? `${first.slice(0, 22)}...` : first
}

function buildWorkflowSteps(): AiAgentWorkflowStep[] {
  return completedTurns.value.slice(-6).map((turn, index) => {
    const preset = normalizePreset(turn.preset) ?? 'snapshot'
    const requiresMatch = Boolean(turn.match) || ['snapshot', 'trend', 'anomaly'].includes(preset)
    return {
      stepId: `step_${index + 1}`,
      title: workflowStepTitle(turn.question, index),
      question: turn.question,
      preset,
      market: turn.market || null,
      interval: turn.interval || null,
      metricKey: turn.metricKey || null,
      requiresMatch,
    }
  })
}

function workflowStepTitle(question: string, index: number) {
  const trimmed = question.replace(/\s+/g, ' ').trim()
  if (!trimmed) return `步骤 ${index + 1}`
  return trimmed.length > 22 ? `${trimmed.slice(0, 22)}...` : trimmed
}

function applyWorkflowStepConfig(step: AiAgentWorkflowStep) {
  selected.value = normalizePreset(step.preset) ?? 'snapshot'
  if (step.market) form.market = step.market
  if (step.interval) form.interval = step.interval
  if (step.metricKey) form.metricKey = step.metricKey
}

function workflowMetaText(workflow: AiAgentWorkflowRecord) {
  const parts = [`${workflow.steps.length} 步`]
  if (workflow.matchRequired) parts.push('需要比赛')
  if (workflow.runCount > 0) parts.push(`已运行 ${workflow.runCount} 次`)
  return parts.join(' · ')
}

function workflowRunText(workflow: AiAgentWorkflowRecord) {
  if (workflowRunningId.value !== workflow.workflowId) return '运行'
  const total = workflow.steps.length || 1
  return `第 ${workflowRunningStep.value || 1}/${total} 步`
}

function automationWorkflowName(task: AiAgentAutomationTaskRecord) {
  return workflowItems.value.find(workflow => workflow.workflowId === task.workflowId)?.name || '关联流程'
}

function automationMetaText(task: AiAgentAutomationTaskRecord) {
  const parts = [
    triggerLabel(task.triggerType),
    cadenceLabel(task.cadence),
    scopeLabel(task.scope),
  ]
  if (task.runCount > 0) parts.push(`已试跑 ${task.runCount} 次`)
  return parts.join(' · ')
}

function automationBudgetText(task: AiAgentAutomationTaskRecord) {
  const budget = automationBudgetState(task)
  const pieces = [`每日最多 ${task.dailyRunLimit} 次`]
  if (budget.hasBudget) {
    pieces.push(`本月 ${formatNumber(budget.used)} / ${formatNumber(budget.budget)} 单位`)
    pieces.push(`剩余 ${formatNumber(budget.remaining)} 单位`)
  }
  if (task.nextRunAtUtc) pieces.push(`预计 ${formatTime(task.nextRunAtUtc)}`)
  return pieces.join(' · ')
}

function automationBudgetState(task: AiAgentAutomationTaskRecord) {
  const budget = Math.max(0, task.monthlyUnitBudget ?? 0)
  const used = automationMonthUnits(task.taskId)
  const remaining = budget > 0 ? Math.max(0, budget - used) : 0
  const ratio = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0
  return {
    hasBudget: budget > 0,
    budget,
    used,
    remaining,
    ratio,
    warning: budget > 0 && used >= budget * 0.8 && used < budget,
    exhausted: budget > 0 && used >= budget,
  }
}

function automationMonthUnits(taskId: string) {
  const now = new Date()
  return automationRuns.value
    .filter(run => run.taskId === taskId && isSameMonth(run.createdAtUtc, now))
    .reduce((sum, run) => sum + Math.max(0, run.toolUsageUnits || 0), 0)
}

function isSameMonth(value: string, now: Date) {
  const date = new Date(value)
  return Number.isFinite(date.getTime())
    && date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
}

function recentAutomationRuns(taskId: string) {
  return automationRuns.value.filter(run => run.taskId === taskId).slice(0, 3)
}

function automationRunText(task: AiAgentAutomationTaskRecord) {
  return automationRunningId.value === task.taskId ? '试跑中' : '试跑'
}

function canRunAutomationTask(task: AiAgentAutomationTaskRecord) {
  return !loading.value && !automationRunningId.value && !automationBudgetState(task).exhausted
}

function runStatusLabel(value: string) {
  const values: Record<string, string> = {
    manual: '已记录',
    queued: '排队中',
    running: '运行中',
    success: '完成',
    partial: '部分完成',
    failed: '失败',
    skipped: '跳过',
  }
  return values[value] || '已记录'
}

function runSourceLabel(value: string) {
  const values: Record<string, string> = {
    manual: '手动试跑',
    scheduler: '定时调度',
    watch_condition: '信号触发',
    system: '系统',
  }
  return values[value] || '任务运行'
}

function runDurationText(value?: number | null) {
  if (!value || value <= 0) return ''
  if (value < 1000) return `${value}ms`
  return `${Math.round(value / 1000)}秒`
}

function triggerLabel(value: string) {
  const values: Record<string, string> = {
    scheduled: '定时运行',
    match_status: '比赛阶段',
    watch_condition: '信号触发',
  }
  return values[value] || '自动触发'
}

function cadenceLabel(value: string) {
  const values: Record<string, string> = {
    daily: '每天一次',
    hourly: '每小时一次',
    before_kickoff: '开赛前复查',
    live_window: '赛中窗口复查',
    on_signal: '出现信号时',
  }
  return values[value] || '按规则执行'
}

function scopeLabel(value: string) {
  const values: Record<string, string> = {
    daily_watchlist: '每日重点赛事',
    selected_match: '固定比赛',
    ask_each_run: '试跑时选择',
  }
  return values[value] || '自定义范围'
}

function notifyLabel(value: string) {
  const values: Record<string, string> = {
    in_app: '站内',
    email: '邮件',
    webhook: 'Webhook',
  }
  return values[value] || value
}

function automationMatchChoice(task: AiAgentAutomationTaskRecord): GoodSampleMatchChoice {
  const title = task.matchTitle || `比赛 ${task.matchId}`
  const [home = title, away = ''] = title.split(/\s+vs\s+/i)
  return {
    matchId: task.matchId ?? 0,
    homeTeam: home,
    awayTeam: away || '对手',
    leagueName: '自动化任务',
    matchTime: '',
  }
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function usageText(summary: AiAgentHistoryUsageSummary | null) {
  if (!summary) return '近 30 天暂无用量'
  return `近 30 天 ${summary.records} 次分析 · 工具计量 ${summary.toolUsageUnits} 单位 · 模型 ${formatNumber(summary.totalTokens)} tokens`
}

function turnUsageText(turn: AnalysisTurn) {
  const usage = turn.agentResponse?.usage
  const tokens = usage?.totalTokens ?? 0
  const toolUnits = turnToolUsageUnits(turn)
  const pieces = []
  if (toolUnits > 0) pieces.push(`工具计量 ${toolUnits} 单位`)
  if (tokens > 0) pieces.push(`模型 ${formatNumber(tokens)} tokens`)
  if (!pieces.length) return ''
  pieces.push('测试计量')
  return pieces.join(' · ')
}

function estimateToolUnits(response: AiAgentTurnResponse) {
  return (response.toolCalls ?? []).reduce((sum, call) => {
    if (call.status && call.status !== 'completed') return sum
    return sum + (toolUsageUnit(call.tool) ?? 0)
  }, 0)
}

function turnToolUsageUnits(turn: AnalysisTurn) {
  return turn.agentResponse ? estimateToolUnits(turn.agentResponse) : turn.response?.usage?.usageUnits ?? 0
}

function workflowRunToolUnits(startIndex: number) {
  return turns.value.slice(startIndex).reduce((sum, turn) => sum + turnToolUsageUnits(turn), 0)
}

function estimateWorkflowToolUnits(workflow: AiAgentWorkflowRecord) {
  return workflow.steps.reduce((sum, step) => sum + estimateStepToolUnits(step), 0)
}

function estimateStepToolUnits(step: AiAgentWorkflowStep) {
  const values: Record<string, number> = {
    today_hot: 1,
    search: 2,
    snapshot: 4,
    trend: 3,
    anomaly: 4,
    metric: 1,
  }
  return values[normalizePreset(step.preset) ?? 'snapshot'] ?? 2
}

function toolUsageUnit(tool: string) {
  const values: Record<string, number> = {
    get_top_matches: 1,
    search_matches: 2,
    get_match_snapshot: 1,
    list_match_market_capabilities: 2,
    get_market_series: 2,
    get_market_metric_series: 2,
    get_trade_flow: 3,
    get_big_trades: 2,
    get_market_depth: 3,
    get_hold_window_summary: 4,
    compare_market_windows: 4,
    get_extraction_signals: 4,
    detect_cross_market_resonance: 5,
    get_prediction_market_links: 6,
    get_prediction_market_snapshot: 5,
    compare_prediction_market_to_spdex: 6,
    get_live_market_monitor: 4,
    get_signal_feed: 7,
    explain_signal: 9,
    generate_match_brief: 7,
    generate_watchlist: 5,
    plan_agent_analysis: 2,
    run_match_analysis_workflow: 5,
    run_watchlist_workflow: 5,
    detect_market_anomalies: 3,
    explain_metric: 1,
  }
  return values[tool] ?? 0
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toLocaleString('zh-CN') : '0'
}

function turnStatusText(turn: AnalysisTurn) {
  if (turn.status === 'pending') return `${loadingStage.value} · ${elapsedSeconds.value} 秒`
  if (turn.status === 'cancelled') return '已取消'
  if (turn.status === 'failed') return '未完成'
  const seconds = turnElapsedSeconds(turn)
  return seconds > 0 ? `已完成 · ${seconds} 秒` : '已完成'
}

function turnElapsedSeconds(turn: AnalysisTurn) {
  const end = turn.completedAt ?? Date.now()
  return Math.max(0, Math.round((end - turn.startedAt) / 1000))
}

function cryptoId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createFeedbackState(): TurnFeedbackState {
  return {
    selected: '',
    sendState: 'idle',
    panelOpen: false,
    issueTags: [],
    commentText: '',
    message: '',
  }
}

function openFeedbackPanel(turn: AnalysisTurn, feedbackType: AiAnswerFeedbackType) {
  turn.feedback.selected = feedbackType
  turn.feedback.panelOpen = true
  turn.feedback.message = ''
}

function toggleFeedbackTag(turn: AnalysisTurn, tag: string) {
  const current = turn.feedback.issueTags
  turn.feedback.issueTags = current.includes(tag)
    ? current.filter(item => item !== tag)
    : [...current, tag]
}

async function submitFeedback(turn: AnalysisTurn, feedbackType: AiAnswerFeedbackType) {
  if (turn.feedback.sendState === 'sending' || turn.feedback.sendState === 'sent') return

  const tags = feedbackType === 'helpful' ? [] : turn.feedback.issueTags
  const comment = feedbackType === 'helpful' ? '' : turn.feedback.commentText.trim()
  if (feedbackType !== 'helpful' && !tags.length && !comment) {
    turn.feedback.selected = feedbackType
    turn.feedback.panelOpen = true
    turn.feedback.message = '请选择一个问题类型，或补充一句说明。'
    return
  }

  turn.feedback.selected = feedbackType
  turn.feedback.sendState = 'sending'
  turn.feedback.message = ''
  try {
    await $apiFetch<AiAnswerFeedbackResponse>('/api/newspdex/ai/feedback', {
      method: 'POST',
      body: {
        answerId: turn.answerId,
        traceId: turnTraceId(turn),
        feedbackType,
        issueTags: tags,
        commentText: comment,
        toolName: turnToolName(turn),
        preset: turn.preset,
        matchId: turn.match?.matchId ?? null,
        questionText: turn.question,
        clientType: 'newspdex_ai',
        pageUrl: route.fullPath,
        renderMode: turnRenderMode(turn),
      },
    })
    turn.feedback.sendState = 'sent'
    turn.feedback.panelOpen = feedbackType !== 'helpful'
    turn.feedback.message = feedbackType === 'helpful'
      ? '感谢反馈'
      : '已提交，我们会用于后续校准。'
  }
  catch (error: unknown) {
    const fetchError = error as {
      data?: { message?: string, error?: string, error_description?: string }
    }
    turn.feedback.sendState = 'failed'
    turn.feedback.message = fetchError.data?.message
      || fetchError.data?.error_description
      || fetchError.data?.error
      || '反馈提交失败'
  }
}

function presetForTool(tool: string): Preset {
  const values: Record<string, Preset> = {
    search_matches: 'search',
    get_match_snapshot: 'snapshot',
    list_match_market_capabilities: 'snapshot',
    get_market_series: 'trend',
    get_market_metric_series: 'trend',
    get_trade_flow: 'trend',
    get_market_depth: 'trend',
    get_hold_window_summary: 'anomaly',
    compare_market_windows: 'anomaly',
    get_extraction_signals: 'anomaly',
    detect_cross_market_resonance: 'anomaly',
    get_prediction_market_links: 'snapshot',
    get_prediction_market_snapshot: 'snapshot',
    compare_prediction_market_to_spdex: 'snapshot',
    get_live_market_monitor: 'anomaly',
    get_signal_feed: 'anomaly',
    explain_signal: 'metric',
    generate_match_brief: 'snapshot',
    generate_watchlist: 'today_hot',
    plan_agent_analysis: 'snapshot',
    run_match_analysis_workflow: 'snapshot',
    run_watchlist_workflow: 'today_hot',
    get_big_trades: 'anomaly',
    get_top_matches: 'today_hot',
    detect_market_anomalies: 'anomaly',
    explain_metric: 'metric',
  }
  return values[tool] || 'today_hot'
}

function toolDisplayName(tool: string): string {
  const values: Record<string, string> = {
    search_matches: '赛事搜索',
    get_match_snapshot: '单场数据快照',
    list_match_market_capabilities: '可用分析能力',
    get_market_series: '走势数据',
    get_market_metric_series: '指标走势',
    get_trade_flow: '成交明细',
    get_market_depth: '盘口深度',
    get_hold_window_summary: 'Hold 窗口',
    compare_market_windows: '窗口对比',
    get_extraction_signals: '提炼信号',
    detect_cross_market_resonance: '跨市场共振',
    get_prediction_market_links: '外部市场链接',
    get_prediction_market_snapshot: '外部市场快照',
    compare_prediction_market_to_spdex: '预测市场对比',
    get_live_market_monitor: '赛中监控',
    get_signal_feed: '活跃信号',
    explain_signal: '信号解释',
    generate_match_brief: '比赛简报',
    generate_watchlist: '观察列表',
    plan_agent_analysis: '分析路径',
    run_match_analysis_workflow: '单场分析工作流',
    run_watchlist_workflow: '观察列表工作流',
    get_big_trades: '大额交易证据',
    get_top_matches: '今日重点赛事',
    detect_market_anomalies: '异常证据',
    explain_metric: '指标解释',
  }
  return values[tool] || '数据分析'
}

function turnDisplayName(turn: AnalysisTurn): string {
  if (turn.status === 'pending') return 'AI 正在分析'
  if (turn.status === 'failed') return 'AI 回答未完成'
  if (turn.status === 'cancelled') return '已取消本次分析'
  if (turn.agentResponse) return '观察助手'
  return turn.response ? toolDisplayName(turn.response.tool) : '数据分析'
}

function turnTraceId(turn: AnalysisTurn): string {
  return turn.agentResponse?.traceId || turn.response?.traceId || ''
}

function turnToolName(turn: AnalysisTurn): string {
  if (turn.agentResponse) {
    const tools = turn.agentResponse.toolCalls?.map(call => call.tool).filter(Boolean) ?? []
    return tools.length ? tools.join(',') : 'ai_agent'
  }
  return turn.response?.tool || 'unknown'
}

function turnRenderMode(turn: AnalysisTurn): string {
  return turn.agentResponse ? 'agent' : presetForTool(turn.response?.tool || '')
}

function buildShareText(heading: string, turn: AnalysisTurn): string {
  if (turn.agentResponse?.answer) {
    const answer = turn.agentResponse.answer
    const lines = [
      heading,
      turn.question,
      '',
      answer.directAnswer,
      '',
      ...answer.summary.map(item => `- ${item}`),
      '',
      ...answer.keyEvidence.slice(0, 5).map(item => `${item.label}: ${item.value}（${item.explanation}）`),
      '',
      `trace: ${turn.agentResponse.traceId}`,
    ]
    return lines.filter((line, index, array) => line || array[index - 1]).join('\n').slice(0, 4500)
  }

  const raw = JSON.stringify(
    turn.response?.success ? turn.response.data : turn.response?.error,
    null,
    2,
  )
  return `${heading}\n${turn.question}\n\n${raw.slice(0, 4500)}\n\ntrace: ${turn.response?.traceId || ''}`
}

function formatTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', { hour12: false })
}

onMounted(() => {
  refreshAgentLibrary()
})

onBeforeUnmount(() => {
  cancelActiveRequest()
  finishLoading()
})
</script>

<template>
  <section class="ai-page">
    <header class="ai-head">
      <div class="bot-mark"><Bot :size="24" /></div>
      <div class="head-copy">
        <h1>AI 观察助手</h1>
        <p>像对话一样查询 SPdex 足球市场数据</p>
      </div>
      <div class="head-actions">
        <button v-if="loading" type="button" class="text-button danger focus-ring" @click="cancelActiveRequest">
          <X :size="15" />
          <span>取消</span>
        </button>
        <button v-if="turns.length" type="button" class="icon-button focus-ring" aria-label="清空本次对话" @click="clearTurns">
          <Trash2 :size="16" />
        </button>
      </div>
    </header>

    <div class="workspace">
      <aside class="side-panel">
        <nav class="preset-panel" aria-label="分析类型">
          <button
            v-for="preset in presets"
            :key="preset.value"
            type="button"
            :class="['preset-button', 'focus-ring', { active: selected === preset.value }]"
            @click="selected = preset.value"
          >
            <component :is="preset.icon" :size="17" />
            <span>{{ preset.label }}</span>
          </button>
        </nav>

        <section class="scenario-panel" aria-label="场景模板">
          <header><Activity :size="15" /><b>场景模板</b></header>
          <div class="scenario-list">
            <button
              v-for="template in scenarioTemplates"
              :key="template.id"
              type="button"
              class="scenario-row focus-ring"
              :disabled="loading"
              @click="applyScenario(template)"
            >
              <span>{{ template.audience }}</span>
              <b>{{ template.title }}</b>
              <small>{{ template.question }}</small>
              <i>
                <em v-for="badge in template.badges" :key="badge">{{ badge }}</em>
              </i>
            </button>
          </div>
        </section>

        <section class="workflow-panel" aria-label="我的分析流程">
          <header>
            <ListChecks :size="15" />
            <b>我的流程</b>
            <button
              type="button"
              class="mini-action focus-ring"
              :disabled="!canSaveWorkflow"
              @click="openWorkflowDraft"
            >
              <Plus :size="13" />
              <span>保存流程</span>
            </button>
          </header>

          <p v-if="workflowMessage" class="workflow-message">{{ workflowMessage }}</p>
          <p v-else-if="workflowPending" class="workflow-message">正在读取流程</p>

          <div v-if="pendingWorkflow" class="pending-workflow">
            <span>待运行</span>
            <b>{{ pendingWorkflow.name }}</b>
            <button type="button" class="mini-action focus-ring" :disabled="loading || Boolean(workflowRunningId)" @click="runWorkflow(pendingWorkflow)">
              <Play :size="13" />
              <span>运行流程</span>
            </button>
          </div>

          <p v-if="!workflowPending && !workflowItems.length && !workflowDraftOpen" class="workflow-message">
            暂无自定义流程。完成一次对话后，可把提问顺序保存为流程复用。
          </p>
          <div v-if="workflowItems.length" class="workflow-list">
            <div v-for="workflow in workflowItems" :key="workflow.workflowId" class="workflow-row">
              <button
                type="button"
                class="workflow-open focus-ring"
                :disabled="loading || Boolean(workflowRunningId)"
                @click="runWorkflow(workflow)"
              >
                <b>{{ workflow.name }}</b>
                <span>{{ workflowMetaText(workflow) }}</span>
                <small>{{ workflow.description || workflow.steps[0]?.question }}</small>
              </button>
              <button
                type="button"
                class="workflow-run focus-ring"
                :disabled="loading || Boolean(workflowRunningId)"
                @click="runWorkflow(workflow)"
              >
                <Play v-if="workflowRunningId !== workflow.workflowId" :size="14" />
                <span>{{ workflowRunText(workflow) }}</span>
              </button>
              <button type="button" class="saved-delete focus-ring" aria-label="删除分析流程" @click="deleteWorkflow(workflow.workflowId)">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </section>

        <section class="automation-panel" aria-label="自动化任务">
          <header>
            <Activity :size="15" />
            <b>自动化任务</b>
            <button
              type="button"
              class="mini-action focus-ring"
              :disabled="!workflowItems.length || automationSaving"
              @click="openAutomationDraft()"
            >
              <Plus :size="13" />
              <span>新建</span>
            </button>
          </header>

          <p v-if="automationMessage" class="automation-message">{{ automationMessage }}</p>
          <p v-else-if="automationPending" class="automation-message">正在读取任务</p>

          <div v-if="automationDraftOpen" class="automation-draft">
            <label>
              <span>任务名称</span>
              <input v-model="automationDraft.name" maxlength="80" placeholder="例如：每日重点赛事复盘">
            </label>
            <label>
              <span>执行流程</span>
              <select v-model="automationDraft.workflowId">
                <option v-for="workflow in workflowItems" :key="workflow.workflowId" :value="workflow.workflowId">
                  {{ workflow.name }}
                </option>
              </select>
            </label>
            <label>
              <span>任务说明</span>
              <textarea v-model="automationDraft.description" maxlength="240" rows="2" placeholder="这项任务适合什么场景" />
            </label>
            <div class="automation-grid">
              <label>
                <span>触发方式</span>
                <select v-model="automationDraft.triggerType">
                  <option v-for="option in automationTriggerOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>
              <label>
                <span>频率</span>
                <select v-model="automationDraft.cadence">
                  <option v-for="option in automationCadenceChoices" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>
            </div>
            <label>
              <span>范围</span>
              <select v-model="automationDraft.scope">
                <option v-for="option in automationScopeOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <p v-if="automationDraft.scope === 'selected_match'" class="automation-hint">
              {{ selectedMatch ? `${selectedMatch.homeTeam} vs ${selectedMatch.awayTeam}` : '请先选择一场比赛' }}
            </p>
            <div class="automation-grid">
              <label>
                <span>每日上限</span>
                <input v-model="automationDraft.dailyRunLimit" inputmode="numeric" maxlength="2">
              </label>
              <label>
                <span>月预算</span>
                <input v-model="automationDraft.monthlyUnitBudget" inputmode="numeric" maxlength="6">
              </label>
            </div>
            <div class="automation-switches">
              <label>
                <input v-model="automationDraft.enabled" type="checkbox">
                <span>创建后启用</span>
              </label>
              <label>
                <input v-model="automationDraft.notifyInApp" type="checkbox">
                <span>站内通知</span>
              </label>
              <label>
                <input v-model="automationDraft.notifyEmail" type="checkbox">
                <span>邮件</span>
              </label>
              <label>
                <input v-model="automationDraft.notifyWebhook" type="checkbox">
                <span>Webhook</span>
              </label>
            </div>
            <small>{{ selectedAutomationWorkflow?.matchRequired ? '这个流程需要比赛上下文，正式自动运行前需固定比赛或接入信号触发。' : '这个流程可用于每日观察类自动任务。' }}</small>
            <div class="workflow-draft-actions">
              <button type="button" class="mini-action focus-ring" :disabled="!canSaveAutomationTask" @click="saveAutomationTask">
                <Check :size="13" />
                <span>{{ automationSaving ? '保存中' : '确认保存' }}</span>
              </button>
              <button type="button" class="mini-action quiet focus-ring" :disabled="automationSaving" @click="automationDraftOpen = false">
                取消
              </button>
            </div>
          </div>

          <p v-if="!automationPending && !automationItems.length && !automationDraftOpen" class="automation-message">暂无自动化任务</p>
          <div v-if="automationItems.length" class="automation-list">
            <div v-for="task in automationItems" :key="task.taskId" class="automation-row">
              <div class="automation-main">
                <span :class="['automation-status', { active: task.enabled }]">{{ task.enabled ? '已启用' : '已暂停' }}</span>
                <b>{{ task.name }}</b>
                <small>{{ automationWorkflowName(task) }} · {{ automationMetaText(task) }}</small>
                <small>{{ automationBudgetText(task) }}</small>
                <div
                  v-if="automationBudgetState(task).hasBudget"
                  :class="['automation-budget-meter', { warning: automationBudgetState(task).warning, exhausted: automationBudgetState(task).exhausted }]"
                >
                  <span :style="{ width: `${automationBudgetState(task).ratio}%` }" />
                  <b>{{ automationBudgetState(task).exhausted ? '预算已用完' : automationBudgetState(task).warning ? '接近月预算' : '预算正常' }}</b>
                </div>
                <i v-if="task.notifyChannels.length">
                  <em v-for="channel in task.notifyChannels" :key="channel">{{ notifyLabel(channel) }}</em>
                </i>
                <div v-if="recentAutomationRuns(task.taskId).length" class="automation-run-list">
                  <p v-for="run in recentAutomationRuns(task.taskId)" :key="run.runId">
                    <b>{{ runStatusLabel(run.status) }}</b>
                    <span>
                      {{ runSourceLabel(run.triggerSource) }}
                      · {{ run.completedStepCount }}/{{ run.stepCount || '-' }} 步
                      <template v-if="runDurationText(run.durationMs)"> · {{ runDurationText(run.durationMs) }}</template>
                    </span>
                    <small>{{ formatTime(run.createdAtUtc) }}</small>
                  </p>
                </div>
                <small v-else-if="automationRunsPending">正在读取运行记录</small>
              </div>
              <div class="automation-actions">
                <button type="button" class="mini-action quiet focus-ring" :disabled="automationSaving || Boolean(automationRunningId)" @click="toggleAutomationTask(task)">
                  {{ task.enabled ? '暂停' : '启用' }}
                </button>
                <button type="button" class="mini-action focus-ring" :disabled="!canRunAutomationTask(task)" @click="runAutomationTask(task)">
                  <Play :size="13" />
                  <span>{{ automationRunText(task) }}</span>
                </button>
                <button type="button" class="saved-delete focus-ring" aria-label="删除自动化任务" @click="deleteAutomationTask(task.taskId)">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="saved-panel">
          <header>
            <Clock3 :size="15" />
            <b>分析记录</b>
            <label class="history-filter">
              <input v-model="historySavedOnly" type="checkbox">
              <span>只看已保存</span>
            </label>
          </header>
          <p class="usage-summary">{{ usageText(usageSummary) }}</p>
          <p v-if="historyMessage" class="history-message">{{ historyMessage }}</p>
          <p v-else-if="historyPending" class="history-message">正在读取记录</p>
          <p v-else-if="!historyItems.length" class="history-message">暂无分析记录</p>
          <div class="saved-list">
            <div v-for="item in historyItems" :key="item.recordId" class="saved-row">
              <button type="button" class="saved-open focus-ring" @click="restoreHistory(item)">
                <b>{{ item.title }}</b>
                <span>
                  {{ formatTime(item.createdAtUtc) }}
                  <em v-if="item.saved">已保存</em>
                </span>
              </button>
              <button type="button" class="saved-delete focus-ring" aria-label="删除分析记录" @click="deleteHistory(item.recordId)">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </section>
      </aside>

      <main class="query-panel">
        <section class="context-strip">
          <div>
            <span>{{ selectedLabel }}</span>
            <b>{{ contextSummary }}</b>
          </div>
          <button
            v-if="needsMatch"
            type="button"
            class="match-toggle focus-ring"
            @click="selectorOpen = !selectorOpen"
          >
            {{ selectedMatch ? '更换比赛' : '选择比赛' }}
          </button>
        </section>

        <section class="control-panel">
          <div v-if="selectedMatch && needsMatch" class="selected-match-card">
            <div>
              <span>当前比赛</span>
              <b>{{ selectedMatch.homeTeam }} <i>vs</i> {{ selectedMatch.awayTeam }}</b>
              <small>{{ selectedMatch.leagueName || '赛事' }} · {{ selectedMatch.matchTime ? formatTime(selectedMatch.matchTime) : `比赛 ${selectedMatch.matchId}` }}</small>
            </div>
            <div class="selected-match-actions">
              <button type="button" class="match-toggle compact focus-ring" @click="selectorOpen = true">更换</button>
              <button type="button" class="icon-button compact focus-ring" aria-label="取消选择比赛" @click="clearMatch">
                <X :size="14" />
              </button>
            </div>
          </div>

          <div v-if="selectorOpen" class="match-selector">
            <div class="selector-tools">
              <input v-model="selectorQuery" maxlength="80" placeholder="球队、联赛或比赛 ID">
              <input v-model="form.date" type="date">
            </div>
            <div v-if="matchesPending" class="selector-empty">正在读取比赛</div>
            <div v-else-if="filteredMatches.length" class="selector-list">
              <button
                v-for="match in filteredMatches"
                :key="match.eventId"
                type="button"
                class="selector-row focus-ring"
                @click="selectLocalMatch(match)"
              >
                <span>{{ match.leagueName || match.leagueCode }}</span>
                <b>{{ match.homeTeam }} <i>vs</i> {{ match.awayTeam }}</b>
                <small>{{ formatTime(match.matchTime) }}</small>
              </button>
            </div>
            <div v-else class="selector-empty">当前日期没有匹配赛事</div>
          </div>

          <div class="fields">
            <label v-if="selected === 'today_hot' || selected === 'search'">
              <span>日期</span>
              <input v-model="form.date" type="date">
            </label>
            <label v-if="selected === 'search'">
              <span>球队或联赛</span>
              <input v-model="form.query" maxlength="80" placeholder="例如 Arsenal">
            </label>
            <label v-if="selected === 'trend'">
              <span>市场</span>
              <select v-model="form.market">
                <option value="trade_volume">成交量</option>
                <option value="match_odds">胜平负</option>
                <option value="asian_handicap">亚洲让球</option>
                <option value="over_under">大小球</option>
              </select>
            </label>
            <label v-if="selected === 'trend'">
              <span>粒度</span>
              <select v-model="form.interval">
                <option value="1m">1 分钟</option>
                <option value="5m">5 分钟</option>
                <option value="15m">15 分钟</option>
                <option value="1h">1 小时</option>
              </select>
            </label>
            <label v-if="selected === 'metric'">
              <span>指标</span>
              <select v-model="form.metricKey">
                <option value="trade_volume">成交量</option>
                <option value="match_odds">胜平负指数</option>
                <option value="asian_handicap">亚洲指数</option>
                <option value="over_under">大小球指数</option>
                <option value="implied_probability">隐含概率</option>
              </select>
            </label>
          </div>

          <button class="run-button focus-ring" type="button" :disabled="loading" @click="execute(selected)">
            <Activity :size="17" />
            <span>{{ loading ? '正在分析' : '生成分析' }}</span>
          </button>
        </section>

        <div v-if="errorMessage" class="error-band">{{ errorMessage }}</div>

        <section class="chat-panel">
          <div ref="chatStream" class="chat-stream">
            <div v-if="!turns.length" class="empty-chat">
              <div class="empty-icon"><Bot :size="28" /></div>
              <h2>直接提问，AI 会查询 SPdex 数据后回答</h2>
              <p>可以先选一个专题，也可以像问分析师一样输入自然语言问题。</p>
              <div class="suggestions">
                <button
                  v-for="question in suggestions"
                  :key="question"
                  type="button"
                  class="suggestion focus-ring"
                  :disabled="loading"
                  @click="submitFollowUp(question)"
                >
                  {{ question }}
                </button>
              </div>
            </div>

            <article
              v-for="turn in turns"
              :key="turn.id"
              :class="['chat-turn', turn.status]"
            >
              <div class="user-message">
                <div class="message-avatar user-avatar">你</div>
                <div class="message-bubble user-bubble">
                  <p>{{ turn.question }}</p>
                  <small v-if="turn.match">
                    {{ turn.match.homeTeam }} vs {{ turn.match.awayTeam }}
                  </small>
                </div>
              </div>

              <div class="assistant-message">
                <div class="message-avatar bot-avatar"><Bot :size="18" /></div>
                <div class="message-bubble assistant-bubble">
                  <header class="assistant-meta">
                    <span>{{ turnDisplayName(turn) }}</span>
                    <small>{{ turnStatusText(turn) }}</small>
                  </header>

                  <div v-if="turn.status === 'pending'" class="thinking-card">
                    <div class="thinking-title">
                      <Activity :size="18" />
                      <b>{{ loadingStage }}</b>
                      <span>{{ elapsedSeconds }} 秒</span>
                    </div>
                    <div class="thinking-steps">
                      <span
                        v-for="step in loadingSteps"
                        :key="step.label"
                        :class="{ done: step.done }"
                      >
                        <Check v-if="step.done" :size="13" />
                        <i v-else />
                        {{ step.label }}
                      </span>
                    </div>
                    <p>正在通过 AI Agent 调用 SPdex 数据工具，复杂问题可能需要几十秒。</p>
                  </div>

                  <div v-else-if="turn.status === 'failed' || turn.status === 'cancelled'" :class="['turn-alert', turn.status]">
                    <ShieldAlert v-if="turn.status === 'failed'" :size="17" />
                    <X v-else :size="17" />
                    <span>{{ turn.errorMessage || '本次回答未完成。' }}</span>
                  </div>

                  <template v-else>
                    <AgentResult v-if="turn.agentResponse" :response="turn.agentResponse" />
                    <GoodSampleResult v-else-if="turn.response" :response="turn.response" @select-match="analyzeMatch" />

                    <p v-if="turnUsageText(turn)" class="turn-usage">
                      {{ turnUsageText(turn) }}
                    </p>

                    <section v-if="turn.agentResponse || turn.response" class="answer-feedback" aria-label="回答反馈">
                      <div class="feedback-actions">
                        <button
                          type="button"
                          :class="['feedback-button', 'focus-ring', { active: turn.feedback.selected === 'helpful' }]"
                          :disabled="turn.feedback.sendState === 'sending' || turn.feedback.sendState === 'sent'"
                          @click="submitFeedback(turn, 'helpful')"
                        >
                          <Check :size="15" />
                          <span>有帮助</span>
                        </button>
                        <button
                          type="button"
                          :class="['feedback-button', 'focus-ring', { active: turn.feedback.selected === 'issue' }]"
                          :disabled="turn.feedback.sendState === 'sending' || turn.feedback.sendState === 'sent'"
                          @click="openFeedbackPanel(turn, 'issue')"
                        >
                          <ShieldAlert :size="15" />
                          <span>有问题</span>
                        </button>
                        <button
                          type="button"
                          :class="['feedback-button', 'focus-ring', { active: turn.feedback.selected === 'unclear' }]"
                          :disabled="turn.feedback.sendState === 'sending' || turn.feedback.sendState === 'sent'"
                          @click="openFeedbackPanel(turn, 'unclear')"
                        >
                          <CircleHelp :size="15" />
                          <span>看不懂</span>
                        </button>
                        <span v-if="turn.feedback.message" :class="['feedback-message', turn.feedback.sendState]">
                          {{ turn.feedback.message }}
                        </span>
                      </div>

                      <div v-if="turn.feedback.panelOpen" class="feedback-panel">
                        <div class="feedback-tags">
                          <button
                            v-for="item in feedbackIssueOptions"
                            :key="item.value"
                            type="button"
                            :class="['feedback-tag', 'focus-ring', { active: turn.feedback.issueTags.includes(item.value) }]"
                            :aria-pressed="turn.feedback.issueTags.includes(item.value)"
                            :disabled="turn.feedback.sendState === 'sent'"
                            @click="toggleFeedbackTag(turn, item.value)"
                          >
                            {{ item.label }}
                          </button>
                        </div>
                        <textarea
                          v-model="turn.feedback.commentText"
                          maxlength="500"
                          rows="3"
                          :disabled="turn.feedback.sendState === 'sent'"
                          placeholder="补充一句：哪里不准确、哪里看不懂，或你期待怎样呈现。"
                        />
                        <div class="feedback-submit-row">
                          <button
                            type="button"
                            class="feedback-submit focus-ring"
                            :disabled="turn.feedback.sendState === 'sending' || turn.feedback.sendState === 'sent'"
                            @click="submitFeedback(turn, turn.feedback.selected || 'issue')"
                          >
                            {{ turn.feedback.sendState === 'sending' ? '提交中' : '提交反馈' }}
                          </button>
                        </div>
                      </div>
                    </section>
                  </template>
                </div>
              </div>
            </article>
            <div ref="chatEnd" aria-hidden="true" />
          </div>

          <form class="composer" @submit.prevent="submitFollowUp()">
            <div v-if="turns.length && suggestions.length && !loading" class="suggestions compact-suggestions">
              <button
                v-for="question in suggestions"
                :key="question"
                type="button"
                class="suggestion focus-ring"
                @click="submitFollowUp(question)"
              >
                {{ question }}
              </button>
            </div>
            <div class="composer-row">
              <textarea
                v-model="followUp"
                maxlength="220"
                rows="2"
                :placeholder="composerPlaceholder"
                @keydown.enter.exact.prevent="submitFollowUp()"
              />
              <button
                v-if="loading"
                type="button"
                class="send-button cancel focus-ring"
                aria-label="取消本次回答"
                @click="cancelActiveRequest"
              >
                <X :size="19" />
              </button>
              <button
                v-else
                type="submit"
                class="send-button focus-ring"
                aria-label="发送问题"
                :disabled="!canSubmit"
              >
                <Send :size="19" />
              </button>
            </div>
            <div v-if="latestTurn" class="composer-actions">
              <button type="button" class="secondary-action focus-ring" @click="saveLatest">
                <Check v-if="saveState" :size="15" />
                <Bookmark v-else :size="15" />
                <span>{{ saveState || '保存最新结果' }}</span>
              </button>
              <button type="button" class="secondary-action focus-ring" @click="shareLatest">
                <Check v-if="shareState" :size="15" />
                <Share2 v-else :size="15" />
                <span>{{ shareState || '分享最新结果' }}</span>
              </button>
              <button type="button" class="secondary-action focus-ring" :disabled="!canSaveWorkflow" @click="openWorkflowDraft">
                <ListChecks :size="15" />
                <span>保存为流程</span>
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>

    <div
      v-if="workflowDraftOpen"
      class="modal-backdrop"
      role="presentation"
      @click.self="closeWorkflowDraft"
    >
      <section class="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-modal-title">
        <header class="modal-header">
          <div>
            <span>保存当前分析流程</span>
            <h2 id="workflow-modal-title">保存为流程</h2>
          </div>
          <button type="button" class="icon-button focus-ring" aria-label="关闭保存流程窗口" :disabled="workflowSaving" @click="closeWorkflowDraft">
            <X :size="16" />
          </button>
        </header>

        <div class="workflow-draft modal-form">
          <label>
            <span>流程名称</span>
            <input v-model="workflowDraftName" maxlength="80" placeholder="例如：赛前复盘三步法" autofocus>
          </label>
          <label>
            <span>说明</span>
            <textarea v-model="workflowDraftDescription" maxlength="240" rows="3" placeholder="这套流程适合什么场景" />
          </label>
          <small>{{ workflowSaveHint }}</small>
          <ol v-if="workflowDraftSteps.length" class="workflow-step-preview">
            <li v-for="step in workflowDraftSteps" :key="step.stepId">
              {{ step.title }}
            </li>
          </ol>
        </div>

        <footer class="modal-actions">
          <button type="button" class="secondary-action focus-ring" :disabled="workflowSaving" @click="closeWorkflowDraft">
            取消
          </button>
          <button type="button" class="primary-action focus-ring" :disabled="workflowSaving || !workflowDraftSteps.length" @click="saveCurrentWorkflow">
            <Bookmark :size="15" />
            <span>{{ workflowSaving ? '保存中' : '确认保存' }}</span>
          </button>
        </footer>
      </section>
    </div>
  </section>
</template>

<style scoped>
.ai-page {
  display: grid;
  gap: 16px;
  width: min(1240px, 100%);
  margin: 0 auto;
  padding: 16px 16px 28px;
  color: var(--ink);
  font-size: 16.5px;
}
.ai-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}
.bot-mark,
.empty-icon,
.message-avatar {
  display: grid;
  place-items: center;
}
.bot-mark {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  background: #6957f5;
  color: #fff;
}
.head-copy h1 {
  margin: 0;
  color: var(--ink);
  font-size: 1.28rem;
  letter-spacing: 0;
}
.head-copy p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: .94rem;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.workspace {
  display: grid;
  gap: 14px;
}
.side-panel,
.query-panel,
.control-panel,
.chat-panel,
.scenario-panel,
.workflow-panel,
.automation-panel,
.saved-panel {
  display: grid;
  gap: 10px;
}
.preset-panel {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}
.preset-button {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 48px;
  padding: 10px 12px;
  border: 0;
  border-right: 1px solid var(--divider);
  border-bottom: 1px solid var(--divider);
  background: transparent;
  color: var(--muted);
  font-size: .93rem;
  text-align: left;
}
.preset-button:nth-child(2n) {
  border-right: 0;
}
.preset-button.active {
  background: #6957f5;
  color: #fff;
  font-weight: 780;
}
.saved-panel,
.scenario-panel,
.workflow-panel,
.automation-panel,
.context-strip,
.control-panel,
.chat-panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
}
.saved-panel,
.workflow-panel,
.automation-panel {
  align-content: start;
  padding: 12px;
}
.saved-panel > header,
.scenario-panel > header,
.workflow-panel > header,
.automation-panel > header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: .92rem;
}
.saved-panel > header,
.workflow-panel > header,
.automation-panel > header {
  justify-content: space-between;
}
.saved-panel > header b,
.workflow-panel > header b,
.automation-panel > header b {
  margin-right: auto;
}
.history-filter {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: .72rem;
  white-space: nowrap;
}
.history-filter input {
  width: 13px;
  height: 13px;
  accent-color: var(--brand);
}
.usage-summary,
.history-message,
.workflow-message,
.automation-message {
  margin: 0;
  color: var(--muted);
  font-size: .78rem;
  line-height: 1.45;
}
.usage-summary {
  padding: 8px;
  border: 1px solid var(--divider);
  border-radius: 6px;
  background: var(--canvas);
}
.scenario-panel {
  align-content: start;
  padding: 12px;
}
.scenario-list {
  display: grid;
  overflow: hidden;
  border: 1px solid var(--divider);
  border-radius: 6px;
  background: var(--divider);
}
.scenario-row {
  display: grid;
  gap: 5px;
  padding: 10px;
  border: 0;
  border-bottom: 1px solid var(--divider);
  background: var(--panel);
  color: var(--ink);
  text-align: left;
}
.scenario-row:last-child {
  border-bottom: 0;
}
.scenario-row span {
  color: #5b4ce8;
  font-size: .74rem;
  font-weight: 780;
}
.scenario-row b {
  font-size: .9rem;
  letter-spacing: 0;
}
.scenario-row small {
  display: -webkit-box;
  overflow: hidden;
  color: var(--muted);
  font-size: .78rem;
  line-height: 1.42;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.scenario-row i {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  font-style: normal;
}
.scenario-row em {
  padding: 3px 6px;
  border-radius: 4px;
  background: var(--chip-bg);
  color: var(--muted);
  font-size: .72rem;
  font-style: normal;
}
.workflow-draft,
.automation-draft {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--divider);
  border-radius: 7px;
  background: var(--canvas);
}
.workflow-draft label,
.automation-draft label {
  display: grid;
  gap: 5px;
  color: var(--muted);
  font-size: .82rem;
  font-weight: 720;
}
.workflow-draft input,
.workflow-draft textarea,
.automation-draft input,
.automation-draft select,
.automation-draft textarea {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--ink);
  font: inherit;
  font-size: .9rem;
}
.workflow-draft input,
.automation-draft input,
.automation-draft select {
  min-height: 38px;
  padding: 8px 9px;
}
.workflow-draft textarea,
.automation-draft textarea {
  min-height: 62px;
  padding: 8px 9px;
  resize: vertical;
  line-height: 1.45;
}
.workflow-draft small,
.automation-draft small {
  color: var(--muted);
  font-size: .76rem;
  line-height: 1.45;
}
.workflow-step-preview {
  display: grid;
  gap: 4px;
  margin: -2px 0 0;
  padding: 8px 0 0 18px;
  border-top: 1px solid var(--divider);
  color: var(--ink);
  font-size: .76rem;
  line-height: 1.38;
}
.workflow-step-preview li::marker {
  color: #5b4ce8;
  font-weight: 800;
}
.automation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.automation-hint {
  margin: -2px 0 0;
  padding: 7px 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--brand) 7%, var(--panel));
  color: var(--muted);
  font-size: .78rem;
  line-height: 1.4;
}
.automation-switches {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.automation-switches label {
  display: inline-flex;
  grid-auto-flow: column;
  gap: 5px;
  align-items: center;
  padding: 5px 7px;
  border: 1px solid var(--divider);
  border-radius: 6px;
  background: var(--panel);
  font-size: .74rem;
}
.automation-switches input {
  width: 13px;
  min-height: auto;
  height: 13px;
  accent-color: var(--brand);
}
.workflow-draft-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.pending-workflow {
  display: grid;
  gap: 5px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, #6957f5 24%, var(--line));
  border-radius: 7px;
  background: color-mix(in srgb, #6957f5 7%, var(--panel));
}
.pending-workflow span {
  color: #5b4ce8;
  font-size: .72rem;
  font-weight: 780;
}
.pending-workflow b {
  overflow-wrap: anywhere;
  font-size: .88rem;
}
.workflow-list {
  display: grid;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--divider);
  border-radius: 6px;
  background: var(--divider);
}
.workflow-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  align-items: center;
  background: var(--panel);
}
.workflow-open {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 9px;
  border: 0;
  background: transparent;
  color: var(--ink);
  text-align: left;
}
.workflow-open b {
  overflow: hidden;
  font-size: .84rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workflow-open span,
.workflow-open small {
  overflow: hidden;
  color: var(--muted);
  font-size: .74rem;
  line-height: 1.38;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workflow-run {
  grid-column: 1 / -1;
  justify-self: start;
  margin: 0 9px 9px;
  color: #5b4ce8;
}
.automation-list {
  display: grid;
  gap: 8px;
}
.automation-row {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--divider);
  border-radius: 7px;
  background: var(--panel);
}
.automation-main {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.automation-main b {
  overflow: hidden;
  color: var(--ink);
  font-size: .88rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.automation-main small {
  color: var(--muted);
  font-size: .74rem;
  line-height: 1.4;
}
.automation-budget-meter {
  position: relative;
  overflow: hidden;
  width: min(260px, 100%);
  height: 22px;
  border: 1px solid color-mix(in srgb, #0f766e 18%, var(--divider));
  border-radius: 6px;
  background: color-mix(in srgb, #0f766e 7%, var(--panel));
}
.automation-budget-meter > span {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0;
  background: color-mix(in srgb, #0f766e 18%, transparent);
}
.automation-budget-meter > b {
  position: relative;
  display: block;
  padding: 2px 7px;
  color: #0f766e;
  font-size: .68rem;
  font-weight: 820;
  line-height: 16px;
  text-overflow: clip;
  white-space: nowrap;
}
.automation-budget-meter.warning {
  border-color: color-mix(in srgb, #b45309 24%, var(--divider));
  background: color-mix(in srgb, #b45309 8%, var(--panel));
}
.automation-budget-meter.warning > span {
  background: color-mix(in srgb, #b45309 20%, transparent);
}
.automation-budget-meter.warning > b {
  color: #92400e;
}
.automation-budget-meter.exhausted {
  border-color: color-mix(in srgb, #b91c1c 25%, var(--divider));
  background: color-mix(in srgb, #b91c1c 8%, var(--panel));
}
.automation-budget-meter.exhausted > span {
  background: color-mix(in srgb, #b91c1c 22%, transparent);
}
.automation-budget-meter.exhausted > b {
  color: #b91c1c;
}
.automation-main i {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  font-style: normal;
}
.automation-main em {
  padding: 2px 5px;
  border-radius: 4px;
  background: var(--chip-bg);
  color: var(--muted);
  font-size: .68rem;
  font-style: normal;
  font-weight: 760;
}
.automation-run-list {
  display: grid;
  gap: 5px;
  margin-top: 3px;
  padding-top: 7px;
  border-top: 1px solid var(--divider);
}
.automation-run-list p {
  display: grid;
  gap: 2px;
  margin: 0;
}
.automation-run-list b {
  color: var(--ink);
  font-size: .75rem;
}
.automation-run-list span,
.automation-run-list small {
  color: var(--muted);
  font-size: .7rem;
  line-height: 1.35;
}
.automation-status {
  width: fit-content;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--chip-bg);
  color: var(--muted);
  font-size: .68rem;
  font-weight: 780;
}
.automation-status.active {
  background: color-mix(in srgb, #0f766e 12%, var(--panel));
  color: #0f766e;
}
.automation-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.saved-list {
  display: grid;
  gap: 1px;
  overflow: hidden;
  border: 1px solid var(--divider);
  border-radius: 6px;
  background: var(--divider);
}
.saved-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  align-items: center;
  background: var(--panel);
}
.saved-open {
  display: grid;
  gap: 3px;
  padding: 9px;
  border: 0;
  background: transparent;
  color: var(--ink);
  text-align: left;
}
.saved-open b {
  overflow: hidden;
  font-size: .84rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.saved-open span {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
  color: var(--muted);
  font-size: .74rem;
}
.saved-open em {
  padding: 2px 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--brand) 10%, var(--panel));
  color: var(--brand);
  font-size: .68rem;
  font-style: normal;
  font-weight: 760;
}
.saved-delete {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 0;
  background: transparent;
  color: #b42318;
}
.modal-backdrop {
  position: fixed;
  z-index: 80;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(15, 23, 42, .42);
}
.workflow-modal {
  display: grid;
  width: min(560px, 100%);
  max-height: calc(100dvh - 36px);
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 24px 70px rgba(15, 23, 42, .24);
}
.modal-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--divider);
}
.modal-header div {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.modal-header span {
  color: #5b4ce8;
  font-size: .82rem;
  font-weight: 780;
}
.modal-header h2 {
  margin: 0;
  color: var(--ink);
  font-size: 1.16rem;
  letter-spacing: 0;
}
.modal-form {
  margin: 14px 16px;
}
.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  justify-content: flex-end;
  padding: 14px 16px 16px;
  border-top: 1px solid var(--divider);
}
.primary-action {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 7px 14px;
  border: 0;
  border-radius: 7px;
  background: #6957f5;
  color: #fff;
  font-size: .9rem;
  font-weight: 800;
}
.query-panel {
  align-content: start;
  min-width: 0;
}
.context-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
}
.context-strip div {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.context-strip span,
.selected-match-card span,
.selected-match-card small,
.selector-row span,
.selector-row small,
.selector-empty {
  color: var(--muted);
  font-size: .84rem;
}
.context-strip b {
  overflow-wrap: anywhere;
  font-size: 1.02rem;
}
.control-panel {
  padding: 12px;
}
.selected-match-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 11px;
  border: 1px solid color-mix(in srgb, #6957f5 26%, var(--line));
  border-left: 4px solid #6957f5;
  border-radius: 7px;
  background: color-mix(in srgb, #6957f5 6%, var(--panel));
}
.selected-match-card > div:first-child {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.selected-match-card b {
  overflow-wrap: anywhere;
  font-size: 1.03rem;
}
.selected-match-card i,
.selector-row i {
  color: var(--muted);
  font-style: normal;
}
.selected-match-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}
.match-toggle {
  min-height: 36px;
  padding: 7px 11px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--canvas);
  color: #5b4ce8;
  font-size: .88rem;
  font-weight: 740;
}
.match-toggle.compact {
  min-height: 30px;
  padding: 5px 9px;
}
.match-selector {
  display: grid;
  gap: 9px;
  padding: 10px;
  border: 1px solid var(--divider);
  border-radius: 7px;
  background: var(--canvas);
}
.selector-tools,
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}
.selector-tools input,
.fields input,
.fields select {
  width: 100%;
  min-height: 42px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--ink);
  font-size: .98rem;
}
.selector-list {
  display: grid;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--divider);
  border-radius: 6px;
  background: var(--panel);
}
.selector-row {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) 160px;
  gap: 9px;
  align-items: center;
  min-height: 46px;
  padding: 9px 10px;
  border: 0;
  border-bottom: 1px solid var(--divider);
  background: transparent;
  color: var(--ink);
  text-align: left;
}
.selector-row:last-child {
  border-bottom: 0;
}
.selector-row b {
  overflow-wrap: anywhere;
  font-size: .94rem;
}
.selector-empty {
  padding: 14px;
  text-align: center;
}
.fields label {
  display: grid;
  gap: 5px;
  min-width: 0;
  color: var(--muted);
  font-size: .86rem;
  font-weight: 720;
}
.run-button {
  display: inline-flex;
  width: fit-content;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 16px;
  border: 0;
  border-radius: 7px;
  background: #6957f5;
  color: #fff;
  font-size: .98rem;
  font-weight: 780;
}
.run-button:disabled,
button:disabled {
  opacity: .62;
}
.error-band {
  padding: 10px 12px;
  border: 1px solid #f4b5af;
  border-radius: 7px;
  background: #fff2f0;
  color: #9f1c13;
  font-size: .96rem;
}
.chat-panel {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  height: clamp(620px, calc(100dvh - 188px), 860px);
  min-height: 520px;
  overflow: hidden;
}
.chat-stream {
  display: grid;
  align-content: start;
  gap: 18px;
  min-height: 0;
  padding: 18px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-padding: 18px;
  scrollbar-gutter: stable;
}
.empty-chat {
  display: grid;
  justify-items: center;
  gap: 10px;
  min-height: 300px;
  align-content: center;
  color: var(--muted);
  text-align: center;
}
.empty-icon {
  width: 58px;
  height: 58px;
  border-radius: 12px;
  background: color-mix(in srgb, #6957f5 12%, var(--panel));
  color: #5b4ce8;
}
.empty-chat h2 {
  margin: 0;
  color: var(--ink);
  font-size: 1.28rem;
  letter-spacing: 0;
}
.empty-chat p {
  max-width: 520px;
  margin: 0;
  font-size: .98rem;
  line-height: 1.6;
}
.chat-turn {
  display: grid;
  gap: 12px;
  scroll-margin-top: 82px;
}
.user-message,
.assistant-message {
  display: grid;
  gap: 10px;
  align-items: start;
}
.user-message {
  grid-template-columns: minmax(0, 1fr) 38px;
}
.assistant-message {
  grid-template-columns: 38px minmax(0, 1fr);
}
.message-avatar {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  font-size: .86rem;
  font-weight: 800;
}
.user-avatar {
  grid-column: 2;
  background: #0f766e;
  color: #fff;
}
.bot-avatar {
  background: color-mix(in srgb, #6957f5 12%, var(--panel));
  color: #5b4ce8;
}
.message-bubble {
  min-width: 0;
  border-radius: 8px;
}
.user-bubble {
  justify-self: end;
  max-width: min(760px, 82%);
  padding: 11px 13px;
  background: #0f766e;
  color: #fff;
  grid-column: 1;
  grid-row: 1;
}
.user-bubble p {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.6;
}
.user-bubble small {
  display: block;
  margin-top: 5px;
  color: rgba(255, 255, 255, .78);
  font-size: .82rem;
}
.assistant-bubble {
  display: grid;
  gap: 13px;
  padding: 14px;
  border: 1px solid var(--divider);
  background: var(--panel);
  box-shadow: 0 12px 28px rgba(15, 23, 42, .04);
}
.assistant-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
}
.assistant-meta span {
  color: var(--ink);
  font-weight: 780;
}
.assistant-meta small {
  color: var(--muted);
  font-size: .84rem;
}
.thinking-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, #6957f5 22%, var(--divider));
  border-radius: 8px;
  background: color-mix(in srgb, #6957f5 5%, var(--panel));
}
.thinking-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.thinking-title svg {
  color: #5b4ce8;
  animation: pulse 1.2s ease-in-out infinite;
}
.thinking-title b {
  font-size: 1rem;
}
.thinking-title span {
  margin-left: auto;
  color: var(--muted);
  font-size: .9rem;
}
.thinking-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}
.thinking-steps span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  padding: 5px 8px;
  border-radius: 999px;
  background: var(--canvas);
  color: var(--muted);
  font-size: .84rem;
}
.thinking-steps span.done {
  background: #ecfdf5;
  color: #0f766e;
  font-weight: 760;
}
.thinking-steps i {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
  opacity: .45;
}
.thinking-card p {
  margin: 0;
  color: var(--muted);
  font-size: .92rem;
  line-height: 1.6;
}
.turn-alert {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 11px 12px;
  border-radius: 7px;
  font-size: .96rem;
  line-height: 1.55;
}
.turn-alert.failed {
  border: 1px solid #f4b5af;
  background: #fff2f0;
  color: #9f1c13;
}
.turn-alert.cancelled {
  border: 1px solid var(--divider);
  background: var(--canvas);
  color: var(--muted);
}
.turn-usage {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--divider);
  border-radius: 6px;
  background: var(--canvas);
  color: var(--muted);
  font-size: .82rem;
  line-height: 1.45;
}
.answer-feedback {
  display: grid;
  gap: 9px;
  padding-top: 2px;
  border-top: 1px solid var(--divider);
}
.feedback-actions,
.feedback-tags,
.suggestions,
.composer-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px;
}
.feedback-button,
.feedback-tag,
.suggestion,
.secondary-action,
.mini-action,
.workflow-run,
.text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  color: var(--muted);
  font-size: .88rem;
}
.feedback-button {
  padding: 6px 10px;
}
.feedback-button.active {
  border-color: #0f766e;
  background: #ecfdf5;
  color: #0f766e;
  font-weight: 760;
}
.feedback-message {
  color: var(--muted);
  font-size: .82rem;
}
.feedback-message.sent {
  color: #047857;
}
.feedback-message.failed {
  color: #b42318;
}
.feedback-panel {
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--divider);
  border-radius: 7px;
  background: var(--canvas);
}
.feedback-tag {
  min-height: 32px;
  padding: 5px 9px;
  font-size: .82rem;
}
.feedback-tag.active {
  border-color: #5b4ce8;
  background: #f5f3ff;
  color: #4c1d95;
  font-weight: 760;
}
.feedback-panel textarea,
.composer-row textarea {
  width: 100%;
  resize: vertical;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: var(--panel);
  color: var(--ink);
  font: inherit;
}
.feedback-panel textarea {
  padding: 9px 10px;
  font-size: .92rem;
}
.feedback-submit-row {
  display: flex;
  justify-content: flex-end;
}
.feedback-submit {
  min-height: 36px;
  padding: 6px 13px;
  border: 0;
  border-radius: 6px;
  background: #6957f5;
  color: #fff;
  font-size: .88rem;
  font-weight: 780;
}
.composer {
  position: relative;
  z-index: 4;
  display: grid;
  gap: 9px;
  padding: 13px 18px 16px;
  border-top: 1px solid var(--divider);
  background: color-mix(in srgb, var(--panel) 92%, transparent);
  backdrop-filter: blur(12px);
}
.compact-suggestions {
  padding-bottom: 2px;
}
.suggestion {
  padding: 7px 11px;
  background: var(--canvas);
  color: var(--ink);
  font-size: .9rem;
}
.composer-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px;
  gap: 9px;
  align-items: end;
}
.composer-row textarea {
  min-height: 52px;
  max-height: 150px;
  padding: 12px 13px;
  font-size: 1rem;
  line-height: 1.55;
}
.send-button,
.icon-button {
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 7px;
}
.send-button {
  width: 48px;
  height: 52px;
  border-color: #6957f5;
  background: #6957f5;
  color: #fff;
}
.send-button.cancel {
  border-color: #f4b5af;
  background: #fff2f0;
  color: #b42318;
}
.icon-button {
  width: 38px;
  height: 38px;
  background: var(--panel);
  color: var(--ink);
}
.icon-button.compact {
  width: 30px;
  height: 30px;
}
.secondary-action {
  padding: 6px 10px;
  color: var(--ink);
}
.mini-action,
.workflow-run {
  min-height: 30px;
  padding: 5px 8px;
  font-size: .78rem;
  font-weight: 760;
}
.mini-action {
  color: #5b4ce8;
}
.mini-action.quiet {
  background: var(--canvas);
  color: var(--muted);
}
.text-button {
  padding: 6px 10px;
}
.text-button.danger {
  border-color: #f4b5af;
  background: #fff2f0;
  color: #b42318;
}
.assistant-bubble :deep(.agent-result),
.assistant-bubble :deep(.result-view) {
  font-size: 1rem;
}
@keyframes pulse {
  0%, 100% { opacity: .55; transform: scale(.98); }
  50% { opacity: 1; transform: scale(1.04); }
}
@media (min-width: 860px) {
  .workspace {
    grid-template-columns: 230px minmax(0, 1fr);
    align-items: start;
  }
  .side-panel {
    position: sticky;
    top: 76px;
  }
  .preset-panel {
    grid-template-columns: 1fr;
  }
  .preset-button {
    border-right: 0;
  }
}
@media (max-width: 720px) {
  .ai-page {
    padding: 12px 10px 20px;
    font-size: 16px;
  }
  .head-copy p {
    display: none;
  }
  .context-strip,
  .selected-match-card,
  .selector-tools,
  .fields,
  .selector-row {
    grid-template-columns: 1fr;
  }
  .selected-match-actions {
    justify-content: flex-start;
  }
  .user-bubble {
    max-width: 92%;
  }
  .assistant-message {
    grid-template-columns: 32px minmax(0, 1fr);
  }
  .message-avatar {
    width: 32px;
    height: 32px;
  }
  .chat-stream {
    padding: 12px;
  }
  .chat-panel {
    height: calc(100dvh - 132px);
    min-height: 500px;
    max-height: 760px;
  }
  .assistant-bubble {
    padding: 12px;
  }
  .composer {
    padding: 11px 12px 13px;
  }
}
</style>
