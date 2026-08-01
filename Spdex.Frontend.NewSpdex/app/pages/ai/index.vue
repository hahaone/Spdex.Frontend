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
import type { GoodSampleMatchChoice, GoodSampleResponse, SavedGoodSample } from '~/types/good-sample'
import type { MatchSummary } from '~/types/match'

type Preset = 'today_hot' | 'search' | 'snapshot' | 'trend' | 'anomaly' | 'metric'

interface AnalysisTurn {
  id: string
  question: string
  response: GoodSampleResponse
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
const latestTurn = computed(() => turns.value.at(-1) ?? null)
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
const suggestions = computed(() => selectedMatch.value
  ? [
      '这场比赛的数据概览',
      '最近的成交量走势如何？',
      '这场比赛有什么异常信号？',
      '胜平负赔率是什么意思？',
    ]
  : [
      '今天有哪些重点比赛？',
      '成交量是什么意思？',
    ])

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

  loading.value = true
  errorMessage.value = ''
  saveState.value = ''
  shareState.value = ''
  try {
    const response = await $apiFetch<GoodSampleResponse>('/api/newspdex/ai/good-sample/query', {
      method: 'POST',
      body: {
        preset,
        matchId: selectedMatch.value?.matchId ?? null,
        date: form.date,
        query: question ?? form.query,
        market: form.market,
        interval: form.interval,
        metricKey: form.metricKey,
      },
    })
    turns.value.push({
      id: cryptoId(),
      question: question || selectedLabel.value,
      response,
    })
    if (turns.value.length > 8) turns.value = turns.value.slice(-8)
    await nextTick()
    resultAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  await execute('follow_up', value)
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
  const raw = JSON.stringify(
    latest.response.success ? latest.response.data : latest.response.error,
    null,
    2,
  )
  const text = `${heading}\n${latest.question}\n\n${raw.slice(0, 4500)}\n\ntrace: ${latest.response.traceId}`
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
  selected.value = item.preset ?? presetForTool(item.response.tool)
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
    question: item.question || item.title,
    response: item.response,
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

function presetForTool(tool: string): Preset {
  const values: Record<string, Preset> = {
    search_matches: 'search',
    get_match_snapshot: 'snapshot',
    get_market_series: 'trend',
    get_top_matches: 'today_hot',
    detect_market_anomalies: 'anomaly',
    explain_metric: 'metric',
  }
  return values[tool] || 'today_hot'
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
        <section v-if="selectedMatch" class="selected-match">
          <div>
            <span>{{ selectedMatch.leagueName || '当前比赛' }}</span>
            <b>{{ selectedMatch.homeTeam }} <i>vs</i> {{ selectedMatch.awayTeam }}</b>
            <small>{{ selectedMatch.matchTime ? formatTime(selectedMatch.matchTime) : `match ${selectedMatch.matchId}` }}</small>
          </div>
          <button type="button" class="icon-button focus-ring" aria-label="取消选择比赛" @click="clearMatch">
            <X :size="15" />
          </button>
        </section>

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

        <section v-if="turns.length" ref="resultAnchor" class="conversation">
          <article v-for="turn in turns" :key="turn.id" class="answer-turn">
            <header class="answer-head">
              <span><Bot :size="16" /><b>{{ turn.question }}</b></span>
              <span>{{ turn.response.tool }}</span>
            </header>
            <GoodSampleResult :response="turn.response" @select-match="selectMatch" />
          </article>
        </section>

        <section v-if="latestTurn" class="follow-up-section">
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
              <span>{{ saveState || '保存' }}</span>
            </button>
            <button type="button" class="secondary-action focus-ring" @click="shareLatest">
              <Check v-if="shareState" :size="15" />
              <Share2 v-else :size="15" />
              <span>{{ shareState || '分享' }}</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  </section>
</template>

<style scoped>
.ai-page { display: grid; gap: 12px; padding: 12px 12px 24px; }
.ai-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 9px; }
.bot-mark { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 6px; background: var(--brand); color: #fff; }
.ai-head h1 { margin: 0; color: var(--ink); font-size: 1.05rem; letter-spacing: 0; }
.ai-head p { margin: 2px 0 0; color: var(--muted); font-size: .72rem; }
.workspace, .side-panel, .query-panel, .question-section, .conversation, .follow-up-section { display: grid; gap: 10px; }
.preset-panel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid var(--line); border-radius: 6px; background: var(--panel); overflow: hidden; }
.preset-button { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 6px; align-items: center; min-height: 42px; padding: 8px 10px; border: 0; border-right: 1px solid var(--divider); border-bottom: 1px solid var(--divider); background: transparent; color: var(--muted); font-size: .74rem; text-align: left; }
.preset-button:nth-child(2n) { border-right: 0; }
.preset-button.active { background: var(--brand); color: #fff; font-weight: 780; }
.query-panel { align-content: start; }
.question-section, .answer-turn, .follow-up-section, .saved-panel { padding: 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); }
.selected-match { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-left: 3px solid var(--brand); background: var(--canvas); }
.selected-match > div { display: grid; gap: 3px; }
.selected-match span, .selected-match small { color: var(--muted); font-size: .65rem; }
.selected-match b { font-size: .82rem; }
.selected-match i { color: var(--muted); font-size: .62rem; font-style: normal; }
.question-head { display: flex; align-items: center; gap: 7px; color: var(--ink); font-size: .88rem; }
.match-toggle { margin-left: auto; padding: 4px 7px; border: 1px solid var(--line); border-radius: 4px; background: var(--canvas); color: var(--brand); font-size: .65rem; }
.match-selector { display: grid; gap: 8px; padding: 9px; border: 1px solid var(--divider); background: var(--canvas); }
.selector-tools { display: grid; grid-template-columns: minmax(0, 1fr) 140px; gap: 7px; }
.selector-tools input, .fields input, .fields select, .follow-up-form input { width: 100%; min-height: 36px; padding: 7px 8px; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); color: var(--ink); }
.selector-list { display: grid; max-height: 300px; overflow-y: auto; border: 1px solid var(--divider); }
.selector-row { display: grid; grid-template-columns: 90px minmax(0, 1fr) 145px; gap: 8px; align-items: center; min-height: 38px; padding: 7px 8px; border: 0; border-bottom: 1px solid var(--divider); background: var(--panel); color: var(--ink); text-align: left; }
.selector-row:last-child { border-bottom: 0; }
.selector-row span, .selector-row small, .selector-empty { color: var(--muted); font-size: .65rem; }
.selector-row b { overflow-wrap: anywhere; font-size: .72rem; }
.selector-row i { color: var(--muted); font-size: .6rem; font-style: normal; }
.selector-empty { padding: 12px; text-align: center; }
.fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.fields label { display: grid; gap: 4px; min-width: 0; color: var(--muted); font-size: .7rem; font-weight: 720; }
.run-button { display: inline-flex; width: fit-content; min-height: 36px; align-items: center; justify-content: center; gap: 6px; padding: 7px 13px; border: 0; border-radius: 5px; background: var(--brand); color: #fff; font-size: .78rem; font-weight: 780; }
.run-button:disabled, button:disabled { opacity: .6; }
.error-band { padding: 9px 10px; border: 1px solid #f4b5af; border-radius: 5px; background: #fff2f0; color: #9f1c13; font-size: .77rem; }
.answer-turn { display: grid; gap: 11px; scroll-margin-top: 68px; }
.answer-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; padding-bottom: 8px; border-bottom: 1px solid var(--divider); color: var(--muted); font-size: .65rem; }
.answer-head > span:first-child { display: inline-flex; align-items: center; gap: 6px; color: var(--ink); font-size: .79rem; }
.suggestions { display: flex; flex-wrap: wrap; gap: 6px; }
.suggestion { padding: 5px 8px; border: 1px solid var(--line); border-radius: 4px; background: var(--canvas); color: var(--ink); font-size: .67rem; }
.follow-up-form { display: grid; grid-template-columns: minmax(0, 1fr) 36px; gap: 7px; }
.result-actions { display: flex; gap: 7px; }
.secondary-action { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 5px 9px; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); color: var(--ink); font-size: .69rem; }
.icon-button { display: inline-grid; width: 34px; height: 34px; place-items: center; border: 1px solid var(--line); border-radius: 5px; background: var(--panel); color: var(--ink); }
.icon-button.primary { border-color: var(--brand); background: var(--brand); color: #fff; }
.saved-panel { align-content: start; }
.saved-panel > header { display: flex; align-items: center; gap: 5px; font-size: .72rem; }
.saved-list { display: grid; gap: 1px; background: var(--divider); }
.saved-row { display: grid; grid-template-columns: minmax(0, 1fr) 30px; align-items: center; background: var(--panel); }
.saved-open { display: grid; gap: 2px; padding: 7px; border: 0; background: transparent; color: var(--ink); text-align: left; }
.saved-open b { overflow: hidden; font-size: .65rem; text-overflow: ellipsis; white-space: nowrap; }
.saved-open span { color: var(--muted); font-size: .58rem; }
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
}
</style>
