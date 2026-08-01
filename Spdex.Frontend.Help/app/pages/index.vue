<script setup lang="ts">
import { ArrowRight, BookOpen, Bot, LifeBuoy, Search, ShieldCheck } from '@lucide/vue'
import { aiArticles, futureCategories, supportChecklist } from '~/data/helpContent'

const query = ref('')
const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const filteredArticles = computed(() => {
  const q = normalizedQuery.value
  if (!q) return aiArticles
  return aiArticles.filter(article => [
    article.title,
    article.summary,
    article.audience,
    ...article.sections.flatMap(section => [section.heading, ...section.body, ...(section.bullets ?? []), ...(section.examples ?? [])]),
  ].join(' ').toLowerCase().includes(q))
})

useSeoMeta({
  title: 'SPdex 帮助中心',
  description: 'SPdex 帮助中心，先提供 AI 观察助手、SPdex AI MCP、数据口径和安全使用说明。',
})
</script>

<template>
  <main>
    <section class="intro-band">
      <div class="page-shell intro-grid">
        <div class="intro-copy">
          <span class="status-pill trial">AI 试点版</span>
          <h1>SPdex 帮助中心</h1>
          <p>先开放 AI 观察助手、MCP、数据口径和安全边界文档；后续扩展到 SPdex 各业务板块和客服交互。</p>
        </div>

        <div class="search-panel" role="search">
          <div class="search-box">
            <Search :size="18" />
            <input v-model="query" type="search" maxlength="80" placeholder="搜索 AI、MCP、token、watch condition、数据口径">
          </div>
          <div class="quick-links" aria-label="常用入口">
            <NuxtLink class="quick-link focus-ring" to="/ai/ai-watch-assistant">
              <Bot :size="16" />
              <span>AI 观察助手</span>
            </NuxtLink>
            <NuxtLink class="quick-link focus-ring" to="/ai/mcp-quickstart">
              <BookOpen :size="16" />
              <span>MCP 接入</span>
            </NuxtLink>
            <NuxtLink class="quick-link focus-ring" to="/ai/safe-usage">
              <ShieldCheck :size="16" />
              <span>安全说明</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <section class="page-shell page-section">
      <div class="section-head">
        <div>
          <h2>AI 帮助文档</h2>
          <p>面向站内试点用户、MCP 用户和企业 Agent 的使用说明。</p>
        </div>
        <NuxtLink class="text-action focus-ring" to="/ai">
          <span>查看 AI 专区</span>
          <ArrowRight :size="15" />
        </NuxtLink>
      </div>

      <div class="article-grid">
        <NuxtLink
          v-for="article in filteredArticles"
          :key="article.slug"
          class="article-card focus-ring"
          :to="`/ai/${article.slug}`"
        >
          <div class="article-meta">
            <span :class="['status-pill', article.status === '试点' ? 'trial' : article.status === '安全' ? 'live' : '']">{{ article.status }}</span>
            <span>{{ article.readMinutes }} 分钟</span>
          </div>
          <h3>{{ article.title }}</h3>
          <p>{{ article.summary }}</p>
          <small>{{ article.audience }}</small>
        </NuxtLink>
      </div>

      <div v-if="!filteredArticles.length" class="empty-state">
        当前 AI 文档没有匹配项。可以换一个关键词，或查看 FAQ 与安全边界。
      </div>
    </section>

    <section class="page-shell page-section">
      <div class="section-head">
        <div>
          <h2>后续帮助分类</h2>
          <p>公开版帮助中心会覆盖 SPdex 全站功能，目前先搭好分类骨架。</p>
        </div>
      </div>

      <div class="future-list">
        <article v-for="category in futureCategories" :key="category.title" class="future-row">
          <div>
            <h3>{{ category.title }}</h3>
            <p>{{ category.summary }}</p>
          </div>
          <span class="status-pill">{{ category.status }}</span>
        </article>
      </div>
    </section>

    <section class="support-band">
      <div class="page-shell support-grid">
        <div class="support-title">
          <LifeBuoy :size="21" />
          <div>
            <h2>客服与试点反馈</h2>
            <p>正式帮助域名上线后会承接在线客服、问题分类和工单状态追踪。</p>
          </div>
        </div>
        <ul class="support-list">
          <li v-for="item in supportChecklist" :key="item">{{ item }}</li>
        </ul>
      </div>
    </section>
  </main>
</template>

<style scoped>
.intro-band { padding: 30px 0; background: #ffffff; border-bottom: 1px solid var(--line); }
.intro-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 460px); align-items: center; gap: 28px; }
.intro-copy { display: grid; align-content: start; gap: 12px; }
.intro-copy h1 { margin: 0; color: var(--ink); font-size: clamp(2rem, 5vw, 3.2rem); line-height: 1.05; letter-spacing: 0; }
.intro-copy p { max-width: 650px; margin: 0; color: var(--muted); font-size: 1.02rem; }
.search-panel { display: grid; gap: 12px; padding: 16px; border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; box-shadow: var(--shadow-page); }
.search-box { display: grid; grid-template-columns: 22px minmax(0, 1fr); align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--muted); }
.search-box input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink); }
.quick-links { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.quick-link { display: grid; min-height: 68px; align-content: center; justify-items: center; gap: 6px; padding: 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); color: var(--ink); font-size: .78rem; font-weight: 760; text-align: center; }
.quick-link:hover { border-color: #bfe3dd; background: #e8f7f4; color: var(--accent-strong); }
.section-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.section-head h2, .support-title h2 { margin: 0; color: var(--ink); font-size: 1.2rem; letter-spacing: 0; }
.section-head p, .support-title p { margin: 4px 0 0; color: var(--muted); }
.text-action { display: inline-flex; min-height: 34px; align-items: center; gap: 5px; padding: 6px 9px; border-radius: 6px; color: var(--accent-strong); font-size: .84rem; font-weight: 800; white-space: nowrap; }
.article-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.article-card { display: grid; align-content: start; gap: 9px; min-height: 190px; padding: 15px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); box-shadow: 0 2px 10px rgba(20, 32, 46, .04); }
.article-card:hover { border-color: #bfe3dd; }
.article-card h3 { margin: 0; color: var(--ink); font-size: 1rem; letter-spacing: 0; }
.article-card p { margin: 0; color: var(--muted); font-size: .9rem; }
.article-card small { margin-top: auto; color: var(--plum); font-weight: 760; }
.article-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--soft); font-size: .72rem; }
.empty-state { padding: 16px; border: 1px dashed var(--line); border-radius: 8px; color: var(--muted); text-align: center; }
.future-list { display: grid; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--panel); }
.future-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.future-row:last-child { border-bottom: 0; }
.future-row h3 { margin: 0; font-size: .96rem; letter-spacing: 0; }
.future-row p { margin: 3px 0 0; color: var(--muted); font-size: .88rem; }
.support-band { padding: 28px 0 34px; background: #edf7f4; border-top: 1px solid #bfe3dd; }
.support-grid { display: grid; grid-template-columns: minmax(0, .75fr) minmax(0, 1fr); gap: 24px; }
.support-title { display: flex; align-items: flex-start; gap: 10px; color: var(--accent-strong); }
.support-list { display: grid; gap: 8px; margin: 0; padding-left: 20px; color: var(--ink); }
.support-list li::marker { color: var(--accent); }
@media (max-width: 900px) {
  .intro-grid, .support-grid { grid-template-columns: 1fr; }
  .article-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 620px) {
  .intro-band { padding: 22px 0; }
  .quick-links, .article-grid { grid-template-columns: 1fr; }
  .section-head { align-items: start; flex-direction: column; }
  .future-row { grid-template-columns: 1fr; }
}
</style>
