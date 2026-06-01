<script setup lang="ts">
// 篮球图标（lucide 1.16 无篮球图标，自绘；样式与 lucide 一致：24x24 stroke currentColor）
withDefaults(defineProps<{ size?: number | string }>(), { size: 24 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2v20" />
    <path d="M2 12h20" />
    <path d="M4.6 5.2C7.5 8 7.5 16 4.6 18.8" />
    <path d="M19.4 5.2C16.5 8 16.5 16 19.4 18.8" />
  </svg>
</template>
