<script setup lang="ts">
import { Bot, CheckCircle2, Info, ListChecks, ShieldAlert } from '@lucide/vue'
import type { AiAgentTurnResponse } from '~/types/good-sample'

const props = defineProps<{ response: AiAgentTurnResponse }>()

const confidenceLabel = computed(() => {
  const values: Record<string, string> = {
    high: '置信度高',
    medium: '置信度中',
    low: '置信度低',
  }
  return values[props.response.answer?.confidence || ''] || '置信度待确认'
})

const toolLabel = (tool: string) => {
  const values: Record<string, string> = {
    get_match_snapshot: '单场数据',
    get_big_trades: '大额交易',
    get_market_series: '盘口走势',
    detect_market_anomalies: '异常证据',
    explain_metric: '指标解释',
  }
  return values[tool] || '数据工具'
}
</script>

<template>
  <section v-if="response.success && response.answer" class="agent-result">
    <div class="notice">
      <ShieldAlert :size="17" />
      <span>{{ response.answer.policyNotice || '以下内容为规则化市场观察，不构成投注建议。' }}</span>
    </div>

    <section class="direct-answer">
      <div class="answer-icon"><Bot :size="20" /></div>
      <div>
        <p>{{ response.answer.directAnswer }}</p>
        <span>{{ confidenceLabel }}</span>
      </div>
    </section>

    <section v-if="response.answer.summary?.length" class="agent-section">
      <header><ListChecks :size="17" /><b>判断要点</b></header>
      <ul>
        <li v-for="item in response.answer.summary" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section v-if="response.answer.keyEvidence?.length" class="agent-section evidence-section">
      <header><CheckCircle2 :size="17" /><b>关键依据</b></header>
      <div class="evidence-grid">
        <article v-for="item in response.answer.keyEvidence" :key="`${item.label}-${item.value}`" class="evidence-item">
          <span>{{ item.label }}</span>
          <b>{{ item.value }}</b>
          <p>{{ item.explanation }}</p>
        </article>
      </div>
    </section>

    <section v-if="response.answer.dataLimits?.length" class="agent-section muted-section">
      <header><Info :size="17" /><b>数据边界</b></header>
      <ul>
        <li v-for="item in response.answer.dataLimits" :key="item">{{ item }}</li>
      </ul>
    </section>

    <div v-if="response.toolCalls?.length" class="tool-summary">
      <span v-for="call in response.toolCalls" :key="call.id || call.tool">
        {{ toolLabel(call.tool) }}
      </span>
    </div>
  </section>
  <section v-else class="agent-error">
    {{ response.message || 'AI Agent 暂时没有生成有效回答。' }}
  </section>
</template>

<style scoped>
.agent-result { display: grid; gap: 12px; font-size: 1rem; }
.notice { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-left: 3px solid #d97706; background: #fffbeb; color: #92400e; line-height: 1.45; }
.direct-answer { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 12px; align-items: start; padding: 14px; border: 1px solid color-mix(in srgb, var(--brand) 28%, var(--line)); border-radius: 6px; background: color-mix(in srgb, var(--brand) 6%, var(--panel)); }
.answer-icon { display: grid; width: 38px; height: 38px; place-items: center; border-radius: 6px; background: var(--brand); color: #fff; }
.direct-answer p { margin: 0; color: var(--ink); font-size: 1.04rem; font-weight: 760; line-height: 1.65; }
.direct-answer span { display: inline-block; margin-top: 6px; color: var(--muted); font-size: .88rem; }
.agent-section { display: grid; gap: 8px; padding-top: 2px; }
.agent-section header { display: flex; align-items: center; gap: 7px; color: var(--ink); font-size: .98rem; }
.agent-section ul { display: grid; gap: 6px; margin: 0; padding-left: 20px; color: var(--text); line-height: 1.6; }
.evidence-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }
.evidence-item { display: grid; gap: 4px; padding: 10px; border: 1px solid var(--divider); border-radius: 5px; background: var(--canvas); }
.evidence-item span { color: var(--muted); font-size: .82rem; }
.evidence-item b { color: var(--ink); font-size: 1.06rem; }
.evidence-item p { margin: 0; color: var(--muted); font-size: .88rem; line-height: 1.5; }
.muted-section { color: var(--muted); }
.tool-summary { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 2px; }
.tool-summary span { padding: 4px 7px; border-radius: 4px; background: var(--chip-bg); color: var(--muted); font-size: .78rem; }
.agent-error { padding: 12px; border: 1px solid #f4b5af; border-radius: 5px; background: #fff2f0; color: #9f1c13; }
</style>
