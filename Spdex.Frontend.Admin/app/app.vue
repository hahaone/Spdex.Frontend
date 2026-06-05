<template>
  <NConfigProvider :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN">
    <NMessageProvider>
      <NDialogProvider>
        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<script setup lang="ts">
import { zhCN, dateZhCN } from 'naive-ui'

const themeOverrides = {
  common: {
    primaryColor: '#7c5cfa',
    primaryColorHover: '#8f72ff',
    primaryColorPressed: '#6a4ce0',
    borderRadius: '8px',
  },
}
</script>
