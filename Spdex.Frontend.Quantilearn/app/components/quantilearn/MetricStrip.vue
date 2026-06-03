<script setup lang="ts">
import { CalendarClock, Gauge, Target, TrendingUp } from '@lucide/vue'
import type { QuantModel } from '~/data/quantilearnPrototype'

defineProps<{
  model: QuantModel
}>()
</script>

<template>
  <div class="metric-strip">
    <div class="metric-tile">
      <div class="metric-icon teal"><TrendingUp :size="17" /></div>
      <span>年化收益</span>
      <strong class="num">{{ Math.round(model.yearReturn * 100) }}%</strong>
    </div>
    <div class="metric-tile">
      <div class="metric-icon blue"><Target :size="17" /></div>
      <span>分布</span>
      <strong class="num">{{ Math.round(model.distribution * 100) }}%</strong>
    </div>
    <div class="metric-tile">
      <div class="metric-icon amber"><Gauge :size="17" /></div>
      <span>命中样本</span>
      <strong class="num">{{ model.hit }}</strong>
    </div>
    <div class="metric-tile">
      <div class="metric-icon rose"><CalendarClock :size="17" /></div>
      <span>当前命中</span>
      <strong class="num">{{ model.hitEvents }}</strong>
    </div>
  </div>
</template>

<style scoped>
.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.metric-tile {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  grid-template-rows: auto auto;
  column-gap: 9px;
  align-items: center;
  min-height: 58px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow);
}

.metric-icon {
  display: grid;
  grid-row: 1 / 3;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 7px;
}

.metric-icon.teal {
  background: var(--teal-soft);
  color: var(--teal);
}

.metric-icon.blue {
  background: var(--blue-soft);
  color: var(--blue);
}

.metric-icon.amber {
  background: var(--amber-soft);
  color: var(--amber);
}

.metric-icon.rose {
  background: var(--rose-soft);
  color: var(--rose);
}

.metric-tile span {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-tile strong {
  color: var(--ink);
  font-size: 1.04rem;
  font-weight: 850;
  line-height: 1.1;
}

@media (max-width: 580px) {
  .metric-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
