<script setup lang="ts">
import { ArrowLeft, Clock3, ShieldCheck } from '@lucide/vue'
import { findArticle } from '~/data/helpContent'

const route = useRoute()
const slug = String(route.params.slug || '')
const article = findArticle(slug)

if (!article) {
  throw createError({ statusCode: 404, statusMessage: '未找到帮助文档' })
}

useSeoMeta({
  title: `${article.title} | SPdex 帮助中心`,
  description: article.summary,
})
</script>

<template>
  <main class="article-page">
    <article class="page-shell article-layout">
      <aside class="article-side">
        <NuxtLink class="back-link focus-ring" to="/ai">
          <ArrowLeft :size="15" />
          <span>返回 AI 专区</span>
        </NuxtLink>
        <div class="article-facts">
          <span :class="['status-pill', article.status === '试点' ? 'trial' : article.status === '安全' ? 'live' : '']">{{ article.status }}</span>
          <span><Clock3 :size="14" /> {{ article.readMinutes }} 分钟</span>
          <span><ShieldCheck :size="14" /> {{ article.audience }}</span>
        </div>
      </aside>

      <div class="article-main">
        <header class="article-head">
          <h1>{{ article.title }}</h1>
          <p>{{ article.summary }}</p>
        </header>

        <section v-for="section in article.sections" :key="section.heading" class="article-section">
          <h2>{{ section.heading }}</h2>
          <p v-for="paragraph in section.body" :key="paragraph">{{ paragraph }}</p>

          <ul v-if="section.bullets?.length" class="bullet-list">
            <li v-for="bullet in section.bullets" :key="bullet">{{ bullet }}</li>
          </ul>

          <div v-if="section.examples?.length" class="example-block">
            <b>示例问题</b>
            <code v-for="example in section.examples" :key="example">{{ example }}</code>
          </div>
        </section>
      </div>
    </article>
  </main>
</template>

<style scoped>
.article-page { padding: 28px 0 36px; }
.article-layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 28px; align-items: start; }
.article-side { position: sticky; top: 84px; display: grid; gap: 12px; }
.back-link { display: inline-flex; min-height: 34px; align-items: center; gap: 6px; padding: 6px 9px; border-radius: 6px; color: var(--accent-strong); font-weight: 800; }
.article-facts { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
.article-facts > span:not(.status-pill) { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: .82rem; }
.article-main { min-width: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); box-shadow: 0 2px 12px rgba(20, 32, 46, .05); }
.article-head { padding: 26px 28px; border-bottom: 1px solid var(--line); }
.article-head h1 { margin: 0; color: var(--ink); font-size: clamp(1.8rem, 4vw, 2.5rem); line-height: 1.12; letter-spacing: 0; }
.article-head p { max-width: 720px; margin: 10px 0 0; color: var(--muted); font-size: 1rem; }
.article-section { display: grid; gap: 10px; padding: 22px 28px; border-bottom: 1px solid var(--line); }
.article-section:last-child { border-bottom: 0; }
.article-section h2 { margin: 0; color: var(--ink); font-size: 1.13rem; letter-spacing: 0; }
.article-section p { margin: 0; color: #263248; }
.bullet-list { display: grid; gap: 6px; margin: 2px 0 0; padding-left: 20px; color: #263248; }
.bullet-list li::marker { color: var(--accent); }
.example-block { display: grid; gap: 7px; margin-top: 2px; padding: 12px; border: 1px solid #f5d7a6; border-radius: 8px; background: #fff7ed; }
.example-block b { color: var(--amber); font-size: .84rem; }
.example-block code { display: block; padding: 8px 9px; border: 1px solid #f0ddbd; border-radius: 6px; background: #ffffff; color: var(--ink); font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace; font-size: .84rem; white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 860px) {
  .article-layout { grid-template-columns: 1fr; gap: 14px; }
  .article-side { position: static; }
  .article-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .article-page { padding-top: 18px; }
  .article-head, .article-section { padding-left: 16px; padding-right: 16px; }
  .article-facts { grid-template-columns: 1fr; }
}
</style>
