<script setup lang="ts">
// 足球图标（lucide 1.16 无足球图标，自绘；样式与 lucide 一致：24x24 stroke currentColor）
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
    <path d="M12 8.7 15.1 11 13.9 14.7H10.1L8.9 11Z" />
    <path d="M12 8.7V2.2" />
    <path d="m15.1 11 6.2-1.9" />
    <path d="m13.9 14.7 3.9 5.3" />
    <path d="m10.1 14.7-3.9 5.3" />
    <path d="M8.9 11 2.7 9.1" />
  </svg>
</template>
