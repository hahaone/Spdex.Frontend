<script setup lang="ts">
import { ArrowLeft, BookOpen, Clock3, Layers, ListChecks, Tags } from '@lucide/vue'
import type { HelpArticle } from '~/data/helpContent'
import { getArticlePath, getCategory, getRelatedArticles } from '~/data/helpContent'

const props = withDefaults(defineProps<{
  article: HelpArticle
  backTo?: string
  backLabel?: string
}>(), {
  backTo: '/docs',
  backLabel: '返回文档库',
})

const category = computed(() => getCategory(props.article.category))
const relatedArticles = computed(() => getRelatedArticles(props.article))
const toc = computed(() => props.article.sections.map((section, index) => ({
  id: sectionId(index),
  heading: section.heading,
})))

function sectionId(index: number) {
  return `section-${index + 1}`
}

</script>

<template>
  <main class="article-page">
    <article class="page-shell article-layout">
      <aside class="article-side">
        <NuxtLink class="back-link focus-ring" :to="backTo">
          <ArrowLeft :size="15" />
          <span>{{ backLabel }}</span>
        </NuxtLink>

        <div class="article-facts">
          <span><Clock3 :size="14" /> {{ article.readMinutes }} 分钟</span>
          <span><Layers :size="14" /> {{ category?.title || article.category }}</span>
          <span><BookOpen :size="14" /> {{ article.level }}</span>
        </div>

        <nav v-if="toc.length > 1" class="toc-panel" aria-label="文章目录">
          <b>本文目录</b>
          <a v-for="item in toc" :key="item.id" class="focus-ring" :href="`#${item.id}`">{{ item.heading }}</a>
        </nav>
      </aside>

      <div class="article-main">
        <header class="article-head">
          <div class="article-kicker">
            <span>{{ category?.eyebrow || '帮助文档' }}</span>
            <span>更新 {{ article.updated }}</span>
          </div>
          <h1>{{ article.title }}</h1>
          <p>{{ article.summary }}</p>
          <div class="article-tags" aria-label="标签">
            <span v-for="tag in article.tags" :key="tag">
              <Tags :size="13" />
              {{ tag }}
            </span>
          </div>
        </header>

        <section
          v-for="(section, sectionIndex) in article.sections"
          :id="sectionId(sectionIndex)"
          :key="section.heading"
          class="article-section"
        >
          <h2>{{ section.heading }}</h2>
          <p v-for="(paragraph, paragraphIndex) in section.body" :key="`${section.heading}-p-${paragraphIndex}`">
            {{ paragraph }}
          </p>

          <div v-if="section.metrics?.length" class="metric-grid">
            <div v-for="metric in section.metrics" :key="metric.label" class="metric-item">
              <strong>{{ metric.value }}</strong>
              <b>{{ metric.label }}</b>
              <span>{{ metric.description }}</span>
            </div>
          </div>

          <ol v-if="section.steps?.length" class="step-list">
            <li v-for="step in section.steps" :key="step">{{ step }}</li>
          </ol>

          <ul v-if="section.bullets?.length" class="bullet-list">
            <li v-for="bullet in section.bullets" :key="bullet">{{ bullet }}</li>
          </ul>

          <div v-if="section.table" class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th v-for="header in section.table.headers" :key="header">{{ header }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, rowIndex) in section.table.rows" :key="rowIndex">
                  <td v-for="(cell, cellIndex) in row" :key="`${rowIndex}-${cellIndex}`">{{ cell }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="section.examples?.length" class="example-block">
            <b>示例问题</b>
            <code v-for="example in section.examples" :key="example">{{ example }}</code>
          </div>

          <div v-if="section.callout" :class="['callout', section.callout.tone || 'info']">
            <ListChecks :size="17" />
            <div>
              <b>{{ section.callout.title }}</b>
              <p>{{ section.callout.body }}</p>
            </div>
          </div>
        </section>

        <footer class="article-foot">
          <div v-if="relatedArticles.length" class="related-panel">
            <b>相关文档</b>
            <div class="related-list">
              <NuxtLink
                v-for="related in relatedArticles"
                :key="related.slug"
                class="related-link focus-ring"
                :to="getArticlePath(related)"
              >
                <span>{{ related.title }}</span>
                <small>{{ related.summary }}</small>
              </NuxtLink>
            </div>
          </div>
        </footer>
      </div>
    </article>
  </main>
</template>

<style scoped>
.article-page { padding: 28px 0 36px; }
.article-layout { display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 28px; align-items: start; }
.article-side { position: sticky; top: 84px; display: grid; gap: 12px; }
.back-link { display: inline-flex; min-height: 34px; align-items: center; gap: 6px; padding: 6px 9px; border-radius: 6px; color: var(--accent-strong); font-weight: 800; }
.article-facts, .toc-panel { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
.article-facts > span { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: .82rem; }
.toc-panel b { color: var(--ink); font-size: .84rem; }
.toc-panel a { border-radius: 5px; padding: 5px 6px; color: var(--muted); font-size: .82rem; line-height: 1.35; }
.toc-panel a:hover { background: #f1f5f9; color: var(--accent-strong); }
.article-main { min-width: 0; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); box-shadow: 0 2px 12px rgba(20, 32, 46, .05); overflow: hidden; }
.article-head { display: grid; gap: 11px; padding: 26px 28px; border-bottom: 1px solid var(--line); background: #fbfcfd; }
.article-kicker { display: flex; flex-wrap: wrap; gap: 10px; color: var(--soft); font-size: .78rem; font-weight: 760; }
.article-head h1 { margin: 0; color: var(--ink); font-size: clamp(1.8rem, 4vw, 2.45rem); line-height: 1.12; letter-spacing: 0; }
.article-head p { max-width: 760px; margin: 0; color: var(--muted); font-size: 1rem; }
.article-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.article-tags span { display: inline-flex; min-height: 25px; align-items: center; gap: 4px; padding: 3px 8px; border: 1px solid var(--line); border-radius: 999px; background: #fff; color: var(--muted); font-size: .74rem; font-weight: 720; }
.article-section { display: grid; gap: 10px; padding: 22px 28px; border-bottom: 1px solid var(--line); scroll-margin-top: 86px; }
.article-section h2 { margin: 0; color: var(--ink); font-size: 1.13rem; letter-spacing: 0; }
.article-section p { margin: 0; color: #263248; }
.bullet-list, .step-list { display: grid; gap: 7px; margin: 2px 0 0; padding-left: 20px; color: #263248; }
.bullet-list li::marker, .step-list li::marker { color: var(--accent); font-weight: 800; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 2px; }
.metric-item { display: grid; gap: 3px; padding: 11px; border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; }
.metric-item strong { color: var(--accent-strong); font-size: .94rem; }
.metric-item b { color: var(--ink); font-size: .83rem; }
.metric-item span { color: var(--muted); font-size: .78rem; line-height: 1.45; }
.table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
table { width: 100%; min-width: 620px; border-collapse: collapse; background: #fff; }
th, td { padding: 10px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
th { background: #f1f5f9; color: var(--ink); font-size: .82rem; }
td { color: #263248; font-size: .86rem; }
tr:last-child td { border-bottom: 0; }
.example-block { display: grid; gap: 7px; margin-top: 2px; padding: 12px; border: 1px solid #f5d7a6; border-radius: 8px; background: #fff7ed; }
.example-block b { color: var(--amber); font-size: .84rem; }
.example-block code { display: block; padding: 8px 9px; border: 1px solid #f0ddbd; border-radius: 6px; background: #ffffff; color: var(--ink); font-family: 'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace; font-size: .84rem; white-space: pre-wrap; overflow-wrap: anywhere; }
.callout { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 9px; margin-top: 4px; padding: 12px; border-radius: 8px; border: 1px solid #cbd5e1; background: #f8fafc; color: var(--ink); }
.callout svg { margin-top: 2px; color: var(--accent-strong); }
.callout b { display: block; margin-bottom: 2px; color: var(--ink); }
.callout p { color: var(--muted); }
.callout.warning { border-color: #f5d7a6; background: #fff7ed; }
.callout.warning svg { color: var(--amber); }
.callout.success { border-color: #bfe3dd; background: #e8f7f4; }
.article-foot { display: grid; gap: 14px; padding: 18px 28px 24px; background: #fbfcfd; }
.related-panel > b { color: var(--ink); }
.related-panel { display: grid; gap: 9px; }
.related-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.related-link { display: grid; gap: 4px; min-height: 96px; padding: 11px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.related-link:hover { border-color: #bfe3dd; background: #f3fbf9; }
.related-link span { color: var(--ink); font-weight: 820; }
.related-link small { color: var(--muted); font-size: .78rem; line-height: 1.45; }
@media (max-width: 920px) {
  .article-layout { grid-template-columns: 1fr; gap: 14px; }
  .article-side { position: static; }
  .article-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .toc-panel { display: none; }
  .metric-grid, .related-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .article-page { padding-top: 18px; }
  .article-head, .article-section, .article-foot { padding-left: 16px; padding-right: 16px; }
  .article-facts, .metric-grid, .related-list { grid-template-columns: 1fr; }
  table { min-width: 560px; }
}
</style>
