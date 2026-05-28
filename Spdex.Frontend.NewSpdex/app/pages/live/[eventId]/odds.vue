<script setup lang="ts">
import { ArrowLeft, RefreshCw } from '@lucide/vue'
import { chartSeries, liveDetail } from '~/data/mockPrototype'

const panel = ref('panel')
const options = [
  { label: '价格面板', value: 'panel' },
  { label: '价格比较', value: 'compare' },
  { label: '双红', value: 'model' },
]
</script>

<template>
  <div class="live-odds-page">
    <section class="header">
      <NuxtLink :to="`/live/${liveDetail.match.eventId}`" class="back focus-ring">
        <ArrowLeft :size="15" />
        <span>返回详情</span>
      </NuxtLink>
      <div class="teams">
        <span>{{ liveDetail.match.homeTeam }}</span>
        <b class="score num">{{ liveDetail.match.score[0] }} : {{ liveDetail.match.score[1] }}</b>
        <span>{{ liveDetail.match.awayTeam }}</span>
      </div>
    </section>

    <section class="controls">
      <SegmentedControl v-model="panel" :options="options" dense tone="accent" />
      <button class="refresh-btn focus-ring" aria-label="刷新">
        <RefreshCw :size="15" />
      </button>
    </section>

    <section class="chart-section">
      <div class="section-title brand">
        <span>实时价格走势</span>
      </div>
      <StaticTrendChart :points="chartSeries" :height="210" />
    </section>

    <section class="odds-panel">
      <div class="section-title">
        <span>价格面板 · 滚球</span>
      </div>
      <div class="odds-grid">
        <div v-for="item in liveDetail.oddsPanel" :key="item.market" class="odds-row">
          <b class="lbl">{{ item.market }}</b>
          <span class="num">主 {{ item.home }}</span>
          <span class="num line">平 {{ item.drawOrLine }}</span>
          <span class="num">客 {{ item.away }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.live-odds-page {
  display: grid;
}

.header {
  display: grid;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f7fafd 100%);
  border-bottom: 1px solid #eaeef4;
}

.back {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 4px;
  color: #1a8cd3;
  font-size: 0.78rem;
  font-weight: 740;
}

.teams {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1a2233;
  font-size: 0.92rem;
  font-weight: 780;
}

.score {
  padding: 1px 8px;
  border-radius: 3px;
  background: #1a2233;
  color: #fff;
  font-weight: 820;
}

.controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px;
  gap: 6px;
  align-items: center;
  padding: 8px 10px;
  background: #fff;
  border-bottom: 1px solid #eaeef4;
}

.refresh-btn {
  display: inline-grid;
  min-height: 28px;
  place-items: center;
  border: 1px solid #dde2eb;
  border-radius: 4px;
  background: #fff;
  color: #4a5364;
}

.chart-section,
.odds-panel {
  padding: 8px 10px;
  background: #fff;
  border-bottom: 1px solid #eaeef4;
}

.section-title {
  margin-bottom: 6px;
}

.odds-grid {
  display: grid;
  gap: 1px;
  background: #eaeef4;
  border: 1px solid #eaeef4;
  border-radius: 4px;
  overflow: hidden;
}

.odds-row {
  display: grid;
  grid-template-columns: 60px repeat(3, minmax(0, 1fr));
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: #fff;
  font-size: 0.78rem;
}

.odds-row .lbl {
  font-weight: 800;
  color: #4f3f86;
  font-size: 0.76rem;
}

.odds-row .num {
  text-align: center;
  font-weight: 740;
  color: #1a2233;
}

.odds-row .num.line {
  color: #1672b3;
}
</style>
