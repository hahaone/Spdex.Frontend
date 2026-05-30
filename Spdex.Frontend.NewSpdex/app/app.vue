<script setup lang="ts">
// 主题 class 跟随 cookie 偏好同步到 <html>（SSR + 客户端同读，无刷新闪烁）
const { isDark } = useTheme()
useHead({
  htmlAttrs: {
    class: computed(() => (isDark.value ? 'dark' : '')),
  },
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
