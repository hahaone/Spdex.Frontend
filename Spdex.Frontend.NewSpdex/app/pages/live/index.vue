<script setup lang="ts">
import { RefreshCw } from '@lucide/vue'
import type { LiveTab } from '~/types/live'
import { liveMatches } from '~/data/mockPrototype'

const tab = ref<LiveTab>('running')

const options = [
  { label: '进行中', value: 'running', count: 10 },
  { label: '未开赛', value: 'upcoming', count: 30 },
  { label: '已结束', value: 'finished', count: 8 },
]

const day = ref('today')
const dayOptions = [
  { label: '今日', value: 'today' },
  { label: '昨日', value: 'yesterday' },
  { label: '前日', value: 'before' },
]

const matches = computed(() => {
  if (tab.value === 'running') return liveMatches.filter(item => item.status === 'started')
  if (tab.value === 'upcoming') return liveMatches.filter(item => item.status === 'upcoming')
  return liveMatches.filter(item => item.status === 'finished')
})
</script>

<template>
  <div class="live-page">
    <section class="live-filters">
      <div class="filter-head">
        <h2>实时赛事</h2>
        <span class="muted">现场大单 · 滚球数据 · 30 秒刷新</span>
      </div>
      <div class="refresh-row">
        <SegmentedControl v-model="tab" :options="options" dense tone="brand" />
        <button class="refresh-btn focus-ring" aria-label="刷新">
          <RefreshCw :size="14" />
          <span class="num">28s</span>
        </button>
      </div>
      <SegmentedControl v-model="day" :options="dayOptions" dense tone="ink" />
    </section>

    <section class="live-list">
      <template v-for="match in matches" :key="`${match.eventId}-${tab}`">
        <UpcomingMatchCard v-if="tab === 'upcoming'" :match="match" />
        <LiveMatchCard v-else :match="match" />
      </template>
      <div v-if="!matches.length" class="empty">
        暂无赛事
      </div>
    </section>
  </div>
</template>

<style scoped>
.live-page {
  display: grid;
}

.live-filters {
  display: grid;
  gap: 6px;
  padding: 9px 10px;
  background: #ffffff;
  border-bottom: 1px solid #eaeef4;
}

.filter-head {
  display: none;
  align-items: baseline;
  justify-content: space-between;
}

.filter-head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 820;
}

.refresh-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  align-items: center;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  gap: 4px;
  padding: 0 9px;
  border: 1px solid #dde2eb;
  border-radius: 4px;
  background: #fff;
  color: #4a5364;
  font-size: 0.74rem;
  font-weight: 740;
}

.live-list {
  display: grid;
  gap: 7px;
  padding: 9px 10px 16px;
}

.empty {
  padding: 30px 0;
  color: #6b7280;
  text-align: center;
  font-size: 0.84rem;
  font-weight: 720;
}

@media (min-width: 1024px) {
  .live-page {
    gap: 14px;
    padding: 16px 0;
  }

  .live-filters {
    gap: 10px;
    padding: 14px 16px;
    border: 1px solid #dde2eb;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(26, 34, 51, 0.05);
  }

  .filter-head {
    display: flex;
    padding-bottom: 8px;
    border-bottom: 1px solid #eaeef4;
  }

  .live-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding: 0;
  }
}

@media (min-width: 1280px) {
  .live-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .live-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
