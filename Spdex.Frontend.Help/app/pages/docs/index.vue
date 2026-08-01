<script setup lang="ts">
import { ArrowRight, BookOpen, Filter, Search, X } from '@lucide/vue'
import type { HelpCategoryId, HelpLevel } from '~/data/helpContent'
import { getArticlePath, helpArticles, helpCategories } from '~/data/helpContent'

const query = ref('')
const selectedCategory = ref<'all' | HelpCategoryId>('all')
const selectedLevel = ref<'all' | HelpLevel>('all')
const levels: Array<'all' | HelpLevel> = ['all', '入门', '进阶', '专家']

const categoryOptions = computed(() => [
  { id: 'all' as const, title: '全部主题', count: helpArticles.length },
  ...helpCategories.map(category => ({
    id: category.id,
    title: category.title,
    count: helpArticles.filter(article => article.category === category.id).length,
  })),
])

const filteredArticles = computed(() => {
  const q = query.value.trim().toLowerCase()
  return helpArticles.filter((article) => {
    const categoryMatch = selectedCategory.value === 'all' || article.category === selectedCategory.value
    const levelMatch = selectedLevel.value === 'all' || article.level === selectedLevel.value
    const text = [
      article.title,
      article.summary,
      article.audience,
      article.level,
      ...article.tags,
      ...article.sections.flatMap(section => [
        section.heading,
        ...section.body,
        ...(section.bullets ?? []),
        ...(section.steps ?? []),
        ...(section.examples ?? []),
      ]),
    ].join(' ').toLowerCase()
    return categoryMatch && levelMatch && (!q || text.includes(q))
  })
})

const activeCategoryTitle = computed(() => (
  selectedCategory.value === 'all'
    ? '全部文档'
    : helpCategories.find(category => category.id === selectedCategory.value)?.title || '文档'
))

const hasFilters = computed(() => Boolean(query.value.trim()) || selectedCategory.value !== 'all' || selectedLevel.value !== 'all')

function levelLabel(level: 'all' | HelpLevel) {
  return level === 'all' ? '全部难度' : level
}

function categoryName(categoryId: HelpCategoryId) {
  return helpCategories.find(category => category.id === categoryId)?.title || categoryId
}

function resetFilters() {
  query.value = ''
  selectedCategory.value = 'all'
  selectedLevel.value = 'all'
}

useSeoMeta({
  title: '文档库 | SPdex 帮助中心',
  description: 'SPdex 帮助中心文档库，覆盖 AI、MCP、必发指数、Poly 指数、现场数据、竞彩模型、比分和闪Q。',
})
</script>

<template>
  <main class="docs-page">
    <section class="docs-head">
      <div class="page-shell docs-head-inner">
        <div class="docs-title">
          <span class="eyebrow">Documentation</span>
          <h1>文档库</h1>
          <p>按产品入口、指标名称或使用场景查找说明。每篇文档都会标注适用主题、难度和建议阅读时间。</p>
        </div>

        <div class="docs-search" role="search">
          <Search :size="18" />
          <input v-model="query" type="search" maxlength="80" placeholder="搜索 必发、Poly、共振、锁仓、xG、比分、闪Q">
          <button v-if="query" class="clear-search focus-ring" type="button" aria-label="清空搜索" @click="query = ''">
            <X :size="15" />
          </button>
        </div>
      </div>
    </section>

    <section class="page-shell docs-body">
      <aside class="filter-panel" aria-label="文档筛选">
        <div class="filter-title">
          <Filter :size="16" />
          <b>筛选</b>
        </div>

        <div class="filter-group">
          <span>主题</span>
          <button
            v-for="category in categoryOptions"
            :key="category.id"
            class="filter-button focus-ring"
            :class="{ active: selectedCategory === category.id }"
            type="button"
            @click="selectedCategory = category.id"
          >
            <span>{{ category.title }}</span>
            <small>{{ category.count }}</small>
          </button>
        </div>

        <div class="filter-group compact">
          <span>难度</span>
          <button
            v-for="level in levels"
            :key="level"
            class="filter-button focus-ring"
            :class="{ active: selectedLevel === level }"
            type="button"
            @click="selectedLevel = level"
          >
            <span>{{ levelLabel(level) }}</span>
          </button>
        </div>
      </aside>

      <div class="docs-results">
        <div class="results-head">
          <div>
            <h2>{{ activeCategoryTitle }}</h2>
            <p>当前显示 {{ filteredArticles.length }} 篇。</p>
          </div>
          <button v-if="hasFilters" class="reset-button focus-ring" type="button" @click="resetFilters">
            清空筛选
          </button>
        </div>

        <div class="doc-list">
          <NuxtLink
            v-for="article in filteredArticles"
            :key="article.slug"
            class="doc-row focus-ring"
            :to="getArticlePath(article)"
          >
            <div class="doc-main">
              <div class="doc-meta">
                <span>{{ categoryName(article.category) }}</span>
                <span>{{ article.level }}</span>
                <span>{{ article.readMinutes }} 分钟</span>
              </div>
              <h3>{{ article.title }}</h3>
              <p>{{ article.summary }}</p>
              <div class="tag-line">
                <span v-for="tag in article.tags.slice(0, 4)" :key="tag">{{ tag }}</span>
              </div>
            </div>
            <div class="doc-tail">
              <BookOpen :size="17" />
              <ArrowRight :size="16" />
            </div>
          </NuxtLink>
        </div>

        <div v-if="!filteredArticles.length" class="empty-state">
          没有匹配文档。可以换一个关键词，或清空筛选后重新查找。
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.docs-page { padding-bottom: 32px; }
.docs-head { padding: 34px 0 30px; border-bottom: 1px solid var(--line); background: #fff; }
.docs-head-inner { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 460px); gap: 26px; align-items: end; }
.docs-title { display: grid; gap: 10px; max-width: 720px; }
.eyebrow { color: var(--accent-strong); font-size: .78rem; font-weight: 820; letter-spacing: .08em; text-transform: uppercase; }
.docs-title h1 { margin: 0; color: var(--ink); font-size: clamp(2.2rem, 5vw, 3.2rem); line-height: 1.08; letter-spacing: 0; }
.docs-title p { margin: 0; color: var(--muted); font-size: 1rem; }
.docs-search { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 48px; padding: 0 12px; border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; color: var(--muted); }
.docs-search input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink); }
.clear-search { display: inline-grid; width: 26px; height: 26px; place-items: center; border: 0; border-radius: 999px; background: transparent; color: var(--muted); }
.clear-search:hover { background: #edf2f7; color: var(--ink); }
.docs-body { display: grid; grid-template-columns: 238px minmax(0, 1fr); gap: 18px; padding-top: 22px; }
.filter-panel { position: sticky; top: 82px; display: grid; align-content: start; gap: 16px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
.filter-title { display: flex; align-items: center; gap: 8px; color: var(--ink); }
.filter-group { display: grid; gap: 7px; }
.filter-group > span { color: var(--soft); font-size: .74rem; font-weight: 780; }
.filter-button { display: flex; min-height: 34px; align-items: center; justify-content: space-between; gap: 8px; border: 1px solid transparent; border-radius: 6px; padding: 6px 8px; background: transparent; color: var(--muted); text-align: left; font-size: .86rem; font-weight: 720; }
.filter-button small { color: var(--soft); font-size: .72rem; }
.filter-button:hover, .filter-button.active { border-color: #bfe3dd; background: #e8f7f4; color: var(--accent-strong); }
.filter-button.active small { color: var(--accent-strong); }
.docs-results { min-width: 0; display: grid; gap: 12px; }
.results-head { display: flex; justify-content: space-between; gap: 16px; align-items: end; }
.results-head h2 { margin: 0; color: var(--ink); font-size: 1.14rem; letter-spacing: 0; }
.results-head p { margin: 3px 0 0; color: var(--muted); }
.reset-button { min-height: 32px; padding: 5px 9px; border: 1px solid var(--line); border-radius: 6px; background: #fff; color: var(--muted); font-size: .82rem; font-weight: 760; white-space: nowrap; }
.reset-button:hover { color: var(--accent-strong); border-color: #bfe3dd; }
.doc-list { display: grid; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; background: var(--panel); }
.doc-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 16px; border-bottom: 1px solid var(--line); }
.doc-row:last-child { border-bottom: 0; }
.doc-row:hover { background: #f8fafc; }
.doc-main { min-width: 0; display: grid; gap: 7px; }
.doc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; color: var(--soft); font-size: .74rem; font-weight: 740; }
.doc-meta span + span::before { content: '·'; margin-right: 7px; color: #c1cad8; }
.doc-row h3 { margin: 0; color: var(--ink); font-size: 1rem; letter-spacing: 0; }
.doc-row p { max-width: 820px; margin: 0; color: var(--muted); font-size: .9rem; }
.tag-line { display: flex; flex-wrap: wrap; gap: 5px; }
.tag-line span { padding: 2px 7px; border-radius: 999px; background: #f1f5f9; color: var(--muted); font-size: .72rem; }
.doc-tail { display: inline-flex; align-items: center; gap: 8px; color: var(--accent-strong); }
.empty-state { padding: 16px; border: 1px dashed var(--line); border-radius: 8px; color: var(--muted); text-align: center; }
@media (max-width: 860px) {
  .docs-head-inner, .docs-body { grid-template-columns: 1fr; }
  .filter-panel { position: static; }
  .filter-group { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .filter-group > span { grid-column: 1 / -1; }
}
@media (max-width: 560px) {
  .docs-head { padding: 26px 0; }
  .filter-panel { gap: 10px; }
  .filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }
  .filter-group::-webkit-scrollbar { display: none; }
  .filter-group > span { flex: 0 0 auto; min-width: 42px; }
  .filter-button { flex: 0 0 auto; white-space: nowrap; }
  .doc-row { grid-template-columns: 1fr; }
  .doc-tail { justify-content: space-between; }
}
</style>
