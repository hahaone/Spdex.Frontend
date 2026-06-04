<script setup lang="ts">
import type { Component } from 'vue'
import { SlidersHorizontal } from '@lucide/vue'
import type { HomeSectionId } from '~/composables/useHomeLayout'
import HomeBigTrades from '~/components/home/HomeBigTrades.vue'
import HomeMetrics from '~/components/home/HomeMetrics.vue'
import HomeFeatures from '~/components/home/HomeFeatures.vue'
import HomeInfo from '~/components/home/HomeInfo.vue'
import HomeMembership from '~/components/home/HomeMembership.vue'
import HomeCustomizer from '~/components/home/HomeCustomizer.vue'

const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/')

const { orderedSections, editMode, syncFromServer } = useHomeLayout()
onMounted(syncFromServer)

// 模块 id → 组件（hero/membership 固定，不在可排序列表内）
const MODULE_COMPONENT: Record<HomeSectionId, Component> = {
  'big-trades': HomeBigTrades,
  'metrics': HomeMetrics,
  'features': HomeFeatures,
  'info': HomeInfo,
}
</script>

<template>
  <div class="home-page">
    <section class="hero">
      <div class="hero-row">
        <span class="hero-title">超级指数 · 今日异动</span>
        <div class="hero-right">
          <span class="hero-date num">{{ today }}</span>
          <button class="customize-btn focus-ring" :class="{ active: editMode }" @click="editMode = !editMode">
            <SlidersHorizontal :size="13" />
            <span>{{ editMode ? '完成' : '自定义' }}</span>
          </button>
        </div>
      </div>
      <div class="hero-meta">
        <span>POLY · 必发 · 双红 · 让分 · 进球</span>
      </div>
    </section>

    <HomeCustomizer v-if="editMode" />
    <div v-else class="module-stack">
      <component
        :is="MODULE_COMPONENT[id]"
        v-for="id in orderedSections"
        :key="id"
        :class="['module-item', `mod-${id}`, { 'mod-wide': id === 'metrics' }]"
      />
      <HomeMembership class="module-item mod-membership" />
    </div>
  </div>
</template>

<style scoped>
.home-page {
  display: grid;
}

.hero {
  padding: 10px 12px;
  background: linear-gradient(120deg, var(--brand) 0%, var(--brand-deep) 60%, var(--accent-deep) 100%);
  color: #fff;
}

.hero-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
}

.hero-title {
  font-size: 0.92rem;
  font-weight: 820;
  letter-spacing: 0.02em;
}

.hero-right {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.hero-date {
  opacity: 0.88;
  font-size: 0.8rem;
  font-weight: 720;
}

.customize-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 760;
}

.customize-btn.active {
  background: #fff;
  color: var(--brand-deep);
  border-color: #fff;
}

.hero-meta {
  margin-top: 4px;
  opacity: 0.82;
  font-size: 0.76rem;
  font-weight: 720;
}

/* 模块竖向堆叠（移动优先；桌面居中单列） */
.module-stack {
  display: grid;
  gap: 10px;
  padding: 10px 12px 16px;
}

@media (min-width: 1024px) {
  .hero {
    border-radius: 8px;
    margin-top: 16px;
    padding: 18px 22px;
  }

  .hero-title {
    font-size: 1.06rem;
  }

  .hero-date,
  .hero-meta {
    font-size: 0.86rem;
  }

  /* 桌面仪表盘：规则栅格；指标行占满整宽，其他模块自动填充左右空位。 */
  .module-stack {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-auto-flow: dense;
    align-items: start;
    width: 100%;
    max-width: 1120px;
    margin: 0 auto;
    padding: 16px 0 32px;
    gap: 16px;
  }

  .module-item {
    grid-column: span 6;
    min-width: 0;
  }

  .module-item.mod-wide {
    column-span: all;
    grid-column: 1 / -1;
  }

  .mod-big-trades,
  .mod-features {
    align-self: stretch;
  }
}

@media (min-width: 1440px) {
  .module-stack {
    max-width: 1280px;
    gap: 18px;
  }
}

@media (min-width: 1600px) {
  .module-stack {
    max-width: 1440px;
  }
}
</style>
