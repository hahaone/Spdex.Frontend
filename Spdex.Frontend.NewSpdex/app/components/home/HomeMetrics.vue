<script setup lang="ts">
/** 首页模块「今日异动指标」：5 指标，按 useHomeLayout 的 orderedMetrics 排序+过滤可见。 */
import { ChevronRight, Lock } from '@lucide/vue'

const { metrics, prematchSixHourLockApplied, pending } = useDashboardMetrics()
const { orderedMetrics } = useHomeLayout()

// 按用户偏好排序 + 仅可见
const visibleMetrics = computed(() => {
  const byId = new Map(metrics.value.map(m => [m.id, m]))
  return orderedMetrics.value
    .map(id => byId.get(id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
})
</script>

<template>
  <section class="col-metrics">
    <div class="col-head">
      <h2>今日异动指标</h2>
      <span class="muted">点击进入对应筛选</span>
    </div>
    <div v-if="prematchSixHourLockApplied" class="lock-banner">
      <Lock :size="13" />
      <span>免费会员已隐去赛前 6 小时内及 24 小时以外的未开赛赛事</span>
    </div>

    <div class="metric-list">
      <div v-if="pending && !metrics.length" class="metric-skeleton">
        <div v-for="i in 5" :key="i" class="skeleton-row" />
      </div>

      <p v-else-if="!visibleMetrics.length" class="metric-empty">
        已隐藏全部指标，点右上「自定义」恢复
      </p>

      <NuxtLink
        v-for="item in visibleMetrics"
        v-else
        :key="item.id"
        :to="item.to"
        :class="['metric-row focus-ring', item.tone, { 'is-pending': item.status === 'pending' }]"
      >
        <div class="metric-left">
          <span class="metric-dot" />
          <strong>{{ item.title }}</strong>
          <span v-if="item.threshold" class="threshold num">{{ item.threshold }}</span>
          <span v-if="item.status === 'pending'" class="pending-tag">待接入</span>
        </div>
        <b class="metric-count num">{{ item.status === 'pending' ? '—' : item.count }}</b>
        <ChevronRight :size="16" />
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

.metric-list {
  display: grid;
  gap: 6px;
}

.metric-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  min-height: 50px;
  gap: 8px;
  padding: 8px 10px 8px 12px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  box-shadow: 0 2px 6px rgba(26, 34, 51, 0.05);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.metric-row:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(26, 34, 51, 0.10);
}

.metric-left {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
}

.metric-dot {
  flex: 0 0 auto;
  align-self: center;
  width: 6px;
  height: 22px;
  border-radius: 1px;
}

.metric-row.bf .metric-dot { background: var(--brand); }
.metric-row.poly .metric-dot { background: var(--accent); }
.metric-row.index .metric-dot { background: var(--sell); }
.metric-row.signal .metric-dot { background: var(--buy); }

.metric-row strong {
  min-width: 0;
  overflow: hidden;
  font-size: 0.96rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.threshold {
  padding: 1px 5px;
  border-radius: 2px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 720;
  white-space: nowrap;
}

.metric-count {
  min-width: 30px;
  text-align: right;
  font-size: 1.3rem;
  font-weight: 860;
  color: var(--ink);
}

.metric-row.signal .metric-count { color: var(--buy); }
.metric-row.is-pending { opacity: 0.62; }
.metric-row.is-pending .metric-count { color: var(--soft); }
.metric-row svg { color: var(--soft); }

.pending-tag {
  padding: 1px 5px;
  border-radius: 2px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 720;
}

.lock-banner {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 8px;
  padding: 5px 9px;
  border: 1px solid var(--away-strong);
  border-radius: 4px;
  background: var(--away-bg);
  color: #8a6212;
  font-size: 0.74rem;
  font-weight: 720;
}

.metric-empty {
  margin: 0;
  padding: 16px 12px;
  border: 1px dashed var(--line);
  border-radius: 5px;
  background: var(--surface);
  color: var(--muted);
  text-align: center;
  font-size: 0.78rem;
  font-weight: 720;
}

.metric-skeleton {
  display: grid;
  gap: 6px;
}

.skeleton-row {
  height: 50px;
  border: 1px solid var(--divider);
  border-radius: 5px;
  background: linear-gradient(90deg, var(--surface) 0%, var(--divider) 50%, var(--surface) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
