<script setup lang="ts">
import { ArrowRight, BookOpen, Bot, Database, ShieldCheck, Workflow } from '@lucide/vue'
import { aiArticles, getArticlePath } from '~/data/helpContent'

const recommendedFlow = [
  '先用 AI 观察助手在站内定位比赛、查看快照和追问走势。',
  '需要外部 Agent、企业报告或自动工作流时，再接入 SPdex AI MCP。',
  '遇到必发、Poly、现场、比分或闪Q术语时，回到文档库查专题解释。',
  '涉及提醒和通知时，先生成观察条件草稿，再确认是否创建。',
  '分享结果前检查 token、Authorization、cookie、账号和企业敏感信息。',
]

useSeoMeta({
  title: 'AI 帮助专区 | SPdex 帮助中心',
  description: 'SPdex AI 观察助手、MCP、数据口径、watch condition 和安全使用说明。',
})
</script>

<template>
  <main class="ai-page">
    <section class="page-shell ai-head">
      <div class="ai-title">
        <span class="eyebrow">AI & MCP</span>
        <h1>AI 观察助手与 MCP</h1>
        <p>了解如何在 NewSpdex 中提问、如何把 SPdex 数据接入外部 Agent，以及如何处理权限、数据口径和安全边界。</p>
      </div>
    </section>

    <section class="page-shell page-section">
      <div class="flow-grid">
        <article class="flow-panel">
          <header>
            <Bot :size="18" />
            <h2>推荐使用路径</h2>
          </header>
          <ol>
            <li v-for="item in recommendedFlow" :key="item">{{ item }}</li>
          </ol>
        </article>

        <div class="capability-list">
          <div class="capability-row">
            <Database :size="18" />
            <div>
              <b>同一套数据口径</b>
              <span>NewSpdex、FJCX、外部预测市场、赛中信号和报告工具共用字段解释。</span>
            </div>
          </div>
          <div class="capability-row">
            <Workflow :size="18" />
            <div>
              <b>受控工作流</b>
              <span>支持规划、单场分析、观察列表、提醒草稿，不提供投注或交易指令。</span>
            </div>
          </div>
          <div class="capability-row">
            <ShieldCheck :size="18" />
            <div>
              <b>默认安全边界</b>
              <span>不要求用户展示密钥，不补造缺失数据，权限锁定字段明确标注。</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="page-shell page-section">
      <div class="section-head">
        <div>
          <h2>文档目录</h2>
          <p>选择与你当前入口最接近的文档开始。</p>
        </div>
        <NuxtLink class="library-link focus-ring" to="/docs">
          <BookOpen :size="15" />
          <span>全站文档库</span>
        </NuxtLink>
      </div>

      <div class="docs-list">
        <NuxtLink
          v-for="article in aiArticles"
          :key="article.slug"
          :to="getArticlePath(article)"
          class="doc-row focus-ring"
        >
          <div>
            <span class="doc-meta">{{ article.level }} · {{ article.readMinutes }} 分钟</span>
            <h3>{{ article.title }}</h3>
            <p>{{ article.summary }}</p>
          </div>
          <div class="doc-tail">
            <span>{{ article.readMinutes }} 分钟</span>
            <ArrowRight :size="16" />
          </div>
        </NuxtLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.ai-page { padding-bottom: 30px; }
.ai-head { padding-top: 28px; padding-bottom: 24px; }
.ai-title { display: grid; gap: 12px; max-width: 760px; }
.eyebrow { color: var(--accent-strong); font-size: .78rem; font-weight: 820; letter-spacing: .08em; text-transform: uppercase; }
.ai-title h1 { margin: 0; color: var(--ink); font-size: clamp(2rem, 5vw, 3rem); line-height: 1.08; letter-spacing: 0; }
.ai-title p { margin: 0; color: var(--muted); font-size: 1.02rem; }
.flow-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, .82fr); gap: 14px; }
.flow-panel { display: grid; gap: 12px; padding: 16px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
.flow-panel header { display: flex; align-items: center; gap: 8px; color: var(--accent-strong); }
.flow-panel h2, .section-head h2 { margin: 0; color: var(--ink); font-size: 1.12rem; letter-spacing: 0; }
.flow-panel ol { display: grid; gap: 8px; margin: 0; padding-left: 20px; color: var(--ink); }
.flow-panel li::marker { color: var(--accent); font-weight: 800; }
.capability-list { display: grid; gap: 8px; }
.capability-row { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 9px; align-items: start; padding: 13px; border: 1px solid var(--line); border-radius: 8px; background: #fbfcfd; }
.capability-row svg { color: var(--plum); margin-top: 2px; }
.capability-row div { display: grid; gap: 2px; }
.capability-row b { color: var(--ink); }
.capability-row span { color: var(--muted); font-size: .88rem; }
.section-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.section-head p { margin: 4px 0 0; color: var(--muted); }
.library-link { display: inline-flex; min-height: 34px; align-items: center; gap: 6px; padding: 6px 9px; border: 1px solid var(--line); border-radius: 6px; background: #fff; color: var(--accent-strong); font-size: .84rem; font-weight: 800; white-space: nowrap; }
.docs-list { display: grid; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--panel); }
.doc-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 16px; border-bottom: 1px solid var(--line); }
.doc-row:last-child { border-bottom: 0; }
.doc-row:hover { background: #f8fafc; }
.doc-meta { color: var(--soft); font-size: .76rem; font-weight: 760; }
.doc-row h3 { margin: 6px 0 3px; color: var(--ink); font-size: 1rem; letter-spacing: 0; }
.doc-row p { margin: 0; color: var(--muted); font-size: .9rem; }
.doc-tail { display: inline-flex; align-items: center; gap: 8px; color: var(--accent-strong); font-size: .82rem; font-weight: 780; white-space: nowrap; }
@media (max-width: 820px) {
  .flow-grid, .doc-row { grid-template-columns: 1fr; }
  .section-head { align-items: start; flex-direction: column; }
  .doc-tail { justify-content: space-between; }
}
</style>
