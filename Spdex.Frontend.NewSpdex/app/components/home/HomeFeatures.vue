<script setup lang="ts">
/** 首页模块「快速入口」：今日足球 / 实时赛事 工作台导航卡。 */
import { ArrowRight, Sparkles, TrendingUp } from '@lucide/vue'

const featureCards = [
  { id: 'football', title: '今日足球', subtitle: '今日重点赛事 · 异动 + 双红', to: '/football', icon: TrendingUp, tone: 'ink' },
  { id: 'live', title: '实时赛事', subtitle: '进行中赛事 · 现场赔率 + 赛况', to: '/live', icon: Sparkles, tone: 'signal' },
]
</script>

<template>
  <section class="col-features">
    <div class="col-head">
      <h2>快速入口</h2>
      <span class="muted">高频访问的赛事工作台</span>
    </div>
    <div class="feature-grid">
      <NuxtLink
        v-for="card in featureCards"
        :key="card.id"
        :to="card.to"
        :class="['feature-card focus-ring', card.tone]"
      >
        <component :is="card.icon" :size="20" stroke-width="2.2" />
        <div class="feature-text">
          <b>{{ card.title }}</b>
          <span>{{ card.subtitle }}</span>
        </div>
        <ArrowRight :size="16" />
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.col-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}

.col-head h2 {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 820;
  color: var(--ink);
}

.col-head .muted {
  font-size: 0.74rem;
  font-weight: 720;
}

.feature-grid {
  display: grid;
  gap: 8px;
}

.feature-card {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  align-items: center;
  gap: 10px;
  padding: 11px 16px 11px 12px;
  border-radius: 5px;
  color: #fff;
  box-shadow: 0 3px 10px rgba(26, 34, 51, 0.10);
  transition: transform 0.12s ease;
}

.feature-card:hover {
  transform: translateY(-1px);
}

.feature-card.ink {
  background: linear-gradient(120deg, #1a2233 0%, #2b3548 100%);
}

.feature-card.signal {
  background: linear-gradient(120deg, #c2410c 0%, #9a3409 100%);
}

.feature-card svg {
  flex: 0 0 auto;
  padding: 7px;
  width: 36px;
  height: 36px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.18);
}

.feature-text {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.feature-text b {
  font-size: 0.95rem;
  font-weight: 820;
  letter-spacing: 0.02em;
}

.feature-text span {
  opacity: 0.86;
  font-size: 0.74rem;
  font-weight: 720;
}
</style>
