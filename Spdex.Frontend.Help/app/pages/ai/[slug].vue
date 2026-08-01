<script setup lang="ts">
import { findAiArticle } from '~/data/helpContent'

const route = useRoute()
const slug = String(route.params.slug || '')
const article = findAiArticle(slug)

if (!article) {
  throw createError({ statusCode: 404, statusMessage: '未找到 AI 帮助文档' })
}

useSeoMeta({
  title: `${article.title} | SPdex 帮助中心`,
  description: article.summary,
})
</script>

<template>
  <HelpArticleView :article="article" back-to="/ai" back-label="返回 AI 专区" />
</template>
