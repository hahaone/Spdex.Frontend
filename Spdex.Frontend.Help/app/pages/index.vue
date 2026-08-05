<script setup lang="ts">
import { ArrowRight, BookOpen, Bot, LifeBuoy, Search, ShieldCheck } from '@lucide/vue'
import type { HelpArticle, HelpCategoryId } from '~/data/helpContent'
import {
  findArticle,
  getArticlePath,
  glossaryTerms,
  helpArticles,
  helpCategories,
  learningPaths,
  supportChecklist,
} from '~/data/helpContent'

const query = ref('')
const selectedCategory = ref<'all' | HelpCategoryId>('all')

const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const activeArticles = computed(() => {
  const q = normalizedQuery.value
  return helpArticles.filter((article) => {
    const categoryMatch = selectedCategory.value === 'all' || article.category === selectedCategory.value
    const searchableText = [
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

    return categoryMatch && (!q || searchableText.includes(q))
  })
})

const spotlightArticles = computed(() => [
  'betfair-basics',
  'poly-index',
  'live-data-xg',
  'jc-studio-models',
  'ai-watch-assistant',
  'mcp-quickstart',
  'ai-mcp-usage-quota',
].map(slug => findArticle(slug)).filter((article): article is HelpArticle => Boolean(article)))

const shownArticles = computed(() => (
  normalizedQuery.value || selectedCategory.value !== 'all'
    ? activeArticles.value.slice(0, 6)
    : spotlightArticles.value
))

const categoryPanels = computed(() => helpCategories.map(category => {
  const articles = helpArticles.filter(article => article.category === category.id)
  return {
    ...category,
    count: articles.length,
    articles: articles.slice(0, 2),
  }
}))

const pathCards = computed(() => learningPaths.map(path => ({
  ...path,
  articles: path.articleSlugs
    .map(slug => findArticle(slug))
    .filter((article): article is HelpArticle => Boolean(article)),
})))

const quickQuestions = [
  { label: '必发买卖怎么看', to: '/docs/betfair-basics' },
  { label: 'Poly 大热代表什么', to: '/docs/poly-index' },
  { label: '现场 xG 怎么使用', to: '/docs/live-data-xg' },
  { label: 'AI 助手可以问什么', to: '/ai/ai-watch-assistant' },
  { label: 'AI / MCP 会如何计量', to: '/ai/ai-mcp-usage-quota' },
]

function categoryName(categoryId: HelpCategoryId) {
  return helpCategories.find(category => category.id === categoryId)?.title || categoryId
}

useSeoMeta({
  title: 'SPdex 帮助中心',
  description: 'SPdex 帮助中心，覆盖 AI 观察助手、MCP、必发指数、Poly 指数、现场数据、竞彩模型、比分和闪Q。',
})
</script>

<template>
  <main>
    <section class="hero">
      <div class="page-shell hero-grid">
        <div class="hero-copy">
          <span class="eyebrow">SPdex Help Center</span>
          <h1>SPdex 使用帮助</h1>
          <p>从必发、Poly、现场数据到 AI 观察助手，按使用场景查找操作方法、指标含义和阅读边界。</p>
          <div class="hero-actions">
            <NuxtLink class="primary-action focus-ring" to="/docs">
              <BookOpen :size="17" />
              <span>浏览文档库</span>
            </NuxtLink>
            <NuxtLink class="secondary-action focus-ring" to="/ai">
              <Bot :size="17" />
              <span>AI 与 MCP</span>
            </NuxtLink>
          </div>
        </div>

        <div class="hero-search" role="search">
          <label for="home-search">搜索帮助内容</label>
          <div class="search-box">
            <Search :size="18" />
            <input id="home-search" v-model="query" type="search" maxlength="80" placeholder="输入指标、页面或问题，例如：锁仓、xG、比分、闪Q">
          </div>
          <div class="quick-questions" aria-label="常见问题">
            <NuxtLink v-for="item in quickQuestions" :key="item.to" class="focus-ring" :to="item.to">
              {{ item.label }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <section class="page-shell page-section">
      <div class="section-head">
        <div>
          <h2>{{ normalizedQuery || selectedCategory !== 'all' ? '查找结果' : '常用文档' }}</h2>
          <p>{{ normalizedQuery || selectedCategory !== 'all' ? `当前显示 ${activeArticles.length} 篇匹配内容。` : '优先阅读这些文档，可以快速建立 SPdex 的基础使用框架。' }}</p>
        </div>
        <NuxtLink class="text-action focus-ring" to="/docs">
          <span>进入文档库</span>
          <ArrowRight :size="15" />
        </NuxtLink>
      </div>

      <div class="category-strip" aria-label="筛选分类">
        <button
          class="category-chip focus-ring"
          :class="{ active: selectedCategory === 'all' }"
          type="button"
          @click="selectedCategory = 'all'"
        >
          全部
        </button>
        <button
          v-for="category in helpCategories"
          :key="category.id"
          class="category-chip focus-ring"
          :class="{ active: selectedCategory === category.id }"
          type="button"
          @click="selectedCategory = category.id"
        >
          {{ category.title }}
        </button>
      </div>

      <div class="article-list">
        <NuxtLink
          v-for="article in shownArticles"
          :key="article.slug"
          class="article-row focus-ring"
          :to="getArticlePath(article)"
        >
          <div class="article-row-copy">
            <span>{{ categoryName(article.category) }} · {{ article.level }} · {{ article.readMinutes }} 分钟</span>
            <h3>{{ article.title }}</h3>
            <p>{{ article.summary }}</p>
          </div>
          <ArrowRight :size="17" />
        </NuxtLink>
      </div>

      <div v-if="!shownArticles.length" class="empty-state">
        没有找到匹配内容。可以换一个关键词，或清空分类筛选。
      </div>
    </section>

    <section class="page-shell page-section">
      <div class="section-head">
        <div>
          <h2>按场景查找</h2>
          <p>从你正在使用的入口开始，进入对应专题。</p>
        </div>
      </div>

      <div class="category-grid">
        <article v-for="category in categoryPanels" :key="category.id" class="category-panel">
          <header>
            <span>{{ category.eyebrow }}</span>
            <strong>{{ category.count }} 篇</strong>
          </header>
          <h3>{{ category.title }}</h3>
          <p>{{ category.summary }}</p>
          <div class="category-links">
            <NuxtLink
              v-for="article in category.articles"
              :key="article.slug"
              class="focus-ring"
              :to="getArticlePath(article)"
            >
              {{ article.title }}
            </NuxtLink>
          </div>
        </article>
      </div>
    </section>

    <section class="page-shell page-section learning-section">
      <div class="learning-col">
        <div class="section-head compact">
          <div>
            <h2>推荐阅读顺序</h2>
            <p>按目标选择路径，不需要从头读完所有文档。</p>
          </div>
        </div>

        <div class="path-list">
          <article v-for="path in pathCards" :key="path.title" class="path-row">
            <h3>{{ path.title }}</h3>
            <p>{{ path.summary }}</p>
            <ol>
              <li v-for="article in path.articles" :key="article.slug">
                <NuxtLink class="focus-ring" :to="getArticlePath(article)">{{ article.title }}</NuxtLink>
              </li>
            </ol>
          </article>
        </div>
      </div>

      <aside class="term-panel">
        <h2>术语速查</h2>
        <p>先统一高频指标口径，再进入具体文章。</p>
        <dl>
          <template v-for="term in glossaryTerms.slice(0, 6)" :key="term.term">
            <dt>{{ term.term }}</dt>
            <dd>{{ term.definition }}</dd>
          </template>
        </dl>
      </aside>
    </section>

    <section class="support-band">
      <div class="page-shell support-grid">
        <div class="support-title">
          <LifeBuoy :size="21" />
          <div>
            <h2>需要帮助时</h2>
            <p>反馈问题时提供足够上下文，便于客服或技术支持定位。</p>
          </div>
        </div>
        <ul class="support-list">
          <li v-for="item in supportChecklist" :key="item">{{ item }}</li>
        </ul>
        <div class="support-safe">
          <ShieldCheck :size="18" />
          <span>指数、模型和 AI 结果用于市场观察，不构成投注建议或收益承诺。</span>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.hero { padding: 44px 0 36px; border-bottom: 1px solid var(--line); background: #fff; }
.hero-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, 460px); gap: 38px; align-items: center; }
.hero-copy { display: grid; gap: 14px; max-width: 720px; }
.eyebrow { color: var(--accent-strong); font-size: .78rem; font-weight: 820; letter-spacing: .08em; text-transform: uppercase; }
.hero-copy h1 { margin: 0; color: var(--ink); font-size: clamp(2.2rem, 5vw, 3.7rem); line-height: 1.06; letter-spacing: 0; }
.hero-copy p { max-width: 680px; margin: 0; color: var(--muted); font-size: 1.05rem; }
.hero-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 4px; }
.primary-action, .secondary-action { display: inline-flex; min-height: 40px; align-items: center; gap: 7px; padding: 8px 13px; border-radius: 6px; font-size: .9rem; font-weight: 800; }
.primary-action { border: 1px solid var(--accent-strong); background: var(--accent-strong); color: #fff; }
.secondary-action { border: 1px solid var(--line); background: #fff; color: var(--ink); }
.hero-search { display: grid; gap: 12px; padding: 18px; border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; box-shadow: var(--shadow-page); }
.hero-search label { color: var(--ink); font-weight: 820; }
.search-box { display: grid; grid-template-columns: 22px minmax(0, 1fr); align-items: center; gap: 8px; min-height: 48px; padding: 0 13px; border: 1px solid var(--line); border-radius: 6px; background: #fff; color: var(--muted); }
.search-box input { width: 100%; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--ink); }
.quick-questions { display: flex; flex-wrap: wrap; gap: 8px; }
.quick-questions a { min-height: 30px; padding: 5px 9px; border: 1px solid var(--line); border-radius: 999px; background: #fff; color: var(--muted); font-size: .82rem; font-weight: 720; }
.quick-questions a:hover { border-color: #bfe3dd; color: var(--accent-strong); }
.section-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.section-head.compact { margin-bottom: 12px; }
.section-head h2, .support-title h2, .term-panel h2 { margin: 0; color: var(--ink); font-size: 1.22rem; letter-spacing: 0; }
.section-head p, .support-title p, .term-panel p { margin: 4px 0 0; color: var(--muted); }
.text-action { display: inline-flex; min-height: 34px; align-items: center; gap: 5px; padding: 6px 9px; border-radius: 6px; color: var(--accent-strong); font-size: .84rem; font-weight: 800; white-space: nowrap; }
.category-strip { display: flex; gap: 8px; margin-bottom: 12px; overflow-x: auto; scrollbar-width: none; }
.category-strip::-webkit-scrollbar { display: none; }
.category-chip { flex: 0 0 auto; min-height: 34px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 999px; background: #fff; color: var(--muted); font-size: .84rem; font-weight: 760; }
.category-chip:hover, .category-chip.active { border-color: #bfe3dd; background: #e8f7f4; color: var(--accent-strong); }
.article-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.article-row { display: grid; grid-template-columns: minmax(0, 1fr) 22px; gap: 12px; align-items: center; min-height: 132px; padding: 15px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.article-row:hover { border-color: #bfe3dd; background: #fbfffe; }
.article-row svg { color: var(--accent-strong); }
.article-row-copy { min-width: 0; display: grid; gap: 5px; }
.article-row-copy span { color: var(--soft); font-size: .76rem; font-weight: 760; }
.article-row h3 { margin: 0; color: var(--ink); font-size: 1rem; letter-spacing: 0; }
.article-row p { margin: 0; color: var(--muted); font-size: .88rem; }
.empty-state { padding: 16px; border: 1px dashed var(--line); border-radius: 8px; color: var(--muted); text-align: center; }
.category-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.category-panel { display: grid; align-content: start; gap: 8px; min-height: 230px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.category-panel header { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--soft); font-size: .76rem; font-weight: 780; }
.category-panel header strong { color: var(--accent-strong); }
.category-panel h3 { margin: 0; color: var(--ink); font-size: 1rem; letter-spacing: 0; }
.category-panel p { margin: 0; color: var(--muted); font-size: .86rem; }
.category-links { display: grid; gap: 6px; margin-top: auto; }
.category-links a { border-radius: 5px; color: var(--accent-strong); font-size: .82rem; font-weight: 760; line-height: 1.35; }
.category-links a:hover { text-decoration: underline; text-underline-offset: 3px; }
.learning-section { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 18px; align-items: start; }
.path-list { display: grid; gap: 10px; }
.path-row { display: grid; gap: 8px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.path-row h3 { margin: 0; color: var(--ink); font-size: 1rem; letter-spacing: 0; }
.path-row p { margin: 0; color: var(--muted); font-size: .88rem; }
.path-row ol { display: grid; gap: 5px; margin: 2px 0 0; padding-left: 20px; }
.path-row li::marker { color: var(--accent); font-weight: 800; }
.path-row a { border-radius: 5px; color: var(--accent-strong); font-weight: 760; }
.term-panel { display: grid; gap: 10px; padding: 16px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
.term-panel dl { display: grid; gap: 8px; margin: 0; }
.term-panel dt { color: var(--ink); font-weight: 820; }
.term-panel dd { margin: -6px 0 0; color: var(--muted); font-size: .84rem; }
.support-band { padding: 28px 0 34px; background: #edf7f4; border-top: 1px solid #bfe3dd; }
.support-grid { display: grid; grid-template-columns: minmax(0, .7fr) minmax(0, 1fr); gap: 20px; align-items: start; }
.support-title { display: flex; align-items: flex-start; gap: 10px; color: var(--accent-strong); }
.support-list { display: grid; gap: 8px; margin: 0; padding-left: 20px; color: var(--ink); }
.support-list li::marker { color: var(--accent); }
.support-safe { grid-column: 1 / -1; display: inline-flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid #bfe3dd; border-radius: 8px; background: #fff; color: var(--accent-strong); font-weight: 760; }
@media (max-width: 1080px) {
  .category-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 900px) {
  .hero-grid, .learning-section, .support-grid { grid-template-columns: 1fr; }
  .article-list { grid-template-columns: 1fr; }
}
@media (max-width: 620px) {
  .hero { padding: 28px 0 26px; }
  .hero-grid { gap: 22px; }
  .hero-copy h1 { font-size: 2.2rem; }
  .section-head { align-items: start; flex-direction: column; }
  .category-grid { grid-template-columns: 1fr; }
  .category-panel { min-height: 0; }
  .support-safe { align-items: flex-start; }
}
</style>
