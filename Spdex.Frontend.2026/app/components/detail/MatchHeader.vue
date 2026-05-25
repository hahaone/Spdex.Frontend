<script setup lang="ts">
/**
 * 明细页面通用页头组件。
 * 显示返回链接、主客队名、赛事元信息。
 */

defineProps<{
  homeTeam?: string
  guestTeam?: string
  meta?: string
  backTo?: string
  backLabel?: string
}>()
</script>

<template>
  <div class="match-header">
    <NuxtLink :to="backTo ?? '/'" class="back-link">&larr; {{ backLabel ?? '返回列表' }}</NuxtLink>
    <h2 class="match-title">
      <span class="team-home">{{ homeTeam }}</span>
      <span class="team-vs">vs</span>
      <span class="team-away">{{ guestTeam }}</span>
    </h2>
    <div v-if="meta" class="match-meta">{{ meta }}</div>
    <slot />
  </div>
</template>

<style scoped>
.match-header {
  margin-bottom: 1rem;
}

.back-link {
  color: #2563eb;
  font-size: 0.85rem;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.match-title {
  font-size: 1.25rem;
  margin: 0.5rem 0 0.25rem;
}

.team-home {
  font-weight: 700;
  color: #1e40af;
}

.team-vs {
  color: #94a3b8;
  margin: 0 0.5rem;
  font-size: 0.9rem;
}

.team-away {
  font-weight: 500;
  color: #475569;
}

.match-meta {
  font-size: 0.82rem;
  color: #64748b;
}
</style>
