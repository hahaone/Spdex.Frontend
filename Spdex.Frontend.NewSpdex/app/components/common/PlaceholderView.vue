<script setup lang="ts">
import { ArrowRight, Construction } from '@lucide/vue'

defineProps<{
  title: string
  subtitle: string
  tone: 'basketball' | 'volume' | 'signals' | 'account'
}>()
</script>

<template>
  <section :class="['placeholder', tone]">
    <div class="placeholder-head">
      <Construction :size="22" />
      <div class="head-text">
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
      </div>
    </div>

    <div class="placeholder-list">
      <div class="row">
        <span>入口状态</span>
        <b>占位 · 等待原型</b>
      </div>
      <div class="row">
        <span>数据模式</span>
        <b>Mock 静态</b>
      </div>
      <div class="row">
        <span>计划阶段</span>
        <b>stage 3 接 API 后启用</b>
      </div>
    </div>

    <NuxtLink to="/" class="home-link focus-ring">
      <span>返回首页</span>
      <ArrowRight :size="15" />
    </NuxtLink>
  </section>
</template>

<style scoped>
.placeholder {
  display: grid;
  gap: 10px;
  padding: 12px 12px 16px;
}

.placeholder-head {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 12px 12px;
  border-radius: 6px;
  color: #fff;
  box-shadow: 0 4px 14px rgba(26, 34, 51, 0.16);
}

.placeholder.basketball .placeholder-head {
  background: linear-gradient(120deg, #1a2233 0%, #2b3548 100%);
}

.placeholder.volume .placeholder-head {
  background: linear-gradient(120deg, var(--accent) 0%, var(--accent-deep) 100%);
}

.placeholder.signals .placeholder-head {
  background: linear-gradient(120deg, #c2410c 0%, #9a3409 100%);
}

.placeholder.account .placeholder-head {
  background: linear-gradient(120deg, var(--brand) 0%, var(--accent) 100%);
}

.placeholder-head svg {
  width: 36px;
  height: 36px;
  padding: 7px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.18);
}

.head-text {
  min-width: 0;
}

h1,
p {
  margin: 0;
}

h1 {
  font-size: 1.04rem;
  font-weight: 820;
}

p {
  opacity: 0.88;
  font-size: 0.78rem;
  font-weight: 720;
  margin-top: 2px;
}

.placeholder-list {
  display: grid;
  gap: 5px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  font-size: 0.84rem;
  font-weight: 740;
}

.row span {
  color: var(--muted);
}

.row b {
  color: var(--ink);
  font-weight: 800;
}

.home-link {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 0 13px;
  border-radius: 5px;
  background: #1a2233;
  color: #fff;
  font-weight: 800;
  font-size: 0.86rem;
}

.home-link:active {
  background: #0f1626;
}
</style>
