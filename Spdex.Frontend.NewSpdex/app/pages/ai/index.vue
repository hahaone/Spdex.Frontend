<script setup lang="ts">
import {
  Activity,
  Bookmark,
  Bot,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  CircleHelp,
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
  AiAgentTurnResponse,
  GoodSampleMatchChoice,
  GoodSampleResponse,
  SavedGoodSample,
} from '~/types/good-sample'
import type { MatchSummary } from '~/types/match'
import type { BigTradesData } from '~/composables/useBigTrades'

type Preset = 'today_hot' | 'search' | 'snapshot' | 'trend' | 'anomaly' | 'metric'
type FeedbackSendState = 'idle' | 'sending' | 'sent' | 'failed'

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
  response?: GoodSampleResponse
  agentResponse?: AiAgentTurnResponse
  feedback: TurnFeedbackState
}

interface ApiEnvelope<T> {
  data?: T
  success?: boolean
  message?: string
  error?: string
}

const storageKey = 'spdex.good-sample.saved.v1'
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
const feedbackIssueOptions = [
  { value: 'wrong_data', label: '数据不准确' },
  { value: 'missing_critical_context', label: '缺少关键背景' },
  { value: 'ranking_issue', label: '排序不合理' },
  { value: 'threshold_issue', label: '阈值需校准' },
  { value: 'field_name_issue', label: '字段不清楚' },
  { value: 'prediction_market_gap', label: '背离解释不足' },
  { value: 'unclear_wording', label: '表达看不懂' },
]

const routePreset = String(route.query.preset || '')
const selected = ref<Preset>(presets.some(item => item.value === routePreset) ? routePreset as Preset : 'today_hot')
const loading = ref(false)
const errorMessage = ref('')
const followUp = ref('')
const turns = ref<AnalysisTurn[]>([])
const saved = ref<SavedGoodSample[]>([])
const selectorOpen = ref(false)
const selectorQuery = ref('')
const saveState = ref('')
const shareState = ref('')
const resultAnchor = ref<HTMLElement | null>(null)

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
const latestTurn = computed(() => turns.value[0] ?? null)
const selectedLabel = computed(() => presets.find(item => item.value === selected.value)?.label || '数据分析')
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

async function execute(preset: Preset | 'follow_up', question?: string) {
  if (['snapshot', 'trend', 'anomaly'].includes(preset) && !selectedMatch.value) {
    selectorOpen.value = true
    errorMessage.value = '请先选择一场比赛'
    return
  }

  const requestMatch = selectedMatch.value ? { ...selectedMatch.value } : null
  const requestPreset = preset === 'follow_up' ? selected.value : preset
  const questionText = question || selectedLabel.value
  loading.value = true
  errorMessage.value = ''
  saveState.value = ''
  shareState.value = ''
  try {
    const response = await $apiFetch<GoodSampleResponse>('/api/newspdex/ai/good-sample/query', {
      method: 'POST',
      body: {
        preset,
        matchId: requestMatch?.matchId ?? null,
        date: form.date,
        query: question ?? form.query,
        market: form.market,
        interval: form.interval,
        metricKey: form.metricKey,
      },
    })
    await appendToolTurn(response, questionText, requestPreset, requestMatch)
  }
  catch (error: unknown) {
    const fetchError = error as {
      data?: { message?: string, error?: string, error_description?: string }
    }
    errorMessage.value = fetchError.data?.message
      || fetchError.data?.error_description
      || fetchError.data?.error
      || '分析请求失败'
  }
  finally {
    loading.value = false
  }
}

async function submitFollowUp(question?: string) {
  const value = (question || followUp.value).trim()
  if (!value) return
  followUp.value = ''

  const requestMatch = selectedMatch.value ? { ...selectedMatch.value } : null
  const agentOk = await executeAgentTurn(value, selected.value, requestMatch)
  if (agentOk) return

  if (import.meta.dev && selectedMatch.value && isBigTradeQuestion(value)) {
    await executeLocalBigTrades(value)
    return
  }
  await execute('follow_up', value)
}

async function executeAgentTurn(
  questionText: string,
  requestPreset: Preset,
  requestMatch: GoodSampleMatchChoice | null,
) {
  loading.value = true
  errorMessage.value = ''
  saveState.value = ''
  shareState.value = ''
  try {
    const response = await $apiFetch<AiAgentTurnResponse>('/api/newspdex/ai/agent/turn', {
      method: 'POST',
      body: {
        question: questionText,
        matchId: requestMatch?.matchId ?? null,
        preset: requestPreset,
        date: form.date,
        market: form.market,
        interval: form.interval,
        clientTraceId: latestTurn.value?.answerId ?? null,
        history: turns.value.slice(0, 4).map(turn => ({
          role: 'user',
          content: turn.question,
        })),
      },
    })
    if (!response.success || !response.answer) {
      throw new Error(response.message || response.error || 'AI Agent 未返回有效回答')
    }

    await appendAgentTurn(response, questionText, requestPreset, requestMatch)
    return true
  }
  catch {
    return false
  }
  finally {
    loading.value = false
  }
}

async function appendToolTurn(
  response: GoodSampleResponse,
  questionText: string,
  requestPreset: Preset,
  requestMatch: GoodSampleMatchChoice | null,
) {
  const nextTurn: AnalysisTurn = {
    id: cryptoId(),
    answerId: `ans_${cryptoId().replaceAll('-', '')}`,
    question: questionText,
    preset: requestPreset,
    match: requestMatch,
    response,
    feedback: createFeedbackState(),
  }
  turns.value = [nextTurn, ...turns.value].slice(0, 8)
  await nextTick()
  resultAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function appendAgentTurn(
  response: AiAgentTurnResponse,
  questionText: string,
  requestPreset: Preset,
  requestMatch: GoodSampleMatchChoice | null,
) {
  const nextTurn: AnalysisTurn = {
    id: cryptoId(),
    answerId: `ans_${cryptoId().replaceAll('-', '')}`,
    question: questionText,
    preset: requestPreset,
    match: requestMatch,
    agentResponse: response,
    feedback: createFeedbackState(),
  }
  turns.value = [nextTurn, ...turns.value].slice(0, 8)
  await nextTick()
  resultAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function executeLocalBigTrades(questionText: string) {
  const requestMatch = selectedMatch.value ? { ...selectedMatch.value } : null
  if (!requestMatch) return

  loading.value = true
  errorMessage.value = ''
  saveState.value = ''
  shareState.value = ''
  try {
    const result = await $apiFetch<ApiEnvelope<BigTradesData>>(
      `/api/newspdex/big-trades/${requestMatch.matchId}?perGroup=6`,
    )
    if (!result.data) {
      throw new Error(result.message || result.error || '重大成交数据暂不可用')
    }

    await appendToolTurn(
      buildLocalBigTradesResponse(result.data),
      questionText,
      'anomaly',
      requestMatch,
    )
  }
  catch (error: unknown) {
    const fetchError = error as {
      data?: { message?: string, error?: string, error_description?: string }
      message?: string
    }
    errorMessage.value = fetchError.data?.message
      || fetchError.data?.error_description
      || fetchError.data?.error
      || fetchError.message
      || '重大成交数据读取失败'
  }
  finally {
    loading.value = false
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

function saveLatest() {
  const latest = latestTurn.value
  if (!latest) return
  const title = selectedMatch.value
    ? `${selectedMatch.value.homeTeam} vs ${selectedMatch.value.awayTeam} · ${latest.question}`
    : latest.question
  const item: SavedGoodSample = {
    id: cryptoId(),
    title,
    question: latest.question,
    savedAt: new Date().toISOString(),
    preset: selected.value,
    match: selectedMatch.value ? { ...selectedMatch.value } : null,
    response: latest.response,
    agentResponse: latest.agentResponse,
  }
  saved.value = [item, ...saved.value].slice(0, 12)
  try {
    localStorage.setItem(storageKey, JSON.stringify(saved.value))
    saveState.value = '已保存'
  }
  catch {
    saveState.value = '保存失败'
  }
}

async function shareLatest() {
  const latest = latestTurn.value
  if (!latest) return
  const heading = selectedMatch.value
    ? `${selectedMatch.value.homeTeam} vs ${selectedMatch.value.awayTeam}`
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

function restoreSaved(item: SavedGoodSample) {
  selected.value = item.preset ?? (item.response ? presetForTool(item.response.tool) : 'anomaly')
  selectedMatch.value = item.match ? { ...item.match } : null
  form.matchId = item.match ? String(item.match.matchId) : ''
  router.replace({
    query: {
      preset: selected.value,
      date: form.date,
      matchId: item.match ? String(item.match.matchId) : undefined,
      home: item.match?.homeTeam || undefined,
      away: item.match?.awayTeam || undefined,
      league: item.match?.leagueName || undefined,
      matchTime: item.match?.matchTime || undefined,
    },
  })
  turns.value.push({
    id: cryptoId(),
    answerId: `ans_${cryptoId().replaceAll('-', '')}`,
    question: item.question || item.title,
    preset: item.preset ?? (item.response ? presetForTool(item.response.tool) : 'anomaly'),
    match: item.match ? { ...item.match } : null,
    response: item.response,
    agentResponse: item.agentResponse,
    feedback: createFeedbackState(),
  })
}

function deleteSaved(id: string) {
  saved.value = saved.value.filter(item => item.id !== id)
  localStorage.setItem(storageKey, JSON.stringify(saved.value))
}

function clearTurns() {
  turns.value = []
  errorMessage.value = ''
}

function cryptoId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isBigTradeQuestion(value: string) {
  return /大额交易|大额成交|大额资金|大额买卖|大单|大注|重大成交|big trade|large trade/i.test(value)
}

function buildLocalBigTradesResponse(payload: BigTradesData): GoodSampleResponse {
  const groups = (payload.groups ?? []).map((group) => {
    const trades = (group.trades ?? []).map(trade => ({
      selection: trade.sel,
      side: trade.side,
      side_label: trade.side || '成交',
      amount: trade.amount,
      price: trade.price,
      time: trade.time,
      share: trade.per,
      share_percent: trade.per * 100,
      highlight: trade.highlight,
      highlight_label: highlightLabel(trade.highlight),
    }))
    return {
      key: group.key,
      label: group.label,
      market: group.market,
      market_label: bigTradeMarketLabel(group.market),
      total: group.total,
      trade_count: trades.length,
      trades,
    }
  })

  const flatTrades = groups.flatMap(group => group.trades.map(trade => ({
    ...trade,
    group_key: group.key,
    group_label: group.label,
    market: group.market,
  })))
  const largestTrade = [...flatTrades].sort((a, b) => b.amount - a.amount)[0] ?? null
  const dominantGroup = groups
    .map(group => ({
      key: group.key,
      label: group.label,
      market: group.market,
      trade_count: group.trades.length,
      amount: group.trades.reduce((sum, trade) => sum + trade.amount, 0),
    }))
    .sort((a, b) => b.amount - a.amount)[0] ?? null
  const generatedAt = new Date().toISOString()

  return {
    ruleVersion: 'client-big-trades-v1',
    tool: 'get_big_trades',
    success: true,
    data: {
      source: 'NewSpdex',
      match_id: payload.eventId,
      event_id: payload.eventId,
      match_ref: {
        event_id: payload.eventId,
        home_team: payload.homeTeam,
        away_team: payload.awayTeam,
      },
      access_locked: payload.accessLocked,
      lock_message: payload.lockMessage,
      summary: {
        group_count: groups.length,
        trade_count: flatTrades.length,
        total_trade_amount: flatTrades.reduce((sum, trade) => sum + trade.amount, 0),
        max_share: flatTrades.length ? Math.max(...flatTrades.map(trade => trade.share)) : 0,
        largest_trade: largestTrade,
        dominant_group: dominantGroup,
      },
      evidence: {
        source_label: '重大成交记录',
        source_inputs: ['groups', 'trades', 'largest_trade', 'dominant_group'],
      },
      missing_fields: payload.accessLocked ? ['big_trades:permission_locked'] : [],
      data_cutoff_at: generatedAt,
      groups,
    },
    usage: {
      usageUnits: 0,
      billable: false,
      billingMode: 'client_direct_test',
    },
    generatedAt,
    traceId: `client_big_trades_${cryptoId().replaceAll('-', '')}`,
  }
}

function bigTradeMarketLabel(market: string) {
  const labels: Record<string, string> = {
    standard: '标盘',
    goals: '进球数',
  }
  return labels[market] || '成交市场'
}

function highlightLabel(value: number) {
  if (value >= 2) return '高占比'
  if (value >= 1) return '较高占比'
  return '普通'
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
    get_market_series: 'trend',
    get_market_metric_series: 'trend',
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
    get_market_series: '盘口走势',
    get_market_metric_series: '盘口走势',
    get_big_trades: '大额交易证据',
    get_top_matches: '今日重点赛事',
    detect_market_anomalies: '异常证据',
    explain_metric: '指标解释',
  }
  return values[tool] || '数据分析'
}

function turnDisplayName(turn: AnalysisTurn): string {
  if (turn.agentResponse) return 'AI Agent 综合回答'
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
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '[]')
    saved.value = Array.isArray(value) ? value.slice(0, 12) : []
  }
  catch {
    saved.value = []
  }
})
</script>

<template>
  <section class="ai-page">
    <header class="ai-head">
      <div class="bot-mark"><Bot :size="23" /></div>
      <div>
        <h1>AI 观察助手</h1>
        <p>SPdex 结构化足球数据观察</p>
      </div>
      <button v-if="turns.length" type="button" class="icon-button focus-ring" aria-label="清空本次分析" @click="clearTurns">
        <X :size="17" />
      </button>
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
            <component :is="preset.icon" :size="16" />
            <span>{{ preset.label }}</span>
          </button>
        </nav>

        <section v-if="saved.length" class="saved-panel">
          <header><Bookmark :size="14" /><b>已保存</b></header>
          <div class="saved-list">
            <div v-for="item in saved" :key="item.id" class="saved-row">
              <button type="button" class="saved-open focus-ring" @click="restoreSaved(item)">
                <b>{{ item.title }}</b>
                <span>{{ formatTime(item.savedAt) }}</span>
              </button>
              <button type="button" class="saved-delete focus-ring" aria-label="删除保存记录" @click="deleteSaved(item.id)">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </section>
      </aside>

      <main class="query-panel">
        <section class="question-section">
          <div class="question-head">
            <Activity :size="17" />
            <b>{{ selectedLabel }}</b>
            <button
              v-if="needsMatch"
              type="button"
              class="match-toggle focus-ring"
              @click="selectorOpen = !selectorOpen"
            >
              {{ selectedMatch ? '更换比赛' : '选择比赛' }}
            </button>
          </div>

          <div v-if="selectedMatch && needsMatch" class="selected-match-card">
            <div>
              <span>当前分析比赛</span>
              <b>{{ selectedMatch.homeTeam }} <i>vs</i> {{ selectedMatch.awayTeam }}</b>
              <small>{{ selectedMatch.leagueName || '赛事' }} · {{ selectedMatch.matchTime ? formatTime(selectedMatch.matchTime) : `比赛 ${selectedMatch.matchId}` }}</small>
            </div>
            <div class="selected-match-actions">
              <button type="button" class="match-toggle focus-ring" @click="selectorOpen = true">更换</button>
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
            <Activity :size="16" />
            <span>{{ loading ? '正在分析' : '运行分析' }}</span>
          </button>
        </section>

        <div v-if="errorMessage" class="error-band">{{ errorMessage }}</div>

        <section v-if="latestTurn" class="follow-up-section">
          <div class="follow-up-head">
            <b>继续追问</b>
            <span>新回答会显示在最上方，方便连续阅读。</span>
          </div>
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
          <form class="follow-up-form" @submit.prevent="submitFollowUp()">
            <input
              v-model="followUp"
              maxlength="160"
              placeholder="围绕当前比赛继续提问"
              :disabled="loading"
            >
            <button type="submit" class="icon-button primary focus-ring" aria-label="发送追问" :disabled="loading || !followUp.trim()">
              <Send :size="16" />
            </button>
          </form>
          <div class="result-actions">
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
          </div>
        </section>

        <section v-if="turns.length" ref="resultAnchor" class="conversation">
          <article v-for="turn in turns" :key="turn.id" class="answer-turn">
            <header class="answer-head">
              <span><Bot :size="16" /><b>{{ turn.question }}</b></span>
              <span class="answer-kind">{{ turn.id === latestTurn?.id ? '最新结果 · ' : '' }}{{ turnDisplayName(turn) }}</span>
            </header>
            <AgentResult v-if="turn.agentResponse" :response="turn.agentResponse" />
            <GoodSampleResult v-else-if="turn.response" :response="turn.response" @select-match="analyzeMatch" />
            <section class="answer-feedback" aria-label="回答反馈">
              <div class="feedback-actions">
                <button
                  type="button"
                  :class="['feedback-button', 'focus-ring', { active: turn.feedback.selected === 'helpful' }]"
                  :disabled="turn.feedback.sendState === 'sending' || turn.feedback.sendState === 'sent'"
                  @click="submitFeedback(turn, 'helpful')"
                >
                  <Check :size="14" />
                  <span>有帮助</span>
                </button>
                <button
                  type="button"
                  :class="['feedback-button', 'focus-ring', { active: turn.feedback.selected === 'issue' }]"
                  :disabled="turn.feedback.sendState === 'sending' || turn.feedback.sendState === 'sent'"
                  @click="openFeedbackPanel(turn, 'issue')"
                >
                  <ShieldAlert :size="14" />
                  <span>有问题</span>
                </button>
                <button
                  type="button"
                  :class="['feedback-button', 'focus-ring', { active: turn.feedback.selected === 'unclear' }]"
                  :disabled="turn.feedback.sendState === 'sending' || turn.feedback.sendState === 'sent'"
                  @click="openFeedbackPanel(turn, 'unclear')"
                >
                  <CircleHelp :size="14" />
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
          </article>
        </section>
      </main>
    </div>
  </section>
</template>

<style scoped>
.ai-page { display: grid; gap: 14px; padding: 12px 12px 24px; font-size: 16px; }
.ai-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 9px; }
.bot-mark { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 6px; background: var(--brand); color: #fff; }
.ai-head h1 { margin: 0; color: var(--ink); font-size: 1.18rem; letter-spacing: 0; }
.ai-head p { margin: 2px 0 0; color: var(--muted); font-size: .86rem; }
.workspace, .side-panel, .query-panel, .question-section, .conversation, .follow-up-section { display: grid; gap: 10px; }
.preset-panel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid var(--line); border-radius: 6px; background: var(--panel); overflow: hidden; }
.preset-button { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 7px; align-items: center; min-height: 46px; padding: 9px 11px; border: 0; border-right: 1px solid var(--divider); border-bottom: 1px solid var(--divider); background: transparent; color: var(--muted); font-size: .88rem; text-align: left; }
.preset-button:nth-child(2n) { border-right: 0; }
.preset-button.active { background: var(--brand); color: #fff; font-weight: 780; }
.query-panel { align-content: start; }
.question-section, .answer-turn, .follow-up-section, .saved-panel { padding: 13px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); }
.selected-match-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid color-mix(in srgb, var(--brand) 28%, var(--line)); border-left: 3px solid var(--brand); border-radius: 5px; background: color-mix(in srgb, var(--brand) 7%, var(--panel)); }
.selected-match-card > div:first-child { display: grid; gap: 3px; min-width: 0; }
.selected-match-card span, .selected-match-card small { color: var(--muted); font-size: .78rem; }
.selected-match-card b { overflow-wrap: anywhere; font-size: .98rem; }
.selected-match-card i { color: var(--muted); font-size: .78rem; font-style: normal; }
.selected-match-actions { display: flex; align-items: center; gap: 6px; }
.question-head { display: flex; align-items: center; gap: 7px; color: var(--ink); font-size: 1rem; }
.match-toggle { margin-left: auto; padding: 5px 9px; border: 1px solid var(--line); border-radius: 4px; background: var(--canvas); color: var(--brand); font-size: .8rem; }
.match-selector { display: grid; gap: 8px; padding: 9px; border: 1px solid var(--divider); background: var(--canvas); }
.selector-tools { display: grid; grid-template-columns: minmax(0, 1fr) 140px; gap: 7px; }
.selector-tools input, .fields input, .fields select, .follow-up-form input { width: 100%; min-height: 40px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); color: var(--ink); font-size: .94rem; }
.selector-list { display: grid; max-height: 300px; overflow-y: auto; border: 1px solid var(--divider); }
.selector-row { display: grid; grid-template-columns: 96px minmax(0, 1fr) 150px; gap: 8px; align-items: center; min-height: 42px; padding: 8px 9px; border: 0; border-bottom: 1px solid var(--divider); background: var(--panel); color: var(--ink); text-align: left; }
.selector-row:last-child { border-bottom: 0; }
.selector-row span, .selector-row small, .selector-empty { color: var(--muted); font-size: .78rem; }
.selector-row b { overflow-wrap: anywhere; font-size: .88rem; }
.selector-row i { color: var(--muted); font-size: .76rem; font-style: normal; }
.selector-empty { padding: 12px; text-align: center; }
.fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.fields label { display: grid; gap: 5px; min-width: 0; color: var(--muted); font-size: .82rem; font-weight: 720; }
.run-button { display: inline-flex; width: fit-content; min-height: 40px; align-items: center; justify-content: center; gap: 7px; padding: 8px 15px; border: 0; border-radius: 5px; background: var(--brand); color: #fff; font-size: .92rem; font-weight: 780; }
.run-button:disabled, button:disabled { opacity: .6; }
.error-band { padding: 9px 10px; border: 1px solid #f4b5af; border-radius: 5px; background: #fff2f0; color: #9f1c13; font-size: .9rem; }
.answer-turn { display: grid; gap: 11px; scroll-margin-top: 68px; }
.answer-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; padding-bottom: 8px; border-bottom: 1px solid var(--divider); color: var(--muted); font-size: .8rem; }
.answer-head > span:first-child { display: inline-flex; align-items: center; gap: 6px; color: var(--ink); font-size: .96rem; }
.answer-kind { color: var(--muted); font-size: .82rem; }
.answer-feedback { display: grid; gap: 8px; padding-top: 2px; border-top: 1px solid var(--divider); }
.feedback-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.feedback-button { display: inline-flex; align-items: center; gap: 5px; min-height: 34px; padding: 6px 9px; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); color: var(--muted); font-size: .82rem; }
.feedback-button.active { border-color: #0f766e; background: #ecfdf5; color: #0f766e; font-weight: 760; }
.feedback-message { color: var(--muted); font-size: .78rem; }
.feedback-message.sent { color: #047857; }
.feedback-message.failed { color: #b42318; }
.feedback-panel { display: grid; gap: 7px; padding: 8px; border: 1px solid var(--divider); border-radius: 5px; background: var(--canvas); }
.feedback-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.feedback-tag { min-height: 30px; padding: 5px 8px; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); color: var(--muted); font-size: .78rem; }
.feedback-tag.active { border-color: #7c3aed; background: #f5f3ff; color: #5b21b6; font-weight: 760; }
.feedback-panel textarea { width: 100%; resize: vertical; padding: 8px 9px; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); color: var(--ink); font: inherit; font-size: .88rem; }
.feedback-submit-row { display: flex; justify-content: flex-end; }
.feedback-submit { min-height: 34px; padding: 6px 12px; border: 0; border-radius: 4px; background: var(--brand); color: #fff; font-size: .82rem; font-weight: 780; }
.suggestions { display: flex; flex-wrap: wrap; gap: 6px; }
.follow-up-section { position: sticky; top: 64px; z-index: 3; }
.follow-up-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; color: var(--ink); font-size: .9rem; }
.follow-up-head span { color: var(--muted); font-size: .78rem; }
.suggestion { padding: 6px 9px; border: 1px solid var(--line); border-radius: 4px; background: var(--canvas); color: var(--ink); font-size: .84rem; }
.follow-up-form { display: grid; grid-template-columns: minmax(0, 1fr) 40px; gap: 7px; }
.result-actions { display: flex; gap: 7px; }
.secondary-action { display: inline-flex; align-items: center; gap: 5px; min-height: 36px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); color: var(--ink); font-size: .84rem; }
.icon-button { display: inline-grid; width: 38px; height: 38px; place-items: center; border: 1px solid var(--line); border-radius: 5px; background: var(--panel); color: var(--ink); }
.icon-button.compact { width: 28px; height: 28px; }
.icon-button.primary { border-color: var(--brand); background: var(--brand); color: #fff; }
.saved-panel { align-content: start; }
.saved-panel > header { display: flex; align-items: center; gap: 5px; font-size: .86rem; }
.saved-list { display: grid; gap: 1px; background: var(--divider); }
.saved-row { display: grid; grid-template-columns: minmax(0, 1fr) 30px; align-items: center; background: var(--panel); }
.saved-open { display: grid; gap: 2px; padding: 7px; border: 0; background: transparent; color: var(--ink); text-align: left; }
.saved-open b { overflow: hidden; font-size: .8rem; text-overflow: ellipsis; white-space: nowrap; }
.saved-open span { color: var(--muted); font-size: .7rem; }
.saved-delete { display: grid; width: 28px; height: 28px; place-items: center; border: 0; background: transparent; color: #b42318; }
@media (min-width: 800px) {
  .ai-page { width: min(1180px, 100%); margin: 0 auto; padding: 18px 20px 30px; }
  .workspace { grid-template-columns: 220px minmax(0, 1fr); align-items: start; }
  .side-panel { position: sticky; top: 74px; }
  .preset-panel { grid-template-columns: 1fr; }
  .preset-button { border-right: 0; }
  .query-panel { min-height: 460px; }
}
@media (max-width: 560px) {
  .fields, .selector-tools { grid-template-columns: 1fr; }
  .selector-row { grid-template-columns: 65px minmax(0, 1fr); }
  .selector-row small { grid-column: 1 / 3; }
  .follow-up-section { position: static; }
}
</style>
