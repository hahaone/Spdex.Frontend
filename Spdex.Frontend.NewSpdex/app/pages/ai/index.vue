<script setup lang="ts">
import { Activity, Bot, CalendarDays, ChartNoAxesCombined, CircleHelp, Search, ShieldAlert } from '@lucide/vue'

type Preset = 'today_hot' | 'search' | 'snapshot' | 'trend' | 'anomaly' | 'metric'

interface ToolResponse {
  ruleVersion: string
  tool: string
  success: boolean
  data?: unknown
  error?: { code: string, message: string, details?: Record<string, string> }
  usage: { usageUnits: number, billable: boolean, billingMode: string }
  generatedAt: string
  traceId: string
}

const presets: Array<{ value: Preset, label: string, icon: typeof Bot }> = [
  { value: 'today_hot', label: '今日重点赛事', icon: CalendarDays },
  { value: 'search', label: '搜索赛事', icon: Search },
  { value: 'snapshot', label: '单场数据快照', icon: Bot },
  { value: 'trend', label: '盘口走势', icon: ChartNoAxesCombined },
  { value: 'anomaly', label: '异常证据', icon: ShieldAlert },
  { value: 'metric', label: '指标解释', icon: CircleHelp },
]

const selected = ref<Preset>('today_hot')
const loading = ref(false)
const response = ref<ToolResponse | null>(null)
const errorMessage = ref('')
const form = reactive({
  matchId: '',
  date: new Date().toISOString().slice(0, 10),
  query: '',
  market: 'trade_volume',
  interval: '15m',
  metricKey: 'trade_volume',
})

const needsMatch = computed(() => ['snapshot', 'trend', 'anomaly'].includes(selected.value))

const resultText = computed(() => {
  if (!response.value) return ''
  return JSON.stringify(response.value.success ? response.value.data : response.value.error, null, 2)
})

async function run() {
  if (needsMatch.value && (!form.matchId || Number(form.matchId) <= 0)) {
    errorMessage.value = '请输入有效的 SPdex 比赛 ID'
    return
  }

  loading.value = true
  errorMessage.value = ''
  response.value = null
  try {
    response.value = await $apiFetch<ToolResponse>('/api/newspdex/ai/good-sample/query', {
      method: 'POST',
      body: {
        preset: selected.value,
        matchId: form.matchId ? Number(form.matchId) : null,
        date: form.date,
        query: form.query,
        market: form.market,
        interval: form.interval,
        metricKey: form.metricKey,
      },
    })
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string, error?: string } }
    errorMessage.value = fetchError.data?.message || fetchError.data?.error || '分析请求失败'
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="ai-page">
    <header class="ai-head">
      <div class="bot-mark"><Bot :size="23" /></div>
      <div>
        <h1>Good Sample</h1>
        <p>SPdex 结构化数据问答</p>
      </div>
    </header>

    <div class="workspace">
      <aside class="preset-panel">
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
      </aside>

      <main class="query-panel">
        <div class="question-head">
          <Activity :size="17" />
          <b>{{ presets.find(item => item.value === selected)?.label }}</b>
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
          <label v-if="needsMatch">
            <span>比赛 ID</span>
            <input v-model="form.matchId" inputmode="numeric" placeholder="SPdex match_id">
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
            <span>指标 key</span>
            <input v-model="form.metricKey" maxlength="80" placeholder="trade_volume">
          </label>
        </div>

        <button class="run-button focus-ring" type="button" :disabled="loading" @click="run">
          <Activity :size="16" />
          <span>{{ loading ? '正在分析' : '运行分析' }}</span>
        </button>

        <div v-if="errorMessage" class="error-band">{{ errorMessage }}</div>

        <section v-if="response" class="answer-band">
          <div class="answer-head">
            <span><Bot :size="16" /><b>{{ response.success ? '数据回答' : '无法完成' }}</b></span>
            <span>{{ response.usage.usageUnits }} units · {{ new Date(response.generatedAt).toLocaleTimeString('zh-CN', { hour12: false }) }}</span>
          </div>
          <pre>{{ resultText }}</pre>
          <footer>trace {{ response.traceId }}</footer>
        </section>
      </main>
    </div>
  </section>
</template>

<style scoped>
.ai-page { display: grid; gap: 12px; padding: 12px 12px 20px; }
.ai-head { display: flex; align-items: center; gap: 9px; }
.bot-mark { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 6px; background: var(--brand); color: #fff; }
.ai-head h1 { margin: 0; color: var(--ink); font-size: 1.05rem; letter-spacing: 0; }
.ai-head p { margin: 2px 0 0; color: var(--muted); font-size: .72rem; }
.workspace { display: grid; gap: 10px; }
.preset-panel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border: 1px solid var(--line); border-radius: 6px; background: var(--panel); overflow: hidden; }
.preset-button { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 6px; align-items: center; min-height: 42px; padding: 8px 10px; border: 0; border-right: 1px solid var(--divider); border-bottom: 1px solid var(--divider); background: transparent; color: var(--muted); font-size: .74rem; text-align: left; }
.preset-button:nth-child(2n) { border-right: 0; }
.preset-button.active { background: var(--brand); color: #fff; font-weight: 780; }
.query-panel { display: grid; gap: 12px; padding: 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); }
.question-head { display: flex; align-items: center; gap: 7px; color: var(--ink); font-size: .88rem; }
.fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.fields label { display: grid; gap: 4px; min-width: 0; color: var(--muted); font-size: .7rem; font-weight: 720; }
.fields input, .fields select { width: 100%; min-height: 36px; padding: 7px 8px; border: 1px solid var(--line); border-radius: 4px; background: var(--canvas); color: var(--ink); }
.run-button { display: inline-flex; width: fit-content; min-height: 36px; align-items: center; justify-content: center; gap: 6px; padding: 7px 13px; border: 0; border-radius: 5px; background: var(--brand); color: #fff; font-size: .78rem; font-weight: 780; }
.run-button:disabled { opacity: .6; }
.error-band { padding: 9px 10px; border: 1px solid #f4b5af; border-radius: 5px; background: #fff2f0; color: #9f1c13; font-size: .77rem; }
.answer-band { display: grid; border: 1px solid var(--divider); border-radius: 5px; overflow: hidden; }
.answer-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; padding: 9px 10px; border-bottom: 1px solid var(--divider); background: var(--canvas); color: var(--muted); font-size: .68rem; }
.answer-head > span:first-child { display: inline-flex; align-items: center; gap: 6px; color: var(--ink); font-size: .8rem; }
.answer-band pre { max-height: 520px; margin: 0; overflow: auto; padding: 11px; background: var(--panel); color: var(--ink); font: 11px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.answer-band footer { padding: 6px 10px; border-top: 1px solid var(--divider); color: var(--muted); font: 9px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
@media (min-width: 800px) {
  .ai-page { width: min(1100px, 100%); margin: 0 auto; padding: 18px 20px 30px; }
  .workspace { grid-template-columns: 210px minmax(0, 1fr); align-items: start; }
  .preset-panel { grid-template-columns: 1fr; }
  .preset-button { border-right: 0; }
  .query-panel { min-height: 430px; }
}
</style>
