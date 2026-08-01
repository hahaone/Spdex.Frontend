<script setup lang="ts">
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
  <HelpArticleView :article="article" back-to="/docs" back-label="返回文档库" />
</template>
